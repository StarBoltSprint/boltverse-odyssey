#!/usr/bin/env python3
"""One entry: key image + spec -> GLB (lod0/1/2) + contact sheet + metrics.json.

  python3 tools/kit/kit.py build --key key.jpg --spec spec.json --out out/
  python3 tools/kit/kit.py build --key key.jpg --spec spec.json --out out/ --mask tier_mask.png --door door_mask.png --fit

Exit 0 when every gate passes, 1 when a gate fails (files are still written), 2 usage.
Gates: iou_closed >= 0.85, iou_raw >= 0.75, open_edges == 0, lod0 triangles <= budget,
texture px/m >= 500. Live px/m and dE under real lighting are measured in the viewer, not here.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build import MATLIB, build  # noqa: E402
from fit import fit  # noqa: E402
from glb import write_glb  # noqa: E402
from render import look_at, metrics, shade, silhouette  # noqa: E402

GATES = {"iou_closed": 0.85, "iou_raw": 0.75, "ppm": 500}


def load_mask(p, shape):
    if p is None:
        return None
    m = np.load(p) if str(p).endswith(".npy") else cv2.imread(str(p), 0)
    m = cv2.resize(m.astype(np.uint8), (shape[1], shape[0]), interpolation=cv2.INTER_NEAREST)
    return m > (127 if m.max() > 1 else 0)


def views(spec):
    t = spec["tiers"]
    W = t["width_m"]
    H = t["rise_m"] * t["count"]
    c = spec["camera"]
    mid = np.array([W / 2, 1.0, H / 2])
    return {
        "keycam": look_at(c["pos"], c["target"], c.get("fov_deg", 60), c.get("w", 1024), c.get("h", 1024), c.get("up", (0, 0, 1))),
        "near3m": look_at(mid + [0, -3.0, -H / 2 + 1.6], mid + [0, 0, -H / 2 + 1.6], 60, 512, 512),
        "oblique45": look_at(mid + [-4.0, -4.0, -H / 2 + 1.6], mid + [0, 0, -H / 2 + 1.6], 60, 512, 512),
        "grazing": look_at([-1.5, -0.6, 1.6], [W, 0.2, 1.6], 60, 512, 512),
        "chase": look_at(mid + [0, -7.5, -H / 2 + 3.0], mid + [0, 0, -H / 2 + 1.2], 60, 512, 512),
    }


def contact(lods, cams, key, target, colours):
    tiles = []
    for name, cam in cams.items():
        im = shade(lods["lod0"], cam, colours)
        im = cv2.resize(im, (512, 512))
        cv2.putText(im, name, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
        tiles.append(im)
    if key is not None:
        k = cv2.resize(key, (512, 512))
        if target is not None:
            sil = silhouette(lods["lod0"], cams["keycam"])
            ov = k.copy()
            ov[cv2.resize(sil.astype(np.uint8), (512, 512)) > 0] = (0, 200, 255)
            ov[cv2.resize((target & ~sil).astype(np.uint8), (512, 512)) > 0] = (255, 0, 255)
            k = cv2.addWeighted(k, 0.5, ov, 0.5, 0)
        cv2.putText(k, "key + IoU (orange=kit, pink=miss)", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        tiles.insert(0, k)
    while len(tiles) % 3:
        tiles.append(np.zeros_like(tiles[0]))
    return np.vstack([np.hstack(tiles[i:i + 3]) for i in range(0, len(tiles), 3)])


def calibrate_snow(lods, cam, target, snow_mask, iters=9, caps=None, cornice_front=False):
    """Bisect the threshold on the blurred key snow mask so the model's visible snow/stone ratio at the
    key camera matches the key's. Rewrites _SNOW on tier/cornice of every LOD. Returns the threshold."""
    from outline import snow_attr
    from render import snow_ratio
    from geom import vertex_normals

    def apply(thr):
        for v in lods.values():
            for m in v:
                if m.name in ("tier1", "cornice"):
                    s = snow_attr(m, cam, snow_mask, thr=thr)
                    if m.name == "cornice":
                        N = vertex_normals(m)
                        s = np.where(N[:, 2] < -0.3, 0.0, np.maximum(s, (N[:, 2] > 0.5) * 1.0))
                        if cornice_front:
                            s = np.maximum(s, ((N[:, 1] < -0.3) & (N[:, 2] > -0.3)) * 1.0)
                    if caps is not None:
                        N = vertex_normals(m)
                        s = np.maximum(s, (N[:, 2] > caps) * 1.0)
                    m.attrs["_SNOW"] = s
    lo, hi, best = 0.02, 0.98, None
    for _ in range(iters):
        mid = (lo + hi) / 2
        apply(mid)
        r = snow_ratio(lods["lod0"], cam, target, snow_mask)
        print(f"  snow calibrate thr {mid:.3f} -> model {r['model']} key {r['key']} off {r['rel_diff']:.2%}")
        if best is None or r["rel_diff"] < best[1]:
            best = (mid, r["rel_diff"])
        if r["model"] > r["key"]:
            lo = mid
        else:
            hi = mid
    apply(best[0])
    return round(best[0], 4)


def cmd_build(a) -> int:
    spec = json.loads(Path(a.spec).read_text())
    key = cv2.imread(a.key) if a.key else None
    shape = key.shape[:2] if key is not None else (spec["camera"].get("h", 1024), spec["camera"].get("w", 1024))
    target = load_mask(a.mask or spec.get("mask"), shape)
    door = load_mask(a.door or spec.get("door_mask"), shape)
    cams = views(spec) if "tiers" in spec and "width_m" in spec["tiers"] else None
    if a.fit:
        c = spec["camera"]
        kc = look_at(c["pos"], c["target"], c.get("fov_deg", 60), shape[1], shape[0])
        fit(spec, kc, key, target, door)
        cams = views(spec)
    matlib = Path(a.matlib)
    mats = {k: json.loads((matlib / v / "metadata.json").read_text()) for k, v in spec["materials"].items()}
    colours = {"stone": mats["stone"]["mean_bgr"] if "mean_bgr" in mats["stone"] else (110, 80, 60),
               "snow": (225, 205, 195), "ice": (235, 215, 200)}
    colours.update({k: tuple(v) for k, v in spec.get("flat_colours_bgr", {}).items()})
    masks = None
    if spec.get("outline"):
        base = Path(a.spec).resolve().parent
        rd = lambda q: load_mask(q if Path(q).is_absolute() else base / q, shape) if q else None
        o = spec["outline"]
        masks = {k: rd(o.get(f"{k}_mask")) for k in ("tier", "door", "cornice", "snow", "band")}
        if target is None and masks["tier"] is not None:
            target = masks["tier"] | (masks["cornice"] if masks["cornice"] is not None else False)
            target_v6 = target.copy()
            if masks.get("band") is not None:
                target = target | masks["band"]
        else:
            target_v6 = None
    lods = build(spec, matlib, cams["keycam"] if cams else None, masks, key)
    extra = lods.pop("_extra", {})
    if spec.get("outline", {}).get("v7") and masks and masks.get("snow") is not None and target is not None and not a.no_calibrate:
        spec["outline"]["snow_thr"] = calibrate_snow(lods, cams["keycam"], target, masks["snow"], caps=spec["outline"].get("caps_up_k"), cornice_front=spec["outline"].get("cornice_front_snow", False))
    if a.fit_camera and target is not None:
        from fit import fit_camera
        from render import iou as _iou
        spec["camera"], s0 = fit_camera(spec, lods["lod2"], target, look_at, silhouette, _iou)
        spec.setdefault("fit", {})["camera_iou_lowres"] = s0
        cams = views(spec)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    for k, v in lods.items():
        write_glb(out / f"kit-{k}.glb", v, {"spec": spec.get("id", "kit"), "lod": k, "materials": spec["materials"]})
    m = metrics(lods, cams["keycam"], target, key, colours, mats, spec.get("budget", {}).get("lod0_tris", 90000),
                snow_mask=(masks or {}).get("snow"))
    fails = []
    if "iou_closed" in m and m["iou_closed"] < GATES["iou_closed"]:
        fails.append(f"iou_closed {m['iou_closed']} < {GATES['iou_closed']}")
    if "iou_raw" in m and m["iou_raw"] < GATES["iou_raw"]:
        fails.append(f"iou_raw {m['iou_raw']} < {GATES['iou_raw']}")
    ig = spec.get("gates", {}).get("iou_closed_min")
    if ig and m.get("iou_closed", 1) < ig:
        fails.append(f"iou_closed {m['iou_closed']} < spec gate {ig}")
    if m["open_edges"]:
        fails.append(f"open_edges {m['open_edges']}")
    if not m["budget_ok"]:
        fails.append(f"lod0 {m['triangles']['lod0']} tris > {m['budget_lod0']}")
    for k, v in m.get("px_per_m_texture", {}).items():
        if v < GATES["ppm"]:
            fails.append(f"{k} texture {v} px/m < {GATES['ppm']}")
    if masks and target_v6 is not None and masks.get("band") is not None:
        from render import iou as _iou
        silv = silhouette(lods["lod0"], cams["keycam"])
        dif = np.zeros(silv.shape + (3,), np.uint8); dif[silv & ~target] = (0, 0, 255); dif[~silv & target] = (255, 0, 0); dif[silv & target] = (90, 90, 90)
        cv2.imwrite(str(out / "iou-diff.png"), dif)   # red = model only, blue = key only
        kk = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
        cl = lambda x: cv2.morphologyEx(x.astype(np.uint8), cv2.MORPH_CLOSE, kk, borderType=cv2.BORDER_REPLICATE) > 0
        m["iou_vs_tier_cornice_only"] = {"raw": round(_iou(silv, target_v6), 3), "closed": round(_iou(cl(silv), cl(target_v6)), 3)}
        m["target"] = "tier + band + cornice SAM masks (band = key upper wall behind the cornice)"
        lt = spec.get("outline", {}).get("legacy_tier_mask")
        if lt:   # v9: also score against the old v4 SAM tier mask (+cornice, +band) for comparison
            L = cv2.resize(cv2.imread(str(Path(a.spec).parent / lt), 0), (silv.shape[1], silv.shape[0])) > 127
            cm = masks["cornice"] if masks.get("cornice") is not None else np.zeros_like(L)
            for nm, tg in (("iou_vs_old_tier_cornice", L | cm), ("iou_vs_old_tier_band_cornice", L | cm | masks["band"])):
                m[nm] = {"raw": round(_iou(silv, tg), 3), "closed": round(_iou(cl(silv), cl(tg)), 3)}
        ign = masks["band"] & ~target_v6          # band pixels: real wall the SAM tier mask missed -> don't score
        sv, tv = cl(silv) & ~ign, cl(target_v6) & ~ign
        m["iou_vs_tier_cornice_band_ignored"] = {"raw": round(_iou(silv & ~ign, target_v6), 3), "closed": round(_iou(sv, tv), 3)}
    snow_gate = spec.get("gates", {}).get("snow_ratio_rel", 0.10)
    if m.get("snow_ratio") and m["snow_ratio"]["rel_diff"] > snow_gate:
        fails.append(f"snow/stone ratio off by {m['snow_ratio']['rel_diff']:.1%} (> {snow_gate:.0%})")
    if spec.get("gates", {}).get("nonmanifold_zero") and m.get("nonmanifold_edges"):
        fails.append(f"nonmanifold_edges {m['nonmanifold_edges']}")
    m.update(extra)
    if spec.get("outline", {}).get("v7"):
        m["snow_thr"] = spec["outline"].get("snow_thr")
        from outline import float_report
        solids = [x for x in lods["lod0"] if x.name in ("tier1", "corbel", "seat")]
        probes = extra.pop("cornice_probes", None)
        if probes:
            m["cornice_float"] = float_report(solids, probes)
            if m["cornice_float"]["fraction"] > spec.get("gates", {}).get("float_max", 1.0):
                fails.append(f"cornice float {m['cornice_float']}")
    m["verdict"] = "PASS" if not fails else "FAIL"
    m["fails"] = fails
    m["spec"] = spec
    (out / "metrics.json").write_text(json.dumps(m, indent=2, default=lambda o: o.tolist() if hasattr(o, "tolist") else str(o)) + "\n")
    if not a.no_sheet:
        cv2.imwrite(str(out / "contact.jpg"), contact(lods, cams, key, target, colours), [cv2.IMWRITE_JPEG_QUALITY, 85])
    print(f"{m['verdict']} kit {out} tris={m['triangles']} iou={m.get('iou_raw')}/{m.get('iou_closed')} "
          f"open_edges={m['open_edges']}" + (f" fails={fails}" if fails else ""))
    return 0 if not fails else 1


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="kit.py", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd")
    b = sub.add_parser("build")
    b.add_argument("--key")
    b.add_argument("--spec", required=True)
    b.add_argument("--out", required=True)
    b.add_argument("--mask", help="target silhouette (SAM tier+cornice), .png or .npy")
    b.add_argument("--door", help="recess mask for --fit")
    b.add_argument("--fit", action="store_true", help="fill width/recess from masks + key lines, clamp by rules")
    b.add_argument("--fit-camera", action="store_true", help="search the key camera against --mask (coarse LOD)")
    b.add_argument("--matlib", default=str(MATLIB))
    b.add_argument("--no-sheet", action="store_true")
    b.add_argument("--no-calibrate", action="store_true", help="keep outline.snow_grow_px from the spec")
    a = p.parse_args(argv)
    if a.cmd != "build":
        p.print_help()
        return 2
    return cmd_build(a)


if __name__ == "__main__":
    sys.exit(main())

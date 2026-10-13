#!/usr/bin/env python3
"""tools/keysheet/auto_check.py - score a key-camera render against the AUTO key sheet (auto_extract.py).
usage: python3 tools/keysheet/auto_check.py RENDER.png SHEETDIR [--scope MASK.png] [--out report.json] [--no-dino]
The render is taken from the key camera, so each key region reprojects to the same pixels (identity reprojection
in the 1024 key frame); a render from another camera must be warped into the key frame first (render depth + P).
Stage gate: L1 forms (shape IoU, colour dE, snow fraction) -> L2 elements one by one (coverage IoU, location,
thickness, silhouette roughness, straightness, colour, edge density) -> L3 statistics per form (tile texture
stats z-distance, DINO patch cosine). Each sub-score 0..100, element = min, level = min over elements;
any level < BLOCK fails and later levels are reported as 'stage-blocked'."""
import argparse, json, subprocess, sys
from pathlib import Path
import numpy as np, cv2
from skimage.color import rgb2lab
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from auto_extract import rough_straight, thick, tile_stats, W  # noqa: E402
BLOCK = 50.0; VENV = "/workspace/.venv-sam2/bin/python"


def lin(v, good, bad):
    return float(np.clip(100 * (v - bad) / (good - bad), 0, 100)) if good != bad else 100.0


def maps(bgr, ref):
    lab = rgb2lab(bgr[:, :, ::-1] / 255.0).astype(np.float32); L = lab[..., 0]
    top = L - cv2.GaussianBlur(L, (0, 0), 12)
    snow = (L > ref["Lp85"]) | ((top > 7) & (L > ref["Lp55"]))
    ice = (lab[..., 1] < ref["Ap10"]) & (L > 25) & ~snow
    brt = (L > ref["Lp50"]).astype(np.uint8)   # same drip detector as auto_extract
    v = cv2.morphologyEx(brt, cv2.MORPH_OPEN, np.ones((9, 1), np.uint8)); h = cv2.morphologyEx(brt, cv2.MORPH_OPEN, np.ones((1, 7), np.uint8))
    drip = cv2.morphologyEx(v & (1 - h), cv2.MORPH_OPEN, np.ones((5, 1), np.uint8)).astype(bool)
    return lab, snow, ice, drip


def l2masks(sheet_dir):
    d = np.load(Path(sheet_dir) / "L2masks.npz")["m"]
    return np.unpackbits(d, axis=-1)[..., :W].astype(bool)


def check(render, sheet_dir, scope=None, dino=True, full=False, render_depth=None):
    sheet_dir = Path(sheet_dir); sh = json.loads((sheet_dir / "sheet.json").read_text())
    K = cv2.imread(str(sheet_dir / "key1024.png")); R = cv2.resize(cv2.imread(str(render)), (W, W), interpolation=cv2.INTER_AREA)
    klab0 = rgb2lab(K[:, :, ::-1] / 255.0)
    ref = {"Lp85": np.percentile(klab0[..., 0], 85), "Lp55": np.percentile(klab0[..., 0], 55), "Ap10": np.percentile(klab0[..., 1], 10), "Lp50": np.percentile(klab0[..., 0], 50)}
    klab, ksnow, kice, kdrip = maps(K, ref); rlab, rsnow, rice, rdrip = maps(R, ref)
    S = None if scope is None else cv2.resize(cv2.imread(str(scope), 0), (W, W)) > 127
    L1 = cv2.imread(str(sheet_dir / "L1.png"), 0); M2 = l2masks(sheet_dir)
    els1 = [e for e in sh["elements"] if e["level"] == 1]; els2 = [e for e in sh["elements"] if e["level"] == 2]
    inscope = lambda m: S is None or (m & S).sum() >= 0.5 * m.sum()
    in1 = lambda m: S is None or (m & S).sum() >= 0.1 * S.sum()
    # ---- L1
    means = np.array([e["lab"] for e in els1], np.float32)
    near = lambda lab: ((lab.reshape(-1, 1, 3) - means[None]) ** 2).sum(-1).argmin(1).reshape(W, W) + 1
    edge6 = lambda img: cv2.dilate(cv2.Canny(cv2.GaussianBlur(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), (0, 0), 1.5), 30, 90), np.ones((13, 13), np.uint8))
    knear, rnear = edge6(K), edge6(R)
    rows1 = []
    for i, e in enumerate(els1, 1):
        m = L1 == i
        if not m.any() or not in1(m):
            continue
        if S is not None:
            m = m & S
        Sv = np.ones((W, W), bool) if S is None else S
        # shape = boundary recall: share of the form's outline (in scope) that has an image edge within 6 px,
        # render vs key (colour labelling flips between near-identical forms; outlines do not)
        mi = (L1 == i).astype(np.uint8); bd = (cv2.morphologyEx(mi, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8)) > 0) & Sv
        bd &= (cv2.erode(np.pad(np.ones((W - 8, W - 8), np.uint8), 4), np.ones((3, 3), np.uint8)) > 0)   # frame border is not an outline
        if bd.sum() < 30:
            iou = 1.0
        else:
            rec = lambda E: float((E[bd] > 0).mean())
            iou = min(1.0, rec(rnear) / max(rec(knear), 1e-3))
        dE = float(np.linalg.norm(rlab[m].mean(0) - klab[m].mean(0)))
        dsf = abs(float(rsnow[m].mean()) - float(ksnow[m].mean()))
        sub = {"shape_iou": lin(iou, 0.8, 0.4), "colour": lin(dE, 5, 25), "snow_frac": lin(dsf, 0.05, 0.25)}
        rows1.append({"id": e["id"], "class": e["class"], "outline_recall_rel": round(iou, 3), "dE": round(dE, 1), "d_snow_frac": round(dsf, 3),
                      "sub": {k: round(v, 1) for k, v in sub.items()}, "value": round(min(sub.values()), 1)})
    # ---- L2: the FIXED generic property set (props.py) for every element, key props (sheet) vs render props
    import props as PR
    rdepth = np.load(render_depth).astype(np.float32) if render_depth else None
    rctx = PR.Ctx(R, rdepth, sh.get("focal_px"), sh.get("ref"))
    sel = [(e, m) for e, m in zip(els2, M2) if m.any() and e.get("props") and inscope(m)]
    rprops = []
    for e, m in sel:
        reg = PR.region(rctx, m, np.array(e["lab"]), np.array(e["ring_lab"]))
        rprops.append(PR.props(rctx, reg) if reg.sum() >= 6 else None)
    cls = [e["class"] for e, _ in sel]
    PR.relations([e for e, _ in sel], rprops, cls)
    kprops = [dict(e["props"]) for e, _ in sel]; PR.relations(None, kprops, cls)   # key relations over the same subset
    rows2 = []
    for (e, m), rp, kp in zip(sel, rprops, kprops):
        sub = PR.compare(kp, rp)
        na = sorted(k for k in e["props"] if not k.startswith(("_", "outline.sig")) and k not in sub and k not in ("col.L", "col.a", "col.b") and not k.startswith(("albedo.", "light.dir")))
        rows2.append({"id": e["id"], "class": e["class"], "src": e["src"], "bbox_px": e["bbox_px"],
                      "sub": {k: round(v, 1) for k, v in sub.items()}, "na": na, "value": round(min(sub.values()), 1)})
    # ---- L3
    gk, gr = (cv2.cvtColor(x, cv2.COLOR_BGR2GRAY).astype(np.float32) for x in (K, R))
    rows3, boxes, tmp = [], [], sheet_dir / "_l3"
    tmp.mkdir(exist_ok=True)
    for i, e in enumerate(els1, 1):
        m = L1 == i
        if not m.any() or not in1(m):
            continue
        if S is not None:
            m = m & S
        tk, tr = tile_stats(gk, m), tile_stats(gr, m)
        z = float(np.mean(np.abs(tr.mean(0) - tk.mean(0)) / (tk.std(0) + 1e-3))) if len(tk) and len(tr) else 9.0
        rows3.append({"id": e["id"], "class": e["class"], "tiles": int(len(tk)), "tile_z": round(z, 3), "sub": {"tile_stats": round(lin(z, 0.5, 2.0), 1)}})
        mp = tmp / f"{e['id']}.png"; cv2.imwrite(str(mp), m.astype(np.uint8) * 255); ys, xs = np.nonzero(m); boxes.append([int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1, str(mp)])
    gate12 = bool(rows1) and min(r["value"] for r in rows1) >= BLOCK and bool(rows2) and min(r["value"] for r in rows2) >= BLOCK
    if dino and boxes and (gate12 or full):   # stage gate: the ~10 s DINO load only runs once L1+L2 are green
        bj = tmp / "boxes.json"; bj.write_text(json.dumps(boxes))
        out = subprocess.run([VENV, str(HERE / "dino_boxes.py"), str(render), str(sheet_dir / "key1024.png"), str(bj)], capture_output=True, text=True)
        try:
            ds = json.loads(out.stdout.strip().splitlines()[-1])
            for r, d in zip(rows3, ds):
                r["dino_patch_cos"] = d["patch_cos"]; r["sub"]["dino"] = round(lin(d["patch_cos"], 0.6, 0.3), 1)
        except Exception:  # noqa: BLE001
            for r in rows3:
                r["sub"]["dino"] = 0.0; r["dino_error"] = out.stderr[-300:]
    for r in rows3:
        r["value"] = round(min(r["sub"].values()), 1)
    lv = lambda rows: (min(r["value"] for r in rows) if rows else 0.0)
    rep = {"render": str(render), "sheet": str(sheet_dir), "scope": None if scope is None else str(scope), "block": BLOCK, "levels": {}}
    blocked = False
    for name, rows in (("L1", rows1), ("L2", rows2), ("L3", rows3)):
        v = lv(rows); ok = bool(rows) and v >= BLOCK
        rep["levels"][name] = {"n": len(rows), "min": v, "median": float(np.median([r["value"] for r in rows])) if rows else 0.0,
                               "pass_frac": round(float(np.mean([r["value"] >= BLOCK for r in rows])) if rows else 0.0, 3),
                               "status": "stage-blocked" if blocked else ("PASS" if ok else "FAIL"),
                               "worst": sorted(rows, key=lambda r: r["value"])[:5], "rows": rows}
        blocked = blocked or not ok
    fs = [r for r in rows2 if r["src"] == "tophat"]
    rep["facade_snow"] = {"n": len(fs), "min": min((r["value"] for r in fs), default=None),
                          "pass_frac": round(float(np.mean([r["value"] >= BLOCK for r in fs])), 3) if fs else None}
    # facade blocks: block size distribution / joint pattern / protrusion = the parts.* properties of stone elements
    fb = []
    for r in rows2:
        ps = {k: v for k, v in r["sub"].items() if k.startswith("parts.")}
        if r["class"] == "stone" and ps:
            fb.append(min(ps.values()))
    rep["facade_blocks"] = {"n": len(fb), "min": min(fb) if fb else None, "pass_frac": round(float(np.mean([v >= BLOCK for v in fb])), 3) if fb else None}
    dr = [r for r in rows2 if r["src"] == "drip"]
    rep["drips"] = {"n": len(dr), "min": min((r["value"] for r in dr), default=None),
                    "pass_frac": round(float(np.mean([r["value"] >= BLOCK for r in dr])), 3) if dr else None}
    rep["verdict"] = "FAIL" if blocked else "PASS"
    rep["value"] = min(rep["levels"][k]["min"] for k in rep["levels"])
    return rep, K, R


def review(rep, K, R, path):
    a, b = K.copy(), R.copy()
    for r in rep["levels"]["L2"]["worst"]:
        x0, y0, x1, y1 = r["bbox_px"]
        for im in (a, b):
            cv2.rectangle(im, (x0 - 3, y0 - 3), (x1 + 3, y1 + 3), (0, 0, 255), 2)
            cv2.putText(im, f"{r['id']} {r['value']:.0f}", (x0, max(y0 - 6, 12)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
    cv2.imwrite(str(path), cv2.resize(np.hstack([a, b]), (1600, 800)), [cv2.IMWRITE_JPEG_QUALITY, 80])


def main(argv=None):
    ap = argparse.ArgumentParser(); ap.add_argument("render"); ap.add_argument("sheet"); ap.add_argument("--scope"); ap.add_argument("--out")
    ap.add_argument("--no-dino", action="store_true"); ap.add_argument("--render-depth", help="render metric depth .npy (key frame) for depth/size/protrusion props"); ap.add_argument("--review"); ap.add_argument("--full", action="store_true", help="run DINO even when stage-blocked")
    a = ap.parse_args(argv)
    rep, K, R = check(a.render, a.sheet, a.scope, not a.no_dino, a.full, a.render_depth)
    if a.review:
        review(rep, K, R, a.review)
    if a.out:
        Path(a.out).write_text(json.dumps(rep, indent=1))
    print(json.dumps({"verdict": rep["verdict"], "value": rep["value"], "facade_snow": rep["facade_snow"], "facade_blocks": rep["facade_blocks"], "drips": rep["drips"], **{k: {kk: v[kk] for kk in ("n", "min", "median", "pass_frac", "status")} for k, v in rep["levels"].items()}}))
    return 0 if rep["verdict"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())

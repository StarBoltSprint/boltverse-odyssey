#!/usr/bin/env python3
"""Generic terrain-from-key: any zone, masks derived from the key (masks_auto.py), config per zone (zones/<zone>.json).

  python3 tools/terrain-from-key/generic.py --zone zone-d [--key K] [--out DIR] [--offline]
  python3 tools/terrain-from-key/generic.py --config cfg.json ...

Zone B keeps its original pipeline (run.py, colour mask, live preview staging); this path never touches a live page.
Relief = the key's own relief/sky boundary per column -> rim height per azimuth (mirrored to 360 deg), a flat walkable
spine, 0 Imagine images. Writes OUT/data/height.bin + height.json (same meta keys as run.py), masks.png, gates.json.
Exit 0 PASS, 1 gate FAIL, 2 bad input.
"""
import argparse, json, math, os, sys
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent; REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))
from masks_auto import auto_masks  # noqa: E402

G = {"groundFracMin": 0.05, "skyFracMin": 0.03, "horizon": [0.15, 0.85], "rimMinM": 40.0, "spineSlopeMax": 0.3}


def build(m, cfg, n=129, size=600.0):
    rel = m["relief"] | m["ground"]  # land
    h, w = rel.shape; hz = m["horizon"] * h
    fov = math.radians(cfg.get("fovDeg", 48)); f = (w / 2) / math.tan(fov / 2)
    tops = np.array([np.argmax(rel[:, x]) if rel[:, x].any() else hz for x in range(w)], np.float32)
    ang = np.arctan((hz - tops) / f)  # elevation of the land top above the horizon, per column
    rim_d = cfg.get("rimDistM", 260.0)
    prof = np.clip(np.tan(np.clip(ang, 0, None)) * rim_d, 0, 400)
    k = max(3, w // 64); prof = np.convolve(prof, np.ones(k) / k, "same")
    ring = np.concatenate([prof, prof[::-1]])
    xs = np.linspace(-size / 2, size / 2, n); X, Z = np.meshgrid(xs, xs); R = np.hypot(X, Z)
    A = (np.arctan2(Z, X) + np.pi) / (2 * np.pi)
    rim = G["rimMinM"] + ring[(A * (len(ring) - 1)).astype(int)]
    H = np.where(R > 150, rim * np.clip((R - 150) / 120, 0, 1) ** 1.6, 0.0)
    near = m["disp"][int(h * 0.6):]; rough = float(np.std(near)) if near.size else 0.0
    H += (0.5 + 4 * rough) * np.sin(X / 23) * np.cos(Z / 31) * np.clip(np.abs(X) / 20 - 0.5, 0, 1)
    return H.astype(np.float32), xs, rim


def main(argv=None):
    ap = argparse.ArgumentParser(); ap.add_argument("--zone"); ap.add_argument("--config"); ap.add_argument("--key")
    ap.add_argument("--out"); ap.add_argument("--offline", action="store_true"); a = ap.parse_args(argv)
    if a.config: cfg = json.load(open(a.config))
    elif a.zone:
        p = HERE / "zones" / f"{a.zone}.json"
        if not p.exists(): print(f"no zone config {p}", file=sys.stderr); return 2
        cfg = json.loads(p.read_text())
    else: cfg = {"zone": "adhoc", "mask": {"method": "auto"}}
    key = Path(a.key or cfg.get("key", ""))
    if not key.is_file(): print(f"key image not found: {key}", file=sys.stderr); return 2
    try: Image.open(key).verify()
    except Exception: print(f"not an image: {key}", file=sys.stderr); return 2
    mc = cfg.get("mask", {})
    if mc.get("method") == "colour":
        print("colour-rule zones run through run.py (Zone B); generic.py derives masks from the key", file=sys.stderr); return 2
    out = Path(a.out) if a.out else REPO / cfg.get("out", f"steps/terrain-{cfg.get('zone','adhoc')}"); (out / "data").mkdir(parents=True, exist_ok=True)
    m = auto_masks(key, mc, offline=a.offline or None)
    H, xs, rim = build(m, mc)
    gf, sf, hz = float(m["ground"].mean()), float(m["sky"].mean()), m["horizon"]
    spine = H[np.abs(xs) < 150][:, np.abs(xs) < 10]; slope = float(np.abs(np.diff(spine, axis=0)).max() / (xs[1] - xs[0]))
    C = {"groundFrac": dict(value=round(gf, 3), limit=G["groundFracMin"], pass_=gf >= G["groundFracMin"]),
         "skyFrac": dict(value=round(sf, 3), limit=G["skyFracMin"], pass_=sf >= G["skyFracMin"]),
         "horizonRow": dict(value=round(hz, 3), limit=G["horizon"], pass_=G["horizon"][0] <= hz <= G["horizon"][1]),
         "finite": dict(value=bool(np.isfinite(H).all()), limit=True, pass_=bool(np.isfinite(H).all())),
         "rimMin_m": dict(value=round(float(rim.min()), 1), limit=G["rimMinM"], pass_=rim.min() >= G["rimMinM"]),
         "reliefRange_m": dict(value=round(float(H.max() - H.min()), 1), limit=20, pass_=H.max() - H.min() >= 20),
         "spineSlope": dict(value=round(slope, 3), limit=G["spineSlopeMax"], pass_=slope <= G["spineSlopeMax"])}
    C = {k: {"value": v["value"], "limit": v["limit"], "pass": bool(v["pass_"])} for k, v in C.items()}
    ok = all(c["pass"] for c in C.values())
    H.tofile(out / "data" / "height.bin")
    step = float(xs[1] - xs[0])
    (out / "data" / "height.json").write_text(json.dumps({"origin": [float(xs[0]), float(xs[0])], "step": step, "nx": len(xs), "nz": len(xs),
        "hLo": float(np.percentile(H, 8)), "hHi": float(np.percentile(H, 92)), "outline": m["method"], "horizonRow": hz,
        "camera": {"eye": mc.get("eyeM", 2.6), "fov": mc.get("fovDeg", 48), "yaw": cfg.get("avenueHeadingDeg", 0.0)}}, indent=1))
    rgb = m["rgb"].astype(np.float32); ov = rgb.copy()
    ov[m["ground"]] = ov[m["ground"]] * 0.5 + np.array([0, 200, 0]) * 0.5; ov[m["sky"]] = ov[m["sky"]] * 0.5 + np.array([0, 80, 255]) * 0.5
    ov[m["relief"]] = ov[m["relief"]] * 0.6 + np.array([255, 60, 0]) * 0.4
    im = Image.fromarray(ov.clip(0, 255).astype(np.uint8)); im.thumbnail((640, 640)); im.save(out / "masks.jpg", quality=85)
    (out / "gates.json").write_text(json.dumps({"pass": ok, "method": m["method"], "checks": C}, indent=1))
    for k, c in C.items():
        if not c["pass"]: print(f"   FAIL {k}: {c['value']} (limit {c['limit']})")
    print(f"[terrain-from-key generic] {cfg.get('zone','adhoc')} masks={m['method']} ground={gf:.2f} sky={sf:.2f} horizon={hz:.2f} -> {'PASS' if ok else 'FAIL'} ({out})")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

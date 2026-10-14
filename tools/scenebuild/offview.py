#!/usr/bin/env python3
"""tools/scenebuild/offview.py - off-view judge (the GATE number: the key-camera score is optimistic because the key
image is projected from that camera). Renders 4 views away from the key camera WITHOUT the projected key texture
(geometry + vertex colour + matlib detail only): yaw -25, yaw +25, 25 deg high (v7: 45 deg looked straight down, not comparable to the key), grazing close-up (yaw 60, 0.45 x
pivot distance). Each view: judge.py colour + DINO terms vs the key (viewpoint-tolerant; SSIM is dropped), times
(1 - hole fraction) where holes = background seen through the geometry (magenta clear colour), excluding the sky
band above the horizon of the key view. off_score = mean over views.
usage: offview.py SHEET OUT PORT [--gain g]"""
import json, subprocess, sys
from pathlib import Path
import numpy as np, cv2
HERE = Path(__file__).resolve().parent; ROOT = HERE.parents[1]
VIEWS = ("yawL", "yawR", "high", "graze")


def offview(sheet, out, port, gain=1.0, views=VIEWS):
    out = Path(out); res = {}
    for v in views:
        png = out / f"off-{v}.png"
        subprocess.run([sys.executable, str(HERE / "shot.py"), f"http://127.0.0.1:{port}", str(png), "--q", f"gain={gain:.3f}&kw=0&bg=ff00ff&view={v}"], check=True, capture_output=True)
        im = cv2.imread(str(png)); hole = (im[..., 2] > 240) & (im[..., 0] > 240) & (im[..., 1] < 20)
        lower = hole.copy(); lower[: im.shape[0] // 3] = False          # top third may legitimately be sky
        hf = float(lower.mean() / (2 / 3)); im[hole] = (90, 60, 50); cv2.imwrite(str(png), im)
        j = json.loads(subprocess.run([sys.executable, str(ROOT / "tools/kit/judge.py"), str(png), str(Path(sheet) / "key1024.png"), str(out / "fullmask.png")], capture_output=True, text=True).stdout)
        sc = 0.5 * j["scores"]["colour"] + 0.5 * j["scores"]["perceptual"]
        res[v] = {"score": round(sc * (1 - hf), 1), "colour": j["scores"]["colour"], "dino": j["scores"]["perceptual"], "hole_frac": round(hf, 4), "png": str(png)}
    return {"off_score": round(float(np.mean([r["score"] for r in res.values()])), 1),
            "off_dino": round(float(np.mean([r["dino"] for r in res.values()])), 1), "views": res}


if __name__ == "__main__":
    g = float(sys.argv[sys.argv.index("--gain") + 1]) if "--gain" in sys.argv else 1.0
    print(json.dumps(offview(sys.argv[1], sys.argv[2], sys.argv[3], g)))

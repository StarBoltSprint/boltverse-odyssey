#!/usr/bin/env python3
"""build -> render -> judge (judge.py on the full frame) + auto_check (no scope, no DINO). usage: score.py SHEET OUT PORT [--opt f]"""
import json, subprocess, sys, time
from pathlib import Path
import numpy as np, cv2
HERE = Path(__file__).resolve().parent; ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE)); sys.path.insert(0, str(ROOT / "tools/keysheet"))
import build as B  # noqa: E402
import auto_check as AC  # noqa: E402
import regular as RG  # noqa: E402


def score(sheet, out, port, opt=None, tag="x", gain=None):
    t0 = time.time(); out = Path(out); info = B.build(sheet, out, opt)
    png = out / f"render-{tag}.png"
    shot = lambda q: subprocess.run([sys.executable, str(HERE / "shot.py"), f"http://127.0.0.1:{port}", str(png), "--q", q], check=True, capture_output=True)
    if gain is None:
        shot("")   # auto exposure: one probe render, then scale lights so the render's mean luminance matches the key's
        key = cv2.imread(str(Path(sheet) / "key1024.png")); ren = cv2.imread(str(png))
        lum = lambda im: float(((cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255) ** 2.2).mean())
        gain = float(np.clip(lum(key) / max(lum(ren), 1e-4), 0.5, 6.0))
    info["exposure_gain"] = round(gain, 3)
    shot(f"gain={gain:.3f}")
    fm = out / "fullmask.png"
    if not fm.exists():
        cv2.imwrite(str(fm), np.full((1024, 1024), 255, np.uint8))
    j = json.loads(subprocess.run([sys.executable, str(ROOT / "tools/kit/judge.py"), str(png), str(Path(sheet) / "key1024.png"), str(fm)], capture_output=True, text=True).stdout)
    rep, _, _ = AC.check(png, sheet, None, dino=False)
    reg = RG.check(png, sheet)
    rows = {r["id"]: r["value"] + 0.01 * float(np.mean(list(r["sub"].values()))) for lv in ("L1", "L2") for r in rep["levels"][lv]["rows"]}
    rows_full = {r["id"]: r for lv in ("L1", "L2") for r in rep["levels"][lv]["rows"]}; info["rows_full"] = rows_full
    return {"judge": j["total"], "scores": j["scores"], "L1_min": rep["levels"]["L1"]["min"], "L1_median": rep["levels"]["L1"]["median"], "L1_pass": rep["levels"]["L1"]["pass_frac"], "L2_pass": rep["levels"]["L2"]["pass_frac"],
            "L2_median": rep["levels"]["L2"]["median"], "gain": info["exposure_gain"], "too_regular": reg["too_regular"], "regular": reg["render"], "draws": info["draws"], "tris": info["tris"], "types": info["types"], "png": str(png),
            "sec": round(time.time() - t0, 1)}, rows, info


if __name__ == "__main__":
    o = json.loads(Path(sys.argv[sys.argv.index("--opt") + 1]).read_text()) if "--opt" in sys.argv else None
    s, _, _ = score(sys.argv[1], sys.argv[2], sys.argv[3], o, "cli"); print(json.dumps(s))

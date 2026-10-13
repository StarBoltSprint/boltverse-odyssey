#!/usr/bin/env python3
"""Must-fail fixtures for the AUTO sheet, generated at test time from the cached key (no fixture JPGs in git).
usage: python3 tools/keysheet/selftest_auto.py SHEET_DIR [--no-dino]
control: the key itself must PASS every level. Each fixture edits one element type and must FAIL in that place."""
import json, sys, tempfile
from pathlib import Path
import numpy as np, cv2
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import auto_check as AC  # noqa: E402


def fixtures(K, sh, sd):
    M2 = AC.l2masks(sd); els = [e for e in sh["elements"] if e["level"] == 2]
    pick = lambda f: np.any([m for e, m in zip(els, M2) if f(e)], axis=0) if any(f(e) for e in els) else np.zeros(K.shape[:2], bool)
    out = {}
    # 1 facade snow removed (inpaint every small snow patch on stone)
    fm = pick(lambda e: e["src"] == "tophat").astype(np.uint8) * 255
    out["no_facade_snow"] = (cv2.inpaint(K, cv2.dilate(fm, np.ones((5, 5), np.uint8)), 5, cv2.INPAINT_TELEA), "facade_snow")
    # 2 drips removed (icicles)
    dm = pick(lambda e: e["src"] == "drip").astype(np.uint8) * 255
    out["no_icicles"] = (cv2.inpaint(K, cv2.dilate(dm, np.ones((5, 5), np.uint8)), 5, cv2.INPAINT_TELEA), "drips")
    # 3 too-clean snow: every big snow element replaced by its flat-colour bounding box (straight, smooth, no lumps)
    F = K.copy()
    for e, m in zip(els, M2):
        if e["class"] == "snow" and e["area_frac"] > 0.0008:
            x0, y0, x1, y1 = e["bbox_px"]; F[y0:y1 + 1, x0:x1 + 1] = K[m].mean(0)
    out["clean_snow_boxes"] = (F, "L2")
    # 4 wrong big form colour (stone forms shifted warm/dark) -> L1
    C = K.astype(np.float32); C[..., 2] *= 1.25; C[..., 0] *= 0.6
    out["warm_dark_forms"] = (np.clip(C, 0, 255).astype(np.uint8), "L1")
    # 5 flattened texture (heavy blur everywhere) -> L2 edges / L3 tile stats
    out["blurred_texture"] = (cv2.GaussianBlur(K, (0, 0), 4), "any")
    return out


def failed(rep, where):
    if where in ("facade_snow", "drips"):
        return rep[where]["n"] > 0 and rep[where]["min"] is not None and rep[where]["min"] < AC.BLOCK
    if where == "any":
        return rep["verdict"] == "FAIL"
    return rep["levels"][where]["min"] < AC.BLOCK


def main():
    sd = Path(sys.argv[1]); dino = "--no-dino" not in sys.argv
    sh = json.loads((sd / "sheet.json").read_text()); K = cv2.imread(str(sd / "key1024.png"))
    res, ok = [], True
    with tempfile.TemporaryDirectory() as td:
        p = Path(td) / "key.png"; cv2.imwrite(str(p), K)
        r, _, _ = AC.check(p, sd, None, False)
        good = r["verdict"] == "PASS"; ok &= good
        res.append({"name": "control_key", "expect": "PASS", "got": r["verdict"], "ok": good})
        for name, (img, where) in fixtures(K, sh, sd).items():
            p = Path(td) / f"{name}.png"; cv2.imwrite(str(p), img)
            r, _, _ = AC.check(p, sd, None, False)
            f = failed(r, where); ok &= f
            res.append({"name": name, "expect": f"FAIL@{where}", "got": r["verdict"], "levels": {k: v["min"] for k, v in r["levels"].items()},
                        "facade_snow_min": r["facade_snow"]["min"], "drips_min": r["drips"]["min"], "ok": f})
    print(json.dumps({"pass": bool(ok), "rows": res}, indent=1)); return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

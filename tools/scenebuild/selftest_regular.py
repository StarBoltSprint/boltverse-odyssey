#!/usr/bin/env python3
"""must-fail check for regular.py: the key passes, the generated regular_blocks fixture (selftest_auto) must be
flagged too_regular. usage: selftest_regular.py SHEETDIR"""
import json, sys, tempfile
from pathlib import Path
import cv2
HERE = Path(__file__).resolve().parent; sys.path.insert(0, str(HERE)); sys.path.insert(0, str(HERE.parent / "keysheet"))
import regular as RG  # noqa: E402
import selftest_auto as SA  # noqa: E402
sd = Path(sys.argv[1]); sh = json.loads((sd / "sheet.json").read_text()); K = cv2.imread(str(sd / "key1024.png"))
with tempfile.TemporaryDirectory() as td:
    kp = Path(td) / "k.png"; cv2.imwrite(str(kp), K); rk = RG.check(kp, sd)
    fp = Path(td) / "f.png"; cv2.imwrite(str(fp), SA.fixtures(K, sh, sd)["regular_blocks"][0]); rf = RG.check(fp, sd)
print("control", rk["ok"], rk["too_regular"]); print("regular_blocks", not rf["ok"], rf["too_regular"], rf["render"])
sys.exit(0 if rk["ok"] and not rf["ok"] else 1)

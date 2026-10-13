#!/usr/bin/env python3
"""Per-element must-fail fixtures: the key with ONE element made 'too clean' (flat mean colour, straight
edges: the element's mask bbox filled with its blurred mean and a ruler-straight boundary). Each must FAIL that
element's zoom row (and the key itself must PASS). Written at 512 px / JPEG q70 to keep patches small.
usage: mkfixtures.py SHEET_DIR/sheet.json KEY.jpg OUTDIR"""
import json, sys
from pathlib import Path
import cv2, numpy as np
sp, key, out = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3]); out.mkdir(parents=True, exist_ok=True)
sh = json.loads(sp.read_text()); W = sh["frame_px"]
K = cv2.resize(cv2.imread(key), (W, W))
reg = []
for e in sh["elements"]:
    M = cv2.imread(str(sp.parent / e["mask"]), 0) > 127
    ys, xs = np.nonzero(M); x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    F = K.copy()
    sub = F[y0:y1, x0:x1]
    flat = cv2.blur(sub, (61, 61))
    mean = sub.reshape(-1, 3).mean(0)
    flat = (0.5 * flat + 0.5 * mean).astype(np.uint8)
    F[y0:y1, x0:x1] = np.where(M[y0:y1, x0:x1, None], flat, sub)
    fn = out / f"clean-{e['id']}.jpg"
    cv2.imwrite(str(fn), cv2.resize(F, (512, 512), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 70])
    reg.append({"id": f"clean-{e['id']}", "element": e["id"], "artifact": fn.name, "expect": "FAIL"})
(out / "registry.json").write_text(json.dumps(reg, indent=1))
print(len(reg))

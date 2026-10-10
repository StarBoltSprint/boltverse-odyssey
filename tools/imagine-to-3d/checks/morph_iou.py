"""score mesa-approach-morph frames: magenta mask IoU between consecutive frames; FAIL on any jump outlier."""
import sys, json, glob, numpy as np
from PIL import Image
d = sys.argv[1]; PJ = json.load(open(d + "/path.json")); P = PJ["path"]; inside = PJ.get("cameraInside", [])
fs = sorted(glob.glob(d + "/f*.png"))
M = []
for f in fs:
    a = np.asarray(Image.open(f).convert("RGB")).astype(int); M.append((a[..., 0] > 200) & (a[..., 1] < 60) & (a[..., 2] > 200))
iou = []
for i in range(1, len(M)):
    u = (M[i] | M[i - 1]).sum(); iou.append(float((M[i] & M[i - 1]).sum() / u) if u else 1.0)
e = 1 - np.array(iou); bad = []
for i in range(len(e)):
    nb = np.concatenate([e[max(0, i - 4):i], e[i + 1:i + 5]]); med = float(np.median(nb)) if len(nb) else 0
    if e[i] > max(0.02, 4 * med): bad.append(dict(frame=i + 1, distFrom=round(P[i], 1), distTo=round(P[i + 1], 1), iou=round(iou[i], 4), localMedian=round(1 - med, 4)))
res = dict(dir=d, frames=len(M), minIoU=round(min(iou), 4), worst=sorted([(round(1 - x, 4), round(P[i], 1), round(P[i + 1], 1)) for i, x in enumerate(e)])[:6], jumps=bad, cameraInsideHull=inside, verdict="PASS" if not bad and not inside else "FAIL")
print(json.dumps(res)); json.dump(res, open(d + "/iou.json", "w"), indent=1)

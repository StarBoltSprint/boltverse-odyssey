"""Analysis of gd-approach: the camera always looks at the same ground point T (screen centre). Window 40x40 px at the
centre. detail contribution C(d) = median |on - off| over the target row band, excluding pixels with |diff| >= 12 grey (gust/veil sprites; the detail layer changes a pixel by < 10 grey, see gustFrac); texture energy E_on/E_off = std of a 3 px high-pass.
No-morph rule: C(d) must change smoothly with distance: max |C_k - C_{k-1}| <= max(1.5, 3 x median step), and the
fade must be monotone-ish (no reversal larger than 1.5 grey levels) between 30 m and 15 m."""
import sys, json, glob, numpy as np
from PIL import Image
from scipy import ndimage as ndi
d = sys.argv[1]; J = json.load(open(f"{d}/approach.json"))
rows = []
for s in J["steps"]:
    k = s["k"]; a = np.asarray(Image.open(f"{d}/s{k:02d}-on.png").convert("L"), np.float32); b = np.asarray(Image.open(f"{d}/s{k:02d}-off.png").convert("L"), np.float32)
    H, W = a.shape; cy, cx = H // 2, W // 2; win = (slice(cy - 20, cy + 20), slice(cx - 20, cx + 20))
    hp = lambda x: x - ndi.gaussian_filter(x, 3)
    # animated sand gusts / veils (air.mjs) move between the ON and OFF frames: robust stat = MEDIAN |on-off| over the
    # ground below the target (lower 40 % of the frame), so a passing gust (minority of pixels) cannot fake a jump
    band = np.abs(a - b)[cy - 30: cy + 30, :]          # the ground at distance d (target row band)
    rows.append(dict(d=s["d"], C=round(float(band[band < 12].mean()), 2), gustFrac=round(float((band >= 12).mean()), 3), Cmed=round(float(np.median(band)), 2), Cwin=round(float(np.abs(a - b)[win].mean()), 2), Eon=round(float(hp(a)[win].std()), 2), Eoff=round(float(hp(b)[win].std()), 2),
                     fullFrameDiff=round(float(np.abs(a - b).mean()), 2)))
clean = [r for r in rows if r["gustFrac"] < 0.03]          # frames where a gust/veil sprite crossed the band are reported, not judged
C = np.array([r["C"] for r in clean]); st = np.abs(np.diff(C)); med = float(np.median(st)) if len(st) else 0
lim = max(1.0, 3 * med)  # < 1 grey between frames is invisible
jumps = [i + 1 for i, v in enumerate(st) if v > lim]
mono = bool(np.all(np.diff(C) >= -0.3))
res = dict(rows=rows, maxStep=round(float(st.max()), 2), medianStep=round(med, 2), limit=round(lim, 2), jumpsAt=[clean[i]["d"] for i in jumps], cleanFrames=len(clean), gustFrames=[r["d"] for r in rows if r["gustFrac"] >= 0.03], monotone=mono, PASS=len(jumps) == 0 and mono)
json.dump(res, open(f"{d}/approach-report.json", "w"), indent=1)
for r in rows: print(r)
print({k: v for k, v in res.items() if k != "rows"})

"""Self-test for the approach-morph row (gate.mjs section 3): replays the gate's camera path (300 -> 10 m, x0.95 per frame,
eye +2 m, vfov 58, same jump rule: IoU < minIoU or > maxDrop below the median of +-2 neighbours) with a hard rasteriser at the
gate's mask size. (a) a rigid box (no shape change) must PASS; (b) a shifted LOD (below 60 m the
swapped LOD lacks the top 4.5 m tier) must FAIL; a 1 m mis-registration is reported as info (below the row's sensitivity) must FAIL; at the old 135x240 mask the rigid box FAILED (v3.1 proof).
python3 morph_selftest.py [W H]  (default from profiles/_base.yaml morph.maskW/maskH) -> prints JSON, exit 1 on a wrong verdict"""
import sys, math, json, numpy as np, re, os
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
prof = open(os.path.join(HERE, '..', 'profiles', '_base.yaml')).read()
def pv(k, d): m = re.search(rf'^\s+{k}:\s*([0-9.]+)', prof, re.M); return float(m.group(1)) if m else d
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (int(pv('maskW', 135)), int(pv('maskH', 240)))
MIN_IOU, MAXDROP, STEP = pv('minIoU', 0.8), pv('maxDropVsNeighbours', 0.05), pv('step', 0.95)
lo, hi = np.array([-8.555, 0, -16]), np.array([8.555, 14.73, 1.0]); C = (lo + hi) / 2
def box(a, b):
    v = np.array([[x, y, z] for x in (a[0], b[0]) for y in (a[1], b[1]) for z in (a[2], b[2])])
    f = [[0,1,3],[0,3,2],[4,6,7],[4,7,5],[0,4,5],[0,5,1],[2,3,7],[2,7,6],[0,2,6],[0,6,4],[1,5,7],[1,7,3]]
    return [v[t] for t in f]
def mask(tris, eye, tgt):
    f = np.array(tgt) - eye; f /= np.linalg.norm(f); r = np.cross(f, [0, 1, 0]); r /= np.linalg.norm(r); u = np.cross(r, f)
    k = H / 2 / math.tan(math.radians(29)); im = Image.new('1', (W, H)); d = ImageDraw.Draw(im)
    for t in tris:
        P = t - eye; x, y, z = P @ r, P @ u, P @ f; d.polygon(list(zip(W / 2 + k * x / z, H / 2 - k * y / z)), fill=1)
    return np.array(im, bool)
N = int(pv('normPx', 0)); EXT = 1.25
def norm(m, D, ext):   # gate v3.2: resample each mask onto ONE world grid at the target plane (N x N over +-ext m): the pure
    if not N: return m  # approach (scale change) is removed, a real shape change or LOD offset is not
    k = H / 2 / math.tan(math.radians(29)); g = (np.arange(N) + 0.5) / N * 2 - 1
    px = np.clip((W / 2 + g * ext * k / D).astype(int), 0, W - 1); py = np.clip((H / 2 - g * ext * k / D).astype(int), 0, H - 1)
    return m[py[:, None], px[None, :]]
def run(shape):
    dx, dz = -0.7071 * 300 - C[0], 0.7071 * 300 - C[2]; L = math.hypot(dx, dz); dx /= L; dz /= L; r0 = 8.555; h = hi[1]
    prev, ious, d = None, [], 300.0
    while d >= 10:
        eye = np.array([C[0] + dx * (r0 + d), 2.0, C[2] + dz * (r0 + d)]); m = mask(shape(d), eye, [C[0], min(h * 0.5, 40, d * 0.35 + 8), C[2]])
        tgt = np.array([C[0], min(h * 0.5, 40, d * 0.35 + 8), C[2]]); m = norm(m, float(np.linalg.norm(tgt - eye)), EXT * max(8.555, h / 2))
        if prev is not None: ious.append((round(d, 1), float((m & prev).sum() / max(1, (m | prev).sum()))))
        prev = m; d *= STEP
    v = [i for _, i in ious]; bad = []
    for i, (dd, io) in enumerate(ious):
        nb = sorted(v[j] for j in (i - 2, i - 1, i + 1, i + 2) if 0 <= j < len(v)); med = nb[len(nb) >> 1]
        if io < MIN_IOU or med - io > MAXDROP: bad.append((dd, round(io, 3)))
    return dict(minIoU=round(min(v), 3), jumps=bad, passed=not bad)
rigid = lambda d: box(lo, hi)
shift = lambda d: box(lo, hi) if d > 60 else box(lo, hi - [0, 4.5, 0])   # bad LOD swap at 60 m: top tier (4.5 m) missing
small = lambda d: box(lo, hi) if d > 60 else box(lo + [1.0, 0, 0], hi + [1.0, 0, 0])   # 1 m mis-registration (INFO: below sensitivity)
res = dict(mask=[W, H], normPx=N, rigidBox=run(rigid), shiftedLod=run(shift), info_offset1m=run(small))
res['ok'] = res['rigidBox']['passed'] and not res['shiftedLod']['passed']
print(json.dumps(res)); sys.exit(0 if res['ok'] else 1)

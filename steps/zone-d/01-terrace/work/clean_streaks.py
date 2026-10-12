"""v3.4.1: clean painted icicle streaks that get NO cone out of the plates, from surrounding REAL basalt pixels.
Ghosts = the builder's list (gate detector run on the ORIGINAL plates, work/terrace-lod0-ghosts.json), then whatever the gate's own
detector still flags on the cleaned plates. Per ghost: footprint = the streak's own bright pixels in its box (dilated 2 px; follows
the icicle outline, never a rectangle). Donor = the darkest same-size window of the same rows within +-80 px (real basalt, shifted
sideways; no mirroring). Small footprints are Poisson-blended (cv2.seamlessClone NORMAL_CLONE: donor gradients, boundary level
from the surrounding pixels); footprints fused into a bright snow mass (Poisson would keep the snow level) are pasted with a 1.5 px
gaussian-feathered footprint edge. Nothing new is painted. Report: work/clean-report.json."""
import json, sys, numpy as np, cv2; from PIL import Image
sys.path.insert(0, '../../../tools/object-gate/py'); import ghost_streaks as GS
SRC = {'plate-front': 'plates/plate-front.jpg', 't1-right': 'plates/v32/t1-right-v33.jpg', 'plate-side': 'plates/plate-side.jpg'}
OUT = {'plate-front': 'plates/v34/plate-front-v34.jpg', 't1-right': 'plates/v34/t1-right-v34.jpg', 'plate-side': 'plates/v34/plate-side-v34.jpg'}
A = {p: np.asarray(Image.open(SRC[p]).convert('RGB')).astype(np.float32) for p in SRC}
bands = json.load(open('work/terrace-lod0-bands.json')); ici = json.load(open('work/terrace-lod0-icicles.json'))
LOG = []
def clean(p, c0, c1, r0, r1, it):
    a = A[p]; Lm = a.mean(2); c0, c1 = max(1, c0 - 2), min(1022, c1 + 2); ra, rb = max(1, r0 - 2), min(1022, r1 + 4); w = c1 - c0 + 1
    cands = [(Lm[ra:rb, c0 + o:c1 + o + 1].mean() + 0.02 * abs(o), o) for o in range(-80, 81, 4) if abs(o) >= w + 4 and c0 + o >= 0 and c1 + o < 1024]
    if not cands: return
    _, off = min(cands)
    ref = np.percentile(Lm[ra:rb, max(0, c0 - 40):min(1024, c1 + 40)], 30) + 40
    m = np.zeros(Lm.shape, np.uint8); m[ra:rb, c0:c1 + 1] = (Lm[ra:rb, c0:c1 + 1] > ref - 10) * 255
    if it >= 8: m[ra:rb, c0:c1 + 1] = 255   # last resort for tiny stubs (<= a few px): the whole small box
    m = cv2.dilate(m, np.ones((5, 5), np.uint8))
    if not m.any(): return
    src = np.roll(a, -off, axis=1)
    ys, xs = np.nonzero(m); y0, y1, x0, x1 = max(1, ys.min()), min(1022, ys.max()), max(1, xs.min()), min(1022, xs.max())
    ring = cv2.dilate(m, np.ones((5, 5), np.uint8)) > m
    fused = Lm[ring].mean() > ref   # boundary itself is bright snow -> Poisson would keep it bright
    if not fused and it < 3:
        dst = np.clip(a, 0, 255).astype(np.uint8)[..., ::-1].copy(); s8 = np.clip(src, 0, 255).astype(np.uint8)[..., ::-1]
        out = cv2.seamlessClone(s8[y0:y1 + 1, x0:x1 + 1].copy(), dst, m[y0:y1 + 1, x0:x1 + 1].copy(), ((x0 + x1 + 1) // 2, (y0 + y1 + 1) // 2), cv2.NORMAL_CLONE)
        A[p] = out[..., ::-1].astype(np.float32); how = 'poisson'
    else:
        if fused and w > 10:   # v3.4.2: wide fused curtain (tier-3 corner): donor = nearby REAL frost-covered basalt whose level matches
            # the wall just below the footprint (keeps the frost texture, not plain dark basalt); 6 px feather against the snow bulge
            tgt = Lm[min(1023, rb + 2):min(1024, rb + 30), c0:c1 + 1].mean()
            ok_ = [(abs(Lm[ra:rb, c0 + o:c1 + o + 1].mean() - tgt), o) for o in range(-80, 81, 4) if abs(o) >= w + 4 and c0 + o >= 0 and c1 + o < 1024 and Lm[ra:rb, c0 + o:c1 + o + 1].mean() < ref - 15]
            if ok_: off = min(ok_)[1]; src = np.roll(a, -off, axis=1)
            wg = cv2.GaussianBlur((m > 0).astype(np.float32), (0, 0), 6.0)[..., None]; wg = np.maximum(wg, (m > 0)[..., None] * 0.85)
            A[p] = src * wg + a * (1 - wg); LOG.append(dict(plate=p, pass_=it, footprintPx=int((m > 0).sum()), bbox=[int(x0), int(y0), int(x1), int(y1)], donorDx=int(off), method='frost-matched feather 6px')); return
        wg = cv2.GaussianBlur((m > 0).astype(np.float32), (0, 0), (3.0 if w > 10 else 1.0) if it < 8 else 0.5)[..., None]; A[p] = src * wg + a * (1 - wg); how = 'footprint-feather'
    LOG.append(dict(plate=p, pass_=it, footprintPx=int((m > 0).sum()), bbox=[int(x0), int(y0), int(x1), int(y1)], donorDx=int(off), method=how))
for g in [g for g in json.load(open('work/terrace-lod0-ghosts.json')) if 'c0' in g]:
    clean(g['plate'], g['c0'], g['c1'], g['r0'], g['r1'], 0)
res = {}
for it in range(1, 13):
    tm = {}
    for p in OUT: Image.fromarray(np.clip(A[p], 0, 255).astype(np.uint8)).save(OUT[p], quality=95); tm[p] = OUT[p]
    r = GS.run(bands, ici, tm); res['pass%d' % it] = r['ghosts']
    if not r['ghosts']: break
    for g in r['list']: clean(g['plate'], g['c0'], g['c1'], g['r0'], g['r1'], it)
json.dump(dict(passes=res, fills=LOG), open('work/clean-report.json', 'w'), indent=1)
print(json.dumps(dict(passes=res, fills=len(LOG), poisson=sum(l['method'] == 'poisson' for l in LOG), feather=sum(l['method'] != 'poisson' for l in LOG))))

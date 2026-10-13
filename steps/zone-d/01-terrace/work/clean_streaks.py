"""v3.4.1: clean painted icicle streaks that get NO cone out of the plates, from surrounding REAL basalt pixels.
Ghosts = the builder's list (gate detector run on the ORIGINAL plates, work/terrace-lod0-ghosts.json), then whatever the gate's own
detector still flags on the cleaned plates. Per ghost: footprint = the streak's own bright pixels in its box (dilated 2 px; follows
the icicle outline, never a rectangle). Donor = the darkest same-size window of the same rows within +-80 px (real basalt, shifted
sideways; no mirroring). Small footprints are Poisson-blended (cv2.seamlessClone NORMAL_CLONE: donor gradients, boundary level
from the surrounding pixels); footprints fused into a bright snow mass (Poisson would keep the snow level) are pasted with a 1.5 px
gaussian-feathered footprint edge. Nothing new is painted. Report: work/clean-report.json."""
import json, os, sys, numpy as np, cv2; from PIL import Image
from scipy import ndimage as ndi
sys.path.insert(0, '../../../tools/object-gate/py'); import ghost_streaks as GS
SRC = {'plate-front': 'plates/plate-front.jpg', 't1-right': 'plates/v32/t1-right-v33.jpg', 'plate-side': 'plates/plate-side.jpg'}
OUT = {'plate-front': 'plates/v35/plate-front-v35.jpg', 't1-right': 'plates/v35/t1-right-v35.jpg', 'plate-side': 'plates/v35/plate-side-v35.jpg'}
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
        # v3.5: no 6 px frost feather (that left a visible edge at the tier-3 corner). Shift the donor
        # to the ring's own level and feather 1.2 px so the fill meets the basalt without a pale halo.
        ringL = Lm[ring] if ring.any() else Lm[ra:rb, c0:c1 + 1]
        srcL = src[..., 0] * 0 + src.mean(2)
        shift = float(np.median(ringL) - np.median(srcL[m > 0])) if (m > 0).any() else 0.0
        src = np.clip(src + shift, 0, 255)
        wg = cv2.GaussianBlur((m > 0).astype(np.float32), (0, 0), 1.2)[..., None]
        A[p] = src * wg + a * (1 - wg); how = 'level-matched feather 1.2px'
    LOG.append(dict(plate=p, pass_=it, footprintPx=int((m > 0).sum()), bbox=[int(x0), int(y0), int(x1), int(y1)], donorDx=int(off), method=how))
def force_dark(p, c0, c1, r0, r1, it):
    """Leftover streak pixels only: paste a darker neighbour onto the bright run, not the whole box."""
    a = A[p]; Lm = a.mean(2)
    c0, c1 = max(2, int(c0) - 2), min(1021, int(c1) + 2); ra, rb = max(2, int(r0) - 1), min(1021, int(r1) + 2)
    w = c1 - c0 + 1
    cands = [(Lm[ra:rb, c0 + o:c1 + o + 1].mean(), o) for o in range(-120, 121, 3) if abs(o) >= w + 6 and 0 <= c0 + o and c1 + o < 1024]
    if not cands: return
    dark = [c for c in cands if c[0] < np.percentile([q[0] for q in cands], 30)]
    _, off = min(dark or cands)
    src = np.roll(a, -off, axis=1)
    ref = np.percentile(Lm[ra:rb, :], 30, axis=1)[:, None]
    bright = (Lm[ra:rb, c0:c1 + 1] > 80) & (Lm[ra:rb, c0:c1 + 1] > ref + 25)
    m = np.zeros(Lm.shape, np.uint8); m[ra:rb, c0:c1 + 1] = bright.astype(np.uint8) * 255
    m = cv2.dilate(m, np.ones((3, 3), np.uint8))
    if not m.any(): return
    wg = cv2.GaussianBlur((m > 0).astype(np.float32), (0, 0), 1.0)[..., None]
    A[p] = src * wg + a * (1 - wg)
    LOG.append(dict(plate=p, pass_=it, footprintPx=int((m > 0).sum()), bbox=[c0, ra, c1, rb], donorDx=int(off), method='dark-neighbour'))
def fill_basalt(p, c0, c1, r0, r1, it):
    """Replace streak-bright pixels with a mid-tone basalt neighbour. Not the darkest crack."""
    a = A[p]; Lm = a.mean(2)
    c0, c1 = max(2, int(c0) - 1), min(1021, int(c1) + 1)
    ra, rb = max(2, int(r0) - 1), min(1021, int(r1) + 2)
    if rb <= ra or c1 < c0: return
    ref = np.percentile(Lm[ra:rb, :], 30, axis=1)[:, None]
    box = Lm[ra:rb, c0:c1 + 1]
    bright = (box > 75) & (box > ref + 18)
    m = np.zeros(Lm.shape, np.uint8)
    m[ra:rb, c0:c1 + 1] = bright.astype(np.uint8) * 255
    m = cv2.dilate(m, np.ones((3, 3), np.uint8))
    if not m.any(): return
    w = c1 - c0 + 1
    cands = []
    for o in range(-100, 101, 2):
        if abs(o) < w + 4: continue
        x0, x1 = c0 + o, c1 + o
        if x0 < 1 or x1 >= 1023: continue
        cands.append((float(Lm[ra:rb, x0:x1 + 1].mean()), o))
    if not cands: return
    band = [c for c in cands if 42 <= c[0] <= 96]
    pool = band or cands
    target = float(np.median([c[0] for c in pool]))
    _, off = min(pool, key=lambda c: (abs(c[0] - target), abs(c[1])))
    src = np.roll(a, -off, axis=1)
    srcL = src.mean(2)
    src = np.clip(src + np.clip(target - srcL, 0, 28)[..., None], 0, 255)
    wg = cv2.GaussianBlur((m > 0).astype(np.float32), (0, 0), 0.9)[..., None]
    A[p] = src * wg + a * (1 - wg)
    LOG.append(dict(plate=p, pass_=it, footprintPx=int((m > 0).sum()), bbox=[c0, ra, c1, rb], donorDx=int(off), method='basalt-neighbour'))
def cut_drips():
    """Cut the hanging part of every bright column. The short runs are the snow cap (p20).
    Anything longer is a painted icicle, including groups wider than the 1.5 m detector cap.
    The cap stays. The tail is replaced by a short-run neighbour column. Cones keep the original plate."""
    for b in bands:
        img = A[b['plate']]; Lm = img.mean(2)
        br, top, c_lo = GS.bright_mask(Lm, b)
        if br.size == 0: continue
        h, w = img.shape[:2]
        run = np.zeros(br.shape[1]); st = np.zeros(br.shape[1], int)
        for j in range(br.shape[1]):
            col = np.r_[False, br[:, j], False].astype(int); d = np.diff(col)
            s, e = np.flatnonzero(d == 1), np.flatnonzero(d == -1)
            if len(s):
                k = int(np.argmax(e - s)); run[j] = e[k] - s[k]; st[j] = s[k]
        pos = run[run > 2]
        if len(pos) < 8: continue
        cap = float(np.percentile(pos, 20)) + 4
        shorts = np.flatnonzero((run > 0) & (run <= cap))
        longs = np.flatnonzero(run > cap + 8)
        long_cols = set(int(c_lo + int(j)) for j in longs)
        ncut = 0
        touched = np.zeros(Lm.shape, np.uint8)
        for j in longs:
            y0 = int(top + st[j] + cap)
            y1 = int(min(h - 1, top + st[j] + run[j] + 2))
            if y1 - y0 < 4: continue
            col = int(c_lo + j)
            if col < 1 or col >= w - 1: continue
            span = y1 - y0
            # Continue this column's own wall, the stone just under the tip, up through the drip.
            src = img[y1:min(h, y1 + span), col]
            if src.shape[0] < 6 or not (32 <= float(src.mean()) <= 115):
                if len(shorts) == 0: continue
                near = shorts[np.abs(shorts - j) <= 90]
                pool = near if len(near) else shorts
                sc = int(c_lo + int(pool[int(j) % len(pool)]))
                src = img[y0:y1, sc]
                if src.shape[0] < span: continue
            reps = int(np.ceil(span / src.shape[0]))
            patch = np.vstack([src] * reps)[:span]
            # Match the wall under the tip so the fill is not a paler streak.
            under = img[y1:min(h, y1 + 8), col]
            if under.size and 32 <= float(under.mean()) <= 115:
                patch = np.clip(patch + (float(under.mean()) - float(patch.mean())), 0, 255)
            blend = min(3, span)
            img[y0 + blend:y1, col] = patch[blend:]
            for k in range(blend):
                t = (k + 1) / (blend + 1)
                img[y0 + k, col] = img[y0 + k, col] * (1 - t) + patch[k] * t
            touched[y0:y1, col] = 1
            ncut += 1
        if touched.any():
            soft = cv2.GaussianBlur(img, (0, 0), 0.7)
            m = cv2.GaussianBlur(touched.astype(np.float32), (0, 0), 0.8)[..., None]
            A[b['plate']] = np.clip(soft * m + img * (1 - m), 0, 255)
            img = A[b['plate']]
        LOG.append(dict(plate=b['plate'], pass_=0, footprintPx=int(ncut), bbox=[int(b.get('tier', 0)), int(cap), int(len(longs)), 0], donorDx=0, method='drip-cut'))
        print('cut', b['plate'], 't', b['tier'], b['side'], 'cap', round(cap, 1), 'long', len(longs), 'cut', ncut)
os.makedirs('plates/v35', exist_ok=True)
cut_drips()
# v3.5: every detector streak is inpainted, including streaks that already have a cone.
# The cone keeps the original-plate ice colour on its own material. The wall plate does not.
res = {}
for it in range(1, 9):
    streaks = []
    for b in bands:
        L = A[b['plate']].mean(2)
        for st in GS.detect(L, b, abs(b['b'])): streaks.append((b['plate'], st))
    tm = {}
    for p in OUT: Image.fromarray(np.clip(A[p], 0, 255).astype(np.uint8)).save(OUT[p], quality=95); tm[p] = OUT[p]
    r = GS.run(bands, ici, tm)
    res['pass%d' % it] = dict(ghosts=r['ghosts'], streaks=len(streaks))
    if not r['ghosts'] and not streaks: break
    seen = set()
    jobs = [(g['plate'], g['c0'], g['c1'], g['r0'], g['r1']) for g in r['list'] if 'c0' in g]
    jobs += [(p, st['c0'], st['c1'], st['r0'], st['r1']) for p, st in streaks]
    if it == 1:
        for g in json.load(open('work/terrace-lod0-ghosts.json')):
            if 'c0' in g: jobs.append((g['plate'], g['c0'], g['c1'], g['r0'], g['r1']))
    for p, c0, c1, r0, r1 in jobs:
        key = (p, int(c0), int(c1), int(r0), int(r1))
        if key in seen: continue
        seen.add(key)
        fill_basalt(p, c0, c1, r0, r1, it)
json.dump(dict(passes=res, fills=LOG), open('work/clean-report.json', 'w'), indent=1)
print(json.dumps(dict(passes=res, fills=len(LOG), poisson=sum(l['method'] == 'poisson' for l in LOG), feather=sum(l['method'] != 'poisson' for l in LOG))))

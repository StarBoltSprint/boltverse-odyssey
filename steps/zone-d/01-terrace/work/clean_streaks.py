"""v3.4: clean painted icicle streaks that get NO cone out of the plates (inpaint from neighbouring basalt pixels).
Input work/terrace-lod0-ghosts.json: detector entries {plate, c0, c1, r0, r1} (gate detector run on the ORIGINAL plate by the builder).
Per ghost: box = cols c0-2..c1+2, rows r0-2..r1+3; only pixels brighter than their row's basalt neighbours (+18) just outside the box
are replaced by row-wise linear interpolation between those neighbour columns. Nothing new is painted."""
import json, numpy as np; from PIL import Image
G = [g for g in json.load(open('work/terrace-lod0-ghosts.json')) if 'c0' in g]
SRC = {'plate-front': 'plates/plate-front.jpg', 't1-right': 'plates/v32/t1-right-v33.jpg', 'plate-side': 'plates/plate-side.jpg'}
OUT = {'plate-front': 'plates/v34/plate-front-v34.jpg', 't1-right': 'plates/v34/t1-right-v34.jpg', 'plate-side': 'plates/v34/plate-side-v34.jpg'}
rep = {}
for p in SRC:
    a = np.asarray(Image.open(SRC[p]).convert('RGB')).astype(np.float32); n = 0
    for g in [g for g in G if g['plate'] == p]:
        c0, c1 = max(1, g['c0'] - 2), min(1022, g['c1'] + 2)
        for r in range(max(0, g['r0'] - 2), min(1024, g['r1'] + 4)):
            L, R = a[r, c0 - 1].copy(), a[r, c1 + 1].copy(); ref = max(L.mean(), R.mean()) + 18
            for c in range(c0, c1 + 1):
                if a[r, c].mean() > ref: t = (c - c0 + 1) / (c1 - c0 + 2); a[r, c] = L * (1 - t) + R * t; n += 1
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(OUT[p], quality=95); rep[p] = dict(ghosts=sum(g['plate'] == p for g in G), pixelsCleaned=n)
print(json.dumps(rep))
# pass 2..3: whatever the gate's own detector still flags on the cleaned plates (no cone within reach) is filled from the
# basalt columns 4 px outside its box (only pixels that are streak-bright by the gate's definition)
import sys, os; sys.path.insert(0, '../../../tools/object-gate/py'); import ghost_streaks as GS
bands = json.load(open('work/terrace-lod0-bands.json')); ici = json.load(open('work/terrace-lod0-icicles.json'))
for it in range(6):
    r = GS.run(bands, ici)
    if not r['ghosts']: break
    for p in OUT:
        gs = [g for g in r['list'] if g['plate'] == p]
        if not gs: continue
        a = np.asarray(Image.open(OUT[p]).convert('RGB')).astype(np.float32); Lm = a.mean(2)
        for g in gs:
            c0, c1 = max(5, g['c0'] - 2), min(1018, g['c1'] + 2)
            if it >= 3:   # stubborn (bright neighbours both sides): copy the darker neighbouring basalt patch, shifted sideways (real pixels)
                w = c1 - c0 + 1; ra, rb = max(0, g['r0'] - 2), min(1024, g['r1'] + 4); best = None
                for off in (-(w + 6), w + 6, -(2 * w + 10), 2 * w + 10):
                    if 0 <= c0 + off and c1 + off < 1024:
                        m = Lm[ra:rb, c0 + off:c1 + off + 1].mean(); best = (m, off) if best is None or m < best[0] else best
                if best: a[ra:rb, c0:c1 + 1] = a[ra:rb, c0 + best[1]:c1 + best[1] + 1]
                continue
            for rr in range(max(0, g['r0'] - 2), min(1024, g['r1'] + 4)):
                L, R = a[rr, c0 - 4].copy(), a[rr, c1 + 4].copy(); ref = min(L.mean(), R.mean()) + 6
                for c in range(c0, c1 + 1):
                    if Lm[rr, c] > ref: t = (c - c0 + 4) / (c1 - c0 + 8); a[rr, c] = L * (1 - t) + R * t
        Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(OUT[p], quality=95)
    rep['pass%d' % (it + 2)] = r['ghosts']
print(json.dumps(rep))

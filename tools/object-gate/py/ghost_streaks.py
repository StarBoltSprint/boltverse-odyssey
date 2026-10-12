"""Blocking gate: painted icicle streaks without geometry ("ghost icicles").
python3 ghost_streaks.py <bands.json> <icicles.json> [--tex plate=path ...] [--out j]
bands.json (written by the builder, one per visible drip band): {plate, tex, tier, side, row0, rows, c_lo, c_hi, a, b}
  coord = a + b * col  (x for front bands, z for side bands, in metres, same frame as icicles.json x / z).
Detector (independent of the builder's drip finder): on the texture the GLB actually uses, a pixel is "streak-bright" when it is
> 80 and > 40 above its row's 30th percentile (basalt level across the band); per column the longest vertical bright run anywhere
in the band (fringe drips and free-hanging painted ones) is its streak length; adjacent columns with run >= 0.15 m group into a streak (<= 1.5 m wide; wider = snow mass).
A streak >= 0.15 m long needs a cone of the same tier/side within max(0.2 m, half its width) of its centre. PASS iff no ghosts."""
import json, sys, numpy as np; from PIL import Image; from scipy import ndimage as ndi
def bright_mask(img, band):
    """Streak-bright pixels inside one drip band. Same rule detect() uses. Returns (mask, top_row, c_lo) in band-local rows."""
    r0, rows, c_lo, c_hi = band['row0'], band['rows'], band['c_lo'], band['c_hi']
    top = max(0, r0 - 6); sub = img[top:r0 + rows, c_lo:c_hi]
    ref = np.percentile(sub, 30, axis=1, keepdims=True)   # basalt level of each row across the whole band
    br = (sub > 80) & (sub > ref + 40); br = br | (np.roll(br, 1, 0) & np.roll(br, -1, 0))
    if band.get('mask'):   # only pixels on the object (SAM2 mask of that plate): sky / background is not texture on the model
        mk = np.asarray(Image.open(band['mask']).convert('L').resize((img.shape[1], img.shape[0]))) > 127
        br &= ndi.binary_erosion(mk, iterations=2)[max(0, r0 - 6):r0 + rows, c_lo:c_hi]
    return br, top, c_lo
def detect(img, band, mpp):
    br, top, c_lo = bright_mask(img, band)
    run = np.zeros(br.shape[1]); st = np.zeros(br.shape[1], int)
    for j in range(br.shape[1]):   # longest vertical bright run anywhere in the band (fringe drips AND free-hanging painted ones)
        col = np.r_[False, br[:, j], False].astype(int); d = np.diff(col); s_, e_ = np.flatnonzero(d == 1), np.flatnonzero(d == -1)
        if len(s_): k = np.argmax(e_ - s_); run[j] = e_[k] - s_[k]; st[j] = s_[k]
    minpx = 0.15 / mpp; lab, n = ndi.label(run >= minpx); out = []
    for i in range(1, n + 1):
        js = np.flatnonzero(lab == i); jc = js[np.argmax(run[js])]
        if len(js) * mpp > 1.5: continue   # wider than 1.5 m = snow/ice mass on the wall, not a streak
        out.append(dict(col=int(c_lo + jc), c0=int(c_lo + js[0]), c1=int(c_lo + js[-1]), r0=int(top + st[jc]), r1=int(top + st[jc] + run[jc]),
                        lenM=round(float(run[jc] * mpp), 3), widthM=round(float(len(js) * mpp), 3),
                        cols=[(int(c_lo + j), round(float(run[j] * mpp), 3), int(top + st[j])) for j in js]))
    return out
def run(bands, ici, texmap=None):
    res = []; bad = 0
    for b in bands:
        img = np.asarray(Image.open((texmap or {}).get(b['plate'], b['tex'])).convert('L'), np.float32)
        key = 'x' if b['side'] == 'front' else 'z'
        cones = np.array([c[key] for c in ici if c['tier'] == b['tier'] and c['side'] == b['side']] or [1e9])
        for s in detect(img, b, abs(b['b'])):
            x = b['a'] + b['b'] * s['col']; d = float(np.min(np.abs(cones - x)))
            if d > max(0.2, s['widthM'] / 2): res.append(dict(plate=b['plate'], tier=b['tier'], side=b['side'], coord=round(x, 3), **s, nearestConeM=round(d, 3))); bad += 1
    return dict(pass_=bad == 0, ghosts=bad, list=res)
if __name__ == '__main__':
    a = sys.argv[1:]; tm = {}
    if '--tex' in a:
        i = a.index('--tex') + 1
        while i < len(a) and '=' in a[i]: k, v = a[i].split('=', 1); tm[k] = v; i += 1
    r = run(json.load(open(a[0])), json.load(open(a[1])), tm); r['pass'] = r.pop('pass_')
    if '--out' in a: json.dump(r, open(a[a.index('--out') + 1], 'w'), indent=1)
    print(json.dumps(dict(ghostStreaks=r['ghosts'], pass_=r['pass'], first=r['list'][:6])))

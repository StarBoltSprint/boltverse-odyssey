"""Blocking LOD silhouette-difference gate at each switch distance (full-res ray passes from render_views.py --raydiv 1).
python3 lod_gate.py <near_dir> <far_dir> <view> [--out j]
diff = XOR of hit masks OR interior depth jump > max(0.1 m, 1 %) (icicles/lip/door edges popping in front of the wall). focus = 3 px band around LOD-near depth/normal edges (cornice lip, icicles, doorway edges).
PASS iff xorFrac <= 0.0005 of hit px, focusXorFrac <= 0.001 of focus px, largest diff blob <= 4 px.
"""
import sys, json, numpy as np
from scipy import ndimage as ndi
a, b, v = sys.argv[1:4]
A = np.load(f'{a}/{v}-pass.npz'); B = np.load(f'{b}/{v}-pass.npz')
ha, hb = ~np.isnan(A['depth']), ~np.isnan(B['depth']); dd = np.abs(np.nan_to_num(A['depth']) - np.nan_to_num(B['depth']))
x = (ha ^ hb) | (ha & hb & (dd > np.maximum(0.1, 0.01 * np.nan_to_num(A['depth']))))   # outline change or interior depth pop (> relief amp)
D = np.where(ha, A['depth'], 0); j = np.zeros_like(D)
for ax in (0, 1): j = np.maximum(j, np.abs(D - np.roll(D, 1, ax)))
edge = (j > 0.15) | (ha ^ ndi.binary_erosion(ha)); focus = ndi.binary_dilation(edge, iterations=3)
lab, n = ndi.label(x); blob = int(np.bincount(lab.ravel())[1:].max()) if n else 0
r = dict(view=v, hitPx=int(ha.sum()), xorPx=int(x.sum()), xorFrac=round(float(x.sum() / max(1, ha.sum())), 6),
         focusPx=int(focus.sum()), focusXorPx=int((x & focus).sum()), focusXorFrac=round(float((x & focus).sum() / max(1, focus.sum())), 6), maxBlobPx=blob)
r['pass'] = r['xorFrac'] <= 0.0005 and r['focusXorFrac'] <= 0.001 and blob <= 4
print(json.dumps(r))

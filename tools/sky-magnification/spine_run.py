#!/usr/bin/env python3
"""Run the sky-magnification gate on a spine for each of the 12 final plates, mip 0 and mip 1, + star check at the worst pose."""
import argparse, copy, glob, json, re, sys
import numpy as np
from PIL import Image
import skymag as S, starmip as M

def latest(src, i):
    fs = glob.glob(f"{src}/zd-sky12-S{i:02d}-final*.jpg")
    return max(fs, key=lambda f: int(re.search(r'final(\d*)\.jpg', f).group(1) or 1))

def main(argv=None):
    ap = argparse.ArgumentParser(); ap.add_argument('--spine', required=True)
    ap.add_argument('--src', default='/workspace/zd-bible-1012/zd-plates/sky12'); ap.add_argument('--out', default='out/zd-sky-magnification-spine-v1.json')
    a = ap.parse_args(argv); spine = json.load(open(a.spine)); rep = dict(spine=a.spine, spine_version=spine.get('version'), plates=[])
    for i in range(12):
        f = latest(a.src, i); w, h = Image.open(f).size
        c = copy.deepcopy(S.DEFAULTS); c.update(plate_w=w, plate_h=h)
        res = [S.eval_pose(c, dict(p, yaw=p['yaw'] + 15 + 30 * i - (0 if p['name'].startswith('turn') else 0)))
               for p in S.poses(c, spine)]
        res = [r for r in res if r['sky_visible']]; res.sort(key=lambda r: r['min_mag'])
        d = spine.get('descent') or {}; lo, hi = d.get('s0', 670), d.get('s1', 999)
        for r in res: r['pose']['provisional'] = bool(lo <= r['pose']['s'] <= hi)
        prov = [r for r in res if r['pose']['provisional']]; ver = [r for r in res if not r['pose']['provisional']]
        p10 = [r for r in prov if r['pose']['pitch'] == spine.get('descent', {}).get('cam_pitch_deg', -10)]
        st = lambda L: dict(n=len(L), min_mag=L[0]['min_mag'], pose=L[0]['pose']['name'], pitch=L[0]['pose']['pitch'], region=L[0]['region']) if L else None
        w0 = ver[0]  # gate verdict on verified stretches; provisional reported separately
        rep['plates'].append(dict(id=f"S{i:02d}", src=f, size=[w, h], n_poses=len(res),
            mip0=dict(min_mag=w0['min_mag'], verdict='PASS' if w0['min_mag'] >= 1 else 'FAIL', pose=w0['pose'], region=w0['region'], at_px=w0['at_px'], el_deg=w0['el_deg']),
            verified=st(ver), provisional=st(prov), provisional_at_descent_pitch=st(p10),
            mip1=dict(min_mag=round(2 * w0['min_mag'], 4), verdict='PASS' if 2 * w0['min_mag'] >= 1 else 'FAIL'),
            lowest5=[dict(pose=r['pose']['name'], provisional=r['pose']['provisional'], pitch=r['pose']['pitch'], min_mag=r['min_mag'], region=r['region']) for r in res[:5]]))
    pm = min(p['provisional']['min_mag'] for p in rep['plates'] if p['provisional'])
    pm10 = min(p['provisional_at_descent_pitch']['min_mag'] for p in rep['plates'] if p['provisional_at_descent_pitch'])
    rep['provisional_descent'] = dict(min_mag_at_descent_pitch_only=pm10, note='s670 is still at -2 (climb top) and sets the stretch min; no -2 -> -10 blend points in spine v1.1',range_m=[spine.get('descent', {}).get('s0'), spine.get('descent', {}).get('s1')], min_mag=pm,
        pitch=-10, lowers_below_0736=pm < 0.7359 - 1e-4, mip1_min_mag=round(2 * pm, 4))
    g = min(rep['plates'], key=lambda p: p['mip0']['min_mag'])
    rep['global'] = dict(plate=g['id'], **g['mip0'], mip1_min_mag=g['mip1']['min_mag'],
                         holds_0736=abs(g['mip0']['min_mag'] - 0.7359) < 0.005)
    # star check at the worst pose on that plate (horizon band)
    b = np.asarray(Image.open(g['src']).convert('RGB'), np.float32) / 255; R = (0, b.shape[0] - 300, b.shape[1], b.shape[0] - 5)
    ref = M.star_check(b, None, g['mip0']['min_mag'], R)[0]
    rep['star_check'] = dict(plate=g['id'], mag=g['mip0']['min_mag'], no_mip=ref,
        box=M.compare(b, M.mip1_box(b), g['mip0']['min_mag'], R, ref)[0], star_preserving=M.compare(b, M.mip1_star(b), g['mip0']['min_mag'], R, ref)[0])
    json.dump(rep, open(a.out, 'w'), indent=1, default=float)
    for p in rep['plates']: print(p['id'], 'prov', p['provisional']['min_mag'], p['size'], p['mip0']['min_mag'], p['mip0']['pose']['name'], p['mip0']['region'], 'mip1', p['mip1']['min_mag'])
    print('GLOBAL', rep['global']); print('DESCENT', rep['provisional_descent']); sc = rep['star_check']
    for k in ('box', 'star_preserving'): print(k, sc[k]['verdict'], sc[k]['peak_vs_nomip'], sc[k]['median_size_px'], sc[k]['bg_drift_vs_nomip'])
    return 0

if __name__ == '__main__': sys.exit(main())

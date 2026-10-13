#!/usr/bin/env python3
"""tools/12 sky-magnification gate.

Minimum on-screen magnification of the Zone D sky ring (render-buffer pixels
per sky texel) over the follow-camera path. GPU-style: per pixel,
rho = max(|d(uv_texels)/dx|, |d(uv_texels)/dy|); magnification = 1/rho.
mag < 1.0 means the GPU would want a smaller mip (minification) -> FAIL.
"""
import argparse, json, math, sys
import numpy as np

DEFAULTS = dict(
    plate_w=1280, plate_h=720, plate_hfov=35.0, section_deg=30.0, n_plates=12,
    css=[412, 915], render_scale=1.5, vfov=48.0,
    cam_back=4.5, cam_up=2.6, pitch=-8.0, climb_pitch=-2.0, blend_m=10.0,
    climb=[370.0, 670.0], top_cam_y=48.0, spine_len=1100.0, step_m=5.0,
    turn_s=520.0, turn_deg=90.0, turn_step=5.0, grid_px=6,
)

def ss(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t)

def poses(c, spine=None):
    out = []
    a, b, bl = c['climb'][0], c['climb'][1], c['blend_m']
    def pitch_at(s):
        w = ss(a - bl, a, s) * (1 - ss(b, b + bl, s))
        return c['pitch'] + (c['climb_pitch'] - c['pitch']) * w
    def camy_at(s):
        return c['cam_up'] + (c['top_cam_y'] - c['cam_up']) * ss(a, b, s)
    if spine:  # list of points, or zd-spine.v1 dict {"points":[{"s","y","cam_pitch_deg"}], "climb":{"turn_deg"}, "sampling":{}}
        meta = spine if isinstance(spine, dict) else {}
        pts = meta.get('points', spine)
        gp = lambda p: p.get('pitch', p.get('cam_pitch_deg', pitch_at(p['s'])))
        for p in pts:
            out.append(dict(name=f"s{p['s']:g}", s=p['s'], yaw=p.get('yaw', 0.0), pitch=gp(p),
                            cam_y=p.get('cam_y', p.get('y', 0.0) + c['cam_up'])))
        cl = meta.get('climb', {})
        if cl.get('turn_deg'):  # turn mid-climb: sweep yaw at the climb midpoint
            beats = {b.get('name'): b for b in meta.get('beats', [])}
            cb = next((v for k, v in beats.items() if 'climb' in str(k)), None)
            ts = (cb['s0'] + cb['s1']) / 2 if cb else c['turn_s']
            tp = min(pts, key=lambda p: abs(p['s'] - ts)); st = meta.get('sampling', {}).get('turn_yaw_step_deg', c['turn_step'])
            y = 0.0
            while y <= cl['turn_deg'] + 1e-6:
                out.append(dict(name=f"turn-s{tp['s']:g}-yaw{y:g}", s=tp['s'], yaw=y, pitch=gp(tp),
                                cam_y=tp.get('y', 0.0) + c['cam_up'])); y += st
        return out
    s = 0.0
    while s <= c['spine_len'] + 1e-6:
        out.append(dict(name=f"s{s:g}", s=s, yaw=0.0, pitch=pitch_at(s), cam_y=camy_at(s))); s += c['step_m']
    y = 0.0
    while y <= c['turn_deg'] + 1e-6:
        out.append(dict(name=f"turn-s{c['turn_s']:g}-yaw{y:g}", s=c['turn_s'], yaw=y,
                        pitch=pitch_at(c['turn_s']), cam_y=camy_at(c['turn_s']))); y += c['turn_step']
    return out

def buffer_size(c):
    return int(round(c['css'][0] * c['render_scale'])), int(round(c['css'][1] * c['render_scale']))

def eval_pose(c, p):
    W, H = buffer_size(c)
    f = (H / 2) / math.tan(math.radians(c['vfov'] / 2))
    tex_per_deg_u = c['plate_w'] / c['plate_hfov']
    vcov = c['plate_hfov'] * c['plate_h'] / c['plate_w']   # equirect slice, square texels
    tex_per_deg_v = c['plate_h'] / vcov
    g = c['grid_px']
    xs = np.arange(g / 2, W, g); ys = np.arange(g / 2, H, g)
    X, Y = np.meshgrid(xs, ys)
    pr, yr = math.radians(p['pitch']), math.radians(p['yaw'])
    def azel(x, y):
        dx = (x - W / 2) / f; dy = (H / 2 - y) / f; dz = 1.0
        # pitch about camera X, then yaw about world Y
        y2 = dy * math.cos(pr) + dz * math.sin(pr); z2 = -dy * math.sin(pr) + dz * math.cos(pr)
        n = np.sqrt(dx * dx + y2 * y2 + z2 * z2)
        el = np.degrees(np.arcsin(y2 / n)); az = np.degrees(np.arctan2(dx, z2)) + p['yaw']
        return az, el
    az, el = azel(X, Y)
    azx, elx = azel(X + 0.5, Y); az_x, el_x = azel(X - 0.5, Y)
    azy, ely = azel(X, Y + 0.5); az_y, el_y = azel(X, Y - 0.5)
    wrap = lambda d: (d + 180) % 360 - 180
    dux = wrap(azx - az_x) * tex_per_deg_u; dvx = (elx - el_x) * tex_per_deg_v
    duy = wrap(azy - az_y) * tex_per_deg_u; dvy = (ely - el_y) * tex_per_deg_v
    rho = np.maximum(np.hypot(dux, dvx), np.hypot(duy, dvy))
    mag = 1.0 / rho
    sky = (el >= 0) & (el <= vcov)
    if not sky.any():
        return dict(pose=p, sky_visible=False)
    m = np.where(sky, mag, np.inf); i = np.unravel_index(np.argmin(m), m.shape)
    x, y = float(X[i]), float(Y[i])
    region = ["top", "middle", "bottom"][min(2, int(3 * y / H))] + "-" + ["left", "centre", "right"][min(2, int(3 * x / W))]
    azm = float(az[i]) % 360
    return dict(pose=p, sky_visible=True, min_mag=round(float(m[i]), 4),
                at_px=[round(x), round(y)], region=region,
                plate=f"S{int(azm // c['section_deg']) % c['n_plates']:02d}",
                az_deg=round(azm, 2), el_deg=round(float(el[i]), 2),
                sky_frac=round(float(sky.mean()), 3), buffer=[W, H])

def run(c, spine=None):
    res = [eval_pose(c, p) for p in poses(c, spine)]
    vis = [r for r in res if r['sky_visible']]
    vis.sort(key=lambda r: r['min_mag'])
    worst = vis[0] if vis else None
    ok = worst is None or worst['min_mag'] >= 1.0
    vcov = c['plate_hfov'] * c['plate_h'] / c['plate_w']
    return dict(gate="sky-magnification", verdict="PASS" if ok else "FAIL", limit=">= 1.0",
                config=c, buffer=list(buffer_size(c)), plate_vcov_deg=round(vcov, 3),
                global_min=worst, lowest5=vis[:5], n_poses=len(res), n_sky_poses=len(vis),
                failing_poses=sum(r['min_mag'] < 1.0 for r in vis),
                mip1_needed=not ok)

def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--config'); ap.add_argument('--spine'); ap.add_argument('--out')
    ap.add_argument('--set', action='append', default=[], help='key=json')
    a = ap.parse_args(argv)
    c = dict(DEFAULTS)
    if a.config: c.update(json.load(open(a.config)))
    for kv in a.set:
        k, v = kv.split('=', 1); c[k] = json.loads(v)
    spine = json.load(open(a.spine)) if a.spine else None
    r = run(c, spine)
    s = json.dumps(r, indent=1)
    if a.out: open(a.out, 'w').write(s)
    g = r['global_min']
    print(f"{r['verdict']} min {g['min_mag']} at {g['pose']['name']} {g['region']} {g['plate']} buffer {r['buffer']}" if g else r['verdict'])
    return 0 if r['verdict'] == 'PASS' else 1

if __name__ == '__main__':
    sys.exit(main())

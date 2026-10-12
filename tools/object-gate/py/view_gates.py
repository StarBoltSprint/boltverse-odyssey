"""Blocking view gates on render_views.py output (+ mesh triangle quality). Zero errors to PASS.
python3 view_gates.py <renderdir> [--mesh mesh.obj|.glb|zc:<solids.json>] [--out gates.json] [--coverage 0|1]
oblique-profile : on 'oblique45' and 'grazing' passes, real volume = depth steps + normal spread inside the silhouette.
   stepFrac  = share of interior hit px whose 4-neighbour depth jump > 0.25 m and > 3 % of range (recess/overhang edges)
   normSpread= share of interior hit px whose normal differs > 25 deg from the dominant facade normal
   FAIL if stepFrac < 0.03 or normSpread < 0.15 in either view (a flat facade with a pasted image reads ~0).
triangle-quality: FAIL if any degenerate (area < 1e-8 m2), or sliver share (min angle < 10 deg or aspect > 8) > 1 %.
untextured-area : coverage pass (hit face UV outside its plate's object mask) > 0.5 % of hit px in any view, OR (always)
   image test: flat grey px (sat < 0.08, 5x5 std < 2.0, 60 < L < 215) inside the hit mask > 1 % of hit px.
"""
import sys, json, os, numpy as np
from PIL import Image
from scipy import ndimage as ndi
a = sys.argv[1:]
if a[0] == '--image-only':   # untextured-area image test on an existing capture; object px = differs from the corner clear colour
    res = {}
    for p in a[1:]:
        im = np.asarray(Image.open(p).convert('RGB'), np.float32); clear = im[2, 2]
        obj = ndi.binary_erosion(np.abs(im - clear).sum(2) > 12, iterations=3)
        mx, mn = im.max(2), im.min(2); sat = (mx - mn) / np.maximum(mx, 1); L = im.mean(2)
        sd = np.sqrt(np.maximum(ndi.uniform_filter(L ** 2, 5) - ndi.uniform_filter(L, 5) ** 2, 0))
        g = (sat < 0.08) & (sd < 2.0) & (L > 60) & (L < 215) & obj
        res[p] = dict(greyFrac=round(float(g.sum() / max(1, obj.sum())), 4), pass_=bool(g.sum() / max(1, obj.sum()) <= 0.01))
    print(json.dumps(res, indent=1)); sys.exit(0)
R = a[0]; opt = {a[i]: a[i + 1] for i in range(1, len(a) - 1, 2)}
V = json.load(open(os.path.join(R, 'views.json')))['views']
res = {}; errors = []
def interior(hit): return ndi.binary_erosion(hit, iterations=2)
def oblique(name):
    z = np.load(os.path.join(R, name + '-pass.npz')); D, N = z['depth'], z['normal']; hit = ~np.isnan(D); I = interior(hit)
    Df = np.where(hit, D, 0); rng = np.nanpercentile(D, 98) - np.nanpercentile(D, 2) if hit.any() else 0
    jump = np.zeros_like(Df)
    for ax in (0, 1):
        for sh in (1, -1):
            jump = np.maximum(jump, np.abs(Df - np.roll(Df, sh, ax)))
    thr = max(0.25, 0.03 * rng); step = (jump > thr) & I
    n = N[I]; n = n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-6)
    # dominant normal = most common quantised normal
    q = np.round(n * 3).astype(int); u, cnt = np.unique(q, axis=0, return_counts=True); dom = u[cnt.argmax()] / np.linalg.norm(u[cnt.argmax()])
    spread = float((n @ dom < np.cos(np.radians(25))).mean()) if len(n) else 0.0
    r = dict(stepFrac=round(float(step.sum() / max(1, I.sum())), 4), normSpread=round(spread, 4), hitPx=int(hit.sum()))
    r['pass'] = bool(I.sum() > 50 and r['stepFrac'] >= 0.03 and r['normSpread'] >= 0.15); return r
for v in ('oblique45', 'grazing'):
    if v in V:
        res.setdefault('oblique-profile', {})[v] = r = oblique(v)
        if not r['pass']: errors.append(f'oblique-profile {v}: stepFrac {r["stepFrac"]} normSpread {r["normSpread"]}')
# untextured
cov_on = opt.get('--coverage', '1') == '1'
for v in V:
    z = np.load(os.path.join(R, v + '-pass.npz')); hit = ~np.isnan(z['depth']); cov = z['cov']
    im = np.asarray(Image.open(os.path.join(R, V[v]['png'])).convert('RGB'), np.float32)
    h, w = hit.shape; big = np.asarray(Image.fromarray(hit.astype(np.uint8) * 255).resize((im.shape[1], im.shape[0]), Image.NEAREST)) > 0
    big = ndi.binary_erosion(big, iterations=3)
    mx, mn = im.max(2), im.min(2); sat = (mx - mn) / np.maximum(mx, 1); L = im.mean(2)
    sd = np.sqrt(np.maximum(ndi.uniform_filter(L ** 2, 5) - ndi.uniform_filter(L, 5) ** 2, 0))
    grey = (sat < 0.08) & (sd < 2.0) & (L > 60) & (L < 215) & big
    r = dict(greyFrac=round(float(grey.sum() / max(1, big.sum())), 4))
    if cov_on and (cov >= 0).any(): r['uncoveredFrac'] = round(float((cov == 0).sum() / max(1, (cov >= 0).sum())), 4)
    r['pass'] = r['greyFrac'] <= 0.01 and r.get('uncoveredFrac', 0) <= 0.005
    res.setdefault('untextured-area', {})[v] = r
    if not r['pass']: errors.append(f'untextured-area {v}: {r}')
    if grey.any(): Image.fromarray((grey * 255).astype(np.uint8)).save(os.path.join(R, v + '-grey.png'))
# uv stretch on what the views actually see (per-face stretch from the builder, OBJ face order)
if '--stretch' in opt:
    STv = np.load(opt['--stretch'])
    for v in V:
        fid = np.load(os.path.join(R, v + '-pass.npz'))['face']; h = fid >= 0
        sv = STv[np.clip(fid[h], 0, len(STv) - 1)]
        r = dict(p95=round(float(np.percentile(sv, 95)), 3) if h.any() else 0, over13Frac=round(float((sv > 1.3).mean()), 4) if h.any() else 0)
        r['pass'] = r['over13Frac'] <= 0.005
        res.setdefault('uv-stretch-visible', {})[v] = r
        if not r['pass']: errors.append(f'uv-stretch {v}: {r}')
    res['uv-stretch-mesh'] = dict(p50=round(float(np.median(STv)), 3), over13Frac=round(float((STv > 1.3).mean()), 4))
# triangle quality
def load_mesh(p):
    if p.startswith('zc:'):
        j = json.load(open(p[3:])); b = open(os.path.join(os.path.dirname(p[3:]), 'solids.bin'), 'rb').read(); out = []
        for o in j['objects']:
            vv = np.frombuffer(b, np.float32, o['verts'] * o['floats'], o['vertByteOffset']).reshape(-1, o['floats'])[:, :3]
            ii = np.frombuffer(b, np.uint32, o['indexBytes'] // 4, o['indexByteOffset']).reshape(-1, 3)
            out.append(vv[ii])
        return np.concatenate(out)
    if p.endswith('.obj'):
        vs, fs = [], []
        for ln in open(p):
            if ln.startswith('v '): vs.append([float(x) for x in ln.split()[1:4]])
            elif ln.startswith('f '): fs.append([int(t.split('/')[0]) - 1 for t in ln.split()[1:4]])
        return np.array(vs)[np.array(fs)]
    import subprocess, tempfile
    t = tempfile.mktemp(suffix='.npy')
    subprocess.run(['blender', '-b', '--python-expr', f"""import bpy,numpy as np
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath='{p}')
T=[]
for o in bpy.context.scene.objects:
    if o.type!='MESH': continue
    me=o.data; me.calc_loop_triangles(); v=np.array([o.matrix_world@x.co for x in me.vertices])
    T.append(v[np.array([t.vertices[:] for t in me.loop_triangles])])
np.save('{t}',np.concatenate(T))"""], capture_output=True)
    return np.load(t)
if '--mesh' in opt:
    T = load_mesh(opt['--mesh']).astype(np.float64)
    e = [np.linalg.norm(T[:, (k + 1) % 3] - T[:, k], axis=1) for k in range(3)]
    area = 0.5 * np.linalg.norm(np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]), axis=1)
    ang = []
    for k in range(3):
        u = T[:, (k + 1) % 3] - T[:, k]; w = T[:, (k + 2) % 3] - T[:, k]
        c = (u * w).sum(1) / np.maximum(np.linalg.norm(u, axis=1) * np.linalg.norm(w, axis=1), 1e-12); ang.append(np.degrees(np.arccos(np.clip(c, -1, 1))))
    mina = np.min(ang, 0); emax = np.max(e, 0); aspect = emax ** 2 / np.maximum(2 * area, 1e-12) * (np.sqrt(3) / 2) / 1.0
    deg = int((area < 1e-8).sum()); ok = area >= 1e-8
    sl = (mina < 10) | (aspect > 8)
    r = dict(tris=int(len(T)), degenerate=deg, sliverFrac=round(float(sl[ok].mean()), 4), minAngleP5=round(float(np.percentile(mina[ok], 5)), 2),
             aspectP99=round(float(np.percentile(aspect[ok], 99)), 2))
    r['pass'] = deg == 0 and r['sliverFrac'] <= 0.01
    res['triangle-quality'] = r
    if not r['pass']: errors.append(f'triangle-quality: {r}')
res['errors'] = errors; res['verdict'] = 'PASS' if not errors else 'FAIL'
json.dump(res, open(opt.get('--out', os.path.join(R, 'view-gates.json')), 'w'), indent=1)
print(json.dumps(res, indent=1))

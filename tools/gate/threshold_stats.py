"""Threshold view stats: project recess floor (z -1.5..0) and ground strip (z 0..3) of the tier-1 door
into a views.json render, draw the recess-edge marker, report grey/flat stats per strip + nogrey regions."""
import json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from tools.gate import nogrey
DOOR_X0, DOOR_X1, DOOR_Z, RECESS = -2.1075, 0.387, 0.0, 1.5   # zd-play index.html X0/X1/DD, facade z=0
HERE = os.path.dirname(__file__)

def proj(v, W, H, P):
    C = np.array([-0.86, v['up_m'], DOOR_Z + v['from_door_m']]); d = np.asarray(P, float) - C
    t = math.radians(-v['pitch_deg'])            # camera pitched down by t: world->camera = rotate +t about X
    y = d[..., 1] * math.cos(t) - d[..., 2] * math.sin(t); z = d[..., 1] * math.sin(t) + d[..., 2] * math.cos(t)
    f = (H / 2) / math.tan(math.radians(v['vfov_deg'] / 2))
    return np.stack([W / 2 + f * d[..., 0] / -z, H / 2 - f * y / -z], -1)

def poly_mask(W, H, pts):
    im = Image.new('L', (W, H), 0); ImageDraw.Draw(im).polygon([tuple(p) for p in pts], fill=1); return np.asarray(im, bool)

def stats(rgb, m):
    a = rgb.astype(np.float32); L = a.mean(2)
    mu = ndi.uniform_filter(L, 5); sd = np.sqrt(np.maximum(ndi.uniform_filter(L * L, 5) - mu * mu, 0))
    _, flat = nogrey.flat_grey_mask(rgb); sat = a.max(2) - a.min(2)
    m = m & ~((a[..., 0] > 120) & (a[..., 0] - a[..., 2] > 60))   # exclude the orange/cyan approach rings
    m = m & ~((a[..., 2] > 150) & (a[..., 2] - a[..., 0] > 80))
    if not m.any(): return None
    return dict(px=int(m.sum()), meanRgb=a[m].mean(0).round(1).tolist(), meanLuma=round(float(L[m].mean()), 1),
                localStd5=round(float(np.median(sd[m])), 2), lowSatFrac=round(float((sat[m] <= nogrey.SAT_MAX).mean()), 3),
                flatGreyFrac=round(float(flat[m].mean()), 3), darkFrac_luma_lt25=round(float((L[m] < 25).mean()), 3))

def run(png, view, out_jpg):
    v = json.load(open(os.path.join(HERE, 'views.json')))[view]; rgb = np.asarray(Image.open(png).convert('RGB')); H, W = rgb.shape[:2]
    rec = proj(v, W, H, [[DOOR_X0, 0, -RECESS], [DOOR_X1, 0, -RECESS], [DOOR_X1, 0, 0], [DOOR_X0, 0, 0]])
    gnd = proj(v, W, H, [[DOOR_X0, 0, 0], [DOOR_X1, 0, 0], [DOOR_X1, 0, 3], [DOOR_X0, 0, 3]])
    r = dict(view=view, image=out_jpg, size=[W, H],
             recess_floor=dict(what="terrace-lod0 mesh, material 'top' (top.jpg), y=0, z -1.5..0", **(stats(rgb, poly_mask(W, H, rec)) or {})),
             ground_strip_0_3m=dict(what="zd-play ground PlaneGeometry 96x96, MeshStandardMaterial map top.jpg, y=-0.01", **(stats(rgb, poly_mask(W, H, gnd)) or {})),
             nogrey=nogrey.check(png))
    im = Image.fromarray(rgb); dr = ImageDraw.Draw(im); e = proj(v, W, H, [[DOOR_X0, 0.0, 0], [DOOR_X1, 0.0, 0]])
    dr.line([tuple(e[0]), tuple(e[1])], fill=(255, 60, 200), width=2); im.save(out_jpg, quality=88)
    r['recess_edge_px'] = e.round(1).tolist(); return r

if __name__ == '__main__':
    print(json.dumps(run(*sys.argv[1:4]), indent=1).replace('"pass_"', '"pass"'))

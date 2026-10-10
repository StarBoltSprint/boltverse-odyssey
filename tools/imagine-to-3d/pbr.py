"""Stage 'pbr' (q16 missing #3 + #5): relightable materials for three.js MeshStandardMaterial, every pixel from Imagine.

1. requests: four Imagine edits of ONE colour plate (single source => same aspect, native size):
     albedo   "same surface, flat even shadowless light, no highlights, no ambient occlusion"   -> map
     height   "greyscale height map of the same surface: raised = white, recessed = black"     -> normal + AO
     rough    "greyscale roughness map: polished/glossy = black, matte/rough = white"           -> roughness
     metal    "greyscale metalness map: bare metal = white, stone/paint/dust = black"            -> metalness
2. bake (native resolution of the colour plate, never resized):
     map        = the Imagine albedo plate, byte-identical (fallback: the colour plate, flagged 'lit')
     normal.png = tangent-space OpenGL (+Y up, three.js default) from the high-passed Imagine height plate
                  (fallback: Depth Anything V2 on the colour plate), fine detail only (< geometry relief grid)
     orm.png    = R ambient occlusion (multi-scale cavity of the height), G roughness, B metalness
                  (three.js reads aoMap.r, roughnessMap.g, metalnessMap.b -> one texture for all three)
     material.json = MeshStandardMaterial parameters.
   Derived maps are deterministic functions of Imagine pixels only (no noise, no typed colours).
3. checks: native size for every map, albedo byte-identical, albedo baked-light correlation (delit), shadow chroma
   neutral, normal unit length, relight response under 3 lights.

  python3 pbr.py requests --plate P.jpg --type rock --out DIR
  python3 pbr.py bake --plate P.jpg --metres-wide 16 --type rock --out DIR [--albedo A --height H --rough R --metal M]
"""
import argparse, json, os, shutil, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import i23d_common as C
from imagine import Request, write_batch

PROMPTS = {
    "albedo": "The exact same surface as <IMAGE_1>, same framing, every crack, stain and colour in the same place, but lit by "
              "perfectly flat even shadowless light: no cast shadows, no shading, no highlights, no ambient occlusion, no fog. "
              "Pure base colour (albedo). Same resolution and detail.",
    "height": "A greyscale height map of the exact same surface as <IMAGE_1>, same framing, pixel-aligned: raised parts white, "
              "recessed cracks and gaps black, smooth mid-grey for flat areas, no lighting, no colour.",
    "rough": "A greyscale roughness map of the exact same surface as <IMAGE_1>, same framing, pixel-aligned: polished glossy "
             "metal or glass black, matte stone, dust and sand white, no lighting, no colour.",
    "metal": "A greyscale metalness map of the exact same surface as <IMAGE_1>, same framing, pixel-aligned: bare metal and "
             "chrome white, stone, paint, dust, sand and glass black, no lighting, no colour.",
}


def requests(plate, out, obj_type):
    prof = C.load_profile(obj_type); maps = prof["pbr"]["maps"]
    want = ["albedo"] + (["height"] if "normal" in maps or "ao" in maps else []) + (["rough"] if "roughness" in maps else []) \
        + (["metal"] if "metalness" in maps and prof["pbr"]["metalness"][1] > 0.1 else [])
    stem = os.path.splitext(os.path.basename(plate))[0]
    reqs = [Request(id=f"{stem}-{k}", kind="edit", prompt=PROMPTS[k], refs=[plate], out=os.path.join(out, f"{stem}-{k}.jpg"),
                    purpose=f"pbr-{k}", meta=dict(plate=os.path.abspath(plate), map=k)) for k in want]
    return write_batch(reqs, os.path.join(out, f"batch-pbr-{stem}.json"), note="PBR plates (single-source edits keep native size)")


def _grey(p, size):
    im = Image.open(p).convert("L")
    if im.size != tuple(size):
        raise ValueError(f"{p}: {im.size} != colour plate {size}; Imagine PBR plate must be pixel-aligned at native size (regenerate, never resize)")
    return np.asarray(im).astype(np.float32) / 255


def height_from(plate_img, height_plate, size):
    if height_plate: return _grey(height_plate, size), "imagine-height-plate"
    import coarse
    d = coarse.depth_dav2(plate_img)
    if d is not None: return d, "dav2-on-imagine-colour-plate"
    return C.luma(plate_img), "luma-of-imagine-colour-plate"


def normal_from_height(h, pxm, amp_m, fine_m=1.0):
    """High-pass the height (detail finer than the geometry's ~1 m relief grid), scale to metres, OpenGL tangent normals."""
    sig = max(1.0, fine_m * pxm / 2.5)
    hp = h - ndi.gaussian_filter(h, sig)
    s = np.percentile(np.abs(hp), 99) + 1e-6
    hm = np.clip(hp / s, -1.5, 1.5) * amp_m                      # metres
    dx = ndi.sobel(hm, 1) / 8 * pxm; drow = ndi.sobel(hm, 0) / 8 * pxm
    n = np.stack([-dx, drow, np.ones_like(hm)], -1)               # +Y = up in UV (row grows downward)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n, hm


def ao_from_height(hm, pxm):
    ao = np.ones_like(hm)
    for r_m in (0.1, 0.3, 0.9):
        sig = max(1.0, r_m * pxm)
        cav = np.clip(ndi.gaussian_filter(hm, sig) - hm, 0, None) / max(r_m, 1e-3)
        ao -= 0.35 * np.clip(cav, 0, 1)
    return np.clip(ao, 0.35, 1.0)


def remap(x, lo, hi):
    a, b = np.percentile(x, 2), np.percentile(x, 98)
    return lo + (hi - lo) * np.clip((x - a) / max(1e-6, b - a), 0, 1)


def baked_light_corr(img, n):
    """Max over 16 light directions of corr(high-passed luma, N.L): how much directional shading the image carries."""
    L = C.luma(img); hp = L - ndi.gaussian_filter(L, 8); hp = (hp - hp.mean()) / (hp.std() + 1e-6)
    best = 0.0
    for az in np.linspace(0, 2 * np.pi, 16, endpoint=False):
        l = np.array([np.cos(az) * 0.7, np.sin(az) * 0.7, 0.71]); s = n @ l; s = (s - s.mean()) / (s.std() + 1e-6)
        best = max(best, abs(float((hp * s).mean())))   # sign-free: depth polarity of the source may be inverted
    return best


def relight(albedo, n, rough, metal, ao, light):
    """Tiny GGX + Lambert shade (same model family as MeshStandardMaterial) for the relight test."""
    l = np.array(light, float); l /= np.linalg.norm(l); v = np.array([0, 0, 1.0]); h = (l + v) / np.linalg.norm(l + v)
    nl = np.clip(n @ l, 0, 1); nh = np.clip(n @ h, 0, 1); a2 = np.maximum(rough, 0.04) ** 4
    D = a2 / (np.pi * (nh ** 2 * (a2 - 1) + 1) ** 2); F0 = 0.04 * (1 - metal)[..., None] + albedo * metal[..., None]
    spec = (D * 0.25)[..., None] * F0; diff = albedo * (1 - metal)[..., None] / np.pi
    return np.clip((diff + spec) * nl[..., None] * 3.0 + albedo * ao[..., None] * 0.08, 0, 1)


def bake(plate, metres_wide, obj_type, out, albedo=None, height=None, rough=None, metal=None):
    prof = C.load_profile(obj_type); pb = prof["pbr"]; os.makedirs(out, exist_ok=True)
    im = Image.open(plate); size = im.size; W, H = size; pxm = W / metres_wide
    col = C.load_rgb(plate); rep = C.Report(f"pbr {os.path.basename(plate)} ({obj_type})")
    stem = os.path.splitext(os.path.basename(plate))[0]
    # map: Imagine albedo plate, byte-identical
    src = albedo or plate; ext = os.path.splitext(src)[1]; mp = os.path.join(out, f"{stem}-map{ext}")
    shutil.copyfile(src, mp); prov = C.provenance_record(src)
    rep.row("map byte-identical to Imagine", C.assert_native(mp, prov), prov["sha256"][:12], "sha256 equal")
    alb = C.load_rgb(mp)
    rep.row("map native size", alb.shape[1::-1] == tuple(size), list(alb.shape[1::-1]), list(size))
    h, hsrc = height_from(col, height, size)
    n, hm = normal_from_height(h, pxm, min(0.15, pb["heightM"]) if pb["heightM"] > 0 else 0.02)
    ao = ao_from_height(hm, pxm)
    if rough: r = remap(_grey(rough, size), *pb["roughness"]); rsrc = "imagine-rough-plate"
    else:
        Lm = C.luma(col); hl = np.clip(Lm - ndi.grey_opening(Lm, size=7), 0, None)       # local highlights = glossier
        r = pb["roughness"][1] - (pb["roughness"][1] - pb["roughness"][0]) * remap(ndi.gaussian_filter(hl, 2), 0, 1); rsrc = "derived-from-colour-plate"
    if metal: m = remap(_grey(metal, size), *pb["metalness"]); msrc = "imagine-metal-plate"
    else:
        sat = col.max(-1) - col.min(-1)
        m = np.full(col.shape[:2], pb["metalness"][0], np.float32) if pb["metalness"][1] <= 0.1 else \
            pb["metalness"][0] + (pb["metalness"][1] - pb["metalness"][0]) * np.clip((0.12 - sat) / 0.12, 0, 1) * remap(C.luma(col), 0, 1)
        msrc = "derived-from-colour-plate"
    Image.fromarray(((n * 0.5 + 0.5) * 255 + 0.5).astype(np.uint8)).save(os.path.join(out, f"{stem}-normal.png"))
    orm = np.stack([ao, r, m], -1)
    Image.fromarray((orm * 255 + 0.5).astype(np.uint8)).save(os.path.join(out, f"{stem}-orm.png"))
    for k in ("normal", "orm"):
        rep.row(f"{k} native size", Image.open(os.path.join(out, f"{stem}-{k}.png")).size == size, list(size), "== colour plate")
    nl = np.linalg.norm(n, axis=-1); rep.row("normals unit length", float(np.abs(nl - 1).max()) < 1e-3, round(float(np.abs(nl - 1).max()), 6), "< 1e-3")
    # delit albedo: the albedo must carry much less directional shading than the lit colour plate
    c_col, c_alb = baked_light_corr(col, n), baked_light_corr(alb, n)
    lit_ok = albedo is not None and c_alb <= max(0.15, 0.6 * c_col)
    rep.row("albedo delit (baked-light corr)", lit_ok, round(c_alb, 3), f"<= max(0.15, 0.6 x colour plate {c_col:.3f})",
            "" if albedo else "no Imagine albedo plate yet: map = lit colour plate (request pbr 'albedo')")
    # neutral shadows in the albedo (darkest 10 %): not violet
    Lm = C.luma(alb); dk = Lm < np.percentile(Lm, 10); rgb = alb[dk].mean(0) if dk.any() else np.array([0.3, 0.3, 0.3])
    violet = bool(rgb[0] > rgb[1] * 1.08 and rgb[2] > rgb[1] * 1.08)
    rep.row("dark areas not violet", not violet, [round(float(x), 3) for x in rgb], "r,b not both > 1.08 g")
    # relight: response must change with the light (it is a material, not a picture)
    shots = [relight(alb, n, r, m, ao, L) for L in ([0.6, 0.5, 0.6], [-0.6, 0.3, 0.7], [0, -0.7, 0.7])]
    diff = float(np.mean([np.abs(C.luma(a) - C.luma(b)).mean() for a, b in [(shots[0], shots[1]), (shots[0], shots[2])]]))
    rep.row("relight response", diff > 0.01, round(diff, 4), "> 0.01 mean luma change across lights")
    sheet = np.concatenate([np.asarray(Image.fromarray((x * 255).astype(np.uint8)).resize((W // 3, H // 3))) for x in shots], 1)
    Image.fromarray(sheet).save(os.path.join(out, f"{stem}-relight-sheet.jpg"))   # analysis sheet only, never shipped
    mat = dict(type="MeshStandardMaterial", map=os.path.basename(mp), normalMap=f"{stem}-normal.png", normalScale=[1, 1],
               roughnessMap=f"{stem}-orm.png", metalnessMap=f"{stem}-orm.png", aoMap=f"{stem}-orm.png", roughness=1.0, metalness=1.0,
               aoMapIntensity=1.0, colorSpace={"map": "SRGBColorSpace", "normalMap": "NoColorSpace", "orm": "NoColorSpace"},
               texture={"generateMipmaps": True, "minFilter": "LinearMipmapLinearFilter", "anisotropy": "renderer.capabilities.getMaxAnisotropy()"},
               sources=dict(map="imagine-albedo-plate" if albedo else "imagine-colour-plate (lit, fallback)", height=hsrc, roughness=rsrc, metalness=msrc),
               nativeSize=list(size), pxPerM=round(pxm, 2), provenance=prov)
    C.dump(mat, os.path.join(out, f"{stem}-material.json"))
    r_ = rep.as_dict(); r_["material"] = mat; C.dump(r_, os.path.join(out, f"{stem}-pbr-report.json"))
    return r_


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("cmd", choices=["requests", "bake"]); ap.add_argument("--plate", required=True)
    ap.add_argument("--type", required=True); ap.add_argument("--out", required=True); ap.add_argument("--metres-wide", type=float)
    for k in ("albedo", "height", "rough", "metal"): ap.add_argument("--" + k)
    a = ap.parse_args()
    if a.cmd == "requests": print(requests(a.plate, a.out, a.type))
    else:
        r = bake(a.plate, a.metres_wide, a.type, a.out, a.albedo, a.height, a.rough, a.metal)
        for row in r["rows"]: print(row["status"], row["check"], row["value"], row["limit"])

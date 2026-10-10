"""Locked biome palette (SmiR 2026-10-10): sample the key's light, shadow, sky, haze and material colours once per
biome, then grade EVERY new Imagine image toward it at import. Imagine pixels only: a smooth per-pixel CIELAB transform
(mean shift + bounded contrast scale, lit and shadow halves separately); nothing is painted, no colour literal is added.
Every grade logs its before / after CIEDE2000 (palette-log.jsonl).

  python3 palette.py sample --key key.jpg --spec ../object-gate/specs/zone-b/key-compare.yaml [--biome biome.json] --out palettes/ember-mesa.json
  python3 palette.py grade IMG --palette P --material sand --out OUT.png [--strength 0.8] [--log palette-log.jsonl]
  python3 palette.py shift DIR --offsets kc-grade.json --element mesas --out DIR2   # fixloop kc-colour: apply a render-measured Lab offset
  python3 palette.py measure IMG --palette P --material sand                        # ΔE lit / shadow vs the palette entry

Palette file = biome.json `anchor.sampled` (kept as `anchorSampled`) extended with, per entry: lit / shadow mean CIELAB
and std, from the key-compare element masks (same masks the gate uses, so the palette and the gate agree):
  light (top 2 % L of the frame), shadow (bottom 10 %), sky, haze, and one material per key-compare element
  (towers -> tower, mesas -> sandstone, sand -> sand, avenue -> paving, wreck -> hull, ...).
"""
import argparse, json, os, sys, time
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import i23d_common as C

KC_LIB = os.path.join(C.OBJECT_GATE_DIR or "", "lib")
sys.path.insert(0, KC_LIB)

MATERIAL_OF = {"towers": "tower", "tower-right": "tower", "facade": "tower-facade", "tower-edges": "tower-edge", "avenue": "paving",
               "sand": "sand", "mesas": "sandstone", "arch": "sandstone-arch", "spire": "spire", "sky": "sky", "rings": "ring",
               "moon": "moon", "sun": "sun", "haze": "haze", "wreck": "hull", "debris": "debris"}


def _rel(p):
    p = os.path.abspath(p); return os.path.relpath(p, C.REPO) if p.startswith(C.REPO + os.sep) else p


def stats(lab):
    """lab: N x 3 -> lit / shadow split on the median L."""
    med = float(np.median(lab[:, 0])); lit, sh = lab[lab[:, 0] >= med], lab[lab[:, 0] < med]
    f = lambda x: dict(mean=[round(float(v), 2) for v in x.mean(0)], std=[round(float(v), 2) for v in x.std(0)], n=int(len(x)))
    return dict(medianL=round(med, 2), lit=f(lit if len(lit) else lab), shadow=f(sh if len(sh) else lab), all=f(lab))


def sample(key, spec_path, out, biome=None):
    import keycompare as K
    spec = C.read_yaml(spec_path); a = K.load(key); H, W = a.shape[:2]; lab = C.srgb_to_lab(a)
    L = lab[..., 0]; P = dict(tool="imagine-to-3d palette", key=os.path.abspath(key), spec=_rel(spec_path), at=time.strftime("%Y-%m-%d %H:%M"),
                              entries={})
    P["entries"]["light"] = stats(lab[L >= np.percentile(L, 98)])
    P["entries"]["shadow"] = stats(lab[L <= np.percentile(L, 10)])
    for e in spec["elements"]:
        if e.get("notInKey"): continue
        m = K.elem_mask(a, e["key"], W, H)
        if m.sum() < 30: continue
        name = MATERIAL_OF.get(e["id"], e["id"])
        if name in P["entries"]: name = f"{name}-{e['id']}"   # first (main) element keeps the material name
        P["entries"][name] = dict(stats(lab[m]), element=e["id"], type=e["type"], cover=round(float(m.mean()), 4))
    if biome and os.path.exists(biome):
        b = json.load(open(biome)); P["biome"] = b.get("id"); P["anchorSampled"] = (b.get("anchor") or {}).get("sampled")
        P["qc"] = b.get("qc")
    C.dump(P, out); return P


def _entry(P, material):
    e = P["entries"].get(material)
    if not e: raise SystemExit(f"palette has no entry '{material}' (have: {sorted(P['entries'])})")
    return e


def measure(img, P, material, mask=None):
    a = C.load_rgb(img) if isinstance(img, str) else img; lab = C.srgb_to_lab(a).reshape(-1, 3)
    if mask is not None: lab = lab[mask.reshape(-1)]
    s = stats(lab); e = _entry(P, material)
    return dict(deLit=round(float(C.delta_e2000(s["lit"]["mean"], e["lit"]["mean"])), 2), deShadow=round(float(C.delta_e2000(s["shadow"]["mean"], e["shadow"]["mean"])), 2),
                labLit=s["lit"]["mean"], labShadow=s["shadow"]["mean"])


def lab_to_srgb(lab):
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    fy = (L + 16) / 116; fx = fy + a / 500; fz = fy - b / 200
    e3 = lambda f: np.where(f ** 3 > 216 / 24389, f ** 3, (116 * f - 16) / (24389 / 27))
    xyz = np.stack([e3(fx) * 0.95047, e3(fy), e3(fz) * 1.08883], -1)
    M = np.array([[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]])
    c = xyz @ M.T
    return np.clip(np.where(c <= 0.0031308, 12.92 * c, 1.055 * np.clip(c, 0, None) ** (1 / 2.4) - 0.055), 0, 1)


def transfer(a, tgt_lit, tgt_sh, strength=0.8, std_clamp=(0.75, 1.33), src_mask=None):
    """Imagine pixels -> graded pixels. Per half (lit / shadow on the image's own median L): Lab mean shift + std scale
    toward the target, blended by a smooth weight across the median (no seam), applied with `strength`."""
    lab = C.srgb_to_lab(a); flat = lab.reshape(-1, 3) if src_mask is None else lab[src_mask]
    s = stats(flat); med = s["medianL"]; out = np.zeros_like(lab)
    w = 1 / (1 + np.exp(-(lab[..., 0] - med) / 4.0))[..., None]   # 1 = lit, 0 = shadow
    for half, tgt, wt in (("lit", tgt_lit, w), ("shadow", tgt_sh, 1 - w)):
        mu, sd = np.array(s[half]["mean"]), np.maximum(np.array(s[half]["std"]), 1e-3)
        tm, ts = np.array(tgt["mean"]), np.array(tgt.get("std", s[half]["std"]))
        k = np.clip(ts / sd, *std_clamp); k[1:] = np.clip(k[1:], *std_clamp)
        out += wt * ((lab - mu) * k + tm)
    graded = lab + strength * (out - lab)
    return lab_to_srgb(graded)


def grade(img, P, material, out, strength=0.8, log=None, mask=None):
    a = C.load_rgb(img); e = _entry(P, material)
    before = measure(a, P, material, mask)
    g = transfer(a, e["lit"], e["shadow"], strength, src_mask=mask.reshape(-1) if mask is not None else None)
    after = measure(g, P, material, mask)
    q = 95 if out.lower().endswith((".jpg", ".jpeg")) else None
    C.save_rgb(g, out, q)
    rec = dict(at=time.strftime("%Y-%m-%d %H:%M:%S"), src=os.path.abspath(img), out=os.path.abspath(out), material=material, strength=strength,
               before=dict(deLit=before["deLit"], deShadow=before["deShadow"]), after=dict(deLit=after["deLit"], deShadow=after["deShadow"]),
               srcSha256=C.sha256(img), note="Imagine pixels only (CIELAB transfer), size unchanged")
    if log:
        os.makedirs(os.path.dirname(os.path.abspath(log)), exist_ok=True); open(log, "a").write(json.dumps(rec) + "\n")
    return rec


def shift(src_dir, offsets, element, out_dir, live_roots=()):
    """fixloop kc-colour: add the render-measured Lab error (key - game, lit / shadow) to the element's plates.
    Writes to out_dir only (refuses a live root)."""
    for lr in live_roots:
        if lr and os.path.abspath(out_dir).startswith(os.path.abspath(lr)): raise SystemExit(f"refusing to write into live root {lr}")
    off = json.load(open(offsets))[element]; os.makedirs(out_dir, exist_ok=True); done = []
    for f in sorted(os.listdir(src_dir)):
        if not f.lower().endswith((".png", ".jpg", ".jpeg", ".webp")): continue
        a = C.load_rgb(os.path.join(src_dir, f)); lab = C.srgb_to_lab(a); med = np.median(lab[..., 0])
        w = 1 / (1 + np.exp(-(lab[..., 0] - med) / 4.0))[..., None]
        lab = lab + w * np.array(off["lit"]) + (1 - w) * np.array(off["shadow"])
        C.save_rgb(lab_to_srgb(lab), os.path.join(out_dir, f), 95); done.append(f)
    return done


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("cmd", choices=["sample", "grade", "shift", "measure"]); ap.add_argument("target", nargs="?")
    ap.add_argument("--key"); ap.add_argument("--spec"); ap.add_argument("--biome"); ap.add_argument("--out"); ap.add_argument("--palette")
    ap.add_argument("--material"); ap.add_argument("--strength", type=float, default=0.8); ap.add_argument("--log")
    ap.add_argument("--offsets"); ap.add_argument("--element")
    a = ap.parse_args()
    if a.cmd == "sample":
        P = sample(a.key, a.spec, a.out, a.biome); print(json.dumps({k: (v["lit"]["mean"], v["shadow"]["mean"]) for k, v in P["entries"].items()}))
    elif a.cmd == "grade":
        print(json.dumps(grade(a.target, json.load(open(a.palette)), a.material, a.out, a.strength, a.log)))
    elif a.cmd == "measure":
        print(json.dumps(measure(a.target, json.load(open(a.palette)), a.material)))
    else:
        print(json.dumps(shift(a.target, a.offsets, a.element, a.out, [os.environ.get("I23D_LIVE_ROOT", "/workspace/zb-preview-1008")])))

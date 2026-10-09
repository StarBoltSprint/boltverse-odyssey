"""Shared helpers for the imagine-to-3d upgrade modules (classify, views, coarse, pbr, compare, fixloop, keyvideo).

Nothing here resizes a texture that ships: resizing is used ONLY to compute metrics on analysis copies.
Provenance: every shipped pixel must come from an Imagine output; `provenance_record()` stores sha256 + native size so
`assert_native()` can prove a plate was never downscaled or re-encoded.
"""
import hashlib, json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
# object-gate (PR #191) lives next to us in the repo; fall back to the gate worker's worktree on the box
OBJECT_GATE_DIR = os.environ.get("OBJECT_GATE_DIR") or next(
    (p for p in [os.path.join(REPO, "tools", "object-gate"), "/workspace/grokcli/wt/object-gate/tools/object-gate"]
     if os.path.exists(os.path.join(p, "profiles", "_base.yaml"))), None)

# Imagine (Grok Build CLI 1.0.46, kit/IMAGINE.md): output size is FIXED by aspect; no resolution knob.
IMAGINE_NATIVE = {"9:16": (720, 1280), "16:9": (1280, 720), "1:1": (1024, 1024), "2:3": (832, 1248), "3:2": (1248, 832)}
IMAGINE_MAX_SOURCES = 3
PHONE_VFOV_DEG, PHONE_H_PX = 58.0, 1200            # portrait phone 540x1200 (same as gate_local.FOCAL_PX)
PHONE_FOCAL_PX = PHONE_H_PX / (2 * np.tan(np.deg2rad(PHONE_VFOV_DEG) / 2))


# ---------------------------------------------------------------- io
def load_rgb(p):
    return np.asarray(Image.open(p).convert("RGB")).astype(np.float32) / 255.0

def save_rgb(a, p, quality=None):
    os.makedirs(os.path.dirname(os.path.abspath(p)), exist_ok=True)
    im = Image.fromarray(np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8)) if a.dtype != np.uint8 else Image.fromarray(a)
    if p.lower().endswith((".jpg", ".jpeg")): im.save(p, quality=quality or 95)
    else: im.save(p)
    return p

def dump(obj, p):
    os.makedirs(os.path.dirname(os.path.abspath(p)), exist_ok=True)
    if p.endswith((".yaml", ".yml")):
        import yaml; open(p, "w").write(yaml.safe_dump(obj, sort_keys=False, allow_unicode=True))
    else:
        json.dump(obj, open(p, "w"), indent=1, default=_jsonable)
    return p

def _jsonable(o):
    if isinstance(o, (np.floating,)): return float(o)
    if isinstance(o, (np.integer,)): return int(o)
    if isinstance(o, np.ndarray): return o.tolist()
    if isinstance(o, (np.bool_,)): return bool(o)
    raise TypeError(type(o))

def read_yaml(p):
    import yaml
    return yaml.safe_load(open(p))

def sha256(p):
    h = hashlib.sha256(); h.update(open(p, "rb").read()); return h.hexdigest()


# ---------------------------------------------------------------- provenance / never downscale
def provenance_record(path, source="imagine", request=None):
    try:
        im = Image.open(path); size, fmt = list(im.size), im.format
    except Exception:   # video
        import subprocess
        o = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", path],
                           capture_output=True, text=True).stdout.strip().split("\n")[0].split(",")
        size, fmt = ([int(o[0]), int(o[1])] if len(o) == 2 and o[0] else None), "video"
    return dict(path=os.path.abspath(path), sha256=sha256(path), size=size, format=fmt, source=source, request=request)

def assert_native(path, rec):
    """The file must be byte-identical to the recorded Imagine output (no resize, no re-encode)."""
    if sha256(path) != rec["sha256"]:
        raise AssertionError(f"{path}: not byte-identical to the Imagine output (resized or re-encoded?)")
    if rec.get("format") != "video" and list(Image.open(path).size) != list(rec["size"]):
        raise AssertionError(f"{path}: size changed {Image.open(path).size} != {rec['size']}")
    return True


def assert_not_video_frame(path):
    """keyvideo frames morph: they may enrich checklists, never geometry/plates (folder marker from keyvideo.py)."""
    d = os.path.dirname(os.path.abspath(path))
    while d and d != "/":
        if os.path.exists(os.path.join(d, ".video-frames-not-for-geometry")):
            raise ValueError(f"{path}: Imagine video frame (keyvideo) - never a geometry or plate source")
        d = os.path.dirname(d)
    return True


# ---------------------------------------------------------------- masks / silhouettes
def object_mask(img, rect_margin=0.04, iters=5, max_side=400):
    """Analysis mask (metrics only): computed on a <= max_side copy, returned at the input size (nearest)."""
    h0, w0 = img.shape[:2]; s = max_side / max(h0, w0)
    if s < 1:
        small = np.asarray(Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).resize((max(8, round(w0 * s)), max(8, round(h0 * s))), Image.LANCZOS)).astype(np.float32) / 255
        m = _object_mask(small, rect_margin, iters)
        return np.asarray(Image.fromarray(m.astype(np.uint8) * 255).resize((w0, h0), Image.NEAREST)) > 127
    return _object_mask(img, rect_margin, iters)


def _object_mask(img, rect_margin=0.04, iters=5):
    """Generic foreground mask of a key crop or an Imagine view (object on sky/sand/flat background).
    GrabCut seeded with the SKY-like border pixels (close to the top-row median colour) as background, the bottom
    border as probable background and every other border pixel as probable foreground (key crops often cut the object
    at the crop edge). Degenerate results fall back to 'not sky'. Override with an explicit mask whenever one exists
    (e.g. objects1-redo/masks/*.npy)."""
    import cv2
    img = np.clip(img, 0, 1)
    u8 = (img * 255).astype(np.uint8)[..., ::-1].copy()
    h, w = u8.shape[:2]
    b = max(2, int(round(min(h, w) * rect_margin)))
    sky = np.median(img[:b].reshape(-1, 3), 0)
    skylike = np.linalg.norm(img - sky, axis=2) < 0.09
    border = np.zeros((h, w), bool); border[:b] = border[-b:] = True; border[:, :b] = True; border[:, -b:] = True
    m = np.full((h, w), cv2.GC_PR_FGD, np.uint8)
    m[border] = cv2.GC_PR_FGD
    m[-b:] = cv2.GC_PR_BGD
    m[border & skylike] = cv2.GC_BGD
    # smooth (untextured) regions connected to the border = studio backdrop / sky / flat sand -> background
    L = luma(img); mu = ndi.uniform_filter(L, 9); sd = np.sqrt(np.maximum(ndi.uniform_filter(L * L, 9) - mu * mu, 0))
    smooth = sd < 0.012
    lab, _ = ndi.label(smooth); edge_labels = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    backdrop = np.isin(lab, edge_labels[edge_labels > 0])
    m[backdrop] = cv2.GC_BGD
    if not (m == cv2.GC_BGD).any(): m[:b] = cv2.GC_BGD
    bg, fg = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    try:
        cv2.grabCut(u8, m, None, bg, fg, iters, cv2.GC_INIT_WITH_MASK)
        out = (m == cv2.GC_FGD) | (m == cv2.GC_PR_FGD)
    except cv2.error:
        out = ~skylike
    frac = out.mean()
    if frac < 0.03 or frac > 0.97: out = ~skylike
    out = ndi.binary_opening(out, iterations=2)
    lab, n = ndi.label(out)
    if n:
        sizes = ndi.sum(out, lab, range(1, n + 1)); out = lab == (int(np.argmax(sizes)) + 1)
    return ndi.binary_fill_holes(out)

def load_mask(p, size=None):
    if p.endswith(".npy"): m = np.load(p).astype(bool)
    else: m = np.asarray(Image.open(p).convert("L")) > 127
    if size is not None and (m.shape[1], m.shape[0]) != tuple(size):
        m = np.asarray(Image.fromarray(m.astype(np.uint8) * 255).resize(tuple(size), Image.NEAREST)) > 127
    return m

def bbox(mask):
    ys, xs = np.nonzero(mask)
    if not len(xs): return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1

def normalise_silhouette(mask, out_h=512, pad=0.08, anchor="base"):
    """Scale the silhouette so its HEIGHT fills out_h*(1-2pad), base-centred. Width is kept proportional, so two
    silhouettes of the same object at the same camera agree; different widths/depths show up in the IoU."""
    bb = bbox(mask)
    if bb is None: return np.zeros((out_h, out_h), bool)
    x0, y0, x1, y1 = bb; crop = mask[y0:y1, x0:x1]
    s = out_h * (1 - 2 * pad) / max(1, (y1 - y0))
    nw, nh = max(1, int(round((x1 - x0) * s))), max(1, int(round((y1 - y0) * s)))
    c = np.asarray(Image.fromarray(crop.astype(np.uint8) * 255).resize((nw, nh), Image.NEAREST)) > 127
    W = max(out_h, nw + 4); out = np.zeros((out_h, W), bool)
    ox = (W - nw) // 2; oy = out_h - int(out_h * pad) - nh
    out[oy:oy + nh, ox:ox + nw] = c
    return out

def iou(a, b):
    if a.shape != b.shape:
        W = max(a.shape[1], b.shape[1]); H = max(a.shape[0], b.shape[0])
        def padto(m):
            o = np.zeros((H, W), bool); ox = (W - m.shape[1]) // 2; oy = H - m.shape[0]; o[oy:oy + m.shape[0], ox:ox + m.shape[1]] = m; return o
        a, b = padto(a), padto(b)
    u = (a | b).sum()
    return float((a & b).sum() / u) if u else 0.0

def silhouette_iou(mask_a, mask_b, out_h=512):
    """IoU of two silhouettes after height-normalisation and base-centring (framing-independent)."""
    return iou(normalise_silhouette(mask_a, out_h), normalise_silhouette(mask_b, out_h))


# ---------------------------------------------------------------- colour / image metrics
def srgb_to_lab(rgb):
    c = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    L = 116 * f[..., 1] - 16; a = 500 * (f[..., 0] - f[..., 1]); b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], -1)

def delta_e2000(lab1, lab2):
    L1, a1, b1 = np.moveaxis(np.asarray(lab1, np.float64), -1, 0); L2, a2, b2 = np.moveaxis(np.asarray(lab2, np.float64), -1, 0)
    C1, C2 = np.hypot(a1, b1), np.hypot(a2, b2); Cb = (C1 + C2) / 2
    G = 0.5 * (1 - np.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2; C1p, C2p = np.hypot(a1p, b1), np.hypot(a2p, b2)
    h1p = np.degrees(np.arctan2(b1, a1p)) % 360; h2p = np.degrees(np.arctan2(b2, a2p)) % 360
    dLp = L2 - L1; dCp = C2p - C1p
    dh = h2p - h1p; dh = np.where(dh > 180, dh - 360, np.where(dh < -180, dh + 360, dh)); dh = np.where(C1p * C2p == 0, 0, dh)
    dHp = 2 * np.sqrt(C1p * C2p) * np.sin(np.radians(dh / 2))
    Lbp = (L1 + L2) / 2; Cbp = (C1p + C2p) / 2
    hs = h1p + h2p; hbp = np.where(np.abs(h1p - h2p) > 180, (hs + 360) / 2, hs / 2); hbp = np.where(C1p * C2p == 0, hs, hbp)
    T = 1 - 0.17 * np.cos(np.radians(hbp - 30)) + 0.24 * np.cos(np.radians(2 * hbp)) + 0.32 * np.cos(np.radians(3 * hbp + 6)) - 0.20 * np.cos(np.radians(4 * hbp - 63))
    dth = 30 * np.exp(-(((hbp - 275) / 25) ** 2)); RC = 2 * np.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7))
    SL = 1 + 0.015 * (Lbp - 50) ** 2 / np.sqrt(20 + (Lbp - 50) ** 2); SC = 1 + 0.045 * Cbp; SH = 1 + 0.015 * Cbp * T
    RT = -np.sin(np.radians(2 * dth)) * RC
    return np.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH))

def luma(img):
    return img[..., 0] * 0.2126 + img[..., 1] * 0.7152 + img[..., 2] * 0.0722

def ssim(a, b, sigma=1.5):
    """Mean SSIM of two luma images (same shape, 0..1), Gaussian window (Wang et al. 2004)."""
    C1, C2 = 0.01 ** 2, 0.03 ** 2
    mu_a, mu_b = ndi.gaussian_filter(a, sigma), ndi.gaussian_filter(b, sigma)
    saa = ndi.gaussian_filter(a * a, sigma) - mu_a ** 2; sbb = ndi.gaussian_filter(b * b, sigma) - mu_b ** 2
    sab = ndi.gaussian_filter(a * b, sigma) - mu_a * mu_b
    m = ((2 * mu_a * mu_b + C1) * (2 * sab + C2)) / ((mu_a ** 2 + mu_b ** 2 + C1) * (saa + sbb + C2))
    return m

def laplacian_sharpness(img):
    """High-frequency energy (variance of the Laplacian of luma, x1e3) — the 'sharpness' the fix loop targets."""
    return float(ndi.laplace(luma(img)).var() * 1e3)

def autocorr_peak(gray, min_lag=8):
    """Strongest off-centre normalised autocorrelation peak of the high-passed image: tiling / 'carrelage' detector."""
    g = gray - ndi.gaussian_filter(gray, 6); g = (g - g.mean()) / (g.std() + 1e-6)
    F = np.fft.rfft2(g); ac = np.fft.irfft2(F * np.conj(F), s=g.shape) / g.size
    ac = np.fft.fftshift(ac); cy, cx = np.array(ac.shape) // 2
    ac[cy - min_lag:cy + min_lag + 1, cx - min_lag:cx + min_lag + 1] = -1
    return float(ac.max())


# ---------------------------------------------------------------- profiles (shared with object-gate)
def _deep_merge(a, b):
    out = dict(a)
    for k, v in (b or {}).items():
        out[k] = _deep_merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out

def gate_profile(gate_type):
    """object-gate profile (tools/object-gate/profiles/<type>.yaml merged over _base.yaml), read-only reuse."""
    if not OBJECT_GATE_DIR: return {}
    d = os.path.join(OBJECT_GATE_DIR, "profiles")
    base = read_yaml(os.path.join(d, "_base.yaml"))
    p = os.path.join(d, f"{gate_type}.yaml")
    return _deep_merge(base, read_yaml(p)) if os.path.exists(p) else base

STRICTER = {  # key -> which direction is stricter, used to enforce "a profile may only TIGHTEN the gate"
    "minPxPerM": "max", "nearPxPerM": "max", "maxStretch": "min", "maxRepeats": "min", "maxPeak": "min",
    "minIoU": "max", "minReliefM": "max", "maxTintChroma": "min", "maxAirM": "min", "maxNonManifold": "min",
}

def load_profile(obj_type):
    """i23d type profile (profiles/<type>.yaml) + its object-gate profile; `gate.tighten` may only make the gate
    stricter (same rule as object-gate _base.yaml). Returns the merged dict with `gateResolved`."""
    p = read_yaml(os.path.join(HERE, "profiles", f"{obj_type}.yaml"))
    g = gate_profile(p["gate"]["profile"])
    tight = p["gate"].get("tighten") or {}
    resolved = _deep_merge(g, {})
    violations = []
    for sect, vals in tight.items():
        for k, v in vals.items():
            cur = (resolved.get(sect) or {}).get(k)
            rule = STRICTER.get(k)
            if cur is not None and v is not None and rule:
                ok = (v >= cur) if rule == "max" else (v <= cur)
                if not ok: violations.append(f"{sect}.{k}: {v} looser than gate {cur}")
            resolved.setdefault(sect, {})[k] = v
    if violations: raise ValueError(f"profile {obj_type} loosens the object-gate: {violations}")
    p["gateResolved"] = resolved
    return p

def list_types():
    return sorted(f[:-5] for f in os.listdir(os.path.join(HERE, "profiles")) if f.endswith(".yaml") and not f.startswith("_"))


# ---------------------------------------------------------------- tiny report helper
class Report:
    def __init__(self, name): self.name = name; self.rows = []
    def row(self, check, ok, value, limit, note=""):
        self.rows.append(dict(check=check, status="PASS" if ok else "FAIL", value=value, limit=limit, note=note)); return ok
    @property
    def ok(self): return all(r["status"] == "PASS" for r in self.rows)
    def md(self):
        s = [f"## {self.name}: {'PASS' if self.ok else 'FAIL'}", "", "| check | status | value | limit | note |", "|---|---|---|---|---|"]
        for r in self.rows: s.append(f"| {r['check']} | {r['status']} | {r['value']} | {r['limit']} | {r['note']} |")
        return "\n".join(s) + "\n"
    def as_dict(self): return dict(name=self.name, verdict="PASS" if self.ok else "FAIL", rows=self.rows)

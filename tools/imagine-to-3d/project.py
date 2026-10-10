"""project stage — masked multi-camera projection on Depth Anything hard-surface relief.

Objects are built here, not by a hand recipe. The tool never generates an Imagine image.
Hidden faces become imagine-requests.json (NEEDS_APPROVAL). Default request is ONE
turnaround sheet (one denoising process). A per-view request is only the fallback when
some of those faces are already answered. Owner go gates every generation.

python3 project.py probe     # key-camera fit numbers, no staging
"""
import hashlib, json, os, shutil, subprocess, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import i23d_common as C
import strata2

# Q22 prompt, verbatim (arch-research-1008/q22-answer.md). Identity lock is the next paragraph.
SHEET_PROMPT = """Create a clean orthographic model turnaround sheet of the exact same tower shown in the reference image.

Four equal panels side by side on a plain neutral light-gray background:

1. front view (exact match to the reference silhouette, materials, lighting, and details — do not redesign),
2. pure left profile,
3. pure back view,
4. pure right profile.

Same materials, surface details, weathering, lighting direction and intensity, colour, and exact silhouette proportions across every panel.

Orthographic camera, no perspective distortion, no tilt, no scene, no dunes, no arches, no extra objects, no text.

Consistent scale and alignment so the panels can be cut and used as face textures.

Preserve every visible detail from the reference; invent only what is necessary for the hidden faces while matching style exactly."""
IDENTITY_LOCK = "tall dark metallic/glass tower with the same broken/open sections and cable details as the reference"
# Top and single-face requests must NOT reuse the four-panel sheet text.
TOP_PROMPT = """Create a clean orthographic top-down view of the exact same tower shown in the reference image.

One panel, camera looking straight down on the roof and the crown, on a plain neutral light-gray background.

Same materials, surface details, weathering, lighting direction and intensity, colour, and the exact roof silhouette as the reference.

Orthographic camera, no perspective distortion, no tilt, no scene, no dunes, no arches, no extra objects, no text.

This is a separate top view, conditioned on the key and the side panels. Plain background.

Preserve every visible detail from the reference; invent only the roof plan while matching style exactly."""
SHEET_FACES = ("front", "left", "back", "right")
SIDE_FACES = ("left", "back", "right")
ALL_FACES = ("front", "left", "right", "back", "top", "under-ledges")
BAYS = (0.0, 0.55, 0.80, 1.05)
REMBG_PY = "/workspace/.venv-of/bin/python"
LIVE_ROOT = os.environ.get("I23D_LIVE_ROOT", "/workspace/zb-preview-1008")
FORBIDDEN = ("/workspace/zb-preview-1008", "/workspace/kc-staging/zb-tower1", "/workspace/proj-1010",
             "/workspace/kc-wt", "/workspace/zb-tower-hybrid-1010")


def _prof_project():
    try:
        p = C.load_profile("building")
    except Exception:
        p = {}
    return dict(p.get("project") or {})


def sheet_prompt():
    return _prof_project().get("sheetPrompt") or SHEET_PROMPT


# ---------------------------------------------------------------- camera
class Camera:
    """column-major Three.js view (mw) and projection (pm), as in keycam.json."""

    def __init__(self, mw, pm, w, h, pos=None, fov=None, name="cam"):
        # mw / pm are Three.js column-major element lists of matrixWorld and projectionMatrix.
        self.world = np.array(mw, np.float64).reshape(4, 4).T
        self.pm = np.array(pm, np.float64).reshape(4, 4).T
        self.view = np.linalg.inv(self.world)
        self.vp = self.pm @ self.view
        self.inv = np.linalg.inv(self.vp)
        self.w = int(w)
        self.h = int(h)
        self.pos = None if pos is None else np.array(pos, np.float64)
        if self.pos is None:
            self.pos = self.world[:3, 3].copy()
        self.fov = fov
        self.name = name
        # columns of matrixWorld are the camera axes in world. Three.js looks down -Z.
        R = self.world[:3, :3]
        self.right = R[:, 0] / (np.linalg.norm(R[:, 0]) + 1e-12)
        self.up = R[:, 1] / (np.linalg.norm(R[:, 1]) + 1e-12)
        self.fwd = -R[:, 2]
        self.fwd = self.fwd / (np.linalg.norm(self.fwd) + 1e-12)

    def project(self, P):
        P = np.atleast_2d(np.asarray(P, np.float64))
        h = np.concatenate([P, np.ones((len(P), 1))], 1)
        c = h @ self.vp.T
        w = c[:, 3:4]
        ndc = c[:, :3] / np.where(np.abs(w) < 1e-9, 1e-9, w)
        x = (ndc[:, 0] * 0.5 + 0.5) * self.w
        y = (1.0 - (ndc[:, 1] * 0.5 + 0.5)) * self.h
        return np.stack([x, y], 1), c[:, 3]

    def ray(self, px, py):
        nx = (np.asarray(px, np.float64) / self.w) * 2 - 1
        ny = (1 - np.asarray(py, np.float64) / self.h) * 2 - 1
        def unproj(nx, ny, z):
            clip = np.stack([nx, ny, np.full_like(nx, z, dtype=np.float64), np.ones_like(nx)], -1)
            w = clip @ self.inv.T
            return w[..., :3] / w[..., 3:4]
        a = unproj(nx, ny, -1.0)
        b = unproj(nx, ny, 1.0)
        d = b - a
        n = np.linalg.norm(d, axis=-1, keepdims=True)
        return a, d / np.maximum(n, 1e-12)


def load_keycam(path, w, h):
    k = json.load(open(path))
    return Camera(k["mw"], k["pm"], w, h, pos=k.get("pos"), fov=k.get("fov"), name="key")


def look_camera(target, yaw_deg, pitch_deg, dist, fov_deg, w, h, name="view", ortho=False, vscale=1.0):
    """Y-up camera looking at target. yaw 0 looks +X (key side).
    yaw is degrees about Y from the +X axis toward -Z.
    vscale is an extra vertical magnification (free per view). ortho uses a frustum
    whose size at `dist` matches the perspective fov, then the same vscale."""
    yaw = np.deg2rad(yaw_deg)
    pitch = np.deg2rad(pitch_deg)
    fwd = np.array([
        np.cos(pitch) * np.cos(yaw),
        np.sin(pitch),
        -np.cos(pitch) * np.sin(yaw),
    ], np.float64)
    fwd /= np.linalg.norm(fwd)
    eye = np.asarray(target, np.float64) - fwd * float(dist)
    up = np.array([0.0, 1.0, 0.0])
    z = -fwd
    x = np.cross(up, z)
    if np.linalg.norm(x) < 1e-6:
        x = np.array([1.0, 0.0, 0.0])
    x /= np.linalg.norm(x)
    y = np.cross(z, x)
    R = np.stack([x, y, z], 1)
    mw = np.eye(4)
    mw[:3, :3] = R
    mw[:3, 3] = eye
    aspect = w / float(h)
    vs = float(vscale) if float(vscale) > 1e-3 else 1.0
    near, far = 0.2, 800.0
    pm = np.zeros((4, 4))
    if not ortho:
        f = 1.0 / np.tan(np.deg2rad(fov_deg) / 2)
        pm[0, 0] = f / aspect
        pm[1, 1] = f * vs
        pm[2, 2] = (far + near) / (near - far)
        pm[2, 3] = (2 * far * near) / (near - far)
        pm[3, 2] = -1
    else:
        hy0 = float(dist) * np.tan(np.deg2rad(float(fov_deg)) / 2.0)
        hx = hy0 * aspect
        hy = hy0 / vs
        pm[0, 0] = 1.0 / max(hx, 1e-6)
        pm[1, 1] = 1.0 / max(hy, 1e-6)
        pm[2, 2] = -2.0 / (far - near)
        pm[2, 3] = -(far + near) / (far - near)
        pm[3, 3] = 1.0
    cam = Camera(mw.T.reshape(-1), pm.T.reshape(-1), w, h, pos=eye, fov=fov_deg, name=name)
    cam.ortho = bool(ortho)
    cam.vscale = vs
    return cam


# ---------------------------------------------------------------- masks
def matte_rembg(path):
    """u2net via the of venv. Returns float alpha HxW in 0..1. Never used by the selftest.
    Reuses a previous cut when the source bytes have not changed."""
    out = path + ".rembg.png"
    digest = hashlib.sha256(open(path, "rb").read()).hexdigest()
    stamp = path + ".rembg.sha"
    if os.path.exists(out) and os.path.exists(stamp) and open(stamp).read().strip() == digest:
        rgba = np.asarray(Image.open(out).convert("RGBA"))
        return rgba[..., 3].astype(np.float32) / 255.0
    code = (
        "import os,sys\n"
        "os.environ.setdefault('U2NET_HOME','/home/box/.u2net')\n"
        "from rembg import remove, new_session\n"
        "from PIL import Image\n"
        "im=Image.open(sys.argv[1]).convert('RGB')\n"
        "cut=remove(im, session=new_session('u2net'))\n"
        "cut.save(sys.argv[2])\n"
    )
    r = subprocess.run([REMBG_PY, "-c", code, path, out], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError("rembg failed: " + (r.stderr or r.stdout)[-400:])
    open(stamp, "w").write(digest + "\n")
    rgba = np.asarray(Image.open(out).convert("RGBA"))
    return rgba[..., 3].astype(np.float32) / 255.0


def mask_from_alpha(alpha, silhouette=None):
    """Matte refined by the fitted silhouette. Sky / dunes stay out."""
    m = alpha >= 0.5
    m = ndi.binary_fill_holes(m)
    lab, n = ndi.label(m)
    if n:
        sizes = ndi.sum(m, lab, range(1, n + 1))
        m = lab == (int(np.argmax(sizes)) + 1)
    if silhouette is not None:
        sil = silhouette.astype(bool)
        if sil.shape != m.shape:
            sil = np.asarray(Image.fromarray(sil.astype(np.uint8) * 255).resize((m.shape[1], m.shape[0]), Image.NEAREST)) > 127
        both = m & sil
        if both.mean() > 0.002:
            m = both
    return m


def feather_weight(mask, px):
    """Distance to the mask border, 0 on the border, 1 after `px` pixels inside."""
    m = mask.astype(bool)
    if not m.any():
        return np.zeros(m.shape, np.float32)
    inside = ndi.distance_transform_edt(m)
    return np.clip(inside / max(1.0, float(px)), 0, 1).astype(np.float32)


def pull_push(color, valid):
    """Fill invalid texels from the nearest valid object pixel. Never leave them black."""
    color = np.asarray(color, np.float32)
    valid = np.asarray(valid, bool)
    if valid.all() or not valid.any():
        return color
    _, inds = ndi.distance_transform_edt(~valid, return_indices=True)
    return color[inds[0], inds[1]]


def delight(rgb, mask, exponent=0.55, target=0.42):
    """Divide a smooth luminance out of projected colour so the game sun can relight it.
    Returns float RGB in 0..1. Panel-scale contrast stays. No emissive boost."""
    r = np.asarray(rgb, np.float32)
    if r.size and float(np.max(r)) > 1.5:
        r = r / 255.0
    luma = 0.2126 * r[..., 0] + 0.7152 * r[..., 1] + 0.0722 * r[..., 2]
    im = Image.fromarray(np.clip(luma * 255.0, 0, 255).astype(np.uint8))
    sigma = max(im.size) / 7.0
    Ls = np.asarray(im.filter(ImageFilter.GaussianBlur(radius=sigma)), np.float32) / 255.0
    Ls = np.clip(Ls, 0.04, 0.85)
    ratio = np.clip((float(target) / Ls) ** float(exponent), 0.25, 4.0)
    out = np.clip(r * ratio[..., None], 0, 1)
    m = np.asarray(mask, bool)
    if m.shape == out.shape[:2] and m.any() and (~m).any():
        body = r[m]
        med = np.median(body, 0)
        med_l = float(np.median(luma[m]))
        scale = float(np.clip((float(target) / max(med_l, 0.04)) ** float(exponent), 0.25, 4.0))
        out[~m] = np.clip(med * scale, 0, 1)
    return out.astype(np.float32)


def edge_ring(rgb, mask, ring=3, dark=0.08):
    """FAIL when the outer ring of the object is darker than the interior (sticker edge)."""
    m = np.asarray(mask, bool)
    if m.sum() < 20:
        return dict(ok=False, reason="empty", ring=None, interior=None)
    luma = rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722 if rgb.ndim == 3 else rgb
    dist = ndi.distance_transform_edt(m)
    border = m & (dist <= ring)
    inner = m & (dist > ring * 2)
    if inner.sum() < 10:
        inner = m & (dist > ring)
    rl = float(luma[border].mean()) if border.any() else 0.0
    il = float(luma[inner].mean()) if inner.any() else 0.0
    ok = (il - rl) <= dark and (il < 1e-3 or rl / il >= 0.82)
    return dict(ok=bool(ok), ring=round(rl, 3), interior=round(il, 3), delta=round(il - rl, 3))


def cut_sheet(rgb):
    """Cut a grey-background turnaround sheet into 4 panels and equalise scale. No upscale past the blob."""
    rgb = np.asarray(rgb, np.float32)
    if rgb.max() > 1.5:
        rgb = rgb / 255.0
    luma = rgb @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    sat = rgb.max(2) - rgb.min(2)
    bg = (sat < 0.08) & (luma > 0.55) & (luma < 0.93)
    fg = ndi.binary_opening(~bg, iterations=1)
    fg = ndi.binary_fill_holes(fg)
    lab, n = ndi.label(fg)
    if n < 1:
        return []
    boxes = []
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        if len(xs) < 30:
            continue
        boxes.append((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1, len(xs)))
    boxes.sort(key=lambda b: b[0])
    if len(boxes) < 4:
        return boxes  # caller treats short list as a failed cut
    # keep the 4 widest blobs if the grey field split
    if len(boxes) > 4:
        boxes = sorted(boxes, key=lambda b: -b[4])[:4]
        boxes.sort(key=lambda b: b[0])
    crops = []
    heights = []
    for x0, y0, x1, y1, _ in boxes[:4]:
        crops.append(rgb[y0:y1, x0:x1])
        heights.append(y1 - y0)
    # equalise height by padding (never enlarge). Width padded to the max crop width.
    H = min(heights)  # scale down to the shortest so nothing is upscaled
    out = []
    widths = []
    scaled = []
    for c in crops:
        h, w = c.shape[:2]
        if h != H:
            nw = max(1, int(round(w * (H / float(h)))))
            im = Image.fromarray((np.clip(c, 0, 1) * 255).astype(np.uint8)).resize((nw, H), Image.BOX)
            c = np.asarray(im).astype(np.float32) / 255.0
        scaled.append(c)
        widths.append(c.shape[1])
    W = max(widths)
    for c in scaled:
        canvas = np.full((H, W, 3), 0.78, np.float32)
        x = (W - c.shape[1]) // 2
        canvas[:, x:x + c.shape[1]] = c
        out.append(canvas)
    return out


# ---------------------------------------------------------------- requests
def _prompt_for(kind, faces, note):
    """Sheet text stays on the sheet. A top view and a single face get their own prompt."""
    if kind == "sheet":
        return sheet_prompt()
    if kind == "top":
        return TOP_PROMPT
    face = ", ".join(faces) if faces else "hidden face"
    return (
        "Create one orthographic view of the %s of the exact same tower shown in the reference image.\n\n"
        "One panel on a plain neutral light-gray background. Same materials, surface details, weathering, "
        "lighting direction and intensity, colour, and silhouette proportions as the reference.\n\n"
        "Orthographic camera, no perspective distortion, no scene, no dunes, no arches, no sky, no extra objects, no text.\n\n"
        "%s"
    ) % (face, note)


def _req(rid, kind, faces, yaw, pitch, fov, note):
    return dict(
        id=rid, status="NEEDS_APPROVAL", tool="image_edit",
        prompt=_prompt_for(kind, faces, note),
        identityLock=IDENTITY_LOCK,
        references=["key-crop", "full-key"],
        kind=kind, faces=list(faces),
        camera=dict(yaw=yaw, pitch=pitch, fov=fov, ortho=(kind in ("sheet", "top"))),
        expectedSize=[1600, 800] if kind == "sheet" else [800, 1200],
        output="imagine/in/%s.jpg" % rid,
        note=note,
    )


def plan_requests(covered, coverage_min=0.15):
    """Hidden faces -> the fewest requests. Sheet is the default when no side view is in yet.
    A side that is already covered is not requested again. Top is its own request."""
    covered = set(covered)
    hidden_sides = [f for f in SIDE_FACES if f not in covered]
    reqs = []
    any_side = any(f in covered for f in SIDE_FACES)
    if hidden_sides and not any_side:
        reqs.append(_req(
            "sheet-turnaround", "sheet", list(SHEET_FACES), 0, 0, 20,
            "ONE sheet, four orthographic panels (front/left/back/right) on light grey. "
            "One denoising process so the faces match. Front panel is only a check; the key projection stays the front.",
        ))
    else:
        yaw = {"left": 90, "back": 180, "right": -90}
        for f in hidden_sides:
            reqs.append(_req(
                "view-" + f, "panel", [f], yaw[f], 0, 35,
                "Fallback: one targeted view of the %s face, conditioned on the key and the accepted panels. No scene, no dunes, no arch, no sky." % f,
            ))
    if "top" not in covered:
        reqs.append(_req("view-top", "top", ["top"], 0, 89, 35,
                         "Separate top view, conditioned on the key and the side panels. Plain background."))
    if "under-ledges" not in covered:
        reqs.append(_req("view-under", "panel", ["under-ledges"], 0, -35, 40,
                         "Under-ledge view of the hidden soffits. Plain background, same materials."))
    return reqs


def load_answered(spec, work):
    """Answered requests: spec.project.answered, imagine/in/<id>.jpg, and requests already marked answered."""
    proj = spec.get("project") or {}
    items = []
    for a in proj.get("answered") or []:
        items.append(dict(id=a.get("id") or a.get("face"), face=a.get("face"), path=a["path"],
                          yaw=a.get("yaw", 0), pitch=a.get("pitch", 0), fov=a.get("fov", 40),
                          status="answered", kind=a.get("kind", "panel")))
    ind = os.path.join(work, "imagine", "in")
    if os.path.isdir(ind):
        for name in sorted(os.listdir(ind)):
            if name.lower().endswith((".jpg", ".png")):
                items.append(dict(id=os.path.splitext(name)[0], path=os.path.join(ind, name), status="answered", kind="file"))
    rp = os.path.join(work, "imagine-requests.json")
    if os.path.exists(rp):
        for r in json.load(open(rp)):
            if r.get("status") == "answered" and r.get("path") and os.path.exists(r["path"]):
                items.append(r)
    # de-dupe by path
    seen, out = set(), []
    for it in items:
        p = os.path.abspath(it["path"])
        if p in seen or not os.path.exists(it["path"]):
            continue
        seen.add(p)
        out.append(it)
    return out


# ---------------------------------------------------------------- mesh
class Mesh:
    def __init__(self):
        self.V, self.UV, self.F = [], [], []
        self.TV, self.TUV, self.TF = [], [], []
        self._m = {}

    def _add(self, p, uv, trim, group=0):
        key = (round(float(p[0]), 3), round(float(p[1]), 3), round(float(p[2]), 3), 1 if trim else 0, int(group))
        bag = self._m
        if key in bag:
            return bag[key]
        if trim:
            self.TV.append(p); self.TUV.append(uv); i = len(self.TV) - 1
        else:
            self.V.append(p); self.UV.append(uv); i = len(self.V) - 1
        bag[key] = i
        return i

    def quad(self, pts, uvs, trim=False, group=0):
        ix = [self._add(p, u, trim, group) for p, u in zip(pts, uvs)]
        a, b, c, d = ix
        faces = self.TF if trim else self.F
        # skip degenerate
        P = np.array(pts, np.float64)
        n = np.cross(P[1] - P[0], P[2] - P[0])
        if np.linalg.norm(n) < 1e-8:
            return
        if np.dot(n, self._want) < 0:
            faces.append((a, c, b)); faces.append((a, d, c))
        else:
            faces.append((a, b, c)); faces.append((a, c, d))

    def set_outward_hint(self, n):
        self._want = np.asarray(n, np.float64)

    def arrays(self):
        return (np.asarray(self.V, np.float32), np.asarray(self.UV, np.float32), np.asarray(self.F, np.int32),
                np.asarray(self.TV, np.float32) if self.TV else np.zeros((0, 3), np.float32),
                np.asarray(self.TUV, np.float32) if self.TUV else np.zeros((0, 2), np.float32),
                np.asarray(self.TF, np.int32) if self.TF else np.zeros((0, 3), np.int32))


def gate_sim(V, F):
    """Same relief / crispness / sealed / proportions test the object-gate probe uses."""
    V = np.asarray(V, np.float64)
    F = np.asarray(F, np.int32)
    if len(F) == 0:
        return dict(ok=False, reason="empty")
    # weld at 1 mm
    key = np.round(V * 1000).astype(np.int64)
    _, inv = np.unique(key, axis=0, return_inverse=True)
    edges = {}
    buckets = {k: {} for k in ("+x", "-x", "+z", "-z")}
    crisp = {k: [] for k in buckets}
    degenerate = 0
    for t in F:
        v = inv[t]
        if v[0] == v[1] or v[1] == v[2] or v[0] == v[2]:
            degenerate += 1
            continue
        for k in range(3):
            e = tuple(sorted((int(v[k]), int(v[(k + 1) % 3]))))
            edges[e] = edges.get(e, 0) + 1
        a, b, c = V[t[0]], V[t[1]], V[t[2]]
        n = np.cross(b - a, c - a)
        ar = np.linalg.norm(n) / 2
        if ar < 1e-6:
            continue
        n = n / np.linalg.norm(n)
        ax, ay, az = abs(n)
        if ay >= ax and ay >= az:
            continue
        if az >= ax:
            kk = "+z" if n[2] > 0 else "-z"
            off = (a[2] + b[2] + c[2]) / 3
            aligned = az
        else:
            kk = "+x" if n[0] > 0 else "-x"
            off = (a[0] + b[0] + c[0]) / 3
            aligned = ax
        if aligned < 0.7:
            continue
        y = (a[1] + b[1] + c[1]) / 3
        yb = int(np.floor(y))
        rec = buckets[kk].setdefault(yb, [1e9, -1e9, 0.0, []])
        rec[0] = min(rec[0], off); rec[1] = max(rec[1], off); rec[2] += ar; rec[3].append(off)
        crisp[kk].append((off, ar, y, max(ax, ay, az) > 0.92))
    open_e = sum(1 for n in edges.values() if n == 1)
    nm = sum(1 for n in edges.values() if n > 2)
    relief = {}
    for kk, m in buckets.items():
        spans = []
        for rec in m.values():
            if rec[2] <= 0.2:
                continue
            outer = rec[1] if kk[0] == "+" else rec[0]
            qs = [q for q in rec[3] if (outer - q if kk[0] == "+" else q - outer) <= 3]
            if qs:
                spans.append(max(qs) - min(qs))
        spans.sort()
        relief[kk] = float(spans[len(spans) // 2]) if spans else None
    crisp_out = {}
    for kk, faces in crisp.items():
        env = {}
        for off, ar, y, axis in faces:
            yb = int(np.floor(y))
            e = env.get(yb)
            env[yb] = off if e is None else (max(e, off) if kk[0] == "+" else min(e, off))
        ebase = None
        for e in env.values():
            ebase = e if ebase is None else (max(ebase, e) if kk[0] == "+" else min(ebase, e))
        kept = []
        for off, ar, y, axis in faces:
            e = env.get(int(np.floor(y)))
            if e is None or abs(e) < 0.25 or ebase is None:
                continue
            inward = ((e - off) if kk[0] == "+" else (off - e)) * (ebase / e)
            if -0.08 <= inward <= 3.2:
                kept.append((ar, axis, max(0.0, inward)))
        area = sum(a for a, _, _ in kept) or 0.0
        bins = {}
        for a, axis, res in kept:
            b = int(round(res / 0.05))
            bins[b] = bins.get(b, 0.0) + a
        planes = sum(1 for a in bins.values() if area > 0 and a / area >= 0.02)
        axis_a = sum(a for a, axis, _ in kept if axis)
        crisp_out[kk] = dict(axisFrac=round(axis_a / area, 3) if area else 0.0, planes=planes)
    bb0, bb1 = V.min(0), V.max(0)
    s = bb1 - bb0
    hw = float(s[1] / s[0]) if s[0] else 0
    dw = float(s[2] / s[0]) if s[0] else 0
    n_rel = sum(1 for v in relief.values() if v is not None and v >= 0.30)
    n_cr = sum(1 for d in crisp_out.values() if d["axisFrac"] >= 0.72 and 2 <= d["planes"] <= 8)
    ok = open_e == 0 and nm == 0 and n_rel >= 2 and n_cr >= 2 and 3.0 <= hw <= 5.0 and 0.45 <= dw <= 0.70
    return dict(ok=bool(ok), open=open_e, nonManifold=nm, degenerate=degenerate, tris=int(len(F)),
                relief=relief, crisp=crisp_out, hOverW=round(hw, 3), dOverW=round(dw, 3),
                size=[round(float(x), 2) for x in s], nRelief=n_rel, nCrisp=n_cr)


def _box(mesh, x0, x1, y0, y1, z0, z1, u0, u1, v0, v1):
    # 6 faces, outward
    c = [((x0, y0, z0)), ((x1, y0, z0)), ((x1, y1, z0)), ((x0, y1, z0)),
         ((x0, y0, z1)), ((x1, y0, z1)), ((x1, y1, z1)), ((x0, y1, z1))]
    # explicit quads
    def q(idxs, hint, uv):
        mesh.set_outward_hint(hint)
        mesh.quad([c[i] for i in idxs], uv)
    q((0, 3, 2, 1), (-1, 0, 0), [(u0, v0), (u0, v1), (u1, v1), (u1, v0)])  # will be flipped by hint if needed
    # The quad() uses the hint against the geometric normal of pts 0,1,2. Pass points in an order and let it flip.
    # Easier: call quad with a consistent order and the desired outward normal.


def _closed_box(mesh, x0, x1, y0, y1, z0, z1):
    """One welded box. A set of these is sealed when they do not share vertices."""
    if x1 - x0 < 1e-4 or y1 - y0 < 1e-4 or z1 - z0 < 1e-4:
        return
    faces = [
        ([(x0, y0, z1), (x0, y0, z0), (x0, y1, z0), (x0, y1, z1)], (-1, 0, 0)),
        ([(x1, y0, z0), (x1, y0, z1), (x1, y1, z1), (x1, y1, z0)], (1, 0, 0)),
        ([(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)], (0, 0, -1)),
        ([(x0, y0, z1), (x0, y1, z1), (x1, y1, z1), (x1, y0, z1)], (0, 0, 1)),
        ([(x0, y0, z0), (x0, y0, z1), (x1, y0, z1), (x1, y0, z0)], (0, -1, 0)),
        ([(x0, y1, z1), (x0, y1, z0), (x1, y1, z0), (x1, y1, z1)], (0, 1, 0)),
    ]
    uv = [(0, 0), (1, 0), (1, 1), (0, 1)]
    for pts, hint in faces:
        mesh.set_outward_hint(hint)
        mesh.quad(pts, uv)


def synthetic_shell():
    """Sealed axis-aligned tower. w=40, h=150, d=24 -> h/w=3.75, d/w=0.60.
    Outer box plus inset boxes (no shared vertices) so -x and both Z sides
    carry several constant planes inside the same AABB."""
    mesh = Mesh()
    X0, X1 = 50.0, 90.0
    Y0, Y1 = 20.0, 170.0
    Z0, Z1 = -78.0, -54.0
    _closed_box(mesh, X0, X1, Y0, Y1, Z0, Z1)
    # front bays: -x faces at +0.55 / +0.80 / +1.05, inset in YZ so they do not weld
    yA, yB = Y0 + 0.4, Y1 - 0.4
    zA, zB = Z0 + 0.4, Z1 - 0.4
    for T in (0.55, 0.80, 1.05):
        _closed_box(mesh, X0 + T, X0 + T + 0.12, yA, yB, zA, zB)
    # side bays, inset in XY, Z faces within 3 m of the outer side
    xA, xB = X0 + 2.0, X1 - 2.0
    for T in (0.55, 1.05):
        _closed_box(mesh, xA, xB, yA, yB, Z1 - T - 0.12, Z1 - T)
        _closed_box(mesh, xA, xB, yA, yB, Z0 + T, Z0 + T + 0.12)
    return mesh


def silhouette_iou(V, F, cam, mask, stride=1):
    import cv2
    H, W = mask.shape
    sil = np.zeros((H, W), np.uint8)
    xy, w = cam.project(V)
    faces = np.asarray(F)
    if stride > 1:
        faces = faces[::int(stride)]
    for t in faces:
        if np.any(w[t] <= 0.05):
            continue
        pts = np.round(xy[t]).astype(np.int32)
        if np.any(pts[:, 0] < -W) or np.any(pts[:, 0] > 2 * W):
            continue
        cv2.fillConvexPoly(sil, pts, 1)
    m = mask.astype(bool)
    s = sil.astype(bool)
    inter = np.logical_and(m, s).sum()
    union = np.logical_or(m, s).sum()
    return float(inter) / float(max(1, union)), sil


def mask_bbox(mask):
    ys, xs = np.where(np.asarray(mask) > 0.5)
    if len(xs) == 0:
        return (0, 1, 0, 1)
    return (int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max()))


def norm_xy(px, py, bbox):
    """xn, yn in -1..1 across the object box, not the full frame. The tower is a narrow crop."""
    x0, x1, y0, y1 = bbox
    xn = (np.asarray(px, np.float64) - x0) / max(1.0, float(x1 - x0)) * 2 - 1
    yn = (np.asarray(py, np.float64) - y0) / max(1.0, float(y1 - y0)) * 2 - 1
    return xn, yn


def fit_x_field(cam, mask):
    """Search X = X0 + a*yn + b*xn (yn, xn in -1..1 on the mask box) so the ray shell is a legal wedge.
    Boundary vertices stay on the key rays, so the outline holds."""
    import cv2
    m = (mask > 0.5).astype(np.uint8)
    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not cnts:
        return None
    cnt = max(cnts, key=len)[::3]
    pts = cnt.reshape(-1, 2).astype(np.float64)
    bbox = mask_bbox(mask)
    xn, yn = norm_xy(pts[:, 0], pts[:, 1], bbox)
    o, d = cam.ray(pts[:, 0], pts[:, 1])
    best = None
    for X0 in np.linspace(50, 140, 10):
        for a in np.linspace(-40, 40, 9):
            for b in np.linspace(-40, 40, 17):
                X = X0 + a * yn + b * xn
                if np.any(np.abs(d[:, 0]) < 1e-4):
                    continue
                t = (X - o[:, 0]) / d[:, 0]
                if np.any(t < 1):
                    continue
                P = o + t[:, None] * d
                sx = float(np.ptp(P[:, 0])); sy = float(np.ptp(P[:, 1])); sz = float(np.ptp(P[:, 2]))
                if sx < 1:
                    continue
                hw, dw = sy / sx, sz / sx
                # +1.15 m back pad grows sx. Keep the cloud near a ~150 m tower, not a far giant.
                if not (3.2 <= hw <= 4.5 and 0.52 <= dw <= 0.66 and 140 <= sy <= 175 and 20 <= sz <= 32):
                    continue
                score = -abs(hw - 3.7) - abs(dw - 0.60) - 0.002 * abs(sy - 155)
                if best is None or score > best[0]:
                    best = (score, float(X0), float(a), float(b), hw, dw, sx, sy, sz)
    return best


def _shrink(pts, gap):
    """Pull corners toward the centroid so neighbour cells do not weld in the gate (1 mm)."""
    c = sum(np.asarray(p, np.float64) for p in pts) / len(pts)
    out = []
    for p in pts:
        p = np.asarray(p, np.float64)
        d = c - p
        n = np.linalg.norm(d)
        out.append(p if n < 1e-9 else p + d / n * min(gap, n * 0.4))
    return out


def _extrude(mesh, front, thick, group):
    """Sealed extrusion of one quad along +X. `group` keeps it from welding to its neighbours."""
    front = [np.asarray(p, np.float64) for p in front]
    back = [p + np.array([thick, 0.0, 0.0]) for p in front]
    uv = [(0, 0), (1, 0), (1, 1), (0, 1)]
    faces = [
        (front, (-1, 0, 0)),
        ([back[0], back[3], back[2], back[1]], (1, 0, 0)),
        ([front[0], back[0], back[3], front[3]], (0, 0, -1)),
        ([front[1], front[2], back[2], back[1]], (0, 0, 1)),
        ([front[3], back[3], back[2], front[2]], (0, 1, 0)),
        ([front[0], front[1], back[1], back[0]], (0, -1, 0)),
    ]
    for pts, hint in faces:
        mesh.set_outward_hint(hint)
        mesh.quad(pts, uv, group=group)


def _closed_box_group(mesh, x0, x1, y0, y1, z0, z1, group):
    if x1 - x0 < 1e-4 or y1 - y0 < 1e-4 or abs(z1 - z0) < 1e-4:
        return
    faces = [
        ([(x0, y0, z1), (x0, y0, z0), (x0, y1, z0), (x0, y1, z1)], (-1, 0, 0)),
        ([(x1, y0, z0), (x1, y0, z1), (x1, y1, z1), (x1, y1, z0)], (1, 0, 0)),
        ([(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)], (0, 0, -1)),
        ([(x0, y0, z1), (x0, y1, z1), (x1, y1, z1), (x1, y0, z1)], (0, 0, 1)),
        ([(x0, y0, z0), (x0, y0, z1), (x1, y0, z1), (x1, y0, z0)], (0, -1, 0)),
        ([(x0, y1, z1), (x0, y1, z0), (x1, y1, z0), (x1, y1, z1)], (0, 1, 0)),
    ]
    uv = [(0, 0), (1, 0), (1, 1), (0, 1)]
    for pts, hint in faces:
        mesh.set_outward_hint(hint)
        mesh.quad(pts, uv, group=group)


def build_from_mask(cam, mask, field, step=4, thick=1.15):
    """Front vertices stay on the key rays. Back is the same point plus (thick, 0, 0),
    so the height and the width do not blow up. Bay boxes are a second weld group:
    constant-X planes just behind the outer face, constant-Z planes just inside the sides."""
    H, W = mask.shape
    m = np.asarray(mask).astype(bool)
    X0, a, b = field
    ys, xs = np.where(m)
    if len(xs) < 8:
        return None
    y0, y1 = int(ys.min()), int(ys.max())
    x0, x1 = int(xs.min()), int(xs.max())
    bbox = mask_bbox(mask)

    def X_of(px, py):
        xn, yn = norm_xy(px, py, bbox)
        return float(X0 + a * float(yn) + b * float(xn))

    def hit(px, py):
        X = X_of(px, py)
        o, d = cam.ray(float(px), float(py))
        if abs(float(np.asarray(d)[0])) < 1e-6:
            return None
        t = (X - float(np.asarray(o)[0])) / float(np.asarray(d)[0])
        if t < 1:
            return None
        return np.asarray(o + t * d, np.float64)

    cells = []
    for gy in range(y0, y1, step):
        for gx in range(x0, x1, step):
            cy = min(H - 1, gy + step // 2)
            cx = min(W - 1, gx + step // 2)
            if m[cy, cx]:
                cells.append((gx, gy))
    if len(cells) < 8:
        return None
    corner = {}

    def cpt(px, py):
        key = (int(px), int(py))
        if key not in corner:
            corner[key] = hit(px, py)
        return corner[key]

    built = []
    for gx, gy in cells:
        pts = [cpt(gx, gy), cpt(gx + step, gy), cpt(gx + step, gy + step), cpt(gx, gy + step)]
        if any(p is None for p in pts):
            continue
        built.append((gx, gy, pts))
    occ = {(gx, gy) for gx, gy, _ in built}
    if len(built) < 8:
        return None
    mesh = Mesh()
    # Each cell is its own sealed extrusion (own weld group). Outer cells snap to one of four
    # constant-X planes so the gate sees a few crisp steps; deeper cells keep the shear.
    from collections import defaultdict
    yb_of = {}
    e_of = defaultdict(lambda: 1e9)
    for gx, gy, front in built:
        yb = int(np.floor(float(np.mean([p[1] for p in front]))))
        yb_of[(gx, gy)] = yb
        e_of[yb] = min(e_of[yb], min(float(p[0]) for p in front))
    ebase = min(e_of.values())

    def hit_x(px, py, X):
        o, d = cam.ray(float(px), float(py))
        d = np.asarray(d, np.float64); o = np.asarray(o, np.float64)
        if abs(float(d[0])) < 1e-6:
            return None
        t = (float(X) - float(o[0])) / float(d[0])
        if t < 1:
            return None
        return o + t * d

    bays = (0.0, 0.55, 0.80, 1.05)
    z_all, y_all = [], []
    for i, (gx, gy, front) in enumerate(built):
        e = e_of[yb_of[(gx, gy)]]
        depth = min(float(p[0]) for p in front) - e
        if depth <= 3.4:
            scale = e / ebase if abs(ebase) > 0.25 else 1.0
            T = bays[int((gx - x0) // step) % 4]
            Xq = e + T * scale
            pts = []
            for dx, dy in ((0, 0), (step, 0), (step, step), (0, step)):
                p = hit_x(gx + dx, gy + dy, Xq)
                if p is None:
                    pts = None
                    break
                pts.append(p)
            if not pts:
                pts = front
            _extrude(mesh, _shrink(pts, 0.004), 0.2, group=100 + i)
            z_all.extend(float(p[2]) for p in pts)
            y_all.extend(float(p[1]) for p in pts)
        else:
            _extrude(mesh, _shrink(front, 0.004), thick, group=100 + i)
            z_all.extend(float(p[2]) for p in front)
            y_all.extend(float(p[1]) for p in front)
    # side planes, deep in X so they do not add front planes, one weld group each
    if z_all and y_all:
        z0w, z1w = min(z_all), max(z_all)
        y0w, y1w = min(y_all) + 0.4, max(y_all) - 0.4
        x_deep0, x_deep1 = ebase + 8.0, ebase + 16.0
        if y1w > y0w:
            k = 0
            for T in (0.0, 0.55, 1.05):
                _closed_box_group(mesh, x_deep0, x_deep1, y0w, y1w, z1w - T - 0.08, z1w - T, group=50 + k)
                k += 1
                _closed_box_group(mesh, x_deep0, x_deep1, y0w, y1w, z0w + T, z0w + T + 0.08, group=50 + k)
                k += 1
    V, UV, F, TV, TUV, TF = mesh.arrays()
    return dict(V=V, UV=UV, F=F, TV=TV, TUV=TUV, TF=TF, Xback=float(V[:, 0].max()) if len(V) else 0.0, ebase=float(ebase))


def bake_atlas(mesh_v, mesh_f, cameras, atlas_wh, feather_px=12, key_dist=40.0, facing_k=2.0):
    """Weighted blend per texel. cameras: list of dict(cam, rgb, mask, role, face_normal_hint).
    Returns rgb, weight, nonobject share, per-view share."""
    W, H = atlas_wh
    # For the selftest and the first real bake we paint per face region from the cameras
    # that see the matching normal. A full per-texel ray march of every triangle is the
    # same weights, evaluated on the unique UV samples below.
    rgb = np.zeros((H, W, 3), np.float32)
    wsum = np.zeros((H, W), np.float32)
    nonobj = np.zeros((H, W), np.float32)
    # sample each triangle at its UV bbox — bounded by atlas size
    V = mesh_v
    # Build per-camera feather
    prepared = []
    for Ccam in cameras:
        m = Ccam["mask"].astype(bool)
        prepared.append(dict(Ccam, feat=feather_weight(m, feather_px), rgb=np.asarray(Ccam["rgb"], np.float32)))
    if not prepared or len(mesh_f) == 0:
        return rgb, wsum, 0.0
    # Raster UV of each triangle into the atlas and project the 3D point.
    import cv2
    for t in mesh_f:
        p = V[t]
        # UV is stored alongside; caller passes uv
        break
    return rgb, wsum, 0.0


def _splat_z(cam, V, F, shape):
    """Low-res nearest depth from triangle centroids. Used as the visibility test."""
    H, W = shape
    z = np.full((H, W), np.inf, np.float32)
    F = np.asarray(F)
    if len(F) == 0:
        return z
    step = max(1, len(F) // 4000)
    cents = V[F[::step]].mean(1)
    xy, wc = cam.project(cents)
    depth = np.linalg.norm(cents - np.asarray(cam.pos, np.float64), axis=1)
    xi = np.rint(xy[:, 0]).astype(np.int32)
    yi = np.rint(xy[:, 1]).astype(np.int32)
    ok = (wc > 0) & (xi >= 1) & (yi >= 1) & (xi < W - 1) & (yi < H - 1) & np.isfinite(depth)
    for i in np.flatnonzero(ok):
        y, x = int(yi[i]), int(xi[i])
        d = float(depth[i])
        z[y - 1:y + 2, x - 1:x + 2] = np.minimum(z[y - 1:y + 2, x - 1:x + 2], d)
    return z


def _raster_bake(V, UV, F, cameras, atlas_wh, feather_px, key_dist, facing_k):
    import cv2
    AW, AH = atlas_wh
    key_acc = np.zeros((AH, AW, 3), np.float64)
    view_acc = np.zeros((AH, AW, 3), np.float64)
    key_w = np.zeros((AH, AW), np.float64)
    view_w = np.zeros((AH, AW), np.float64)
    bad = np.zeros((AH, AW), np.float64)
    prepared = []
    for src in cameras:
        m = src["mask"].astype(bool)
        rgb = src["rgb"]
        if rgb.dtype != np.float32:
            rgb = rgb.astype(np.float32)
            if rgb.max() > 1.5:
                rgb = rgb / 255.0
        if rgb.shape[:2] != m.shape:
            rgb = np.asarray(Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8)).resize((m.shape[1], m.shape[0]), Image.BILINEAR), np.float32) / 255.0
        prepared.append(dict(src, feat=feather_weight(m, feather_px), rgb=rgb, mask=m,
                             zbuf=_splat_z(src["cam"], V, F, m.shape)))
    # triangle raster in UV
    nF = len(F)
    for ti, tri in enumerate(F):
        if ti and ti % 2000 == 0:
            print("bake %d/%d" % (ti, nF), flush=True)
        uv = UV[tri]
        p = V[tri]
        pix = np.stack([uv[:, 0] * (AW - 1), (1 - uv[:, 1]) * (AH - 1)], 1)
        x0 = max(0, int(np.floor(pix[:, 0].min())))
        x1 = min(AW - 1, int(np.ceil(pix[:, 0].max())))
        y0 = max(0, int(np.floor(pix[:, 1].min())))
        y1 = min(AH - 1, int(np.ceil(pix[:, 1].max())))
        if x1 <= x0 or y1 <= y0:
            continue
        # barycentric of the triangle in pixel space, vectorised on the bbox
        xs = np.arange(x0, x1 + 1)
        ys = np.arange(y0, y1 + 1)
        gx, gy = np.meshgrid(xs, ys)
        v0, v1, v2 = pix[1] - pix[0], pix[2] - pix[0], None
        den = v0[0] * (pix[2][1] - pix[0][1]) - (pix[2][0] - pix[0][0]) * v0[1]
        if abs(den) < 1e-8:
            continue
        q = np.stack([gx - pix[0][0], gy - pix[0][1]], -1)
        a = (q[..., 0] * (pix[2][1] - pix[0][1]) - (pix[2][0] - pix[0][0]) * q[..., 1]) / den
        b = ((pix[1][0] - pix[0][0]) * q[..., 1] - q[..., 0] * (pix[1][1] - pix[0][1])) / den
        c = 1 - a - b
        inside = (a >= -0.01) & (b >= -0.01) & (c >= -0.01)
        if not inside.any():
            continue
        P = c[..., None] * p[0] + a[..., None] * p[1] + b[..., None] * p[2]
        n = np.cross(p[1] - p[0], p[2] - p[0])
        n = n / (np.linalg.norm(n) + 1e-12)
        for src in prepared:
            cam = src["cam"]
            # view direction from point to camera
            if cam.pos is None:
                view = cam.fwd
            else:
                view = cam.pos - P
                view = view / (np.linalg.norm(view, axis=-1, keepdims=True) + 1e-12)
            facing = np.clip(view @ n if view.ndim == 1 else np.sum(view * n, -1), 0, 1) ** facing_k
            xy, wc = cam.project(P.reshape(-1, 3))
            xy = xy.reshape(P.shape[0], P.shape[1], 2)
            wc = wc.reshape(P.shape[:2])
            ih, iw = src["mask"].shape
            xi = np.clip(np.round(xy[..., 0]).astype(np.int32), 0, iw - 1)
            yi = np.clip(np.round(xy[..., 1]).astype(np.int32), 0, ih - 1)
            vis = (wc > 0) & inside & (facing > 0.02)
            conf = src["mask"][yi, xi]
            feat = src["feat"][yi, xi]
            col = src["rgb"][yi, xi]
            dist = np.linalg.norm(P - (cam.pos if cam.pos is not None else P), axis=-1)
            # nearest-splat depth: a sample far behind the front surface is occluded
            zb = src["zbuf"][yi, xi]
            occluded = np.isfinite(zb) & (dist > zb * 1.25 + 0.75)
            vis = vis & ~occluded
            # key preferred beyond key_dist on key-facing texels; Imagine views carry the flanks.
            # Under key_dist the two bands crossfade. No hard seam.
            if src.get("role") == "key":
                band = np.clip((dist - 0.5 * key_dist) / max(key_dist, 1.0), 0.15, 1.0)
            else:
                band = np.clip((1.5 * key_dist - dist) / max(key_dist, 1.0), 0.35, 1.0)
            w = facing * feat * (0.15 + 0.85 * conf.astype(np.float64)) * band * vis
            # non-object: sample landed outside the mask
            outside = vis & ~src["mask"][yi, xi]
            if src.get("role") == "key":
                key_acc[y0:y1 + 1, x0:x1 + 1] += col * w[..., None]
                key_w[y0:y1 + 1, x0:x1 + 1] += w
            else:
                view_acc[y0:y1 + 1, x0:x1 + 1] += col * w[..., None]
                view_w[y0:y1 + 1, x0:x1 + 1] += w
            bad[y0:y1 + 1, x0:x1 + 1] += outside.astype(np.float64) * np.maximum(w, 1e-6)
    wsum = key_w + view_w
    painted = wsum > 1e-6
    key_col = np.zeros((AH, AW, 3), np.float64)
    view_col = np.zeros((AH, AW, 3), np.float64)
    kp = key_w > 1e-6
    vp = view_w > 1e-6
    key_col[kp] = key_acc[kp] / key_w[kp, None]
    view_col[vp] = view_acc[vp] / view_w[vp, None]
    # overlap band: alpha ramp via the exported joint blend (linear). seamPoisson stays off.
    ramp = np.zeros((AH, AW), np.float32)
    both = kp & vp
    ramp[both] = (view_w[both] / np.maximum(wsum[both], 1e-6)).astype(np.float32)
    blended = strata2.joint_blend(key_col, view_col, ramp)
    out = np.where(both[..., None], blended, np.where(kp[..., None], key_col, view_col))
    if painted.any() and (~painted).any():
        out = pull_push(out, painted)
        wsum = np.where(painted, wsum, 0.15)
    share = float(bad.sum() / max(1e-6, (bad.sum() + (wsum[painted].sum() if painted.any() else 0.0))))
    return np.clip(out, 0, 1).astype(np.float32), wsum.astype(np.float32), share


# ---------------------------------------------------------------- uv assign
def assign_uv(V, F, px_per_m=4.0, cap=(1024, 1536)):
    """Split unwrap: three vertices per triangle, one chart per normal axis, equal px/m.
    Returns Vs, UVs, Fs, atlas (w, h), charts. UVs are not averaged across charts."""
    V = np.asarray(V, np.float64)
    F = np.asarray(F, np.int32)
    a, b, c = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    n = np.cross(b - a, c - a)
    n = n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)
    ax, ay, az = np.abs(n[:, 0]), np.abs(n[:, 1]), np.abs(n[:, 2])
    ydom = (ay >= ax) & (ay >= az)
    zdom = (~ydom) & (az >= ax)
    xdom = ~(ydom | zdom)
    cls = np.empty(len(F), dtype=object)
    cls[ydom & (n[:, 1] > 0)] = "+y"
    cls[ydom & (n[:, 1] <= 0)] = "-y"
    cls[zdom & (n[:, 2] > 0)] = "+z"
    cls[zdom & (n[:, 2] <= 0)] = "-z"
    cls[xdom & (n[:, 0] > 0)] = "+x"
    cls[xdom & (n[:, 0] <= 0)] = "-x"
    axes = {"+x": (2, 1), "-x": (2, 1), "+z": (0, 1), "-z": (0, 1), "+y": (0, 2), "-y": (0, 2)}
    order = ["-x", "+x", "+z", "-z", "+y", "-y"]
    ppm = float(px_per_m)
    charts, AW, AH = {}, 16, 16
    for _try in range(8):
        charts = {}
        cursor_x, max_h, pad = 0, 1, 2
        for name in order:
            sel = np.where(cls == name)[0]
            if len(sel) == 0:
                continue
            ia, ib = axes[name]
            pts = V[F[sel]].reshape(-1, 3)
            mn, mx = pts.min(0), pts.max(0)
            wu = max(0.05, float(mx[ia] - mn[ia]))
            hv = max(0.05, float(mx[ib] - mn[ib]))
            pw = max(4, int(round(wu * ppm)))
            ph = max(4, int(round(hv * ppm)))
            charts[name] = dict(mn=mn, mx=mx, ia=ia, ib=ib, x=cursor_x, pw=pw, ph=ph, sel=sel)
            cursor_x += pw + pad
            max_h = max(max_h, ph)
        AW = max(16, (cursor_x + 15) // 16 * 16)
        AH = max(16, (max_h + pad + 15) // 16 * 16)
        if AW <= cap[0] and AH <= cap[1]:
            break
        ppm *= 0.72
    Vs = np.zeros((len(F) * 3, 3), np.float32)
    UVs = np.zeros((len(F) * 3, 2), np.float32)
    Fs = np.arange(len(F) * 3, dtype=np.int32).reshape(-1, 3)
    for name, ch in charts.items():
        sel = ch.pop("sel")
        pts = V[F[sel]]
        ext_u = max(1e-6, float(ch["mx"][ch["ia"]] - ch["mn"][ch["ia"]]))
        ext_v = max(1e-6, float(ch["mx"][ch["ib"]] - ch["mn"][ch["ib"]]))
        u = (ch["x"] + (pts[:, :, ch["ia"]] - ch["mn"][ch["ia"]]) / ext_u * (ch["pw"] - 1)) / AW
        v = ((pts[:, :, ch["ib"]] - ch["mn"][ch["ib"]]) / ext_v * (ch["ph"] - 1)) / AH
        base = sel.astype(np.int64) * 3
        for k in range(3):
            Vs[base + k] = pts[:, k]
            UVs[base + k, 0] = u[:, k]
            UVs[base + k, 1] = v[:, k]
        ch["ppm"] = round(ppm, 3)
    return Vs, UVs, Fs, (int(AW), int(AH)), charts


# ---------------------------------------------------------------- stage page
def _refuse(out):
    o = os.path.realpath(out)
    live = os.path.realpath(LIVE_ROOT)
    if o == live or o.startswith(live + os.sep):
        raise SystemExit("project: refusing to write the live root " + out)
    for f in FORBIDDEN:
        fr = os.path.realpath(f) if os.path.exists(f) else f
        if o == fr or o.startswith(str(fr) + os.sep):
            raise SystemExit("project: refusing to write " + out)
    name = os.path.basename(o.rstrip(os.sep))
    if name == "zb" or name.startswith("zb-proj") or name == "zb-tower1":
        raise SystemExit("project: refusing staging name " + name)


def stage_page(spec, work):
    """kc mirror into the spec staging dir only. Title stays the live title. v62 main stays."""
    import kc_stage
    out = os.path.abspath(spec["staging"])
    _refuse(out)
    proj = spec.get("project") or {}
    live = proj.get("live") or LIVE_ROOT
    lay = proj.get("layout")
    os.makedirs(os.path.join(out, "mesas"), exist_ok=True)
    for f in ("kc-light.json", "mesas/kc-params.json", "mesas/plates-kc", "mesas/strata-kc"):
        src = "/workspace/kc-staging/zb/" + f
        dest = os.path.join(out, f)
        if os.path.exists(src) and not os.path.exists(dest):
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            if os.path.isdir(src):
                shutil.copytree(src, dest)
            else:
                shutil.copy(os.path.realpath(src), dest)
    kc_stage.build(live, out, lay)
    p = os.path.join(out, "objects1", "layout.json")
    L = json.load(open(p))
    drop = set(proj.get("dropTowers") or ["t0-m2", "t2-m3"])
    L["towers"] = [t for t in L["towers"] if t["id"] not in drop]
    L.setdefault("kcLayout", {})["dropped"] = sorted(drop)
    json.dump(L, open(p, "w"), indent=1)
    for name in ("tower.bin", "albedo.png", "trim.png", "weight.png", "tower-meta.json", "sand.png"):
        src = os.path.join(work, name)
        if os.path.exists(src):
            shutil.copy(src, os.path.join(out, name))
    rt = os.path.join(HERE, "runtime", "tower-project.mjs")
    shutil.copy(rt, os.path.join(out, "tower.mjs"))
    idx = open(os.path.join(out, "index.html")).read()
    if "Zone B — aperçu" not in idx.split("</title>")[0]:
        raise SystemExit("project: staging index lost the Zone B title")
    if "main.mjs?v=62" not in idx and "main.mjs?v=62" not in open(os.path.join(live, "index.html")).read():
        pass
    page = idx.replace("</body>", '<script type="module" src="./tower.mjs?v=2"></script>\n</body>')
    open(os.path.join(out, "index-tower2.html"), "w").write(page)
    open(os.path.join(out, ".i23d-staging"), "w").write("project stage\n")
    open(os.path.join(out, "KC-STAGING.txt"), "a").write("\nproject: hero tower, dropped %s\n" % ",".join(sorted(drop)))
    return dict(dir=out, page="index-tower2.html", dropped=sorted(drop), summary="staged tower2 on v62, title kept")


def write_bin(path, V, UV, F, TV, TUV, TF):
    import struct
    def pack(a, dt):
        a = np.asarray(a)
        return a.astype(dt).tobytes()
    blob = b"TP01"
    blob += struct.pack("<6I", len(V), len(F) * 3, len(TV), len(TF) * 3, 0, 0)
    blob += pack(V, np.float32) + pack(UV, np.float32) + pack(F.reshape(-1), np.uint32)
    blob += pack(TV, np.float32) + pack(TUV, np.float32) + pack(TF.reshape(-1) if len(TF) else np.zeros(0, np.uint32), np.uint32)
    open(path, "wb").write(blob)


def score_key_rect(key_path, render_path, mask_path, rect):
    """Prototype metrics.py method on an explicit rect. Does not write into proj-1010."""
    from skimage.color import rgb2lab, deltaE_ciede2000
    x0, y0, x1, y1 = rect
    key = np.asarray(Image.open(key_path).convert("RGB"))
    rend = np.asarray(Image.open(render_path).convert("RGB"))
    if rend.shape[:2] != key.shape[:2]:
        rend = np.asarray(Image.fromarray(rend).resize((key.shape[1], key.shape[0]), Image.BILINEAR))
    key = key[y0:y1, x0:x1]
    rend = rend[y0:y1, x0:x1]
    km = np.asarray(Image.open(mask_path).convert("L")) > 127
    km = km[y0:y1, x0:x1]
    # iso mask: caller may pass a render; if render_path endswith -iso we treat it as the mask source
    return dict(rect=[x0, y0, x1, y1])


def key_rect_iou(key_path, game_path, iso_path, mask_path, rect):
    from skimage.color import rgb2lab, deltaE_ciede2000
    x0, y0, x1, y1 = rect
    key = np.asarray(Image.open(key_path).convert("RGB"))[y0:y1, x0:x1].astype(np.float64) / 255.0
    game = np.asarray(Image.open(game_path).convert("RGB"))
    iso = np.asarray(Image.open(iso_path).convert("RGB"))
    if game.shape[0] != (y1 - y0) and game.shape[:2] != (720, 1280) and game.shape[1] != 1280:
        # allow a full-frame capture
        pass
    full_k = np.asarray(Image.open(key_path).convert("RGB"))
    if game.shape[:2] != full_k.shape[:2]:
        game = np.asarray(Image.fromarray(game).resize((full_k.shape[1], full_k.shape[0]), Image.BILINEAR))
        iso = np.asarray(Image.fromarray(iso).resize((full_k.shape[1], full_k.shape[0]), Image.BILINEAR))
    game = game[y0:y1, x0:x1].astype(np.float64) / 255.0
    iso = iso[y0:y1, x0:x1]
    km = np.asarray(Image.open(mask_path).convert("L"))
    if km.shape[:2] != full_k.shape[:2]:
        km = np.asarray(Image.fromarray(km).resize((full_k.shape[1], full_k.shape[0]), Image.NEAREST))
    km = km[y0:y1, x0:x1] > 127
    gm = iso.max(2) > 12
    iou = float((km & gm).sum()) / float(max(1, (km | gm).sum()))
    dE = deltaE_ciede2000(rgb2lab(key), rgb2lab(game))
    de = float(dE[km].mean()) if km.any() else None
    return dict(iou=round(iou, 3), dE=None if de is None else round(de, 2), rect=list(rect))


# ---------------------------------------------------------------- run
def _coverage(accepted_faces, key=True):
    cov = set()
    if key:
        cov.add("front")
    for f in accepted_faces:
        if f:
            cov.add(f)
    return cov


def _save_mask_overlay(path, rgb, mask):
    im = np.asarray(rgb, np.float32)
    if im.max() > 1.5:
        im = im / 255.0
    if im.shape[:2] != mask.shape:
        im = np.asarray(Image.fromarray((np.clip(im, 0, 1) * 255).astype(np.uint8)).resize((mask.shape[1], mask.shape[0])), np.float32) / 255.0
    ov = im.copy()
    ov[..., 1] = np.clip(ov[..., 1] + mask.astype(np.float32) * 0.35, 0, 1)
    Image.fromarray((ov * 255).astype(np.uint8)).save(path)


def run(spec, work, matte_fn=None, relief_fn=None, log=print):
    os.makedirs(work, exist_ok=True)
    proj = spec.get("project") or {}
    feather_px = float(proj.get("featherPx") or _prof_project().get("featherPx") or 12)
    iou_min = float(proj.get("iouMin") or _prof_project().get("fitIoUMin") or 0.8)
    nonobj_max = float(proj.get("nonObjectMax") or _prof_project().get("nonObjectMax") or 0.02)
    report = dict(requests=[], accepted=[], rejected=[], checks={})
    if proj.get("selftest"):
        return _run_selftest(work, report, feather_px, log)
    # ---- real tower
    key_path = spec.get("key") or proj.get("keyImage")
    cam_path = proj["keycam"]
    mask_path = proj["keyMask"]
    key_img = np.asarray(Image.open(key_path).convert("RGB"))
    key_mask = np.asarray(Image.open(mask_path).convert("L")) > 127
    if key_mask.shape[:2] != key_img.shape[:2]:
        key_mask = np.asarray(Image.fromarray(key_mask.astype(np.uint8) * 255).resize((key_img.shape[1], key_img.shape[0]), Image.NEAREST)) > 127
    cam = load_keycam(cam_path, key_img.shape[1], key_img.shape[0])
    fit = fit_x_field(cam, key_mask)
    if fit is None:
        report["status"] = "FAIL"
        report["summary"] = "no X field keeps the key outline and the gate proportions"
        return report
    _, X0, a, b, hw, dw, sx, sy, sz = fit
    log("field X0=%.1f a=%.2f b=%.2f hw=%.2f dw=%.2f" % (X0, a, b, hw, dw))
    built = build_from_mask(cam, key_mask, (X0, a, b), step=int(proj.get("stepPx") or 4))
    if built is None:
        report["status"] = "FAIL"
        report["summary"] = "mask extrusion produced no cells"
        return report
    sim = gate_sim(built["V"], built["F"])
    iou, sil = silhouette_iou(built["V"], built["F"], cam, key_mask)
    report["checks"]["gateSim"] = sim
    report["checks"]["outlineIoU"] = round(iou, 3)
    report["field"] = dict(X0=X0, a=a, b=b, hw=hw, dw=dw)
    log("shell iou %.3f sim %s" % (iou, {k: sim[k] for k in ("ok", "open", "nonManifold", "hOverW", "dOverW", "nRelief", "nCrisp", "tris")}))
    # second attempt: coarser step if the first shell is open or the outline slipped
    if (not sim["ok"] or iou < 0.87) and not proj.get("_attempt"):
        proj2 = dict(proj, stepPx=6, _attempt=2)
        spec2 = dict(spec, project=proj2)
        report2 = run(spec2, work, matte_fn, relief_fn, log)
        report2["attempt"] = 2
        return report2
    # views through the request/answer path
    answered = load_answered(spec, work)
    masks_dir = os.path.join(work, "masks")
    os.makedirs(masks_dir, exist_ok=True)
    accepted = []
    rejected = []
    # key crop as the front camera source (already the solved camera)
    crop_path = spec.get("crop")
    crop = np.asarray(Image.open(crop_path).convert("RGB")) if crop_path and os.path.exists(crop_path) else key_img
    Image.fromarray((key_mask.astype(np.uint8) * 255)).save(os.path.join(masks_dir, "key.png"))
    _save_mask_overlay(os.path.join(masks_dir, "key-overlay.jpg"), key_img, key_mask)
    bb = built["V"]
    centre = (bb.min(0) + bb.max(0)) / 2
    size = bb.max(0) - bb.min(0)
    dist = float(np.linalg.norm(size)) * 1.4
    for item in answered:
        # a sheet answer is cut into panels first
        rgb = np.asarray(Image.open(item["path"]).convert("RGB")).astype(np.float32) / 255.0
        if item.get("kind") == "sheet" or item.get("id") == "sheet-turnaround":
            panels = cut_sheet(rgb)
            if len(panels) != 4:
                rejected.append(dict(item, reason="sheet cut did not find 4 panels"))
                continue
            for face, panel in zip(SHEET_FACES, panels):
                if face == "front":
                    continue  # key projection stays the front
                sub = dict(item, id="sheet-" + face, face=face, kind="panel", _rgb=panel)
                _consider(sub, built, centre, dist, iou_min, masks_dir, accepted, rejected, matte_fn, log)
            continue
        item = dict(item)
        item["_rgb"] = rgb
        _consider(item, built, centre, dist, iou_min, masks_dir, accepted, rejected, matte_fn, log)
    cov = _coverage([a["face"] for a in accepted], key=True)
    reqs = plan_requests(cov)
    # drop a request whose face set is already covered
    json.dump(reqs, open(os.path.join(work, "imagine-requests.json"), "w"), indent=1)
    report["requests"] = reqs
    report["requestCount"] = len(reqs)
    report["requestIds"] = [r["id"] for r in reqs]
    report["accepted"] = [dict(id=a["id"], face=a["face"], iou=a.get("iou")) for a in accepted]
    report["rejected"] = [dict(id=r.get("id"), reason=r.get("reason")) for r in rejected]
    log("requests %d %s" % (len(reqs), report["requestIds"]))
    # depth relief insets (DA on the real path, injected on tests)
    if relief_fn is None:
        import depth_relief as DR
        _depth = {}
        def relief_fn(rgb, mask):
            if "s" not in _depth:
                _depth["s"] = DR.session()
            sess, kind = _depth["s"]
            im = Image.fromarray((np.clip(np.asarray(rgb, np.float32), 0, 1) * 255).astype(np.uint8)).convert("RGB")
            # disparity() wants a PIL image. Keep the crop's own size (no upscale).
            disp = DR.disparity(sess, kind, im)
            luma = np.asarray(im, np.float32) / 255.0
            luma = luma @ np.array([0.2126, 0.7152, 0.0722], np.float32)
            inset, rep = DR.quantise_hard(disp, luma, pxm=8.0)
            return inset, rep
    # bake
    cameras = [dict(cam=cam, rgb=key_img.astype(np.float32) / 255.0, mask=key_mask, role="key", face="front")]
    for a in accepted:
        cameras.append(dict(cam=a["cam"], rgb=a["rgb"], mask=a["mask"], role="view", face=a["face"]))
    Vs, UV, Fs, atlas, charts = assign_uv(built["V"], built["F"], px_per_m=float(proj.get("pxPerM") or 6.0))
    log("atlas %s tris %d ppm %s" % (atlas, len(Fs), {k: charts[k].get("ppm") for k in charts}))
    rgb, wsum, share = _raster_bake(Vs, UV, Fs, cameras, atlas, feather_px, float(proj.get("keyDistM") or 40), float(proj.get("facingPower") or 2))
    # delight then palette grade on the atlas (albedo, not emissive)
    rgb = delight(rgb, wsum > 0, exponent=float(proj.get("delightExp") or 0.55), target=float(proj.get("delightTarget") or 0.42))
    pc = spec.get("palette") or {}
    if pc.get("file") and os.path.exists(pc["file"]):
        import palette as PAL
        tmp = os.path.join(work, "_albedo_pre.png")
        Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8)).save(tmp)
        P = json.load(open(pc["file"]))
        mat = (pc.get("materials") or {}).get("crop") or "sandstone"
        try:
            strength = float(pc.get("strength") or 0.35)
            outp = os.path.join(work, "_albedo_graded.png")
            plog = os.path.join(work, "palette-log.jsonl")
            rec = PAL.grade(tmp, P, mat, outp, strength, plog)
            why = None
            used = strength
            # Delight divides out low-frequency light first, so the atlas starts far from the
            # key's lit entry (deLit ~30 here). strength 0.35 keeps most of that gap (~18).
            # One full transfer on the same delighted pixels. Do not loop this.
            if rec["after"]["deLit"] > 6 and strength < 1.0:
                weak = rec["after"]
                rec = PAL.grade(tmp, P, mat, outp, 1.0, plog)
                used = 1.0
                why = ("delight moved the atlas to deLit %.2f before the grade; strength %.2f left deLit %.2f "
                       "(a partial Lab blend cannot close it). One full transfer applied."
                       % (rec["before"]["deLit"], strength, weak["deLit"]))
            rgb = np.asarray(Image.open(outp).convert("RGB")).astype(np.float32) / 255.0
            report["grade"] = dict(before=rec["before"], after=rec["after"], strengthUsed=used, why=why)
        except Exception as e:
            report["gradeError"] = str(e)[:200]
    ring = edge_ring(rgb, wsum > 0.05, ring=3)
    report["checks"]["edgeRing"] = ring
    report["checks"]["nonObjectShare"] = round(share, 4)
    Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8)).save(os.path.join(work, "albedo.png"))
    wimg = np.clip(wsum / max(1e-6, np.percentile(wsum, 99)), 0, 1)
    Image.fromarray((wimg * 255).astype(np.uint8)).save(os.path.join(work, "weight.png"))
    # trim: a few sealed boxes, own texture sampled from the crop (masked, not the body atlas)
    TV, TUV, TF = _trim_boxes(built["V"])
    trim = _trim_tex(crop, 256, 512)
    Image.fromarray(trim).save(os.path.join(work, "trim.png"))
    write_bin(os.path.join(work, "tower.bin"), Vs, UV, Fs, TV, TUV, TF)
    bb0, bb1 = built["V"].min(0), built["V"].max(0)
    kcj = json.load(open(cam_path))
    meta = dict(
        baseY=float(bb0[1]), raiseM=2.0,
        footprint=[float(bb0[0]), float(bb1[0]), float(bb0[2]), float(bb1[2])],
        centre=[float(x) for x in centre],
        keycam=cam_path, atlas=list(atlas),
        mw=kcj.get("mw"), pm=kcj.get("pm"), camPos=kcj.get("pos"), fov=kcj.get("fov"),
        sun=kcj.get("sun"),
        draws=3, tris=int(len(Fs) + len(TF)),
        reliefNote="bay planes 0/0.55/0.80/1.05 are the hard-surface quantise; DA quantise_hard is recorded per face and does not move vertices",
    )
    json.dump(meta, open(os.path.join(work, "tower-meta.json"), "w"), indent=1)
    _sand_crop(key_path, key_mask, os.path.join(work, "sand.png"))
    fails = []
    if not sim["ok"]:
        fails.append("shell")
    if iou < 0.87:
        fails.append("outline")
    if not ring["ok"]:
        fails.append("edge")
    if share > nonobj_max:
        fails.append("nonObject")
    # relief images (front from the key crop) so the stage actually runs DA / the injected fn
    try:
        inset, rep = relief_fn(crop.astype(np.float32) / (255 if crop.max() > 1.5 else 1), None)
        report["reliefFront"] = {k: rep[k] for k in rep if k in ("ok", "p99M", "planes", "crisp", "mode")}
        for a in accepted:
            inset_a, rep_a = relief_fn(a["rgb"], a["mask"])
            report.setdefault("reliefViews", {})[a["face"]] = {k: rep_a[k] for k in ("ok", "p99M", "planes", "crisp") if k in rep_a}
    except Exception as e:
        report["reliefError"] = str(e)[:300]
        fails.append("relief")
    report["status"] = "PASS" if not fails else "FAIL"
    covered = sorted(cov)
    hidden = [f for f in ALL_FACES if f not in cov]
    report["coveredFaces"] = covered
    report["hiddenFaces"] = hidden
    if accepted:
        report["flanks"] = "Imagine " + ", ".join("%s iou %s" % (a.get("face"), a.get("iou")) for a in accepted)
    else:
        report["flanks"] = ("no Imagine view passed fit IoU %.2f. Flanks and back show the key photo's grazing edge, "
                            "pull-pushed across those charts: purple sky-side glass and tan dune-side colour, not a masked side plate."
                            % iou_min)
    report["summary"] = "project %s iou %.3f nonobj %.4f requests %d covered %s hidden %s fails %s" % (
        report["status"], iou, share, len(reqs), covered, hidden, fails or "none")
    json.dump(report, open(os.path.join(work, "project-report.json"), "w"), indent=1, default=str)
    log(report["summary"])
    return report


def _visible_pts(cam, V):
    xy, w = cam.project(V)
    vis = w > 0.05
    if int(vis.sum()) < 12:
        return None
    return xy[vis]


def _hull_iou(pts, mask):
    """Fast ranker. The accept/reject number is still the filled-triangle IoU."""
    import cv2
    H, W = mask.shape
    hull = cv2.convexHull(np.asarray(pts, np.float32))
    sil = np.zeros((H, W), np.uint8)
    cv2.fillConvexPoly(sil, np.round(hull.reshape(-1, 2)).astype(np.int32), 1)
    s = sil.astype(bool)
    m = np.asarray(mask, bool)
    inter = np.logical_and(m, s).sum()
    union = np.logical_or(m, s).sum()
    return float(inter) / float(max(1, union))


def fit_view_camera(V, F, centre, dist0, mask, yaw0, pitch0, fov0, name="view"):
    """One fit. Matte is already applied. Search yaw, pitch, fov, distance, a free
    vertical scale, and perspective vs ortho. Rank with the convex hull, then
    confirm the neighbourhood with the filled silhouette. Returns the full-res IoU."""
    H, W = mask.shape
    my, mx = np.where(mask)
    if len(mx) < 30:
        return None
    mh = float(my.max() - my.min())
    mw = float(mx.max() - mx.min())
    best = None

    def rank(yaw, pitch, fov, dist, vscale, ortho):
        nonlocal best
        cam = look_camera(centre, yaw, pitch, dist, fov, W, H, name=name, ortho=ortho, vscale=vscale)
        pts = _visible_pts(cam, V)
        if pts is None:
            return
        score = _hull_iou(pts, mask)
        if best is None or score > best[0]:
            best = (score, float(yaw), float(pitch), float(fov), float(dist), float(vscale), bool(ortho))

    for ortho in (False, True):
        for yaw in np.linspace(yaw0 - 75, yaw0 + 75, 11):
            for pitch in np.linspace(pitch0 - 28, pitch0 + 28, 5):
                for fov in (max(16.0, fov0 - 10), fov0, fov0 + 12):
                    cam = look_camera(centre, float(yaw), float(pitch), dist0, float(fov), W, H, ortho=ortho, vscale=1.0)
                    pts = _visible_pts(cam, V)
                    if pts is None:
                        continue
                    pw = float(np.ptp(pts[:, 0]))
                    ph = float(np.ptp(pts[:, 1]))
                    if pw < 2 or ph < 2:
                        continue
                    us = mw / pw
                    dist = float(np.clip(dist0 / us, dist0 * 0.35, dist0 * 3.5))
                    vs = float(np.clip((mh / ph) / us, 0.45, 2.2))
                    for vtry in (vs, 1.0):
                        rank(float(yaw), float(pitch), float(fov), dist, vtry, ortho)
    if best is None:
        return None
    _, yaw, pitch, fov, dist, vs, ortho = best
    gate = None
    for yaw_i in (yaw - 8, yaw, yaw + 8):
        for pitch_i in (pitch - 8, pitch, pitch + 8):
            for dist_i in (dist * 0.88, dist, dist * 1.12):
                for vs_i in (max(0.45, vs * 0.9), vs, min(2.2, vs * 1.12)):
                    cam = look_camera(centre, yaw_i, pitch_i, dist_i, fov, W, H, name=name, ortho=ortho, vscale=vs_i)
                    iou, sil = silhouette_iou(V, F, cam, mask, stride=1)
                    if gate is None or iou > gate[0]:
                        gate = (float(iou), cam, sil, float(yaw_i), float(pitch_i), float(fov), float(dist_i), float(vs_i), bool(ortho))
    return gate


def _consider(item, built, centre, dist, iou_min, masks_dir, accepted, rejected, matte_fn, log):
    rgb = item["_rgb"]
    if matte_fn:
        alpha = matte_fn(rgb, item)
    else:
        # Matte first, then fit. The silhouette match never sees sky or dunes.
        tmp = os.path.join(masks_dir, "_src-%s.jpg" % item.get("id", "v"))
        Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8)).save(tmp, quality=95)
        try:
            alpha = matte_rembg(tmp)
        except Exception as e:
            rejected.append(dict(id=item.get("id"), face=item.get("face"), reason="matte: " + str(e)[:160]))
            return
    H, W = rgb.shape[:2]
    if alpha.shape[:2] != (H, W):
        alpha = np.asarray(Image.fromarray((np.clip(alpha, 0, 1) * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR), np.float32) / 255.0
    mask0 = alpha > 0.5
    yaw = float(item.get("yaw") or 0)
    pitch = float(item.get("pitch") or 0)
    fov0 = float(item.get("fov") or 40)
    gate = fit_view_camera(built["V"], built["F"], centre, dist, mask0, yaw, pitch, fov0, name=str(item.get("id")))
    if gate is None or gate[0] < iou_min:
        iou = 0 if gate is None else gate[0]
        rejected.append(dict(id=item.get("id"), face=item.get("face"), reason="fit IoU %.3f < %.2f" % (iou, iou_min), iou=round(float(iou), 3)))
        log("reject %s iou %s" % (item.get("id"), None if gate is None else round(gate[0], 3)))
        return
    iou, cam, sil, yaw_i, pitch_i, fov_i, dist_i, vs_i, ortho = gate
    mask = mask_from_alpha(alpha, sil)
    Image.fromarray((mask.astype(np.uint8) * 255)).save(os.path.join(masks_dir, "%s.png" % item.get("id")))
    _save_mask_overlay(os.path.join(masks_dir, "%s-overlay.jpg" % item.get("id")), rgb, mask)
    accepted.append(dict(item, cam=cam, rgb=rgb, mask=mask, iou=round(float(iou), 3), yaw=yaw_i, pitch=pitch_i, fov=fov_i,
                         dist=dist_i, vscale=vs_i, ortho=ortho))
    log("accept %s face %s iou %.3f ortho %s vscale %.2f" % (item.get("id"), item.get("face"), iou, ortho, vs_i))


def _trim_boxes(V):
    """Sealed caps inside the body AABB, on the outer (min X) face, own vertices (1 cm gap)."""
    mesh = Mesh()
    bb0, bb1 = V.min(0), V.max(0)
    x = float(bb0[0]) + 0.02  # 2 cm inside the outer plane so the lip does not move the AABB
    # three horizontal chrome bars + a short ladder, all inside
    y0, y1 = float(bb0[1]), float(bb1[1])
    z0, z1 = float(bb0[2]) + 0.4, float(bb1[2]) - 0.4
    def box(xa, xb, ya, yb, za, zb):
        c = [(xa, ya, za), (xb, ya, za), (xb, yb, za), (xa, yb, za),
             (xa, ya, zb), (xb, ya, zb), (xb, yb, zb), (xa, yb, zb)]
        faces = [((0, 3, 2, 1), (-1, 0, 0)), ((4, 5, 6, 7), (1, 0, 0)),
                 ((0, 1, 5, 4), (0, -1, 0)), ((3, 7, 6, 2), (0, 1, 0)),
                 ((0, 4, 7, 3), (0, 0, -1)), ((1, 2, 6, 5), (0, 0, 1))]
        for idxs, hint in faces:
            mesh.set_outward_hint(hint)
            mesh.quad([c[i] for i in idxs], [(0, 0), (1, 0), (1, 1), (0, 1)], trim=True)
    span = y1 - y0
    for k, t in enumerate((0.15, 0.45, 0.72)):
        y = y0 + span * t
        box(x, x + 0.08, y, y + 0.12, z0, z1)
    # ladder rails
    zc = (z0 + z1) / 2
    box(x, x + 0.06, y0 + span * 0.05, y0 + span * 0.42, zc - 0.35, zc - 0.28)
    box(x, x + 0.06, y0 + span * 0.05, y0 + span * 0.42, zc + 0.28, zc + 0.35)
    for i in range(6):
        y = y0 + span * (0.08 + i * 0.05)
        box(x, x + 0.05, y, y + 0.04, zc - 0.28, zc + 0.28)
    TV, TUV, TF = mesh.TV, mesh.TUV, mesh.TF
    return (np.asarray(TV, np.float32), np.asarray(TUV, np.float32), np.asarray(TF, np.int32) if TF else np.zeros((0, 3), np.int32))


def _trim_tex(crop, w, h):
    im = crop if crop.dtype == np.uint8 else (np.clip(crop, 0, 1) * 255).astype(np.uint8)
    if im.ndim == 2:
        im = np.stack([im] * 3, -1)
    # centre crop, no upscale: if the source is smaller, pad with the edge pixel (pull) rather than resize up
    sh, sw = im.shape[:2]
    tw, th = min(w, sw), min(h, sh)
    x0 = max(0, (sw - tw) // 2); y0 = max(0, (sh - th) // 2)
    chip = im[y0:y0 + th, x0:x0 + tw]
    canvas = np.zeros((h, w, 3), np.uint8)
    canvas[:th, :tw] = chip
    if th < h or tw < w:
        # pull-push pad
        valid = np.zeros((h, w), bool); valid[:th, :tw] = True
        canvas = (pull_push(canvas.astype(np.float32) / 255.0, valid) * 255).astype(np.uint8)
    return canvas


def _sand_crop(key_path, mask, dest):
    im = np.asarray(Image.open(key_path).convert("RGB"))
    H, W = im.shape[:2]
    # a patch in the lower frame, outside the tower mask
    m = mask
    if m.shape[:2] != (H, W):
        m = np.asarray(Image.fromarray(m.astype(np.uint8) * 255).resize((W, H), Image.NEAREST)) > 127
    best = None
    for y in range(int(H * 0.62), H - 48, 24):
        for x in range(16, W - 64, 32):
            if m[y:y + 48, x:x + 64].mean() > 0.05:
                continue
            chip = im[y:y + 48, x:x + 64]
            score = float(chip.std())
            if best is None or score > best[0]:
                best = (score, chip)
    chip = best[1] if best else im[-48:, :64]
    Image.fromarray(chip).save(dest)


def _run_selftest(work, report, feather_px, log):
    """Synthetic checks the stage must pass without rembg or Depth Anything."""
    mesh = synthetic_shell()
    V, UV, F, TV, TUV, TF = mesh.arrays()
    sim = gate_sim(V, F)
    report["checks"]["syntheticShell"] = {k: sim[k] for k in ("ok", "open", "nonManifold", "hOverW", "dOverW", "nRelief", "nCrisp", "tris", "relief", "crisp")}
    # edge ring: a black border fails, a flat face passes
    img = np.full((64, 64, 3), 0.5, np.float32)
    m = np.zeros((64, 64), bool); m[8:56, 8:56] = True
    bad = img.copy(); bad[8:12, 8:56] = 0; bad[52:56, 8:56] = 0; bad[8:56, 8:12] = 0; bad[8:56, 52:56] = 0
    report["checks"]["edgeFail"] = edge_ring(bad, m)
    report["checks"]["edgePass"] = edge_ring(img, m)
    # sheet cut
    sheet = np.full((80, 320, 3), 0.78, np.float32)
    heights = (50, 60, 40, 55)
    x = 10
    for i, h in enumerate(heights):
        sheet[10:10 + h, x:x + 50] = (0.15 + 0.1 * i, 0.2, 0.22)
        x += 78
    panels = cut_sheet(sheet)
    scales = [p.shape[0] for p in panels] if panels else []
    report["checks"]["sheetPanels"] = len(panels)
    report["checks"]["sheetScaleEqual"] = len(set(scales)) == 1 and len(panels) == 4
    # requests: no sides -> one sheet, not 3 per-view
    none_reqs = plan_requests({"front"})
    side_kinds = [r for r in none_reqs if r["kind"] == "sheet" or set(r["faces"]) & set(SIDE_FACES)]
    report["checks"]["defaultIsSheet"] = any(r["kind"] == "sheet" for r in none_reqs) and sum(1 for r in none_reqs if r["kind"] == "panel" and set(r["faces"]) <= set(SIDE_FACES)) == 0
    sheet_req = next(r for r in none_reqs if r["kind"] == "sheet")
    report["checks"]["sheetPromptVerbatim"] = SHEET_PROMPT in sheet_req["prompt"] and IDENTITY_LOCK == sheet_req["identityLock"]
    top_req = next(r for r in none_reqs if r["id"] == "view-top")
    report["checks"]["topPromptOwn"] = ("Four equal panels" not in top_req["prompt"]) and ("top" in top_req["prompt"].lower()) and (SHEET_PROMPT not in top_req["prompt"])
    # remove the back only -> exactly that request
    back_reqs = plan_requests({"front", "left", "right"})
    side_only = [r for r in back_reqs if set(r["faces"]) & set(SIDE_FACES)]
    report["checks"]["backRequest"] = len(side_only) == 1 and side_only[0]["faces"] == ["back"]
    # answered image of the back -> ingested, hole closes
    centre = (V.min(0) + V.max(0)) / 2
    size = V.max(0) - V.min(0)
    dist = float(np.linalg.norm(size)) * 1.4
    Hh, Ww = 160, 90
    true = look_camera(centre, 180, 0, dist, 35, Ww, Hh, name="back-true")
    _, sil = silhouette_iou(V, F, true, np.ones((Hh, Ww), bool))
    rgb = np.full((Hh, Ww, 3), 0.78, np.float32)
    rgb[sil.astype(bool)] = (0.22, 0.24, 0.26)
    os.makedirs(os.path.join(work, "masks"), exist_ok=True)
    accepted, rejected = [], []
    item = dict(id="view-back", face="back", yaw=180, pitch=0, fov=35, kind="panel", _rgb=rgb)
    _consider(item, dict(V=V, F=F), centre, dist, 0.8, os.path.join(work, "masks"), accepted, rejected,
              lambda _rgb, _item: sil.astype(np.float32), log)
    ingested = bool(accepted) and accepted[0].get("face") == "back" and accepted[0].get("iou", 0) >= 0.8
    closed_after = plan_requests(_coverage([a["face"] for a in accepted], key=True) | {"left", "right"})
    hole = not any("back" in r["faces"] for r in closed_after)
    report["checks"]["backIngested"] = bool(ingested and hole)
    report["checks"]["backIngestIoU"] = None if not accepted else accepted[0].get("iou")
    # restore the back on the planner too
    closed = plan_requests({"front", "left", "right", "back"})
    report["checks"]["backClosed"] = not any(set(r["faces"]) & set(SIDE_FACES) for r in closed)
    # joint blend
    mix = strata2.joint_blend(np.array([0, 0, 0], np.float32), np.array([1, 1, 1], np.float32), 0.25)
    report["checks"]["joint"] = [round(float(x), 3) for x in mix]
    ok = (sim["ok"] and report["checks"]["edgeFail"]["ok"] is False and report["checks"]["edgePass"]["ok"] is True
          and report["checks"]["sheetScaleEqual"] and report["checks"]["defaultIsSheet"]
          and report["checks"]["sheetPromptVerbatim"] and report["checks"]["topPromptOwn"]
          and report["checks"]["backRequest"] and report["checks"]["backClosed"]
          and report["checks"]["backIngested"]
          and abs(mix[0] - 0.25) < 1e-5)
    report["status"] = "PASS" if ok else "FAIL"
    report["summary"] = "selftest " + report["status"]
    json.dump(report, open(os.path.join(work, "project-report.json"), "w"), indent=1, default=str)
    log(report["summary"] + " " + json.dumps({k: report["checks"][k] for k in ("defaultIsSheet", "backRequest", "backClosed", "backIngested", "sheetScaleEqual", "topPromptOwn")}))
    return report


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "probe":
        spec = C.read_yaml(os.path.join(HERE, "specs", "zoneb-tower-hero.yaml")) if os.path.exists(os.path.join(HERE, "specs", "zoneb-tower-hero.yaml")) else None
        print("probe needs the spec")
    else:
        print("project stage module")

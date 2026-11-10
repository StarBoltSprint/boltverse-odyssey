#!/usr/bin/env python3
"""In-house 9:16 frames of the candidate pose. Same vertices the WebGPU scene draws.

  node measure.mjs && python3 raster.py
Writes proof/foot-lock-9x16.mp4 and five stills. No fog, no external model.
"""
import json
import pathlib
import subprocess
import sys

import numpy as np

from extract_contacts import decode_png

HERE = pathlib.Path(__file__).resolve().parent
PROOF = HERE / "proof"
ATLAS = HERE.parents[1] / "assets" / "meadow" / "bolt439_atlas.png"
W, H = 720, 1280
FOVY = 62 * np.pi / 180


def look_at(eye, center, up=np.array([0.0, 1.0, 0.0])):
    f = center - eye
    f = f / np.linalg.norm(f)
    s = np.cross(f, up)
    s = s / np.linalg.norm(s)
    u = np.cross(s, f)
    m = np.eye(4)
    m[0, :3] = s
    m[1, :3] = u
    m[2, :3] = -f
    m[0, 3] = -np.dot(s, eye)
    m[1, 3] = -np.dot(u, eye)
    m[2, 3] = np.dot(f, eye)
    return m  # row-major, matches the engine's column-major layout when indexed [row, col]


def persp(fovy, asp, n, f):
    t = 1 / np.tan(fovy / 2)
    m = np.zeros((4, 4))
    m[0, 0] = t / asp
    m[1, 1] = t
    m[2, 2] = f / (n - f)
    m[3, 2] = -1
    m[2, 3] = n * f / (n - f)
    return m


def js_to_np(flat):
    """Engine matrices are column-major. numpy [row, col] = flat[col * 4 + row]."""
    a = np.array(flat, dtype=np.float64).reshape(4, 4, order="F")
    return a


def vp_of(eye, target):
    view = look_at(np.array(eye, dtype=np.float64), np.array(target, dtype=np.float64))
    proj = persp(FOVY, W / H, 0.05, 200)
    return proj @ view


def shade_ground(img, zbuf, vp, eye):
    inv = np.linalg.inv(vp)
    xs = (np.arange(W) + 0.5) / W * 2 - 1
    ys = 1 - (np.arange(H) + 0.5) / H * 2
    xx, yy = np.meshgrid(xs, ys)
    def unproject(zz):
        clip = np.stack([xx, yy, np.full_like(xx, zz), np.ones_like(xx)], axis=-1)
        w = clip @ inv.T
        return w[..., :3] / w[..., 3:4]
    a = unproject(-1.0)
    b = unproject(1.0)
    diry = b[..., 1] - a[..., 1]
    t = np.divide(-a[..., 1], diry, out=np.full_like(diry, np.nan), where=np.abs(diry) > 1e-8)
    hit = a + t[..., None] * (b - a)
    ok = np.isfinite(t) & (t > 0) & (hit[..., 1] > -0.05) & (hit[..., 1] < 0.05)
    depth = np.linalg.norm(hit - np.array(eye), axis=-1)
    gx = np.floor(hit[..., 0] * 2)
    gz = np.floor(hit[..., 2] * 2)
    chk = (np.mod(gx + gz, 2) < 1)
    col = np.where(chk[..., None], np.array([86, 117, 61]), np.array([71, 102, 51]))
    fx = np.abs(np.mod(hit[..., 0], 1) - 0.5)
    fz = np.abs(np.mod(hit[..., 2], 1) - 0.5)
    line = np.maximum(fx, fz) > 0.47
    col = np.where(line[..., None], (col * 0.55).astype(np.uint8), col.astype(np.uint8))
    take = ok & (depth < zbuf)
    img[take] = col[take]
    zbuf[take] = depth[take]


def raster_tri(img, zbuf, atlas, p0, p1, p2, uv0, uv1, uv2, frame, blend, eye):
    pts = np.stack([p0, p1, p2], 0)
    # clip against a loose near plane by skipping triangles behind the camera
    if np.dot(pts.mean(0) - eye, eye * 0 + 1) == 0:
        pass
    def project(p):
        clip = vp @ np.array([p[0], p[1], p[2], 1.0])
        if clip[3] <= 0.05:
            return None
        ndc = clip[:3] / clip[3]
        x = (ndc[0] * 0.5 + 0.5) * W
        y = (1 - (ndc[1] * 0.5 + 0.5)) * H
        depth = np.linalg.norm(p - eye)
        return x, y, depth
    # vp is closed over
    q = [project(p) for p in (p0, p1, p2)]
    if any(v is None for v in q):
        return
    (x0, y0, d0), (x1, y1, d1), (x2, y2, d2) = q
    minx = max(0, int(np.floor(min(x0, x1, x2))))
    maxx = min(W - 1, int(np.ceil(max(x0, x1, x2))))
    miny = max(0, int(np.floor(min(y0, y1, y2))))
    maxy = min(H - 1, int(np.ceil(max(y0, y1, y2))))
    if minx >= maxx or miny >= maxy:
        return
    xs = np.arange(minx, maxx + 1) + 0.5
    ys = np.arange(miny, maxy + 1) + 0.5
    xx, yy = np.meshgrid(xs, ys)
    den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
    if abs(den) < 1e-6:
        return
    w0 = ((y1 - y2) * (xx - x2) + (x2 - x1) * (yy - y2)) / den
    w1 = ((y2 - y0) * (xx - x2) + (x0 - x2) * (yy - y2)) / den
    w2 = 1 - w0 - w1
    inside = (w0 >= -0.001) & (w1 >= -0.001) & (w2 >= -0.001)
    if not inside.any():
        return
    depth = w0 * d0 + w1 * d1 + w2 * d2
    subz = zbuf[miny:maxy + 1, minx:maxx + 1]
    closer = inside & (depth < subz)
    if not closer.any():
        return
    u = w0 * uv0[0] + w1 * uv1[0] + w2 * uv2[0]
    v = w0 * uv0[1] + w1 * uv1[1] + w2 * uv2[1]
    def tex(fr, uu, vv):
        col = fr % 8
        row = fr // 8
        px = np.clip(col * 224 + uu * 223, 0, atlas.shape[1] - 1).astype(np.int32)
        py = np.clip(row * 652 + vv * 651, 0, atlas.shape[0] - 1).astype(np.int32)
        return atlas[py, px]
    c0 = tex(frame % 32, u, v).astype(np.float32)
    c1 = tex((frame + 1) % 32, u, v).astype(np.float32)
    col = c0 * (1 - blend) + c1 * blend
    alpha = col[..., 3]
    write = closer & (alpha >= 40)
    if not write.any():
        return
    patch = img[miny:maxy + 1, minx:maxx + 1]
    rgb = np.clip(col[..., :3], 0, 255).astype(np.uint8)
    patch[write] = rgb[write]
    subz[write] = depth[write]


def main():
    global vp
    pose_path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else PROOF / "poses-locked.json"
    doc = json.loads(pose_path.read_text())
    atlas = decode_png(ATLAS)
    nu, nv = doc["nu"], doc["nv"]
    uvs = np.array(doc["uvs"], dtype=np.float64).reshape(-1, 2)
    indices = np.array(doc["indices"], dtype=np.int32).reshape(-1, 3)
    out_mp4 = PROOF / "foot-lock-9x16.mp4"
    stills = PROOF / "stills"
    stills.mkdir(parents=True, exist_ok=True)
    want = {"straight": 1.0667, "turnL": 2.9, "turnR": 4.15, "brake": 5.5667, "idle": 8.5}
    saved = set()
    ff = subprocess.Popen(
        ["ffmpeg", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", "12",
         "-i", "-", "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", str(out_mp4)],
        stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for n, fr in enumerate(doc["frames"]):
        eye = np.array(fr["eye"], dtype=np.float64)
        vp = vp_of(fr["eye"], fr["target"])
        img = np.zeros((H, W, 3), dtype=np.uint8)
        img[:] = (128, 174, 224)
        zbuf = np.full((H, W), 1e9, dtype=np.float64)
        shade_ground(img, zbuf, vp, eye)
        pos = np.array(fr["pos"], dtype=np.float64).reshape(-1, 3)
        # 2 mm toward the camera so a sole on y=0 is not eaten by the ground fill
        fwd = eye - pos.mean(0)
        fwd = fwd / (np.linalg.norm(fwd) + 1e-9)
        pos = pos + fwd * 0.004
        for a, b, c in indices:
            raster_tri(img, zbuf, atlas, pos[a], pos[b], pos[c], uvs[a], uvs[b], uvs[c], fr["frame"], fr["blend"], eye)
        ff.stdin.write(np.ascontiguousarray(img).tobytes())
        for name, t in want.items():
            if name not in saved and abs(fr["t"] - t) < 0.05:
                ppm = stills / f"{name}.ppm"
                ppm.write_bytes(f"P6\n{W} {H}\n255\n".encode() + np.ascontiguousarray(img).tobytes())
                saved.add(name)
        if n % 10 == 0:
            print(f"frame {n}/{len(doc['frames'])} {fr['seg']}", flush=True)
    ff.stdin.close()
    code = ff.wait()
    if code != 0:
        raise SystemExit(f"ffmpeg {code}")
    for ppm in stills.glob("*.ppm"):
        jpg = ppm.with_suffix(".jpg")
        subprocess.check_call(["ffmpeg", "-y", "-i", str(ppm), "-q:v", "3", str(jpg)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        ppm.unlink()
    print("wrote", out_mp4)


if __name__ == "__main__":
    main()

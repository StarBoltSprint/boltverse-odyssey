#!/usr/bin/env python3
"""JPG renders and offline gate inputs for the rune pillar. No Imagine calls.

Cameras are local: +Z is the front face. Phone 8 m shot is 1080x2400, vfov 58,
the mode B frame (screen px/m above the 154.6 bar so the measure is conclusive).
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
STEP = os.path.dirname(HERE)
MESH = os.path.join(STEP, "mesh")
TEX = os.path.join(STEP, "textures")
OUT = os.path.join(STEP, "object-gate-v1")
OBJ = os.path.join(MESH, "rune-pillar.obj")

MAT_FILE = {
    "front": "front.jpg",
    "right45": "right45.jpg",
    "left45": "left45.jpg",
    "side": "side.jpg",
    "back": "back.jpg",
    "cap": "cap.jpg",
    "plinth": "plinth.jpg",
    "icicle": "cap.jpg",
}


def load_mesh(path):
    V, T = [], []
    faces = []  # (i0,i1,i2, t0,t1,t2, mat)
    mat = "front"
    for line in open(path):
        if line.startswith("v "):
            V.append([float(x) for x in line.split()[1:4]])
        elif line.startswith("vt "):
            T.append([float(x) for x in line.split()[1:3]])
        elif line.startswith("usemtl "):
            mat = line.split()[1]
        elif line.startswith("f "):
            p = [tok.split("/") for tok in line.split()[1:4]]
            faces.append((
                int(p[0][0]) - 1, int(p[1][0]) - 1, int(p[2][0]) - 1,
                int(p[0][1]) - 1, int(p[1][1]) - 1, int(p[2][1]) - 1,
                mat,
            ))
    return np.array(V, np.float32), np.array(T, np.float32), faces


def load_textures():
    out = {}
    for mat, name in MAT_FILE.items():
        if mat in out:
            continue
        img = np.asarray(Image.open(os.path.join(TEX, name)).convert("RGB"), np.float32)
        out[mat] = img
    return out


def camera(eye, target):
    eye = np.array(eye, np.float64)
    target = np.array(target, np.float64)
    forward = target - eye
    forward /= np.linalg.norm(forward)
    up = np.array([0.0, 1.0, 0.0])
    right = np.cross(forward, up)
    if np.linalg.norm(right) < 1e-8:
        up = np.array([0.0, 0.0, 1.0])
        right = np.cross(forward, up)
    right /= np.linalg.norm(right)
    up = np.cross(right, forward)
    up /= np.linalg.norm(up)
    return eye, right, up, forward


def render(V, T, faces, textures, eye, target, fov_deg, w, h, relief=False):
    eye, right, up, forward = camera(eye, target)
    tan = math.tan(math.radians(fov_deg) * 0.5)
    aspect = w / float(h)
    rel = V - eye
    xc = rel @ right
    yc = rel @ up
    zc = rel @ forward
    color = np.zeros((h, w, 3), np.float32)
    depth = np.full((h, w), np.inf, np.float32)
    normal = np.zeros((h, w, 3), np.float32)
    hit = np.zeros((h, w), np.uint8)
    tex_cache = textures

    for i0, i1, i2, t0, t1, t2, mat in faces:
        z0, z1, z2 = float(zc[i0]), float(zc[i1]), float(zc[i2])
        if z0 <= 0.05 and z1 <= 0.05 and z2 <= 0.05:
            continue
        if min(z0, z1, z2) <= 0.05:
            continue
        sx = np.array([
            (xc[i0] / z0) / (tan * aspect),
            (xc[i1] / z1) / (tan * aspect),
            (xc[i2] / z2) / (tan * aspect),
        ])
        sy = np.array([
            (yc[i0] / z0) / tan,
            (yc[i1] / z1) / tan,
            (yc[i2] / z2) / tan,
        ])
        px = (sx * 0.5 + 0.5) * w
        py = (1.0 - (sy * 0.5 + 0.5)) * h
        minx = int(max(0, math.floor(px.min())))
        maxx = int(min(w - 1, math.ceil(px.max())))
        miny = int(max(0, math.floor(py.min())))
        maxy = int(min(h - 1, math.ceil(py.max())))
        if maxx < minx or maxy < miny:
            continue
        # y-down flips the screen winding. Cull only a zero-area triangle here.
        area = (px[1] - px[0]) * (py[2] - py[0]) - (px[2] - px[0]) * (py[1] - py[0])
        if abs(area) <= 1e-6:
            continue
        p0 = V[i0]
        p1 = V[i1]
        p2 = V[i2]
        n = np.cross((p1 - p0).astype(np.float64), (p2 - p0).astype(np.float64))
        ln = np.linalg.norm(n)
        if ln < 1e-12:
            continue
        n /= ln
        center = (p0.astype(np.float64) + p1.astype(np.float64) + p2.astype(np.float64)) / 3.0
        if float(np.dot(n, eye - center)) <= 0.0:
            continue
        # y-down screen flips the sign. Keep the barycentric weights positive.
        if area < 0:
            px[1], px[2] = px[2], px[1]
            py[1], py[2] = py[2], py[1]
            z0, z1, z2 = z0, z2, z1
            i1, i2 = i2, i1
            t1, t2 = t2, t1
            p1, p2 = p2, p1
            area = -area
        bw = maxx - minx + 1
        bh = maxy - miny + 1
        if bw * bh > 800000:
            # very large tri (cap fan at a close camera): still raster, but it is one triangle
            pass
        xs = np.arange(minx, maxx + 1, dtype=np.float32) + 0.5
        ys = np.arange(miny, maxy + 1, dtype=np.float32) + 0.5
        gx, gy = np.meshgrid(xs, ys)
        w0 = (px[1] - gx) * (py[2] - gy) - (px[2] - gx) * (py[1] - gy)
        w1 = (px[2] - gx) * (py[0] - gy) - (px[0] - gx) * (py[2] - gy)
        w2 = (px[0] - gx) * (py[1] - gy) - (px[1] - gx) * (py[0] - gy)
        # area was computed with the same edge function; w0+w1+w2 == area
        mask = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
        if not mask.any():
            continue
        inv = 1.0 / area
        b0 = w0 * inv
        b1 = w1 * inv
        b2 = w2 * inv
        # perspective-correct barycentrics
        ooz = b0 / z0 + b1 / z1 + b2 / z2
        z = 1.0 / np.maximum(ooz, 1e-8)
        old = depth[miny:maxy + 1, minx:maxx + 1]
        closer = mask & (z < old)
        if not closer.any():
            continue
        depth[miny:maxy + 1, minx:maxx + 1] = np.where(closer, z, old)
        if relief:
            # bright where the triangle sits in a groove (mean inset from the flat)
            inset = _inset(p0, p1, p2, mat)
            rgb = np.array([230, 170, 60], np.float32) if inset > 0.02 else np.array([28, 32, 40], np.float32)
            tile = color[miny:maxy + 1, minx:maxx + 1]
            tile[closer] = rgb
        else:
            uv0, uv1, uv2 = T[t0], T[t1], T[t2]
            u = (b0 * uv0[0] / z0 + b1 * uv1[0] / z1 + b2 * uv2[0] / z2) * z
            v = (b0 * uv0[1] / z0 + b1 * uv1[1] / z1 + b2 * uv2[1] / z2) * z
            tex = tex_cache[mat]
            th, tw = tex.shape[:2]
            x = np.clip(u, 0, 1) * (tw - 1)
            y = np.clip(1.0 - v, 0, 1) * (th - 1)
            x0i = np.clip(np.floor(x).astype(np.int32), 0, tw - 1)
            y0i = np.clip(np.floor(y).astype(np.int32), 0, th - 1)
            x1i = np.clip(x0i + 1, 0, tw - 1)
            y1i = np.clip(y0i + 1, 0, th - 1)
            fx = (x - x0i).astype(np.float32)[..., None]
            fy = (y - y0i).astype(np.float32)[..., None]
            c00 = tex[y0i, x0i]
            c10 = tex[y0i, x1i]
            c01 = tex[y1i, x0i]
            c11 = tex[y1i, x1i]
            col = c00 * (1 - fx) * (1 - fy) + c10 * fx * (1 - fy) + c01 * (1 - fx) * fy + c11 * fx * fy
            tile = color[miny:maxy + 1, minx:maxx + 1]
            tile[closer] = col[closer]
        nt = normal[miny:maxy + 1, minx:maxx + 1]
        nt[closer] = n.astype(np.float32)
        hit[miny:maxy + 1, minx:maxx + 1] = np.where(closer, 1, hit[miny:maxy + 1, minx:maxx + 1])
    depth_out = np.where(hit.astype(bool), depth, np.nan).astype(np.float32)
    rgb = np.clip(color, 0, 255).astype(np.uint8)
    return rgb, depth_out, normal, hit.astype(bool)


def _inset(p0, p1, p2, mat):
    if mat in ("plinth", "icicle", "cap"):
        return 0.0
    c = (np.asarray(p0) + np.asarray(p1) + np.asarray(p2)) / 3.0
    # distance inside the local octagon flat. A groove is pulled toward the axis.
    ang = math.atan2(float(c[0]), float(c[2]))
    # nearest flat normal is a multiple of 45 degrees, flats at 0,45,...
    flat = round(ang / (math.pi / 4.0)) * (math.pi / 4.0)
    nx, nz = math.sin(flat), math.cos(flat)
    support = float(c[0]) * nx + float(c[2]) * nz
    # expected apothem on the ungrooved taper
    y = float(c[1])
    if y < 0.60 or y > 6.40:
        return 0.0
    t = (y - 0.60) / (6.40 - 0.60)
    apo = 0.80 + (0.60 - 0.80) * t
    return apo - support


def save_jpg(path, rgb):
    Image.fromarray(rgb, "RGB").save(path, quality=90, optimize=True)


def eye_on_yaw(dist, yaw_deg, y, radius=0.8):
    a = math.radians(yaw_deg)
    # yaw 0 looks at the front from +Z. Distance is from the surface, so step out by radius.
    return (
        math.sin(a) * (dist + radius),
        y,
        math.cos(a) * (dist + radius),
    )


def main():
    os.makedirs(OUT, exist_ok=True)
    print("load", flush=True)
    V, T, faces = load_mesh(OBJ)
    textures = load_textures()
    print("verts", len(V), "faces", len(faces), flush=True)
    shots = []

    def shoot(name, eye, target, w, h, npz_name=None, relief_name=None):
        print("render", name, flush=True)
        rgb, depth, normal, hit = render(V, T, faces, textures, eye, target, 58.0, w, h, relief=False)
        path = os.path.join(OUT, name + ".jpg")
        save_jpg(path, rgb)
        shots.append({"name": name, "path": path, "w": w, "h": h, "eye": list(eye), "target": list(target), "fov": 58})
        if npz_name:
            np.savez_compressed(
                os.path.join(OUT, npz_name),
                depth=depth,
                normal=normal,
            )
        if relief_name:
            print("relief", relief_name, flush=True)
            rgb_r, _, _, _ = render(V, T, faces, textures, eye, target, 58.0, w, h, relief=True)
            save_jpg(os.path.join(OUT, relief_name + ".jpg"), rgb_r)
        # subject coverage
        shots[-1]["cover"] = round(float(hit.mean()), 4)
        return path

    # 19.7 m, front, phone-ish portrait but not the sharpness frame
    shoot("front-19.7m", eye_on_yaw(19.7, 0, 3.2), (0, 3.4, 0), 720, 1280)
    # 8 m mode B. This is the sharpness frame. dist to the front face is 8 m.
    eye8 = eye_on_yaw(8.0, 0, 3.0)
    shoot("front-8m", eye8, (0, 3.3, 0), 1080, 2400, relief_name="front-8m-relief")
    # same pixels are the phone mode B shot
    src = os.path.join(OUT, "front-8m.jpg")
    dst = os.path.join(OUT, "phone-8m.jpg")
    if src != dst:
        open(dst, "wb").write(open(src, "rb").read())
        shots.append({"name": "phone-8m", "path": dst, "w": 1080, "h": 2400, "note": "mode B, same frame as front-8m", "fov": 58})
    # 3 m looking up at the cap
    shoot("up-3m", (0.0, 1.7, 0.8 + 3.0), (0.0, 6.7, 0.0), 1080, 1600)
    # oblique 45, slightly above so the treads read
    shoot("oblique45", eye_on_yaw(8.0, 45, 4.2, radius=1.2), (0.0, 3.0, 0.0), 960, 1280, npz_name="oblique45-pass.npz")
    # grazing: 12 degrees off the front plane, looking across the runes
    shoot("grazing", eye_on_yaw(4.5, 78, 2.4, radius=1.0), (0.0, 3.2, 0.3), 960, 1280, npz_name="grazing-pass.npz")
    json.dump({"shots": shots}, open(os.path.join(OUT, "shots.json"), "w"), indent=1)
    print("done", len(shots), flush=True)


if __name__ == "__main__":
    main()

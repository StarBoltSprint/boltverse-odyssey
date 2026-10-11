#!/usr/bin/env python3
"""Checklist camera sheet of the fusion tower GLB.

Software raster of the existing mesh (no Imagine). Each view uses frame_bbox,
then capture_gate measures cover. Writes one contact sheet plus the JSON row.
"""
import json
import os
import struct
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from common.capture_gate import check_capture  # noqa: E402
from common.frame_bbox import frame_view  # noqa: E402

DEFAULT_GLB = "/workspace/i23d-auto/zoneb-tower-vision/vision/tower.glb"
VIEWS = ("close", "low-portrait", "far", "ortho-front", "ortho-side")


def load_mesh(path):
    data = open(path, "rb").read()
    magic, _ver, length = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67:
        raise SystemExit(f"not a glb: {path}")
    off = 12
    doc = blob = None
    while off + 8 <= length:
        clen, ctype = struct.unpack_from("<II", data, off)
        off += 8
        chunk = data[off:off + clen]
        off += clen
        if ctype == 0x4E4F534A:
            doc = json.loads(chunk)
        elif ctype == 0x004E4942:
            blob = chunk
    prim = doc["meshes"][0]["primitives"][0]
    acc = doc["accessors"]
    views = doc["bufferViews"]

    def read_acc(index, np_dtype, comps):
        a = acc[index]
        bv = views[a["bufferView"]]
        start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
        count = a["count"]
        item = np.dtype(np_dtype).itemsize * comps
        stride = bv.get("byteStride", item)
        if stride == item:
            arr = np.frombuffer(blob, dtype=np_dtype, count=count * comps, offset=start).reshape(count, comps)
        else:
            arr = np.empty((count, comps), np_dtype)
            for i in range(count):
                arr[i] = np.frombuffer(blob, dtype=np_dtype, count=comps, offset=start + i * stride)
        return np.array(arr)

    pos = read_acc(prim["attributes"]["POSITION"], np.float32, 3).astype(np.float64)
    idx_type = np.uint16 if acc[prim["indices"]]["componentType"] == 5123 else np.uint32
    idx = read_acc(prim["indices"], idx_type, 1).reshape(-1, 3).astype(np.int64)
    return pos, idx


def _basis(eye, target, up):
    eye = np.asarray(eye, np.float64)
    target = np.asarray(target, np.float64)
    up = np.asarray(up, np.float64)
    back = eye - target
    back /= np.linalg.norm(back) or 1.0
    right = np.cross(up, back)
    right /= np.linalg.norm(right) or 1.0
    yup = np.cross(back, right)
    return eye, target, right, yup, back


def project(pos, pose):
    eye, target, right, yup, back = _basis(pose["eye"], pose["target"], pose["up"])
    rel = pos - eye
    cx = rel @ right
    cy = rel @ yup
    cz = rel @ back  # positive behind the camera; in front is negative
    if pose["kind"] == "ortho":
        x = cx / (pose["orthoW"] * 0.5)
        y = cy / (pose["orthoH"] * 0.5)
        z = -cz
    else:
        fov = np.deg2rad(pose["fovY"])
        tan_y = np.tan(fov * 0.5)
        tan_x = tan_y * (pose["width"] / pose["height"])
        z = -cz
        x = np.divide(cx, z * tan_x, out=np.full_like(cx, np.nan), where=z > 1e-4)
        y = np.divide(cy, z * tan_y, out=np.full_like(cy, np.nan), where=z > 1e-4)
    px = (x * 0.5 + 0.5) * pose["width"]
    py = (0.5 - y * 0.5) * pose["height"]
    return np.stack([px, py, z], axis=1)


def raster(pos, idx, pose):
    """Painter's draw of the mesh. The mask is the union of the triangles, which is the cover."""
    w, h = int(pose["width"]), int(pose["height"])
    cam = project(pos, pose)
    light = np.array([0.35, 0.75, 0.45], np.float64)
    light /= np.linalg.norm(light)
    mean_z = cam[idx, 2].mean(axis=1)
    order = np.argsort(mean_z)  # far (small z) first
    colour = Image.new("RGB", (w, h), (12, 14, 18))
    mask_im = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(colour)
    mdraw = ImageDraw.Draw(mask_im)
    for t in order:
        p = cam[idx[t]]
        if not np.isfinite(p).all() or (p[:, 2] <= 1e-3).any():
            continue
        pts = [(float(p[0, 0]), float(p[0, 1])), (float(p[1, 0]), float(p[1, 1])), (float(p[2, 0]), float(p[2, 1]))]
        n = np.cross(pos[idx[t][1]] - pos[idx[t][0]], pos[idx[t][2]] - pos[idx[t][0]])
        shade = 0.32 + 0.68 * abs(float(n @ light) / (np.linalg.norm(n) or 1.0))
        rgb = tuple(int(c) for c in (np.array([196, 164, 102]) * shade))
        draw.polygon(pts, fill=rgb)
        mdraw.polygon(pts, fill=255)
    return np.asarray(colour).astype(np.float32) / 255.0, np.asarray(mask_im) > 127


def sheet(images, labels, out):
    cell_w, cell_h = 220, 420
    pad = 8
    canvas = Image.new("RGB", (len(images) * (cell_w + pad) + pad, cell_h + 36), (18, 16, 20))
    draw = ImageDraw.Draw(canvas)
    for i, (im, label) in enumerate(zip(images, labels)):
        thumb = im.copy()
        thumb.thumbnail((cell_w, cell_h - 28))
        x = pad + i * (cell_w + pad)
        canvas.paste(thumb, (x, 28))
        draw.text((x, 6), label, fill=(236, 228, 210))
    canvas.save(out)
    return out


def main():
    glb = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_GLB
    out_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "../../steps/foundation-1011")
    os.makedirs(out_dir, exist_ok=True)
    pos, idx = load_mesh(glb)
    mn = pos.min(0).tolist()
    mx = pos.max(0).tolist()
    # Front is the thinner horizontal axis so the broad face fills the frame.
    size = np.asarray(mx) - np.asarray(mn)
    front = (1.0, 0.0, 0.0) if size[0] <= size[2] else (0.0, 0.0, 1.0)
    rows = []
    images = []
    labels = []
    for view in VIEWS:
        pose = frame_view(mn, mx, view, 412, 915, front)
        if pose["kind"] != "ortho":
            pose["width"], pose["height"] = 206, 458
            pose = frame_view(mn, mx, view, 206, 458, front)
        colour, mask = raster(pos, idx, pose)
        rgb = (np.clip(colour, 0, 1) * 255).astype(np.uint8)
        img = Image.fromarray(rgb, "RGB")
        path = os.path.join(out_dir, f"tower-{view}.png")
        img.save(path)
        mask_path = os.path.join(out_dir, f"tower-{view}-mask.png")
        Image.fromarray((mask.astype(np.uint8) * 255), "L").save(mask_path)
        gate = check_capture(path, view if view.startswith("ortho") else view, mask_path)
        rows.append({"view": view, "distanceM": pose["distanceM"], "fovY": pose["fovY"],
                     "size": [pose["width"], pose["height"]], **gate})
        images.append(img)
        labels.append(f"{view} {gate['cover']:.0%}")
        print(view, gate["ok"], gate["cover"], gate["why"])
    sheet_path = os.path.join(out_dir, "tower-checklist-sheet.png")
    sheet(images, labels, sheet_path)
    report = {"glb": glb, "min": mn, "max": mx, "front": front, "sheet": sheet_path, "views": rows,
              "ok": all(r["ok"] for r in rows)}
    out_json = os.path.join(out_dir, "tower-checklist.json")
    with open(out_json, "w") as f:
        json.dump(report, f, indent=1)
    print(json.dumps({"ok": report["ok"], "sheet": sheet_path}))
    sys.exit(0 if report["ok"] else 1)


if __name__ == "__main__":
    main()

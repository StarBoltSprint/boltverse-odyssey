"""Sealed ruins: a loft cooked by an earlier step, kept as is (mesh + skins byte for byte).

The owner can keep an approved earlier ruin beside a new one (2026-10-04: the step 4 arch stays
next to the step 4b monolith). A sealed ruin is not re-measured and not re-cooked. Its skins are
packed side by side into one atlas so it costs one draw; the UVs are remapped onto the atlas, no
pixel is scaled. Placement, seating and colliders are the same generic rules as any ruin.
"""

import json
import math
import shutil
from pathlib import Path

import numpy as np

from colliders import read_ruin


def load_sealed(folder):
    folder = Path(folder)
    info = json.loads((folder / "sealed.json").read_text())
    groups = read_ruin(folder / info["mesh"])
    return info, groups


def atlas_groups(folder, info, groups, dest_jpg):
    """Pack the skins left to right (top aligned, unscaled) and remap each group's UVs onto it."""
    from PIL import Image

    folder = Path(folder)
    imgs = [Image.open(folder / name).convert("RGB") for name in info["skins"]]
    W = sum(im.width for im in imgs)
    H = max(im.height for im in imgs)
    canvas = Image.new("RGB", (W, H))
    offs = []
    x = 0
    for im in imgs:
        canvas.paste(im, (x, 0))
        offs.append((x, im.width, im.height))
        x += im.width
    dest_jpg.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dest_jpg, "JPEG", quality=92, optimize=True)
    flat_xyzuv = []
    flat_idx = []
    base = 0
    for skin, xyzuv, idx in groups:
        a = np.array(xyzuv, dtype=np.float64).reshape(-1, 5)
        ox, w, h = offs[int(skin)]
        a[:, 3] = (ox + a[:, 3] * w) / W
        a[:, 4] = 1.0 - (1.0 - a[:, 4]) * h / H
        flat_xyzuv.append(a)
        flat_idx.append(np.asarray(idx, dtype=np.int64).reshape(-1) + base)
        base += a.shape[0]
    xyz = np.concatenate(flat_xyzuv).astype(np.float32)
    ids = np.concatenate(flat_idx).astype(np.uint32)
    return [(0, xyz.reshape(-1).tolist(), ids.tolist())], (W, H)


def horiz_radius(groups):
    r = 0.0
    for _skin, xyzuv, _idx in groups:
        a = np.asarray(xyzuv).reshape(-1, 5)
        r = max(r, float(np.max(np.hypot(a[:, 0], a[:, 2]))))
    return r


def copy_prompts(folder, info, dest_dir):
    folder = Path(folder)
    for name in info["skins"]:
        sib = (folder / name).with_suffix(".PROMPT.txt")
        if sib.is_file():
            shutil.copyfile(sib, dest_dir / sib.name)


def face_yaw(spawn, x, z):
    return math.atan2(spawn[0] - x, spawn[1] - z)

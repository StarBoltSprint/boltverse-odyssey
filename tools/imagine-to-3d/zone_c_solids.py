#!/usr/bin/env python3
"""Zone C solids from the key, the #199 camera, #200 SAM2 masks, and MoGe-2.

Key-visible front faces keep the key projection. Every other face is tagged
pending-plate from specs/zone-c-plate-plan.json (plates 5-15). This file does
not call Imagine and does not invent those plates.

  python3 tools/imagine-to-3d/zone_c_solids.py build [--attempt 1]
  python3 tools/imagine-to-3d/zone_c_solids.py score
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(REPO / "tools" / "terrain-from-key"))
sys.path.insert(0, str(REPO / "tools" / "common"))
sys.path.insert(0, str(REPO / "tools" / "biome"))

from geom import camera_axes  # noqa: E402

STEP = REPO / "steps" / "zone-c" / "05-solids"
DATA = STEP / "data"
KEY = REPO / "steps" / "zone-c" / "03-terrain" / "key-zc1.jpg"
MASK_DIR = REPO / "steps" / "zone-c" / "02-masks"
CAM_JSON = REPO / "steps" / "zone-c" / "01-camera" / "camera.json"
PLAN_PATH = HERE / "specs" / "zone-c-plate-plan.json"
HEIGHT_JSON = REPO / "steps" / "zone-c" / "03-terrain" / "data" / "height.json"
HEIGHT_BIN = REPO / "steps" / "zone-c" / "03-terrain" / "data" / "height.bin"

SOLIDS = (
    ("arch-left", "mask-arch-left.png"),
    ("arch-right", "mask-arch-right.png"),
    ("cliff-left", "mask-cliff-left.png"),
    ("gorge-rock", "mask-gorge-rock.png"),
    ("cliff-right", "mask-cliff-right.png"),
)

THICKNESS_M = 3.0
GRID_STEP = 4
STRETCH_MAX = 1.3
MIN_DEPTH = 0.4
MAX_DEPTH = 400.0


def locked_camera(raw: dict) -> dict:
    return {
        "x": 0.0,
        "z": 0.0,
        "yaw": 0.0,
        "pitch": float(raw["pitchDeg"]),
        "eye": float(raw["eyeHeightM"]),
        "fov": float(raw["vfovDeg"]),
    }


def world_from_points(points: np.ndarray, cam: dict) -> np.ndarray:
    right, up, forward = camera_axes(cam["yaw"], cam["pitch"])
    eye = np.array([cam["x"], cam["eye"], cam["z"]], np.float64)
    x = points[..., 0].astype(np.float64)
    y = points[..., 1].astype(np.float64)
    z = points[..., 2].astype(np.float64)
    return eye + x[..., None] * right + (-y)[..., None] * up + z[..., None] * forward


def load_plan() -> list:
    return json.loads(PLAN_PATH.read_text())["plates"]


def plate_for(plan, obj: str, kind: str) -> int:
    for row in plan:
        if kind in row["faces"] and row["object"] in (obj, "*"):
            return int(row["n"])
    raise KeyError(f"no plate for {obj} {kind}")


def points_from_depth(depth: np.ndarray, K: np.ndarray) -> np.ndarray:
    """OpenCV point map. K is normalised (fx in widths, principal point in 0..1)."""
    height, width = depth.shape
    fx = float(K[0, 0]) * width
    fy = float(K[1, 1]) * height
    cx = float(K[0, 2]) * width
    cy = float(K[1, 2]) * height
    xs = np.arange(width, dtype=np.float64)
    ys = np.arange(height, dtype=np.float64)
    uu, vv = np.meshgrid(xs, ys)
    z = depth.astype(np.float64)
    x = (uu - cx) / fx * z
    y = (vv - cy) / fy * z
    return np.stack([x, y, z], axis=-1).astype(np.float32)


def points_ok(points: np.ndarray) -> bool:
    if points.ndim != 3 or points.shape[-1] != 3:
        return False
    a = points[::16, ::16, 0]
    b = points[::16, ::16, 1]
    return float(np.mean(np.abs(a - b))) > 1e-3


def infer_moge(image: Path, max_side: int = 896):
    import torch
    import vision_models

    im = Image.open(image).convert("RGB")
    w, h = im.size
    scale = min(1.0, max_side / max(w, h))
    if scale < 1:
        im = im.resize((int(round(w * scale)), int(round(h * scale))), Image.Resampling.LANCZOS)
    arr = np.asarray(im, np.float32) / 255.0
    tensor = torch.from_numpy(arr.transpose(2, 0, 1).copy())
    model = vision_models.load_moge2()
    with torch.inference_mode():
        out = model.infer(tensor, resolution_level=4, use_fp16=False, force_projection=True, apply_mask=False)
    depth = out["depth"].detach().cpu().numpy().astype(np.float32)
    if depth.ndim == 3:
        depth = depth[0]
    K = out["intrinsics"].detach().cpu().numpy().astype(np.float64)
    if K.ndim == 3:
        K = K[0]
    # The numpy view of `points` has come back with x=y=z=depth (zero stride).
    # Rebuild the point map from the metric depth and the normalised intrinsics.
    points = points_from_depth(depth, K)
    return points, depth, im.size


def load_ground():
    meta = json.loads(HEIGHT_JSON.read_text())
    h = np.fromfile(HEIGHT_BIN, dtype=np.float32).reshape(meta["nz"], meta["nx"])
    origin = np.array(meta["origin"], np.float64)
    step = float(meta["step"])
    return h, origin, step


def ground_y(h, origin, step, x, z) -> float:
    fx = (x - origin[0]) / step
    fz = (z - origin[1]) / step
    if fx < 0 or fz < 0 or fx >= h.shape[1] - 1 or fz >= h.shape[0] - 1:
        return 0.0
    x0 = int(fx)
    z0 = int(fz)
    tx = fx - x0
    tz = fz - z0
    h00 = h[z0, x0]
    h10 = h[z0, x0 + 1]
    h01 = h[z0 + 1, x0]
    h11 = h[z0 + 1, x0 + 1]
    return float(h00 * (1 - tx) * (1 - tz) + h10 * tx * (1 - tz) + h01 * (1 - tx) * tz + h11 * tx * tz)


def stretch_of(p0, p1, p2, uv0, uv1, uv2, tw, th) -> float:
    e1 = p1 - p0
    e2 = p2 - p0
    n = np.cross(e1, e2)
    ln = np.linalg.norm(n)
    if ln < 1e-8:
        return 1.0
    n = n / ln
    L1 = np.linalg.norm(e1)
    if L1 < 1e-8:
        return 1.0
    ex = e1 / L1
    ey = np.cross(n, ex)
    el = np.linalg.norm(ey)
    if el < 1e-8:
        return 99.0
    ey = ey / el
    x2 = float(np.dot(e2, ex))
    y2 = float(np.dot(e2, ey))
    du1 = (uv1[0] - uv0[0]) * tw
    dv1 = (uv1[1] - uv0[1]) * th
    du2 = (uv2[0] - uv0[0]) * tw
    dv2 = (uv2[1] - uv0[1]) * th
    det = L1 * y2
    if abs(det) < 1e-9:
        return 1.0
    j00 = (du1 * y2 - du2 * 0.0) / det
    j01 = (du2 * L1 - du1 * x2) / det
    j10 = (dv1 * y2) / det
    j11 = (dv2 * L1 - dv1 * x2) / det
    T = j00 * j00 + j01 * j01 + j10 * j10 + j11 * j11
    D = abs(j00 * j11 - j01 * j10)
    disc = max(0.0, T * T - 4 * D * D)
    s1 = (0.5 * (T + disc ** 0.5)) ** 0.5
    s2 = D / (s1 or 1.0)
    if s2 < 1e-9:
        return 99.0
    return float(s1 / s2)


def p95(values, weights) -> float:
    if not values:
        return 1.0
    order = np.argsort(values)
    acc = 0.0
    tot = float(np.sum(weights)) or 1.0
    out = float(values[order[-1]])
    for i in order:
        acc += float(weights[i])
        if acc >= 0.95 * tot:
            return float(values[i])
    return out


def count_edges(idx: np.ndarray, pos: np.ndarray | None = None) -> dict:
    edges = {}
    for t in range(0, len(idx), 3):
        a, b, c = int(idx[t]), int(idx[t + 1]), int(idx[t + 2])
        for u, v in ((a, b), (b, c), (c, a)):
            k = (u, v) if u < v else (v, u)
            edges[k] = edges.get(k, 0) + 1
    open_n = sum(1 for n in edges.values() if n == 1)
    bad = [(e, n) for e, n in edges.items() if n > 2]
    sample = None
    if bad and pos is not None:
        (u, v), n = bad[0]
        sample = {"n": int(n), "a": pos[u].tolist(), "b": pos[v].tolist()}
    return {"open": open_n, "nonManifold": len(bad), "edges": len(edges), "sample": sample}


def build_solid(name, mask, world, depth, cam, plan, ground, key_wh):
    right, up, forward = camera_axes(cam["yaw"], cam["pitch"])
    H, W = mask.shape
    step = GRID_STEP
    quads = []
    for j in range(0, H - step, step):
        row = mask[j : j + step + 1 : step]
        for i in range(0, W - step, step):
            block = mask[j : j + step + 1 : step, i : i + step + 1 : step]
            if block.shape != (2, 2) or not block.all():
                continue
            ds = depth[j : j + step + 1 : step, i : i + step + 1 : step]
            if not np.isfinite(ds).all():
                continue
            if np.any(ds < MIN_DEPTH) or np.any(ds > MAX_DEPTH):
                continue
            quads.append((i, j))
    if len(quads) < 8:
        raise RuntimeError(f"{name}: only {len(quads)} quads")
    tw, th = key_wh
    # A quad that jumps many times the pixel's angle is a depth tear, not a face.
    eye = np.array([cam["x"], cam["eye"], cam["z"]], np.float64)
    vfov = np.radians(cam["fov"])
    hfov = 2.0 * np.arctan(np.tan(vfov * 0.5) * (tw / th))
    rad_per_px = (2.0 * np.tan(hfov * 0.5)) / tw
    edge_px = step * (tw / float(W))
    stable = []
    for i, j in quads:
        pts = (
            world[j, i],
            world[j, i + step],
            world[j + step, i + step],
            world[j + step, i],
        )
        depths = [float(np.dot(p - eye, forward)) for p in pts]
        mean_d = max(sum(depths) / 4.0, 0.5)
        expect = edge_px * rad_per_px * mean_d
        longest = 0.0
        for a, b in ((0, 1), (1, 2), (2, 3), (3, 0)):
            longest = max(longest, float(np.linalg.norm(pts[a] - pts[b])))
        if longest > 2.0 * expect:
            continue
        stable.append((i, j))
    if len(stable) < 8:
        raise RuntimeError(f"{name}: only {len(stable)} stable quads of {len(quads)}")
    quads = stable
    qset = set(quads)
    # Weld corners only across a shared edge. A pinch where two quads meet at
    # one pixel keeps two struts, so the thickness edge stays at two triangles.
    qindex = {q: n for n, q in enumerate(quads)}
    parent = list(range(len(quads) * 4))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    def cid(n, corner):
        return n * 4 + corner

    for n, (i, j) in enumerate(quads):
        right_n = qindex.get((i + step, j))
        if right_n is not None:
            union(cid(n, 1), cid(right_n, 0))
            union(cid(n, 3), cid(right_n, 2))
        down_n = qindex.get((i, j + step))
        if down_n is not None:
            union(cid(n, 2), cid(down_n, 0))
            union(cid(n, 3), cid(down_n, 1))

    verts = {}
    positions = []
    uvs = []
    plates_v = []

    def add_v(i, j, layer, plate, weld):
        key = (i, j, layer, weld)
        if key in verts:
            return verts[key]
        p = world[j, i].copy()
        if layer == 1:
            p = p + forward * THICKNESS_M
        u = (i + 0.5) / W
        v = 1.0 - (j + 0.5) / H
        verts[key] = len(positions)
        positions.append(p)
        uvs.append((u, v))
        plates_v.append(plate)
        return verts[key]

    indices = []
    tri_plate = []
    tri_kind = []
    stretches = []
    weights = []

    def push(ia, ib, ic, plate, kind, want):
        pa, pb, pc = positions[ia], positions[ib], positions[ic]
        n = np.cross(pb - pa, pc - pa)
        if np.dot(n, want) < 0:
            ib, ic = ic, ib
            pb, pc = positions[ib], positions[ic]
            n = np.cross(pb - pa, pc - pa)
        indices.extend((ia, ib, ic))
        tri_plate.append(plate)
        tri_kind.append(kind)
        if kind == "key":
            area = float(np.linalg.norm(n)) * 0.5
            sv = stretch_of(pa, pb, pc, uvs[ia], uvs[ib], uvs[ic], tw, th)
            # A front that stretches past the bar is a grazing face. It waits
            # on that object's side plate and is not scored as the key.
            if sv > STRETCH_MAX:
                plate = plate_for(plan, name, "grazing")
                kind = "grazing"
                tri_plate[-1] = plate
                tri_kind[-1] = kind
            else:
                stretches.append(sv)
                weights.append(max(area, 1e-6))

    for i, j in quads:
        n = qindex[(i, j)]
        w00, w10 = find(cid(n, 0)), find(cid(n, 1))
        w01, w11 = find(cid(n, 2)), find(cid(n, 3))
        welds = {(i, j): w00, (i + step, j): w10, (i, j + step): w01, (i + step, j + step): w11}
        i00 = add_v(i, j, 0, 0, w00)
        i10 = add_v(i + step, j, 0, 0, w10)
        i01 = add_v(i, j + step, 0, 0, w01)
        i11 = add_v(i + step, j + step, 0, 0, w11)
        # Front faces the camera. Wanted outward is -forward.
        push(i00, i01, i10, 0, "key", -forward)
        push(i10, i01, i11, 0, "key", -forward)
        pb = plate_for(plan, name, "back")
        b00 = add_v(i, j, 1, pb, w00)
        b10 = add_v(i + step, j, 1, pb, w10)
        b01 = add_v(i, j + step, 1, pb, w01)
        b11 = add_v(i + step, j + step, 1, pb, w11)
        push(b00, b10, b01, pb, "back", forward)
        push(b10, b11, b01, pb, "back", forward)

        origins = (
            (i, j - step),
            (i + step, j),
            (i, j + step),
            (i - step, j),
        )
        corners = (
            ((i, j), (i + step, j)),
            ((i + step, j), (i + step, j + step)),
            ((i + step, j + step), (i, j + step)),
            ((i, j + step), (i, j)),
        )
        for (c0, c1), origin in zip(corners, origins):
            if origin in qset:
                continue
            # side or bottom lip
            image_down = origin[1] > j
            kind = "side"
            if image_down:
                kind = "bottom"
            plate = plate_for(plan, name, kind)
            f0 = add_v(c0[0], c0[1], 0, plate, welds[c0])
            f1 = add_v(c1[0], c1[1], 0, plate, welds[c1])
            k0 = add_v(c0[0], c0[1], 1, plate, welds[c0])
            k1 = add_v(c1[0], c1[1], 1, plate, welds[c1])
            mid = (positions[f0] + positions[f1]) * 0.5
            centre = world[min(j + step // 2, H - 1), min(i + step // 2, W - 1)]
            want = mid - centre
            if np.linalg.norm(want) < 1e-6:
                want = np.cross(forward, right)
            push(f0, f1, k1, plate, kind, want)
            push(f0, k1, k0, plate, kind, want)

    pos = np.asarray(positions, np.float32)
    uv = np.asarray(uvs, np.float32)
    plate_a = np.asarray(plates_v, np.float32)
    idx = np.asarray(indices, np.uint32)
    # Key triangles first so the draw group is a prefix.
    tri_plate_a = np.asarray(tri_plate, np.int32)
    order = np.argsort(np.where(tri_plate_a == 0, 0, 1), kind="stable")
    idx = idx.reshape(-1, 3)[order].reshape(-1)
    tri_plate_a = tri_plate_a[order]
    kinds = [tri_kind[i] for i in order]
    key_tris = int(np.sum(tri_plate_a == 0))
    counts = {}
    for p, k in zip(tri_plate_a.tolist(), kinds):
        if p == 0:
            continue
        counts.setdefault(str(p), {"tris": 0, "kinds": {}})
        counts[str(p)]["tris"] += 1
        counts[str(p)]["kinds"][k] = counts[str(p)]["kinds"].get(k, 0) + 1
    edges = count_edges(idx, pos)
    stretch = p95(stretches, weights) if stretches else 1.0
    stretch_max = float(max(stretches)) if stretches else 1.0
    mn = pos.min(axis=0)
    mx = pos.max(axis=0)
    return {
        "name": name,
        "pos": pos,
        "uv": uv,
        "plate": plate_a,
        "idx": idx,
        "keyTris": key_tris,
        "triPlate": tri_plate_a,
        "pending": counts,
        "edges": edges,
        "stretchP95": round(stretch, 4),
        "stretchMax": round(stretch_max, 4),
        "aabb": {"min": mn.tolist(), "max": mx.tolist()},
        "quads": len(quads),
    }


def clear_from_key(mask_path: Path) -> list:
    im = np.asarray(Image.open(KEY).convert("RGB"), np.uint8)
    m = np.asarray(Image.open(mask_path).convert("L").resize((im.shape[1], im.shape[0]), Image.Resampling.NEAREST)) > 127
    if not m.any():
        return [0.17, 0.19, 0.13]
    med = np.median(im[m].astype(np.float32), axis=0) / 255.0
    return [round(float(v), 4) for v in med]


def write_pack(solids, timings, attempt):
    DATA.mkdir(parents=True, exist_ok=True)
    blobs = []
    meta_objs = []
    byte_at = 0
    for s in solids:
        inter = np.concatenate(
            [s["pos"], s["uv"], s["plate"][:, None]],
            axis=1,
        ).astype(np.float32)
        idx = s["idx"].astype(np.uint32)
        vert_off = byte_at
        blobs.append(inter.tobytes())
        byte_at += inter.nbytes
        idx_off = byte_at
        blobs.append(idx.tobytes())
        byte_at += idx.nbytes
        meta_objs.append({
            "name": s["name"],
            "vertByteOffset": vert_off,
            "indexByteOffset": idx_off,
            "verts": int(s["pos"].shape[0]),
            "floats": 6,
            "tris": int(s["idx"].size // 3),
            "keyTris": s["keyTris"],
            "indexBytes": int(s["idx"].nbytes),
            "aabb": s["aabb"],
            "pending": s["pending"],
            "edges": s["edges"],
            "stretchP95": s["stretchP95"],
            "stretchMax": s["stretchMax"],
            "quads": s["quads"],
            "lodTris": [int(s["idx"].size // 3)] * 3,
            "sameHull": True,
        })
    (DATA / "solids.bin").write_bytes(b"".join(blobs))
    cam = json.loads(CAM_JSON.read_text())
    pack = {
        "model": "moge-2",
        "licence": "MIT",
        "camera": "steps/zone-c/01-camera/camera.json",
        "masks": "steps/zone-c/02-masks/masks.json",
        "key": "steps/zone-c/03-terrain/key-zc1.jpg",
        "attempt": attempt,
        "thicknessM": THICKNESS_M,
        "gridStep": GRID_STEP,
        "stretchMax": STRETCH_MAX,
        "objects": meta_objs,
        "timingsSec": timings,
        "clearSrgb": clear_from_key(MASK_DIR / "mask-causeway.png"),
        "vfovDeg": cam["vfovDeg"],
        "eye": [0.0, cam["eyeHeightM"], 0.0],
        "pitchDeg": cam["pitchDeg"],
        "drawCalls": 1 + sum((1 if o["keyTris"] else 0) + (1 if o["tris"] > o["keyTris"] else 0) for o in meta_objs),
        "note": "One causeway draw plus two draws per solid (key group, pending group). Pending fragments do not write colour.",
    }
    (DATA / "solids.json").write_text(json.dumps(pack, indent=2))
    return pack


def build(attempt: int):
    t0 = time.perf_counter()
    stages = {}
    cam = locked_camera(json.loads(CAM_JSON.read_text()))
    plan = load_plan()
    t = time.perf_counter()
    cache = DATA / "moge-cache.npz"
    cached = None
    if cache.exists():
        z = np.load(cache)
        if points_ok(z["points"]):
            cached = z
    if cached is not None:
        points = cached["points"]
        depth = cached["depth"]
        wh = (int(cached["wh"][0]), int(cached["wh"][1]))
        stages["moge-2"] = 0.0
    else:
        points, depth, wh = infer_moge(KEY, 896)
        DATA.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(cache, points=points, depth=depth, wh=np.array(wh))
        stages["moge-2"] = round(time.perf_counter() - t, 3)
    world = world_from_points(points, cam)
    ground = load_ground()
    key = Image.open(KEY)
    solids = []
    t = time.perf_counter()
    for name, mask_name in SOLIDS:
        m = np.asarray(Image.open(MASK_DIR / mask_name).convert("L").resize(wh, Image.Resampling.NEAREST)) > 127
        solids.append(build_solid(name, m, world, depth, cam, plan, ground, key.size))
        print(name, "quads", solids[-1]["quads"], "tris", solids[-1]["idx"].size // 3,
              "stretch", solids[-1]["stretchP95"], "max", solids[-1]["stretchMax"],
              "edges", solids[-1]["edges"], flush=True)
    stages["mesh"] = round(time.perf_counter() - t, 3)
    stages["total"] = round(time.perf_counter() - t0, 3)
    pack = write_pack(solids, stages, attempt)
    print("wrote", DATA / "solids.json", "sec", stages)
    return pack


def write_sheet():
    phone_path = STEP / "renders" / "phone-720x1600.png"
    if not phone_path.exists():
        return None
    key = Image.open(KEY).convert("RGB")
    phone = Image.open(phone_path).convert("RGB")
    edge = np.concatenate(
        [
            np.asarray(key)[0],
            np.asarray(key)[-1],
            np.asarray(key)[:, 0],
            np.asarray(key)[:, -1],
        ],
        axis=0,
    )
    med = tuple(int(v) for v in np.median(edge, axis=0))
    height = max(key.height, phone.height)
    canvas = Image.new("RGB", (key.width + phone.width, height), med)
    canvas.paste(key, (0, (height - key.height) // 2))
    canvas.paste(phone, (key.width, (height - phone.height) // 2))
    out = STEP / "sheet-phone.jpg"
    canvas.save(out, quality=95)
    return "steps/zone-c/05-solids/sheet-phone.jpg"


def score():
    """Colour and stretch rows from the headless frames the capture tool wrote."""
    sys.path.insert(0, str(REPO / "tools" / "biome"))
    from biome_lib import delta_e2000, rgb_to_lab

    pack = json.loads((DATA / "solids.json").read_text())
    renders = STEP / "renders"
    key = np.asarray(Image.open(KEY).convert("RGB"), np.float32) / 255.0
    mask = np.zeros(key.shape[:2], bool)
    for _, mask_name in SOLIDS:
        m = np.asarray(Image.open(MASK_DIR / mask_name).convert("L").resize((key.shape[1], key.shape[0]), Image.Resampling.NEAREST)) > 127
        mask |= m
    shot_path = renders / "key-1792x1008.png"
    colour = None
    if shot_path.exists():
        shot = np.asarray(Image.open(shot_path).convert("RGB").resize((key.shape[1], key.shape[0]), Image.Resampling.BILINEAR), np.float32) / 255.0
        lab_k = rgb_to_lab(key[mask])
        lab_s = rgb_to_lab(shot[mask])
        de = delta_e2000(lab_k, lab_s)
        colour = {
            "metric": "CIEDE2000",
            "mean": round(float(np.mean(de)), 3),
            "median": round(float(np.median(de)), 3),
            "pixels": int(mask.sum()),
        }
    sheet = write_sheet()
    gate_path = STEP / "object-gate" / "report.json"
    gate = None
    if gate_path.exists():
        gate = json.loads(gate_path.read_text())
        kit = {
            "tool": "object-gate",
            "scene": "tools/object-gate/specs/zone-c/solids-scene.yaml",
            "verdict": gate.get("verdict"),
            "report": "steps/zone-c/05-solids/object-gate/report.json",
        }
        (STEP / "kit-gate-result.json").write_text(json.dumps(kit, indent=2))
    stretches = {o["name"]: o["stretchP95"] for o in pack["objects"]}
    worst = max(stretches.values()) if stretches else None
    numbers = {
        "attempt": pack["attempt"],
        "costImagine": 0,
        "stretchP95": stretches,
        "stretchWorst": worst,
        "stretchPass": worst is not None and worst <= STRETCH_MAX,
        "drawCallsPlanned": pack["drawCalls"],
        "sameHull": all(o["sameHull"] and o["lodTris"][0] == o["lodTris"][1] == o["lodTris"][2] for o in pack["objects"]),
        "edges": {o["name"]: o["edges"] for o in pack["objects"]},
        "pending": {o["name"]: o["pending"] for o in pack["objects"]},
        "colour": colour,
        "timingsSec": pack["timingsSec"],
        "sheet": sheet,
        "gateVerdict": None if gate is None else gate.get("verdict"),
        "pass": False,
    }
    (STEP / "numbers.json").write_text(json.dumps(numbers, indent=2))
    print(json.dumps({k: numbers[k] for k in ("stretchWorst", "stretchPass", "colour", "sameHull")}, indent=2))
    return numbers


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ("build", "score"):
        raise SystemExit("usage: zone_c_solids.py build [--attempt N] | score")
    if sys.argv[1] == "score":
        score()
        return
    attempt = 1
    if "--attempt" in sys.argv:
        attempt = int(sys.argv[sys.argv.index("--attempt") + 1])
    build(attempt)


if __name__ == "__main__":
    main()

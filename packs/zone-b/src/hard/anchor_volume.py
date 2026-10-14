#!/usr/bin/env python3
"""Replace the Anchor card with a walkable loft. Skins stay in the atlas.

The monument stays 60 m at its placed origin. Each part's worldW/worldH and
srcW/srcH are the repeating Imagine crop, so the chase magnification is the
real pixel size. The bounds stay the solid. Do not run build.py with no flag.
"""
from __future__ import annotations

import json
import math
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HFOV = 22.7 * math.pi / 180
ASPECT = 720 / 1600
VFOV = 2 * math.atan(math.tan(HFOV / 2) / ASPECT)
FOCAL = (1600 / 2) / math.tan(VFOV / 2)

ANCHOR_Z = 177.83
# 5.9 m mouth. From just inside the south face the north jambs sit inside a
# 22.7° view, so the legs read on both sides. Wider, and the phone looks
# through the hole and never sees the piers.
HALF = 2.95
OUTER = 10.40
ZHALF = 11.0
SPRING = 13.5
CROWN = 21.0
TOP = 60.0
SIDE = 2.55
TOWER_Y0 = 15.2
SINK = 0.55
# Fully opaque sandstone in the leg plate. Atlas pixels, inclusive origin.
STONE = (2012, 328, 84, 461)
# One lattice bay on the Anchor plate, holes included.
METAL = (1372, 197, 116, 150)
# Metres of clearance the tile must survive. The pier face is at HALF.
# The shaft stands over the walk, so the lattice tile is finer than the stone.
STONE_D = 2.80
METAL_D = 6.6
MARGIN = 0.96


def soffit(x):
    ax = min(abs(x), HALF - 1e-4)
    return SPRING + math.sqrt(max(0.0, HALF * HALF - ax * ax))


class Mesh:
    def __init__(self):
        self.verts = []
        self.inds = []
        self.boxes = []
        self.min = [1e9, 1e9, 1e9]
        self.max = [-1e9, -1e9, -1e9]

    def quad(self, corners):
        # corners: (x, y, z, u, v) in atlas 0..1
        b = len(self.verts) // 5
        for p in corners:
            self.verts.extend(p)
            for i in range(3):
                self.min[i] = min(self.min[i], p[i])
                self.max[i] = max(self.max[i], p[i])
        self.inds.extend((b, b + 1, b + 2, b, b + 2, b + 3))

    def box(self, x0, y0, z0, x1, y1, z1):
        if x1 < x0:
            x0, x1 = x1, x0
        if y1 < y0:
            y0, y1 = y1, y0
        if z1 < z0:
            z0, z1 = z1, z0
        if x1 - x0 < 0.02 or y1 - y0 < 0.02 or z1 - z0 < 0.02:
            return
        self.boxes.append((round(x0, 4), round(y0, 4), round(z0, 4), round(x1, 4), round(y1, 4), round(z1, 4)))


def tile_for(crop, dist):
    _x, _y, w, h = crop
    tw = dist * w / FOCAL * MARGIN
    th = dist * h / FOCAL * MARGIN
    return tw, th


def grid(mesh, a, b, c, d, crop, tile_u, tile_v, atlas_w, atlas_h):
    """a--b is the top edge. d--c is the bottom. One crop per cell."""
    def dist(p, q):
        return math.sqrt((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2)

    eu = max(dist(a, b), dist(d, c), 1e-4)
    ev = max(dist(a, d), dist(b, c), 1e-4)
    nu = max(1, int(math.ceil(eu / tile_u - 1e-6)))
    nv = max(1, int(math.ceil(ev / tile_v - 1e-6)))
    px0, py0, pw, ph = crop
    px1 = px0 + pw - 1
    py1 = py0 + ph - 1

    def at(i, j):
        u = i / nu
        v = j / nv
        p = [0.0, 0.0, 0.0]
        for k in range(3):
            p[k] = (1 - u) * (1 - v) * a[k] + u * (1 - v) * b[k] + u * v * c[k] + (1 - u) * v * d[k]
        return p

    def uv(px, py):
        return (px + 0.5) / atlas_w, 1.0 - (py + 0.5) / atlas_h

    u00 = uv(px0, py0)
    u10 = uv(px1, py0)
    u11 = uv(px1, py1)
    u01 = uv(px0, py1)
    for i in range(nu):
        for j in range(nv):
            p00, p10 = at(i, j), at(i + 1, j)
            p11, p01 = at(i + 1, j + 1), at(i, j + 1)
            mesh.quad((
                (*p00, *u00),
                (*p10, *u10),
                (*p11, *u11),
                (*p01, *u01),
            ))


def record(mesh, crop, tile):
    tw, th = tile
    return {
        "nv": len(mesh.verts) // 5,
        "ni": len(mesh.inds),
        "srcW": crop[2],
        "srcH": crop[3],
        "worldW": round(tw, 4),
        "worldH": round(th, 4),
        "depth": round(mesh.max[2] - mesh.min[2], 4),
        "minX": round(mesh.min[0], 4),
        "maxX": round(mesh.max[0], 4),
        "minY": round(mesh.min[1], 4),
        "maxY": round(mesh.max[1], 4),
        "minZ": round(mesh.min[2], 4),
        "maxZ": round(mesh.max[2], 4),
        "boxes": mesh.boxes,
        "solid": True,
        "_verts": mesh.verts,
        "_inds": mesh.inds,
    }


def build_pier(stone, tile, aw, ah):
    m = Mesh()
    x0 = HALF - 0.04
    # Inner and outer walls. Top edge first so the crop stays upright.
    grid(m, (x0, CROWN, -ZHALF), (x0, CROWN, ZHALF), (x0, 0.0, ZHALF), (x0, 0.0, -ZHALF), stone, tile[0], tile[1], aw, ah)
    grid(m, (OUTER, CROWN, ZHALF), (OUTER, CROWN, -ZHALF), (OUTER, 0.0, -ZHALF), (OUTER, 0.0, ZHALF), stone, tile[0], tile[1], aw, ah)
    grid(m, (x0, CROWN, -ZHALF), (OUTER, CROWN, -ZHALF), (OUTER, 0.0, -ZHALF), (x0, 0.0, -ZHALF), stone, tile[0], tile[1], aw, ah)
    grid(m, (OUTER, CROWN, ZHALF), (x0, CROWN, ZHALF), (x0, 0.0, ZHALF), (OUTER, 0.0, ZHALF), stone, tile[0], tile[1], aw, ah)
    grid(m, (x0, CROWN, -ZHALF), (x0, CROWN, ZHALF), (OUTER, CROWN, ZHALF), (OUTER, CROWN, -ZHALF), stone, tile[0], tile[1], aw, ah)
    m.box(x0, 0.0, -ZHALF, OUTER, CROWN, ZHALF)
    return m


def build_arch(x_a, x_b, stone, tile, aw, ah, steps):
    """Stone between two x stations. The soffit is the circle; the walk stays under it."""
    m = Mesh()
    span = x_b - x_a
    n = max(2, steps)
    xs = [x_a + span * i / n for i in range(n + 1)]
    for i in range(n):
        xa, xb = xs[i], xs[i + 1]
        ya, yb = soffit(xa), soffit(xb)
        y_lo = min(ya, yb)
        grid(
            m,
            (xa, ya, -ZHALF), (xb, yb, -ZHALF), (xb, yb, ZHALF), (xa, ya, ZHALF),
            stone, tile[0], tile[1], aw, ah,
        )
        grid(
            m,
            (xa, CROWN, -ZHALF), (xa, CROWN, ZHALF), (xb, CROWN, ZHALF), (xb, CROWN, -ZHALF),
            stone, tile[0], tile[1], aw, ah,
        )
        grid(
            m,
            (xa, CROWN, -ZHALF), (xb, CROWN, -ZHALF), (xb, yb, -ZHALF), (xa, ya, -ZHALF),
            stone, tile[0], tile[1], aw, ah,
        )
        grid(
            m,
            (xb, CROWN, ZHALF), (xa, CROWN, ZHALF), (xa, ya, ZHALF), (xb, yb, ZHALF),
            stone, tile[0], tile[1], aw, ah,
        )
        m.box(xa, y_lo - 0.02, -ZHALF, xb, CROWN, ZHALF)
    return m


def build_tower(metal, tile, aw, ah):
    m = Mesh()
    h = 2.15
    t = 0.40
    # Open at the bottom. The center of the arch is this shaft, so a tilt
    # from the walk looks up the lattice instead of into a stone lid.
    y0, y1 = TOWER_Y0, TOP
    # Four walls, thin enough to read as a shaft, thick enough to have a side.
    faces = (
        ((-h, y1, -h), (h, y1, -h), (h, y0, -h), (-h, y0, -h)),
        ((h, y1, -h - t), (-h, y1, -h - t), (-h, y0, -h - t), (h, y0, -h - t)),
        ((h, y1, h), (-h, y1, h), (-h, y0, h), (h, y0, h)),
        ((-h, y1, h + t), (h, y1, h + t), (h, y0, h + t), (-h, y0, h + t)),
        ((-h, y1, h), (-h, y1, -h), (-h, y0, -h), (-h, y0, h)),
        ((-h - t, y1, -h), (-h - t, y1, h), (-h - t, y0, h), (-h - t, y0, -h)),
        ((h, y1, -h), (h, y1, h), (h, y0, h), (h, y0, -h)),
        ((h + t, y1, h), (h + t, y1, -h), (h + t, y0, -h), (h + t, y0, h)),
    )
    for a, b, c, d in faces:
        grid(m, a, b, c, d, metal, tile[0], tile[1], aw, ah)
    # Cap so the shaft is not an open chimney from above.
    grid(m, (-h, y1, -h), (-h, y1, h), (h, y1, h), (h, y1, -h), metal, tile[0], tile[1], aw, ah)
    m.box(-h - t, y0, -h - t, -h, y1, h + t)
    m.box(h, y0, -h - t, h + t, y1, h + t)
    m.box(-h, y0, -h - t, h, y1, -h)
    m.box(-h, y0, h, h, y1, h + t)
    m.box(-h, y1 - 0.4, -h, h, y1, h)
    return m


def place(name, part, mirror=False):
    return {
        "name": name,
        "part": part,
        "x": 0.0,
        "z": ANCHOR_Z,
        "yaw": 0.0,
        "tilt": 0.0,
        "mirror": mirror,
        "sink": SINK,
        "lift": 0.0,
        "solid": True,
        "id": "hard:anchor",
    }


def world_box(box, mirror, base_y):
    xs, ys, zs = [], [], []
    x0, y0, z0, x1, y1, z1 = box
    s = -1 if mirror else 1
    for x in (x0, x1):
        for y in (y0, y1):
            for z in (z0, z1):
                xs.append(s * x)
                ys.append(base_y + y)
                zs.append(ANCHOR_Z + z)
    return (min(xs), min(ys), min(zs), max(xs), max(ys), max(zs))


def hits(box, x, y, z, pad=0.32):
    return box[0] - pad <= x <= box[3] + pad and box[1] <= y <= box[4] and box[2] - pad <= z <= box[5] + pad


def closest_aabb(rec, mirror, base_y, eye):
    corners = []
    s = -1 if mirror else 1
    for x in (rec["minX"], rec["maxX"]):
        for y in (rec["minY"], rec["maxY"]):
            for z in (rec["minZ"], rec["maxZ"]):
                corners.append((s * x, base_y + y, ANCHOR_Z + z))
    xs = [p[0] for p in corners]
    ys = [p[1] for p in corners]
    zs = [p[2] for p in corners]
    qx = min(max(eye[0], min(xs)), max(xs))
    qy = min(max(eye[1], min(ys)), max(ys))
    qz = min(max(eye[2], min(zs)), max(zs))
    return max(0.35, math.sqrt((eye[0] - qx) ** 2 + (eye[1] - qy) ** 2 + (eye[2] - qz) ** 2))


def mag_of(rec, d):
    mh = FOCAL * rec["worldH"] / (d * rec["srcH"])
    mw = FOCAL * rec["worldW"] / (d * rec["srcW"])
    return max(mh, mw)


def _pack(rest_v, rest_i, built):
    out_v = list(rest_v)
    out_i = list(rest_i)
    for rec in built.values():
        src_v = rec.pop("_verts")
        src_i = rec.pop("_inds")
        v0 = len(out_v) // 5
        i0 = len(out_i)
        out_v.extend(src_v)
        out_i.extend(i + v0 for i in src_i)
        rec["v0"] = v0
        rec["nv"] = len(src_v) // 5
        rec["i0"] = i0
        rec["ni"] = len(src_i)
    return out_v, out_i


def anchor_volume():
    loft_path = ROOT / "loft.json"
    mesh_path = ROOT / "mesh.bin"
    loft = json.loads(loft_path.read_text(encoding="utf-8"))
    blob = mesh_path.read_bytes()
    magic, nv, ni = struct.unpack_from("<III", blob, 0)
    if magic != 0x3148534D:
        raise SystemExit("mesh magic")
    verts = list(struct.unpack_from("<" + "f" * (nv * 5), blob, 12))
    inds = list(struct.unpack_from("<" + "I" * ni, blob, 12 + nv * 5 * 4))
    part = loft["parts"]["anchor"]
    if part["v0"] != 0 or part["i0"] != 0:
        raise SystemExit("anchor is no longer the first mesh section")
    aw = float(loft["atlasW"])
    ah = float(loft["atlasH"])
    stone_tile = tile_for(STONE, STONE_D)
    metal_tile = tile_for(METAL, METAL_D)
    pieces = (
        ("anchor-pier", build_pier(STONE, stone_tile, aw, ah), STONE, stone_tile),
        ("anchor-side", build_arch(SIDE, HALF, STONE, stone_tile, aw, ah, 4), STONE, stone_tile),
        ("anchor", build_tower(METAL, metal_tile, aw, ah), METAL, metal_tile),
    )
    built = {name: record(mesh, crop, tile) for name, mesh, crop, tile in pieces}
    if built["anchor"]["maxY"] < 59.0:
        raise SystemExit(f"tower short {built['anchor']['maxY']}")
    if built["anchor-pier"]["minY"] > 0.05:
        raise SystemExit("pier does not meet the ground")
    old_nv = part["nv"]
    old_ni = part["ni"]
    rest_v = verts[old_nv * 5 :]
    rest_i = []
    for idx in inds[old_ni:]:
        if idx < old_nv:
            raise SystemExit("index points into the old anchor")
        rest_i.append(idx - old_nv)
    for name, other in list(loft["parts"].items()):
        if name == "anchor":
            continue
        if other["v0"] >= old_nv:
            other["v0"] -= old_nv
        if other["i0"] >= old_ni:
            other["i0"] -= old_ni
    out_v, out_i = _pack(rest_v, rest_i, built)
    del loft["parts"]["anchor"]
    for name, rec in built.items():
        loft["parts"][name] = rec
    kept = [p for p in loft["placements"] if p.get("part") != "anchor" and not str(p.get("name", "")).startswith("anchor")]
    kept.extend((
        place("anchor-pier", "anchor-pier", False),
        place("anchor-pier-m", "anchor-pier", True),
        place("anchor-side", "anchor-side", False),
        place("anchor-side-m", "anchor-side", True),
        place("anchor", "anchor", False),
    ))
    loft["placements"] = kept
    base_y = -SINK
    solids = []
    for p in kept:
        if p.get("part") not in built:
            continue
        for b in built[p["part"]]["boxes"]:
            solids.append(world_box(b, p["mirror"], base_y))
    blocked = []
    for z in (ANCHOR_Z - 6, ANCHOR_Z, ANCHOR_Z + 6):
        for y in (0.4, 1.2, 2.0):
            for s in solids:
                if hits(s, 0.0, y, z, 0.32):
                    blocked.append((round(y, 2), round(z, 2)))
                    break
    if blocked:
        raise SystemExit(f"arch center still solid {blocked[:6]}")
    pier_hit = False
    for s in solids:
        if hits(s, HALF + 1.0, 1.2, ANCHOR_Z, 0.0):
            pier_hit = True
            break
    if not pier_hit:
        raise SystemExit("pier lost its collider")
    # Chase along the center. Slide 0 must stay at or under magnification 1.
    posed = (
        ("anchor-pier", False),
        ("anchor-pier", True),
        ("anchor-side", False),
        ("anchor-side", True),
        ("anchor", False),
    )
    worst = 0.0
    worst_at = None
    for bz in (80, 120, 150, 166, 172, ANCHOR_Z, 184, 196):
        for boom in (4.0, 7.2):
            for eye_h in (1.35, 8.0):
                eye = (0.0, eye_h, bz - boom)
                m = 0.0
                for name, mirror in posed:
                    d = closest_aabb(built[name], mirror, base_y, eye)
                    m = max(m, mag_of(built[name], d))
                # Beacon, 2 m on a 480 px still.
                lamp = (0.4, base_y + 58.4, ANCHOR_Z - 2.6)
                db = max(0.35, math.sqrt(sum((eye[i] - lamp[i]) ** 2 for i in range(3))))
                m = max(m, FOCAL * 2.0 / (db * 480))
                if m > worst:
                    worst = m
                    worst_at = (round(bz, 2), boom, eye_h, round(m, 3))
    if worst > 1.0:
        raise SystemExit(f"walk mag {worst:.3f} at {worst_at}")
    loft["anchor"]["h"] = 60.0
    loft["anchor"]["z"] = ANCHOR_Z
    loft["anchor"]["minWalkM"] = 0.0
    loft["anchor"]["openingM"] = round(HALF * 2, 3)
    loft["anchor"]["depthM"] = ZHALF * 2
    loft["anchor"]["springM"] = SPRING
    loft["anchor"]["crownM"] = CROWN
    beacon = loft["beacon"]
    beacon["x"] = 0.0
    beacon["z"] = ANCHOR_Z
    beacon["yaw"] = 0.0
    beacon["lx"] = 0.4
    beacon["ly"] = 58.4
    beacon["lz"] = -2.6
    beacon["size"] = 2.0
    beacon["src"] = 480
    packed = struct.pack("<III", 0x3148534D, len(out_v) // 5, len(out_i))
    packed += struct.pack("<" + "f" * len(out_v), *out_v)
    packed += struct.pack("<" + "I" * len(out_i), *out_i)
    mesh_path.write_bytes(packed)
    loft_path.write_text(json.dumps(loft), encoding="utf-8")
    print(
        f"anchor volume opening {HALF * 2:.2f} depth {ZHALF * 2:.1f} "
        f"spring {SPRING:.1f} crown {CROWN:.1f} top {built['anchor']['maxY']:.2f}"
    )
    print(
        f"stone tile {stone_tile[0]:.3f}x{stone_tile[1]:.3f} m on {STONE[2]}x{STONE[3]} px  "
        f"metal tile {metal_tile[0]:.3f}x{metal_tile[1]:.3f} m"
    )
    for name, rec in built.items():
        print(
            f"  {name} verts {rec['nv']} tris {rec['ni'] // 3} boxes {len(rec['boxes'])} "
            f"y {rec['minY']:.2f}..{rec['maxY']:.2f} x {rec['minX']:.2f}..{rec['maxX']:.2f}"
        )
    print(f"worst center mag {worst:.3f} at {worst_at}")
    print(f"mesh.bin verts {len(out_v) // 5}")
    print("PASS anchor-volume")


if __name__ == "__main__":
    anchor_volume()

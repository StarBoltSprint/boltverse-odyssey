"""Top-down kitchen diagram of invisible shape. Not a play view. Not Imagine pixels."""

from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path


def write_diagram(path: Path, clearing: dict, extra: dict | None = None) -> None:
    zone = clearing.get("zone") or {}
    if str(zone.get("shape") or "") == "organic" or clearing.get("schema") == "clearing/2":
        _write_organic(path, clearing, extra or {})
        return
    extra = extra or {}
    size = 960
    rgb = bytearray([22, 26, 32]) * (size * size)
    zone = clearing.get("zone") or {}
    edge = clearing.get("edge_ring") or {}
    zone_r = float(zone.get("radius_m") or edge.get("radius_m") or 20)
    ring_r = float(edge.get("radius_m") or zone_r)
    origin = extra.get("origin") or zone.get("center") or [0, 0]
    ox, oz = float(origin[0]), float(origin[1])
    span = zone_r * 2.35
    scale = (size - 48) / span

    def to_px(x: float, z: float) -> tuple[int, int]:
        return (
            int(size * 0.5 + (x - ox) * scale),
            int(size * 0.5 - (z - oz) * scale),
        )

    def put(x: int, y: int, color: tuple[int, int, int]) -> None:
        if 0 <= x < size and 0 <= y < size:
            i = (y * size + x) * 3
            rgb[i : i + 3] = bytes(color)

    def disk(cx: float, cz: float, r: float, color: tuple[int, int, int], fill: bool) -> None:
        px, py = to_px(cx, cz)
        rad = max(1, int(r * scale))
        if fill:
            for y in range(py - rad, py + rad + 1):
                for x in range(px - rad, px + rad + 1):
                    if (x - px) * (x - px) + (y - py) * (y - py) <= rad * rad:
                        put(x, y, color)
        else:
            ring(px, py, rad, color)

    def ring(px: int, py: int, rad: int, color: tuple[int, int, int]) -> None:
        # Outline only, two pixels thick.
        for s in range(720):
            a = (math.tau * s) / 720.0
            x = int(px + math.cos(a) * rad)
            y = int(py + math.sin(a) * rad)
            put(x, y, color)
            put(x + 1, y, color)

    def line(x0: float, z0: float, x1: float, z1: float, color: tuple[int, int, int]) -> None:
        ax, ay = to_px(x0, z0)
        bx, by = to_px(x1, z1)
        steps = max(abs(bx - ax), abs(by - ay), 1)
        for s in range(steps + 1):
            t = s / steps
            put(int(ax + (bx - ax) * t), int(ay + (by - ay) * t), color)

    disk(ox, oz, zone_r, (70, 78, 90), False)
    disk(ox, oz, ring_r, (90, 98, 112), False)
    spawn = extra.get("spawn") or (clearing.get("spawn") or {}).get("position") or [ox, oz]
    sx, sz = float(spawn[0]), float(spawn[1])
    need = float((clearing.get("limits") or {}).get("spawn_clearance_m") or 0)
    if need:
        disk(sx, sz, need, (36, 64, 92), False)

    hero_w = float(extra.get("hero_w") or (clearing.get("hero") or {}).get("width_m") or 0.6)
    path_w = float(extra.get("path_w") or (clearing.get("limits") or {}).get("path_width_m") or hero_w)
    cone_m = float(extra.get("cone_m") or (clearing.get("limits") or {}).get("gate_cone_m") or 5)
    cone_half = float(extra.get("cone_half") or (clearing.get("limits") or {}).get("gate_cone_half_deg") or 28)
    for g in clearing.get("gates") or []:
        heading = float(g.get("heading_deg") or 0)
        a = math.radians(heading)
        mx = ox + math.sin(a) * ring_r
        mz = oz + math.cos(a) * ring_r
        line(sx, sz, mx, mz, (210, 170, 70))
        # Path width ticks at the mouth.
        left = heading + 90
        lx = mx + math.sin(math.radians(left)) * (path_w * 0.5)
        lz = mz + math.cos(math.radians(left)) * (path_w * 0.5)
        rx = mx - math.sin(math.radians(left)) * (path_w * 0.5)
        rz = mz - math.cos(math.radians(left)) * (path_w * 0.5)
        line(lx, lz, rx, rz, (210, 170, 70))
        inward = heading + 180.0
        for side in (-cone_half, cone_half):
            b = math.radians(inward + side)
            line(mx, mz, mx + math.sin(b) * cone_m, mz + math.cos(b) * cone_m, (150, 110, 60))

    for c in clearing.get("colliders") or []:
        center = c.get("center") or [0, 0]
        disk(float(center[0]), float(center[1]), float(c.get("radius_m") or 0.2), (150, 48, 48), True)
    for group in (clearing.get("edge_ring") or {}).get("hulls") or []:
        pos = group.get("position") or [0, 0]
        disk(float(pos[0]), float(pos[1]), float(group.get("radius_m") or 0.2), (40, 190, 110), False)
    for obj in clearing.get("interior_objects") or []:
        pos = obj.get("position") or [0, 0]
        disk(float(pos[0]), float(pos[1]), float(obj.get("radius_m") or 0.2), (80, 200, 230), False)

    gap = (extra or {}).get("visual_gap") or {}
    if gap.get("deg", 0) > 1:
        at = float(gap.get("at") or 0)
        length = float(gap.get("deg") or 0)
        for s in range(0, int(length), 2):
            b = math.radians(at + s)
            line(ox, oz, ox + math.sin(b) * ring_r, oz + math.cos(b) * ring_r, (230, 190, 40))

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(_png(size, size, bytes(rgb)))


def _write_organic(path: Path, clearing: dict, extra: dict) -> None:
    """Polygon, boundary pieces, gates, sub-areas, and passages. Kitchen diagram only."""
    size = 960
    rgb = bytearray([22, 26, 32]) * (size * size)
    zone = clearing.get("zone") or {}
    foot = [(float(p[0]), float(p[1])) for p in (zone.get("footprint") or [])]
    if len(foot) < 3:
        foot = [(0.0, 0.0), (10.0, 0.0), (0.0, 10.0)]
    xs = [p[0] for p in foot]
    zs = [p[1] for p in foot]
    minx, maxx = min(xs), max(xs)
    minz, maxz = min(zs), max(zs)
    span0 = max(maxx - minx, maxz - minz, 1.0)
    cx0 = (minx + maxx) * 0.5
    cz0 = (minz + maxz) * 0.5
    limit = span0 * 2.2

    def keep(x: float, z: float) -> bool:
        return max(abs(x - cx0), abs(z - cz0)) <= limit

    for cell in clearing.get("cells") or []:
        aabb = cell.get("aabb") or []
        if len(aabb) == 2:
            for corner in aabb:
                if keep(float(corner[0]), float(corner[1])):
                    xs.append(float(corner[0]))
                    zs.append(float(corner[1]))
    for obj in list(clearing.get("far_plates") or []) + list(clearing.get("pois") or []):
        pos = obj.get("position") or [cx0, cz0]
        if keep(float(pos[0]), float(pos[1])):
            xs.append(float(pos[0]))
            zs.append(float(pos[1]))
    minx, maxx = min(xs), max(xs)
    minz, maxz = min(zs), max(zs)
    span = max(maxx - minx, maxz - minz, 1.0) * 1.22
    ox = (minx + maxx) * 0.5
    oz = (minz + maxz) * 0.5
    scale = (size - 48) / span

    def to_px(x: float, z: float) -> tuple[int, int]:
        return (
            int(size * 0.5 + (x - ox) * scale),
            int(size * 0.5 - (z - oz) * scale),
        )

    def put(x: int, y: int, color: tuple[int, int, int]) -> None:
        if 0 <= x < size and 0 <= y < size:
            i = (y * size + x) * 3
            rgb[i : i + 3] = bytes(color)

    def disk(cx: float, cz: float, r: float, color: tuple[int, int, int], fill: bool) -> None:
        px, py = to_px(cx, cz)
        rad = max(1, int(abs(r) * scale))
        if fill:
            for y in range(py - rad, py + rad + 1):
                for x in range(px - rad, px + rad + 1):
                    if (x - px) * (x - px) + (y - py) * (y - py) <= rad * rad:
                        put(x, y, color)
        else:
            for s in range(720):
                a = (math.tau * s) / 720.0
                put(int(px + math.cos(a) * rad), int(py + math.sin(a) * rad), color)

    def line(x0: float, z0: float, x1: float, z1: float, color: tuple[int, int, int]) -> None:
        ax, ay = to_px(x0, z0)
        bx, by = to_px(x1, z1)
        steps = max(abs(bx - ax), abs(by - ay), 1)
        for s in range(steps + 1):
            t = s / steps
            put(int(ax + (bx - ax) * t), int(ay + (by - ay) * t), color)

    band_color = {
        "fore": (140, 190, 120),
        "mid": (90, 170, 210),
        "far": (190, 160, 90),
    }
    intent_color = {
        "hidden_from_spawn": (170, 90, 190),
        "landmark": (210, 90, 70),
        "on_route": (70, 200, 170),
    }
    for cell in clearing.get("cells") or []:
        aabb = cell.get("aabb") or []
        if len(aabb) != 2:
            continue
        x0, z0 = float(aabb[0][0]), float(aabb[0][1])
        x1, z1 = float(aabb[1][0]), float(aabb[1][1])
        line(x0, z0, x1, z0, (60, 70, 90))
        line(x1, z0, x1, z1, (60, 70, 90))
        line(x1, z1, x0, z1, (60, 70, 90))
        line(x0, z1, x0, z0, (60, 70, 90))
    n = len(foot)
    for i in range(n):
        a = foot[i]
        b = foot[(i + 1) % n]
        line(a[0], a[1], b[0], b[1], (90, 98, 112))
    for area in clearing.get("sub_areas") or []:
        c = area.get("center") or [0, 0]
        disk(float(c[0]), float(c[1]), float(area.get("radius_m") or 1), (70, 78, 90), False)
    for passage in clearing.get("passages") or []:
        pts = passage.get("center") or passage.get("polyline") or []
        for i in range(len(pts) - 1):
            line(float(pts[i][0]), float(pts[i][1]), float(pts[i + 1][0]), float(pts[i + 1][1]), (210, 170, 70))
    for piece in (clearing.get("boundary") or {}).get("pieces") or []:
        pos = piece.get("position") or [0, 0]
        disk(float(pos[0]), float(pos[1]), float(piece.get("radius_m") or 0.4), (40, 190, 110), False)
    for obj in clearing.get("interior_objects") or []:
        pos = obj.get("position") or [0, 0]
        color = band_color.get(str(obj.get("band") or ""), (80, 200, 230))
        disk(float(pos[0]), float(pos[1]), float(obj.get("radius_m") or 0.3), color, False)
    for poi in clearing.get("pois") or []:
        pos = poi.get("position") or [0, 0]
        color = intent_color.get(str(poi.get("intent") or ""), (210, 90, 70))
        disk(float(pos[0]), float(pos[1]), max(1.2, float(poi.get("radius_m") or 0.4)), color, True)
    for plate in clearing.get("far_plates") or []:
        pos = plate.get("position") or [ox, oz]
        px, pz = float(pos[0]), float(pos[1])
        if not keep(px, pz):
            vx, vz = px - cx0, pz - cz0
            norm = math.hypot(vx, vz) or 1.0
            px = cx0 + vx / norm * limit * 0.98
            pz = cz0 + vz / norm * limit * 0.98
        disk(px, pz, max(1.4, float(plate.get("radius_m") or 1.0)), (200, 120, 60), False)
    spawn = (clearing.get("spawn") or {}).get("position") or [ox, oz]
    disk(float(spawn[0]), float(spawn[1]), 1.2, (36, 64, 92), False)
    for gate in clearing.get("gates") or []:
        pos = gate.get("position") or [ox, oz]
        disk(float(pos[0]), float(pos[1]), 1.6, (210, 170, 70), True)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(_png(size, size, bytes(rgb)))


def _png(w: int, h: int, rgb: bytes) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + rgb[y * w * 3 : (y + 1) * w * 3] for y in range(h))
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b"")

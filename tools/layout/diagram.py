"""Top-down kitchen diagram of invisible shape. Not a play view. Not Imagine pixels."""

from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path


def write_diagram(path: Path, clearing: dict, extra: dict | None = None) -> None:
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


def _png(w: int, h: int, rgb: bytes) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + rgb[y * w * 3 : (y + 1) * w * 3] for y in range(h))
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b"")

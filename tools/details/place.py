"""Deterministic detail placement. Positions only. No pixels."""
from __future__ import annotations

import json
import math
from pathlib import Path


def u32(n: int) -> int:
    return n & 0xFFFFFFFF


def hash01(i: int, k: int, seed: int) -> float:
    n = u32(i * 374761393 + k * 668265263 + seed * 1442695041)
    n = u32(n ^ (n >> 13))
    n = u32(n * 1274126177)
    n = u32(n ^ (n >> 16))
    return n / 4294967296.0


def type_seed(name: str, seed: int) -> int:
    s = seed & 0xFFFFFFFF
    for ch in name:
        s = u32(s * 33 + ord(ch))
    return s


def radius_unit(th: float) -> float:
    r = 1.0
    r += 0.22 * math.sin(2 * th + 0.4)
    r += 0.14 * math.sin(3 * th + 1.15)
    r += 0.09 * math.sin(5 * th - 0.7)
    r += 0.05 * math.sin(7 * th + 2.05)
    return r


def _unit_area() -> float:
    n = 2048
    d = (math.pi * 2) / n
    a = 0.0
    for i in range(n):
        r = radius_unit(i * d)
        a += 0.5 * r * r * d
    return a


SCALE = math.sqrt(6500.0 / _unit_area())


def radius_at(th: float) -> float:
    return radius_unit(th) * SCALE


def crack_amt(x: float, z: float) -> float:
    f = abs(math.sin(x * 0.29 + math.sin(z * 0.16) * 1.35))
    g = abs(math.sin(z * 0.24 + math.sin(x * 0.12) * 1.15))
    return min(f, g)


def macro_at(x: float, z: float) -> float:
    rho = math.hypot(x, z)
    th = math.atan2(x, z)
    radius = radius_at(th)
    u = rho / max(1.0, radius)
    hd = 0.55
    ax = math.sin(hd)
    az = math.cos(hd)
    along = x * ax + z * az
    across = -x * az + z * ax
    crest_c = 0.62 * radius_at(hd)
    h = 0.0
    crest = math.exp(-((along - crest_c) ** 2) / (2 * 18 * 18) - (across ** 2) / (2 * 8.5 * 8.5))
    h += 6.4 * (crest ** 0.62)
    if h > 5.2:
        h = 5.2 + (h - 5.2) * 0.18
    dline = abs(x + 11 - 0.26 * z)
    win = math.exp(-((z + 4) ** 2) / (2 * 18 * 18))
    h += 3.1 * math.exp(-(dline ** 2) / (2 * 7.4 * 7.4)) * win
    cx = 8.2 * math.sin(z * 0.08)
    cd = x - cx
    cwin = math.exp(-(z * z) / (2 * 36 * 36))
    h -= 1.05 * math.exp(-(cd * cd) / (2 * 5.6 * 5.6)) * cwin
    b1x = x + 20
    b1z = z - 9
    h -= 2.2 * math.exp(-(b1x * b1x) / (2 * 12 * 12) - (b1z * b1z) / (2 * 8 * 8))
    b2x = x - 15
    b2z = z + 18
    h -= 1.2 * math.exp(-(b2x * b2x) / (2 * 13 * 13) - (b2z * b2z) / (2 * 6.2 * 6.2))
    crack = crack_amt(x, z)
    if crack < 0.15:
        h -= (0.15 - crack) * 0.7
    if u > 0.9:
        t = (u - 0.9) / 0.14
        h += t * t * 2.6
    return h


def crack_yaw(x: float, z: float) -> float:
    e = 0.35
    dx = crack_amt(x + e, z) - crack_amt(x - e, z)
    dz = crack_amt(x, z + e) - crack_amt(x, z - e)
    if dx * dx + dz * dz < 1e-8:
        return 0.0
    return math.degrees(math.atan2(-dz, dx))


def load_solids(root: Path, pack: str) -> list[tuple[float, float, float]]:
    path = root / pack / "src" / "rocks" / "manifest.json"
    if not path.is_file():
        return []
    man = json.loads(path.read_text())
    types = man.get("types") or {}
    out = []
    for inst in man.get("instances") or []:
        spec = types.get(inst.get("type")) or {}
        if spec.get("kind") != "hull":
            continue
        size = spec.get("objectSize") or [1, 1, 1]
        radius = 0.5 * math.hypot(float(size[0]), float(size[2])) * float(inst.get("scale") or 1)
        out.append((float(inst["x"]), float(inst["z"]), radius))
    return out


def place(numbers: dict, solids: list[tuple[float, float, float]], variants: dict) -> tuple[list[dict], dict]:
    seed = int(numbers["seed"])
    cor = numbers["corridor"]
    bands = numbers["bands"]
    heading = math.radians(float(cor["headingDeg"]))
    fx, fz = math.sin(heading), math.cos(heading)
    rx, rz = fz, -fx
    spawn = cor["spawn"]
    sx, sz = float(spawn[0]), float(spawn[1])
    length = float(cor["lengthM"])
    behind = float(bands["behindM"])
    far_half = float(bands["farHalf"])
    mid_half = float(bands["midHalf"])
    near_half = float(bands["nearHalf"])
    clearing_r = float(bands["clearingR"])
    inside = float(bands["insideFrac"])
    cross = float(numbers["crossSepM"])
    neighbour = float(numbers["neighbourM"])
    spawn_clear = float(numbers.get("spawnClearM") or 0)
    cell = 0.5
    grid: dict[tuple[int, int], list] = {}
    instances: list[dict] = []

    def cell_of(x: float, z: float) -> tuple[int, int]:
        return (math.floor(x / cell), math.floor(z / cell))

    def nearby(x: float, z: float, reach: float):
        ix, iz = cell_of(x, z)
        r = int(math.ceil(reach / cell)) + 1
        for dx in range(-r, r + 1):
            for dz in range(-r, r + 1):
                for item in grid.get((ix + dx, iz + dz), ()):
                    yield item

    by_type = {name: 0 for name in numbers["types"]}
    tries = 0
    for name, spec in numbers["types"].items():
        group = variants.get(name) or []
        if not group:
            raise SystemExit(f"FAIL details: no variants for {name}")
        need = int(spec["count"])
        sep = float(spec["minSeparation"])
        tseed = type_seed(name, seed)
        got = 0
        attempt = 0
        limit = need * 80
        while got < need and attempt < limit:
            attempt += 1
            tries += 1
            i = attempt
            along = -behind + hash01(i, 1, tseed) * (length + behind + 2.0)
            roll = hash01(i, 2, tseed)
            span = hash01(i, 4, tseed)
            if name == "pebble" and solids and hash01(i, 11, tseed) < 0.28:
                px, pz, pr = solids[int(hash01(i, 12, tseed) * len(solids)) % len(solids)]
                ang = hash01(i, 13, tseed) * math.tau
                rad = pr + 0.55 + hash01(i, 14, tseed) * 1.5
                x = px + math.cos(ang) * rad
                z = pz + math.sin(ang) * rad
                lat = (x - sx) * rx + (z - sz) * rz
                along = (x - sx) * fx + (z - sz) * fz
            else:
                if roll < 0.72:
                    lat = span * near_half
                elif roll < 0.90:
                    lat = near_half + span * (mid_half - near_half)
                else:
                    lat = mid_half + span * (far_half - mid_half)
                if hash01(i, 3, tseed) < 0.5:
                    lat = -lat
                x = sx + fx * along + rx * lat
                z = sz + fz * along + rz * lat
            rho = math.hypot(x, z)
            th = math.atan2(x, z)
            if rho > radius_at(th) * inside:
                continue
            across = abs((x - sx) * rx + (z - sz) * rz)
            spawn_d = math.hypot(x - sx, z - sz)
            if spawn_d < spawn_clear:
                continue
            if across > far_half and spawn_d > clearing_r:
                continue
            crack = crack_amt(x, z)
            height = macro_at(x, z)
            gate = hash01(i, 5, tseed)
            if name == "ridge" and not (height < -0.2 or crack < 0.16) and gate > 0.42:
                continue
            if name == "shard" and crack > 0.4 and gate > 0.7:
                continue
            if name == "tuft" and (height < -0.7 or height > 1.3) and gate > 0.5:
                continue
            blocked = False
            for px, pz, pr in solids:
                if math.hypot(x - px, z - pz) < pr + 0.1:
                    blocked = True
                    break
            if blocked:
                continue
            conflict = False
            for item in nearby(x, z, max(sep, cross)):
                d2 = (item[0] - x) ** 2 + (item[1] - z) ** 2
                limit_m = sep if item[2] == name else cross
                if d2 < limit_m * limit_m:
                    conflict = True
                    break
            if conflict:
                continue
            hv = hash01(i, 6, tseed)
            local = int(hv * len(group)) % len(group)
            yaw_h = hash01(i, 7, tseed)
            if spec.get("align") == "fissure":
                yaw = (crack_yaw(x, z) + (yaw_h - 0.5) * 40.0) % 360.0
            else:
                yaw = (yaw_h * 360.0) % 360.0
            for item in nearby(x, z, neighbour):
                if item[2] != name:
                    continue
                d2 = (item[0] - x) ** 2 + (item[1] - z) ** 2
                if d2 > neighbour * neighbour:
                    continue
                if item[4] == local:
                    local = (local + 1 + int(hash01(i, 8, tseed) * 3)) % len(group)
                gap = abs((yaw - item[3] + 180.0) % 360.0 - 180.0)
                if gap < 28.0:
                    yaw = (yaw + 53.0) % 360.0
                break
            sc0, sc1 = spec["scale"]
            scale = float(sc0) + hash01(i, 9, tseed) * (float(sc1) - float(sc0))
            h0, h1 = spec["heightM"]
            cap = float(group[local]["maxHeightM"])
            hi = min(float(h1), cap)
            lo = min(float(h0), hi)
            height_m = lo + hash01(i, 10, tseed) * (hi - lo)
            rec = (
                x,
                z,
                name,
                yaw,
                local,
                sep,
            )
            grid.setdefault(cell_of(x, z), []).append(rec)
            instances.append({
                "type": name,
                "variant": local,
                "x": round(x, 3),
                "z": round(z, 3),
                "yaw": round(yaw, 1),
                "scale": round(scale, 3),
                "heightM": round(height_m, 4),
                "planes": int(spec["planes"]),
            })
            got += 1
        by_type[name] = got

    def frame(x: float, z: float) -> tuple[float, float]:
        dx = x - sx
        dz = z - sz
        return dx * fx + dz * fz, dx * rx + dz * rz

    near_n = 0
    far_n = 0
    clearing_n = 0
    along_lo, along_hi = 0.0, 36.0
    for inst in instances:
        along, lat = frame(inst["x"], inst["z"])
        if math.hypot(inst["x"] - sx, inst["z"] - sz) <= clearing_r:
            clearing_n += 1
        if along < along_lo or along > along_hi:
            continue
        if abs(lat) <= near_half:
            near_n += 1
        elif mid_half < abs(lat) <= far_half:
            far_n += 1
    near_area = max(1.0, (along_hi - along_lo) * 2.0 * near_half)
    far_area = max(1.0, (along_hi - along_lo) * 2.0 * (far_half - mid_half))
    quads = sum(int(i["planes"]) for i in instances)
    stats = {
        "placed": len(instances),
        "drawn": quads,
        "byType": by_type,
        "tries": tries,
        "nearCount": near_n,
        "farCount": far_n,
        "nearPerM2": round(near_n / near_area, 4),
        "farPerM2": round(far_n / far_area, 4),
        "clearing": clearing_n,
    }
    return instances, stats

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

    def rejected(x: float, z: float, name: str, gate: float) -> bool:
        rho = math.hypot(x, z)
        th = math.atan2(x, z)
        if rho > radius_at(th) * inside:
            return True
        across = abs((x - sx) * rx + (z - sz) * rz)
        spawn_d = math.hypot(x - sx, z - sz)
        if spawn_d < spawn_clear:
            return True
        if across > far_half and spawn_d > clearing_r:
            return True
        crack = crack_amt(x, z)
        height = macro_at(x, z)
        if name == "ridge" and not (height < -0.2 or crack < 0.16) and gate > 0.42:
            return True
        if name == "shard" and crack > 0.4 and gate > 0.7:
            return True
        if name == "tuft" and (height < -0.7 or height > 1.3) and gate > 0.5:
            return True
        for px, pz, pr in solids:
            if math.hypot(x - px, z - pz) < pr + 0.1:
                return True
        return False

    def add(x: float, z: float, name: str, i: int, tseed: int, sep: float, cross_m: float) -> bool:
        spec = numbers["types"][name]
        group = variants[name]
        if rejected(x, z, name, hash01(i, 5, tseed)):
            return False
        for item in nearby(x, z, max(sep, cross_m)):
            d2 = (item[0] - x) ** 2 + (item[1] - z) ** 2
            limit_m = sep if item[2] == name else cross_m
            if d2 < limit_m * limit_m:
                return False
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
        grid.setdefault(cell_of(x, z), []).append((x, z, name, yaw, local, sep))
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
        by_type[name] += 1
        return True

    for name in numbers["types"]:
        if not variants.get(name):
            raise SystemExit(f"FAIL details: no variants for {name}")

    # Clumps first: small mixed groups (a stone with chips and a tuft at its
    # foot) read as one terrain feature from the chase boom, where a lone
    # 15 cm card is a fleck. Centres follow the same bands; members are
    # scattered inside a jittered radius, never on a ring or a row.
    clumps = numbers.get("clumps") or {}
    clump_n = int(clumps.get("count") or 0)
    clump_made = 0
    if clump_n:
        cseed = type_seed("clump", seed)
        mix = clumps["mix"]
        mix_names = [m for m in mix if m in numbers["types"]]
        mix_total = sum(float(mix[m]) for m in mix_names)
        m0, m1 = clumps["members"]
        crad = float(clumps["radiusM"])
        csep = float(clumps["sepM"])
        cnear = float(clumps.get("nearFrac", 0.8))
        attempt = 0
        while clump_made < clump_n and attempt < clump_n * 40:
            attempt += 1
            tries += 1
            i = attempt
            along = -behind + hash01(i, 1, cseed) * (length + behind + 2.0)
            span = hash01(i, 4, cseed)
            if hash01(i, 2, cseed) < cnear:
                lat = span * near_half
            else:
                lat = near_half + span * (mid_half - near_half)
            if hash01(i, 3, cseed) < 0.5:
                lat = -lat
            cx = sx + fx * along + rx * lat
            cz = sz + fz * along + rz * lat
            if rejected(cx, cz, "", 0.0):
                continue
            # keep clump centres apart so clumps do not merge into a carpet
            if any((it[0] - cx) ** 2 + (it[1] - cz) ** 2 < (crad * 1.6) ** 2 for it in nearby(cx, cz, crad * 1.6)):
                continue
            want = int(m0) + int(hash01(i, 5, cseed) * (int(m1) - int(m0) + 1))
            got = 0
            for k in range(want * 4):
                if got >= want:
                    break
                j = i * 97 + k
                pick = hash01(j, 21, cseed) * mix_total
                name = mix_names[-1]
                for m in mix_names:
                    pick -= float(mix[m])
                    if pick <= 0:
                        name = m
                        break
                ang = hash01(j, 22, cseed) * math.tau
                rad = crad * math.sqrt(hash01(j, 23, cseed)) * (0.55 + 0.45 * radius_unit(ang + i))
                x = cx + math.cos(ang) * rad
                z = cz + math.sin(ang) * rad
                if add(x, z, name, j, type_seed(name, seed), csep, csep * 0.8):
                    got += 1
            if got:
                clump_made += 1

    for name, spec in numbers["types"].items():
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
            if add(x, z, name, i, tseed, sep, cross):
                got += 1

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
        "clumps": clump_made,
    }
    return instances, stats


def mag_height_cap(content_h: float, horiz: float, eye: float, focal: float) -> float:
    """Tallest world height whose centre stays at magnification 1 when the eye
    is `horiz` metres off to the side and `eye` metres above the base."""
    lo = 0.05
    hi = 2.4
    best = lo
    pixels = max(float(content_h), 1.0)
    for _ in range(28):
        h = (lo + hi) * 0.5
        dist = math.hypot(max(float(horiz), 0.05), float(eye) - h * 0.5)
        mag = (float(focal) * h) / (dist * pixels)
        if mag <= 1.0:
            best = h
            lo = h
        else:
            hi = h
    return best


def place_features(numbers: dict, solids: list[tuple[float, float, float]], variants: dict) -> tuple[list[dict], dict]:
    """Fewer, larger, one plane each. Tall cards stay off the running line.
    World height is clamped to the still's own texel cap."""
    feat = numbers.get("features") or {}
    types = feat.get("types") or {}
    if not types:
        return [], {"placed": 0, "drawn": 0, "byType": {}}
    seed = int(numbers["seed"]) + 17
    cor = numbers["corridor"]
    bands = numbers["bands"]
    heading_deg = float(cor["headingDeg"])
    heading = math.radians(heading_deg)
    fx, fz = math.sin(heading), math.cos(heading)
    rx, rz = fz, -fx
    sx, sz = float(cor["spawn"][0]), float(cor["spawn"][1])
    length = float(cor["lengthM"])
    behind = float(bands["behindM"])
    far_half = float(bands["farHalf"])
    mid_half = float(bands["midHalf"])
    inside = float(bands["insideFrac"])
    spawn_clear = float(numbers.get("spawnClearM") or 0)
    slide = float(feat.get("slideM", 1.0))
    eye = float(feat.get("eyeM", 1.30))
    focal = float(feat.get("focalPx", numbers.get("focalPx") or 1793))
    run_clear = float(feat.get("runClearM", 0.95))
    bury = float(feat.get("buryM", 0.05))
    cell = 0.5
    grid: dict[tuple[int, int], list] = {}
    instances: list[dict] = []
    by_type = {name: 0 for name in types}

    def cell_of(x: float, z: float) -> tuple[int, int]:
        return (math.floor(x / cell), math.floor(z / cell))

    def nearby(x: float, z: float, reach: float):
        ix, iz = cell_of(x, z)
        r = int(math.ceil(reach / cell)) + 1
        for dx in range(-r, r + 1):
            for dz in range(-r, r + 1):
                for item in grid.get((ix + dx, iz + dz), ()):
                    yield item

    def rejected(x: float, z: float) -> bool:
        rho = math.hypot(x, z)
        th = math.atan2(x, z)
        if rho > radius_at(th) * inside:
            return True
        if math.hypot(x - sx, z - sz) < spawn_clear:
            return True
        for px, pz, pr in solids:
            if math.hypot(x - px, z - pz) < pr + 0.35:
                return True
        return False

    for name, spec in types.items():
        group = variants.get(name) or []
        if not group:
            raise SystemExit(f"FAIL details: no feature variants for {name}")
        need = int(spec["count"])
        sep = float(spec["minSeparation"])
        min_across = float(spec["minAcross"])
        bias = float(spec.get("crestBias") or 0)
        tseed = type_seed("feat-" + name, seed)
        got = 0
        attempt = 0
        while got < need and attempt < need * 100:
            attempt += 1
            i = attempt
            # Most features sit in the chase cone: a few metres ahead, just off the line.
            if hash01(i, 1, tseed) < 0.72:
                along = 1.5 + hash01(i, 11, tseed) * 46.0
            else:
                along = -behind * 0.2 + hash01(i, 11, tseed) * (length + behind * 0.2)
            roll = hash01(i, 2, tseed)
            span = hash01(i, 4, tseed)
            if bias >= 0.5 or roll < bias:
                lat0 = max(min_across, 4.4)
                lat = lat0 + span * max(0.4, far_half - lat0)
            elif roll < 0.84:
                lat = min_across + (span ** 1.7) * 1.35
            else:
                lat = min_across + span * max(0.3, far_half - min_across)
            if hash01(i, 3, tseed) < 0.5:
                lat = -lat
            x = sx + fx * along + rx * lat
            z = sz + fz * along + rz * lat
            if abs(lat) < min_across - 1e-6:
                continue
            if rejected(x, z):
                continue
            if bias >= 0.5 and macro_at(x, z) < 0.35 and hash01(i, 16, tseed) < 0.8:
                continue
            crowded = False
            for it in nearby(x, z, sep):
                limit = sep if it[2] == name else max(1.7, min(sep, it[5]) * 0.45)
                if (it[0] - x) ** 2 + (it[1] - z) ** 2 < limit * limit:
                    crowded = True
                    break
            if crowded:
                continue
            local = int(hash01(i, 6, tseed) * len(group)) % len(group)
            yaw = (heading_deg + 180.0 + (hash01(i, 7, tseed) - 0.5) * 70.0) % 360.0
            for item in nearby(x, z, max(sep, 4.0)):
                gap = abs((yaw - item[3] + 180.0) % 360.0 - 180.0)
                if gap < 18.0:
                    yaw = (yaw + 37.0) % 360.0
                if item[4] == local and len(group) > 1:
                    local = (local + 1) % len(group)
                break
            variant = group[local]
            cap = float(variant["maxHeightM"])
            h0, h1 = float(spec["heightM"][0]), float(spec["heightM"][1])
            hi = min(h1, cap)
            lo = min(h0, hi)
            height = lo + hash01(i, 10, tseed) * (hi - lo)
            sc0, sc1 = float(spec["scale"][0]), float(spec["scale"][1])
            scale = sc0 + hash01(i, 9, tseed) * (sc1 - sc0)
            aspect = float(variant["contentW"]) / max(1.0, float(variant["contentH"]))
            half_w = 0.5 * height * scale * aspect
            if abs(lat) - half_w < run_clear:
                continue
            # Centre distance the chase eye can reach: lateral minus the slide.
            horiz = abs(lat) - slide
            if horiz < 0.2:
                continue
            dist = math.hypot(horiz, eye - height * 0.5)
            if (focal * height) / (dist * float(variant["contentH"])) > 1.001:
                continue
            grid.setdefault(cell_of(x, z), []).append((x, z, name, yaw, local, sep))
            instances.append({
                "type": name,
                "variant": local,
                "x": round(x, 3),
                "z": round(z, 3),
                "yaw": round(yaw, 1),
                "scale": round(scale, 3),
                "heightM": round(height, 4),
                "planes": 1,
                "buryM": bury,
            })
            by_type[name] += 1
            got += 1
    stats = {
        "placed": len(instances),
        "drawn": len(instances),
        "byType": by_type,
        "runClearM": run_clear,
    }
    return instances, stats

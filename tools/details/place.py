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


def load_openings(root: Path, pack: str) -> list[dict]:
    """Walkable ruin mouths. A feature footprint must not sit in one: Bolt walks
    the opening and the shallow slide along the front starts inside the mouth."""
    path = Path(root) / pack / "src" / "ruins" / "manifest.json"
    if not path.is_file():
        return []
    man = json.loads(path.read_text())
    out = []
    for obj in man.get("objects") or []:
        ob = obj.get("openingBoxM")
        bounds = obj.get("bounds")
        if not ob or not bounds:
            continue
        yaw = float(obj["yaw"])
        c, s = math.cos(yaw), math.sin(yaw)
        if obj.get("frame") == "ship":
            frame = (s, -c, c, s)
        else:
            frame = (c, s, -s, c)
        # Apron in front of the mouth covers the approach the gallop and the
        # shallow face-slide use before they meet the pier. Interior depth is
        # the opening itself.
        out.append({
            "id": obj.get("id") or "ruin",
            "frame": frame,
            "px": float(obj["x"]),
            "pz": float(obj["z"]),
            "x0": float(ob[0]) - 0.45,
            "x1": float(ob[1]) + 0.45,
            "z0": float(bounds["min"][2]) - 0.35,
            "z1": float(bounds["max"][2]) + 2.6,
        })
    return out


def feature_box(inst: dict, variant: dict) -> dict:
    """Collider footprint, same axes as packs/.../play/details.js."""
    height = float(inst["heightM"]) * float(inst.get("scale") or 1)
    content_h = max(1.0, float(variant.get("contentH") or 1))
    if variant.get("bodyWPx"):
        mpp = height / content_h
        bw = float(variant["bodyWPx"]) * mpp
        off = float(variant.get("bodyCxPx") or 0) * mpp
        if inst.get("mirror"):
            off = -off
        hz = min(0.15, bw * 0.25)
    else:
        bw = height * float(variant.get("contentW") or content_h) / content_h
        off = 0.0
        hz = 0.15
    yaw = math.radians(float(inst.get("yaw") or 0))
    cy, sy = math.cos(yaw), math.sin(yaw)
    return {
        "x": float(inst["x"]) + cy * off,
        "z": float(inst["z"]) - sy * off,
        "ux": cy,
        "uz": -sy,
        "vx": sy,
        "vz": cy,
        "hx": bw * 0.5 + 0.05,
        "hz": hz + 0.05,
    }


def _box_hits_rect(box: dict, opening: dict) -> bool:
    a, b, c, d = opening["frame"]
    dx, dz = box["x"] - opening["px"], box["z"] - opening["pz"]
    cx = a * dx + c * dz
    cz = b * dx + d * dz
    # Box axes in the ruin frame.
    ux = a * box["ux"] + c * box["uz"]
    uz = b * box["ux"] + d * box["uz"]
    vx = a * box["vx"] + c * box["vz"]
    vz = b * box["vx"] + d * box["vz"]
    hx, hz = box["hx"], box["hz"]
    x0, x1, z0, z1 = opening["x0"], opening["x1"], opening["z0"], opening["z1"]
    rcx, rcz = 0.5 * (x0 + x1), 0.5 * (z0 + z1)
    rhx, rhz = 0.5 * (x1 - x0), 0.5 * (z1 - z0)
    ox, oz = cx - rcx, cz - rcz

    def separates(ax: float, az: float) -> bool:
        dist = abs(ox * ax + oz * az)
        reach = abs(ax * ux + az * uz) * hx + abs(ax * vx + az * vz) * hz
        reach += abs(ax) * rhx + abs(az) * rhz
        return dist > reach + 1e-6

    return not (
        separates(1.0, 0.0) or separates(0.0, 1.0)
        or separates(ux, uz) or separates(vx, vz)
    )


def in_opening(inst: dict, variant: dict, openings: list[dict]) -> bool:
    if not openings:
        return False
    box = feature_box(inst, variant)
    return any(_box_hits_rect(box, op) for op in openings)


def clear_openings(numbers: dict, instances: list[dict], variants: dict, openings: list[dict]) -> int:
    """Slide a feature that landed in a ruin mouth along the corridor until the
    footprint is clear. Lateral position stays, so the running line and the
    near band still hold. Placement only."""
    if not openings:
        return 0
    cor = numbers["corridor"]
    heading = math.radians(float(cor["headingDeg"]))
    fx, fz = math.sin(heading), math.cos(heading)
    sx, sz = float(cor["spawn"][0]), float(cor["spawn"][1])
    rx, rz = fz, -fx
    near = ((numbers.get("features") or {}).get("near") or {}).get("latM")
    moved = 0

    def lat_of(x: float, z: float) -> float:
        return (x - sx) * rx + (z - sz) * rz

    def crowded(inst: dict, x: float, z: float) -> bool:
        for other in instances:
            if other is inst:
                continue
            if (other["x"] - x) ** 2 + (other["z"] - z) ** 2 < 0.55 ** 2:
                return True
        return False

    for inst in instances:
        group = variants.get(inst["type"]) or []
        if not group:
            continue
        variant = group[int(inst["variant"]) % len(group)]
        if not in_opening(inst, variant, openings):
            continue
        base_x, base_z = float(inst["x"]), float(inst["z"])
        found = False
        for sign in (-1.0, 1.0):
            for step in range(1, 56):
                dist = sign * step * 0.25
                x = base_x + fx * dist
                z = base_z + fz * dist
                if inst.get("near") and near:
                    lat = abs(lat_of(x, z))
                    if lat < float(near[0]) - 1e-6 or lat > float(near[1]) + 1e-6:
                        continue
                trial = dict(inst)
                trial["x"], trial["z"] = x, z
                if in_opening(trial, variant, openings) or crowded(inst, x, z):
                    continue
                if math.hypot(x, z) > radius_at(math.atan2(x, z)) * float(numbers["bands"]["insideFrac"]):
                    continue
                inst["x"] = round(x, 3)
                inst["z"] = round(z, 3)
                found = True
                moved += 1
                break
            if found:
                break
    return moved


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
    near_by = place_near(numbers, feat, types, variants, instances, grid, cell_of, nearby, rejected,
                         seed, (sx, sz), (fx, fz), (rx, rz), focal, run_clear)
    for name, n in near_by.items():
        by_type[name] = by_type.get(name, 0) + n
    root = Path(__file__).resolve().parents[2]
    clear_openings(numbers, instances, variants, load_openings(root, numbers.get("pack") or ""))
    mark_mirrors(instances, seed)
    stats = {
        "placed": len(instances),
        "drawn": len(instances),
        "byType": by_type,
        "nearByType": near_by,
        "runClearM": run_clear,
    }
    return instances, stats


def vnoise(t: float, seed: int) -> float:
    """Smooth 1D value noise in 0..1 (placement density only, never pixels)."""
    i = math.floor(t)
    f = t - i
    a = hash01(i, 41, seed)
    b = hash01(i + 1, 41, seed)
    f = f * f * (3.0 - 2.0 * f)
    return a + (b - a) * f


def near_height_cap(content_h: float, lat: float, near: dict, focal: float) -> float:
    """Tallest height whose pixels stay at magnification <= 1 from the closest
    chase eye that can see the card. The eye runs along the path, slid by up
    to `slideM`; a card enters the frame only inside `fovHalfDeg` of the view
    axis, so the closest visible distance is lateral / sin(angle)."""
    slide = float(near.get("slideM", 1.0))
    ang = math.radians(float(near.get("fovHalfDeg", 15.4)))
    lc = max(0.3, abs(lat) - slide)
    dmin = lc / math.sin(ang)
    return dmin * float(content_h) / float(focal)


def place_near(numbers, feat, types, variants, instances, grid, cell_of, nearby, rejected,
               seed, spawn, fwd, right, focal, run_clear) -> dict:
    """Near band: clumps of one-still features 1.5-4 m beside the running line.
    Clump centres walk along each side with noise-driven gaps; members differ in
    type. Heights reach each still's own no-stretch cap for that lateral."""
    near = feat.get("near") or {}
    out = {name: 0 for name in types}
    if not near:
        return out
    sx, sz = spawn
    fx, fz = fwd
    rx, rz = right
    lat0, lat1 = (float(v) for v in near["latM"])
    a0, a1 = (float(v) for v in near["alongM"])
    g0, g1 = (float(v) for v in near["gapM"])
    m0, m1 = (int(v) for v in near["members"])
    clump_r = float(near["clumpR"])
    bury = float(near.get("buryM", 0.04))
    bury_x = float(near.get("buryExtraFrac", 0.12))
    mix = near["mix"]
    names = [n for n in mix if n in types and variants.get(n)]
    tseed = type_seed("near", seed)
    k = 0
    for side in (-1.0, 1.0):
        along = a0 + hash01(int(side + 3), 5, tseed) * g1
        while along < a1:
            k += 1
            dens = vnoise(along / 9.0 + (0 if side < 0 else 37.0), tseed)
            gap = g1 - (g1 - g0) * dens
            gap *= 0.75 + 0.5 * hash01(k, 1, tseed)
            # Open stretches where the noise is low, so the band never reads as a row.
            if dens < float(near.get("openBelow", 0.38)):
                gap += float(near.get("openGapM", 3.0)) * (1.0 + 1.6 * hash01(k, 13, tseed))
            clat = lat0 + 0.35 + hash01(k, 2, tseed) * (lat1 - lat0 - 0.7)
            members = m0 + int((hash01(k, 3, tseed) * 0.6 + dens * 0.6) * (m1 - m0 + 1))
            members = max(m0, min(m1, members))
            # Weighted, without repeats inside a clump.
            pool = list(names)
            picked = []
            for j in range(members):
                if not pool:
                    break
                tot = sum(float(mix[n]) for n in pool)
                r = hash01(k * 7 + j, 4, tseed) * tot
                for n in pool:
                    r -= float(mix[n])
                    if r <= 0:
                        break
                picked.append(n)
                pool.remove(n)
            for j, name in enumerate(picked):
                spec = types[name]
                group = variants[name]
                local = int(hash01(k * 7 + j, 6, tseed) * len(group)) % len(group)
                variant = group[local]
                ok = False
                for tr in range(12):
                    q = k * 97 + j * 13 + tr
                    ang = hash01(q, 7, tseed) * math.tau
                    rad = clump_r * math.sqrt(hash01(q, 8, tseed)) if j else clump_r * 0.25 * hash01(q, 8, tseed)
                    lat = clat + math.cos(ang) * rad
                    al = along + math.sin(ang) * rad * 1.6
                    if abs(lat) < lat0 or abs(lat) > lat1:
                        continue
                    lat_s = side * lat
                    x = sx + fx * al + rx * lat_s
                    z = sz + fz * al + rz * lat_s
                    if rejected(x, z):
                        continue
                    cap = near_height_cap(variant["contentH"], lat, near, focal)
                    hi = min(float(spec["heightM"][1]), cap)
                    if hi < float(near.get("minHeightM", 0.3)):
                        continue
                    height = hi * (0.86 + 0.14 * hash01(q, 10, tseed))
                    aspect = float(variant["contentW"]) / max(1.0, float(variant["contentH"]))
                    half_w = 0.5 * height * aspect
                    if lat - half_w < run_clear:
                        continue
                    crowded = False
                    for it in nearby(x, z, 3.0):
                        other = it[6] if len(it) > 6 else 0.6
                        limit = 0.55 * (half_w + other)
                        if it[2] == name:
                            limit = max(limit, float(near.get("sameTypeSepM", 3.0)))
                        if (it[0] - x) ** 2 + (it[1] - z) ** 2 < limit * limit:
                            crowded = True
                            break
                    if crowded:
                        continue
                    ok = True
                    break
                if not ok:
                    continue
                heading_deg = math.degrees(math.atan2(fx, fz))
                yaw = (heading_deg + 180.0 + (hash01(q, 11, tseed) - 0.5) * 64.0) % 360.0
                extra = bury_x * hash01(q, 12, tseed) * height
                grid.setdefault(cell_of(x, z), []).append((x, z, name, yaw, local, 3.0, half_w))
                instances.append({
                    "type": name,
                    "variant": local,
                    "x": round(x, 3),
                    "z": round(z, 3),
                    "yaw": round(yaw, 1),
                    "scale": 1.0,
                    "heightM": round(height, 4),
                    "planes": 1,
                    "buryM": round(bury + extra, 4),
                    "near": 1,
                })
                out[name] += 1
            along += gap
    return out


def mark_mirrors(instances: list[dict], seed: int) -> None:
    """Flip U on some cards. Never on a card whose nearest same-type neighbour
    is close enough to read as its mirror twin."""
    tseed = type_seed("mirror", seed)
    for i, inst in enumerate(instances):
        best = 1e9
        for j, other in enumerate(instances):
            if j == i or other["type"] != inst["type"]:
                continue
            d = (other["x"] - inst["x"]) ** 2 + (other["z"] - inst["z"]) ** 2
            if d < best:
                best = d
        if math.sqrt(best) >= 4.5 and hash01(i, 1, tseed) < 0.5:
            inst["mirror"] = 1


def vnoise2(x: float, z: float, seed: int) -> float:
    """Smooth 2D value noise in 0..1 (placement density only, never pixels)."""
    ix = math.floor(x)
    iz = math.floor(z)
    fx = x - ix
    fz = z - iz
    fx = fx * fx * (3.0 - 2.0 * fx)
    fz = fz * fz * (3.0 - 2.0 * fz)

    def h(a: int, b: int) -> float:
        return hash01(a * 73856093 ^ b * 19349663, 51, seed)

    top = h(ix, iz) + (h(ix + 1, iz) - h(ix, iz)) * fx
    bot = h(ix, iz + 1) + (h(ix + 1, iz + 1) - h(ix, iz + 1)) * fx
    return top + (bot - top) * fz


def thin_micro(numbers: dict, instances: list[dict], features: list[dict],
               solids: list[tuple[float, float, float]], variants: dict) -> tuple[list[dict], dict]:
    """Keep micro cards where the ground has a reason for them: at the foot of a
    rock mass (a feature or a rock solid) or along a plate crack, with bare
    stretches between. Choose and weight existing variants; no pixel changes.
    Variants listed in `clumpOnly` may appear only inside a clump."""
    th = numbers.get("thin")
    if not th:
        return instances, {}
    seed = type_seed("thin", int(numbers["seed"]))
    m_in, m_out = (float(v) for v in th["massEdgeM"])
    crack_below = float(th["crackBelow"])
    crack_w = float(th.get("crackWeight", 0.75))
    bare_scale = float(th["bareScaleM"])
    bare_below = float(th["bareBelow"])
    clump_min = float(th["clumpAffinity"])
    floor = float(th.get("floorKeep", 0.04))
    power = float(th.get("power", 1.3))
    type_keep = th["typeKeep"]
    weights = th["variantWeights"]
    clump_only = {k: set(v) for k, v in (th.get("clumpOnly") or {}).items()}
    masses = [(f["x"], f["z"], 0.45 * f["heightM"] * f.get("scale", 1.0)) for f in features]
    masses += [(x, z, r) for x, z, r in solids]
    cell = 4.0
    grid: dict[tuple[int, int], list] = {}
    for mx, mz, mr in masses:
        grid.setdefault((math.floor(mx / cell), math.floor(mz / cell)), []).append((mx, mz, mr))

    def mass_aff(x: float, z: float) -> float:
        best = 99.0
        ix, iz = math.floor(x / cell), math.floor(z / cell)
        for dx in (-2, -1, 0, 1, 2):
            for dz in (-2, -1, 0, 1, 2):
                for mx, mz, mr in grid.get((ix + dx, iz + dz), ()):
                    d = math.hypot(x - mx, z - mz) - mr
                    if d < best:
                        best = d
        if best <= m_in:
            return 1.0
        if best >= m_out:
            return 0.0
        return 1.0 - (best - m_in) / (m_out - m_in)

    kept: list[dict] = []
    by_type: dict[str, int] = {}
    loud = 0
    for i, inst in enumerate(instances):
        x, z = inst["x"], inst["z"]
        name = inst["type"]
        ma = mass_aff(x, z)
        c = crack_amt(x, z)
        ca = max(0.0, 1.0 - c / crack_below) * crack_w
        aff = max(ma, ca)
        bare = vnoise2(x / bare_scale, z / bare_scale, seed)
        if bare < bare_below and ma < 0.5:
            continue
        p = float(type_keep.get(name, 1.0)) * (floor + (1.0 - floor) * aff ** power)
        if hash01(i, 1, seed) >= p:
            continue
        group = variants.get(name) or []
        w = list(weights.get(name) or [1.0] * len(group))[: len(group)]
        while len(w) < len(group):
            w.append(1.0)
        only = clump_only.get(name, set())
        if aff < clump_min:
            w = [0.0 if j in only else wj for j, wj in enumerate(w)]
        tot = sum(w)
        if tot <= 0:
            continue
        r = hash01(i, 2, seed) * tot
        pick = 0
        for j, wj in enumerate(w):
            r -= wj
            if r <= 0:
                pick = j
                break
        out = dict(inst)
        out["variant"] = pick
        cap = float(group[pick].get("maxHeightM", out["heightM"])) if group else out["heightM"]
        out["heightM"] = round(min(out["heightM"], cap), 4)
        if pick in only:
            loud += 1
        kept.append(out)
        by_type[name] = by_type.get(name, 0) + 1
    cor = numbers["corridor"]
    bands = numbers["bands"]
    heading = math.radians(float(cor["headingDeg"]))
    fx, fz = math.sin(heading), math.cos(heading)
    rx, rz = fz, -fx
    sx, sz = float(cor["spawn"][0]), float(cor["spawn"][1])
    near_half = float(bands["nearHalf"])
    mid_half = float(bands["midHalf"])
    far_half = float(bands["farHalf"])
    near_n = far_n = 0
    for inst in kept:
        dx, dz = inst["x"] - sx, inst["z"] - sz
        along, lat = dx * fx + dz * fz, dx * rx + dz * rz
        if 0 <= along <= 36:
            if abs(lat) <= near_half:
                near_n += 1
            elif mid_half < abs(lat) <= far_half:
                far_n += 1
    stats = {
        "placed": len(kept),
        "drawn": sum(int(k["planes"]) for k in kept),
        "byType": by_type,
        "before": len(instances),
        "keptFrac": round(len(kept) / max(1, len(instances)), 4),
        "clumpOnlyKept": loud,
        "nearPerM2": round(near_n / max(1.0, 36.0 * 2.0 * near_half), 4),
        "farPerM2": round(far_n / max(1.0, 36.0 * 2.0 * (far_half - mid_half)), 4),
    }
    return kept, stats

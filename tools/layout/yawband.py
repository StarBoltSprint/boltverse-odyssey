"""Per-category yaw band. Invisible orientation only. No pixels.

Owner decision 2026-10-02, spec rail 8. `world` is yaw 0 (the baked azimuth).
`inward` is banned (Director decision 2026-10-02 15:04, delegated owner approval).
A placed label `boundary-N` still uses the `boundary` band, via the manifest
category or the `boundary` prefix, so an older file can be checked.

Absent `yaw_band_deg` leaves the caller's yaw untouched and writes nothing.
Organic mode adds its own world default for boundary and exit. This module does not.
"""

from __future__ import annotations

from tools.layout.geom import ang_dist, hypot, wrap180, wrap360
from tools.layout.model import load_asset, qnum

# Same neighbour gaps the checkers already use. Not new thresholds.
_CHAIN_GAP_M = 3.0
_RING_GAP_DEG = 1.0
_OFFSET_SLOP_DEG = 1e-3


def parse_band(raw) -> tuple[float, float]:
    """A number N means [-N, N]. A pair is [lo, hi]."""
    if isinstance(raw, bool) or raw is None:
        raise ValueError("yaw_band_deg must be a number or [lo, hi]")
    if isinstance(raw, (int, float)):
        span = abs(float(raw))
        return -span, span
    if isinstance(raw, (list, tuple)) and len(raw) == 2 and not isinstance(raw, str):
        lo = float(raw[0])
        hi = float(raw[1])
        if lo > hi:
            lo, hi = hi, lo
        return lo, hi
    raise ValueError("yaw_band_deg must be a number or [lo, hi]")


def default_ref(category: str) -> str:
    del category
    return "world"


def band_from_block(category: str, block: dict) -> dict | None:
    if not isinstance(block, dict) or "yaw_band_deg" not in block:
        return None
    lo, hi = parse_band(block["yaw_band_deg"])
    if "yaw_ref" in block and str(block.get("yaw_ref") or "").strip().lower() == "inward":
        raise ValueError(
            "yaw_ref inward is banned. Boundary and exit pieces use world yaw +-15 deg. "
            "Director decision 2026-10-02 15:04 (delegated owner approval). Spec rail 8."
        )
    ref = str(block.get("yaw_ref") or default_ref(category))
    if ref not in ("world",):
        ref = default_ref(category)
    return {"hi": qnum(hi, 4), "lo": qnum(lo, 4), "ref": ref}


def collect_bands(spec: dict) -> dict:
    """Category key -> {lo, hi, ref}. Empty when the spec sets no yaw_band_deg."""
    bands: dict[str, dict] = {}
    boundary = spec.get("boundary")
    if isinstance(boundary, dict):
        band = band_from_block("boundary", boundary)
        if band:
            bands["boundary"] = band
    for key, cat in (spec.get("categories") or {}).items():
        if not isinstance(cat, dict):
            continue
        band = band_from_block(str(key), cat)
        if band:
            bands[str(key)] = band
    scatter = (spec.get("scatter") or {}).get("categories") or {}
    if isinstance(scatter, dict):
        for key, cat in scatter.items():
            if not isinstance(cat, dict):
                continue
            band = band_from_block(str(key), cat)
            if band:
                bands[str(key)] = band
    for key in ("pois", "far_plates"):
        for item in spec.get(key) or []:
            if not isinstance(item, dict) or "yaw_band_deg" not in item:
                continue
            cat = str(item.get("category") or "")
            if not cat:
                continue
            band = band_from_block(cat, item)
            if band:
                bands[cat] = band
    return bands


def resolve_band(obj: dict, bands: dict, manifest_category: str = "") -> tuple[str | None, dict | None]:
    """Exact placed category, then manifest category, then a boundary prefix."""
    if not bands:
        return None, None
    cat = str(obj.get("category") or "")
    if cat in bands:
        return cat, bands[cat]
    man = str(manifest_category or "")
    if man and man in bands:
        return man, bands[man]
    if (cat == "boundary" or cat.startswith("boundary-")) and "boundary" in bands:
        return "boundary", bands["boundary"]
    return None, None


def reference_deg(obj: dict, band: dict) -> float:
    if str(band.get("ref")) == "inward":
        return wrap360(float(obj.get("heading_deg") or 0.0) + 180.0)
    return 0.0


def offset_deg(obj: dict, band: dict) -> float:
    return wrap180(float(obj.get("yaw_deg") or 0.0) - reference_deg(obj, band))


def _quantize(yaw: float, step: float) -> float:
    if step <= 1.0:
        return wrap360(yaw)
    return wrap360(round(yaw / step) * step)


def legal_yaws(reference: float, lo: float, hi: float, step: float) -> list[float]:
    """Quantized yaws whose offset from `reference` sits in [lo, hi].

    When no quantized yaw lands inside, one in-band angle is returned so the
    check can still pass. That single angle has no yaw spread.
    """
    ref = wrap360(float(reference))
    step = float(step) if step and float(step) > 0.0 else 1.0
    found: list[float] = []
    if step <= 1.0:
        offsets = [float(lo), float(hi)]
        if lo <= 0.0 <= hi:
            offsets.append(0.0)
        span = float(hi) - float(lo)
        if span > 0.0:
            cuts = int(span // 15.0)
            for i in range(1, max(cuts, 0)):
                offsets.append(float(lo) + span * (i / cuts))
        for off in offsets:
            if float(lo) - 1e-9 <= off <= float(hi) + 1e-9:
                found.append(wrap360(ref + off))
    else:
        count = max(1, int(round(360.0 / step)))
        for k in range(-1, count + 2):
            yaw = wrap360(k * step)
            off = wrap180(yaw - ref)
            if float(lo) - 1e-6 <= off <= float(hi) + 1e-6:
                found.append(yaw)
    unique: list[float] = []
    for yaw in found:
        kept = _quantize(yaw, step)
        off = wrap180(kept - ref)
        if off < float(lo) - _OFFSET_SLOP_DEG or off > float(hi) + _OFFSET_SLOP_DEG:
            continue
        if any(ang_dist(kept, prev) < 1e-4 for prev in unique):
            continue
        unique.append(kept)
    unique.sort(key=lambda yaw: (wrap180(yaw - ref), yaw))
    if unique:
        return unique
    if float(lo) <= 0.0 <= float(hi):
        off = 0.0
    else:
        off = (float(lo) + float(hi)) * 0.5
    return [wrap360(ref + off)]


def fields_for(obj: dict, roots, cache: dict) -> tuple[str, float]:
    asset = obj.get("asset_obj")
    if asset is not None:
        return str(getattr(asset, "category", "") or ""), float(getattr(asset, "yaw_step", 1.0) or 1.0)
    path = str(obj.get("asset") or "")
    if not path:
        return "", 1.0
    cached = cache.get(path)
    if cached is None:
        try:
            loaded = load_asset(path, list(roots or []))
            cached = (str(loaded.category or ""), float(loaded.yaw_step or 1.0))
        except (OSError, ValueError, FileNotFoundError, KeyError):
            cached = ("", 1.0)
        cache[path] = cached
    return cached


def achievable_span(obj: dict, band: dict, step: float) -> float:
    legal = legal_yaws(reference_deg(obj, band), float(band["lo"]), float(band["hi"]), step)
    ref = reference_deg(obj, band)
    offs = [wrap180(yaw - ref) for yaw in legal]
    if len(offs) < 2:
        return 0.0
    return max(offs) - min(offs)


def yaw_matches(a: dict, b: dict, yaw_eps: float, bands: dict, roots, cache: dict) -> bool:
    """True when yaw counts as the same for variety.

    Inside a band, compare offsets from each object's reference. A band that
    cannot express an offset difference larger than yaw_eps (including after
    yaw quantization) does not count as the same: variety stays with asset
    and scale. Owner decision 2026-10-02, spec rail 8.
    """
    if cache is None:
        cache = {}
    man_a, step_a = fields_for(a, roots, cache)
    man_b, step_b = fields_for(b, roots, cache)
    _ka, ba = resolve_band(a, bands, man_a)
    _kb, bb = resolve_band(b, bands, man_b)
    ya = float(a.get("yaw_deg") or 0.0)
    yb = float(b.get("yaw_deg") or 0.0)
    if ba is None or bb is None:
        return ang_dist(ya, yb) <= yaw_eps
    if achievable_span(a, ba, step_a) <= yaw_eps or achievable_span(b, bb, step_b) <= yaw_eps:
        return False
    return ang_dist(offset_deg(a, ba), offset_deg(b, bb)) <= yaw_eps


def _order_key(obj: dict):
    oid = str(obj.get("id") or "")
    if "s_m" in obj:
        return (0, float(obj.get("s_m") or 0.0), int(obj.get("row") or 0), oid)
    cat = str(obj.get("category") or "")
    if cat in ("ring", "exit") and "heading_deg" in obj:
        return (1, float(obj.get("heading_deg") or 0.0), 0.0, oid)
    pos = obj.get("position") or [0.0, 0.0]
    return (2, float(pos[0]), float(pos[1]), oid)


def _same_asset_scale(a: dict, b: dict, scale_eps: float) -> bool:
    if str(a.get("asset")) != str(b.get("asset")):
        return False
    return abs(float(a.get("scale") or 1.0) - float(b.get("scale") or 1.0)) <= scale_eps


def apply_yaw_bands(
    objects: list[dict],
    bands: dict,
    yaw_eps: float = 8.0,
    scale_eps: float = 0.03,
    roots=None,
    perimeter_m: float | None = None,
) -> None:
    """Rewrite yaw inside each category band. No-op when `bands` is empty.

    Positions, scale, and ids stay put. Yaw is chosen inside the band so
    neighbours that share an asset and a scale do not also share an offset,
    when the band can express that difference.
    """
    if not bands:
        return
    cache: dict = {}
    grouped: dict[str, list[dict]] = {}
    resolved: dict[int, tuple[str, dict, float]] = {}
    for obj in objects:
        man, step = fields_for(obj, roots, cache)
        key, band = resolve_band(obj, bands, man)
        if key is None or band is None:
            continue
        grouped.setdefault(key, []).append(obj)
        resolved[id(obj)] = (key, band, step)
    for group in grouped.values():
        group.sort(key=_order_key)
        assigned: list[tuple[str, float, float]] = []
        for index, obj in enumerate(group):
            _key, band, step = resolved[id(obj)]
            lo = float(band["lo"])
            hi = float(band["hi"])
            ref = reference_deg(obj, band)
            legal = legal_yaws(ref, lo, hi, step)
            slot = legal[index % len(legal)]
            asset = str(obj.get("asset"))
            scale = float(obj.get("scale") or 1.0)
            best_yaw = legal[0]
            best_score = None
            for yaw in legal:
                off = wrap180(yaw - ref)
                mind = 180.0
                saw = False
                for prev_asset, prev_scale, prev_off in assigned:
                    if prev_asset != asset or abs(prev_scale - scale) > scale_eps:
                        continue
                    saw = True
                    mind = min(mind, ang_dist(off, prev_off))
                if not saw:
                    mind = 180.0
                score = (mind, -ang_dist(yaw, slot), -yaw)
                if best_score is None or score > best_score:
                    best_score = score
                    best_yaw = yaw
            stored = qnum(_quantize(best_yaw, step), 3)
            off = wrap180(stored - ref)
            if off < lo - _OFFSET_SLOP_DEG or off > hi + _OFFSET_SLOP_DEG:
                stored = qnum(wrap360(best_yaw), 3)
            obj["yaw_deg"] = stored
            assigned.append((asset, scale, wrap180(float(obj["yaw_deg"]) - ref)))
    _repair(objects, bands, yaw_eps, scale_eps, roots, cache, resolved, perimeter_m)


def _partners(objects, resolved, perimeter_m):
    """Pairs the checkers treat as neighbours. Id -> partner objects."""
    out: dict[int, list[dict]] = {}

    def link(a, b):
        if a is b:
            return
        out.setdefault(id(a), [])
        out.setdefault(id(b), [])
        if b not in out[id(a)]:
            out[id(a)].append(b)
        if a not in out[id(b)]:
            out[id(b)].append(a)

    walled = [obj for obj in objects if id(obj) in resolved and "s_m" in obj]
    walled.sort(key=lambda obj: float(obj.get("s_m") or 0.0))
    n = len(walled)
    if perimeter_m and n >= 2:
        perimeter = float(perimeter_m)
        for i, a in enumerate(walled):
            b = walled[(i + 1) % n]
            forward = (float(b.get("s_m") or 0.0) - float(a.get("s_m") or 0.0)) % perimeter
            if perimeter and forward > _CHAIN_GAP_M:
                continue
            link(a, b)
    else:
        for i in range(n - 1):
            a = walled[i]
            b = walled[i + 1]
            forward = float(b.get("s_m") or 0.0) - float(a.get("s_m") or 0.0)
            if forward <= 0.0 or forward > _CHAIN_GAP_M:
                continue
            link(a, b)

    ringish = [
        obj
        for obj in objects
        if id(obj) in resolved and "width_deg" in obj and "heading_deg" in obj and "s_m" not in obj
    ]
    ringish.sort(key=lambda obj: float(obj.get("heading_deg") or 0.0))
    n = len(ringish)
    for i, a in enumerate(ringish):
        b = ringish[(i + 1) % n] if n else None
        if b is None:
            break
        gap = ang_dist(float(a.get("heading_deg") or 0.0), float(b.get("heading_deg") or 0.0))
        gap -= float(a.get("width_deg") or 0.0) * 0.5
        gap -= float(b.get("width_deg") or 0.0) * 0.5
        if gap > _RING_GAP_DEG:
            continue
        link(a, b)

    by_cat: dict[str, list[dict]] = {}
    for obj in objects:
        if id(obj) not in resolved:
            continue
        if "s_m" in obj or "width_deg" in obj:
            continue
        by_cat.setdefault(str(obj.get("category") or ""), []).append(obj)
    for group in by_cat.values():
        for i, a in enumerate(group):
            pos = a.get("position") or [0.0, 0.0]
            ax, az = float(pos[0]), float(pos[1])
            best = None
            best_d = float("inf")
            for j, b in enumerate(group):
                if i == j:
                    continue
                other = b.get("position") or [0.0, 0.0]
                dist = hypot(ax - float(other[0]), az - float(other[1]))
                if dist < best_d:
                    best_d = dist
                    best = b
            if best is not None:
                link(a, best)
    return out


def _repair(objects, bands, yaw_eps, scale_eps, roots, cache, resolved, perimeter_m) -> None:
    partners = _partners(objects, resolved, perimeter_m)
    order = [obj for obj in objects if id(obj) in resolved]
    order.sort(key=lambda obj: str(obj.get("id") or ""))
    for _attempt in range(6):
        changed = False
        for obj in order:
            pals = partners.get(id(obj)) or []
            violators = [
                p
                for p in pals
                if _same_asset_scale(obj, p, scale_eps)
                and yaw_matches(obj, p, yaw_eps, bands, roots, cache)
            ]
            if not violators:
                continue
            _key, band, step = resolved[id(obj)]
            lo = float(band["lo"])
            hi = float(band["hi"])
            ref = reference_deg(obj, band)
            legal = legal_yaws(ref, lo, hi, step)
            current = float(obj.get("yaw_deg") or 0.0)
            cur_min = min(ang_dist(offset_deg(obj, band), offset_deg(p, resolved[id(p)][1])) for p in violators)
            best_yaw = None
            best_min = cur_min
            for yaw in legal:
                trial = qnum(_quantize(yaw, step), 3)
                off = wrap180(trial - ref)
                if off < lo - _OFFSET_SLOP_DEG or off > hi + _OFFSET_SLOP_DEG:
                    continue
                old = obj["yaw_deg"]
                obj["yaw_deg"] = trial
                still = any(
                    _same_asset_scale(obj, p, scale_eps) and yaw_matches(obj, p, yaw_eps, bands, roots, cache)
                    for p in pals
                )
                if still:
                    obj["yaw_deg"] = old
                    continue
                same = [p for p in pals if _same_asset_scale(obj, p, scale_eps)]
                if same:
                    mind = min(
                        ang_dist(offset_deg(obj, band), offset_deg(p, resolved[id(p)][1])) for p in same
                    )
                else:
                    mind = 180.0
                obj["yaw_deg"] = old
                if mind > best_min + 1e-6 or best_yaw is None:
                    best_min = mind
                    best_yaw = trial
            if best_yaw is None or ang_dist(best_yaw, current) < 1e-4:
                continue
            obj["yaw_deg"] = best_yaw
            changed = True
        if not changed:
            break


def clearing_objects(clearing: dict) -> list[dict]:
    groups = []
    groups.extend((clearing.get("edge_ring") or {}).get("hulls") or [])
    groups.extend((clearing.get("boundary") or {}).get("pieces") or [])
    groups.extend(clearing.get("interior_objects") or [])
    groups.extend(clearing.get("far_plates") or [])
    seen = set()
    out = []
    for obj in groups:
        oid = str(obj.get("id"))
        if oid in seen:
            continue
        seen.add(oid)
        out.append(obj)
    return out


def measure_yaw_band(objects: list[dict], bands: dict, roots) -> dict | None:
    """None when no bands are stored, so the check row stays absent."""
    if not bands:
        return None
    cache: dict = {}
    checked = 0
    outside = 0
    inward_refs = 0
    worst = None
    for obj in objects:
        man, _step = fields_for(obj, roots, cache)
        _key, band = resolve_band(obj, bands, man)
        if band is None:
            continue
        checked += 1
        if str(band.get("ref") or "world") == "inward":
            inward_refs += 1
        lo = float(band["lo"])
        hi = float(band["hi"])
        off = offset_deg(obj, band)
        yaw = float(obj.get("yaw_deg") or 0.0)
        if off < lo - _OFFSET_SLOP_DEG or off > hi + _OFFSET_SLOP_DEG:
            outside += 1
            excess = (lo - off) if off < lo else (off - hi)
            cand = (excess, str(obj.get("id")), yaw, off, lo, hi, str(band.get("ref") or "world"))
            if worst is None or cand[0] > worst[0] + 1e-9 or (abs(cand[0] - worst[0]) <= 1e-9 and cand[1] < worst[1]):
                worst = cand
    if worst is None:
        numbers = {
            "checked": checked,
            "inward_refs": inward_refs,
            "outside": 0,
            "worst_excess_deg": 0.0,
            "worst_hi": 0.0,
            "worst_id": "none",
            "worst_lo": 0.0,
            "worst_offset_deg": 0.0,
            "worst_ref": "none",
            "worst_yaw_deg": 0.0,
        }
    else:
        excess, oid, yaw, off, lo, hi, ref = worst
        numbers = {
            "checked": checked,
            "inward_refs": inward_refs,
            "outside": outside,
            "worst_excess_deg": qnum(excess, 4),
            "worst_hi": hi,
            "worst_id": oid,
            "worst_lo": lo,
            "worst_offset_deg": qnum(off, 4),
            "worst_ref": ref,
            "worst_yaw_deg": qnum(yaw, 4),
        }
    return {"ok": outside == 0 and inward_refs == 0, "numbers": numbers}


def yaw_span(objects: list[dict], bands: dict, roots):
    """Smallest in-band offset span among categories with at least two objects.

    None when no bands are stored, so variety's reported fields stay put.
    """
    if not bands:
        return None
    cache: dict = {}
    grouped: dict[str, list[float]] = {}
    for obj in objects:
        man, _step = fields_for(obj, roots, cache)
        key, band = resolve_band(obj, bands, man)
        if key is None or band is None:
            continue
        grouped.setdefault(key, []).append(offset_deg(obj, band))
    best = None
    for key, offs in grouped.items():
        if len(offs) < 2:
            continue
        span = max(offs) - min(offs)
        if best is None or span < best[0] - 1e-9 or (abs(span - best[0]) <= 1e-9 and key < best[1]):
            best = (span, key)
    if best is None:
        return (0.0, "none")
    return (qnum(best[0], 4), best[1])

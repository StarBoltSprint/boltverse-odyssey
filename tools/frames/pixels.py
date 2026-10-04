"""Framebuffer measurements for proof shots.

The functions read pixels. They do not draw, grade, or replace a pixel.
Thresholds are the 2026-10-04 gates (foot gap, untextured black, sky seams,
ground voids). A picture smaller than 48 px on a side is not a proof frame.
"""

from __future__ import annotations

import math

import numpy as np

FOOT_GAP_PX = 12
FOOT_COL_FRAC = 0.04
UNTEX_LUMA = 22.0
UNTEX_STD = 4.0
UNTEX_AREA = 0.008
UNTEX_FLAT_STD = 1.2
UNTEX_FLAT_AREA = 0.02
ZENITH_STD = 7.0
ZENITH_JUMP = 16.0
ZENITH_MIN_FRAC = 0.035
STREAK_DELTA = 16.0
SEAM_DELTA = 14.0
STREAK_RUN = 0.28
SEAM_RUN = 0.35
EDGE_DELTA = 18.0
STAIR_RUN = 5
STAIR_RUNS = 4


def r4(value) -> float:
    return round(float(value), 4)


def luma(rgb: np.ndarray) -> np.ndarray:
    x = rgb[..., :3].astype(np.float32)
    return 0.2126 * x[..., 0] + 0.7152 * x[..., 1] + 0.0722 * x[..., 2]


def _integral(a: np.ndarray) -> np.ndarray:
    out = np.zeros((a.shape[0] + 1, a.shape[1] + 1), np.float64)
    out[1:, 1:] = np.cumsum(np.cumsum(a, axis=0), axis=1)
    return out


def local_mean_std(y: np.ndarray, k: int = 5):
    """k x k mean and standard deviation. k is odd."""
    rad = k // 2
    p = np.pad(y.astype(np.float64), rad, mode="edge")
    ii = _integral(p)
    ii2 = _integral(p * p)
    h, w = y.shape
    s = ii[k : k + h, k : k + w] - ii[0:h, k : k + w] - ii[k : k + h, 0:w] + ii[0:h, 0:w]
    s2 = ii2[k : k + h, k : k + w] - ii2[0:h, k : k + w] - ii2[k : k + h, 0:w] + ii2[0:h, 0:w]
    n = float(k * k)
    mean = s / n
    var = np.maximum(0.0, s2 / n - mean * mean)
    return mean, np.sqrt(var)


def _longest(mask: np.ndarray) -> int:
    best = cur = 0
    for v in mask:
        if v:
            cur += 1
            if cur > best:
                best = cur
        else:
            cur = 0
    return int(best)


def _runs(mask: np.ndarray):
    runs = []
    start = None
    for i, v in enumerate(mask):
        if v and start is None:
            start = i
        elif not v and start is not None:
            runs.append((start, i))
            start = None
    if start is not None:
        runs.append((start, len(mask)))
    return runs


def _collapse(items, key="x", gap=4):
    if not items:
        return []
    items = sorted(items, key=lambda it: it[key])
    out = [dict(items[0])]
    for it in items[1:]:
        if it[key] - out[-1][key] <= gap:
            if it.get("run", 0) > out[-1].get("run", 0):
                out[-1] = dict(it)
        else:
            out.append(dict(it))
    return out


def foot_contact(rgb: np.ndarray) -> dict:
    """Sky-coloured pixels between a solid and the ground in the same column.

    A distant skyline that meets the ground has no gap. A foot that floats
    shows the sky under the solid and the ground further down.
    """
    y = luma(rgb)
    h, w = y.shape
    if h < 48 or w < 48:
        return {"hits": [], "maxGapPx": 0, "columns": 0, "skipped": "small"}
    _mean, std = local_mean_std(y, 5)
    sky_med = float(np.median(y[: max(4, h // 10)]))
    sky_like = (np.abs(y - sky_med) < 22.0) & (std < 9.0)
    solid = (std > 6.0) & (np.abs(y - sky_med) > 28.0)
    ground = (std > 10.0) & (np.arange(h)[:, None] > int(h * 0.28))
    # A foot sits on a ground run that reaches the bottom of the frame.
    # A one-pixel crack at the frame edge is not a foot. A vista of open sky
    # under a distant mesa is taller than a foot gap.
    min_ground = max(24, int(h * 0.08))
    min_solid = 16
    max_gap = max(48, int(h * 0.12))
    gaps = np.zeros(w, np.int32)
    for x in range(w):
        r = h - 1
        ground_run = 0
        while r > 0 and ground[r, x]:
            ground_run += 1
            r -= 1
        if ground_run < min_ground:
            continue
        # A 5 px kernel blurs the solid/sky edge into a few unclassified rows.
        gap = 0
        stray = 0
        while r >= 0 and not solid[r, x]:
            if sky_like[r, x]:
                gap += 1
                stray = 0
            else:
                stray += 1
                if stray > 4:
                    break
            r -= 1
        if not (FOOT_GAP_PX <= gap <= max_gap and r >= 0 and solid[r, x]):
            continue
        solid_run = 0
        s = r
        while s >= 0 and solid[s, x]:
            solid_run += 1
            s -= 1
        if solid_run >= min_solid:
            gaps[x] = gap
    cols = int(np.count_nonzero(gaps))
    need = max(8, int(math.ceil(w * FOOT_COL_FRAC)))
    hit = cols >= need
    span = None
    if cols:
        xs = np.flatnonzero(gaps)
        span = [int(xs[0]), int(xs[-1])]
    return {
        "hits": [{"maxGapPx": int(gaps.max()), "columns": cols, "x": span}] if hit else [],
        "maxGapPx": int(gaps.max()) if cols else 0,
        "columns": cols,
        "needColumns": need,
        "skipped": None,
    }


def untextured(rgb: np.ndarray, block: int = 8) -> dict:
    """Large flat black, or a large untextured flat, that is not the sky band.

    A night sky that touches the top and spans the frame is ignored. A jagged
    hull interior still counts: the box does not have to be a filled rectangle.
    """
    y = luma(rgb)
    h, w = y.shape
    if h < 48 or w < 48:
        return {"hits": [], "skyIgnored": 0, "skipped": "small"}
    _mean, std = local_mean_std(y, 5)
    rows = h // block
    cols = w // block
    dark = np.zeros((rows, cols), np.uint8)
    for by in range(rows):
        for bx in range(cols):
            sl = y[by * block : (by + 1) * block, bx * block : (bx + 1) * block]
            sd = std[by * block : (by + 1) * block, bx * block : (bx + 1) * block]
            mean = float(sl.mean())
            spread = float(sd.mean())
            if mean < UNTEX_LUMA and spread < UNTEX_STD:
                dark[by, bx] = 1
            elif spread < UNTEX_FLAT_STD and mean < 90.0:
                dark[by, bx] = 2
    seen = np.zeros_like(dark, np.uint8)
    hits = []
    sky_ignored = 0
    for by in range(rows):
        for bx in range(cols):
            if not dark[by, bx] or seen[by, bx]:
                continue
            stack = [(by, bx)]
            seen[by, bx] = 1
            cells = []
            kind = int(dark[by, bx])
            while stack:
                cy, cx = stack.pop()
                cells.append((cy, cx))
                for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                    ny, nx = cy + dy, cx + dx
                    if ny < 0 or nx < 0 or ny >= rows or nx >= cols:
                        continue
                    if not dark[ny, nx] or seen[ny, nx]:
                        continue
                    seen[ny, nx] = 1
                    stack.append((ny, nx))
                    kind = max(kind, int(dark[ny, nx]))
            ys = [c[0] for c in cells]
            xs = [c[1] for c in cells]
            min_y, max_y = min(ys), max(ys)
            min_x, max_x = min(xs), max(xs)
            bw = max_x - min_x + 1
            bh = max_y - min_y + 1
            n = len(cells)
            area = (n * block * block) / float(h * w)
            touches_top = min_y == 0
            span = bw / float(cols)
            flat_only = kind == 2
            if touches_top and span >= 0.7 and (max_y + 1) / float(rows) <= 0.55:
                sky_ignored += 1
                continue
            # A full-width flat, or a flat that touches the top, is sky or ground.
            if flat_only and (span >= 0.7 or touches_top):
                sky_ignored += 1
                continue
            limit = UNTEX_FLAT_AREA if flat_only else UNTEX_AREA
            if area >= limit and bw >= 3 and bh >= 3 and n / float(bw * bh) >= 0.4:
                hits.append(
                    {
                        "areaFrac": r4(area),
                        "kind": "flat" if flat_only else "black",
                        "x": int(min_x * block),
                        "y": int(min_y * block),
                        "w": int(bw * block),
                        "h": int(bh * block),
                    }
                )
    hits.sort(key=lambda it: -it["areaFrac"])
    return {"hits": hits, "skyIgnored": sky_ignored, "skipped": None}


def _sky_rows(y: np.ndarray):
    h, w = y.shape
    dy = np.abs(np.diff(y, axis=0))
    lo, hi = int(h * 0.15), int(h * 0.85)
    if hi <= lo + 2:
        return 0, h
    scores = dy[lo:hi, int(w * 0.08) : int(w * 0.92)].mean(axis=1)
    hr = lo + int(np.argmax(scores))
    bot = y[int(h * 0.82) :]
    if float(bot.std()) > 18.0 and hr < int(h * 0.9):
        return 0, max(hr, int(h * 0.2))
    return 0, h


def zenith_band(y: np.ndarray) -> dict | None:
    h, w = y.shape
    stds = y.std(axis=1)
    means = y.mean(axis=1)
    k = 0
    limit = int(h * 0.30)
    while k < limit and stds[k] < ZENITH_STD and abs(float(means[k]) - float(means[0])) < 12.0:
        k += 1
    if k < int(h * ZENITH_MIN_FRAC) or k + 8 >= h:
        return None
    # The first row of a curved cap is still mostly the dark colour. Read the
    # jump a short way past that row.
    probe = k + max(6, int(h * 0.012))
    if probe >= h:
        return None
    later = float(means[probe : min(h, probe + 8)].mean())
    jump = abs(later - float(means[:k].mean()))
    col_jump = np.abs(y[min(h - 1, probe)] - y[max(0, k - 2)])
    agree = float((col_jump > 10.0).mean())
    if jump >= ZENITH_JUMP and agree >= 0.6:
        return {"rows": int(k), "jump": r4(jump), "agree": r4(agree)}
    return None


def _vertical(y: np.ndarray, y0: int, y1: int):
    sub = y[y0:y1]
    hs, w = sub.shape
    streaks = []
    seams = []
    if hs < 24 or w < 16:
        return streaks, seams
    # Neighbour averages, so a thin bright line survives texture and a seam is a
    # stable left/right step rather than single-pixel noise.
    for x in range(6, w - 6):
        center = sub[:, x]
        left = sub[:, x - 6 : x - 2].mean(axis=1)
        right = sub[:, x + 2 : x + 6].mean(axis=1)
        spike = (np.abs(center - left) > STREAK_DELTA) & (np.abs(center - right) > STREAK_DELTA) & (
            np.abs(left - right) < 12.0
        )
        run = _longest(spike)
        if run >= hs * STREAK_RUN:
            streaks.append({"x": int(x), "run": int(run)})
        step = np.abs(left - right) > SEAM_DELTA
        run_s = _longest(step)
        if run_s >= hs * SEAM_RUN:
            seams.append({"x": int(x), "run": int(run_s)})
    return _collapse(streaks), _collapse(seams)


def _rectangles(y: np.ndarray):
    h, w = y.shape
    if h < 24 or w < 24:
        return []
    gv = np.abs(np.diff(y, axis=0, prepend=y[:1, :]))
    gh = np.abs(np.diff(y, axis=1, prepend=y[:, :1]))
    min_w = max(8, int(w * 0.08))
    max_w = int(w * 0.85)
    min_h = max(8, int(h * 0.08))
    max_h = int(h * 0.7)
    h_segs = []
    for r in range(h):
        for a, b in _runs(gv[r] > EDGE_DELTA):
            if min_w <= (b - a) <= max_w:
                h_segs.append((r, a, b, b - a))
    v_segs = []
    for c in range(0, w, 1):
        for a, b in _runs(gh[:, c] > EDGE_DELTA):
            if min_h <= (b - a) <= max_h:
                v_segs.append((c, a, b))
    # A second panel's border breaks a straight edge for a few columns.
    # Stitch pieces that sit on the same row and nearly touch.
    h_segs.sort(key=lambda s: (s[0], s[1]))
    stitched = []
    for r, a, b, length in h_segs:
        if stitched and abs(r - stitched[-1][0]) <= 4 and a <= stitched[-1][2] + 8:
            pr, pa, pb, _plen = stitched[-1]
            nb = max(pb, b)
            na = min(pa, a)
            if nb - na <= max_w:
                stitched[-1] = (min(pr, r), na, nb, nb - na)
                continue
        stitched.append((r, a, b, length))
    h_segs = [s for s in stitched if min_w <= s[3] <= max_w]
    h_segs.sort(key=lambda s: -s[3])
    h_segs = h_segs[:80]
    by_col = {}
    for c, s, e in v_segs:
        by_col.setdefault(c // 2, []).append((c, s, e))

    def has_vert(x, top, bot):
        # A crossing panel can break one edge for a few rows. Coverage of the
        # span counts; one unbroken segment is not required.
        need = max(1, bot - top)
        covered = 0
        seen = []
        for key in range((x - 4) // 2, (x + 4) // 2 + 1):
            for c, s, e in by_col.get(key, ()):
                if abs(c - x) > 4:
                    continue
                lo = max(s, top)
                hi = min(e, bot)
                if hi > lo:
                    seen.append((lo, hi))
        seen.sort()
        cursor = top
        for lo, hi in seen:
            if hi <= cursor:
                continue
            covered += hi - max(lo, cursor)
            cursor = max(cursor, hi)
        return covered >= need * 0.75

    rects = []
    for i, (r1, a1, b1, _l1) in enumerate(h_segs):
        for r2, a2, b2, _l2 in h_segs[i + 1 :]:
            if not (min_h <= abs(r2 - r1) <= max_h):
                continue
            top, bot = (r1, r2) if r1 < r2 else (r2, r1)
            ax, bx = max(a1, a2), min(b1, b2)
            if bx - ax < min_w:
                continue
            if has_vert(ax, top, bot) and has_vert(bx, top, bot):
                rects.append({"x0": int(ax), "x1": int(bx), "y0": int(top), "y1": int(bot)})
            if len(rects) >= 8:
                break
        if len(rects) >= 8:
            break
    kept = []
    for rec in rects:
        area = (rec["x1"] - rec["x0"]) * (rec["y1"] - rec["y0"])
        dup = False
        for prev in kept:
            ix0, iy0 = max(rec["x0"], prev["x0"]), max(rec["y0"], prev["y0"])
            ix1, iy1 = min(rec["x1"], prev["x1"]), min(rec["y1"], prev["y1"])
            inter = max(0, ix1 - ix0) * max(0, iy1 - iy0)
            pa = (prev["x1"] - prev["x0"]) * (prev["y1"] - prev["y0"])
            if pa and inter / float(min(area, pa)) > 0.85:
                dup = True
                break
        if not dup:
            kept.append(rec)
    return kept


def _iou(a, b) -> float:
    ix0, iy0 = max(a["x0"], b["x0"]), max(a["y0"], b["y0"])
    ix1, iy1 = min(a["x1"], b["x1"]), min(a["y1"], b["y1"])
    inter = max(0, ix1 - ix0) * max(0, iy1 - iy0)
    aa = (a["x1"] - a["x0"]) * (a["y1"] - a["y0"])
    ba = (b["x1"] - b["x0"]) * (b["y1"] - b["y0"])
    if not aa or not ba:
        return 0.0
    return inter / float(min(aa, ba))


def sky_defects(rgb: np.ndarray) -> dict:
    """Seams, slice rectangles, overlapping panels, streaks, and a flat zenith band."""
    y = luma(rgb)
    h, w = y.shape
    if h < 48 or w < 48:
        return {"hits": [], "skipped": "small"}
    y0, y1 = _sky_rows(y)
    sub = y[y0:y1]
    # The zenith band is a prefix of the full frame. Cropping to the sky first
    # hides a band that is a large share of that crop.
    band = zenith_band(y)
    streaks, seams = _vertical(y, y0, y1)
    rects = _rectangles(sub)
    panels = []
    for i, a in enumerate(rects):
        for b in rects[i + 1 :]:
            overlap = _iou(a, b)
            if 0.15 <= overlap <= 0.8:
                panels.append({"iou": r4(overlap), "a": a, "b": b})
    hits = []
    if band:
        hits.append({"kind": "zenith_band", **band})
    for st in streaks:
        hits.append({"kind": "streak", **st})
    for sm in seams:
        hits.append({"kind": "seam", **sm})
    for rec in rects:
        hits.append({"kind": "slice_rect", **rec})
    for pan in panels:
        hits.append({"kind": "panel", "iou": pan["iou"]})
    return {
        "hits": hits,
        "zenith": band,
        "streaks": len(streaks),
        "seams": len(seams),
        "rectangles": len(rects),
        "panels": len(panels),
        "skyRows": [int(y0), int(y1)],
        "skipped": None,
    }


def ground_defects(rgb: np.ndarray) -> dict:
    """A flat plain that ends on a hard line, or a void band under the relief."""
    y = luma(rgb)
    h, w = y.shape
    if h < 48 or w < 48:
        return {"hits": [], "skipped": "small"}
    dy = np.abs(np.diff(y, axis=0))
    lo, hi = int(h * 0.18), int(h * 0.88)
    if hi <= lo + 8:
        return {"hits": [], "skipped": "small"}
    strong = dy[lo:hi] >= 22.0
    counts = strong.sum(axis=1).astype(np.float64)
    smooth = np.convolve(counts, np.ones(7), mode="same")
    best = int(np.argmax(smooth))
    r0 = lo + best
    w0 = max(0, best - 3)
    w1 = min(strong.shape[0], best + 4)
    agree = float(strong[w0:w1].any(axis=0).mean()) if w1 > w0 else 0.0
    local = dy[max(0, r0 - 3) : min(h - 1, r0 + 4)]
    med_jump = float(np.median(local.max(axis=0))) if local.size else 0.0
    above = y[max(0, r0 - 22) : max(0, r0 - 4)]
    below = y[min(h, r0 + 4) : min(h, r0 + 22)]
    flat_side = float(min(above.std(), below.std())) if above.size and below.size else 99.0
    hard = agree >= 0.72 and med_jump >= 22.0 and flat_side < 6.0
    row_std = y.std(axis=1)
    voids = []
    run = 0
    start = 0
    for r in range(h):
        if row_std[r] < 6.5:
            if run == 0:
                start = r
            run += 1
        else:
            if 8 <= run <= 80 and start > 2:
                edge_a = float(np.abs(y[start] - y[start - 2]).mean()) if start >= 2 else 0.0
                end = start + run - 1
                edge_b = float(np.abs(y[min(h - 1, end + 2)] - y[end]).mean()) if end + 2 < h else 0.0
                band_std = float(row_std[start : end + 1].mean())
                # One knife edge is enough when the strip itself is nearly featureless.
                strong = band_std < 1.5 and max(edge_a, edge_b) >= 18.0 and run >= 12
                if strong:
                    voids.append({"y": int(start), "h": int(run), "edge": r4(max(edge_a, edge_b))})
            run = 0
    hits = []
    if hard:
        hits.append(
            {
                "kind": "hard_line",
                "row": int(r0),
                "jump": r4(med_jump),
                "agree": r4(agree),
                "flatStd": r4(flat_side),
            }
        )
    for void in voids:
        hits.append({"kind": "void_band", **void})
    return {"hits": hits, "skipped": None}


def stair_crown(rgb: np.ndarray) -> dict:
    """A silhouette crown made of long flat steps instead of a continuous edge."""
    y = luma(rgb)
    h, w = y.shape
    if h < 48 or w < 48:
        return {"stair": False, "runs": 0, "jumpPx": 0, "skipped": "small"}
    sky = float(np.median(y[: max(4, h // 12)]))
    crown = np.full(w, -1, np.int32)
    lo, hi = int(h * 0.04), int(h * 0.78)
    dark_at = y < (sky - 22.0)
    for x in range(w):
        col = dark_at[:, x]
        run = 0
        for r in range(lo, hi):
            if col[r]:
                run += 1
                if run >= 6:
                    crown[x] = r - 5
                    break
            else:
                run = 0
    xs = np.flatnonzero(crown >= 0)
    if xs.size < 24:
        return {"stair": False, "runs": 0, "jumpPx": 0, "columns": int(xs.size), "skipped": None}
    # Longest contiguous span of columns that found a crown.
    breaks = np.where(np.diff(xs) > 1)[0]
    spans = []
    prev = 0
    for b in list(breaks) + [len(xs) - 1]:
        spans.append(xs[prev : b + 1])
        prev = b + 1
    span = max(spans, key=len)
    c = crown[span]
    runs = 0
    jumps = []
    i = 0
    n = len(c)
    while i < n:
        j = i
        while j + 1 < n and abs(int(c[j + 1]) - int(c[i])) <= 1:
            j += 1
        length = j - i + 1
        if length >= STAIR_RUN and j + 1 < n:
            dj = abs(int(c[j + 1]) - int(c[i]))
            if 4 <= dj <= 16:
                runs += 1
                jumps.append(dj)
        i = j + 1
    return {
        "stair": runs >= STAIR_RUNS,
        "runs": int(runs),
        "jumpPx": int(np.median(jumps)) if jumps else 0,
        "columns": int(span.size),
        "skipped": None,
    }


def crop_stats(rgb: np.ndarray, box) -> dict:
    """box is x, y, w, h in pixels. A flat or empty crop is not a visible hero."""
    h, w = rgb.shape[:2]
    x, y, bw, bh = [int(v) for v in box]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(w, x + bw), min(h, y + bh)
    if x1 - x0 < 4 or y1 - y0 < 4:
        return {"visible": False, "reason": "box outside the frame", "std": 0.0, "mean": 0.0}
    sl = luma(rgb[y0:y1, x0:x1])
    std = float(sl.std())
    mean = float(sl.mean())
    visible = std >= 8.0 and not (mean < 16.0 and std < 5.0)
    return {"visible": visible, "reason": None if visible else "flat or empty", "std": r4(std), "mean": r4(mean)}


def focal_px(height: float, fov_deg: float) -> float:
    return (float(height) / 2.0) / math.tan(math.radians(float(fov_deg)) / 2.0)


def surface_mag(texels_per_m: float, dist_m: float, height: float = 1600.0, fov_deg: float = 48.08):
    if dist_m <= 0.05 or texels_per_m <= 0:
        return None
    return focal_px(height, fov_deg) / float(dist_m) / float(texels_per_m)


def hotspot_fixes(mag: float, dist_m, scale, texels, limit: float = 1.0) -> list[str]:
    """The three legal responses to magnification above 1. None enlarges a texture."""
    fixes = []
    if dist_m and mag:
        fixes.append(f"move the camera out to {dist_m * mag / limit:.2f} m")
    if scale and mag:
        fixes.append(f"set scale to {scale * limit / mag:.3f}")
    if texels and mag:
        need = texels * mag / limit
        fixes.append(f"recook the skin at {need:.1f} texels/m and do not enlarge the current texture")
    if not fixes:
        fixes.append("move the camera back until magnification is at or under 1, or recook the skin at the on-screen pixel count")
    return fixes

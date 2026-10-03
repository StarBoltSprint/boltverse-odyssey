"""Sky measurements. Reads Imagine pixels. Does not paint, clone, or mirror any.

Slice joins, cloned edges, and the living-loop period live here.
A downscale exists only inside a measurement buffer and is discarded.
"""

from __future__ import annotations

import math

import numpy as np

JOIN_MAE = 4.0
SWING_MAX = 6.0
# Slice-median exposure jump. Raw column range rejects a high-contrast nebula
# and let the flat step-2 collage pass. A whole slice that jumps stays a fail.
EXPOSURE_MAX = 24.0
PLAY_W = 720
PLAY_H = 1600
HFOV_DEG = 22.7
MAG_LIMIT = 1.0
WINDOW_DEG = 60.0
CLONE_MAE = 1.0
CLONE_FAR = 6.0
FLAT_STD = 3.0
STRIP = 8
MIN_RUN = 8
COMBINED_MIN_SEC = 600.0
OFFSET_MIN_SEC = 0.75
SKY_VIDEOS_MAX = 3
SKY_TEX_MAX = 48 * 1024 * 1024
AMPLITUDE_MAE = 8.0
FEATURE_PERIOD_SEC = 60.0
HOT_MARGIN = 50.0
HOT_LUMA = 160.0
HOT_FRACTION = 0.08
RARE_FRAME_FRACTION = 0.5


def r4(value) -> float:
    return round(float(value), 4)


def column_luma(rgb: np.ndarray) -> np.ndarray:
    return rgb[..., :3].astype(np.float32).mean(axis=(0, 2))


def trailing_defect(rgb: np.ndarray) -> dict:
    """A trailing block that copies or mirrors earlier columns is code-made width."""
    img = rgb[..., :3].astype(np.float32)
    h, w, _ = img.shape
    empty = {"cloned": False, "mirrored": False, "run": 0, "mae": 0.0}
    if w < MIN_RUN * 3 or h < 2:
        return empty
    if float(img.std()) < FLAT_STD:
        return {**empty, "flat": True}
    max_run = min(48, w // 3)
    flipped = img[:, ::-1, :]
    global_sym = float(np.abs(img - flipped).mean())
    for run in range(max_run, MIN_RUN - 1, -1):
        block = img[:, w - run : w]
        prev = img[:, w - 2 * run : w - run]
        mae = float(np.abs(block - prev).mean())
        mid = max(0, w // 2 - run // 2)
        far_block = img[:, mid : mid + run]
        far = float(np.abs(block - far_block).mean()) if far_block.shape[1] == run else 99.0
        if mae <= CLONE_MAE and far > CLONE_FAR:
            return {"cloned": True, "mirrored": False, "run": run, "mae": r4(mae)}
        mirror_prev = prev[:, ::-1, :]
        mae_m = float(np.abs(block - mirror_prev).mean())
        if mae_m <= CLONE_MAE and global_sym > CLONE_FAR:
            return {"cloned": False, "mirrored": True, "run": run, "mae": r4(mae_m)}
        left_mirror = img[:, :run][:, ::-1, :]
        mae_e = float(np.abs(block - left_mirror).mean())
        if mae_e <= CLONE_MAE and global_sym > CLONE_FAR:
            return {"cloned": False, "mirrored": True, "run": run, "mae": r4(mae_e), "edge": True}
    return empty


def _strip(rgb: np.ndarray, side: str, run: int, strip: int = STRIP) -> np.ndarray:
    img = rgb[..., :3].astype(np.float32)
    w = img.shape[1]
    inset = int(run)
    if side == "right":
        x1 = max(1, w - inset)
        x0 = max(0, x1 - strip)
        return img[:, x0:x1]
    x0 = min(w - 1, inset)
    x1 = min(w, x0 + strip)
    return img[:, x0:x1]


def join_mae(left: np.ndarray, right: np.ndarray, left_run: int = 0, right_run: int = 0) -> float:
    rs = _strip(left, "right", left_run)
    ls = _strip(right, "left", right_run)
    rows = min(rs.shape[0], ls.shape[0])
    n = min(rs.shape[1], ls.shape[1])
    if rows < 1 or n < 1:
        return 99.0
    return float(np.abs(rs[:rows, -n:] - ls[:rows, :n]).mean())


def _window_swing(luma: np.ndarray, deg: float) -> float:
    if len(luma) == 0:
        return 0.0
    if deg <= WINDOW_DEG:
        return float(luma.max() - luma.min())
    window = max(1, int(round(len(luma) * WINDOW_DEG / deg)))
    if window >= len(luma):
        return float(luma.max() - luma.min())
    worst = 0.0
    step = max(1, window // 4)
    for i in range(0, len(luma) - window + 1, step):
        seg = luma[i : i + window]
        worst = max(worst, float(seg.max() - seg.min()))
    return worst


def play_px_per_deg() -> tuple[float, float]:
    """Screen pixels per degree on the 720×1600 play view, horizontal and vertical."""
    hfov = math.radians(HFOV_DEG)
    aspect = PLAY_W / PLAY_H
    vfov = 2.0 * math.atan(math.tan(hfov / 2.0) / aspect)
    return PLAY_W / math.degrees(hfov), PLAY_H / math.degrees(vfov)


def band_mag(src_w: float, src_h: float, az_deg: float, el_deg: float, el_bottom_deg: float = 0.0) -> dict:
    """Screen px per source px. Worst horizontal case is the bottom of the band."""
    pxh, pxv = play_px_per_deg()
    mag_w = pxh * math.cos(math.radians(el_bottom_deg)) * float(az_deg) / float(src_w)
    mag_h = pxv * float(el_deg) / float(src_h)
    mag = max(mag_w, mag_h)
    return {"mag": r4(mag), "magW": r4(mag_w), "magH": r4(mag_h), "ok": mag <= MAG_LIMIT + 1e-3}


def cap_mag(src_w: float, el_start_deg: float) -> dict:
    """Polar cap. The outer parallel is the worst ring; radius maps to half the texture."""
    pxh, pxv = play_px_per_deg()
    circ = 360.0 * math.cos(math.radians(el_start_deg))
    px_per = (math.pi * float(src_w)) / max(1e-6, circ)
    mag = max(pxh, pxv) / px_per
    return {"mag": r4(mag), "ok": mag <= MAG_LIMIT + 1e-3, "elStartDeg": el_start_deg, "srcW": src_w}


def tile_mag(src_w: float, src_h: float, az_deg: float, el_deg: float) -> dict:
    """One video tile at the horizon, where a degree of azimuth is a full visual degree."""
    row = band_mag(src_w, src_h, az_deg, el_deg, 0.0)
    row["azimuthDeg"] = az_deg
    row["elevationDeg"] = el_deg
    return row


def assess_display(display: dict, measured: dict | None = None) -> dict:
    """Fail if a slice, cap, or video tile is mapped above magnification 1.

    `measured` may supply srcW/srcH per id when the manifest does not inline them.
    A video tile whose azimuth is the whole 360° (the step-2 veil) fails.
    """
    measured = measured or {}
    failures = []
    rows = []
    if not isinstance(display, dict):
        return {"ok": False, "failures": ["FAIL sky display mapping missing"], "rows": rows}
    for band in display.get("bands") or []:
        name = str(band.get("id") or "band")
        size = measured.get(name) or band
        src_w = float(size.get("srcW") or 0)
        src_h = float(size.get("srcH") or 0)
        az = float(band.get("azimuthDeg") or 0)
        el0 = float(band.get("elBottomDeg") or 0)
        el1 = float(band.get("elTopDeg") or 0)
        if src_w < 2 or src_h < 2 or az <= 0 or el1 <= el0:
            failures.append(f"FAIL sky display {name} missing size or angular span")
            continue
        row = band_mag(src_w, src_h, az, el1 - el0, el0)
        row["id"] = name
        rows.append(row)
        if not row["ok"]:
            failures.append(
                f"FAIL sky magnification {name}={row['mag']} limit={MAG_LIMIT} "
                f"(src {int(src_w)}x{int(src_h)} over {az} deg x {el1 - el0:.2f} deg)"
            )
    cap = display.get("cap")
    if cap:
        size = measured.get("cap") or cap
        src_w = float(size.get("srcW") or 0)
        el = float(cap.get("elStartDeg") or 0)
        if src_w < 2:
            failures.append("FAIL sky display cap missing size")
        else:
            row = cap_mag(src_w, el)
            row["id"] = "cap"
            rows.append(row)
            if not row["ok"]:
                failures.append(
                    f"FAIL sky magnification cap={row['mag']} limit={MAG_LIMIT} "
                    f"(src {int(src_w)} from elevation {el} deg)"
                )
    for tile in display.get("videoTiles") or []:
        name = str(tile.get("id") or "layer")
        size = measured.get(name) or tile
        src_w = float(size.get("srcW") or 0)
        src_h = float(size.get("srcH") or 0)
        az = float(tile.get("azimuthDeg") or 0)
        el = float(tile.get("elevationDeg") or 0)
        if src_w < 2 or src_h < 2 or az <= 0 or el <= 0:
            failures.append(f"FAIL sky display video {name} missing size or tile span")
            continue
        row = tile_mag(src_w, src_h, az, el)
        row["id"] = name
        rows.append(row)
        if not row["ok"]:
            failures.append(
                f"FAIL sky magnification {name}={row['mag']} limit={MAG_LIMIT} "
                f"(video {int(src_w)}x{int(src_h)} tile {az} deg x {el} deg)"
            )
    return {"ok": not failures, "failures": failures, "rows": rows, "limit": MAG_LIMIT}


def slice_median(rgb: np.ndarray) -> float:
    img = rgb[..., :3].astype(np.float32)
    return float(np.median(img.mean(axis=2)))


def exposure_swing(images: list[np.ndarray]) -> dict:
    """Median luma jump between slices. Internal nebula contrast is not a drift."""
    medians = [slice_median(rgb) for rgb in images]
    if len(medians) < 2:
        return {"swing": 0.0, "ok": True, "medians": medians}
    worst = 0.0
    for i, med in enumerate(medians):
        nxt = medians[(i + 1) % len(medians)]
        worst = max(worst, abs(med - nxt))
    worst = max(worst, max(medians) - min(medians))
    return {
        "swing": r4(worst),
        "ok": worst <= EXPOSURE_MAX + 1e-6,
        "medians": [r4(m) for m in medians],
        "limit": EXPOSURE_MAX,
    }


def chain_swing(images: list[np.ndarray], runs: list[int]) -> dict:
    parts = []
    for rgb, run in zip(images, runs):
        luma = column_luma(rgb)
        end = max(1, len(luma) - int(run))
        parts.append(luma[:end])
    if not parts:
        return {"swing": 0.0, "ok": True, "windowPx": 0}
    chain = np.concatenate(parts)
    total = len(chain)
    window = max(1, int(round(total * WINDOW_DEG / 360.0)))
    worst = _window_swing(chain, 360.0)
    step = max(1, window // 4)
    for i in range(step, window, step):
        seg = np.concatenate([chain[total - i :], chain[: window - i]])
        if len(seg) == window:
            worst = max(worst, float(seg.max() - seg.min()))
    return {"swing": r4(worst), "windowPx": window, "ok": worst <= SWING_MAX + 1e-6}


def lcm_seconds(durations: list[float]) -> float:
    """Least common multiple of durations, in seconds, at 0.1 s resolution."""
    if not durations:
        return 0.0
    tenths = [max(1, int(round(float(d) * 10.0))) for d in durations]
    acc = tenths[0]
    for item in tenths[1:]:
        acc = acc // math.gcd(acc, item) * item
    return acc / 10.0


def _components(hot: np.ndarray) -> list[dict]:
    h, w = hot.shape
    seen = np.zeros_like(hot, dtype=bool)
    found = []
    for y in range(h):
        for x in range(w):
            if not hot[y, x] or seen[y, x]:
                continue
            stack = [(y, x)]
            seen[y, x] = True
            pts = []
            while stack:
                cy, cx = stack.pop()
                pts.append((cy, cx))
                for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                    if 0 <= ny < h and 0 <= nx < w and hot[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            ys = [p[0] for p in pts]
            xs = [p[1] for p in pts]
            found.append({"area": len(pts), "y": float(np.mean(ys)), "x": float(np.mean(xs))})
    return found


def perceived_repetition(frames: np.ndarray, fps: float) -> dict:
    """Flag a rare bright feature that comes back on a fixed period under 60 s.

    A dense or always-on star field is the loop texture. A flash or a shooting
    star that reappears on a short period is the defect. Frames are gray, 0–255.
    """
    if frames.ndim != 3 or len(frames) < 4 or fps <= 0:
        return {"ok": True, "periodSec": None, "features": 0, "reason": "too-short"}
    rare_times: list[float] = []
    hot_masks = []
    for index, frame in enumerate(frames):
        med = float(np.median(frame))
        hot = frame >= max(med + HOT_MARGIN, HOT_LUMA)
        frac = float(hot.mean())
        comps = [c for c in _components(hot) if 1 <= c["area"] <= 12]
        rare = frac <= HOT_FRACTION and 0 < len(comps) <= 2
        hot_masks.append(hot if rare else None)
        if rare:
            rare_times.append(index / fps)
    fraction = len(rare_times) / float(len(frames))
    period = _period_of(rare_times) if fraction < RARE_FRAME_FRACTION else None
    autocorr = _mask_period(hot_masks, fps) if fraction < RARE_FRAME_FRACTION else None
    hit = None
    if period is not None and period < FEATURE_PERIOD_SEC:
        hit = period
    if autocorr is not None and autocorr < FEATURE_PERIOD_SEC:
        hit = autocorr if hit is None else min(hit, autocorr)
    return {
        "ok": hit is None,
        "periodSec": None if hit is None else r4(hit),
        "features": len(rare_times),
        "rareFraction": r4(fraction),
        "reason": "distinctive feature repeats" if hit is not None else "no short distinctive repeat",
    }


def _period_of(times: list[float]) -> float | None:
    if len(times) < 3:
        return None
    gaps = [times[i + 1] - times[i] for i in range(len(times) - 1)]
    mean = float(np.mean(gaps))
    if mean <= 0:
        return None
    if float(np.std(gaps)) / mean > 0.15:
        return None
    return mean


def _mask_period(masks: list, fps: float) -> float | None:
    usable = [m for m in masks if m is not None]
    if len(usable) < 3:
        return None
    n = len(masks)
    max_lag = min(n - 2, int(FEATURE_PERIOD_SEC * fps))
    for lag in range(max(1, int(0.4 * fps)), max_lag + 1):
        scores = []
        for i in range(n - lag):
            a = masks[i]
            b = masks[i + lag]
            if a is None or b is None:
                continue
            union = np.logical_or(a, b).sum()
            if union < 1:
                continue
            scores.append(float(np.logical_and(a, b).sum()) / float(union))
        if len(scores) >= 3 and float(np.mean(scores)) >= 0.85:
            return lag / fps
    return None


def frame_amplitude(frames: np.ndarray) -> float:
    if len(frames) < 2:
        return 0.0
    a = frames[:-1].astype(np.float32)
    b = frames[1:].astype(np.float32)
    return float(np.abs(a - b).mean())


MOTIF_REPEAT = 0.80
MOTIF_MIRROR = 0.58
MOTIF_HALF = 0.58
MOTIF_NEIGHBOUR = 0.88
MOTIF_FLAT = 6.0
# A soft two-painting gap: the middle pair of colour blocks stops continuing
# while the rest of the slice still does. Upper slice 6 (step 2c) sits here.
# Keepers stay above the centre line. Do not lower these to clear a bad slice.
SOFT_GAP_CENTER = 0.46
SOFT_GAP_DROP = 0.34


def _box_luma(rgb: np.ndarray, tw: int, th: int) -> np.ndarray:
    """Downscale luma for a motif test. The buffer is not a texture and is not saved."""
    luma = rgb[..., :3].astype(np.float32).mean(axis=2)
    h, w = luma.shape
    tw = max(2, min(int(tw), w))
    th = max(2, min(int(th), h))
    ys = np.linspace(0, h, th + 1).astype(np.int32)
    xs = np.linspace(0, w, tw + 1).astype(np.int32)
    out = np.empty((th, tw), np.float32)
    for y in range(th):
        y0, y1 = int(ys[y]), max(int(ys[y + 1]), int(ys[y]) + 1)
        y1 = min(h, y1)
        row = luma[y0:y1]
        for x in range(tw):
            x0, x1 = int(xs[x]), max(int(xs[x + 1]), int(xs[x]) + 1)
            x1 = min(w, x1)
            out[y, x] = float(row[:, x0:x1].mean())
    return out


def _zncc(a: np.ndarray, b: np.ndarray) -> float:
    """Per-window normalised correlation. Flat windows are not a motif."""
    if a.size < 8 or a.shape != b.shape:
        return 0.0
    if float(a.std()) < MOTIF_FLAT or float(b.std()) < MOTIF_FLAT:
        return 0.0
    aa = a.astype(np.float32).ravel()
    bb = b.astype(np.float32).ravel()
    aa -= float(aa.mean())
    bb -= float(bb.mean())
    na = float(np.dot(aa, aa)) ** 0.5
    nb = float(np.dot(bb, bb)) ** 0.5
    if na < 1e-3 or nb < 1e-3:
        return 0.0
    return float(np.dot(aa, bb) / (na * nb))


def _soft_gap(rgb: np.ndarray) -> dict:
    """Two paintings blended through the middle, with no hard edge.

    Colour blocks across the slice. A continuous painting keeps a similar
    continuation score at the centre. A soft gap drops only there.
    """
    img = rgb[..., :3].astype(np.float32)
    h, w, _ = img.shape
    gh, gw = 8, 12
    blocks = np.empty((gh, gw, 3), np.float32)
    ys = np.linspace(0, h, gh + 1).astype(np.int32)
    xs = np.linspace(0, w, gw + 1).astype(np.int32)
    for y in range(gh):
        y0, y1 = int(ys[y]), max(int(ys[y + 1]), int(ys[y]) + 1)
        y1 = min(h, y1)
        for x in range(gw):
            x0, x1 = int(xs[x]), max(int(xs[x + 1]), int(xs[x]) + 1)
            x1 = min(w, x1)
            blocks[y, x] = img[y0:y1, x0:x1].mean(axis=(0, 1))
    cont = [_zncc(blocks[:, x], blocks[:, x + 1]) for x in range(gw - 1)]
    center = float(cont[gw // 2 - 1])
    med = float(np.median(cont))
    drop = med - center
    return {
        "gapCenter": r4(center),
        "gapDrop": r4(drop),
        "gapped": bool(center < SOFT_GAP_CENTER and drop >= SOFT_GAP_DROP),
    }


def motif_defect(rgb: np.ndarray) -> dict:
    """A cloud bank copied inside one slice, or a left-right mirror / diptych.

    Trailing-column copies stay in trailing_defect. This looks at separated
    interior windows and at the two halves. A flat field scores zero.
    A soft two-painting gap is the centre continuation drop.
    """
    small = _box_luma(rgb, 160, 72)
    _h, w = small.shape
    win = max(8, w // 4)
    step = 1
    sep = max(1, int(round(0.85 * win)))
    best = 0.0
    x0 = 0
    while x0 + win <= w:
        wa = small[:, x0 : x0 + win]
        x1 = x0 + sep
        while x1 + win <= w:
            best = max(best, _zncc(wa, small[:, x1 : x1 + win]))
            x1 += step
        x0 += step
    half = max(1, w // 2)
    left = small[:, :half]
    right = small[:, w - half :]
    half_copy = _zncc(left, right)
    half_flip = _zncc(left, right[:, ::-1])
    seam_luma = _box_luma(rgb, 240, 96)
    diff = np.abs(np.diff(seam_luma, axis=1))
    col = diff.mean(axis=0)
    med = float(np.median(col)) + 1e-3
    peak_i = int(np.argmax(col))
    at = peak_i / max(1, len(col))
    row_med = np.median(diff, axis=1)
    frac = float((diff[:, peak_i] > np.maximum(row_med * 2.5, 6.0)).mean())
    ratio = float(col[peak_i] / med)
    seamed = 0.12 < at < 0.88 and ratio >= 4.5 and frac >= 0.55 and float(col[peak_i]) >= 12.0
    gap = _soft_gap(rgb)
    return {
        "repeat": r4(best),
        "mirror": r4(half_flip),
        "half": r4(half_copy),
        "seamRatio": r4(ratio),
        "seamAt": r4(at),
        "repeated": best >= MOTIF_REPEAT,
        "mirrored": half_flip >= MOTIF_MIRROR,
        "copied": half_copy >= MOTIF_HALF,
        "seamed": seamed,
        "gapCenter": gap["gapCenter"],
        "gapDrop": gap["gapDrop"],
        "gapped": gap["gapped"],
    }


def motif_neighbour(left: np.ndarray, right: np.ndarray) -> float:
    """Interior match between neighbours. Joining edges may agree; the middles may not be copies."""
    a = _box_luma(left, 96, 48)
    b = _box_luma(right, 96, 48)
    w = min(a.shape[1], b.shape[1])
    x0 = int(w * 0.30)
    x1 = int(w * 0.70)
    if x1 - x0 < 8:
        return 0.0
    return _zncc(a[:, x0:x1], b[:, x0:x1])


def assess_slices(named: list[tuple[str, np.ndarray]]) -> dict:
    """Gate a sky slice chain. The chain must close: last joins first."""
    failures = []
    slices = []
    runs = []
    images = []
    for name, rgb in named:
        defect = trailing_defect(rgb)
        luma = column_luma(rgb)
        content = luma[: max(1, len(luma) - int(defect["run"]))]
        motif = motif_defect(rgb)
        row = {
            "file": name,
            "cloned": bool(defect["cloned"]),
            "mirrored": bool(defect["mirrored"]),
            "run": int(defect["run"]),
            "cloneMae": defect.get("mae", 0.0),
            "columnLumaMin": r4(float(content.min()) if len(content) else 0),
            "columnLumaMax": r4(float(content.max()) if len(content) else 0),
            "motifRepeat": motif["repeat"],
            "motifMirror": motif["mirror"],
            "motifHalf": motif["half"],
            "motifRepeated": bool(motif["repeated"]),
            "motifMirrored": bool(motif["mirrored"]),
            "motifCopied": bool(motif["copied"]),
            "motifSeamed": bool(motif["seamed"]),
            "motifSeamRatio": motif["seamRatio"],
            "motifGapped": bool(motif["gapped"]),
            "motifGapCenter": motif["gapCenter"],
            "motifGapDrop": motif["gapDrop"],
        }
        if defect["cloned"]:
            failures.append(f"FAIL sky clone {name} trailing run={defect['run']} mae={defect['mae']}")
        if defect["mirrored"]:
            failures.append(f"FAIL sky mirror {name} trailing run={defect['run']} mae={defect['mae']}")
        if motif["repeated"]:
            failures.append(f"FAIL sky motif repeat {name} ncc={motif['repeat']}")
        if motif["mirrored"]:
            failures.append(f"FAIL sky motif mirror {name} ncc={motif['mirror']}")
        if motif["copied"]:
            failures.append(f"FAIL sky motif copy {name} ncc={motif['half']}")
        if motif["seamed"]:
            failures.append(
                f"FAIL sky motif seam {name} ratio={motif['seamRatio']} at={motif['seamAt']}"
            )
        if motif["gapped"]:
            failures.append(
                f"FAIL sky motif gap {name} center={motif['gapCenter']} drop={motif['gapDrop']}"
            )
        slices.append(row)
        runs.append(int(defect["run"]) if defect["cloned"] or defect["mirrored"] else 0)
        images.append(rgb)

    joins = []
    for i in range(len(named) - 1):
        mae = join_mae(images[i], images[i + 1], runs[i], runs[i + 1])
        ok = mae <= JOIN_MAE
        neighbour = motif_neighbour(images[i], images[i + 1])
        neighbour_ok = neighbour < MOTIF_NEIGHBOUR
        joins.append(
            {
                "left": named[i][0],
                "right": named[i + 1][0],
                "mae": r4(mae),
                "limit": JOIN_MAE,
                "ok": ok and neighbour_ok,
                "close": False,
                "motifNeighbour": r4(neighbour),
            }
        )
        if not ok:
            failures.append(
                f"FAIL sky join {named[i][0]} -> {named[i + 1][0]} content MAE={mae:.2f} limit={JOIN_MAE}"
            )
        if not neighbour_ok:
            failures.append(
                f"FAIL sky motif neighbour {named[i][0]} -> {named[i + 1][0]} ncc={neighbour:.2f}"
            )

    closed = None
    if len(named) >= 2:
        mae = join_mae(images[-1], images[0], runs[-1], runs[0])
        neighbour = motif_neighbour(images[-1], images[0])
        ok = mae <= JOIN_MAE
        neighbour_ok = neighbour < MOTIF_NEIGHBOUR
        closed = {
            "left": named[-1][0],
            "right": named[0][0],
            "mae": r4(mae),
            "limit": JOIN_MAE,
            "ok": ok and neighbour_ok,
            "close": True,
            "motifNeighbour": r4(neighbour),
        }
        if not ok:
            failures.append(
                f"FAIL sky close {named[-1][0]} -> {named[0][0]} content MAE={mae:.2f} limit={JOIN_MAE}"
            )
        if not neighbour_ok:
            failures.append(
                f"FAIL sky motif neighbour {named[-1][0]} -> {named[0][0]} ncc={neighbour:.2f}"
            )
    elif len(named) == 1:
        failures.append("FAIL sky chain needs at least 2 slices to close")

    column = chain_swing(images, runs) if images else {"swing": 0.0, "ok": True, "windowPx": 0}
    exposed = exposure_swing(images) if images else {"swing": 0.0, "ok": True, "medians": []}
    # `swing` stays the gate number (exposure). Raw column range is reported beside it.
    swing = {
        "swing": exposed["swing"],
        "ok": exposed["ok"],
        "medians": exposed.get("medians") or [],
        "limit": EXPOSURE_MAX,
        "columnSwing": column.get("swing", 0.0),
        "windowPx": column.get("windowPx", 0),
    }
    if images and not exposed["ok"]:
        failures.append(
            f"FAIL sky exposure swing={exposed['swing']} limit={EXPOSURE_MAX} "
            f"in a {WINDOW_DEG:.0f} deg window"
        )

    per_swing = []
    medians = exposed.get("medians") or []
    anchor = float(np.median(medians)) if medians else 0.0
    for (name, _rgb), med in zip(named, medians or [0.0] * len(named)):
        local = abs(float(med) - anchor)
        per_swing.append({"file": name, "swing": r4(local), "median": med})

    advice = _cheapest(slices, joins, closed, per_swing)
    ok = not failures
    return {
        "ok": ok,
        "status": "PASS" if ok else "FAIL",
        "slices": slices,
        "joins": joins,
        "close": closed,
        "swing": swing,
        "sliceSwing": per_swing,
        "limits": {"joinMae": JOIN_MAE, "swing": EXPOSURE_MAX, "windowDeg": WINDOW_DEG},
        "cheapest": advice,
        "failures": failures,
    }


def _cheapest(slices, joins, closed, per_swing) -> dict:
    blame: dict[str, int] = {row["file"]: 0 for row in slices}
    reasons: dict[str, list[str]] = {row["file"]: [] for row in slices}
    order = {row["file"]: index for index, row in enumerate(slices)}
    for join in joins:
        if join["ok"]:
            continue
        blame[join["right"]] += 1
        blame[join["left"]] += 1
        reasons[join["right"]].append(f"join from {join['left']} MAE {join['mae']}")
        reasons[join["left"]].append(f"join to {join['right']} MAE {join['mae']}")
    if closed and not closed["ok"]:
        blame[closed["left"]] += 1
        blame[closed["right"]] += 1
        reasons[closed["left"]].append("closing join to the first slice")
        reasons[closed["right"]].append("closing join from the last slice")
    for row in slices:
        if row["cloned"] or row["mirrored"]:
            blame[row["file"]] += 3
            kind = "cloned" if row["cloned"] else "mirrored"
            reasons[row["file"]].append(f"trailing columns are {kind}")
        if row.get("motifRepeated") or row.get("motifMirrored") or row.get("motifCopied") or row.get("motifSeamed"):
            blame[row["file"]] += 3
            reasons[row["file"]].append("interior motif is repeated or mirrored")
    swing_of = {row["file"]: row["swing"] for row in per_swing}
    for name, swing in swing_of.items():
        if swing > EXPOSURE_MAX:
            blame[name] += 2
            reasons[name].append(f"exposure swing {swing}")
    if not blame:
        return {"file": None, "clears": 0, "why": "no slices"}
    ranked = sorted(blame.items(), key=lambda item: (-item[1], -order.get(item[0], 0)))
    name, weight = ranked[0]
    if weight <= 0:
        return {"file": None, "clears": 0, "why": "no failing join"}
    why = "; ".join(reasons[name]) or "highest failure weight"
    return {
        "file": name,
        "clears": weight,
        "why": f"recook {name}: {why}",
        "ranked": [{"file": n, "weight": w} for n, w in ranked if w > 0],
    }

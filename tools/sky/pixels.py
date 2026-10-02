"""Sky measurements. Reads Imagine pixels. Does not paint, clone, or mirror any.

Slice joins, cloned edges, and the living-loop period live here.
A downscale exists only inside a measurement buffer and is discarded.
"""

from __future__ import annotations

import math

import numpy as np

JOIN_MAE = 4.0
SWING_MAX = 6.0
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
        row = {
            "file": name,
            "cloned": bool(defect["cloned"]),
            "mirrored": bool(defect["mirrored"]),
            "run": int(defect["run"]),
            "cloneMae": defect.get("mae", 0.0),
            "columnLumaMin": r4(float(content.min()) if len(content) else 0),
            "columnLumaMax": r4(float(content.max()) if len(content) else 0),
        }
        if defect["cloned"]:
            failures.append(f"FAIL sky clone {name} trailing run={defect['run']} mae={defect['mae']}")
        if defect["mirrored"]:
            failures.append(f"FAIL sky mirror {name} trailing run={defect['run']} mae={defect['mae']}")
        slices.append(row)
        runs.append(int(defect["run"]) if defect["cloned"] or defect["mirrored"] else 0)
        images.append(rgb)

    joins = []
    for i in range(len(named) - 1):
        mae = join_mae(images[i], images[i + 1], runs[i], runs[i + 1])
        ok = mae <= JOIN_MAE
        joins.append(
            {
                "left": named[i][0],
                "right": named[i + 1][0],
                "mae": r4(mae),
                "limit": JOIN_MAE,
                "ok": ok,
                "close": False,
            }
        )
        if not ok:
            failures.append(
                f"FAIL sky join {named[i][0]} -> {named[i + 1][0]} content MAE={mae:.2f} limit={JOIN_MAE}"
            )

    closed = None
    if len(named) >= 2:
        mae = join_mae(images[-1], images[0], runs[-1], runs[0])
        ok = mae <= JOIN_MAE
        closed = {"left": named[-1][0], "right": named[0][0], "mae": r4(mae), "limit": JOIN_MAE, "ok": ok, "close": True}
        if not ok:
            failures.append(
                f"FAIL sky close {named[-1][0]} -> {named[0][0]} content MAE={mae:.2f} limit={JOIN_MAE}"
            )
    elif len(named) == 1:
        failures.append("FAIL sky chain needs at least 2 slices to close")

    swing = chain_swing(images, runs) if images else {"swing": 0.0, "ok": True, "windowPx": 0}
    if images and not swing["ok"]:
        failures.append(
            f"FAIL sky column luma swing={swing['swing']} limit={SWING_MAX} in a {WINDOW_DEG:.0f} deg window"
        )

    per_swing = []
    widths = []
    for rgb, run in zip(images, runs):
        luma = column_luma(rgb)
        widths.append(max(1, len(luma) - int(run)))
    total_w = sum(widths) or 1
    for (name, rgb), run, width in zip(named, runs, widths):
        luma = column_luma(rgb)[:width]
        deg = 360.0 * width / total_w
        local = _window_swing(luma, deg)
        per_swing.append({"file": name, "swing": r4(local), "deg": r4(deg)})
        if local > SWING_MAX + 1e-6:
            failures.append(f"FAIL sky slice swing {name} column luma swing={local:.2f} limit={SWING_MAX}")

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
        "limits": {"joinMae": JOIN_MAE, "swing": SWING_MAX, "windowDeg": WINDOW_DEG},
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
    swing_of = {row["file"]: row["swing"] for row in per_swing}
    for name, swing in swing_of.items():
        if swing > SWING_MAX:
            blame[name] += 2
            reasons[name].append(f"column luma swing {swing}")
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

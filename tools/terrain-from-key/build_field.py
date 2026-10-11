"""Metric heightfield from the key ground, plus a dune extension that is not a stamp of the key."""

from __future__ import annotations

import math

import numpy as np

from geom import plane_t, ray_directions


def _fill_holes(grid: np.ndarray, valid: np.ndarray) -> np.ndarray:
    """Nearest-valid fill. The values stay samples of the key, not new colours."""
    if valid.all() or not valid.any():
        return grid.copy()
    h, w = grid.shape
    inf = 10**6
    dist = np.where(valid, 0, inf).astype(np.int32)
    oy = np.where(valid, np.arange(h)[:, None], 0).astype(np.int32)
    ox = np.where(valid, np.arange(w)[None, :], 0).astype(np.int32)
    step = 1
    while step < max(h, w):
        for dy in (0, step, -step):
            for dx in (0, step, -step):
                if dy == 0 and dx == 0:
                    continue
                sy = np.roll(np.roll(dist, dy, 0), dx, 1)
                yy = np.roll(np.roll(oy, dy, 0), dx, 1)
                xx = np.roll(np.roll(ox, dy, 0), dx, 1)
                if dy > 0:
                    sy[:dy] = inf
                elif dy < 0:
                    sy[dy:] = inf
                if dx > 0:
                    sy[:, :dx] = inf
                elif dx < 0:
                    sy[:, dx:] = inf
                better = sy + step < dist
                dist = np.where(better, sy + step, dist)
                oy = np.where(better, yy, oy)
                ox = np.where(better, xx, ox)
        step *= 2
    return grid[np.clip(oy, 0, h - 1), np.clip(ox, 0, w - 1)]


def sample_grid(grid, origin, step, x, z):
    x = np.asarray(x, np.float64)
    z = np.asarray(z, np.float64)
    fx = (x - origin[0]) / step
    fz = (z - origin[1]) / step
    h, w = grid.shape
    fx = np.clip(fx, 0, w - 1.001)
    fz = np.clip(fz, 0, h - 1.001)
    x0 = np.floor(fx).astype(np.int32)
    z0 = np.floor(fz).astype(np.int32)
    tx = fx - x0
    tz = fz - z0
    x1 = np.minimum(x0 + 1, w - 1)
    z1 = np.minimum(z0 + 1, h - 1)
    return (
        grid[z0, x0] * (1 - tx) * (1 - tz)
        + grid[z0, x1] * tx * (1 - tz)
        + grid[z1, x0] * (1 - tx) * tz
        + grid[z1, x1] * tx * tz
    )


def _hash01(ix, iz, k, seed):
    h = np.int64(ix) * 374761393 ^ np.int64(iz) * 668265263 ^ np.int64(seed + k * 1013) * 2246822519
    h = (h ^ (h >> 13)) * 1274126177
    h = h ^ (h >> 16)
    return (h.astype(np.uint64) % np.uint64(2**32)).astype(np.float64) / 4294967296.0


def _vnoise(x, z, k, seed):
    ix = np.floor(x).astype(np.int32)
    iz = np.floor(z).astype(np.int32)
    fx = x - ix
    fz = z - iz
    fx = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
    fz = fz * fz * fz * (fz * (fz * 6 - 15) + 10)
    a = _hash01(ix, iz, k, seed)
    b = _hash01(ix + 1, iz, k, seed)
    c = _hash01(ix, iz + 1, k, seed)
    d = _hash01(ix + 1, iz + 1, k, seed)
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz


def extension_height(x, z, amp, wavelength, seed=1011):
    """Broad dunes from value noise. No periodic ridge, so the field is not a stamp."""
    wr = math.radians(60.0)
    wx, wz = math.sin(wr), -math.cos(wr)
    u = x * wx + z * wz
    v = x * wz - z * wx
    # irrational scales: the lags do not line up into one repeating dune
    # All three wavelengths stay inside 50–200 m (q29). A 4× octave
    # autocorrelated above 0.75 inside the 40–220 m gate and read as a stamp.
    n1 = _vnoise(u / wavelength, v / (wavelength * 1.618), 1, seed)
    n2 = _vnoise(u / (wavelength * 0.618), v / (wavelength * 1.414), 2, seed)
    n3 = _vnoise(u / (wavelength * 1.732), v / (wavelength * 0.577), 3, seed + 3)
    return amp * ((n1 - 0.5) * 0.85 + (n2 - 0.5) * 0.45 + (n3 - 0.5) * 0.28)


def avenue_frame(x, z, origin_xz, heading_deg):
    hd = math.radians(heading_deg)
    fx, fz = math.sin(hd), -math.cos(hd)
    rx, rz = math.sin(hd + math.pi / 2), -math.cos(hd + math.pi / 2)
    dx = x - origin_xz[0]
    dz = z - origin_xz[1]
    along = dx * fx + dz * fz
    lateral = dx * rx + dz * rz
    return along, lateral


def build_cloud(cam, dirs, ground, disp, gain: float):
    """Unproject ground pixels onto their camera rays.

    Below the horizon a ray cannot climb above the eye, so the dune face is a
    fraction of the eye height pulled in from the ground plane. Side pixels
    above the horizon are the crests: `gain` lifts those, capped in the
    q29 15–40 m band. The centre avenue is not lifted into a wall.
    """
    eye = float(cam["eye"])
    origin = np.array([cam["x"], eye, cam["z"]], np.float64)
    h, w = ground.shape
    t_plane = plane_t(eye, dirs, 0.0)
    dy = dirs[..., 1]
    d = disp.astype(np.float64)
    below = ground & np.isfinite(t_plane) & (t_plane > 2.0) & (t_plane < 450.0) & (dy < -0.004)
    centre = below.copy()
    centre[:, : int(w * 0.42)] = False
    centre[:, int(w * 0.58) :] = False
    use = centre
    if int(centre.sum()) > 40:
        cut = float(np.quantile(t_plane[centre], 0.55))
        far = centre & (t_plane >= cut)
        if int(far.sum()) > 30:
            use = far
    if int(use.sum()) < 30:
        return np.zeros((0, 3), np.float64)
    d_ref = float(np.median(d[use]))
    gap = d - d_ref
    hi = float(np.quantile(gap[below], 0.90)) if int(below.sum()) > 50 else 0.35
    hi = max(hi, 0.08)
    # Faces stay on the downward ray. Crests (handled below) carry the tall relief.
    face = min(eye * 0.90, 1.6 + 2.4 * float(gain))
    y = np.clip(gap / hi, -0.45, 1.0) * face
    # The pictured lane is the centre columns. World-lateral carve cannot
    # see it: those columns unproject inside the lane, on top of the dunes.
    cols = np.arange(w)[None, :]
    avenue_cols = (cols >= int(w * 0.40)) & (cols < int(w * 0.60))
    y = np.where(avenue_cols, y - 1.5, y)
    y = np.clip(y, -2.6, eye - 0.08)
    t_hit = (y - eye) / np.minimum(dy, -1e-4)
    ok = below & (t_hit > 1.5) & (t_hit < 450.0)
    pts = origin + t_hit[..., None] * dirs
    pts = pts.copy()
    pts[..., 1] = y

    # Crests: sand beside the avenue whose ray climbs. Skip the centre,
    # where orange haze sits on the vanishing point.
    side = np.zeros(ground.shape, np.bool_)
    side[:, : int(w * 0.40)] = True
    side[:, int(w * 0.62) :] = True
    above = ground & side & (dy >= -0.004) & (dy < 0.22)
    scale = float(np.median(t_plane[use] * (d[use] + 0.05)))
    scale = float(np.clip(scale, 8.0, 220.0))
    t_up = np.clip(scale / (d + 0.05), 8.0, 380.0)
    cap = float(np.clip(8.0 + 10.0 * float(gain), 8.0, 36.0))
    y_up = np.clip(eye + t_up * np.maximum(dy, 0.0), 0.0, cap)
    steep = dy > 0.004
    t_up = np.where(steep, (y_up - eye) / np.maximum(dy, 1e-4), t_up)
    ok_up = above & np.isfinite(t_up) & (t_up > 4.0) & (t_up < 400.0) & (y_up < cap + 0.1)
    pts_up = origin + t_up[..., None] * dirs
    if int(ok_up.sum()) > 0:
        extra = pts_up[ok_up]
        extra = extra.copy()
        extra[:, 1] = y_up[ok_up]
        base = pts[ok]
        if len(base) == 0:
            return extra
        return np.concatenate([base, extra], axis=0)
    return pts[ok]


def bin_points(pts, origin, step, shape):
    h, w = shape
    if len(pts) == 0:
        return np.zeros(shape, np.float32), np.zeros(shape, np.bool_)
    ix = np.floor((pts[:, 0] - origin[0]) / step).astype(np.int32)
    iz = np.floor((pts[:, 2] - origin[1]) / step).astype(np.int32)
    ok = (ix >= 0) & (iz >= 0) & (ix < w) & (iz < h)
    ix, iz, yy = ix[ok], iz[ok], pts[ok, 1]
    acc = np.zeros(shape, np.float64)
    cnt = np.zeros(shape, np.float64)
    np.add.at(acc, (iz, ix), yy)
    np.add.at(cnt, (iz, ix), 1)
    valid = cnt > 0
    grid = np.zeros(shape, np.float32)
    grid[valid] = (acc[valid] / cnt[valid]).astype(np.float32)
    return grid, valid


def smooth(grid, k=2):
    """Box blur. The grid is a shape, not a texture."""
    out = grid
    for _ in range(k):
        p = np.pad(out, 1, mode="edge")
        out = (
            p[:-2, :-2] + p[:-2, 1:-1] + p[:-2, 2:]
            + p[1:-1, :-2] + p[1:-1, 1:-1] + p[1:-1, 2:]
            + p[2:, :-2] + p[2:, 1:-1] + p[2:, 2:]
        ) / 9.0
    return out.astype(np.float32)


def dominant_wavelength(heights, step):
    """First strong lag of a centre row, in metres. Falls back to 140 m."""
    row = heights[heights.shape[0] // 2].astype(np.float64)
    row = row - row.mean()
    if np.allclose(row, 0):
        return 140.0
    spec = np.fft.rfft(row * np.hanning(len(row)))
    mag = np.abs(spec)
    mag[0] = 0
    # ignore wavelengths shorter than 40 m or longer than half the grid
    freqs = np.fft.rfftfreq(len(row), d=step)
    wl = np.where(freqs > 0, 1.0 / np.maximum(freqs, 1e-6), 1e9)
    band = (wl > 40) & (wl < step * len(row) * 0.45)
    mag = np.where(band, mag, 0)
    if mag.max() <= 0:
        return 140.0
    return float(wl[int(np.argmax(mag))])


def carve_corridor(grid, origin, step, cam, heading, half_w, max_slope_deg):
    """Keep the avenue a sunken lane and its along-track slope walkable."""
    h, w = grid.shape
    xs = origin[0] + (np.arange(w) + 0.5) * step
    zs = origin[1] + (np.arange(h) + 0.5) * step
    xx, zz = np.meshgrid(xs, zs)
    along, lateral = avenue_frame(xx, zz, (cam["x"], cam["z"]), heading)
    lat = np.abs(lateral)
    # banks just outside the lane
    bank = (lat > half_w + 4) & (lat < half_w + 22) & (np.abs(along) < 380)
    lane = lat < half_w
    # The extension already sinks its own lane. A second global dig lowered
    # the key patch too, because the key dunes unproject inside half_w.
    # along-track slope cap inside the lane: limit |dh/ds|
    max_dh = math.tan(math.radians(max_slope_deg)) * step
    # walk the centre samples in `along` order and smooth
    centre = lat <= 2.5
    if centre.sum() > 10:
        idx = np.argwhere(centre)
        order = np.argsort(along[centre])
        idx = idx[order]
        ys = grid[idx[:, 0], idx[:, 1]].astype(np.float64)
        for _ in range(4):
            for i in range(1, len(ys)):
                ys[i] = np.clip(ys[i], ys[i - 1] - max_dh, ys[i - 1] + max_dh)
            for i in range(len(ys) - 2, -1, -1):
                ys[i] = np.clip(ys[i], ys[i + 1] - max_dh, ys[i + 1] + max_dh)
        # blend the capped profile back across the lane
        prof_a = along[idx[:, 0], idx[:, 1]]
        prof_y = ys
        # map every lane texel
        lane_i = np.argwhere(lane)
        if len(lane_i):
            a = along[lane_i[:, 0], lane_i[:, 1]]
            # piecewise via search
            j = np.clip(np.searchsorted(prof_a, a), 1, len(prof_a) - 1)
            y0, y1 = prof_y[j - 1], prof_y[j]
            a0, a1 = prof_a[j - 1], prof_a[j]
            t = np.clip((a - a0) / np.maximum(a1 - a0, 1e-3), 0, 1)
            target = y0 * (1 - t) + y1 * t
            cur = grid[lane_i[:, 0], lane_i[:, 1]].astype(np.float64)
            lat_w = np.clip(lat[lane_i[:, 0], lane_i[:, 1]] / half_w, 0, 1)
            mixed = target * (1 - lat_w) + cur * lat_w
            grid[lane_i[:, 0], lane_i[:, 1]] = mixed.astype(np.float32)
    return grid


def compose(cam, dirs, ground, disp, gain, step, span, heading, half_w, max_slope):
    """Key cloud where the camera sees ground; extension elsewhere. Spawn height ends at 0."""
    margin = span
    origin = (cam["x"] - margin, cam["z"] - margin)
    n = int(round((2 * margin) / step))
    pts = build_cloud(cam, dirs, ground, disp, gain)
    grid, valid = bin_points(pts, origin, step, (n, n))
    if valid.mean() > 0.002:
        grid = np.where(valid, grid, _fill_holes(grid, valid))
        # only trust the filled values near real samples: a wide key footprint
        seen = valid.copy()
        for _ in range(6):
            seen = (
                seen
                | np.roll(seen, 1, 0)
                | np.roll(seen, -1, 0)
                | np.roll(seen, 1, 1)
                | np.roll(seen, -1, 1)
            )
        grid = np.where(seen, grid, 0).astype(np.float32)
        grid = smooth(grid, 1)
        valid = seen
    else:
        valid = np.zeros_like(valid)
    amp = float(np.percentile(np.abs(grid[valid]), 90)) if valid.any() else 8.0
    # q29: side dunes sit in a 15–40 m band. The key faces cannot exceed the
    # eye on a downward ray, so the walkable extension carries the dune scale
    # and the skirt blends it into the key patch.
    amp = float(np.clip(max(amp, 8.0), 8.0, 18.0))
    wl = dominant_wavelength(grid, step) if valid.any() else 90.0
    wl = float(np.clip(wl, 55.0, 120.0))
    xs = origin[0] + (np.arange(n) + 0.5) * step
    zs = origin[1] + (np.arange(n) + 0.5) * step
    xx, zz = np.meshgrid(xs, zs)
    ext = extension_height(xx, zz, amp, wl).astype(np.float32)
    # sink the extension's own avenue so the lane continues
    _, lateral = avenue_frame(xx, zz, (cam["x"], cam["z"]), heading)
    lane_fall = np.clip(1.0 - np.abs(lateral) / (half_w + 18.0), 0, 1) ** 2
    ext = ext * (1.0 - 0.85 * lane_fall) - 1.6 * lane_fall
    # blend: key wins in the sampled footprint, extension outside, 56 m skirt
    if valid.any():
        # distance to valid, in cells
        inv = ~valid
        # approximate distance by a few chamfer passes
        dist = np.where(valid, 0.0, 1e6).astype(np.float32)
        for _ in range(48):
            dist = np.minimum(dist, np.minimum(np.roll(dist, 1, 0), np.roll(dist, -1, 0)) + 1)
            dist = np.minimum(dist, np.minimum(np.roll(dist, 1, 1), np.roll(dist, -1, 1)) + 1)
        dist = np.where(valid, 0.0, dist)
        skirt = 56.0 / step
        w = np.clip(dist / skirt, 0, 1)
        w = w * w * (3 - 2 * w)
        # match extension mean to the key on the skirt so the join does not step
        skirt_m = (dist > 0) & (dist < skirt)
        if skirt_m.any():
            shift = float(np.median(grid[skirt_m] - ext[skirt_m]))
            ext = ext + shift
        grid = grid * (1 - w) + ext * w
    else:
        grid = ext
    grid = grid.astype(np.float32)
    grid = carve_corridor(grid, origin, step, cam, heading, half_w, max_slope)
    # feet at the spawn sit on 0
    feet = float(sample_grid(grid, origin, step, cam["x"], cam["z"]))
    grid = grid - feet
    return {
        "heights": grid.astype(np.float32),
        "origin": origin,
        "step": step,
        "amp": amp,
        "wavelength": wl,
        "valid_frac": float(valid.mean()) if valid is not None else 0.0,
    }


def render_ground(cam, grid, origin, step, width, height, far=380.0, march=4.0):
    """Boolean mask: the ray hits the heightfield before `far`."""
    dirs = ray_directions(cam["yaw"], cam["pitch"], cam["fov"], width, height)
    eye = cam["eye"]
    # march. Vectorised over a coarse step, then refine once.
    n = dirs.shape[0] * dirs.shape[1]
    d = dirs.reshape(n, 3)
    ts = np.arange(march, far, march, dtype=np.float64)
    hit_t = np.full(n, np.nan)
    prev_y = np.full(n, eye)
    prev_t = np.zeros(n)
    alive = np.ones(n, np.bool_)
    for t in ts:
        p = d * t
        x = cam["x"] + p[:, 0]
        z = cam["z"] + p[:, 2]
        y = eye + p[:, 1]
        h = sample_grid(grid, origin, step, x, z)
        crossed = alive & (y <= h) & (prev_y > h if False else prev_y >= h)
        # linear refine
        den = (prev_y - h) - (y - h)
        # previous height was sampled at prev_t; we didn't keep it. Use plane cross with current h.
        hit_t = np.where(crossed & np.isnan(hit_t), t, hit_t)
        prev_y = y
        prev_t = np.full(n, t)
        alive &= np.isnan(hit_t)
        if not alive.any():
            break
    return np.isfinite(hit_t).reshape(dirs.shape[:2]), hit_t.reshape(dirs.shape[:2])


def skyline_fill(mask: np.ndarray) -> np.ndarray:
    """Fill each column from its highest ground pixel to the bottom."""
    h, w = mask.shape
    out = np.zeros_like(mask)
    ys = np.arange(h)[:, None]
    has = mask.any(axis=0)
    # first true from the top
    idx = np.argmax(mask, axis=0)
    for x in range(w):
        if has[x]:
            out[idx[x] :, x] = True
    return out


def mask_iou(a, b, ignore_cols=None) -> float:
    if ignore_cols is not None and ignore_cols.shape[0] == a.shape[1]:
        keep = ~ignore_cols
        a = a[:, keep]
        b = b[:, keep]
    inter = np.logical_and(a, b).sum()
    union = np.logical_or(a, b).sum()
    if union == 0:
        return 0.0
    return float(inter) / float(union)

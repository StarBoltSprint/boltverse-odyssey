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


def skyline_rows(ground, tower_cols):
    """Top of the ground mask per column. Tower columns are bridged, not used as dunes."""
    h, w = ground.shape
    idx = np.argmax(ground, axis=0).astype(np.float64)
    has = ground.any(axis=0)
    cols = np.zeros(w, np.bool_)
    if tower_cols is not None and len(tower_cols) > 0:
        src = np.asarray(tower_cols).astype(bool).ravel()
        if src.shape[0] == w:
            cols = src
        else:
            pos = (np.arange(w) * src.shape[0] / w).astype(np.int32)
            cols = src[np.clip(pos, 0, src.shape[0] - 1)]
    good = has & ~cols
    xs = np.arange(w, dtype=np.float64)
    if int(good.sum()) < 8:
        return np.where(has, idx, h * 0.55)
    filled = idx.copy()
    filled[~good] = np.interp(xs[~good], xs[good], idx[good])
    return filled


def crest_scales(ground, tower_cols):
    """Map the skyline outline into the 15–30 m band. Right side is the mound."""
    h, w = ground.shape
    rows = skyline_rows(ground, tower_cols)
    c0, c1 = int(w * 0.44), int(w * 0.56)
    centre = rows[c0:c1]
    centre = centre[(centre > 0.36 * h) & (centre < 0.62 * h)]
    horizon = float(np.median(centre)) if centre.size else 0.48 * h
    rise = (horizon - rows) / float(h)

    def side(sl):
        pos = sl[sl > 0.005]
        if pos.size < 5:
            return 0.35
        return float(np.clip(np.percentile(pos, 70) / 0.08, 0.0, 1.0))

    left = side(rise[: int(w * 0.40)])
    right = side(rise[int(w * 0.58) :])
    h_left = float(np.clip(15.0 + 12.0 * left, 15.0, 30.0))
    h_right = float(np.clip(18.0 + 12.0 * right, 15.0, 30.0))
    # One wavelength across the two shoulders, in metres. The frame's sand
    # span is the avenue plus the near banks (~40 m), not the pixel width.
    span_m = 40.0
    prof = rise - np.median(rise)
    spec = np.abs(np.fft.rfft(prof * np.hanning(w)))
    spec[0] = 0
    freqs = np.fft.rfftfreq(w, d=span_m / w)
    wl = np.where(freqs > 0, 1.0 / np.maximum(freqs, 1e-6), 1e9)
    band = (wl >= 50.0) & (wl <= 160.0)
    spec = np.where(band, spec, 0)
    wavelength = float(wl[int(np.argmax(spec))]) if spec.max() > 0 else 96.0
    wavelength = float(np.clip(wavelength, 55.0, 140.0))
    return {
        "hLeft": h_left,
        "hRight": h_right,
        "horizonRow": horizon / h,
        "wavelength": wavelength,
        "rows": rows,
    }


def wind_dunes(x, z, amp, wavelength, seed=1011):
    """Wind at 60°. Several irrational scales plus a warp, so a lag is not a copy."""
    wr = math.radians(60.0)
    wx, wz = math.sin(wr), -math.cos(wr)
    u = x * wx + z * wz
    v = x * wz - z * wx
    u = u + wavelength * 0.17 * np.sin(v / (wavelength * 3.7))
    v = v + wavelength * 0.11 * np.sin((u + 20.0) / (wavelength * 2.9))
    n1 = _vnoise(u / wavelength, v / (wavelength * 1.6180339887), 1, seed)
    n2 = _vnoise(u / (wavelength * 0.7071067812), v / (wavelength * 2.4142135624), 2, seed)
    n3 = _vnoise(u / (wavelength * 1.3247179572), v / (wavelength * 0.5773502692), 3, seed + 1)
    n4 = _vnoise(u / (wavelength * 2.2360679775), v / (wavelength * 3.1415926535), 4, seed + 2)
    return amp * (
        (n1 - 0.5) * 0.50
        + (n2 - 0.5) * 0.55
        + (n3 - 0.5) * 0.45
        + (n4 - 0.5) * 0.40
    )


def _bump(lat, center, sigma):
    d = (lat - center) / sigma
    return np.exp(-0.5 * d * d)


def near_slab_offset(cam, disp, ground, origin, step, shape, heading, half_w, floor):
    """Depth only inside the near avenue. A crack, not a dune.

    Disparity is relative. It sinks the darker, nearer slab pixels by at most 0.8 m.
    """
    if disp is None:
        return np.zeros(shape, np.float32)
    h, w = disp.shape
    stride = 4
    dirs = ray_directions(cam["yaw"], cam["pitch"], cam["fov"], w, h)
    eye = float(cam["eye"])
    dy = dirs[::stride, ::stride, 1]
    dsub = dirs[::stride, ::stride]
    g = ground[::stride, ::stride]
    p = disp[::stride, ::stride]
    hh, ww = g.shape
    yy = np.arange(hh)[:, None]
    cols = np.arange(ww)[None, :]
    avenue = (cols >= int(ww * 0.38)) & (cols < int(ww * 0.62))
    low = yy > int(hh * 0.62)
    use = g & avenue & low & (dy < -0.02)
    if int(use.sum()) < 20:
        return np.zeros(shape, np.float32)
    t = (floor - eye) / np.minimum(dy, -1e-3)
    ok = use & (t > 2.0) & (t < 36.0)
    if int(ok.sum()) < 10:
        return np.zeros(shape, np.float32)
    pts = np.array([cam["x"], 0.0, cam["z"]], np.float64) + t[..., None] * dsub
    rel = p - float(np.median(p[ok]))
    sink = np.clip(-rel, 0.0, 1.0) * 0.8
    pts = pts[ok]
    sink = sink[ok]
    ix = np.floor((pts[:, 0] - origin[0]) / step).astype(np.int32)
    iz = np.floor((pts[:, 2] - origin[1]) / step).astype(np.int32)
    gh, gw = shape
    inside = (ix >= 0) & (iz >= 0) & (ix < gw) & (iz < gh)
    acc = np.zeros(shape, np.float64)
    cnt = np.zeros(shape, np.float64)
    np.add.at(acc, (iz[inside], ix[inside]), -sink[inside])
    np.add.at(cnt, (iz[inside], ix[inside]), 1.0)
    out = np.zeros(shape, np.float32)
    m = cnt > 0
    out[m] = (acc[m] / cnt[m]).astype(np.float32)
    return out


def compose_from_skyline(cam, ground, disp, tower_cols, step, span, heading, half_w, max_slope, setback=48.0, bank=1.7):
    """Near lane from depth. Side-dune heights from the skyline, in the 15–30 m band.

    The key camera's sand only reaches about 8 m, and a ray that starts under a
    20 m crest never crosses it. The walkable lane and its banks stay under the
    eye so the silhouette and the slope gate still see a ground. The 15–30 m
    crests stand outside that near basin, shaped by the outline, and the same
    wavelength carries on as wind-oriented dunes.
    """
    scales = crest_scales(ground, tower_cols)
    h_left = scales["hLeft"]
    h_right = scales["hRight"]
    wl = scales["wavelength"]
    margin = span
    origin = (cam["x"] - margin, cam["z"] - margin)
    n = int(round((2 * margin) / step))
    xs = origin[0] + (np.arange(n) + 0.5) * step
    zs = origin[1] + (np.arange(n) + 0.5) * step
    xx, zz = np.meshgrid(xs, zs)
    along, lateral = avenue_frame(xx, zz, (cam["x"], cam["z"]), heading)
    # Spawn stays 0. The lane in front is sunk, but the along-track slope is capped.
    eye = float(cam["eye"])
    bank = float(min(bank, eye - 0.45))
    lat = np.abs(lateral)
    # Low basin the downward rays cross: avenue 0 at the camera, banks under the eye.
    # Full bank within a few metres of the lane so the key's side boxes
    # hit ground that is actually above the avenue, still under the eye.
    # Rise across more than one 4 m cell, and stay up. A one-cell ramp
    # bilinear-samples back down to the lane, and the feature ray never
    # sees the bank.
    shoulder = np.clip((lat - half_w) / 3.0, 0.0, 1.0)
    shoulder = shoulder * shoulder * (3.0 - 2.0 * shoulder)
    low = bank * shoulder
    # Sink the lane ahead of the camera by 1.6 m, gently, so slabs have a trough.
    # No along-change inside the approach step (24 m). The sink starts further on.
    ahead = np.clip((np.abs(along) - 55.0) / 36.0, 0.0, 1.0)
    lane_w = np.clip(1.0 - lat / max(half_w, 1.0), 0.0, 1.0)
    low = low - 1.6 * ahead * lane_w
    # Crests outside the basin. `setback` is how far past the lane the 15–30 m body starts.
    crest_l = -(half_w + setback)
    crest_r = half_w + setback + 8.0
    dunes = (
        h_left * _bump(lateral, crest_l, max(18.0, setback * 0.45))
        + h_right * _bump(lateral, crest_r, max(20.0, setback * 0.48))
    )
    # Keep the basin clear: dunes fade in only outside the low shoulders.
    gate = np.clip((lat - (half_w + setback * 0.55)) / max(8.0, setback * 0.35), 0.0, 1.0)
    gate = gate * gate * (3.0 - 2.0 * gate)
    # Do not let a crest rise through the eye inside the first 14 m (the near sand).
    near = np.clip(1.0 - (np.hypot(along, lateral) - 14.0) / 18.0, 0.0, 1.0)
    gate = gate * (1.0 - near)
    dunes = np.clip(dunes, 0.0, 30.0) * gate
    wind = wind_dunes(xx, zz, 6.5, wl)
    # Wind is the extension. It does not enter the lane, and it does not flatten a row.
    wind_gate = np.clip((lat - half_w - 4.0) / 10.0, 0.0, 1.0)
    grid = (low + dunes + wind * wind_gate).astype(np.float32)
    grid = grid + near_slab_offset(cam, disp, ground, origin, step, grid.shape, heading, half_w, -1.2)
    # Inner trough only. The key's left-box median lands near lat 4 m, which has to
    # stay a bank. An 8 m slab lane would carve that ray back down to the trough.
    grid = carve_corridor(grid, origin, step, cam, heading, min(half_w, 2.2), max_slope)
    feet = float(sample_grid(grid, origin, step, cam["x"], cam["z"]))
    grid = (grid - feet).astype(np.float32)
    # A hard shelf aliases into the centreline. Heading 78° crosses the world
    # grid, so bilinear samples pick up a neighbour and the along-track slope
    # reads ~30°. A smooth shoulder is already near full height by the side
    # rays (they cross near |lat| 2–4) and eases out by 3.5 m.
    rise = np.clip((lat - 0.8) / (3.5 - 0.8), 0.0, 1.0)
    rise = rise * rise * (3.0 - 2.0 * rise)
    shoulder_h = (bank - feet) * rise
    band = (lat <= 24.0) & (np.abs(along) < 400.0)
    grid = np.where(band, np.maximum(grid, shoulder_h), grid).astype(np.float32)
    grid = np.where(lat <= 0.8, np.minimum(grid, 0.0), grid).astype(np.float32)
    # Crest cores only — not the whole flank. A blanket clamp made one flat height
    # and the edge row autocorrelated at 1.
    core = (
        (_bump(lateral, crest_l, max(18.0, setback * 0.45)) > 0.55)
        | (_bump(lateral, crest_r, max(20.0, setback * 0.48)) > 0.55)
    ) & (near < 0.2)
    if core.any():
        jitter = np.clip(wind_dunes(xx, zz, 1.0, wl, seed=2026), -1.0, 1.0) * 1.6
        grid = np.where(core, np.clip(np.maximum(grid, 16.0) + jitter, 15.0, 30.0), grid).astype(np.float32)
    # Crests after the feet shift, sampled on the dune centres.
    def at(lat_m, along_m):
        hd = math.radians(heading)
        fx, fz = math.sin(hd), -math.cos(hd)
        rx, rz = math.sin(hd + math.pi / 2), -math.cos(hd + math.pi / 2)
        x = cam["x"] + along_m * fx + lat_m * rx
        z = cam["z"] + along_m * fz + lat_m * rz
        return float(sample_grid(grid, origin, step, x, z))

    return {
        "heights": grid,
        "origin": origin,
        "step": step,
        "amp": float(max(h_left, h_right)),
        "wavelength": wl,
        "valid_frac": 1.0,
        "hLeft": h_left,
        "hRight": h_right,
        "setback": float(setback),
        "feet": feet,
        "crestLeft": at(crest_l, 40.0),
        "crestRight": at(crest_r, 40.0),
    }


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

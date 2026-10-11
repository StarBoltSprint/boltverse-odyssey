"""Scan-then-code slab. Classic width profile, then a prism with one bite. No dense relief."""
from __future__ import annotations

import numpy as np


def measure_mask(mask, height_m, depth_m):
    h, w = mask.shape
    ys = np.where(mask.any(1))[0]
    if len(ys) < 8:
        raise RuntimeError("mask too small to measure")
    y0, y1 = int(ys[0]), int(ys[-1])
    rows = []
    for y in range(y0, y1 + 1):
        xs = np.where(mask[y] > 0)[0]
        if len(xs) == 0:
            continue
        rows.append((y, int(xs[0]), int(xs[-1]), int(xs[-1] - xs[0] + 1)))
    widths = np.array([r[3] for r in rows], np.float64)
    n = len(widths)
    top = float(np.median(widths[: max(3, n // 7)]))
    bot = float(np.median(widths[-max(3, n // 7) :]))
    pix_h = y1 - y0 + 1
    taper = float(np.degrees(np.arctan2((bot - top) * 0.5, pix_h)))
    # Inward notch: a row much narrower than the wider of its neighbours, lower half.
    bite_frac = 0.0
    bite_side = "none"
    bite_depth_px = 0.0
    lo, hi = n // 2, int(n * 0.9)
    best = 0.0
    best_i = None
    for i in range(lo, hi):
        neigh = max(widths[max(0, i - 12)], widths[min(n - 1, i + 12)])
        gap = neigh - widths[i]
        if gap > best:
            best = gap
            best_i = i
    if best_i is not None and best > 6:
        y, x_l, x_r, width = rows[best_i]
        bite_frac = (y - y0) / max(1, pix_h)
        # Which side lost pixels versus the row above.
        above = rows[max(0, best_i - 12)]
        left_loss = x_l - above[1]
        right_loss = above[2] - x_r
        bite_side = "left" if left_loss > right_loss else "right"
        bite_depth_px = float(best)
    return {
        "y0": y0,
        "y1": y1,
        "pix_h": int(pix_h),
        "top_px": top,
        "bottom_px": bot,
        "taper_deg": round(taper, 2),
        "bite_frac": round(float(bite_frac), 3),
        "bite_side": bite_side,
        "bite_depth_px": round(bite_depth_px, 1),
        "height_m": float(height_m),
        "depth_m": float(depth_m),
        "m_per_px": float(height_m) / max(1, pix_h),
    }


def relief_field(mask, measures, bite_m):
    """Flat facade. One rectangular bite cut into the named side."""
    relief = np.zeros(mask.shape, np.float64)
    if measures["bite_side"] not in ("left", "right") or bite_m <= 0:
        return relief
    y0 = measures["y0"]
    pix_h = measures["pix_h"]
    y_mid = int(y0 + measures["bite_frac"] * pix_h)
    y_a = max(0, y_mid - max(4, pix_h // 18))
    y_b = min(mask.shape[0], y_mid + max(4, pix_h // 18))
    for y in range(y_a, y_b):
        xs = np.where(mask[y] > 0)[0]
        if len(xs) < 4:
            continue
        cut = max(2, int(round(measures["bite_depth_px"])))
        if measures["bite_side"] == "left":
            sel = xs[:cut]
        else:
            sel = xs[-cut:]
        relief[y, sel] = -abs(bite_m)
    return relief

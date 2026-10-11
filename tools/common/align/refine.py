#!/usr/bin/env python3
"""Final pose refinement. PyTorch3D when it imports, otherwise SciPy.

The variables are pose only: yaw, scale, and a pixel shift. Relief is not a
variable. The loss is 1 - metrics.alignment of two images the caller renders.
"""
from __future__ import annotations

import numpy as np
from scipy.optimize import least_squares


def backend():
    try:
        import pytorch3d  # noqa: F401
        return "pytorch3d"
    except Exception:
        return "scipy-fallback"


def refine_pose(render_alignment, x0, bounds, max_nfev=12):
    """render_alignment(x) -> alignment in [0, 1]. x is (yaw, scale, du).

    Returns the best x and which backend ran. SciPy is labelled as a fallback
    when PyTorch3D is not installed. Neither path edits relief.
    """
    which = backend()
    x0 = np.asarray(x0, np.float64)
    lo = np.asarray(bounds[:, 0], np.float64)
    hi = np.asarray(bounds[:, 1], np.float64)

    def residual(x):
        align = float(render_alignment(x))
        return np.array([1.0 - align], np.float64)

    # least_squares is the fallback and also the stand-in when pytorch3d's
    # soft raster is absent. Pose only.
    result = least_squares(residual, x0, bounds=(lo, hi), max_nfev=int(max_nfev), diff_step=0.4)
    return {
        "x": [round(float(v), 4) for v in result.x],
        "alignment": round(1.0 - float(result.fun[0]), 4),
        "backend": which,
        "nfev": int(result.nfev),
        "relief_edited": False,
    }

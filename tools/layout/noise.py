"""Seeded 2D simplex. Placement and relief only. This module draws nothing."""

from __future__ import annotations

import math

_GRAD = (
    (1.0, 1.0),
    (1.0, -1.0),
    (-1.0, 1.0),
    (-1.0, -1.0),
    (1.0, 0.0),
    (-1.0, 0.0),
    (0.0, 1.0),
    (0.0, -1.0),
)
_F2 = 0.5 * (math.sqrt(3.0) - 1.0)
_G2 = (3.0 - math.sqrt(3.0)) / 6.0


def permutation(seed: int) -> list[int]:
    """256-entry table, doubled, shuffled by a fixed LCG from `seed`."""
    p = list(range(256))
    s = (int(seed) & 0xFFFFFFFF) or 1
    for i in range(255, 0, -1):
        s = (1664525 * s + 1013904223) & 0xFFFFFFFF
        j = s % (i + 1)
        p[i], p[j] = p[j], p[i]
    return p + p


def simplex2(x: float, y: float, perm: list[int]) -> float:
    """2D simplex in about [-1, 1]."""
    s = (x + y) * _F2
    i = math.floor(x + s)
    j = math.floor(y + s)
    t = (i + j) * _G2
    x0 = x - (i - t)
    y0 = y - (j - t)
    if x0 > y0:
        i1, j1 = 1, 0
    else:
        i1, j1 = 0, 1
    x1 = x0 - i1 + _G2
    y1 = y0 - j1 + _G2
    x2 = x0 - 1.0 + 2.0 * _G2
    y2 = y0 - 1.0 + 2.0 * _G2
    ii = int(i) & 255
    jj = int(j) & 255

    def contrib(dx: float, dy: float, gi: int) -> float:
        n = 0.5 - dx * dx - dy * dy
        if n < 0.0:
            return 0.0
        n *= n
        g = _GRAD[gi & 7]
        return n * n * (g[0] * dx + g[1] * dy)

    n0 = contrib(x0, y0, perm[ii + perm[jj]])
    n1 = contrib(x1, y1, perm[ii + i1 + perm[jj + j1]])
    n2 = contrib(x2, y2, perm[ii + 1 + perm[jj + 1]])
    return 70.0 * (n0 + n1 + n2)


def fbm(x: float, y: float, perm: list[int], octaves: int, frequency: float) -> float:
    n = 0.0
    amp = 1.0
    norm = 0.0
    f = frequency
    for _ in range(max(1, octaves)):
        n += amp * simplex2(x * f, y * f, perm)
        norm += amp
        amp *= 0.5
        f *= 2.0
    return n / norm if norm else 0.0

"""Blotchiness = mean local variance of the background (upper half)."""
from __future__ import annotations

import numpy as np
import cv2


def background_luma(rgb: np.ndarray) -> np.ndarray:
    L = rgb.astype(np.float32).mean(-1)
    opened = cv2.morphologyEx(L, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    return cv2.GaussianBlur(opened, (0, 0), 4.0)


def blotchiness(rgb: np.ndarray, tile: int = 32) -> float:
    """Mean per-tile variance of background luma over the upper half of the plate."""
    bg = background_luma(rgb)
    H, W = bg.shape
    vals: list[float] = []
    for y in range(0, max(H // 2, tile), tile):
        for x in range(0, W, tile):
            t = bg[y : y + tile, x : x + tile]
            if t.size < (tile * tile) // 2:
                continue
            vals.append(float(t.var()))
    return float(np.mean(vals)) if vals else 0.0


def blotch_rose(before: float, after: float, rel: float = 0.08, abs_eps: float = 0.15) -> bool:
    """True when local BG variance rose meaningfully."""
    return after > before + abs_eps and after > before * (1.0 + rel)

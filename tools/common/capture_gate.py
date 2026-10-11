#!/usr/bin/env python3
"""Blocking check for a headless capture.

Fails a frame that still shows the loading overlay ("Chargement…"), a near-uniform
empty frame, or (when a mask / cover fraction is given) a checklist view whose
target covers too little of the frame. Ortho faces also fail when the picture is black.
Prints one JSON object. Exit 0 even on a failed capture so the caller can record the row;
pass --strict to exit 1.
"""
import json
import sys

import numpy as np
from PIL import Image

LOAD_BG = np.array([0x1D, 0x14, 0x18], np.float32) / 255.0
MIN_COVER = 0.25
ORTHO_MIN_COVER = 0.60


def luma(rgb):
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def load_rgb(path):
    return np.asarray(Image.open(path).convert("RGB")).astype(np.float32) / 255.0


def is_loading(rgb, dom_text=None):
    if dom_text and "chargement" in str(dom_text).lower():
        return True
    y = luma(rgb)
    dist = np.abs(rgb - LOAD_BG).sum(-1)
    bg = float((dist < 0.08).mean())
    bright = float((y > 0.65).mean())
    return bg > 0.82 and 0.0004 < bright < 0.12


def is_empty(rgb):
    y = luma(rgb)
    return float(y.std()) < 0.012 or float(y.mean()) < 0.015


def is_black(rgb):
    y = luma(rgb)
    return float(y.mean()) < 0.03 and float(y.std()) < 0.012


def cover_of(rgb, mask_path=None, cover=None):
    if cover is not None:
        return float(cover)
    if not mask_path:
        y = luma(rgb)
        return float((y > 0.04).mean())
    m = np.asarray(Image.open(mask_path).convert("L").resize((rgb.shape[1], rgb.shape[0]), Image.NEAREST))
    return float((m > 127).mean())


def check_capture(path, kind="frame", mask=None, cover=None, dom_text=None):
    rgb = load_rgb(path)
    reasons = []
    loading = is_loading(rgb, dom_text)
    empty = is_empty(rgb)
    black = is_black(rgb)
    frac = cover_of(rgb, mask, cover)
    if loading:
        reasons.append("loading screen")
    if empty:
        reasons.append("empty frame")
    ortho = str(kind).startswith("ortho")
    need = ORTHO_MIN_COVER if ortho else (MIN_COVER if kind in ("close", "low-portrait", "far", "checklist") else None)
    if need is not None and frac + 1e-6 < need:
        reasons.append(f"target covers {frac:.1%} < {need:.0%}")
    if ortho and black:
        reasons.append("ortho frame is black")
    return {
        "ok": not reasons,
        "kind": kind,
        "cover": round(frac, 4),
        "minCover": need,
        "loading": loading,
        "empty": empty,
        "black": black,
        "why": "; ".join(reasons),
    }


def main():
    raw = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()
    spec = json.loads(raw)
    row = check_capture(spec["img"], spec.get("kind", "frame"), spec.get("mask"), spec.get("cover"), spec.get("dom"))
    print(json.dumps(row))
    if spec.get("strict") and not row["ok"]:
        sys.exit(1)


if __name__ == "__main__":
    main()

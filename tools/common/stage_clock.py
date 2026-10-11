#!/usr/bin/env python3
"""Per-stage timing, with the cheap gates first.

Silhouette and colour run in seconds and must pass before any heavy build.
A heavy stage that starts first raises StageOrderError. The clock records seconds
per stage. Nothing here builds a mesh.
"""
import json
import sys
import time

import numpy as np


class StageOrderError(RuntimeError):
    pass


def silhouette_iou(a, b):
    """Binary masks, any shape. Returns IoU in 0..1."""
    aa = np.asarray(a).astype(bool).ravel()
    bb = np.asarray(b).astype(bool).ravel()
    if aa.shape != bb.shape:
        raise ValueError("silhouette masks differ in shape")
    inter = np.logical_and(aa, bb).sum()
    union = np.logical_or(aa, bb).sum()
    return float(inter / union) if union else 1.0


def colour_delta(a, b):
    """Mean absolute RGB difference, 0..1. Lower is closer."""
    aa = np.asarray(a, np.float32)
    bb = np.asarray(b, np.float32)
    if aa.shape != bb.shape:
        raise ValueError("colour images differ in shape")
    if aa.max() > 1.5:
        aa = aa / 255.0
        bb = bb / 255.0
    return float(np.abs(aa - bb).mean())


class StageClock:
    def __init__(self, silhouette_min=0.87, colour_max=0.12):
        self.silhouette_min = float(silhouette_min)
        self.colour_max = float(colour_max)
        self.rows = []
        self.cheap_ok = False
        self._heavy = 0

    def _row(self, name, kind, seconds, ok, detail):
        self.rows.append({
            "stage": name,
            "kind": kind,
            "seconds": round(float(seconds), 4),
            "ok": bool(ok),
            "detail": detail,
        })

    def cheap(self, mask_ref, mask_got, colour_ref, colour_got):
        """Silhouette then colour. Must pass before heavy()."""
        t0 = time.perf_counter()
        iou = silhouette_iou(mask_ref, mask_got)
        sil_ok = iou + 1e-9 >= self.silhouette_min
        self._row("silhouette", "cheap", time.perf_counter() - t0, sil_ok, f"iou {iou:.4f} min {self.silhouette_min}")
        t1 = time.perf_counter()
        delta = colour_delta(colour_ref, colour_got)
        col_ok = delta <= self.colour_max + 1e-9
        self._row("colour", "cheap", time.perf_counter() - t1, col_ok, f"mean abs {delta:.4f} max {self.colour_max}")
        self.cheap_ok = sil_ok and col_ok
        return self.cheap_ok

    def heavy(self, name, fn):
        if not self.cheap_ok:
            raise StageOrderError(f"cheap gates have not passed; refused heavy stage {name}")
        t0 = time.perf_counter()
        out = fn()
        self._heavy += 1
        self._row(name, "heavy", time.perf_counter() - t0, True, "ran")
        return out

    def report(self):
        return {"cheapOk": self.cheap_ok, "heavyRan": self._heavy, "stages": self.rows}


def main():
    raw = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()
    spec = json.loads(raw)
    clock = StageClock(spec.get("silhouetteMin", 0.87), spec.get("colourMax", 0.12))
    ok = clock.cheap(spec["maskRef"], spec["maskGot"], spec["colourRef"], spec["colourGot"])
    print(json.dumps({"ok": ok, **clock.report()}))


if __name__ == "__main__":
    main()

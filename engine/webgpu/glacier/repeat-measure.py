#!/usr/bin/env python3
"""Autocorrelation at the tile period and its second harmonic.

Lags are the on-screen tile period only, plus a 2 px window so a period that
is off by a pixel still lands. The same lags are measured on the native still.
A peak anywhere else in the image is ignored: that is the photograph.
"""
import json
import subprocess
import sys

import numpy as np


def load_gray(path):
    probe = subprocess.run(
        ['ffprobe', '-v', 'error', '-select_streams', 'v:0',
         '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path],
        capture_output=True, text=True, check=True)
    w, h = map(int, probe.stdout.strip().split(','))
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', path, '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:'],
        capture_output=True, check=True).stdout
    im = np.frombuffer(raw, np.uint8).reshape(h, w).astype(np.float64)
    im -= im.mean()
    return im


def ncc_at(im, dx, dy):
    h, w = im.shape
    if abs(dx) >= w or abs(dy) >= h:
        return 0.0
    a = im[max(dy, 0):h + min(dy, 0), max(dx, 0):w + min(dx, 0)]
    b = im[max(-dy, 0):h + min(-dy, 0), max(-dx, 0):w + min(-dx, 0)]
    if a.size < 32:
        return 0.0
    denom = np.sqrt(np.sum(a * a) * np.sum(b * b))
    if denom < 1e-9:
        return 0.0
    return float(np.sum(a * b) / denom)


def peak_around(im, dx, dy, rad=2):
    best = 0.0
    best_at = (dx, dy)
    for y in range(dy - rad, dy + rad + 1):
        for x in range(dx - rad, dx + rad + 1):
            if x == 0 and y == 0:
                continue
            v = ncc_at(im, x, y)
            if v > best:
                best = v
                best_at = (x, y)
    return best, best_at


def harmonic(im, period, k):
    p = int(round(period * k))
    lags = [(p, 0), (-p, 0), (0, p), (0, -p), (p, p), (p, -p), (-p, p), (-p, -p)]
    best = 0.0
    at = lags[0]
    for dx, dy in lags:
        v, loc = peak_around(im, dx, dy)
        if v > best:
            best = v
            at = loc
    return best, at


def main():
    crop_path, native_path, period = sys.argv[1], sys.argv[2], float(sys.argv[3])
    crop = load_gray(crop_path)
    native = load_gray(native_path)
    c1, a1 = harmonic(crop, period, 1)
    n1, b1 = harmonic(native, period, 1)
    c2, a2 = harmonic(crop, period, 2)
    n2, b2 = harmonic(native, period, 2)
    print(json.dumps({
        'crop1': round(c1, 4),
        'native1': round(n1, 4),
        'crop2': round(c2, 4),
        'native2': round(n2, 4),
        'cropAt1': list(a1),
        'nativeAt1': list(b1),
        'cropAt2': list(a2),
        'nativeAt2': list(b2),
    }))


if __name__ == '__main__':
    main()

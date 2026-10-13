#!/usr/bin/env python3
"""64x64 blue-noise rank texture (void-and-cluster, Ulichney 1993, sigma 1.9, toroidal). Deterministic (seed 7). Output 8-bit grey PNG."""
import numpy as np, sys
from PIL import Image
N, S = 64, 1.9
f = np.fft.fftfreq(N); g = np.exp(-2 * (np.pi * S) ** 2 * (f[:, None] ** 2 + f[None, :] ** 2)); G = g  # gaussian in freq domain
blur = lambda m: np.real(np.fft.ifft2(np.fft.fft2(m) * G))
rng = np.random.default_rng(7); m = np.zeros((N, N), bool); m.flat[rng.choice(N * N, N * N // 10, replace=False)] = True
while True:  # relax initial pattern
    e = blur(m.astype(float)); c = np.argmax(np.where(m, e, -1e9)); m.flat[c] = False
    e = blur(m.astype(float)); v = np.argmin(np.where(m, 1e9, e)); m.flat[v] = True
    if v == c: break
rank = np.zeros(N * N, int); ones = m.sum(); p = m.copy()
for r in range(ones - 1, -1, -1):
    e = blur(p.astype(float)); c = np.argmax(np.where(p, e, -1e9)); p.flat[c] = False; rank[c] = r
p = m.copy()
for r in range(ones, N * N):
    e = blur(p.astype(float)); v = np.argmin(np.where(p, 1e9, e)); p.flat[v] = True; rank[v] = r
Image.fromarray((rank.reshape(N, N) * 256 // (N * N)).astype(np.uint8), 'L').save(sys.argv[1])

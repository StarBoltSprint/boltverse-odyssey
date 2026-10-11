"""Watertight tapered slab from a pixel grid. Pure Python so Blender and Node can share it.

Camera space: X right, Y up, Z away from the camera. The front face sits near Z0.
A positive relief_m moves that sample toward the camera along its ray, so the
front projection stays on the source pixel.
"""
from __future__ import annotations


def build_faces(rows: int, cols: int):
    """Closed prism. Front grid, back grid, then the four walls. Each quad is two tris."""
    if rows < 2 or cols < 2:
        raise ValueError("grid needs at least 2x2")

    def F(r, c):
        return r * cols + c

    def B(r, c):
        return rows * cols + r * cols + c

    faces = []

    def quad(a, b, c, d):
        faces.append((a, b, c))
        faces.append((a, c, d))

    for r in range(rows - 1):
        for c in range(cols - 1):
            quad(F(r, c), F(r + 1, c), F(r + 1, c + 1), F(r, c + 1))
            quad(B(r, c), B(r, c + 1), B(r + 1, c + 1), B(r + 1, c))
        quad(F(r, 0), B(r, 0), B(r + 1, 0), F(r + 1, 0))
        quad(F(r, cols - 1), F(r + 1, cols - 1), B(r + 1, cols - 1), B(r, cols - 1))
    for c in range(cols - 1):
        quad(F(0, c), F(0, c + 1), B(0, c + 1), B(0, c))
        quad(F(rows - 1, c), B(rows - 1, c), B(rows - 1, c + 1), F(rows - 1, c + 1))
    return faces


def build_positions(grid, fx, fy, cx, cy, z0, depth_m):
    """grid[row][col] = {x, y, relief_m}. Returns front+back positions and uvs in 0..1 (v up)."""
    rows = len(grid)
    cols = len(grid[0])
    front = []
    uvs = []
    width = None
    height = None
    for row in grid:
        for p in row:
            z = float(z0) - float(p["relief_m"])
            if z < 1e-3:
                z = 1e-3
            x = (float(p["x"]) - float(cx)) * z / float(fx)
            y = (float(cy) - float(p["y"])) * z / float(fy)
            front.append((x, y, z))
            if width is None:
                width = float(p.get("w", 1))
                height = float(p.get("h", 1))
            u = float(p["x"]) / max(1.0, width - 1.0)
            v = 1.0 - float(p["y"]) / max(1.0, height - 1.0)
            uvs.append((u, v))
    back = []
    for row in grid:
        for p in row:
            z = float(z0) + float(depth_m)
            x = (float(p["x"]) - float(cx)) * z / float(fx)
            y = (float(cy) - float(p["y"])) * z / float(fy)
            back.append((x, y, z))
    return front + back, uvs + uvs


def edge_stats(faces):
    counts = {}
    for a, b, c in faces:
        for e in ((a, b), (b, c), (c, a)):
            key = (a, b) if False else tuple(sorted((int(e[0]), int(e[1]))))
            counts[key] = counts.get(key, 0) + 1
    bad = sum(1 for n in counts.values() if n != 2)
    return {"edges": len(counts), "open_or_nonmanifold": bad, "watertight": bad == 0}


def checksum(positions, places=4):
    acc = 0
    for i, p in enumerate(positions):
        acc = (acc + int(round(p[0] * 10**places)) * (i + 3)
               + int(round(p[1] * 10**places)) * (i + 7)
               + int(round(p[2] * 10**places)) * (i + 11)) % 1000000007
    return acc

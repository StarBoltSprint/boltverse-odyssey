#!/usr/bin/env python3
"""Rebuild the Howl frigate hull from the locked Imagine plates.

Recipe: docs/METHOD/hard-objects.md
Reads tools/hard-objects/images, measures the hull the same way frigate.ts does,
writes out/report.json and out/frigate.obj, and exits 1 if a locked number moves.
No colour is invented. This script is the measurement gate plus the hull OBJ.
It does not build parts, skins or UVs. The skinned mesh is frigate.ts.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillow is required: python3 -m pip install pillow", file=sys.stderr)
    sys.exit(2)

ROOT = Path(__file__).resolve().parent
IMG = ROOT / "images"
OUT = ROOT / "out"
NU = 84
NS = 64
LEN = 224.0
STATIONS = (0.08, 0.34, 0.56, 0.90)


def load(name: str):
    im = Image.open(IMG / name).convert("RGB")
    w, h = im.size
    px = im.load()
    lum = [0.0] * (w * h)
    raw = [0] * (w * h * 3)
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            i = y * w + x
            lum[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b
            raw[i * 3 : i * 3 + 3] = (r, g, b)
    return w, h, lum, raw


def mask_of(lum, thr):
    return [1 if v > thr else 0 for v in lum]


def blobs(m, w, h, min_n):
    seen = bytearray(len(m))
    out = []
    for y in range(h):
        row = y * w
        for x in range(w):
            s0 = row + x
            if not m[s0] or seen[s0]:
                continue
            qx = [x]
            qy = [y]
            seen[s0] = 1
            qs = 0
            n = x0 = y0 = x1 = y1 = 0
            sx = sy = 0
            x0 = x1 = x
            y0 = y1 = y
            while qs < len(qx):
                cx, cy = qx[qs], qy[qs]
                qs += 1
                n += 1
                sx += cx
                sy += cy
                if cx < x0:
                    x0 = cx
                if cx > x1:
                    x1 = cx
                if cy < y0:
                    y0 = cy
                if cy > y1:
                    y1 = cy
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if nx < 0 or ny < 0 or nx >= w or ny >= h:
                        continue
                    s = ny * w + nx
                    if not m[s] or seen[s]:
                        continue
                    seen[s] = 1
                    qx.append(nx)
                    qy.append(ny)
            if n >= min_n:
                out.append(
                    {"n": n, "x0": x0, "y0": y0, "x1": x1, "y1": y1, "cx": sx / n, "cy": sy / n, "sx": x, "sy": y}
                )
    out.sort(key=lambda b: -b["n"])
    return out


def largest_mask(m, w, h):
    allb = blobs(m, w, h, 8)
    keep = bytearray(len(m))
    if not allb:
        return keep, None
    b = allb[0]
    seen = bytearray(len(m))
    qx = [b["sx"]]
    qy = [b["sy"]]
    s0 = b["sy"] * w + b["sx"]
    if not m[s0]:
        return keep, b
    seen[s0] = 1
    keep[s0] = 1
    qs = 0
    while qs < len(qx):
        x, y = qx[qs], qy[qs]
        qs += 1
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= w or ny >= h:
                continue
            s = ny * w + nx
            if not m[s] or seen[s]:
                continue
            seen[s] = 1
            keep[s] = 1
            qx.append(nx)
            qy.append(ny)
    return keep, b


def content_box(m, w, h):
    x0, y0, x1, y1 = w, h, 0, 0
    for y in range(h):
        row = y * w
        for x in range(w):
            if not m[row + x]:
                continue
            if x < x0:
                x0 = x
            if x > x1:
                x1 = x
            if y < y0:
                y0 = y
            if y > y1:
                y1 = y
    if x1 < x0:
        return 0, 0, 1, 1
    return x0, y0, x1, y1


def column(m, w, h, x):
    ix = max(0, min(w - 1, int(round(x))))
    top = bot = -1
    gaps = []
    run = gap = -1
    for y in range(h):
        if m[y * w + ix]:
            if top < 0:
                top = y
            bot = y
            if gap >= 0:
                if y - gap > 36:
                    gaps.append((gap, y - 1))
                gap = -1
            run = y
        elif run >= 0 and gap < 0:
            gap = y
    if top < 0:
        return None
    return top, bot, gaps


def smooth_keep(a):
    t = a[:]
    for i in range(1, len(a) - 1):
        jump = max(abs(t[i] - t[i - 1]), abs(t[i + 1] - t[i]))
        if jump > 1.6:
            continue
        a[i] = t[i] * 0.5 + t[i - 1] * 0.25 + t[i + 1] * 0.25


def fill_enclosed(m, w, h):
    seen = bytearray(len(m))
    qx, qy = [], []

    def push(x, y):
        if x < 0 or y < 0 or x >= w or y >= h:
            return
        s = y * w + x
        if m[s] or seen[s]:
            return
        seen[s] = 1
        qx.append(x)
        qy.append(y)

    for x in range(w):
        push(x, 0)
        push(x, h - 1)
    for y in range(h):
        push(0, y)
        push(w - 1, y)
    qs = 0
    while qs < len(qx):
        x, y = qx[qs], qy[qs]
        qs += 1
        push(x - 1, y)
        push(x + 1, y)
        push(x, y - 1)
        push(x, y + 1)
    for i, (mv, sv) in enumerate(zip(m, seen)):
        if not mv and not sv:
            m[i] = 1


def rays_of(w, h, lum):
    m = mask_of(lum, 18)
    fill_enclosed(m, w, h)
    x0, y0, x1, y1 = content_box(m, w, h)
    cx = (x0 + x1) / 2
    cy = (y0 + y1) / 2
    if not m[int(round(cy)) * w + int(round(cx))]:
        found = False
        for r in range(1, 120):
            if found:
                break
            for k in range(12):
                x = int(round(cx + math.cos(k / 12 * math.tau) * r))
                y = int(round(cy + math.sin(k / 12 * math.tau) * r))
                if 0 <= x < w and 0 <= y < h and m[y * w + x]:
                    cx, cy = x, y
                    found = True
                    break
    half_w = max(8, max(x1 - cx, cx - x0))
    H = max(8, y1 - y0)
    limit = math.hypot(x1 - x0, y1 - y0) + 8
    out = []
    for j in range(NS):
        a = (j / NS) * math.tau
        dx, dy = math.sin(a), math.cos(a)
        lx, ly = cx, cy
        r = 1.0
        while r < limit:
            x = cx + dx * r
            y = cy + dy * r
            ix, iy = int(round(x)), int(round(y))
            if ix < 0 or iy < 0 or ix >= w or iy >= h or not m[iy * w + ix]:
                break
            lx, ly = x, y
            r += 0.8
        out.append(((lx - cx) / half_w, (y1 - ly) / H))
    return out


def shape_at(shapes, u, j):
    ia = 0
    while ia < len(STATIONS) - 2 and u > STATIONS[ia + 1]:
        ia += 1
    span = STATIONS[ia + 1] - STATIONS[ia] or 1
    k = max(0.0, min(1.0, (u - STATIONS[ia]) / span))
    a, b = shapes[ia][j], shapes[ia + 1][j]
    return a[0] * (1 - k) + b[0] * k, a[1] * (1 - k) + b[1] * k


def main():
    need = [
        "port.jpg", "stbd.jpg", "top.jpg", "belly.jpg", "stern.jpg",
        "sec-stern.jpg", "sec-shoulder.jpg", "sec-mid.jpg", "sec-bow.jpg",
        "nacelle.jpg", "nacelle-front.jpg", "turret.jpg", "turret-front.jpg",
        "bridge.jpg", "bridge-front.jpg", "pylon.jpg", "hangar.jpg", "backdrop.jpg",
        "port-detail-aft.jpg", "port-detail-mid.jpg", "port-detail-bow.jpg",
        "measure/top.jpg", "measure/belly.jpg", "measure/stern.jpg",
    ]
    missing = [n for n in need if not (IMG / n).is_file() or not (IMG / (n.replace(".jpg", ".PROMPT.txt"))).is_file()]
    if missing:
        print("missing", missing, file=sys.stderr)
        return 1

    pw, ph, plum, _ = load("port.jpg")
    tw, th, tlum, _ = load("top.jpg")
    mw, mh, mlum, _ = load("measure/top.jpg")
    sw, sh, slum, _ = load("stbd.jpg")
    bw, bh, blum, braw = load("measure/stern.jpg")
    skin_bw, skin_bh, _, skin_braw = load("stern.jpg")
    sections = [load(n) for n in ("sec-stern.jpg", "sec-shoulder.jpg", "sec-mid.jpg", "sec-bow.jpg")]

    port_m, _ = largest_mask(mask_of(plum, 16), pw, ph)
    top_m, _ = largest_mask(mask_of(tlum, 16), tw, th)
    measure_m, _ = largest_mask(mask_of(mlum, 16), mw, mh)
    px0, py0, px1, py1 = content_box(port_m, pw, ph)
    tx0, ty0, tx1, ty1 = content_box(top_m, tw, th)
    mx0, my0, mx1, my1 = content_box(measure_m, mw, mh)
    port_scale = LEN / max(8, px1 - px0)
    top_scale = LEN / max(8, tx1 - tx0)
    measure_scale = LEN / max(8, mx1 - mx0)

    hull_top = [0.0] * NU
    hull_bot = [0.0] * NU
    y_ref = n_ref = 0
    for i in range(NU):
        u = i / (NU - 1)
        col = column(port_m, pw, ph, px0 + u * (px1 - px0))
        if not col:
            continue
        y_ref += (col[0] + col[1]) * 0.5
        n_ref += 1
    y_ref = y_ref / n_ref if n_ref else ph / 2
    for i in range(NU):
        u = i / (NU - 1)
        col = column(port_m, pw, ph, px0 + u * (px1 - px0))
        if not col:
            hull_top[i] = hull_top[i - 1] if i else 0
            hull_bot[i] = hull_bot[i - 1] if i else 0
            continue
        hull_top[i] = (y_ref - col[0]) * port_scale
        hull_bot[i] = (y_ref - col[1]) * port_scale

    hole_u0, hole_u1, hole_s0, hole_s1, hole_n = 0.42, 0.58, 0.35, 0.72, 0
    run_i0, run_s0, run_s1, best = -1, 1.0, 0.0, 0

    def take(i1):
        nonlocal hole_u0, hole_u1, hole_s0, hole_s1, hole_n, best, run_i0
        n = i1 - run_i0
        if run_i0 < 0 or n <= best:
            return
        best = n
        hole_n = n
        hole_u0 = run_i0 / (NU - 1)
        hole_u1 = (i1 - 1) / (NU - 1)
        hole_s0, hole_s1 = run_s0, run_s1

    for i in range(NU + 1):
        u = i / (NU - 1)
        col = column(port_m, pw, ph, px0 + min(1, u) * (px1 - px0)) if i < NU else None
        gap = max(col[2], key=lambda g: g[1] - g[0]) if col and col[2] else None
        if gap and col and gap[1] - gap[0] >= 70:
            span = max(1, col[1] - col[0])
            s_top = (col[1] - gap[0]) / span
            s_bot = (col[1] - gap[1]) / span
            if run_i0 < 0:
                run_i0, run_s0, run_s1 = i, s_bot, s_top
            else:
                run_s0 = min(run_s0, s_bot)
                run_s1 = max(run_s1, s_top)
        else:
            take(i)
            run_i0 = -1

    mids = []
    for i in range(int(NU * 0.72), int(NU * 0.94)):
        u = i / (NU - 1)
        col = column(top_m, tw, th, tx0 + u * (tx1 - tx0))
        if col:
            mids.append((col[0] + col[1]) * 0.5)
    mids.sort()
    center = mids[len(mids) // 2] if mids else (ty0 + ty1) / 2
    beam_port = [4.0] * NU
    beam_stbd = [4.0] * NU
    for i in range(NU):
        u = i / (NU - 1)
        col = column(top_m, tw, th, tx0 + u * (tx1 - tx0))
        if not col:
            if i:
                beam_port[i] = beam_port[i - 1]
                beam_stbd[i] = beam_stbd[i - 1]
            continue
        beam_stbd[i] = max(0.8, (center - col[0]) * top_scale)
        beam_port[i] = max(0.8, (col[1] - center) * top_scale)
    smooth_keep(hull_top)
    smooth_keep(hull_bot)
    smooth_keep(beam_port)
    smooth_keep(beam_stbd)

    shapes = [rays_of(w, h, lum) for w, h, lum, _raw in sections]
    verts = []
    faces = []
    for i in range(NU):
        u = i / (NU - 1)
        deck, keel = hull_top[i], hull_bot[i]
        for j in range(NS):
            sx, sy = shape_at(shapes, u, j)
            beam = beam_port[i] if sx < 0 else beam_stbd[i]
            verts.append(((u - 0.5) * LEN, keel + sy * (deck - keel), -sx * beam))
    for i in range(NU - 1):
        for j in range(NS):
            j2 = (j + 1) % NS
            a = i * NS + j
            b = (i + 1) * NS + j
            c = (i + 1) * NS + j2
            d = i * NS + j2
            za = (verts[a][2] + verts[b][2] + verts[c][2] + verts[d][2]) / 4
            sya = (
                shapes and shape_at(shapes, i / (NU - 1), j)[1]
            )
            uu = (i + 0.5) / (NU - 1)
            # hole cut: port side only, same window as frigate.ts
            if za > 0 and hole_u0 <= uu <= hole_u1:
                sys_ = sum(shape_at(shapes, (i + t) / (NU - 1), jj)[1] for t in (0, 1) for jj in (j, j2)) / 4
                if hole_s0 <= sys_ <= hole_s1:
                    continue
            faces.append((a + 1, b + 1, c + 1, d + 1))

    blue = []
    bm = [0] * (bw * bh)
    for i in range(bw * bh):
        r, g, b = braw[i * 3 : i * 3 + 3]
        if b > 80 and b > r + 18 and b > g:
            bm[i] = 1
    bells = blobs(bm, bw, bh, 80)[:4]

    top_parts = blobs(mask_of(mlum, 16), mw, mh, 800)[1:]
    nacelles = []
    mmids = []
    for i in range(int(NU * 0.72), int(NU * 0.94)):
        u = i / (NU - 1)
        col = column(measure_m, mw, mh, mx0 + u * (mx1 - mx0))
        if col:
            mmids.append((col[0] + col[1]) * 0.5)
    mmids.sort()
    measure_center = mmids[len(mmids) // 2] if mmids else (my0 + my1) / 2
    for b in top_parts:
        u = (b["cx"] - mx0) / max(1, mx1 - mx0)
        nacelles.append(
            {
                "u": round(u, 4),
                "x": round((u - 0.5) * LEN, 2),
                "z": round((b["cy"] - measure_center) * measure_scale, 2),
                "length": round(max(6, (b["x1"] - b["x0"]) * measure_scale), 2),
            }
        )

    skin_bm = [0] * (skin_bw * skin_bh)
    for i in range(skin_bw * skin_bh):
        r, g, b = skin_braw[i * 3 : i * 3 + 3]
        if b > 80 and b > r + 18 and b > g:
            skin_bm[i] = 1
    skin_bells = blobs(skin_bm, skin_bw, skin_bh, 80)
    skin_nacelles = blobs(mask_of(tlum, 16), tw, th, 800)[1:]

    report = {
        "images": len(need),
        "portBox": [px0, py0, px1, py1],
        "topBox": [mx0, my0, mx1, my1],
        "skinTopBox": [tx0, ty0, tx1, ty1],
        "topScale": round(measure_scale, 4),
        "texelsPerUnit": round((px1 - px0) / LEN, 2),
        "hole": [round(hole_u0, 3), round(hole_u1, 3), round(hole_s0, 3), round(hole_s1, 3), hole_n],
        "bells": len(bells),
        "skinBells": len(skin_bells),
        "skinNacelles": len(skin_nacelles),
        "nacelles": nacelles,
        "verts": len(verts),
        "faces": len(faces),
        "length": LEN,
    }
    OUT.mkdir(exist_ok=True)
    (OUT / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    lines = ["# Howl hull loft, measured from images/. Units are world units, length 224."]
    for x, y, z in verts:
        lines.append(f"v {x:.4f} {y:.4f} {z:.4f}")
    for a, b, c, d in faces:
        lines.append(f"f {a} {b} {c} {d}")
    (OUT / "frigate.obj").write_text("\n".join(lines) + "\n")

    problems = []
    if not (70 <= px0 <= 90 and px1 > 2200 and py1 - py0 > 200):
        problems.append(f"port box {report['portBox']}")
    if not (70 <= mx0 <= 90 and my0 > 100 and mx1 > 2200):
        problems.append(f"top box {report['topBox']} (nacelle seed would put y0 near 49)")
    if not (0.09 < measure_scale < 0.11):
        problems.append(f"topScale {measure_scale}")
    if hole_n < 10 or not (0.25 < hole_u0 < 0.36 and 0.44 < hole_u1 < 0.55):
        problems.append(f"hole {report['hole']}")
    if len(bells) != 4:
        problems.append(f"bells {len(bells)}")
    if len(skin_bells) != 0:
        problems.append(f"skin still paints bells {len(skin_bells)}")
    if len(skin_nacelles) != 0:
        problems.append(f"skin still paints nacelles {len(skin_nacelles)}")
    if len(nacelles) != 2:
        problems.append(f"nacelles {len(nacelles)}")
    else:
        for n in nacelles:
            if n["length"] > 40 or abs(n["x"]) < 70:
                problems.append(f"nacelle not at the stern {n}")
    if len(faces) < 4000:
        problems.append(f"faces {len(faces)}")
    print(json.dumps(report, indent=2))
    if problems:
        print("FAIL", problems, file=sys.stderr)
        return 1
    print("PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())

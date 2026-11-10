#!/usr/bin/env python3
"""Stance soles from the rear gallop atlas, measured against the card ground line.

The live card maps texture row y to a world height. A column is planted only
when its lowest opaque pixel is within 1 cm of the root (the ground). Runs
narrower than 8 px are toes. An id follows a sole while its centre stays within
0.12 uv and the sole was also down on the previous frame. A flight frame breaks
the id, so the next touchdown is a new plant.
"""
import json
import pathlib
import struct
import zlib

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[2]
ATLAS = ROOT / "assets" / "meadow" / "bolt439_atlas.png"
OUT = pathlib.Path(__file__).resolve().parent / "contacts.json"

COLS = 8
CW, CH = 224, 652
CARD_H = 1.15
CARD_FOOT_PX = 6
SINK = 0.095
# ly = (CH - CARD_FOOT_PX - y) / CH * CARD_H - SINK  <= 1 cm above the root
GROUND_Y = 586  # inclusive; see module restHeight()
MIN_W = 8
MATCH_U = 0.12


def decode_png(path):
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit("not a png")
    i = 8
    w = h = None
    idat = b""
    while i < len(data):
        n = struct.unpack(">I", data[i : i + 4])[0]
        typ = data[i + 4 : i + 8]
        chunk = data[i + 8 : i + 8 + n]
        if typ == b"IHDR":
            w, h = struct.unpack(">II", chunk[:8])
        elif typ == b"IDAT":
            idat += chunk
        elif typ == b"IEND":
            break
        i += 12 + n
    raw = zlib.decompress(idat)
    stride = w * 4
    prev = bytearray(stride)
    pos = 0
    out = bytearray(h * stride)
    for y in range(h):
        filt = raw[pos]
        pos += 1
        row = bytearray(raw[pos : pos + stride])
        pos += stride
        if filt == 1:
            for x in range(stride):
                left = row[x - 4] if x >= 4 else 0
                row[x] = (row[x] + left) & 255
        elif filt == 2:
            for x in range(stride):
                row[x] = (row[x] + prev[x]) & 255
        elif filt == 3:
            for x in range(stride):
                left = row[x - 4] if x >= 4 else 0
                row[x] = (row[x] + ((left + prev[x]) // 2)) & 255
        elif filt == 4:
            for x in range(stride):
                a = row[x - 4] if x >= 4 else 0
                b = prev[x]
                c = prev[x - 4] if x >= 4 else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if pa <= pb and pa <= pc else (b if pb <= pc else c)
                row[x] = (row[x] + pr) & 255
        elif filt != 0:
            raise SystemExit(f"filter {filt}")
        out[y * stride : (y + 1) * stride] = row
        prev = row
    return np.frombuffer(out, dtype=np.uint8).reshape(h, w, 4)


def rest_height(y):
    return (CH - CARD_FOOT_PX - y) / CH * CARD_H - SINK


def blobs(cell):
    a = cell[..., 3] > 140
    ys, xs = np.nonzero(a)
    if len(ys) == 0:
        return []
    cont = np.full(CW, -1, dtype=np.int16)
    for x in range(CW):
        col = np.nonzero(a[:, x])[0]
        if len(col):
            cont[x] = col.max()
    touch = np.nonzero(cont >= GROUND_Y)[0]
    runs = []
    if len(touch):
        s = prev = int(touch[0])
        for x in touch[1:]:
            x = int(x)
            if x <= prev + 2:
                prev = x
            else:
                runs.append((s, prev))
                s = prev = x
        runs.append((s, prev))
    runs = [r for r in runs if r[1] - r[0] + 1 >= MIN_W]
    out = []
    for s, e in runs:
        cols = np.arange(s, e + 1)
        sole_y = int(np.max(cont[cols]))
        u = ((s + e) * 0.5 + 0.5) / CW
        v = (sole_y + 0.5) / CH
        side = "L" if u < 0.46 else ("R" if u > 0.54 else "C")
        out.append({
            "u": round(float(u), 4),
            "v": round(float(v), 4),
            "side": side,
            "w": int(e - s + 1),
            "y": sole_y,
        })
    out.sort(key=lambda b: b["u"])
    return out


def main():
    img = decode_png(ATLAS)
    raw = []
    for fi in range(32):
        col, row = fi % COLS, fi // COLS
        cell = img[row * CH : (row + 1) * CH, col * CW : (col + 1) * CW]
        raw.append(blobs(cell))
    active = []
    nxt = 0
    per = []
    for fi in range(32):
        used = set()
        row = []
        for b in raw[fi]:
            best, bestd = None, 1e9
            for a in active:
                if a["id"] in used or fi - a["last"] != 1:
                    continue
                d = abs(b["u"] - a["u"])
                if d <= MATCH_U and d < bestd:
                    best, bestd = a, d
            if best is None:
                pid = f"p{nxt}"
                nxt += 1
                rec = {"id": pid, "u": b["u"], "v": b["v"], "last": fi}
                active.append(rec)
                used.add(pid)
            else:
                pid = best["id"]
                used.add(pid)
                best["u"] = b["u"]
                best["v"] = b["v"]
                best["last"] = fi
            row.append({"id": pid, "u": b["u"], "v": b["v"], "side": b["side"]})
        active = [a for a in active if fi - a["last"] <= 0 or fi - a["last"] == 1]
        active = [a for a in active if a["last"] == fi]
        row.sort(key=lambda r: r["u"])
        per.append(row)
    # Wrap the cycle: a sole down on both frame 31 and frame 0 keeps one id.
    alias = {}
    for b0 in per[0]:
        for b31 in per[31]:
            if abs(b0["u"] - b31["u"]) <= MATCH_U:
                alias[b0["id"]] = b31["id"]
    if alias:
        for row in per:
            seen = set()
            clean = []
            for b in row:
                b["id"] = alias.get(b["id"], b["id"])
                if b["id"] in seen:
                    continue
                seen.add(b["id"])
                clean.append(b)
            row[:] = clean
    spans = {}
    for fi, row in enumerate(per):
        for b in row:
            spans.setdefault(b["id"], []).append(fi)
    print(f"ground row >= {GROUND_Y}  (rest height <= {rest_height(GROUND_Y)*100:.1f} cm)")
    for fi, row in enumerate(per):
        desc = " ".join(f"{b['id']}@{b['u']:.2f} v{b['v']:.3f}" for b in row) or "-"
        print(f"{fi:02d} {desc}")
    print("spans")
    for pid, fs in spans.items():
        print(pid, fs, "n", len(fs))
    best = None
    for fi, row in enumerate(per):
        if len(row) < 2:
            continue
        vs = [b["v"] for b in row]
        # Prefer two soles, nearly the same texture row, and a wide pair.
        score = (len(row), -abs(max(vs) - min(vs)), fi)
        if best is None or score > best[0]:
            best = (score, fi)
    idle = best[1] if best else 0
    print("idleFrame", idle, "rest cm", round(rest_height(GROUND_Y) * 100, 2))
    doc = {
        "atlas": "assets/meadow/bolt439_atlas.png",
        "frames": 32,
        "cols": 8,
        "rows": 4,
        "cell": [CW, CH],
        "groundRow": GROUND_Y,
        "minRunPx": MIN_W,
        "matchU": MATCH_U,
        "idleFrame": idle,
        "framesContacts": per,
    }
    OUT.write_text(json.dumps(doc, indent=2) + "\n")
    print("wrote", OUT)


if __name__ == "__main__":
    main()

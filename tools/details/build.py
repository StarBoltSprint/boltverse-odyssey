#!/usr/bin/env python3
"""Build one biome's micro-detail atlas and manifest.

    python3 tools/details/build.py --kit howling-eclipse

Keys a flat chroma background from the border, packs the subjects into one
atlas, and writes world positions. No palette and no prompt text.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from place import load_solids, mag_height_cap, place, place_features, thin_micro  # noqa: E402

INBOX = Path("/workspace/grokcli/out/zoneA-details/inbox")


def key_mask(rgb: np.ndarray) -> np.ndarray:
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    screen = (g > 55) & (g > r + 16) & (g > b + 16)
    h, w = screen.shape
    bg = np.zeros((h, w), np.uint8)
    q: deque[tuple[int, int]] = deque()

    def push(x: int, y: int) -> None:
        if x < 0 or y < 0 or x >= w or y >= h:
            return
        if bg[y, x] or not screen[y, x]:
            return
        bg[y, x] = 1
        q.append((x, y))

    for x in range(w):
        push(x, 0)
        push(x, h - 1)
    for y in range(h):
        push(0, y)
        push(w - 1, y)
    while q:
        x, y = q.popleft()
        push(x - 1, y)
        push(x + 1, y)
        push(x, y - 1)
        push(x, y + 1)
    return bg == 0


def bleed(arr: np.ndarray, radius: int = 3) -> np.ndarray:
    import cv2

    out = arr.copy()
    rgb = out[:, :, :3].copy()
    mask = (out[:, :, 3] > 16).astype(np.uint8)
    rgb[mask == 0] = 0
    kernel = np.ones((3, 3), np.uint8)
    for _ in range(radius):
        grown = cv2.dilate(mask, kernel)
        take = (grown == 1) & (mask == 0)
        for c in range(3):
            spread = cv2.dilate(rgb[:, :, c], kernel)
            ch = rgb[:, :, c]
            ch[take] = spread[take]
            rgb[:, :, c] = ch
        mask = grown
    out[:, :, :3] = rgb
    return out


def split_sheet(path: Path, min_area: int) -> list[np.ndarray]:
    import cv2

    rgb = np.array(Image.open(path).convert("RGB"))
    fg = key_mask(rgb).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(fg, 8)
    h, w = fg.shape
    found = []
    for i in range(1, n):
        x, y, ww, hh, area = (int(v) for v in stats[i])
        if min(ww, hh) < 14:
            continue
        if area < min_area or float((labels[y : y + hh, x : x + ww] == i).mean()) < 0.12:
            continue
        if area > 0.28 * w * h:
            raise SystemExit(f"FAIL {path.name}: subjects merged or the floor stayed")
        if x <= 1 or y <= 1 or x + ww >= w - 1 or y + hh >= h - 1:
            continue
        sub_m = labels[y : y + hh, x : x + ww] == i
        # Drop a joined mirror that sits under a real subject.
        rows = sub_m.mean(axis=1)
        cut = None
        run = 0
        for ry in range(int(hh * 0.35), int(hh * 0.7)):
            if rows[ry] < 0.04:
                run += 1
                if run >= 6:
                    cut = ry - run + 1
                    break
            else:
                run = 0
        if cut is not None and cut > 8:
            sub_m = sub_m[:cut]
            hh = cut
        ys, xs = np.where(sub_m)
        if len(xs) < min_area:
            continue
        y0, y1 = int(ys.min()), int(ys.max())
        x0, x1 = int(xs.min()), int(xs.max())
        ch, cw = y1 - y0 + 1, x1 - x0 + 1
        crop = np.zeros((ch, cw, 4), np.uint8)
        crop[:, :, :3] = rgb[y + y0 : y + y1 + 1, x + x0 : x + x1 + 1]
        crop[:, :, 3] = sub_m[y0 : y1 + 1, x0 : x1 + 1].astype(np.uint8) * 255
        found.append((int(crop[:, :, 3].sum()), crop))
    found.sort(key=lambda item: -item[0])
    return [crop for _, crop in found]


def next_pot(n: int) -> int:
    p = 1
    while p < n:
        p *= 2
    return p


def shelf_size(sizes: list[tuple[int, int]], width: int, pad: int) -> tuple[int, int]:
    x = pad
    y = pad
    row_h = 0
    used_w = 0
    for w, h in sizes:
        if x + w + pad > width:
            y += row_h + pad
            x = pad
            row_h = 0
        x += w + pad
        row_h = max(row_h, h)
        used_w = max(used_w, x)
    return used_w, y + row_h + pad


def fit_scale(sizes: list[tuple[int, int]], max_side: int, max_pixels: int, pad: int) -> float:
    best = 0.2
    lo, hi = 0.2, 1.0
    for _ in range(14):
        mid = (lo + hi) * 0.5
        scaled = [(max(1, int(w * mid)), max(1, int(h * mid))) for w, h in sizes]
        side = min(max_side, next_pot(max(s[0] for s in scaled) + pad * 2))
        # Prefer a wide shelf when the cap is 2048x1024.
        width = max_side if max_pixels >= max_side * (max_side // 2) else side
        width = min(max_side, max(width, side))
        _uw, uh = shelf_size(scaled, width, pad)
        pixels = width * next_pot(uh)
        if uh <= max_side and pixels <= max_pixels:
            best = mid
            lo = mid
        else:
            hi = mid
    return best


def frame_crop(crop: np.ndarray, pad: int, pad_bottom: int) -> tuple[np.ndarray, int, int]:
    a = crop[:, :, 3]
    ys, xs = np.where(a > 16)
    y0, y1 = int(ys.min()), int(ys.max())
    x0, x1 = int(xs.min()), int(xs.max())
    sub = crop[y0 : y1 + 1, x0 : x1 + 1]
    ch, cw = sub.shape[:2]
    canvas = np.zeros((ch + pad + pad_bottom, cw + pad * 2, 4), np.uint8)
    canvas[pad : pad + ch, pad : pad + cw] = sub
    canvas = bleed(canvas, 3)
    return canvas, cw, ch


def pack(typed: list[tuple[str, np.ndarray]], numbers: dict) -> tuple[np.ndarray, list[dict]]:
    pad = int(numbers["pad"])
    pad_bottom = int(numbers["padBottom"])
    framed = []
    for name, crop in typed:
        canvas, cw, ch = frame_crop(crop, pad, pad_bottom)
        framed.append((name, canvas, cw, ch))
    sizes = [(im.shape[1], im.shape[0]) for _, im, _, _ in framed]
    max_side = int(numbers["atlasMaxSide"])
    # RGBA8 plus the mip chain stays inside the phone cap.
    max_pixels = int(numbers["atlasMaxTexMB"] * (1024 * 1024) / (4 * 4 / 3))
    scale = fit_scale(sizes, max_side, max_pixels, pad)
    if scale < 0.999:
        resized = []
        for name, canvas, cw, ch in framed:
            nw = max(1, int(round(canvas.shape[1] * scale)))
            nh = max(1, int(round(canvas.shape[0] * scale)))
            im = Image.fromarray(canvas).resize((nw, nh), Image.Resampling.LANCZOS)
            resized.append((name, np.array(im), max(1, int(round(cw * scale))), max(1, int(round(ch * scale)))))
        framed = resized
    width = max_side
    x = pad
    y = pad
    row_h = 0
    placed = []
    for name, canvas, cw, ch in framed:
        ih, iw = canvas.shape[:2]
        if x + iw + pad > width:
            y += row_h + pad
            x = pad
            row_h = 0
        placed.append((name, canvas, cw, ch, x, y))
        x += iw + pad
        row_h = max(row_h, ih)
    used_h = y + row_h + pad
    atlas_h = next_pot(used_h)
    atlas_w = width if width * atlas_h <= max_pixels else next_pot(max(p[1].shape[1] for p in placed) + pad * 2)
    if atlas_h > max_side or atlas_w * atlas_h > max_pixels:
        raise SystemExit(f"FAIL atlas {atlas_w}x{atlas_h} over the texture cap")
    atlas = np.zeros((atlas_h, atlas_w, 4), np.uint8)
    variants = []
    texels = float(numbers["texelsPerM"])
    for name, canvas, cw, ch, px, py in placed:
        ih, iw = canvas.shape[:2]
        atlas[py : py + ih, px : px + iw] = canvas
        variants.append({
            "type": name,
            "contentW": int(cw),
            "contentH": int(ch),
            "rectW": int(iw),
            "rectH": int(ih),
            "padBottom": int(round(pad_bottom * (1 if scale >= 0.999 else scale))),
            "u0": px / atlas_w,
            "v0": 1.0 - (py + ih) / atlas_h,
            "u1": (px + iw) / atlas_w,
            "v1": 1.0 - py / atlas_h,
            "maxHeightM": round(ch / texels, 4),
        })
    return atlas, variants


def group_variants(flat: list[dict]) -> dict:
    out: dict[str, list] = {}
    for row in flat:
        out.setdefault(row["type"], []).append(row)
    return out


def tex_mib(w: int, h: int) -> float:
    return (w * h * 4 * 4 / 3) / (1024 * 1024)


def key_one(path: Path, min_area: int) -> np.ndarray:
    """One subject filling the frame. The sheet size gate does not apply."""
    import cv2

    rgb = np.array(Image.open(path).convert("RGB"))
    fg = key_mask(rgb)
    if float(fg.mean()) < 0.12:
        raise SystemExit(f"FAIL {path.name}: field ate the subject")
    n, labels, stats, _ = cv2.connectedComponentsWithStats(fg.astype(np.uint8), 8)
    if n < 2:
        raise SystemExit(f"FAIL {path.name}: nothing keyed")
    order = sorted(range(1, n), key=lambda i: int(stats[i, cv2.CC_STAT_AREA]), reverse=True)
    i = order[0]
    if int(stats[i, cv2.CC_STAT_AREA]) < min_area:
        raise SystemExit(f"FAIL {path.name}: subject under {min_area}px")
    mask = labels == i
    # The key fringe is a mixed edge. Drop two pixels of it. Not a tint.
    mask = cv2.erode(mask.astype(np.uint8), np.ones((3, 3), np.uint8), iterations=2).astype(bool)
    # Edge dust specks must not stretch the crop to the frame.
    mask[:2, :] = False
    mask[-2:, :] = False
    mask[:, :2] = False
    mask[:, -2:] = False
    ys, xs = np.where(mask)
    if len(xs) < min_area:
        raise SystemExit(f"FAIL {path.name}: subject touches the frame")
    y0, y1 = int(ys.min()), int(ys.max())
    x0, x1 = int(xs.min()), int(xs.max())
    sub = mask[y0 : y1 + 1, x0 : x1 + 1]
    crop = np.zeros((sub.shape[0], sub.shape[1], 4), np.uint8)
    crop[:, :, :3] = rgb[y0 : y1 + 1, x0 : x1 + 1]
    crop[:, :, 3] = sub.astype(np.uint8) * 255
    return crop


def skirt_rows(canvas: np.ndarray) -> int:
    """Rows of painted dust collar at the foot of a one-subject still.
    Measured from the still's own pixels; used only to sink the card (placement)."""
    alpha = canvas[:, :, 3] > 127
    rows = np.where(alpha.any(axis=1))[0]
    if len(rows) < 20:
        return 0
    top, bottom = int(rows.min()), int(rows.max())
    luma = canvas[:, :, :3].astype(np.float32) @ np.array([0.3, 0.59, 0.11], np.float32)
    span = bottom - top + 1
    upper = alpha[top : top + int(span * 0.6)]
    body = float(np.median(luma[top : top + int(span * 0.6)][upper]))
    foot_rows = max(3, int(span * 0.03))
    foot = alpha[bottom - foot_rows + 1 : bottom + 1]
    skirt = float(np.mean(luma[bottom - foot_rows + 1 : bottom + 1][foot]))
    if skirt - body < 25.0:
        return 0
    thr = 0.5 * (skirt + body)
    n = 0
    for r in range(bottom, top + int(span * 0.4), -1):
        m = alpha[r]
        if not m.any() or float(np.mean(luma[r][m])) < thr:
            break
        n += 1
    return n


def body_span(canvas: np.ndarray, skirt: int) -> tuple[int, float]:
    """Visible rock width near the ground, from the still's own alpha: the union
    of opaque columns over the lower half of the body (above the dust collar).
    Returns (width px, centre offset px from the card centre). Collider only."""
    alpha = canvas[:, :, 3] > 127
    rows = np.where(alpha.any(axis=1))[0]
    if len(rows) < 4:
        return 0, 0.0
    top, bottom = int(rows.min()), int(rows.max())
    body_bottom = bottom - skirt
    body_top = top
    lo = body_top + (body_bottom - body_top) // 2
    band = alpha[lo : body_bottom + 1]
    cols = np.where(band.any(axis=0))[0]
    if len(cols) < 2:
        return 0, 0.0
    x0, x1 = int(cols.min()), int(cols.max())
    return x1 - x0 + 1, (x0 + x1 + 1) * 0.5 - canvas.shape[1] * 0.5


def pack_features(typed: list[tuple[str, np.ndarray]], numbers: dict) -> tuple[np.ndarray, list[dict]]:
    feat = numbers["features"]
    pad = int(numbers["pad"])
    pad_bottom = int(numbers["padBottom"])
    framed = []
    for name, crop in typed:
        canvas, cw, ch = frame_crop(crop, pad, pad_bottom)
        framed.append((name, canvas, cw, ch))
    framed.sort(key=lambda item: -item[1].shape[1])
    sizes = [(im.shape[1], im.shape[0]) for _, im, _, _ in framed]
    max_side = int(feat["atlasMaxSide"])
    max_pixels = int(float(feat["atlasMaxTexMB"]) * (1024 * 1024) / (4 * 4 / 3))

    def fits(mid: float) -> bool:
        scaled = [(max(1, int(round(w * mid))), max(1, int(round(h * mid)))) for w, h in sizes]
        _uw, uh = shelf_size(scaled, max_side, pad)
        return uh <= max_side and _uw * uh <= max_pixels

    scale = 1.0
    if not fits(1.0):
        lo, hi, best = 0.35, 1.0, 0.35
        for _ in range(16):
            mid = (lo + hi) * 0.5
            if fits(mid):
                best = mid
                lo = mid
            else:
                hi = mid
        scale = best
    if scale < 0.999:
        resized = []
        for name, canvas, cw, ch in framed:
            nw = max(1, int(round(canvas.shape[1] * scale)))
            nh = max(1, int(round(canvas.shape[0] * scale)))
            im = Image.fromarray(canvas).resize((nw, nh), Image.Resampling.LANCZOS)
            resized.append((name, np.array(im), max(1, int(round(cw * scale))), max(1, int(round(ch * scale)))))
        framed = resized
        scale_used = scale
    else:
        scale_used = 1.0
    width = max_side
    x = pad
    y = pad
    row_h = 0
    placed = []
    for name, canvas, cw, ch in framed:
        ih, iw = canvas.shape[:2]
        if x + iw + pad > width:
            y += row_h + pad
            x = pad
            row_h = 0
        if y + ih + pad > max_side:
            raise SystemExit(f"FAIL feature atlas overflow on {name}")
        placed.append((name, canvas, cw, ch, x, y))
        x += iw + pad
        row_h = max(row_h, ih)
    used_h = y + row_h + pad
    used_w = pad
    for _, canvas, _, _, px, _ in placed:
        used_w = max(used_w, px + canvas.shape[1] + pad)
    # WebGL2 mips accept a non-power-of-two atlas. A power-of-two jump would waste the phone cap.
    atlas_w = max(4, used_w)
    atlas_h = max(4, used_h)
    if atlas_w > max_side or atlas_h > max_side or atlas_w * atlas_h > max_pixels:
        raise SystemExit(f"FAIL feature atlas {atlas_w}x{atlas_h} over the texture cap")
    atlas = np.zeros((atlas_h, atlas_w, 4), np.uint8)
    slide = float(feat.get("slideM", 1.0))
    eye = float(feat.get("eyeM", 1.30))
    focal = float(feat.get("focalPx", numbers["focalPx"]))
    variants = []
    for name, canvas, cw, ch, px, py in placed:
        ih, iw = canvas.shape[:2]
        atlas[py : py + ih, px : px + iw] = canvas
        spec = numbers["features"]["types"][name]
        horiz = max(0.35, float(spec["minAcross"]) - slide)
        cap = mag_height_cap(ch, horiz, eye, focal)
        asked = float(spec["heightM"][1])
        variants.append({
            "type": name,
            "contentW": int(cw),
            "contentH": int(ch),
            "rectW": int(iw),
            "rectH": int(ih),
            "padBottom": int(round(pad_bottom * scale_used)),
            "u0": px / atlas_w,
            "v0": 1.0 - (py + ih) / atlas_h,
            "u1": (px + iw) / atlas_w,
            "v1": 1.0 - py / atlas_h,
            "maxHeightM": round(min(asked, cap), 4),
            "skirtPx": skirt_rows(canvas),
        })
        bw, bc = body_span(canvas, variants[-1]["skirtPx"])
        variants[-1]["bodyWPx"] = int(bw)
        variants[-1]["bodyCxPx"] = round(float(bc), 1)
    return atlas, variants


def build_features(numbers: dict, inbox: Path, solids: list) -> dict | None:
    feat = numbers.get("features")
    if not feat:
        return None
    folder = inbox / str(feat.get("inbox") or "v2")
    typed = []
    for name, spec in feat["types"].items():
        files = spec.get("files") or [spec["file"]]
        kept = 0
        for fn in files:
            sheet = folder / fn
            if not sheet.is_file():
                raise SystemExit(f"FAIL details: missing feature {sheet}")
            crop = key_one(sheet, int(spec.get("minArea") or feat.get("minComponentArea") or 8000))
            typed.append((name, crop))
            kept += 1
        if kept < 1:
            raise SystemExit(f"FAIL details: {name} has no feature still")
    atlas, variants = pack_features(typed, numbers)
    by_type = group_variants(variants)
    instances, stats = place_features(numbers, solids, by_type)
    need = sum(int(spec["count"]) for spec in feat["types"].values())
    if stats["placed"] < int(need * 0.9):
        raise SystemExit(f"FAIL details: features placed {stats['placed']} of {need}")
    focal = float(feat.get("focalPx", numbers["focalPx"]))
    qc = {}
    for name, group in by_type.items():
        rates = []
        for index, variant in enumerate(group):
            used = [inst["heightM"] for inst in instances if inst["type"] == name and inst["variant"] == index]
            if not used:
                continue
            rates.append(variant["contentH"] / max(used))
        if rates:
            worst = min(rates)
            qc[name] = {
                "texelsPerM": round(worst, 1),
                "mag1M": round(focal / worst, 3),
                "variants": len(group),
                "maxHeightM": max(v["maxHeightM"] for v in group),
            }
    return {
        "atlas": atlas,
        "variants": variants,
        "instances": instances,
        "stats": stats,
        "qc": qc,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--kit", required=True)
    ap.add_argument("--inbox", default=str(INBOX))
    args = ap.parse_args()
    num_path = Path(__file__).resolve().parent / "numbers" / f"{args.kit}.json"
    if not num_path.is_file():
        raise SystemExit(f"FAIL details: no numbers for {args.kit}")
    numbers = json.loads(num_path.read_text())
    if numbers.get("kit") != args.kit:
        raise SystemExit("FAIL details: kit id mismatch")
    kit_path = ROOT / "biome" / "kits" / f"{args.kit}.json"
    kit = json.loads(kit_path.read_text())
    if kit.get("id") != args.kit:
        raise SystemExit("FAIL details: biome kit id mismatch")
    inbox = Path(args.inbox)
    typed = []
    for name, spec in numbers["types"].items():
        sheet = inbox / spec["sheet"]
        if not sheet.is_file():
            raise SystemExit(f"FAIL details: missing sheet {sheet}")
        crops = split_sheet(sheet, int(spec.get("minArea") or numbers["minComponentArea"]))
        if len(crops) < 2:
            raise SystemExit(f"FAIL details: {name} kept {len(crops)} subjects")
        for crop in crops:
            typed.append((name, crop))
    atlas, variants = pack(typed, numbers)
    by_type = group_variants(variants)
    for name, spec in numbers["types"].items():
        if name not in by_type:
            raise SystemExit(f"FAIL details: {name} packed nothing")
    solids = load_solids(ROOT, numbers["pack"])
    instances, stats = place(numbers, solids, by_type)
    need = sum(int(spec["count"]) for spec in numbers["types"].values())
    if stats["placed"] < int(need * 0.9):
        raise SystemExit(f"FAIL details: placed {stats['placed']} of {need}")
    # Features first: the micro thinning gathers the cards around them.
    feat_built = build_features(numbers, inbox, solids)
    if numbers.get("thin"):
        feats = feat_built["instances"] if feat_built else []
        instances, thin_stats = thin_micro(numbers, instances, feats, solids, by_type)
        stats = {**stats, "placed": thin_stats["placed"], "drawn": thin_stats["drawn"], "byType": thin_stats["byType"],
                 "nearPerM2": thin_stats["nearPerM2"], "farPerM2": thin_stats["farPerM2"], "thin": thin_stats}
    out_dir = ROOT / numbers["pack"] / "src" / "details"
    out_dir.mkdir(parents=True, exist_ok=True)
    Image.fromarray(atlas).save(out_dir / "atlas.png", optimize=True)
    qc = {}
    focal = float(numbers["focalPx"])
    for name, group in by_type.items():
        rates = []
        for index, variant in enumerate(group):
            used = [inst["heightM"] for inst in instances if inst["type"] == name and inst["variant"] == index]
            if not used:
                continue
            rates.append(variant["contentH"] / max(used))
        if not rates:
            continue
        worst = min(rates)
        qc[name] = {
            "texelsPerM": round(worst, 1),
            "mag1M": round(focal / worst, 3),
            "variants": len(group),
        }
    manifest = {
        "schema": "details-manifest/1",
        "kit": args.kit,
        "seed": numbers["seed"],
        "atlas": f"{numbers['pack']}/src/details/atlas.png",
        "atlasW": int(atlas.shape[1]),
        "atlasH": int(atlas.shape[0]),
        "texMiB": round(tex_mib(atlas.shape[1], atlas.shape[0]), 3),
        "variants": variants,
        "instances": instances,
        "stats": stats,
        "qc": qc,
    }
    # One instance per line keeps the download small and the diff readable.
    body = json.dumps({k: v for k, v in manifest.items() if k != "instances"}, indent=2)
    rows = ",\n".join("    " + json.dumps(inst, separators=(",", ":")) for inst in instances)
    text = body[:-2] + ',\n  "instances": [\n' + rows + "\n  ]\n}\n"
    json.loads(text)
    (out_dir / "manifest.json").write_text(text)
    if feat_built is not None:
        fatlas = feat_built["atlas"]
        Image.fromarray(fatlas).save(out_dir / "features.png", optimize=True)
        fmanifest = {
            "schema": "details-features/1",
            "kit": args.kit,
            "seed": numbers["seed"],
            "atlas": f"{numbers['pack']}/src/details/features.png",
            "atlasW": int(fatlas.shape[1]),
            "atlasH": int(fatlas.shape[0]),
            "texMiB": round(tex_mib(fatlas.shape[1], fatlas.shape[0]), 3),
            "skirtBuryFrac": float(numbers["features"].get("skirtBuryFrac", 0.85)),
            "variants": feat_built["variants"],
            "instances": feat_built["instances"],
            "stats": feat_built["stats"],
            "qc": feat_built["qc"],
        }
        fbody = json.dumps({k: v for k, v in fmanifest.items() if k != "instances"}, indent=2)
        frows = ",\n".join("    " + json.dumps(inst, separators=(",", ":")) for inst in feat_built["instances"])
        ftext = fbody[:-2] + ',\n  "instances": [\n' + frows + "\n  ]\n}\n"
        json.loads(ftext)
        (out_dir / "features.json").write_text(ftext)
        print(
            f"PASS features placed={feat_built['stats']['placed']} "
            f"atlas={fatlas.shape[1]}x{fatlas.shape[0]} texMiB={fmanifest['texMiB']} qc={feat_built['qc']}"
        )
    print(
        f"PASS details kit={args.kit} placed={stats['placed']} drawn={stats['drawn']} "
        f"atlas={atlas.shape[1]}x{atlas.shape[0]} texMiB={manifest['texMiB']} "
        f"near={stats['nearPerM2']}/m2 far={stats['farPerM2']}/m2"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

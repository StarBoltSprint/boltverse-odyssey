#!/usr/bin/env python3
"""Loft zone A Echo Shard and small-detail solids from Imagine plates.

The mesh is an invisible visual hull. Side elevation sets the X span.
A real front elevation sets the Z span. A real plan sets the ring.
Skins stay the Imagine plates. This script does not draw a pixel.
"""

from __future__ import annotations

import json
import math
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "packs" / "zone-a" / "src" / "solids"
FEAT_PNG = ROOT / "packs" / "zone-a" / "src" / "details" / "features.png"
FEAT_JSON = ROOT / "packs" / "zone-a" / "src" / "details" / "features.json"
MICRO_PNG = ROOT / "packs" / "zone-a" / "src" / "details" / "atlas.png"
MICRO_JSON = ROOT / "packs" / "zone-a" / "src" / "details" / "manifest.json"
IMG = Path(
    "/workspace/x-live/chrome-game-home/.grok/sessions"
    "/%2Fworkspace%2Fgrokcli%2FzoneA-3d-details"
    "/01a10a6f-4efd-7c73-b236-6455619c5275/images"
)
STATIONS = 16
RING_N = 12


def luma(rgb: np.ndarray) -> np.ndarray:
    return rgb.max(axis=2)


def flood_bg(values: np.ndarray, thresh: int) -> np.ndarray:
    h, w = values.shape
    seen = np.zeros((h, w), np.uint8)
    q = deque()
    for x in range(w):
        q.append((0, x))
        q.append((h - 1, x))
    for y in range(h):
        q.append((y, 0))
        q.append((y, w - 1))
    while q:
        y, x = q.popleft()
        if y < 0 or x < 0 or y >= h or x >= w or seen[y, x]:
            continue
        if int(values[y, x]) > thresh:
            continue
        seen[y, x] = 1
        q.append((y - 1, x))
        q.append((y + 1, x))
        q.append((y, x - 1))
        q.append((y, x + 1))
    return seen.astype(bool)


def load_rgb(path: Path) -> tuple[np.ndarray, np.ndarray | None]:
    im = Image.open(path).convert("RGBA")
    arr = np.asarray(im)
    return arr[:, :, :3], arr[:, :, 3]


def mask_from(rgb: np.ndarray, alpha: np.ndarray | None, green: bool) -> np.ndarray:
    # A JPEG opened as RGBA is opaque. Only a real keyed cutout has a transparent field.
    keyed = alpha is not None and int((alpha < 250).sum()) > 32
    if keyed:
        m = alpha > 16
    else:
        m = ~flood_bg(luma(rgb), 28)
    if green:
        r = rgb[:, :, 0].astype(np.int16)
        g = rgb[:, :, 1].astype(np.int16)
        b = rgb[:, :, 2].astype(np.int16)
        fringe = (g > r + 12) & (g > b + 12)
        m = m & ~fringe
    return m


def drop_skirt(mask: np.ndarray) -> np.ndarray:
    h, w = mask.shape
    widths = mask.sum(axis=1)
    rows = np.flatnonzero(widths)
    if rows.size < 8:
        return mask
    y0, y1 = int(rows[0]), int(rows[-1])
    span = max(1, y1 - y0)
    a = y0 + int(span * 0.12)
    b = y0 + int(span * 0.62)
    body = widths[a:b]
    body = body[body > 0]
    if body.size < 3:
        return mask
    cut = 2.2 * float(np.median(body))
    out = mask.copy()
    limit = y0 + int(span * 0.72)
    for y in range(h):
        if y >= limit and widths[y] > cut:
            out[y] = False
    return out


def strip_disc(rgb: np.ndarray, mask: np.ndarray) -> np.ndarray:
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = mx - mn
    lum = (3 * r + 5 * g + 2 * b) // 10
    keep = (lum < 78) | (sat > 26)
    return mask & keep


def bbox(mask: np.ndarray) -> tuple[int, int, int, int] | None:
    ys, xs = np.nonzero(mask)
    if xs.size < 8:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def margins(mask: np.ndarray) -> tuple[int, int, int, int]:
    box = bbox(mask)
    if not box:
        return (0, 0, 0, 0)
    x0, y0, x1, y1 = box
    h, w = mask.shape
    return x0, w - 1 - x1, y0, h - 1 - y1


def rotate_mask(mask: np.ndarray, rgb: np.ndarray, k: int) -> tuple[np.ndarray, np.ndarray]:
    return np.rot90(mask, k), np.rot90(rgb, k)


def orient_tall(mask: np.ndarray, rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray, str]:
    """Stand a plate that was cooked lying on its side. Wider foot at the bottom."""
    note = "as cooked"
    h, w = mask.shape
    box = bbox(mask)
    if not box:
        return mask, rgb, note
    x0, y0, x1, y1 = box
    bw, bh = x1 - x0 + 1, y1 - y0 + 1
    if bw > bh * 1.15:
        mask, rgb = rotate_mask(mask, rgb, 1)
        note = "rotated 90"
        box = bbox(mask)
        if not box:
            return mask, rgb, note
        x0, y0, x1, y1 = box
    # Wider end is the foot.
    widths = mask.sum(axis=1)
    rows = np.flatnonzero(widths)
    if rows.size < 4:
        return mask, rgb, note
    span = max(1, int(rows[-1] - rows[0]))
    top = float(widths[int(rows[0]) : int(rows[0]) + max(2, span // 5)].mean())
    bot = float(widths[int(rows[-1]) - max(2, span // 5) : int(rows[-1]) + 1].mean())
    if top > bot * 1.15:
        mask = np.flipud(mask)
        rgb = np.flipud(rgb)
        note += ", flipped so the wide end is the foot"
    return mask, rgb, note


def row_span(mask: np.ndarray, y: int) -> tuple[int, int] | None:
    xs = np.flatnonzero(mask[y])
    if xs.size == 0:
        return None
    return int(xs[0]), int(xs[-1])


def sample_rows(mask: np.ndarray, n: int) -> list[tuple[float, int, int, int]]:
    """Return (v from the bottom, row, left, right) on the kept body."""
    widths = mask.sum(axis=1)
    rows = np.flatnonzero(widths)
    if rows.size < 2:
        return []
    y0, y1 = int(rows[0]), int(rows[-1])
    h = mask.shape[0]
    out = []
    for i in range(n):
        t = i / (n - 1)
        y = int(round(y0 + (y1 - y0) * (1.0 - t)))
        y = max(0, min(h - 1, y))
        # If this row was cleared, walk toward the body.
        if widths[y] == 0:
            for d in range(1, 12):
                if y - d >= 0 and widths[y - d] > 0:
                    y = y - d
                    break
                if y + d < h and widths[y + d] > 0:
                    y = y + d
                    break
        span = row_span(mask, y)
        if not span:
            continue
        v = 1.0 - (y + 0.5) / h
        out.append((v, y, span[0], span[1]))
    # Unique rows, foot first (low v).
    out.sort(key=lambda r: r[0])
    return out


def spans_from(mask: np.ndarray, n: int) -> list[dict]:
    rows = sample_rows(mask, n)
    if len(rows) < 2:
        return []
    body_h = max(1, abs(int(rows[-1][1]) - int(rows[0][1])))
    # y 0 at the foot (largest image row, smallest v).
    foot_row = rows[0][1]
    top_row = rows[-1][1]
    span_rows = max(1, foot_row - top_row)
    stations = []
    for v, y, left, right in rows:
        y_norm = (foot_row - y) / span_rows
        width = max(1, right - left + 1)
        stations.append({
            "y": round(float(y_norm), 4),
            "v": round(float(v), 4),
            "u0": round(left / mask.shape[1], 4),
            "u1": round((right + 1) / mask.shape[1], 4),
            "xPx": width,
            "xSpan": width / body_h,
        })
    return stations


def aspect(mask: np.ndarray) -> float:
    box = bbox(mask)
    if not box:
        return 0.0
    x0, y0, x1, y1 = box
    return (x1 - x0 + 1) / max(1, y1 - y0 + 1)


def plan_usable(mask: np.ndarray) -> bool:
    h, w = mask.shape
    if mask.size == 0 or int(mask.sum()) < 32:
        return False
    # A full-bleed edge means the outline was cut off.
    if mask[0].mean() > 0.02 or mask[-1].mean() > 0.02:
        return False
    if mask[:, 0].mean() > 0.02 or mask[:, -1].mean() > 0.02:
        return False
    box = bbox(mask)
    if not box:
        return False
    x0, y0, x1, y1 = box
    # A one-pixel margin is enough. A side that touches the frame is cropped.
    if x0 < 1 or y0 < 1 or x1 > w - 2 or y1 > h - 2:
        return False
    return True


def ring_from(mask: np.ndarray, n: int) -> list[list[float]] | None:
    if not plan_usable(mask):
        return None
    ys, xs = np.nonzero(mask)
    cy = float(ys.mean())
    cx = float(xs.mean())
    h, w = mask.shape
    limit = int(math.hypot(w, h)) + 2
    pts = []
    for i in range(n):
        ang = -math.pi + (2.0 * math.pi * i) / n
        dx, dy = math.cos(ang), math.sin(ang)
        last = None
        for r in range(0, limit):
            x = int(round(cx + dx * r))
            y = int(round(cy + dy * r))
            if x < 0 or y < 0 or x >= w or y >= h:
                break
            if mask[y, x]:
                last = (x, y)
        if last:
            pts.append(last)
    if len(pts) < 6:
        return None
    arr = np.array(pts, dtype=np.float64)
    x0, x1 = float(arr[:, 0].min()), float(arr[:, 0].max())
    z0, z1 = float(arr[:, 1].min()), float(arr[:, 1].max())
    if x1 - x0 < 4 or z1 - z0 < 4:
        return None
    ring = []
    for x, z in pts:
        ring.append([
            round((x - x0) / (x1 - x0) - 0.5, 4),
            round((z - z0) / (z1 - z0) - 0.5, 4),
        ])
    return ring


def crop_rgba(rgb: np.ndarray, mask: np.ndarray, pad: int = 2) -> tuple[np.ndarray, tuple[int, int, int, int]]:
    box = bbox(mask)
    if not box:
        raise RuntimeError("empty crop")
    h, w = mask.shape
    x0, y0, x1, y1 = box
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(w - 1, x1 + pad)
    y1 = min(h - 1, y1 + pad)
    sub_rgb = rgb[y0 : y1 + 1, x0 : x1 + 1]
    sub_m = mask[y0 : y1 + 1, x0 : x1 + 1]
    out = np.zeros((sub_rgb.shape[0], sub_rgb.shape[1], 4), np.uint8)
    out[:, :, :3] = sub_rgb
    out[:, :, 3] = np.where(sub_m, 255, 0).astype(np.uint8)
    return out, (x0, y0, x1, y1)


def resample_span(stations: list[dict], y: float, key: str) -> float:
    if not stations:
        return 0.0
    if y <= stations[0]["y"]:
        return float(stations[0][key])
    if y >= stations[-1]["y"]:
        return float(stations[-1][key])
    for i in range(1, len(stations)):
        a, b = stations[i - 1], stations[i]
        if a["y"] <= y <= b["y"]:
            den = max(1e-6, b["y"] - a["y"])
            t = (y - a["y"]) / den
            return float(a[key]) * (1 - t) + float(b[key]) * t
    return float(stations[-1][key])


def build_type(side: np.ndarray, front: np.ndarray | None, plan: np.ndarray | None, mode: str, note: str) -> dict:
    side_s = spans_from(side, STATIONS)
    if len(side_s) < 4:
        raise RuntimeError("side silhouette too small: " + note)
    front_s = spans_from(front, STATIONS) if front is not None else []
    ring = ring_from(plan, RING_N) if plan is not None else None
    plan_ratio = None
    if plan is not None and ring is not None:
        box = bbox(plan)
        if box:
            x0, y0, x1, y1 = box
            plan_ratio = (y1 - y0 + 1) / max(1, x1 - x0 + 1)
    body_px = max(1.0, side_s[-1]["y"] and 1.0)
    # body pixel height from the side mask's kept rows
    # xSpan already uses body height. Recover body px from the widest station later.
    stations = []
    for st in side_s:
        y = st["y"]
        x_span = st["xSpan"]
        if mode == "front" and front_s:
            z_px_ratio = resample_span(front_s, y, "xSpan")
            z_span = z_px_ratio
        elif mode == "plan" and plan_ratio:
            z_span = x_span * plan_ratio
        else:
            z_span = x_span * 0.4
        z_span = max(z_span, x_span * 0.08)
        fu0, fu1 = st["u0"], st["u1"]
        if front_s:
            # Front plate u at this height, in the front image.
            fu0 = resample_span(front_s, y, "u0")
            fu1 = resample_span(front_s, y, "u1")
        stations.append([
            round(y, 4),
            round(x_span, 4),
            round(z_span, 4),
            st["u0"],
            st["u1"],
            st["v"],
            round(float(fu0), 4),
            round(float(fu1), 4),
        ])
    xs = [s[1] for s in stations]
    zs = [s[2] for s in stations]
    # bodyFrac: kept vertical coverage. side spans used body height as the unit,
    # so the mesh height is the kept body. Fraction of the source content is
    # stored by the caller when it knows contentH.
    return {
        "stations": stations,
        "ring": ring,
        "halfX": round(max(xs) * 0.5, 4),
        "halfZ": round(max(zs) * 0.5, 4),
        "note": note,
        "mode": mode,
    }


def rect_mask(img_path: Path, u0: float, v0: float, u1: float, v1: float, atlas: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    h, w = alpha.shape
    # v1 is the top (image top = high v). Image row 0 is the top.
    x0 = int(round(u0 * w))
    x1 = int(round(u1 * w))
    y_top = int(round((1.0 - v1) * h))
    y_bot = int(round((1.0 - v0) * h))
    x0 = max(0, min(w - 1, x0))
    x1 = max(x0 + 1, min(w, x1))
    y_top = max(0, min(h - 1, y_top))
    y_bot = max(y_top + 1, min(h, y_bot))
    rgb = atlas[y_top:y_bot, x0:x1]
    a = alpha[y_top:y_bot, x0:x1]
    return mask_from(rgb, a, green=False)


def prep_view(path: Path, kind: str) -> tuple[np.ndarray, np.ndarray, str]:
    rgb, alpha = load_rgb(path)
    green = kind.startswith("shard")
    mask = mask_from(rgb, alpha, green=green)
    note = path.name
    if kind in ("shard-front", "tuft-front"):
        mask, rgb, turned = orient_tall(mask, rgb)
        note += " " + turned
    if kind.endswith("elev"):
        mask = drop_skirt(mask)
    if kind == "pile-plan":
        before = int(mask.sum())
        mask = strip_disc(rgb, mask)
        note += f" disc {before}->{int(mask.sum())}"
    return mask, rgb, note


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    feat = json.loads(FEAT_JSON.read_text())
    micro = json.loads(MICRO_JSON.read_text())
    feat_rgba = np.asarray(Image.open(FEAT_PNG).convert("RGBA"))
    micro_rgba = np.asarray(Image.open(MICRO_PNG).convert("RGBA"))

    views = {
        "cluster-front": IMG / "3.jpg",
        "crest-top": IMG / "2.jpg",
        "pile-front": IMG / "5.jpg",
        "pile-top": IMG / "4.jpg",
        "crest-front": IMG / "6.jpg",
        "slab-front": IMG / "7.jpg",
        "slab-top": IMG / "8.jpg",
        "shard-front": IMG / "9.jpg",
        "shard-top": IMG / "10.jpg",
        "crystal-front": IMG / "11.jpg",
        "crystal-side": IMG / "12.jpg",
        "tuft-top": IMG / "13.jpg",
        "tuft-front": IMG / "14.jpg",
        "crystal-top": IMG / "15.jpg",
        "cluster-top": IMG / "1.jpg",
    }
    loaded = {}
    report_views = {}
    for key, path in views.items():
        kind = "elev"
        if key.endswith("top"):
            kind = "pile-plan" if key == "pile-top" else "plan"
        if key == "shard-front":
            kind = "shard-front"
        if key == "tuft-front":
            kind = "tuft-front"
        if key.endswith("front") or key.endswith("side"):
            if kind not in ("shard-front", "tuft-front"):
                kind = "elev"
        mask, rgb, note = prep_view(path, kind if not key.endswith("side") else "elev")
        if key.endswith("side"):
            mask = drop_skirt(mask)
        loaded[key] = (mask, rgb)
        box = bbox(mask)
        ml, mr, mt, mb = margins(mask)
        aw = 0.0
        if box:
            aw = round((box[2] - box[0] + 1) / max(1, box[3] - box[1] + 1), 3)
        report_views[key] = {
            "note": note,
            "fill": round(float(mask.mean()), 3),
            "margins": [ml, mr, mt, mb],
            "aspect": aw,
            "plan": plan_usable(mask) if "top" in key else False,
        }

    # Crystal top is usable only when the outline has a margin on every side.
    crystal_plan = loaded["crystal-top"][0] if report_views["crystal-top"]["plan"] else None
    crystal_mode = "plan" if crystal_plan is not None else "front"
    parts = {}

    # The plan shapes the ring. The front elevation still sets the depth.
    # The top plate is a ruler only: two skins already fill the old byte budget.
    crystal = build_type(
        loaded["crystal-side"][0],
        loaded["crystal-front"][0],
        crystal_plan,
        "front",
        "crystal side+front" + (" ring" if crystal_plan is not None else " rectangle"),
    )
    side_img, _ = crop_rgba(loaded["crystal-side"][1], loaded["crystal-side"][0])
    front_img, _ = crop_rgba(loaded["crystal-front"][1], loaded["crystal-front"][0])
    tiles = [("side", side_img), ("front", front_img)]
    # Pack left to right. Keep the side crop's height as the mag ruler.
    gutter = 2
    height = max(t.shape[0] for _, t in tiles)
    width = gutter * (len(tiles) - 1) + sum(t.shape[1] for _, t in tiles)
    sheet = np.zeros((height, width, 4), np.uint8)
    rects = {}
    x = 0
    for name, tile in tiles:
        th, tw = tile.shape[:2]
        # Foot at the bottom of the sheet so v rises with the mesh.
        y = height - th
        sheet[y : y + th, x : x + tw] = tile
        # GL v: image top = 1. The tile's top sits at image row y.
        v1 = 1.0 - y / height
        v0 = 1.0 - (y + th) / height
        u0 = x / width
        u1 = (x + tw) / width
        rects[name] = [round(u0, 5), round(v0, 5), round(u1, 5), round(v1, 5)]
        x += tw + gutter
    skin_path = OUT / "crystal-skin.png"
    # Budget: the uploaded sheet replaces crystal.png, so it stays within that mip chain.
    old = Image.open(ROOT / "packs/common/archives/art/crystal.png")
    budget_px = old.size[0] * old.size[1]
    side_h = side_img.shape[0]
    if sheet.shape[0] * sheet.shape[1] > budget_px:
        scale = math.sqrt(budget_px / float(sheet.shape[0] * sheet.shape[1]))
        nw = max(1, int(round(sheet.shape[1] * scale)))
        nh = max(1, int(round(sheet.shape[0] * scale)))
        sheet = np.asarray(Image.fromarray(sheet, "RGBA").resize((nw, nh), Image.Resampling.LANCZOS))
        side_h = max(1, int(round(side_h * sheet.shape[0] / height)))
    Image.fromarray(sheet, "RGBA").save(skin_path, optimize=True)
    old_bytes = math.ceil(old.size[0] * old.size[1] * 4 * 4 / 3)
    new_bytes = math.ceil(sheet.shape[1] * sheet.shape[0] * 4 * 4 / 3)
    crystal["skin"] = "packs/zone-a/src/solids/crystal-skin.png"
    crystal["rects"] = rects
    crystal["contentH"] = int(side_h)
    crystal["skinBytes"] = int(new_bytes)
    crystal["oldBytes"] = int(old_bytes)
    # Side stations were measured on the full plate, not the crop.
    # Remap u into the crop: the crop is tight, so the stored u is already
    # the full-plate fraction. Convert plate u into crop u.
    side_mask = loaded["crystal-side"][0]
    sb = bbox(side_mask)
    assert sb
    pw = side_mask.shape[1]
    ph = side_mask.shape[0]
    # crop_rgba pad is 2
    cx0 = max(0, sb[0] - 2)
    cy0 = max(0, sb[1] - 2)
    cx1 = min(pw - 1, sb[2] + 2)
    cy1 = min(ph - 1, sb[3] + 2)
    cw = cx1 - cx0 + 1
    ch = cy1 - cy0 + 1
    fixed = []
    for y, xs, zs, u0, u1, v, fu0, fu1 in crystal["stations"]:
        # plate v is 1 at the top. Image row = (1-v)*ph.
        def to_crop_u(u):
            px = u * pw
            return min(1.0, max(0.0, (px - cx0) / cw))

        row = (1.0 - v) * ph
        cv = 1.0 - (row - cy0) / ch
        fixed.append([
            y, xs, zs,
            round(to_crop_u(u0), 4),
            round(to_crop_u(u1), 4),
            round(min(1.0, max(0.0, cv)), 4),
            round(min(1.0, max(0.0, fu0)), 4),
            round(min(1.0, max(0.0, fu1)), 4),
        ])
    # Front u was measured on the full front plate. Remap into the front crop.
    front_mask = loaded["crystal-front"][0]
    fb = bbox(front_mask)
    assert fb
    fw = front_mask.shape[1]
    fx0 = max(0, fb[0] - 2)
    fx1 = min(fw - 1, fb[2] + 2)
    fcw = fx1 - fx0 + 1
    for st in fixed:
        for idx in (6, 7):
            px = st[idx] * fw
            st[idx] = round(min(1.0, max(0.0, (px - fx0) / fcw)), 4)
    crystal["stations"] = fixed
    crystal["bodyFrac"] = 1.0
    parts["crystal"] = crystal

    def side_from_variant(table, rgba, variant, green: bool) -> np.ndarray:
        h, w = rgba.shape[:2]
        x0 = int(round(variant["u0"] * w))
        x1 = int(round(variant["u1"] * w))
        y_top = int(round((1.0 - variant["v1"]) * h))
        y_bot = int(round((1.0 - variant["v0"]) * h))
        x0, x1 = max(0, x0), min(w, max(x0 + 1, x1))
        y_top, y_bot = max(0, y_top), min(h, max(y_top + 1, y_bot))
        rgb = rgba[y_top:y_bot, x0:x1, :3]
        alpha = rgba[y_top:y_bot, x0:x1, 3]
        mask = mask_from(rgb, alpha, green=green)
        return drop_skirt(mask)

    # Feature types. One variant each.
    feat_plan = {
        "crest": ("plan", loaded["crest-top"][0], None),
        "pile": ("plan", loaded["pile-top"][0], None),
        "slab": ("front", loaded["slab-front"][0], loaded["slab-top"][0]),
        "cluster": ("front", loaded["cluster-front"][0], None),
    }
    for variant in feat["variants"]:
        kind = variant["type"]
        mode, elev, plan = feat_plan[kind]
        side = side_from_variant(feat, feat_rgba, variant, green=False)
        front = elev if mode == "front" else None
        use_plan = plan if plan is not None and plan_usable(plan) else (elev if mode == "plan" and plan_usable(elev) else None)
        if mode == "plan" and use_plan is None:
            mode_use = "ratio"
            front = None
        else:
            mode_use = "front" if mode == "front" else "plan"
        part = build_type(side, front, use_plan, mode_use, kind)
        content_h = float(variant["contentH"])
        # spans_from body height is the kept pixel height. bodyFrac scales the
        # authored heightM down to that kept body.
        widths = side.sum(axis=1)
        rows = np.flatnonzero(widths)
        kept = int(rows[-1] - rows[0] + 1) if rows.size else int(content_h)
        part["bodyFrac"] = round(min(1.0, kept / content_h), 4)
        part["contentH"] = int(variant["contentH"])
        parts[kind] = part

    micro_modes = {
        "shard": ("front", loaded["shard-front"][0], None),
        "tuft": ("ratio", None, None),
    }
    # inst.variant is the ordinal inside that type (details.js byType), not the
    # manifest array index. Shards happen to start at 0; tufts do not.
    ordinal = {}
    for variant in micro["variants"]:
        kind = variant["type"]
        if kind not in micro_modes:
            continue
        n = ordinal.get(kind, 0)
        ordinal[kind] = n + 1
        mode, front, plan = micro_modes[kind]
        side = side_from_variant(micro, micro_rgba, variant, green=(kind == "shard"))
        part = build_type(side, front if mode == "front" else None, None, "front" if mode == "front" else "ratio", f"{kind}:{n}")
        content_h = float(variant["contentH"])
        widths = side.sum(axis=1)
        rows = np.flatnonzero(widths)
        kept = int(rows[-1] - rows[0] + 1) if rows.size else int(content_h)
        part["bodyFrac"] = round(min(1.0, kept / content_h), 4)
        part["contentH"] = int(variant["contentH"])
        parts[f"{kind}:{n}"] = part

    # Compact stations to 3 decimals already applied. Drop ring from types
    # whose plan was rejected (build_type already did).
    payload = {"version": 1, "parts": parts, "views": report_views}
    (OUT / "lofts.json").write_text(json.dumps(payload, separators=(",", ":")) + "\n")
    (OUT / "crystal-skin.PROMPT.txt").write_text(
        "ROLE unlit skin. Orthographic crystal plates packed on one sheet. "
        "Empty field around each plate. No horizon. The mesh is measured, not drawn.\n"
    )
    lines = []
    for name, part in parts.items():
        lines.append(
            f"{name} mode={part['mode']} half=({part['halfX']},{part['halfZ']}) "
            f"body={part['bodyFrac']} ring={bool(part['ring'])} {part['note']}"
        )
    lines.append(f"crystal skin {sheet.shape[1]}x{sheet.shape[0]} bytes {new_bytes} old {old_bytes}")
    for key, row in report_views.items():
        lines.append(f"view {key} aspect={row['aspect']} margins={row['margins']} plan={row['plan']} {row['note']}")
    text = "\n".join(lines) + "\n"
    (OUT / "loft-report.txt").write_text(text)
    print(text)
    # Hard checks: every part has thickness and a side span.
    for name, part in parts.items():
        if part["halfX"] <= 0.02 or part["halfZ"] <= 0.02:
            raise SystemExit(f"flat loft {name}")
        if len(part["stations"]) < 8:
            raise SystemExit(f"short loft {name}")
    if new_bytes > old_bytes * 1.05:
        raise SystemExit(f"crystal skin grew {new_bytes} > {old_bytes}")
    for key in ("tuft:0", "tuft:1", "tuft:2", "shard:0", "shard:1", "shard:2", "shard:3"):
        if key not in parts:
            raise SystemExit(f"missing loft {key}")
    if "tuft:12" in parts:
        raise SystemExit("tuft key used the manifest index")


if __name__ == "__main__":
    main()

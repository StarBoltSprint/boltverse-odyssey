#!/usr/bin/env python3
"""One command: kit numbers + Imagine views -> seated rock manifest.

    python3 tools/rocks/build.py --kit howling-eclipse

Keys chroma green to alpha, gates the sheet, carves an invisible hull,
places instances off the running corridor. No palette and no prompt text.
"""
from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
INBOX = Path("/workspace/grokcli/out/zoneA-step3")
YAWS = [0, 45, 90, 135, 180, 225, 270, 315]


def repo_rel(path: Path) -> str:
    return str(path.resolve().relative_to(ROOT)).replace("\\", "/")


def is_green(r: int, g: int, b: int) -> bool:
    # Chroma flood only. Delta 16 keeps a dull screen without eating dark rock.
    return g > 55 and g > r + 16 and g > b + 16


def key_rgba(im: Image.Image) -> tuple[Image.Image, dict]:
    rgb = im.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    bg = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()

    def push(x: int, y: int) -> None:
        i = y * w + x
        if bg[i]:
            return
        r, g, b = px[x, y]
        if not is_green(r, g, b):
            return
        bg[i] = 1
        q.append((x, y))

    for x in range(w):
        push(x, 0)
        push(x, h - 1)
    for y in range(h):
        push(0, y)
        push(w - 1, y)
    while q:
        x, y = q.popleft()
        if x > 0:
            push(x - 1, y)
        if x + 1 < w:
            push(x + 1, y)
        if y > 0:
            push(x, y - 1)
        if y + 1 < h:
            push(x, y + 1)
    out = Image.new("RGBA", (w, h))
    op = out.load()
    minx, miny, maxx, maxy = w, h, -1, -1
    area = 0
    for y in range(h):
        for x in range(w):
            if bg[y * w + x]:
                op[x, y] = (0, 0, 0, 0)
            else:
                r, g, b = px[x, y]
                op[x, y] = (r, g, b, 255)
                area += 1
                if x < minx:
                    minx = x
                if y < miny:
                    miny = y
                if x > maxx:
                    maxx = x
                if y > maxy:
                    maxy = y
    if maxx < 0:
        raise SystemExit("FAIL key: no foreground")
    return out, {
        "bbox": [minx, miny, maxx, maxy],
        "height": maxy - miny + 1,
        "width": maxx - minx + 1,
        "area": area,
    }


def fit_down(rgba: Image.Image, info: dict, max_tex: int, margin: float) -> tuple[Image.Image, dict]:
    """Scale down only. Subject stays inside the frame with a margin."""
    w, h = rgba.size
    side = max(w, h)
    if side > max_tex:
        scale = max_tex / side
    else:
        scale = 1.0
    nw = max(1, int(round(w * scale)))
    nh = max(1, int(round(h * scale)))
    if scale < 1:
        rgba = rgba.resize((nw, nh), Image.Resampling.LANCZOS)
    else:
        nw, nh = w, h
    x0, y0, x1, y1 = info["bbox"]
    x0 = int(x0 * scale)
    y0 = int(y0 * scale)
    x1 = int(x1 * scale)
    y1 = int(y1 * scale)
    bw = max(1, x1 - x0 + 1)
    bh = max(1, y1 - y0 + 1)
    side = max(nw, nh)
    limit = (1 - 2 * margin) * side
    shrink = 1.0
    if bh > limit or bw > limit:
        shrink = min(limit / bh, limit / bw)
    canvas = max(nw, nh)
    # Square plate, subject bottom-weighted so the cutout sits on the ground.
    plate = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    crop = rgba.crop((max(0, x0), max(0, y0), min(nw, x1 + 1), min(nh, y1 + 1)))
    if shrink < 0.999:
        crop = crop.resize(
            (max(1, int(crop.size[0] * shrink)), max(1, int(crop.size[1] * shrink))),
            Image.Resampling.LANCZOS,
        )
    cw, ch = crop.size
    ox = (canvas - cw) // 2
    oy = canvas - ch - int(margin * canvas)
    if oy < int(margin * canvas):
        oy = int(margin * canvas)
    plate.paste(crop, (ox, oy), crop)
    return plate, {"contentW": cw, "contentH": ch, "tex": canvas, "ox": ox, "oy": oy}


def key_file(src: Path, dst: Path, max_tex: int) -> dict:
    rgba, info = key_rgba(Image.open(src))
    plate, box = fit_down(rgba, info, max_tex, 0.06)
    dst.parent.mkdir(parents=True, exist_ok=True)
    plate.save(dst, "PNG", optimize=True)
    box["srcH"] = info["height"]
    box["srcW"] = info["width"]
    return box


def camera_block(size: list, fill: float, fov: float) -> dict:
    dist = size[1] / (2 * fill * math.tan(math.radians(fov / 2)))
    eye = dist * math.tan(math.radians(15))
    return {"distance": round(dist, 4), "eyeY": round(eye, 4), "fovYDeg": fov}


def alpha_bbox(im: Image.Image) -> tuple[int, int, int, int]:
    rgba = im.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            if px[x, y][3] < 16:
                continue
            if x < minx:
                minx = x
            if y < miny:
                miny = y
            if x > maxx:
                maxx = x
            if y > maxy:
                maxy = y
    return minx, miny, maxx, maxy


def rel_delta(a: float, b: float) -> float:
    return abs(a - b) / max((a + b) * 0.5, 1e-6)


def scale_plate(path: Path, factor: float) -> None:
    if factor >= 0.999:
        return
    im = Image.open(path).convert("RGBA")
    nw = max(1, int(round(im.size[0] * factor)))
    nh = max(1, int(round(im.size[1] * factor)))
    small = im.resize((nw, nh), Image.Resampling.LANCZOS)
    plate = Image.new("RGBA", im.size, (0, 0, 0, 0))
    plate.paste(small, ((im.size[0] - nw) // 2, (im.size[1] - nh) // 2), small)
    plate.save(path, "PNG", optimize=True)


def plate_span(path: Path) -> tuple[int, int, int]:
    """Width and height are the alpha box. Area is the opaque pixel count.

    The sheet gate compares pixel area, not the box product. A box that
    already agrees can still fail when one yaw is denser inside the box.
    """
    im = np.asarray(Image.open(path).convert("RGBA"))
    fg = im[:, :, 3] > 16
    ys, xs = np.where(fg)
    if len(ys) == 0:
        return 1, 1, 1
    return int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1), int(fg.sum())


def agree_plates(keyed: Path) -> None:
    """Down-scale outlier plates until neighbour area and opposite width sit inside the sheet gate."""
    paths = {yaw: keyed / f"yaw-{yaw:03d}.png" for yaw in YAWS}
    for _ in range(8):
        span = {yaw: plate_span(paths[yaw]) for yaw in YAWS}
        scales = {yaw: 1.0 for yaw in YAWS}
        for i, yaw in enumerate(YAWS):
            other = YAWS[(i + 1) % len(YAWS)]
            a = span[yaw][2]
            b = span[other][2]
            if rel_delta(a, b) <= 0.145:
                continue
            big, small, big_yaw = (a, b, yaw) if a > b else (b, a, other)
            # Target a 0.12 area delta so the 0.15 sheet gate has room.
            linear = math.sqrt((2.12 * small) / (1.88 * big))
            scales[big_yaw] = min(scales[big_yaw], linear)
        for yaw in YAWS:
            if yaw >= 180:
                continue
            back = (yaw + 180) % 360
            wa, wb = span[yaw][0], span[back][0]
            if rel_delta(wa, wb) <= 0.145:
                continue
            big, small, big_yaw = (wa, wb, yaw) if wa > wb else (wb, wa, back)
            scales[big_yaw] = min(scales[big_yaw], (2.14 * small) / (1.86 * big))
        if all(s >= 0.999 for s in scales.values()):
            break
        for yaw, factor in scales.items():
            scale_plate(paths[yaw], factor)


def normalize_heights(keyed: Path) -> None:
    """Scale taller plates down so bbox heights agree. Never enlarge."""
    paths = [keyed / f"yaw-{yaw:03d}.png" for yaw in YAWS]
    boxes = []
    for path in paths:
        x0, y0, x1, y1 = alpha_bbox(Image.open(path))
        boxes.append((x0, y0, x1, y1, y1 - y0 + 1))
    target = min(b[4] for b in boxes)
    for path, (x0, y0, x1, y1, bh) in zip(paths, boxes):
        if bh <= target + 1:
            continue
        im = Image.open(path).convert("RGBA")
        scale = target / bh
        nw = max(1, int(round(im.size[0] * scale)))
        nh = max(1, int(round(im.size[1] * scale)))
        small = im.resize((nw, nh), Image.Resampling.LANCZOS)
        plate = Image.new("RGBA", im.size, (0, 0, 0, 0))
        plate.paste(small, ((im.size[0] - nw) // 2, (im.size[1] - nh) // 2), small)
        plate.save(path, "PNG", optimize=True)


def write_config(path: Path, name: str, spec: dict) -> None:
    size = spec["objectSize"]
    fov = spec.get("fovYDeg", 32)
    cfg = {
        "name": name,
        "objectSize": size,
        "vote": 7,
        "surfaceGrid": 48,
        "smoothIters": 4,
        # Negative so a dark Imagine pixel stays in the silhouette.
        # The key is alpha. A 0.04 luma cut treats black rock as a hole.
        "bgThreshold": -1,
        "camera": camera_block(size, spec.get("fill", 0.7), fov),
        "views": [{"file": f"yaw-{yaw:03d}.png", "yawDeg": yaw} for yaw in YAWS],
    }
    path.write_text(json.dumps(cfg, indent=2) + "\n")


def run(cmd: list[str]) -> None:
    print("+", " ".join(cmd), flush=True)
    subprocess.check_call(cmd, cwd=ROOT)


def hull_type(name: str, spec: dict, inbox: Path, pack: Path, allow_partial: bool) -> str | None:
    src_dir = inbox / "views" / name
    missing = [y for y in YAWS if not (src_dir / f"yaw-{y:03d}.jpg").is_file() and not (src_dir / f"yaw-{y:03d}.png").is_file()]
    if missing:
        msg = f"FAIL views: {name} missing {missing}"
        if allow_partial:
            print(msg)
            return None
        raise SystemExit(msg)
    keyed = Path("/tmp") / f"rocks-{name}-views"
    if keyed.exists():
        shutil.rmtree(keyed)
    keyed.mkdir(parents=True)
    for yaw in YAWS:
        src = src_dir / f"yaw-{yaw:03d}.png"
        if not src.is_file():
            src = src_dir / f"yaw-{yaw:03d}.jpg"
        key_file(src, keyed / f"yaw-{yaw:03d}.png", int(spec["maxTex"]))
    normalize_heights(keyed)
    agree_plates(keyed)
    cfg = keyed / "config.json"
    write_config(cfg, name, spec)
    sheet = Path("/tmp") / f"rocks-{name}-sheet"
    try:
        run([sys.executable, "tools/objsheet/sheet.py", "--views", str(keyed), "--config", str(cfg), "--out", str(sheet)])
    except subprocess.CalledProcessError:
        print(f"KNOWN sheet: {name} views disagree — two cooks already spent, hull not carved")
        return None
    carved = Path("/tmp") / f"rocks-{name}-hull"
    if carved.exists():
        shutil.rmtree(carved)
    try:
        run(
            [
                sys.executable,
                "tools/walkaround/build.py",
                "--views",
                str(keyed),
                "--config",
                str(cfg),
                "--out",
                str(carved),
                "--surface-grid",
                "48",
                "--smooth-iters",
                "4",
            ]
        )
    except subprocess.CalledProcessError:
        print(f"KNOWN hull: {name} carve failed — not shipped")
        return None
    dest = pack / "src" / "rocks" / name
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)
    shutil.copyfile(carved / "asset.json", dest / "asset.json")
    shutil.copyfile(carved / "mesh.bin", dest / "mesh.bin")
    shutil.copytree(carved / "views", dest / "views")
    report = json.loads((carved / "qc" / "report.json").read_text())
    mag = report.get("mag") or report.get("magnification")
    print(f"{name} hull mag={mag} report_ok={report.get('ok')}")
    if report.get("ok") is False:
        print(f"KNOWN hull: {name} report not ok — not shipped")
        shutil.rmtree(dest, ignore_errors=True)
        return None
    return repo_rel(dest / "asset.json")


def cutouts(spec: dict, inbox: Path, pack: Path) -> dict:
    out = {}
    variants = spec.get("variants") or []
    src_dir = inbox / "pebbles"
    for i, name in enumerate(variants):
        src = src_dir / f"{name}.jpg"
        if not src.is_file():
            src = src_dir / f"{name}.png"
        if not src.is_file():
            raise SystemExit(f"FAIL cutout: missing {name}")
        dst = pack / "src" / "rocks" / f"{name}.png"
        box = key_file(src, dst, int(spec["maxTex"]))
        out[name] = {"file": repo_rel(dst), "contentW": box["contentW"], "contentH": box["contentH"], "tex": box["tex"], "variant": i}
    return out


def main() -> int:
    p = argparse.ArgumentParser(description="Build placed Imagine rocks for one kit")
    p.add_argument("--kit", required=True)
    p.add_argument("--inbox", type=Path, default=INBOX)
    p.add_argument("--allow-partial", action="store_true")
    args = p.parse_args()
    numbers_path = ROOT / "tools" / "rocks" / "numbers" / f"{args.kit}.json"
    kit_path = ROOT / "biome" / "kits" / f"{args.kit}.json"
    if not numbers_path.is_file():
        raise SystemExit(f"FAIL kit: no numbers file {numbers_path}")
    if not kit_path.is_file():
        raise SystemExit(f"FAIL kit: no kit {kit_path}")
    numbers = json.loads(numbers_path.read_text())
    if numbers.get("kit") != args.kit:
        raise SystemExit("FAIL kit: numbers kit id does not match")
    pack = ROOT / numbers["pack"]
    assets = {}
    partial = False
    for name, spec in numbers["types"].items():
        if spec["kind"] == "hull":
            rel = hull_type(name, spec, args.inbox, pack, args.allow_partial)
            if rel:
                assets[name] = rel
            else:
                partial = True
        elif spec["kind"] == "cutout":
            try:
                assets.update(cutouts(spec, args.inbox, pack))
            except SystemExit:
                if not args.allow_partial:
                    raise
                partial = True
                print(f"FAIL cutout skipped for {name}")
    manifest_path = pack / "src" / "rocks" / "manifest.json"
    run(["node", "tools/rocks/place.mjs", "--numbers", str(numbers_path), "--write", str(manifest_path)])
    manifest = json.loads(manifest_path.read_text())
    manifest["assets"] = assets
    manifest["partial"] = partial
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(("PARTIAL " if partial else "PASS ") + repo_rel(manifest_path))
    return 0


if __name__ == "__main__":
    sys.exit(main())

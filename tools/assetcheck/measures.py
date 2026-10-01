"""Pixel measurements for Imagine assets. Never writes the source files.

Every number is read off the file. Nothing here resizes, regrades, or
replaces an Imagine image. A downscale exists only inside a measurement
buffer (loop diffs, optical flow) and is discarded.
"""

from __future__ import annotations

import json
import math
import subprocess
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

SCREEN_W = 720
SCREEN_H = 1600
MAG_LIMIT = 1.0
WEBGL_MAX_TEXTURE = 4096

# Alpha / key. A cutout that will be composited needs a real alpha unless
# the manifest declares the key (black void or green screen).
UNKEYED_BLACK_LUMA = 14.0
UNKEYED_BLACK_FRACTION = 0.02
PLATE_COLOR_DIST = 18.0
PLATE_AREA_FRACTION = 0.12
HALO_THICKNESS_PX = 3.0
GREEN_SPILL_FRACTION = 0.35

# Loop. Mean absolute error is on 0–255. Flow is source pixels.
SEAM_MAE = 8.0
SEAM_P95 = 28.0
SEAM_FLOW_PX = 2.0
POP_FACTOR = 4.5
POP_MAE_MIN = 18.0
FROZEN_MAE = 0.45
FROZEN_SEC = 0.40

# Turntable / one-object video. A smooth yaw change is allowed.
# A single-frame shape pop is not.
MORPH_AREA_JUMP = 0.15
MORPH_HEIGHT_JUMP = 0.08
MORPH_IOU = 0.75

# Tiles.
SEAM_RATIO = 2.2
SEAM_ABS = 12.0
EXPOSURE_DELTA = 18.0
CONTRAST_RATIO = 1.75

# Posterization. Fraction of horizontal steps that are a flat run then a jump.
BANDING_FRACTION = 0.045

LOSSLESS_STILL_KINDS = {"cutout", "still", "tile", "backdrop"}
VIDEO_EXTS = {".mp4", ".webm", ".mov", ".mkv", ".m4v"}
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".tif", ".tiff"}

HEURISTICS = [
    "The tool only measures. It does not repaint, resize, or replace the source.",
    "Loop optical flow is coarse block matching on a downscale, not a learned flow model.",
    "Banding is a posterization heuristic (flat run, then a step). Noise can hide bands.",
    "A declared key (black or green) is trusted as the compositor key. Undeclared cutouts must carry alpha.",
    "Magnification uses the declared on-screen size at the closest camera on a 720×1600 portrait.",
    "A hand-written PASS is not a PASS. The exit code and this file are the gate.",
]


def r4(value) -> float:
    return round(float(value), 4)


def status_of(ok: bool) -> str:
    return "PASS" if ok else "FAIL"


class CheckError(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


def load_manifest(path: Path) -> dict:
    data = json.loads(path.read_text())
    if "assets" not in data:
        raise CheckError(f"manifest {path} has no assets list")
    return data


def discover_assets(folder: Path, kind: str, on_screen, key: str | None, loop: bool | None) -> dict:
    files = []
    for path in sorted(folder.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix.lower() not in IMAGE_EXTS | VIDEO_EXTS:
            continue
        if path.name == "manifest.json":
            continue
        item = {"file": str(path.relative_to(folder))}
        if kind:
            item["kind"] = kind
        if on_screen is not None:
            item["onScreen"] = list(on_screen)
        if key:
            item["key"] = key
        if loop is not None:
            item["loop"] = loop
        files.append(item)
    if not files:
        raise CheckError(f"no images or videos under {folder}")
    return {"screen": [SCREEN_W, SCREEN_H], "assets": files}


def parse_on_screen(text: str) -> list[float]:
    parts = text.lower().replace(" ", "").split("x")
    if len(parts) != 2:
        raise CheckError(f"on-screen size must be WxH, got {text}")
    return [float(parts[0]), float(parts[1])]


def screen_of(manifest: dict) -> tuple[int, int]:
    screen = manifest.get("screen") or [SCREEN_W, SCREEN_H]
    return int(screen[0]), int(screen[1])


def webgl_max_of(manifest: dict) -> int:
    return int(manifest.get("webglMaxTexture") or WEBGL_MAX_TEXTURE)


def resolve_file(spec: str, root: Path) -> Path:
    path = Path(spec)
    if not path.is_absolute():
        path = root / path
    return path


def kind_of(item: dict, path: Path) -> str:
    if item.get("kind"):
        return str(item["kind"])
    name = path.name.lower()
    if any(token in name for token in ("tile", "ground")):
        return "tile"
    if any(token in name for token in ("backdrop", "panorama", "ring-360", "sky-")):
        return "backdrop"
    if path.suffix.lower() in VIDEO_EXTS:
        return "loop" if "loop" in name or "cycle" in name else "video"
    return "still"


def on_screen_px(item: dict, screen: tuple[int, int]) -> tuple[list[float] | None, dict]:
    """Declared pixels at the closest camera. Camera projection fills in when omitted."""
    notes = {}
    direct = item.get("onScreen")
    direct_px = [float(direct[0]), float(direct[1])] if direct else None
    camera = item.get("camera") or {}
    projected = None
    if camera.get("distance") and camera.get("fovYDeg") and item.get("objectSize"):
        size = item["objectSize"]
        dist = float(camera["distance"])
        fov = float(camera["fovYDeg"])
        fy = (screen[1] * 0.5) / math.tan(math.radians(fov) * 0.5)
        fx = fy
        ow = float(max(size[0], size[2] if len(size) > 2 else size[0]))
        oh = float(size[1])
        projected = [ow / dist * fx, oh / dist * fy]
        notes["cameraProjection"] = [r4(projected[0]), r4(projected[1])]
        notes["cameraDistance"] = r4(dist)
        notes["fovYDeg"] = r4(fov)
    if direct_px and projected:
        gap_w = abs(direct_px[0] - projected[0]) / max(direct_px[0], 1.0)
        gap_h = abs(direct_px[1] - projected[1]) / max(direct_px[1], 1.0)
        notes["cameraAgreement"] = r4(max(gap_w, gap_h))
        if max(gap_w, gap_h) > 0.10:
            notes["cameraConflict"] = True
    chosen = direct_px or projected
    return chosen, notes


def open_image(path: Path) -> tuple[np.ndarray, dict]:
    info = {"container": path.suffix.lower().lstrip(".") or "unknown"}
    try:
        with Image.open(path) as im:
            info["codec"] = (im.format or "unknown").lower()
            info["mode"] = im.mode
            info["width"] = int(im.size[0])
            info["height"] = int(im.size[1])
            rgba = np.array(im.convert("RGBA"))
    except Exception as exc:
        raise CheckError(f"image does not open: {exc}") from exc
    info["lossless"] = info["codec"] == "png"
    return rgba, info


def probe_video(path: Path) -> dict:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        str(path),
    ]
    try:
        proc = subprocess.run(cmd, check=False, capture_output=True, text=True)
    except FileNotFoundError as exc:
        raise CheckError("ffprobe is not installed") from exc
    if proc.returncode != 0:
        raise CheckError(f"video does not open: {proc.stderr.strip() or proc.returncode}")
    data = json.loads(proc.stdout or "{}")
    streams = [s for s in data.get("streams") or [] if s.get("codec_type") == "video"]
    if not streams:
        raise CheckError("video has no video stream")
    stream = streams[0]
    format_info = data.get("format") or {}
    rate = stream.get("avg_frame_rate") or stream.get("r_frame_rate") or "0/1"
    num, den = rate.split("/")
    fps = float(num) / float(den) if float(den) else 0.0
    nb = stream.get("nb_frames")
    duration = float(stream.get("duration") or format_info.get("duration") or 0.0)
    if nb is None and fps and duration:
        nb = int(round(fps * duration))
    lossless_codecs = {"png", "ffv1", "qtrle", "rawvideo", "magicyuv"}
    codec = str(stream.get("codec_name") or "unknown")
    return {
        "container": path.suffix.lower().lstrip("."),
        "codec": codec,
        "pixFmt": stream.get("pix_fmt"),
        "width": int(stream["width"]),
        "height": int(stream["height"]),
        "fps": r4(fps),
        "frames": int(nb or 0),
        "durationSec": r4(duration),
        "lossless": codec in lossless_codecs,
    }


def decode_rgb_frames(path: Path, indexes: list[int]) -> list[np.ndarray]:
    if not indexes:
        return []
    select = "+".join(f"eq(n\\,{i})" for i in indexes)
    cmd = [
        "ffmpeg",
        "-v",
        "error",
        "-i",
        str(path),
        "-vf",
        f"select='{select}',setpts=N/TB",
        "-vsync",
        "vfr",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-",
    ]
    proc = subprocess.run(cmd, check=False, capture_output=True)
    if proc.returncode != 0:
        raise CheckError(f"ffmpeg decode failed: {proc.stderr.decode(errors='replace')[:400]}")
    info = probe_video(path)
    w, h = info["width"], info["height"]
    frame_bytes = w * h * 3
    raw = proc.stdout
    got = len(raw) // frame_bytes
    if got < len(indexes):
        raise CheckError(f"decoded {got} frames, wanted {len(indexes)}")
    frames = []
    for i in range(len(indexes)):
        chunk = raw[i * frame_bytes : (i + 1) * frame_bytes]
        frames.append(np.frombuffer(chunk, np.uint8).reshape(h, w, 3).copy())
    return frames


def decode_gray_series(path: Path, width: int = 160) -> tuple[np.ndarray, float]:
    """Downscaled gray frames for diff stats. Source file is not rewritten."""
    info = probe_video(path)
    cmd = [
        "ffmpeg",
        "-v",
        "error",
        "-i",
        str(path),
        "-vf",
        f"scale={width}:-2:flags=neighbor",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "gray",
        "-",
    ]
    proc = subprocess.run(cmd, check=False, capture_output=True)
    if proc.returncode != 0:
        raise CheckError(f"ffmpeg gray decode failed: {proc.stderr.decode(errors='replace')[:400]}")
    # Height follows ffmpeg's even rounding. Read it back from the byte count.
    n = info["frames"] or 1
    raw = proc.stdout
    if n <= 1 or len(raw) < width:
        raise CheckError("video produced no measurement frames")
    frame_bytes = len(raw) // n
    # If nb_frames was a guess, recover the count from a plausible height.
    height = frame_bytes // width
    if height < 2 or frame_bytes != width * height:
        # Fall back: one probe frame to learn height, then split.
        height = max(2, int(round(info["height"] * (width / max(info["width"], 1)))))
        if height % 2:
            height += 1
        frame_bytes = width * height
        n = len(raw) // frame_bytes
    series = np.frombuffer(raw[: n * frame_bytes], np.uint8).reshape(n, height, width)
    return series, float(info["fps"] or 0.0)


def luma(rgb: np.ndarray) -> np.ndarray:
    arr = rgb.astype(np.float32)
    return 0.2126 * arr[..., 0] + 0.7152 * arr[..., 1] + 0.0722 * arr[..., 2]


def mask_span(mask: np.ndarray) -> dict:
    rows = np.where(mask.any(axis=1))[0]
    cols = np.where(mask.any(axis=0))[0]
    if len(rows) == 0:
        return {"empty": True, "width": 0, "height": 0, "area": 0, "rows": None, "cols": None}
    y0, y1 = int(rows[0]), int(rows[-1])
    x0, x1 = int(cols[0]), int(cols[-1])
    return {
        "empty": False,
        "width": x1 - x0 + 1,
        "height": y1 - y0 + 1,
        "area": int(mask.sum()),
        "rows": [y0, y1],
        "cols": [x0, x1],
    }


def foreground(rgba: np.ndarray, key: str) -> np.ndarray:
    rgb = rgba[..., :3]
    alpha = rgba[..., 3]
    if key == "alpha":
        return alpha > 16
    if key == "green":
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        green = (g > 140) & (g > r + 40) & (g > b + 40)
        return ~green
    if key == "black":
        return luma(rgb) > UNKEYED_BLACK_LUMA
    return np.ones(rgb.shape[:2], dtype=bool)


def flood_from_border(region: np.ndarray) -> np.ndarray:
    h, w = region.shape
    seen = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()

    def push(y: int, x: int) -> None:
        if 0 <= y < h and 0 <= x < w and region[y, x] and not seen[y, x]:
            seen[y, x] = True
            q.append((y, x))

    for x in range(w):
        push(0, x)
        push(h - 1, x)
    for y in range(h):
        push(y, 0)
        push(y, w - 1)
    while q:
        y, x = q.popleft()
        push(y + 1, x)
        push(y - 1, x)
        push(y, x + 1)
        push(y, x - 1)
    return seen


def erode(mask: np.ndarray, times: int = 1) -> np.ndarray:
    out = mask.copy()
    for _ in range(times):
        nxt = out.copy()
        nxt[1:] &= out[:-1]
        nxt[:-1] &= out[1:]
        nxt[:, 1:] &= out[:, :-1]
        nxt[:, :-1] &= out[:, 1:]
        out = nxt
    return out


def declare_key(item: dict, rgba: np.ndarray, kind: str) -> str:
    if item.get("key"):
        return str(item["key"])
    alpha = rgba[..., 3]
    if int(alpha.min()) < 250:
        return "alpha"
    rgb = rgba[..., :3]
    h, w = rgb.shape[:2]
    border = np.concatenate(
        [rgb[0, :, :], rgb[-1, :, :], rgb[:, 0, :], rgb[:, -1, :]],
        axis=0,
    ).astype(np.float32)
    green = (border[:, 1] > 140) & (border[:, 1] > border[:, 0] + 40) & (border[:, 1] > border[:, 2] + 40)
    black = luma(border.reshape(-1, 1, 3)).reshape(-1) < UNKEYED_BLACK_LUMA
    if kind in {"cutout", "loop", "turntable"} and float(green.mean()) > 0.7:
        return "green"
    if kind in {"cutout", "loop", "turntable"} and float(black.mean()) > 0.7:
        # Black is not assumed. The builder must declare key=black or ship alpha.
        return "undeclared-black"
    if kind in {"cutout", "turntable"}:
        return "alpha"
    return "none"


def check_basic(info: dict, item: dict, kind: str) -> dict:
    lossless_required = bool(item.get("lossless", kind in LOSSLESS_STILL_KINDS))
    failures = []
    if not info.get("width") or not info.get("height"):
        failures.append("FAIL basic empty frame")
    if lossless_required and not info.get("lossless"):
        failures.append(
            f"FAIL basic lossless required, codec={info.get('codec')} container={info.get('container')}"
        )
    banding = info.get("bandingFraction")
    if banding is not None and banding > BANDING_FRACTION:
        failures.append(f"FAIL basic banding fraction={banding:.4f} limit={BANDING_FRACTION}")
    return {
        "status": status_of(not failures),
        "codec": info.get("codec"),
        "container": info.get("container"),
        "pixFmt": info.get("pixFmt"),
        "mode": info.get("mode"),
        "width": info.get("width"),
        "height": info.get("height"),
        "fps": info.get("fps"),
        "frames": info.get("frames"),
        "durationSec": info.get("durationSec"),
        "lossless": bool(info.get("lossless")),
        "losslessRequired": lossless_required,
        "bandingFraction": None if banding is None else r4(banding),
        "failures": failures,
    }


def banding_fraction(rgb: np.ndarray) -> float:
    """Fraction of sites that sit on a flat run and then jump by 2..12 levels."""
    y = luma(rgb)
    if y.shape[1] < 8:
        return 0.0
    d = np.abs(np.diff(y, axis=1))
    flat = d < 0.6
    step = (d >= 2.0) & (d <= 12.0)
    run = flat.copy()
    for shift in (1, 2, 3):
        prev = np.zeros_like(flat)
        prev[:, shift:] = flat[:, :-shift]
        run &= prev
    hit = step & run
    return float(hit.mean())


def check_resolution(frame_wh: tuple[int, int], mask: np.ndarray, on_screen, screen, use_mask: bool) -> dict:
    fw, fh = frame_wh
    span = mask_span(mask)
    failures = []
    if on_screen is None:
        failures.append("FAIL resolution onScreen missing; cannot prove magnification <= 1")
        mag = None
    else:
        ow, oh = float(on_screen[0]), float(on_screen[1])
        if ow > screen[0] or oh > screen[1]:
            failures.append(
                f"FAIL resolution onScreen {ow:.0f}x{oh:.0f} exceeds portrait {screen[0]}x{screen[1]}"
            )
        src_w = span["width"] if use_mask else fw
        src_h = span["height"] if use_mask else fh
        if src_w <= 0 or src_h <= 0:
            mag = None
            failures.append("FAIL resolution empty foreground; no pixels to place")
        else:
            mag = max(ow / src_w, oh / src_h)
            if mag > MAG_LIMIT:
                rows = span["rows"]
                row_txt = f" rows={rows[0]}-{rows[1]}" if rows else ""
                failures.append(
                    "FAIL resolution magnification={mag:.4f} limit={limit} "
                    "source={sw}x{sh}{rows} frame={fw}x{fh} onScreen={ow:.0f}x{oh:.0f} "
                    "fillHeight={fill:.4f}".format(
                        mag=mag,
                        limit=MAG_LIMIT,
                        sw=src_w,
                        sh=src_h,
                        rows=row_txt,
                        fw=fw,
                        fh=fh,
                        ow=ow,
                        oh=oh,
                        fill=(span["height"] / fh) if fh else 0,
                    )
                )
    fill_h = (span["height"] / fh) if fh and not span["empty"] else 0.0
    fill_a = (span["area"] / float(fw * fh)) if fw and fh and not span["empty"] else 0.0
    return {
        "status": status_of(not failures),
        "screen": [screen[0], screen[1]],
        "frame": [fw, fh],
        "onScreen": None if on_screen is None else [r4(on_screen[0]), r4(on_screen[1])],
        "mask": {
            "width": span["width"],
            "height": span["height"],
            "area": span["area"],
            "rows": span["rows"],
            "cols": span["cols"],
            "fillHeight": r4(fill_h),
            "fillArea": r4(fill_a),
        },
        "compared": "mask" if use_mask else "frame",
        "magnification": None if mag is None else r4(mag),
        "magnificationLimit": MAG_LIMIT,
        "failures": failures,
    }


def check_alpha(rgba: np.ndarray, key: str, kind: str) -> dict:
    if kind in {"tile", "backdrop", "still", "video"} and key == "none":
        return {
            "status": "PASS",
            "key": key,
            "skipped": "full-frame kind; alpha gate not applied",
            "failures": [],
        }
    rgb = rgba[..., :3].astype(np.float32)
    alpha = rgba[..., 3]
    h, w = alpha.shape
    failures = []
    mask = foreground(rgba, "alpha" if key == "alpha" else key if key in {"green", "black"} else "black")
    if key == "undeclared-black":
        mask = luma(rgb) > UNKEYED_BLACK_LUMA
    perimeter = max(1, int((mask & ~erode(mask)).sum()))
    details: dict = {"key": key, "alphaMin": int(alpha.min()), "alphaMax": int(alpha.max())}

    if key in {"alpha", "undeclared-black"}:
        opaque_black = (luma(rgb) < UNKEYED_BLACK_LUMA) & (alpha > 240)
        border_black = flood_from_border(opaque_black)
        frac = float(border_black.mean())
        details["unkeyedBlackFraction"] = r4(frac)
        if frac > UNKEYED_BLACK_FRACTION:
            failures.append(
                f"FAIL alpha unkeyed near-black fraction={frac:.4f} limit={UNKEYED_BLACK_FRACTION}"
            )
        if key == "undeclared-black":
            failures.append(
                "FAIL alpha cutout has an opaque black field and no alpha; declare key=black or key the plate"
            )

    # Solid plate: border-connected near-constant color that is not a declared full-bleed key.
    border_luma = luma(rgb)
    samples = np.concatenate(
        [rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]],
        axis=0,
    )
    bg = np.median(samples, axis=0)
    dist = np.linalg.norm(rgb - bg, axis=2)
    flat = dist < PLATE_COLOR_DIST
    plate = flood_from_border(flat)
    plate_frac = float(plate.mean())
    details["plateFraction"] = r4(plate_frac)
    details["plateColor"] = [r4(bg[0]), r4(bg[1]), r4(bg[2])]
    ys, xs = np.where(plate)
    if len(ys):
        rect_area = (ys.max() - ys.min() + 1) * (xs.max() - xs.min() + 1)
        touch = bool(ys.min() == 0 and xs.min() == 0 and ys.max() == h - 1 and xs.max() == w - 1)
        rectangularity = float(plate.sum()) / float(max(rect_area, 1))
    else:
        touch = False
        rectangularity = 0.0
    details["plateTouchesFrame"] = touch
    details["plateRectangularity"] = r4(rectangularity)
    declared_void = key == "black" and float(bg.max()) < UNKEYED_BLACK_LUMA + 8
    declared_green = key == "green" and bg[1] > bg[0] + 40 and bg[1] > bg[2] + 40
    if plate_frac > PLATE_AREA_FRACTION and rectangularity > 0.8 and not (touch and (declared_void or declared_green)):
        failures.append(
            f"FAIL alpha solid background plate fraction={plate_frac:.4f} rectangularity={rectangularity:.3f}"
        )
    if plate_frac > PLATE_AREA_FRACTION and not touch and rectangularity > 0.85:
        failures.append(
            f"FAIL alpha inset background rectangle fraction={plate_frac:.4f}"
        )

    partial = (alpha > 20) & (alpha < 240)
    thickness = float(partial.sum()) / float(perimeter)
    details["haloThicknessPx"] = r4(thickness)
    if key == "alpha" and thickness > HALO_THICKNESS_PX:
        failures.append(f"FAIL alpha halo thickness={thickness:.2f}px limit={HALO_THICKNESS_PX}")

    if key == "green":
        boundary = mask & ~erode(mask) if mask.any() else np.zeros_like(mask)
        g, r, b = rgb[..., 1], rgb[..., 0], rgb[..., 2]
        spill = boundary & (g > r + 35) & (g > b + 35) & (g > 80)
        spill_frac = float(spill.sum()) / float(max(int(boundary.sum()), 1))
        details["greenSpillFraction"] = r4(spill_frac)
        if spill_frac > GREEN_SPILL_FRACTION:
            failures.append(f"FAIL alpha green fringe fraction={spill_frac:.4f} limit={GREEN_SPILL_FRACTION}")
        # Flatness of the green field.
        green_px = (g > 140) & (g > r + 40) & (g > b + 40)
        if green_px.any():
            field_std = float(border_luma[green_px].std())
            details["greenFieldStd"] = r4(field_std)
            if field_std > 18.0:
                failures.append(f"FAIL alpha green field not flat std={field_std:.2f}")

    if key == "alpha" and int(alpha.min()) > 250 and kind in {"cutout", "turntable"}:
        failures.append("FAIL alpha cutout has no transparent pixels")

    return {"status": status_of(not failures), **details, "failures": failures}


def block_flow(a: np.ndarray, b: np.ndarray, block: int = 8, radius: int = 4) -> float:
    """Mean confident displacement in pixels of `a` (same scale as a).

    A shift counts only when it beats the zero-shift error. Flat keyed
    fields match everywhere, and that aperture problem is not motion.
    """
    h, w = a.shape
    a = a.astype(np.float32)
    b = b.astype(np.float32)
    shifts = []
    for y in range(0, h - block + 1, block):
        for x in range(0, w - block + 1, block):
            patch = a[y : y + block, x : x + block]
            zero = float(np.abs(patch - b[y : y + block, x : x + block]).mean())
            best = zero
            bd = 0.0
            for dy in range(-radius, radius + 1):
                for dx in range(-radius, radius + 1):
                    y0, x0 = y + dy, x + dx
                    if y0 < 0 or x0 < 0 or y0 + block > h or x0 + block > w:
                        continue
                    err = float(np.abs(patch - b[y0 : y0 + block, x0 : x0 + block]).mean())
                    if err < best:
                        best = err
                        bd = math.hypot(dx, dy)
            if zero - best < 2.0:
                bd = 0.0
            shifts.append(bd)
    if not shifts:
        return 0.0
    return float(np.mean(shifts))


def frame_diff_stats(series: np.ndarray) -> np.ndarray:
    if len(series) < 2:
        return np.zeros(0, np.float32)
    a = series[:-1].astype(np.float32)
    b = series[1:].astype(np.float32)
    return np.abs(a - b).mean(axis=(1, 2))


def check_loop(path: Path, info: dict, series: np.ndarray, fps: float) -> dict:
    failures = []
    frames = np.stack([series[0], series[-1]]).astype(np.float32)
    seam = np.abs(frames[0] - frames[1])
    seam_mae = float(seam.mean())
    seam_p95 = float(np.percentile(seam, 95))
    flow_small = block_flow(series[0], series[-1])
    scale = info["width"] / float(series.shape[2])
    flow_src = flow_small * scale
    diffs = frame_diff_stats(series)
    median = float(np.median(diffs)) if len(diffs) else 0.0
    pop_limit = max(POP_MAE_MIN, POP_FACTOR * median)
    pop_at = [int(i) for i, value in enumerate(diffs) if value > pop_limit]
    frozen = []
    if fps > 0 and len(diffs):
        run = 0
        for i, value in enumerate(diffs):
            if value < FROZEN_MAE:
                run += 1
                if run / fps >= FROZEN_SEC:
                    frozen.append(int(i))
            else:
                run = 0
    if seam_mae > SEAM_MAE:
        failures.append(f"FAIL loop seam MAE={seam_mae:.3f} limit={SEAM_MAE}")
    if seam_p95 > SEAM_P95:
        failures.append(f"FAIL loop seam p95={seam_p95:.3f} limit={SEAM_P95}")
    if flow_src > SEAM_FLOW_PX:
        failures.append(f"FAIL loop seam flow={flow_src:.3f}px limit={SEAM_FLOW_PX}")
    if pop_at:
        failures.append(f"FAIL loop pops at frame diffs {pop_at[:8]} maeLimit={pop_limit:.2f}")
    if frozen:
        failures.append(f"FAIL loop frozen section ending near diff {frozen[0]} ({FROZEN_SEC}s below MAE {FROZEN_MAE})")
    if info.get("frames", 0) < 2:
        failures.append("FAIL loop fewer than 2 frames")
    if not info.get("fps"):
        failures.append("FAIL loop fps unreadable")
    return {
        "status": status_of(not failures),
        "fps": info.get("fps"),
        "frames": info.get("frames"),
        "durationSec": info.get("durationSec"),
        "seamMAE": r4(seam_mae),
        "seamP95": r4(seam_p95),
        "seamFlowPx": r4(flow_src),
        "medianFrameMAE": r4(median),
        "popLimit": r4(pop_limit),
        "popFrames": pop_at[:12],
        "frozenHits": len(frozen),
        "limits": {
            "seamMAE": SEAM_MAE,
            "seamP95": SEAM_P95,
            "seamFlowPx": SEAM_FLOW_PX,
            "frozenSec": FROZEN_SEC,
        },
        "failures": failures,
    }


def silhouette_series(path: Path, key: str, max_side: int = 120) -> list[dict]:
    info = probe_video(path)
    n = int(info["frames"] or 0)
    if n < 2:
        return []
    # The whole clip, at the measurement scale. A one-frame pop must not be skipped.
    cmd = [
        "ffmpeg",
        "-v",
        "error",
        "-i",
        str(path),
        "-vf",
        f"scale={max_side}:-2:flags=neighbor",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-",
    ]
    proc = subprocess.run(cmd, check=False, capture_output=True)
    if proc.returncode != 0:
        raise CheckError("ffmpeg rgb series failed")
    width = max_side
    raw = proc.stdout
    # Recover height.
    height = 0
    count = 0
    for guess_h in range(2, max_side * 4):
        if (width * guess_h * 3) == 0:
            continue
        if len(raw) % (width * guess_h * 3) == 0:
            count = len(raw) // (width * guess_h * 3)
            if abs(count - n) <= 2 or (n > 80 and count > 10):
                height = guess_h
                break
    if height == 0:
        raise CheckError("could not split the measurement series")
    frames = np.frombuffer(raw[: count * width * height * 3], np.uint8).reshape(count, height, width, 3)
    out = []
    for frame in frames:
        rgba = np.dstack([frame, np.full((height, width), 255, np.uint8)])
        used = key if key in {"green", "black", "alpha"} else "black"
        if used == "alpha":
            used = "black"
        mask = foreground(rgba, used)
        span = mask_span(mask)
        out.append({"mask": mask, "span": span})
    return out


def mask_iou(a: np.ndarray, b: np.ndarray) -> float:
    if a.shape != b.shape:
        return 0.0
    inter = np.logical_and(a, b).sum()
    union = np.logical_or(a, b).sum()
    if union == 0:
        return 1.0
    return float(inter) / float(union)


def check_morph(path: Path, key: str) -> dict:
    series = silhouette_series(path, key)
    failures = []
    if len(series) < 2:
        return {"status": "FAIL", "failures": ["FAIL morph fewer than 2 frames"], "frames": len(series)}
    areas = [max(1, s["span"]["area"]) for s in series]
    heights = [max(1, s["span"]["height"]) for s in series]
    jumps = []
    for i in range(1, len(series)):
        area_jump = abs(areas[i] - areas[i - 1]) / float(areas[i - 1])
        height_jump = abs(heights[i] - heights[i - 1]) / float(heights[i - 1])
        iou = mask_iou(series[i - 1]["mask"], series[i]["mask"])
        bad = area_jump > MORPH_AREA_JUMP or height_jump > MORPH_HEIGHT_JUMP or iou < MORPH_IOU
        if bad:
            jumps.append(
                {
                    "index": i,
                    "areaJump": r4(area_jump),
                    "heightJump": r4(height_jump),
                    "iou": r4(iou),
                }
            )
    if jumps:
        first = jumps[0]
        failures.append(
            "FAIL morph frame {index} areaJump={areaJump} heightJump={heightJump} iou={iou}".format(**first)
        )
    area_cv = float(np.std(areas) / max(np.mean(areas), 1.0))
    return {
        "status": status_of(not failures),
        "framesMeasured": len(series),
        "areaCV": r4(area_cv),
        "heightMin": int(min(heights)),
        "heightMax": int(max(heights)),
        "jumps": jumps[:8],
        "limits": {"areaJump": MORPH_AREA_JUMP, "heightJump": MORPH_HEIGHT_JUMP, "iou": MORPH_IOU},
        "failures": failures,
    }


def edge_seam(rgb: np.ndarray, axis: str, band: int = 2) -> dict:
    arr = rgb.astype(np.float32)
    if axis == "x":
        seam = np.abs(arr[:, :band] - arr[:, -band:]).mean()
        interior = np.abs(arr[:, band : band * 2] - arr[:, :band]).mean()
    else:
        seam = np.abs(arr[:band, :] - arr[-band:, :]).mean()
        interior = np.abs(arr[band : band * 2, :] - arr[:band, :]).mean()
    ratio = float(seam) / float(max(interior, 1.0))
    return {"seam": r4(float(seam)), "interior": r4(float(interior)), "ratio": r4(ratio)}


def check_tiling(images: list[tuple[str, np.ndarray]]) -> dict:
    failures = []
    per = []
    lumas = []
    stds = []
    for name, rgba in images:
        rgb = rgba[..., :3]
        y = luma(rgb)
        sx = edge_seam(rgb, "x")
        sy = edge_seam(rgb, "y")
        per.append({"file": name, "x": sx, "y": sy, "lumaMean": r4(float(y.mean())), "lumaStd": r4(float(y.std()))})
        lumas.append(float(y.mean()))
        stds.append(float(y.std()))
        for label, seam in (("x", sx), ("y", sy)):
            if seam["ratio"] > SEAM_RATIO and seam["seam"] > SEAM_ABS:
                failures.append(
                    f"FAIL tiling {name} {label}-seam ratio={seam['ratio']:.3f} abs={seam['seam']:.2f}"
                )
    exposure = float(max(lumas) - min(lumas)) if lumas else 0.0
    contrast = float(max(stds) / max(min(stds), 1e-3)) if stds else 1.0
    if len(images) >= 2 and exposure > EXPOSURE_DELTA:
        failures.append(f"FAIL tiling exposure delta={exposure:.2f} limit={EXPOSURE_DELTA} (checkerboard risk)")
    if len(images) >= 2 and contrast > CONTRAST_RATIO:
        failures.append(f"FAIL tiling contrast ratio={contrast:.3f} limit={CONTRAST_RATIO} (checkerboard risk)")
    # Cross-variant seam: right edge of each against left edge of the next.
    cross = []
    if len(images) >= 2:
        for i in range(len(images)):
            a = images[i][1][..., :3].astype(np.float32)
            b = images[(i + 1) % len(images)][1][..., :3].astype(np.float32)
            if a.shape != b.shape:
                failures.append(f"FAIL tiling size mismatch {images[i][0]} vs {images[(i + 1) % len(images)][0]}")
                continue
            band = 2
            gap = float(np.abs(a[:, -band:] - b[:, :band]).mean())
            cross.append(r4(gap))
            if gap > SEAM_ABS * 1.5:
                failures.append(
                    f"FAIL tiling cross-seam {images[i][0]}|{images[(i + 1) % len(images)][0]} mae={gap:.2f}"
                )
    return {
        "status": status_of(not failures),
        "tiles": per,
        "exposureDelta": r4(exposure),
        "contrastRatio": r4(contrast),
        "crossSeam": cross,
        "limits": {"seamRatio": SEAM_RATIO, "seamAbs": SEAM_ABS, "exposureDelta": EXPOSURE_DELTA},
        "failures": failures,
    }


def check_backdrop(rgba: np.ndarray, on_screen, screen, webgl_max: int) -> dict:
    h, w = rgba.shape[:2]
    failures = []
    split = w > webgl_max
    if split:
        failures.append(
            f"FAIL backdrop width={w} exceeds WebGL max texture {webgl_max}; split before upload"
        )
    # Vertical use: declared on-screen height, else the portrait height.
    oh = float(on_screen[1]) if on_screen is not None else float(screen[1])
    mag_h = oh / float(h) if h else 99.0
    if mag_h > MAG_LIMIT:
        failures.append(
            f"FAIL backdrop vertical magnification={mag_h:.4f} sourceHeight={h} onScreenHeight={oh:.0f}"
        )
    seam = edge_seam(rgba[..., :3], "x")
    if seam["ratio"] > SEAM_RATIO and seam["seam"] > SEAM_ABS:
        failures.append(f"FAIL backdrop horizontal seam ratio={seam['ratio']:.3f} abs={seam['seam']:.2f}")
    return {
        "status": status_of(not failures),
        "width": w,
        "height": h,
        "webglMaxTexture": webgl_max,
        "splitNeeded": split,
        "verticalMagnification": r4(mag_h),
        "seam": seam,
        "screen": [screen[0], screen[1]],
        "failures": failures,
    }


def which_checks(kind: str, item: dict) -> set[str]:
    checks = {"basic", "resolution"}
    if kind == "cutout":
        checks.add("alpha")
    elif kind == "tile":
        checks.add("tiling")
    elif kind == "backdrop":
        checks.add("backdrop")
    elif kind == "loop":
        checks.update({"alpha", "loop"})
    elif kind == "turntable":
        checks.update({"alpha", "morph"})
        if item.get("loop", False):
            checks.add("loop")
    elif kind == "video":
        if item.get("loop"):
            checks.add("loop")
        if item.get("morph"):
            checks.add("morph")
        if item.get("key"):
            checks.add("alpha")
    elif item.get("key"):
        checks.add("alpha")
    return checks


def measure_asset(item: dict, root: Path, screen: tuple[int, int], webgl_max: int) -> dict:
    path = resolve_file(item["file"], root)
    kind = kind_of(item, path)
    result = {
        "file": item["file"],
        "kind": kind,
        "yaw": item.get("yaw"),
        "elevation": item.get("elevation", item.get("elevationDeg")),
    }
    if not path.is_file():
        result["ok"] = False
        result["checks"] = {"basic": {"status": "FAIL", "failures": [f"FAIL basic missing file {path}"]}}
        result["failures"] = result["checks"]["basic"]["failures"]
        return result
    try:
        if path.suffix.lower() in VIDEO_EXTS or kind in {"loop", "turntable", "video"} and path.suffix.lower() not in IMAGE_EXTS:
            info = probe_video(path)
            first = decode_rgb_frames(path, [0])[0]
            rgba = np.dstack([first, np.full(first.shape[:2] + (1,), 255, np.uint8)])
            info["bandingFraction"] = banding_fraction(first)
        else:
            rgba, info = open_image(path)
            info["bandingFraction"] = banding_fraction(rgba[..., :3])
    except CheckError as exc:
        result["ok"] = False
        result["checks"] = {"basic": {"status": "FAIL", "failures": [f"FAIL basic {exc.message}"]}}
        result["failures"] = result["checks"]["basic"]["failures"]
        return result

    on_screen, cam_notes = on_screen_px(item, screen)
    key = declare_key(item, rgba, kind)
    wanted = which_checks(kind, item)
    use_mask = kind in {"cutout", "loop", "turntable"} or key in {"alpha", "green", "black", "undeclared-black"}
    mask = foreground(rgba, "black" if key == "undeclared-black" else key if key in {"alpha", "green", "black"} else "none")
    checks: dict = {}
    if "basic" in wanted:
        checks["basic"] = check_basic(info, item, kind)
    if "resolution" in wanted:
        checks["resolution"] = check_resolution((info["width"], info["height"]), mask, on_screen, screen, use_mask)
        checks["resolution"].update({k: v for k, v in cam_notes.items() if k != "cameraConflict"})
        if cam_notes.get("cameraConflict"):
            checks["resolution"]["failures"].append(
                "FAIL resolution onScreen and camera projection differ by more than 10%"
            )
            checks["resolution"]["status"] = "FAIL"
    if "alpha" in wanted:
        checks["alpha"] = check_alpha(rgba, key, kind)
    if "loop" in wanted:
        series, fps = decode_gray_series(path)
        checks["loop"] = check_loop(path, info, series, fps or float(info.get("fps") or 0))
    if "morph" in wanted:
        checks["morph"] = check_morph(path, key)
    if "backdrop" in wanted:
        checks["backdrop"] = check_backdrop(rgba, on_screen, screen, webgl_max)
    # Tiling of a single file is stored; the batch pass may replace it.
    if "tiling" in wanted and kind == "tile":
        checks["tiling"] = {"status": "PASS", "deferred": True, "failures": []}
    failures = []
    for name, check in checks.items():
        failures.extend(check.get("failures") or [])
    result["checks"] = checks
    result["failures"] = failures
    result["ok"] = not failures
    result["_rgba"] = rgba
    return result


def measure_manifest(manifest: dict, root: Path) -> dict:
    screen = screen_of(manifest)
    webgl_max = webgl_max_of(manifest)
    assets = []
    tiles: list[tuple[str, np.ndarray, int]] = []
    for index, item in enumerate(manifest["assets"]):
        measured = measure_asset(item, root, screen, webgl_max)
        rgba = measured.pop("_rgba", None)
        if measured["kind"] == "tile" and rgba is not None:
            tiles.append((measured["file"], rgba, index))
        assets.append(measured)
    if len(tiles) >= 1:
        group = check_tiling([(name, rgba) for name, rgba, _ in tiles])
        for nth, (name, rgba, index) in enumerate(tiles):
            if nth == 0:
                assets[index]["checks"]["tiling"] = group
            else:
                assets[index]["checks"]["tiling"] = {
                    "status": group["status"],
                    "sharedWith": tiles[0][0],
                    "failures": [],
                }
        if group["status"] == "FAIL":
            index = tiles[0][2]
            assets[index]["failures"] = [
                line for line in assets[index]["failures"] if not line.startswith("FAIL tiling")
            ] + list(group["failures"])
            assets[index]["ok"] = False
    failures = []
    for asset in assets:
        for line in asset["failures"]:
            failures.append(f"{asset['file']}: {line}")
    return {
        "tool": "assetcheck",
        "ok": not failures,
        "screen": [screen[0], screen[1]],
        "webglMaxTexture": webgl_max,
        "heuristics": HEURISTICS,
        "assets": assets,
        "failures": failures,
    }


def to_markdown(report: dict) -> str:
    lines = [
        "# assetcheck",
        "",
        f"Result: **{'PASS' if report['ok'] else 'FAIL'}**",
        "",
        f"Screen {report['screen'][0]}×{report['screen'][1]}. WebGL max texture {report['webglMaxTexture']}.",
        "",
        "A hand-written PASS is not a PASS. This file is the gate.",
        "",
    ]
    for asset in report["assets"]:
        lines.append(f"## {asset['file']}")
        lines.append("")
        lines.append(f"Kind `{asset['kind']}`. Asset **{'PASS' if asset['ok'] else 'FAIL'}**.")
        lines.append("")
        for name, check in asset.get("checks", {}).items():
            if check.get("deferred"):
                continue
            lines.append(f"### {name} — {check.get('status')}")
            lines.append("")
            for key, value in check.items():
                if key in {"status", "failures", "tiles"}:
                    continue
                lines.append(f"- {key}: `{value}`")
            for failure in check.get("failures") or []:
                lines.append(f"- {failure}")
            lines.append("")
    if report["failures"]:
        lines.append("## Failures")
        lines.append("")
        for line in report["failures"]:
            lines.append(f"- {line}")
        lines.append("")
    lines.append("## Heuristics")
    lines.append("")
    for note in report.get("heuristics") or []:
        lines.append(f"- {note}")
    lines.append("")
    return "\n".join(lines)

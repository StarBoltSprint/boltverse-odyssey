#!/usr/bin/env python3
"""Synthetic gates plus the real files this repo actually has.

  python3 tools/assetcheck/selftest.py
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
TOOL = ROOT / "tools" / "assetcheck"
SAMPLES = TOOL / "samples"
PY = sys.executable


def run(manifest: Path, out: Path) -> tuple[int, dict]:
    if out.exists():
        shutil.rmtree(out)
    proc = subprocess.run(
        [PY, str(TOOL / "check.py"), "--manifest", str(manifest), "--out", str(out)],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    report_path = out / "report.json"
    report = json.loads(report_path.read_text()) if report_path.is_file() else {"ok": False, "failures": [proc.stderr]}
    return proc.returncode, report


def save_png(path: Path, rgba: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, "RGBA" if rgba.shape[2] == 4 else "RGB").save(path, "PNG")


def ellipse(h: int, w: int, cy: float, cx: float, ry: float, rx: float, color: tuple[int, int, int]) -> np.ndarray:
    ys, xs = np.mgrid[0:h, 0:w]
    mask = ((ys - cy) / ry) ** 2 + ((xs - cx) / rx) ** 2 <= 1.0
    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[mask, 0] = color[0]
    rgba[mask, 1] = color[1]
    rgba[mask, 2] = color[2]
    rgba[mask, 3] = 255
    return rgba


def write_video(path: Path, frames: list[np.ndarray], fps: int = 12, lossless: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    h, w, _ = frames[0].shape
    raw = np.stack([f[..., :3] for f in frames]).astype(np.uint8).tobytes()
    cmd = [
        "ffmpeg",
        "-y",
        "-v",
        "error",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-s",
        f"{w}x{h}",
        "-r",
        str(fps),
        "-i",
        "-",
        "-an",
    ]
    if lossless:
        cmd += ["-c:v", "libx264", "-qp", "0", "-pix_fmt", "yuv444p"]
    else:
        cmd += ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18"]
    cmd.append(str(path))
    proc = subprocess.run(cmd, input=raw, check=False, capture_output=True)
    if proc.returncode != 0:
        raise SystemExit(proc.stderr.decode()[:500])


def circle_frame(h: int, w: int, cx: int, cy: int, radius: int, key: str = "green") -> np.ndarray:
    ys, xs = np.mgrid[0:h, 0:w]
    blob = (ys - cy) ** 2 + (xs - cx) ** 2 <= radius ** 2
    rgb = np.zeros((h, w, 3), np.uint8)
    if key == "green":
        rgb[..., 1] = 255
    rgb[blob] = (210, 40, 36)
    return rgb


def manifest(folder: Path, assets: list[dict]) -> Path:
    path = folder / "manifest.json"
    path.write_text(json.dumps({"screen": [720, 1600], "webglMaxTexture": 4096, "assets": assets}, indent=2) + "\n")
    return path


def expect(code: int, report: dict, ok: bool, needle: str | None = None) -> None:
    if report.get("ok") is not ok or (code == 0) is not ok:
        text = "\n".join(report.get("failures") or [])
        raise SystemExit(f"expected ok={ok} code, got code={code} ok={report.get('ok')}\n{text}")
    if needle:
        blob = "\n".join(report.get("failures") or [])
        if needle not in blob and ok is False:
            raise SystemExit(f"expected failure containing {needle!r}\n{blob}")


def case_good_cutout(src: Path) -> None:
    img = ellipse(320, 200, 150, 100, 110, 70, (180, 90, 40))
    save_png(src / "good-cutout.png", img)
    manifest(src, [{"file": "good-cutout.png", "kind": "cutout", "onScreen": [80, 120], "key": "alpha", "yaw": 0, "elevation": 0}])


def case_black_plate(src: Path) -> None:
    img = ellipse(320, 200, 160, 100, 70, 50, (180, 90, 40))
    img[..., 3] = 255
    save_png(src / "black-plate.png", img)
    manifest(src, [{"file": "black-plate.png", "kind": "cutout", "onScreen": [40, 60]}])


def case_halo(src: Path) -> None:
    h, w = 240, 180
    ys, xs = np.mgrid[0:h, 0:w]
    dist = np.sqrt((ys - 120) ** 2 + (xs - 90) ** 2)
    alpha = np.clip((78 - dist) * (255 / 12.0), 0, 255).astype(np.uint8)
    rgb = np.zeros((h, w, 3), np.uint8)
    rgb[..., 0] = 200
    rgb[..., 1] = 80
    rgba = np.dstack([rgb, alpha])
    save_png(src / "halo.png", rgba)
    manifest(src, [{"file": "halo.png", "kind": "cutout", "onScreen": [40, 50], "key": "alpha"}])


def case_small_mask(src: Path) -> None:
    img = np.zeros((900, 640, 4), np.uint8)
    img[377:597, 250:390, 0] = 220
    img[377:597, 250:390, 3] = 255
    save_png(src / "small-mask.png", img)
    manifest(src, [{"file": "small-mask.png", "kind": "cutout", "onScreen": [200, 700], "key": "alpha"}])


def case_smooth_still(src: Path) -> None:
    ramp = np.tile(np.arange(160, dtype=np.uint8), (96, 1))
    rgb = np.dstack([ramp, ramp, ramp])
    save_png(src / "smooth.png", rgb)
    manifest(src, [{"file": "smooth.png", "kind": "still", "onScreen": [100, 60]}])


def case_banded_jpeg(src: Path) -> None:
    ramp = ((np.arange(160) // 8) * 8).astype(np.uint8)
    rgb = np.dstack([np.tile(ramp, (96, 1))] * 3)
    path = src / "banded.jpg"
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgb, "RGB").save(path, "JPEG", quality=20)
    manifest(src, [{"file": "banded.jpg", "kind": "still", "onScreen": [80, 40]}])


def periodic_tile(shift: float, gain: float = 1.0) -> np.ndarray:
    ys, xs = np.mgrid[0:64, 0:64]
    wave = 0.55 + 0.35 * np.sin(2 * np.pi * (xs + shift) / 64.0) * np.cos(2 * np.pi * ys / 64.0)
    detail = 10.0 * np.sin(4 * 2 * np.pi * xs / 64.0)
    base = np.clip(wave * gain, 0, 1)
    rgb = np.zeros((64, 64, 3), np.uint8)
    rgb[..., 0] = np.clip(base * 170 + detail, 0, 255)
    rgb[..., 1] = np.clip(base * 130 + 20, 0, 255)
    rgb[..., 2] = np.clip(base * 80, 0, 255)
    return rgb


def case_tiles_good(src: Path) -> None:
    assets = []
    for i in range(4):
        name = f"tile-{i}.png"
        save_png(src / name, periodic_tile(i * 0.4))
        assets.append({"file": name, "kind": "tile", "onScreen": [48, 48]})
    manifest(src, assets)


def case_tiles_exposure(src: Path) -> None:
    assets = []
    for i, gain in enumerate((1.0, 1.0, 1.0, 2.4)):
        name = f"tile-{i}.png"
        save_png(src / name, periodic_tile(0.2, gain))
        assets.append({"file": name, "kind": "tile", "onScreen": [48, 48]})
    manifest(src, assets)


def case_tiles_seam(src: Path) -> None:
    rgb = periodic_tile(0.0)
    rgb[:, -3:] = (10, 10, 10)
    save_png(src / "seam.png", rgb)
    manifest(src, [{"file": "seam.png", "kind": "tile", "onScreen": [48, 48]}])


def case_backdrop_wide(src: Path) -> None:
    rgb = np.zeros((48, 4200, 3), np.uint8)
    rgb[..., 1] = 40
    rgb[..., 2] = 70
    xs = np.arange(4200)
    rgb[..., 0] = (np.sin(2 * np.pi * xs / 4200.0) * 20 + 30).astype(np.uint8)
    save_png(src / "ring.png", rgb)
    manifest(src, [{"file": "ring.png", "kind": "backdrop", "onScreen": [720, 30]}])


def case_backdrop_short(src: Path) -> None:
    rgb = np.zeros((80, 1024, 3), np.uint8)
    rgb[..., 0] = 20
    save_png(src / "short.png", rgb)
    manifest(src, [{"file": "short.png", "kind": "backdrop", "onScreen": [400, 600]}])


def case_loop_good(src: Path) -> None:
    frames = []
    for i in range(12):
        dx = int(round(6 * np.sin(2 * np.pi * i / 12.0)))
        frames.append(circle_frame(96, 64, 32 + dx, 48, 18))
    write_video(src / "loop.mp4", frames, fps=12, lossless=True)
    manifest(src, [{"file": "loop.mp4", "kind": "loop", "key": "green", "onScreen": [20, 24], "loop": True}])


def case_loop_jump(src: Path) -> None:
    frames = [circle_frame(96, 64, 24, 48, 16) for _ in range(8)]
    frames.append(circle_frame(96, 64, 48, 48, 16))
    write_video(src / "jump.mp4", frames, fps=12, lossless=True)
    manifest(src, [{"file": "jump.mp4", "kind": "loop", "key": "green", "onScreen": [16, 20], "loop": True}])


def case_loop_frozen(src: Path) -> None:
    frames = [circle_frame(96, 64, 30, 48, 16) for _ in range(10)]
    write_video(src / "frozen.mp4", frames, fps=8, lossless=True)
    manifest(src, [{"file": "frozen.mp4", "kind": "loop", "key": "green", "onScreen": [16, 20], "loop": True}])


def case_locked_flag(src: Path) -> None:
    img = ellipse(320, 200, 160, 100, 70, 50, (180, 90, 40))
    img[..., 3] = 255
    save_png(src / "plate.png", img)
    manifest(src, [{"file": "plate.png", "kind": "cutout", "onScreen": [40, 60], "locked": True}])


def case_lock_dir(src: Path) -> None:
    img = ellipse(320, 200, 160, 100, 70, 50, (180, 90, 40))
    img[..., 3] = 255
    save_png(src / "lock" / "plate.png", img)
    manifest(src, [{"file": "lock/plate.png", "kind": "cutout", "onScreen": [40, 60]}])


def case_mixed(src: Path) -> None:
    img = ellipse(320, 200, 160, 100, 70, 50, (180, 90, 40))
    img[..., 3] = 255
    save_png(src / "lock" / "plate.png", img)
    ramp = ((np.arange(160) // 8) * 8).astype(np.uint8)
    rgb = np.dstack([np.tile(ramp, (96, 1))] * 3)
    Image.fromarray(rgb, "RGB").save(src / "banded.jpg", "JPEG", quality=20)
    manifest(
        src,
        [
            {"file": "lock/plate.png", "kind": "cutout", "onScreen": [40, 60]},
            {"file": "banded.jpg", "kind": "still", "onScreen": [80, 40]},
        ],
    )


def case_morph(src: Path) -> None:
    frames = [circle_frame(96, 64, 32, 48, 16, key="black") for _ in range(6)]
    frames[3] = circle_frame(96, 64, 32, 48, 30, key="black")
    write_video(src / "morph.mp4", frames, fps=12, lossless=True)
    manifest(src, [{"file": "morph.mp4", "kind": "turntable", "key": "black", "onScreen": [16, 20]}])


CASES = [
    ("good-cutout", case_good_cutout, True, None),
    ("black-plate", case_black_plate, False, "alpha"),
    ("halo", case_halo, False, "halo"),
    ("small-mask", case_small_mask, False, "resolution"),
    ("smooth-still", case_smooth_still, True, None),
    ("banded-jpeg", case_banded_jpeg, False, "lossless"),
    ("tiles-good", case_tiles_good, True, None),
    ("tiles-exposure", case_tiles_exposure, False, "exposure"),
    ("tiles-seam", case_tiles_seam, False, "seam"),
    ("backdrop-wide", case_backdrop_wide, False, "split"),
    ("backdrop-short", case_backdrop_short, False, "vertical"),
    ("loop-good", case_loop_good, True, None),
    ("loop-jump", case_loop_jump, False, "loop"),
    ("loop-frozen", case_loop_frozen, False, "frozen"),
    ("morph-pop", case_morph, False, "morph"),
    ("locked-flag", case_locked_flag, True, None),
    ("lock-dir", case_lock_dir, True, None),
    ("mixed-lock", case_mixed, False, "lossless"),
]


def assert_grandfather(name: str, code: int, report: dict) -> None:
    warnings = "\n".join(report.get("warnings") or [])
    failures = "\n".join(report.get("failures") or [])
    if name in {"locked-flag", "lock-dir"}:
        if code != 0 or not report.get("ok") or failures or "WARN alpha" not in warnings:
            raise SystemExit(f"{name} should WARN and exit 0\n{warnings}\n{failures}")
        for asset in report["assets"]:
            if not asset.get("locked") or asset.get("failures"):
                raise SystemExit(f"{name} asset not grandfathered: {asset.get('file')}")
            for check in asset.get("checks", {}).values():
                if check.get("status") == "FAIL":
                    raise SystemExit(f"{name} still FAILs {check}")
    if name == "mixed-lock":
        if code == 0 or report.get("ok"):
            raise SystemExit("mixed-lock: an unlocked FAIL must still exit non-zero")
        if "lock/plate.png" in failures or "WARN" not in warnings:
            raise SystemExit(f"mixed-lock split wrong\nWARN {warnings}\nFAIL {failures}")
    if name == "real-gallop":
        if code != 0 or not report.get("ok") or failures:
            raise SystemExit(f"gallop lock must not FAIL\n{failures}")
        if "WARN loop" not in warnings:
            raise SystemExit(warnings or "gallop produced no WARN")
    if name == "real-bolt-back":
        if code != 0 or not report.get("ok") or failures:
            raise SystemExit(f"bolt-back lock must not FAIL\n{failures}")
        if "WARN basic" not in warnings:
            raise SystemExit(warnings or "bolt-back produced no WARN")
    if name == "real-ship-depth":
        if code == 0 or report.get("ok"):
            raise SystemExit("ship-depth is outside lock/ and must still FAIL")


def real_cases(tmp: Path) -> None:
    jobs = [
        (
            "real-gallop",
            [
                {
                    "file": "lock/bolt-gallop-cycle.mp4",
                    "kind": "loop",
                    "key": "green",
                    "onScreen": [180, 280],
                    "loop": True,
                }
            ],
            ROOT,
        ),
        (
            "real-bolt-back",
            [{"file": "lock/bolt-back.jpg", "kind": "still", "onScreen": [200, 360]}],
            ROOT,
        ),
        (
            "real-ship-depth",
            [{"file": "biome/void-orbit/stills/ship-depth.png", "kind": "still", "onScreen": [200, 200]}],
            ROOT,
        ),
    ]
    for name, assets, root in jobs:
        dest = SAMPLES / name
        if dest.exists():
            shutil.rmtree(dest)
        dest.mkdir(parents=True)
        rewritten = []
        for asset in assets:
            item = dict(asset)
            item["file"] = os_path_rel(dest.resolve(), (root / asset["file"]).resolve())
            rewritten.append(item)
        path = manifest(dest, rewritten)
        code, report = run(path, tmp / name / "out")
        assert_grandfather(name, code, report)
        print(
            f"real {name} exit={code} ok={report.get('ok')} "
            f"failures={len(report.get('failures') or [])} warnings={len(report.get('warnings') or [])}"
        )
        for line in (report.get("failures") or report.get("warnings") or [])[:8]:
            print(" ", line)
        shutil.copy(tmp / name / "out" / "report.json", dest / "report.json")
        shutil.copy(tmp / name / "out" / "report.md", dest / "report.md")


def os_path_rel(start: Path, target: Path) -> str:
    try:
        return str(target.relative_to(start))
    except ValueError:
        pass
    # Manual walk-up so the sample manifest stays portable.
    ups = 0
    cursor = start
    while True:
        try:
            rel = target.relative_to(cursor)
            return str(Path(*([".."] * ups)) / rel) if ups else str(rel)
        except ValueError:
            if cursor.parent == cursor:
                return str(target)
            cursor = cursor.parent
            ups += 1


def main() -> None:
    tmp = Path("/tmp/assetcheck-selftest")
    if tmp.exists():
        shutil.rmtree(tmp)
    tmp.mkdir()
    SAMPLES.mkdir(parents=True, exist_ok=True)
    for name, builder, ok, needle in CASES:
        src = tmp / name / "src"
        src.mkdir(parents=True)
        builder(src)
        code, report = run(src / "manifest.json", tmp / name / "out")
        expect(code, report, ok, needle)
        assert_grandfather(name, code, report)
        dest = SAMPLES / name
        if dest.exists():
            shutil.rmtree(dest)
        dest.mkdir()
        shutil.copy(tmp / name / "out" / "report.json", dest / "report.json")
        shutil.copy(tmp / name / "out" / "report.md", dest / "report.md")
        print(f"selftest {name} ok={ok}")
    real_cases(tmp)
    print("PASS assetcheck selftest")


if __name__ == "__main__":
    main()

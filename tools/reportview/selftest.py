#!/usr/bin/env python3
"""Synthetic fixtures for the phone report page. Stdlib plus ffmpeg for the clip."""

from __future__ import annotations

import json
import shutil
import struct
import subprocess
import sys
import tempfile
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BUILD = ROOT / "build.py"
SAMPLE = ROOT / "sample"

PASS_URL = "https://example.invalid/play/sample-pass"
FAIL_URL = "https://example.invalid/play/sample-fail"


def main() -> int:
    write_case("pass", SAMPLE / "pass", PASS_URL)
    write_case("fail", SAMPLE / "fail", FAIL_URL)
    check_page(SAMPLE / "pass" / "index.html", "PASS", PASS_URL, fail_chips=False, not_run=False)
    check_page(SAMPLE / "fail" / "index.html", "FAIL", FAIL_URL, fail_chips=True, not_run=False)
    html_fail = (SAMPLE / "fail" / "index.html").read_text(encoding="utf-8")
    assert 'class="chip WARN"' in html_fail
    assert "lock/" in html_fail
    assert "WARN is not a FAIL" in html_fail
    assert "0.54" in html_fail
    assert "1.25" in html_fail
    html_pass = (SAMPLE / "pass" / "index.html").read_text(encoding="utf-8")
    assert "near/far range: not recorded" in html_pass
    assert "refinement png" in html_pass
    assert "vertices 12000" in html_pass
    assert "faces 24000" in html_pass
    assert "smooth iters 8" in html_pass
    assert "spur" in html_pass
    assert "measured 0.5 · limit 1" in html_pass
    assert "<video controls playsinline" in html_pass
    assert "debug-topdown.png" in html_pass
    assert "ring_closed" in html_pass
    assert "clearing.json id sample-zone" in html_pass
    assert "<script" not in html_pass
    assert "cdn." not in html_pass
    warn_only()
    incomplete()
    bad_flag()
    stable()
    print("PASS reportview selftest")
    return 0


def write_case(kind: str, out: Path, play_url: str) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        take = Path(tmp) / "take"
        build_take(take, kind)
        if out.exists():
            shutil.rmtree(out)
        proc = subprocess.run(
            [
                sys.executable,
                str(BUILD),
                "--take",
                f"sample-{kind}",
                "--take-dir",
                str(take),
                "--play-url",
                play_url,
                "--date",
                "2026-10-01",
                "--out",
                str(out),
            ],
            check=False,
            text=True,
            capture_output=True,
        )
        if proc.returncode != 0:
            sys.stderr.write(proc.stdout + proc.stderr)
            raise SystemExit(f"build failed for {kind}")
        expected = "FAIL" if kind == "fail" else "PASS"
        if not proc.stdout.startswith(expected + " "):
            raise SystemExit(f"unexpected build line: {proc.stdout!r}")


def check_page(path: Path, verdict: str, play_url: str, fail_chips: bool, not_run: bool) -> None:
    text = path.read_text(encoding="utf-8")
    if f'data-verdict="{verdict}"' not in text:
        raise SystemExit(f"{path} verdict is not {verdict}")
    if play_url not in text:
        raise SystemExit(f"{path} missing play URL")
    if ('class="chip FAIL"' in text) != fail_chips:
        raise SystemExit(f"{path} FAIL chips expected={fail_chips}")
    if ('class="chip NOTRUN"' in text) != not_run:
        raise SystemExit(f"{path} NOT RUN expected={not_run}")
    if "<script" in text or "cdn." in text:
        raise SystemExit(f"{path} is not self-contained")
    for token in ("http://", "https://"):
        if token in text.replace(play_url, ""):
            raise SystemExit(f"{path} has an external URL other than the play URL")
    for src in _srcs(text):
        if src.startswith(("http://", "https://", "//")):
            raise SystemExit(f"external asset {src}")
        if not (path.parent / src).is_file():
            raise SystemExit(f"missing copied asset {src}")


def _srcs(text: str) -> list[str]:
    out = []
    for needle in ('src="', "src='"):
        start = 0
        while True:
            i = text.find(needle, start)
            if i < 0:
                break
            j = text.find(needle[-1], i + len(needle))
            out.append(text[i + len(needle) : j])
            start = j + 1
    return out


def warn_only() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        take = Path(tmp) / "take"
        out = Path(tmp) / "out"
        build_take(take, "pass")
        report_path = take / "assetcheck" / "report.json"
        report = json.loads(report_path.read_text(encoding="utf-8"))
        asset = report["assets"][0]
        asset["locked"] = True
        asset["lockReason"] = "lock/"
        asset["file"] = "lock/plate.png"
        asset["checks"]["alpha"]["status"] = "WARN"
        asset["checks"]["alpha"]["warnings"] = ["WARN alpha unkeyed near-black fraction=0.8 limit=0.02"]
        asset["warnings"] = asset["checks"]["alpha"]["warnings"]
        asset["ok"] = True
        report["ok"] = True
        report["warnings"] = ["lock/plate.png: WARN alpha unkeyed near-black fraction=0.8 limit=0.02"]
        report_path.write_text(json.dumps(report), encoding="utf-8")
        proc = subprocess.run(
            [sys.executable, str(BUILD), "--take", "warn-only", "--take-dir", str(take), "--date", "2026-10-01", "--out", str(out)],
            check=False,
            text=True,
            capture_output=True,
        )
        if proc.returncode != 0 or not proc.stdout.startswith("WARN "):
            raise SystemExit(f"warn-only failed: {proc.stdout} {proc.stderr}")
        text = (out / "index.html").read_text(encoding="utf-8")
        if 'data-verdict="WARN"' not in text or 'class="chip FAIL"' in text:
            raise SystemExit("a lock/ WARN was counted as FAIL")


def incomplete() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        take = Path(tmp) / "take"
        out = Path(tmp) / "out"
        build_take(take, "pass")
        shutil.rmtree(take / "playcheck")
        proc = subprocess.run(
            [sys.executable, str(BUILD), "--take", "partial", "--take-dir", str(take), "--date", "2026-10-01", "--out", str(out)],
            check=False,
            text=True,
            capture_output=True,
        )
        if proc.returncode != 0 or not proc.stdout.startswith("INCOMPLETE "):
            raise SystemExit(f"incomplete failed: {proc.stdout} {proc.stderr}")
        text = (out / "index.html").read_text(encoding="utf-8")
        if 'data-verdict="INCOMPLETE"' not in text or 'class="chip NOTRUN"' not in text:
            raise SystemExit("missing playcheck was not NOT RUN")
        if 'data-verdict="PASS"' in text:
            raise SystemExit("missing section was marked PASS")


def bad_flag() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        proc = subprocess.run(
            [sys.executable, str(BUILD), "--take", "x", "--assetcheck", str(Path(tmp) / "nope"), "--out", str(Path(tmp) / "out")],
            check=False,
            text=True,
            capture_output=True,
        )
        if proc.returncode != 2:
            raise SystemExit(f"missing directory should exit 2, got {proc.returncode}")


def stable() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "again"
        write_case("pass", out, PASS_URL)
        a = (SAMPLE / "pass" / "index.html").read_bytes()
        b = (out / "index.html").read_bytes()
        if a != b:
            raise SystemExit("sample pass page is not stable")


def build_take(take: Path, kind: str) -> None:
    take.mkdir(parents=True)
    write_png(take / "cutout.png", 48, 64, (210, 210, 210))
    write_png(take / "lock" / "plate.png", 48, 64, (20, 20, 20))
    # The fail still is named like a jpeg in the report; the bytes are a PNG
    # so the page can show a thumbnail. The report's codec field is what it displays.
    write_mp4(take / "loop.mp4")
    asset_dir = take / "assetcheck"
    asset_dir.mkdir()
    (asset_dir / "report.json").write_text(json.dumps(asset_report(take, kind)), encoding="utf-8")
    for name, iou, area in object_specs(kind):
        od = take / "objsheet" / name
        od.mkdir(parents=True)
        write_png(od / "sheet.png", 180, 48, (80, 120, 140))
        for i in range(8):
            write_png(od / f"yaw-{i * 45:03d}.png", 32, 40, (40 + i * 20, 90, 70))
        (od / "report.json").write_text(json.dumps(sheet_report(name, iou, area)), encoding="utf-8")
        wd = take / "walkaround" / name
        (wd / "views").mkdir(parents=True)
        (wd / "qc").mkdir()
        for i in range(8):
            shutil.copyfile(od / f"yaw-{i * 45:03d}.png", wd / "views" / f"yaw-{i * 45:03d}.png")
        (wd / "qc" / "report.json").write_text(json.dumps(walk_report(name, kind)), encoding="utf-8")
    layout = take / "layout"
    layout.mkdir()
    write_png(layout / "debug-topdown.png", 160, 160, (230, 230, 220))
    (layout / "clearing.json").write_text(json.dumps({"id": "sample-zone", "gates": [{"id": "gate-a"}]}), encoding="utf-8")
    (layout / "report.json").write_text(json.dumps(layout_report(kind)), encoding="utf-8")
    play = take / "playcheck"
    (play / "stills").mkdir(parents=True)
    for name, color in (("01-spawn.png", (70, 80, 90)), ("03-gate-end.png", (90, 80, 60)), ("07-idle.png", (60, 90, 80))):
        write_png(play / "stills" / name, 36, 80, color)
    write_mp4(play / "walk.mp4")
    (play / "report.json").write_text(json.dumps(play_report(kind)), encoding="utf-8")


def object_specs(kind: str):
    if kind == "fail":
        return [("wreck", 0.54, 0.4), ("monolith", 0.99, 0.02)]
    return [("wreck", 0.99, 0.02), ("monolith", 0.991, 0.01)]


def asset_report(take: Path, kind: str) -> dict:
    cutout = asset(
        "cutout.png",
        "cutout",
        basic={"codec": "png", "width": 200, "height": 320, "status": "PASS", "lossless": True, "losslessRequired": True, "bandingFraction": 0.0},
        resolution={"status": "PASS", "magnification": 0.5, "magnificationLimit": 1.0, "frame": [200, 320], "onScreen": [80, 120], "compared": "mask"},
        alpha={"status": "PASS", "key": "alpha", "plateFraction": 0.4, "haloThicknessPx": 0.0, "unkeyedBlackFraction": 0.0},
    )
    loop = asset(
        "loop.mp4",
        "loop",
        basic={"codec": "h264", "width": 64, "height": 36, "status": "PASS", "lossless": False, "losslessRequired": False, "bandingFraction": 0.0, "fps": 12, "frames": 8, "durationSec": 0.2},
        resolution={"status": "PASS", "magnification": 0.8, "magnificationLimit": 1.0, "frame": [64, 36], "onScreen": [40, 20], "compared": "mask"},
        alpha={"status": "PASS", "key": "green", "plateFraction": 0.7, "haloThicknessPx": 0.0, "greenSpillFraction": 0.01},
        loop={
            "status": "PASS",
            "seamMAE": 2.0,
            "seamP95": 4.0,
            "seamFlowPx": 0.2,
            "frozenHits": 0,
            "popLimit": 18.0,
            "limits": {"seamMAE": 8.0, "seamP95": 28.0, "seamFlowPx": 2.0, "frozenSec": 0.4},
        },
    )
    assets = [cutout, loop]
    failures = []
    warnings = []
    ok = True
    if kind == "fail":
        locked = asset(
            "lock/plate.png",
            "cutout",
            locked=True,
            lock_reason="lock/",
            basic={"codec": "png", "width": 200, "height": 320, "status": "PASS", "lossless": True, "losslessRequired": True, "bandingFraction": 0.0},
            resolution={"status": "PASS", "magnification": 0.4, "magnificationLimit": 1.0, "frame": [200, 320], "onScreen": [40, 60], "compared": "mask"},
            alpha={
                "status": "WARN",
                "key": "undeclared-black",
                "plateFraction": 0.82,
                "haloThicknessPx": 0.0,
                "unkeyedBlackFraction": 0.82,
                "warnings": ["WARN alpha unkeyed near-black fraction=0.82 limit=0.02"],
            },
        )
        locked["warnings"] = locked["checks"]["alpha"]["warnings"]
        locked["ok"] = True
        bad = asset(
            "banded.jpg",
            "still",
            basic={
                "status": "FAIL",
                "codec": "jpeg",
                "width": 160,
                "height": 96,
                "lossless": False,
                "losslessRequired": True,
                "bandingFraction": 0.0,
                "failures": ["FAIL basic lossless required, codec=jpeg container=jpg"],
            },
            resolution={"status": "PASS", "magnification": 0.5, "magnificationLimit": 1.0, "frame": [160, 96], "onScreen": [80, 40], "compared": "frame"},
        )
        bad["ok"] = False
        bad["failures"] = bad["checks"]["basic"]["failures"]
        assets = [locked, bad]
        ok = False
        failures = ["banded.jpg: FAIL basic lossless required, codec=jpeg container=jpg"]
        warnings = ["lock/plate.png: WARN alpha unkeyed near-black fraction=0.82 limit=0.02"]
    return {
        "tool": "assetcheck",
        "ok": ok,
        "screen": [720, 1600],
        "assets": assets,
        "failures": failures,
        "warnings": warnings,
    }


def asset(file, kind, basic, resolution, alpha=None, loop=None, locked=False, lock_reason=None) -> dict:
    checks = {"basic": basic, "resolution": resolution}
    if alpha is not None:
        checks["alpha"] = alpha
    if loop is not None:
        checks["loop"] = loop
    ok = all(c.get("status") != "FAIL" for c in checks.values())
    return {
        "file": file,
        "kind": kind,
        "locked": locked,
        "lockReason": lock_reason,
        "checks": checks,
        "failures": [],
        "ok": ok,
    }


def sheet_report(name: str, iou: float, area_delta: float) -> dict:
    files = [f"yaw-{i * 45:03d}.png" for i in range(8)]
    guide_status = "PASS" if iou >= 0.97 else "FAIL"
    cons_status = "PASS" if area_delta <= 0.15 else "FAIL"
    ok = guide_status == "PASS" and cons_status == "PASS"
    views = []
    guide_views = []
    adjacent = []
    keep_views = []
    for i, fname in enumerate(files):
        views.append({"file": fname, "width": 160, "height": 200, "yawDeg": i * 45.0, "elevationDeg": None})
        guide_views.append({"file": fname, "yawDeg": i * 45.0, "iou": iou, "note": None})
        adjacent.append({
            "a": fname,
            "b": files[(i + 1) % 8],
            "yawA": i * 45.0,
            "yawB": ((i + 1) % 8) * 45.0,
            "areaDelta": area_delta,
            "heightDelta": 0.0,
            "colorCorr": 0.8,
            "colorDist": 12.0,
        })
        keep_views.append({"file": fname, "yawDeg": i * 45.0, "keepFraction": 0.99, "horizontal": True})
    failures = []
    if guide_status == "FAIL":
        failures.append(f"FAIL guide {files[0]} IoU={iou} limit=0.97")
    obj = {
        "name": name,
        "ok": ok,
        "views": views,
        "silhouette": {"status": "PASS", "views": [{"file": files[0], "fillArea": 0.34, "height": 136}], "failures": []},
        "ring": {"status": "PASS", "yaws": [i * 45 for i in range(8)], "missing": [], "failures": []},
        "consistency": {
            "status": cons_status,
            "adjacent": adjacent,
            "limits": {"area": 0.15, "height": 0.08, "oppositeWidth": 0.15, "oppositeHeight": 0.08, "colorCorr": 0.2, "colorDist": 110.0},
            "failures": [],
        },
        "guide": {"status": guide_status, "views": guide_views, "limit": 0.97, "failures": failures},
        "hull": {
            "status": "PASS",
            "vote": 7,
            "meanKeep": 0.99,
            "minKeep": 0.99,
            "limits": {"minKeep": 0.7, "meanKeep": 0.8},
            "views": keep_views,
            "failures": [],
        },
        "failures": failures,
    }
    return {"tool": "objsheet", "ok": ok, "sheet": "sheet.png", "objects": [obj]}


def walk_report(name: str, kind: str) -> dict:
    per = []
    mag = 0.94
    ok = True
    failures = []
    depth = "png"
    if kind == "fail" and name == "monolith":
        mag = 1.25
        ok = False
        depth = "skipped"
        failures = ["FAIL upscale view=yaw-000.png yaw=0.0 maxMagnification=1.2500 limit=1.0 capDistance=4.0000"]
    for i in range(8):
        per.append({
            "file": f"yaw-{i * 45:03d}.png",
            "yawDeg": float(i * 45),
            "maxMagnification": mag,
            "sourceHeight": 136,
            "sourceWidth": 100,
            "hullHeight": round(136 * mag, 3),
            "hullWidth": round(100 * mag, 3),
        })
    subs = []
    if name == "wreck":
        subs = [{"name": "spur", "joint": [0.48, 0.08, 0.0], "axis": [0.0, 1.0, 0.0], "viewCount": 8, "vertexCount": 900}]
    return {
        "ok": ok,
        "name": name,
        "viewCount": 8,
        "depthRefine": depth,
        "magnification": {"limit": 1.0, "max": mag, "perView": per},
        "hull": {
            "surface": "surface-nets",
            "vertexCount": 12000,
            "triangleCount": 24000,
            "smoothIters": 8,
            "depthRelief": 0.35,
            "depthMinAgree": 2 if depth == "png" else 1,
        },
        "subObjects": subs,
        "failures": failures,
    }


def layout_report(kind: str) -> dict:
    def row(name, status, numbers, note=""):
        return {"name": name, "status": status, "note": note, "numbers": numbers}

    ring = row("ring_closed", "PASS", {"visual_gap_deg": 0.0, "collider_gap_deg": 0.0, "hero_width_m": 0.7, "miss_visual": 0, "miss_collider": 0})
    gate = row("gate", "PASS", {"frame_missing": 0, "gates": 1, "narrow": 0, "opening_blocked": 0})
    col = row("collider_eq_visual", "PASS", {"collider_only": 0, "object_only": 0, "invisible_stops": 0, "invisible_stop_m": 0.0})
    mag = row("mag", "PASS", {"worst": 0.61, "mag_max": 1.0, "over": 0})
    ok = True
    if kind == "fail":
        ring = row("ring_closed", "FAIL", {"visual_gap_deg": 104.0, "collider_gap_deg": 0.0, "hero_width_m": 0.7, "miss_visual": 104, "miss_collider": 0})
        gate = row("gate", "FAIL", {"frame_missing": 1, "gates": 1, "narrow": 0, "opening_blocked": 1})
        col = row("collider_eq_visual", "FAIL", {"collider_only": 16, "object_only": 0, "invisible_stops": 76, "invisible_stop_m": 17.37, "invisible_heading_deg": 42.5})
        ok = False
    return {"id": "sample-zone", "ok": ok, "rows": [ring, gate, col, mag]}


def play_report(kind: str) -> dict:
    def row(rid, result, numbers, detail):
        return {"id": rid, "result": result, "numbers": numbers, "detail": detail, "heuristic": False, "partial": False}

    rows = [
        row("webgl_errors", "PASS", {"count": 0}, "No WebGL errors during the walk."),
        row("mag_max", "PASS", {"mag_max": 0.937, "limit": 1, "at": "01-spawn"}, "Peak magnification 0.937 at 01-spawn, limit 1."),
        row("ring_closed", "PASS", {"ray_misses": 0}, "No missed ring heading."),
        row("gate", "PASS", {"visible": 1}, "Gate frame was visible and the path trigger fired."),
        row("single_hero", "PASS", {"heroes": 1}, "Exactly one hero, idle and gallop both captured."),
    ]
    result = "PASS"
    if kind == "fail":
        rows[0] = row("webgl_errors", "FAIL", {"count": 2}, "WebGL errors were captured, including texSubImage3D.")
        rows[1] = row("mag_max", "FAIL", {"mag_max": 1.4, "limit": 1, "at": "04-stop-000"}, "Peak magnification 1.4, limit 1.")
        result = "FAIL"
    passed = sum(1 for r in rows if r["result"] == "PASS")
    return {
        "tool": "playcheck",
        "url": "http://127.0.0.1/fixture",
        "layoutId": "sample-zone",
        "video": {"file": "walk.mp4", "width": 64, "height": 36, "fps": 30, "codec": "h264", "seconds": 0.2},
        "stills": ["stills/01-spawn.png", "stills/03-gate-end.png", "stills/07-idle.png"],
        "rows": rows,
        "summary": {"passed": passed, "failed": len(rows) - passed, "result": result},
        "notes": ["Synthetic reportview fixture. Numbers are the shape of a playcheck report, not a play build."],
    }


def write_png(path: Path, w: int, h: int, rgb: tuple[int, int, int]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + bytes(rgb) * w for _ in range(h))
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def write_mp4(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "color=c=0x334455:s=64x36:d=0.2",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            "-fflags",
            "+bitexact",
            "-flags:v",
            "+bitexact",
            "-map_metadata",
            "-1",
            str(path),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


if __name__ == "__main__":
    sys.exit(main())

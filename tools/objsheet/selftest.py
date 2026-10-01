#!/usr/bin/env python3
"""Consistency sheet checks. Synthetic sets plus views that already live in the repo.

  python3 tools/objsheet/selftest.py
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
TOOL = ROOT / "tools" / "objsheet"
ROCK = ROOT / "tools" / "walkaround" / "testdata" / "synthetic-rock"
SAMPLES = TOOL / "samples"
PY = sys.executable


def run(views: Path, config: Path, out: Path) -> tuple[int, dict]:
    if out.exists():
        shutil.rmtree(out)
    proc = subprocess.run(
        [PY, str(TOOL / "sheet.py"), "--views", str(views), "--config", str(config), "--out", str(out)],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    report_path = out / "report.json"
    if not report_path.is_file():
        raise SystemExit(proc.stdout + proc.stderr)
    report = json.loads(report_path.read_text())
    return proc.returncode, report


def expect(code: int, report: dict, ok: bool, needle: str | None = None) -> None:
    if report.get("ok") is not ok or (code == 0) is not ok:
        text = "\n".join(report.get("failures") or [])
        raise SystemExit(f"expected ok={ok}, got code={code} ok={report.get('ok')}\n{text}\n")
    if needle and needle not in "\n".join(report.get("failures") or []):
        raise SystemExit("missing " + needle + "\n" + "\n".join(report.get("failures") or []))


def publish(name: str, out: Path) -> None:
    dest = SAMPLES / name
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)
    shutil.copy(out / "report.json", dest / "report.json")
    shutil.copy(out / "report.md", dest / "report.md")
    shutil.copy(out / "sheet.png", dest / "sheet.png")


def write_config(path: Path, views: list[dict], **extra) -> None:
    cfg = {
        "name": extra.pop("name", path.parent.name),
        "objectSize": extra.pop("objectSize", [1.28, 1.62, 1.16]),
        "vote": 7,
        "grid": 32,
        "bgThreshold": 0.04,
        "camera": {"distance": 3.05, "eyeY": 0.0, "fovYDeg": 40.0},
        "views": views,
    }
    cfg.update(extra)
    path.write_text(json.dumps(cfg, indent=2) + "\n")


def ellipse(path: Path, h: int, w: int, cy: float, cx: float, ry: float, rx: float, color: tuple[int, int, int]) -> None:
    ys, xs = np.mgrid[0:h, 0:w]
    mask = ((ys - cy) / ry) ** 2 + ((xs - cx) / rx) ** 2 <= 1.0
    rgb = np.zeros((h, w, 3), np.uint8)
    rgb[mask] = color
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgb, "RGB").save(path)


def consistent_with_guides(tmp: Path) -> None:
    views = json.loads((ROCK / "config.json").read_text())["views"]
    guided = []
    for view in views:
        item = dict(view)
        item["guide"] = view["file"]
        guided.append(item)
    folder = tmp / "guides-good"
    folder.mkdir(parents=True)
    write_config(folder / "config.json", guided, name="guides-good")
    # Guides are the views themselves. The config paths are relative to the views dir.
    code, report = run(ROCK / "views", folder / "config.json", tmp / "guides-good-out")
    expect(code, report, True)
    ious = report["objects"][0]["guide"]["views"]
    if any(row["iou"] < 0.97 for row in ious):
        raise SystemExit(f"guide IoU dropped: {ious}")
    publish("guides-good", tmp / "guides-good-out")
    print("selftest guides-good")


def inconsistent(tmp: Path) -> None:
    folder = tmp / "inconsistent"
    views = folder / "views"
    shutil.copytree(ROCK / "views", views)
    # A different object on two yaws: tall, narrow, and a different colour.
    ellipse(views / "yaw-180.png", 200, 160, 100, 80, 90, 18, (40, 180, 220))
    ellipse(views / "yaw-135.png", 200, 160, 100, 80, 90, 18, (40, 180, 220))
    cfg = json.loads((ROCK / "config.json").read_text())
    cfg["name"] = "inconsistent"
    (folder / "config.json").write_text(json.dumps(cfg, indent=2) + "\n")
    code, report = run(views, folder / "config.json", tmp / "inconsistent-out")
    expect(code, report, False, "FAIL")
    blob = "\n".join(report["failures"])
    if "adjacent" not in blob and "hull" not in blob and "opposite" not in blob:
        raise SystemExit(blob)
    publish("inconsistent", tmp / "inconsistent-out")
    print("selftest inconsistent")


def bad_guide(tmp: Path) -> None:
    folder = tmp / "bad-guide"
    views = folder / "views"
    guides = folder / "guides"
    shutil.copytree(ROCK / "views", views)
    guides.mkdir()
    # Shift the silhouette. Same pixels, wrong place. IoU must fall under 0.97.
    for src in views.glob("*.png"):
        arr = np.array(Image.open(src).convert("RGB"))
        shifted = np.zeros_like(arr)
        shifted[:, 24:] = arr[:, :-24]
        Image.fromarray(shifted, "RGB").save(guides / src.name)
    cfg = json.loads((ROCK / "config.json").read_text())
    cfg["name"] = "bad-guide"
    for view in cfg["views"]:
        view["guide"] = str(Path("..") / "guides" / view["file"])
    (folder / "config.json").write_text(json.dumps(cfg, indent=2) + "\n")
    code, report = run(views, folder / "config.json", tmp / "bad-guide-out")
    expect(code, report, False, "guide")
    publish("bad-guide", tmp / "bad-guide-out")
    print("selftest bad-guide")


def with_subobject(tmp: Path) -> None:
    folder = tmp / "with-spur"
    parent = folder / "views"
    shutil.copytree(ROCK / "views", parent)
    spur = folder / "spur" / "views"
    spur.mkdir(parents=True)
    views = []
    for i, yaw in enumerate(range(0, 360, 45)):
        name = f"yaw-{yaw:03d}.png"
        # Same knob from every yaw, close enough that area and height stay locked.
        ellipse(spur / name, 120, 96, 60, 48, 28, 22, (190, 150, 60))
        views.append({"file": name, "yawDeg": float(yaw)})
    write_config(
        folder / "spur" / "config.json",
        views,
        name="spur",
        objectSize=[0.85, 1.05, 0.85],
        camera={"distance": 3.05, "eyeY": 0.0, "fovYDeg": 40.0},
    )
    cfg = json.loads((ROCK / "config.json").read_text())
    cfg["name"] = "with-spur"
    cfg["subObjects"] = [
        {"name": "spur", "config": "spur/config.json", "viewsDir": "spur/views", "joint": [0.4, 0.0, 0.0], "axis": [0, 1, 0]}
    ]
    (folder / "config.json").write_text(json.dumps(cfg, indent=2) + "\n")
    code, report = run(parent, folder / "config.json", tmp / "with-spur-out")
    expect(code, report, True)
    names = [obj["name"] for obj in report["objects"]]
    if names != ["with-spur", "spur"]:
        raise SystemExit(f"sub-object missing: {names}")
    publish("with-spur", tmp / "with-spur-out")
    print("selftest with-spur")


def repo_rock(tmp: Path) -> None:
    code, report = run(ROCK / "views", ROCK / "config.json", tmp / "rock-out")
    expect(code, report, True)
    keep = report["objects"][0]["hull"]["minKeep"]
    if keep < 0.70:
        raise SystemExit(f"rock keep {keep}")
    publish("repo-synthetic-rock", tmp / "rock-out")
    print(f"selftest repo rock keepMin={keep}")


def void_orbit(tmp: Path) -> None:
    stills = ROOT / "biome" / "void-orbit" / "stills"
    names = ["flank-0.jpg", "flank-1.jpg", "flank-2.jpg", "flank-3.jpg", "top-0.jpg", "belly-0.jpg", "ship-top.jpg", "ship-stern.jpg"]
    if not all((stills / name).is_file() for name in names):
        print("selftest void-orbit skipped (stills missing)")
        return
    folder = tmp / "void-orbit"
    views = folder / "views"
    views.mkdir(parents=True)
    entries = []
    for i, name in enumerate(names):
        # Symlink so the sheet reads the real files. Yaws are assigned only so the
        # ring check has eight numbers; these stills are not a locked walk-around.
        dest = views / f"yaw-{i * 45:03d}.jpg"
        if dest.exists():
            dest.unlink()
        dest.symlink_to(stills / name)
        entries.append({"file": dest.name, "yawDeg": float(i * 45)})
    write_config(folder / "config.json", entries, name="void-orbit-stills", objectSize=[1.2, 1.2, 1.2])
    code, report = run(views, folder / "config.json", tmp / "void-orbit-out")
    if report.get("ok"):
        raise SystemExit("void-orbit stills passed; they are not one locked object")
    publish("real-void-orbit", tmp / "void-orbit-out")
    print("selftest void-orbit FAIL as expected")
    for line in report["failures"][:6]:
        print(" ", line)


def main() -> None:
    tmp = Path("/tmp/objsheet-selftest")
    if tmp.exists():
        shutil.rmtree(tmp)
    tmp.mkdir()
    SAMPLES.mkdir(parents=True, exist_ok=True)
    repo_rock(tmp)
    consistent_with_guides(tmp)
    inconsistent(tmp)
    bad_guide(tmp)
    with_subobject(tmp)
    void_orbit(tmp)
    print("PASS objsheet selftest")


if __name__ == "__main__":
    main()

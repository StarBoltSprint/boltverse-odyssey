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


def cropped_margin(tmp: Path) -> None:
    folder = tmp / "cropped"
    views = folder / "views"
    views.mkdir(parents=True)
    entries = []
    for yaw in range(0, 360, 45):
        name = f"yaw-{yaw:03d}.png"
        ellipse(views / name, 200, 160, 40, 80, 50, 36, (170, 170, 170))
        entries.append({"file": name, "yawDeg": float(yaw)})
    write_config(folder / "config.json", entries, name="cropped-margin")
    code, report = run(views, folder / "config.json", tmp / "cropped-out")
    expect(code, report, False, "FAIL margin")
    publish("cropped-margin", tmp / "cropped-out")
    print("selftest cropped-margin")


def interior_holes(tmp: Path) -> None:
    folder = tmp / "holed"
    views = folder / "views"
    views.mkdir(parents=True)
    entries = []
    h, w = 200, 160
    ys, xs = np.mgrid[0:h, 0:w]
    body = ((ys - 100) / 60) ** 2 + ((xs - 80) / 40) ** 2 <= 1
    hole = ((ys - 100) / 18) ** 2 + ((xs - 80) / 14) ** 2 <= 1
    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[body] = (200, 180, 160, 255)
    rgba[hole] = (0, 0, 0, 0)
    for yaw in range(0, 360, 45):
        name = f"yaw-{yaw:03d}.png"
        Image.fromarray(rgba, "RGBA").save(views / name)
        entries.append({"file": name, "yawDeg": float(yaw)})
    write_config(folder / "config.json", entries, name="interior-holes")
    code, report = run(views, folder / "config.json", tmp / "holed-out")
    expect(code, report, False, "FAIL holes")
    frac = report["objects"][0]["holes"]["maxHoleFraction"]
    if frac < 0.02:
        raise SystemExit(f"hole fraction {frac} is under the director band")
    publish("interior-holes", tmp / "holed-out")
    print(f"selftest interior-holes {frac}")


def _side(color: tuple[int, int, int]) -> np.ndarray:
    h, w = 96, 128
    rgba = np.zeros((h, w, 4), np.uint8)
    yy, xx = np.mgrid[0:h, 0:w]
    body = ((yy - 70) / 16) ** 2 + ((xx - 64) / 40) ** 2 <= 1
    rgba[body] = (*color, 255)
    return rgba


def preflight_views(tmp: Path) -> None:
    if str(TOOL) not in sys.path:
        sys.path.insert(0, str(TOOL))
    from preflight import FALLBACK, HERO_SHIP_DEFAULT, run_views

    hero_dir = tmp / "preflight-good"
    hero_dir.mkdir()
    Image.fromarray(_side((48, 40, 72)), "RGBA").save(hero_dir / "hero.png")
    Image.fromarray(_side((50, 42, 74)), "RGBA").save(hero_dir / "yaw-045.png")
    good = run_views([hero_dir / "yaw-045.png"], hero_dir / "hero.png")
    if not good["ok"]:
        raise SystemExit("green preflight should pass\n" + "\n".join(good["failures"]))
    bad_dir = tmp / "preflight-bad"
    bad_dir.mkdir()
    Image.fromarray(_side((48, 40, 72)), "RGBA").save(bad_dir / "hero.png")
    Image.fromarray(_side((210, 200, 230)), "RGBA").save(bad_dir / "yaw-180.png")
    bad = run_views([bad_dir / "yaw-180.png"], bad_dir / "hero.png")
    text = "\n".join(bad["failures"])
    if bad["ok"] or "luma" not in text:
        raise SystemExit("red preflight luma was not rejected\n" + text)
    if "3-4 views" not in bad["recommendation"] or bad["recommendation"] != FALLBACK:
        raise SystemExit("failing orbit did not recommend the 3-4 view fallback")
    if "120°" not in bad["recommendation"] or "90–120" in bad["recommendation"]:
        raise SystemExit("orbit fallback still offers a 120° arc")
    ship = run_views([hero_dir / "yaw-045.png"], hero_dir / "hero.png", kind="hero-ship")
    if ship["ok"] or ship["viewCount"] != 2 or not ship["recommendation"].startswith(HERO_SHIP_DEFAULT):
        raise SystemExit("hero ship with 2 views should stay outside the 3-4 default\n" + ship["recommendation"])
    if "8-view orbit can proceed" in ship["recommendation"]:
        raise SystemExit("hero ship default must not send an 8-view orbit")
    band = tmp / "preflight-ship"
    band.mkdir()
    Image.fromarray(_side((48, 40, 72)), "RGBA").save(band / "hero.png")
    Image.fromarray(_side((49, 41, 73)), "RGBA").save(band / "three-quarter.png")
    Image.fromarray(_side((50, 42, 74)), "RGBA").save(band / "side.png")
    Image.fromarray(_side((51, 43, 75)), "RGBA").save(band / "back.png")
    three = run_views([band / "three-quarter.png", band / "side.png"], band / "hero.png", kind="hero-ship")
    four = run_views(
        [band / "three-quarter.png", band / "side.png", band / "back.png"],
        band / "hero.png",
        kind="hero-ship",
    )
    if not three["ok"] or three["viewCount"] != 3 or not four["ok"] or four["viewCount"] != 4:
        raise SystemExit(
            "hero ship 3-view and 4-view sets should pass\n"
            + "\n".join(three["failures"] + four["failures"])
        )
    print("selftest preflight red luma then green match")


def _swatch(path: Path, rgb: tuple[int, int, int], size: tuple[int, int] = (24, 24)) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", size, rgb).save(path)


def contact_sheet(tmp: Path) -> None:
    """Fixed order, plate beside render, missing key camera is not invented."""
    base = tmp / "contact"
    colors = {
        "oblique45": ((180, 40, 40), (40, 80, 180)),
        "grazing": ((40, 160, 60), (200, 180, 40)),
        "approach8m": ((120, 40, 160), (40, 160, 160)),
        "up3m": ((200, 100, 40), (80, 80, 200)),
    }
    cells = {}
    for slot, (plate_rgb, render_rgb) in colors.items():
        plate = base / f"{slot}-plate.png"
        render = base / f"{slot}-render.png"
        _swatch(plate, plate_rgb)
        _swatch(render, render_rgb, (24, 16))
        cells[slot] = {"plate": plate.name, "render": render.name}
    spec = {"cells": cells}
    (base / "sheet.json").write_text(json.dumps(spec), encoding="utf-8")
    proc = subprocess.run(
        [PY, str(TOOL / "contact.py"), "--spec", str(base / "sheet.json"), "--out", str(base / "out")],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    report = json.loads((base / "out" / "report.json").read_text(encoding="utf-8"))
    if proc.returncode != 0 or report.get("ok") is not True:
        raise SystemExit(proc.stdout + proc.stderr)
    if report["order"] != ["oblique45", "grazing", "approach8m", "up3m"]:
        raise SystemExit(f"contact order {report['order']}")
    if "key" not in report["skipped"]:
        raise SystemExit("missing key camera was not skipped")
    sheet = np.array(Image.open(base / "out" / "sheet.png").convert("RGB"))
    for cell, (plate_rgb, render_rgb) in zip(report["cells"], colors.values()):
        if cell["frame"] != [64, 64]:
            raise SystemExit("plate and render are not in the same frame")
        px, py, pw, ph = cell["plateBox"]
        rx, ry, rw, rh = cell["renderBox"]
        if (pw, ph) != (rw, rh):
            raise SystemExit("plate frame differs from the render frame")
        plate_pix = sheet[py + ph // 2, px + pw // 2]
        render_pix = sheet[ry + rh // 2, rx + rw // 2]
        if tuple(int(v) for v in plate_pix) != plate_rgb:
            raise SystemExit(f"{cell['slot']} plate pixel {plate_pix} != {plate_rgb}")
        if tuple(int(v) for v in render_pix) != render_rgb:
            raise SystemExit(f"{cell['slot']} render pixel {render_pix} != {render_rgb}")
        if not (px < rx):
            raise SystemExit(f"{cell['slot']} plate is not beside the render")
    key_plate = base / "key-plate.png"
    key_render = base / "key-render.png"
    _swatch(key_plate, (255, 255, 255))
    _swatch(key_render, (0, 0, 0))
    with_key = {"cells": {"key": {"plate": key_plate.name, "render": key_render.name}, **cells}}
    (base / "with-key.json").write_text(json.dumps(with_key), encoding="utf-8")
    proc = subprocess.run(
        [PY, str(TOOL / "contact.py"), "--spec", str(base / "with-key.json"), "--out", str(base / "with-key")],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    keyed = json.loads((base / "with-key" / "report.json").read_text(encoding="utf-8"))
    if proc.returncode != 0 or keyed["order"][0] != "key":
        raise SystemExit("key camera was not first when it was named")
    print("selftest contact sheet plate|render " + " ".join(report["order"]))

def shot_verdict(tmp: Path) -> None:
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))
    if str(TOOL) not in sys.path:
        sys.path.insert(0, str(TOOL))
    from tools.library.library import build_manifest
    from tools.library.resolve import LibraryError
    from verdict import (
        CELL_KEYS,
        SHOT_VIEWS,
        IntakeRefused,
        apply_art_director,
        emit_sheet,
        library_intake,
        load_sheet,
        shape_errors,
    )

    sheet = emit_sheet(
        "terrace-block",
        plates={"key": "plates/key.jpg", "45°": "plates/yaw45.jpg"},
        renders={"key": "renders/key.png"},
    )
    errors = shape_errors(sheet)
    if errors:
        raise SystemExit("shot shape: " + "; ".join(errors))
    if sheet["schema"] != "objsheet-shot-verdict/1" or sheet["verdict"] != "PENDING":
        raise SystemExit(f"fresh sheet is not PENDING: {sheet['verdict']}")
    if [cell["view"] for cell in sheet["cells"]] != list(SHOT_VIEWS):
        raise SystemExit("shot views drifted")
    for cell in sheet["cells"]:
        for key in CELL_KEYS:
            if key not in cell:
                raise SystemExit(f"cell missing {key}")
        if cell["status"] != "PENDING" or cell["defects"] != []:
            raise SystemExit(f"fresh cell not empty PENDING: {cell}")
    key = sheet["cells"][0]
    yaw = sheet["cells"][1]
    grazing = sheet["cells"][2]
    if key["plate_path"] != "plates/key.jpg" or key["render_path"] != "renders/key.png":
        raise SystemExit("key cell is not plate | render side by side")
    if yaw["plate_path"] != "plates/yaw45.jpg" or yaw["render_path"] is not None:
        raise SystemExit("45° cell should keep a plate and a null render")
    if grazing["plate_path"] is not None or grazing["render_path"] is not None:
        raise SystemExit("grazing cell should be empty until files exist")
    try:
        library_intake(sheet)
        raise SystemExit("PENDING did not block the intake stub")
    except IntakeRefused as exc:
        if "PENDING" not in str(exc):
            raise SystemExit(f"PENDING refusal lost its reason: {exc}")

    kept = apply_art_director(sheet, "KEEP")
    if any(cell["defects"] or cell["status"] != "KEEP" for cell in kept["cells"]):
        raise SystemExit("KEEP wrote defects or left a cell open")
    allowed = library_intake(kept)
    if allowed != {"allow": True, "verdict": "KEEP", "defects": []}:
        raise SystemExit(f"KEEP with empty defects was not allowed: {allowed}")
    try:
        apply_art_director(sheet, "KEEP", {"key": ["halo"]})
        raise SystemExit("KEEP accepted a defect")
    except ValueError as exc:
        if "empty defects" not in str(exc):
            raise

    failed = apply_art_director(
        sheet,
        "FAIL",
        {"8 m": ["texel mush at the cornice"], "key": ["door void too deep"]},
    )
    if failed["verdict"] != "FAIL":
        raise SystemExit("FAIL verdict was not stored")
    listed = [item for cell in failed["cells"] if cell["status"] == "FAIL" for item in cell["defects"]]
    if listed != ["door void too deep", "texel mush at the cornice"]:
        raise SystemExit(f"FAIL defects not listed in view order: {listed}")
    quiet = next(cell for cell in failed["cells"] if cell["view"] == "grazing")
    if quiet["status"] != "KEEP" or quiet["defects"]:
        raise SystemExit("a cell without a defect was not left KEEP")
    blocked = library_intake(failed)
    if blocked["allow"] or blocked["defects"] != listed:
        raise SystemExit(f"FAIL intake did not list defects: {blocked}")
    try:
        apply_art_director(sheet, "FAIL", {})
        raise SystemExit("FAIL with no defects was accepted")
    except ValueError as exc:
        if "defects listed" not in str(exc):
            raise

    out = tmp / "shot-verdict.json"
    emit = subprocess.run(
        [
            PY,
            str(TOOL / "verdict.py"),
            "emit",
            "--build",
            "cli-build",
            "--out",
            str(out),
            "--plate",
            "key=plates/key.jpg",
            "--render",
            "8m=renders/close8m.png",
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    if emit.returncode != 0:
        raise SystemExit(emit.stdout + emit.stderr)
    cli_sheet = load_sheet(out)
    if shape_errors(cli_sheet) or cli_sheet["cells"][3]["render_path"] != "renders/close8m.png":
        raise SystemExit("CLI emit lost the 8 m render")
    pending = subprocess.run(
        [PY, str(TOOL / "verdict.py"), "intake", "--sheet", str(out)],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    if pending.returncode != 1 or "PENDING" not in pending.stderr:
        raise SystemExit("CLI intake did not refuse PENDING\n" + pending.stdout + pending.stderr)
    filled = tmp / "shot-verdict-keep.json"
    keep_cli = subprocess.run(
        [PY, str(TOOL / "verdict.py"), "fill", "--sheet", str(out), "--verdict", "KEEP", "--out", str(filled)],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    if keep_cli.returncode != 0:
        raise SystemExit(keep_cli.stdout + keep_cli.stderr)
    allow_cli = subprocess.run(
        [PY, str(TOOL / "verdict.py"), "intake", "--sheet", str(filled)],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    if allow_cli.returncode != 0 or "ALLOW KEEP" not in allow_cli.stdout:
        raise SystemExit("CLI KEEP was not allowed\n" + allow_cli.stdout + allow_cli.stderr)
    fail_path = tmp / "shot-verdict-fail.json"
    fail_cli = subprocess.run(
        [
            PY,
            str(TOOL / "verdict.py"),
            "fill",
            "--sheet",
            str(out),
            "--verdict",
            "FAIL",
            "--defect",
            "grazing=horizon clipped",
            "--out",
            str(fail_path),
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    if fail_cli.returncode != 0:
        raise SystemExit(fail_cli.stdout + fail_cli.stderr)
    fail_sheet = load_sheet(fail_path)
    fail_cell = next(cell for cell in fail_sheet["cells"] if cell["view"] == "grazing")
    if fail_cell["defects"] != ["horizon clipped"] or fail_cell["status"] != "FAIL":
        raise SystemExit(f"CLI FAIL did not list the defect: {fail_cell}")
    help_sheet = subprocess.run([PY, str(TOOL / "sheet.py"), "--help"], cwd=ROOT, text=True, capture_output=True)
    if help_sheet.returncode != 0 or "--build" not in help_sheet.stdout:
        raise SystemExit("sheet.py does not offer --build")

    pending_path = tmp / "library-pending.json"
    pending_path.write_text(json.dumps(sheet) + "\n", encoding="utf-8")
    try:
        build_manifest(_library_intake(str(pending_path)), tmp)
        raise SystemExit("library add accepted a PENDING shot sheet")
    except LibraryError as exc:
        if "PENDING" not in str(exc):
            raise SystemExit(f"library hook did not say PENDING: {exc}")
    keep_path = tmp / "library-keep.json"
    keep_path.write_text(json.dumps(kept) + "\n", encoding="utf-8")
    manifest = build_manifest(_library_intake(str(keep_path)), tmp)
    if manifest["id"] != "shot-gate" or "shotSheet" in manifest:
        raise SystemExit("KEEP shot sheet changed the library manifest")
    fail_lib = tmp / "library-fail.json"
    fail_lib.write_text(json.dumps(failed) + "\n", encoding="utf-8")
    try:
        build_manifest(_library_intake(str(fail_lib)), tmp)
        raise SystemExit("library add accepted a FAIL shot sheet")
    except LibraryError as exc:
        if "texel mush at the cornice" not in str(exc):
            raise SystemExit(f"library FAIL did not list defects: {exc}")
    print("selftest shot-verdict PENDING blocks, KEEP allows, FAIL lists defects")


def _library_intake(shot_sheet: str) -> dict:
    return {
        "id": "shot-gate",
        "fixture": True,
        "source": {"imagineIds": ["fixture-synthetic-solid"], "promptRef": "biome/library/fixture-solid/prompt-ref.txt"},
        "viewsDir": "tools/walkaround/testdata/synthetic-rock/views",
        "shapeMethod": "surface-nets",
        "walkaroundDir": "tools/walkaround/testdata/synthetic-rock/out",
        "asset": "tools/walkaround/testdata/synthetic-rock/out/asset.json",
        "reports": {
            "assetcheck": "tools/assetcheck/samples/good-cutout/report.json",
            "objsheet": "tools/objsheet/samples/repo-synthetic-rock/report.json",
            "walkaround": "tools/walkaround/testdata/synthetic-rock/out/qc/report.json",
        },
        "scale": {"min": 0.85, "max": 1.2, "default": 1.0},
        "collider": {"type": "circle", "radius_m": 0.7366173380262299},
        "lod": {"billboardViews": [f"yaw-{yaw:03d}.png" for yaw in range(0, 360, 45)]},
        "shotSheet": shot_sheet,
    }


def main() -> None:
    tmp = Path("/tmp/objsheet-selftest")
    if tmp.exists():
        shutil.rmtree(tmp)
    tmp.mkdir()
    SAMPLES.mkdir(parents=True, exist_ok=True)
    shot_verdict(tmp)
    repo_rock(tmp)
    consistent_with_guides(tmp)
    inconsistent(tmp)
    bad_guide(tmp)
    with_subobject(tmp)
    cropped_margin(tmp)
    interior_holes(tmp)
    void_orbit(tmp)
    preflight_views(tmp)
    contact_sheet(tmp)
    print("PASS objsheet selftest")


if __name__ == "__main__":
    main()

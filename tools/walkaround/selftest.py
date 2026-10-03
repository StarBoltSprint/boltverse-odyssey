#!/usr/bin/env python3
"""Checks for the walk-around hull. Synthetic stills only. Not Imagine pixels.

  python3 tools/walkaround/selftest.py
  python3 tools/walkaround/selftest.py --proof
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
TOOL = ROOT / "tools" / "walkaround"
ROCK = TOOL / "testdata" / "synthetic-rock"
PY = sys.executable


def call(cmd: list[str]) -> str:
    code, text = call_raw(cmd)
    if code != 0:
        raise SystemExit(text.strip() or f"FAIL command {cmd}")
    return text


def call_raw(cmd: list[str]) -> tuple[int, str]:
    proc = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True)
    text = (proc.stdout or "") + (proc.stderr or "")
    return proc.returncode, text


def build(views: Path, config: Path, out: Path, extra: list[str]) -> dict:
    if out.exists():
        shutil.rmtree(out)
    text = call([PY, str(TOOL / "build.py"), "--views", str(views), "--config", str(config), "--out", str(out), *extra])
    if "PASS walkaround" not in text:
        raise SystemExit(text.strip() or "FAIL: build did not pass")
    return json.loads((out / "qc" / "report.json").read_text())


def solid_at(out: Path, point: list[float]) -> bool:
    z = np.load(out / "hull.npz")
    origin = z["origin"]
    vsize = z["voxelSize"]
    ijk = np.rint((np.array(point, np.float64) - origin) / vsize - 0.5).astype(int)
    return bool(z["solid"][tuple(ijk.tolist())])


def assert_depth(report: dict, source: str) -> None:
    """Numeric depth is recorded for the default method. Geometry checks stay separate."""
    block = report.get("depthMetrics")
    if not isinstance(block, dict):
        raise SystemExit("FAIL selftest: depthMetrics missing")
    if block.get("units") != "metres":
        raise SystemExit(f"FAIL selftest: depth units {block.get('units')}")
    bbox = float(block.get("bboxDepth") or 0)
    if bbox <= 0.2:
        raise SystemExit(f"FAIL selftest: bboxDepth {bbox}")
    span = report.get("depthRange")
    if not isinstance(span, list) or len(span) != 2:
        raise SystemExit(f"FAIL selftest: depthRange {span}")
    if report.get("depthMin") != span[0] or report.get("depthMax") != span[1]:
        raise SystemExit("FAIL selftest: depthMin/depthMax do not match depthRange")
    hull = report.get("hull") or {}
    if hull.get("depthRange") != span or hull.get("bboxDepth") != block.get("bboxDepth"):
        raise SystemExit("FAIL selftest: hull is missing the depth fields reportview reads")
    if float(span[0]) <= 0 or float(span[1]) <= float(span[0]):
        raise SystemExit(f"FAIL selftest: depth range {span}")
    per = block.get("perView") or []
    if len(per) < 8:
        raise SystemExit(f"FAIL selftest: depth perView {len(per)}")
    for row in per:
        for key in ("nearM", "farM", "meanOffsetM", "maxOffsetM"):
            if row.get(key) is None:
                raise SystemExit(f"FAIL selftest: {row.get('file')} missing {key}")
        if float(row["farM"]) <= float(row["nearM"]):
            raise SystemExit(f"FAIL selftest: {row['file']} near/far {row['nearM']} {row['farM']}")
        if float(row["maxOffsetM"]) < float(row["meanOffsetM"]):
            raise SystemExit(f"FAIL selftest: offset order {row}")
    refine = block.get("refinement") or {}
    if refine.get("source") != source:
        raise SystemExit(f"FAIL selftest: depth source {refine.get('source')}")
    if float(refine.get("maxOffsetM", -1)) < float(refine.get("meanOffsetM", 0)):
        raise SystemExit(f"FAIL selftest: refinement offsets {refine}")
    if source == "png" and refine.get("applied") and float(refine["maxOffsetM"]) <= 0:
        raise SystemExit("FAIL selftest: applied depth offset is zero")


def assert_smooth(report: dict, min_vertices: int) -> None:
    hull = report["hull"]
    if hull["surface"] != "surface-nets":
        raise SystemExit("FAIL selftest: expected surface-nets")
    if int(hull["vertexCount"]) < min_vertices:
        raise SystemExit(f"FAIL selftest: vertexCount {hull['vertexCount']}")
    edges = hull["edges"] or {}
    if int(edges.get("boundary", 1)) != 0 or int(edges.get("nonManifold", 1)) != 0:
        raise SystemExit(f"FAIL selftest: edges {edges}")
    if float(report["magnification"]["max"]) > 1.0:
        raise SystemExit("FAIL selftest: magnification above 1")
    seam = float(report["seam"]["meanFragmentSeamFraction"])
    if seam >= 0.45:
        raise SystemExit(f"FAIL selftest: seam {seam}")
    if not report.get("sources"):
        raise SystemExit("FAIL selftest: no source sizes")


def check_rock(tmp: Path) -> None:
    legacy = build(
        ROCK / "views",
        ROCK / "config.json",
        tmp / "rock-vox",
        ["--legacy-voxels", "--depth-dir", str(ROCK / "depth")],
    )
    if legacy["hull"]["surface"] != "voxels" or int(legacy["hull"]["vertexCount"]) != 0:
        raise SystemExit("FAIL selftest: legacy path did not stay on the voxel grid")
    if float(legacy["magnification"]["max"]) > 1.0:
        raise SystemExit("FAIL selftest: legacy magnification above 1")
    nets = build(
        ROCK / "views",
        ROCK / "config.json",
        tmp / "rock-nets",
        ["--surface-grid", "48", "--smooth-iters", "6", "--depth-dir", str(ROCK / "depth")],
    )
    assert_smooth(nets, 500)
    assert_depth(legacy, "png")
    assert_depth(nets, "png")
    if nets.get("sourceGates", {}).get("status") != "PASS":
        raise SystemExit(f"FAIL selftest: source gates {nets.get('sourceGates')}")
    handed = nets.get("handedness") or {}
    if handed.get("status") != "PASS" or not handed.get("plusXAtYaw0IsScreenRight"):
        raise SystemExit(f"FAIL selftest: handedness {handed}")
    asset = json.loads((tmp / "rock-nets" / "asset.json").read_text())
    foot = asset.get("footprint") or {}
    if foot.get("source") != "hull-xz":
        raise SystemExit(f"FAIL selftest: footprint {foot}")
    if abs(float(asset["placement"]["collisionRadius"]) - float(foot["radius_m"])) > 1e-6:
        raise SystemExit("FAIL selftest: collision radius is not the XZ footprint")
    if float(asset["placement"]["boundingRadius"]) + 1e-6 < float(foot["radius_m"]):
        raise SystemExit("FAIL selftest: bounding radius is inside the footprint")
    if (asset.get("handedness") or {}).get("right") != "cross(forward, worldUp)":
        raise SystemExit("FAIL selftest: asset handedness contract")
    print("selftest rock legacy+nets ok")


def check_bowl(tmp: Path) -> None:
    src = tmp / "bowl-src"
    call([PY, str(TOOL / "make_synthetic.py"), "--kind", "bowl", "--out", str(src)])
    report = build(
        src / "views",
        src / "config.json",
        tmp / "bowl-out",
        ["--surface-grid", "48", "--smooth-iters", "4"],
    )
    assert_smooth(report, 500)
    assert_depth(report, "skipped")
    out = tmp / "bowl-out"
    if solid_at(out, [0.0, 0.0, 0.0]):
        raise SystemExit("FAIL selftest: elevated top view left the shaft solid")
    if not solid_at(out, [0.33, 0.0, 0.0]):
        raise SystemExit("FAIL selftest: bowl wall was carved away")
    elev = [s for s in report["sources"] if abs(float(s["elevationDeg"])) >= 25]
    if len(elev) < 2:
        raise SystemExit("FAIL selftest: elevation cameras were not recorded")
    print("selftest bowl ok")


def check_assembly(tmp: Path) -> None:
    src = tmp / "assembly-src"
    call([PY, str(TOOL / "make_synthetic.py"), "--kind", "assembly", "--out", str(src)])
    report = build(
        src / "views",
        src / "config.json",
        tmp / "assembly-out",
        ["--surface-grid", "48", "--smooth-iters", "4"],
    )
    assert_smooth(report, 500)
    assert_depth(report, "skipped")
    subs = report.get("subObjects") or []
    if len(subs) != 1 or subs[0]["name"] != "spur":
        raise SystemExit("FAIL selftest: spur was not attached")
    if int(subs[0]["carvedParentVoxels"]) <= 0 or int(subs[0]["vertexCount"]) < 100:
        raise SystemExit(f"FAIL selftest: spur carve {subs[0]}")
    if abs(subs[0]["joint"][0] - 0.48) > 1e-6:
        raise SystemExit("FAIL selftest: joint was not stored")
    if int(report["viewCount"]) != 16:
        raise SystemExit(f"FAIL selftest: viewCount {report['viewCount']}")
    print("selftest assembly ok")


def check_shapes(tmp: Path) -> None:
    box = tmp / "box-src"
    call([PY, str(TOOL / "make_synthetic.py"), "--kind", "box", "--out", str(box)])
    box_report = build(
        box / "views",
        box / "config.json",
        tmp / "box-out",
        ["--shape", "primitive", "--primitive", "box", "--surface-grid", "40", "--smooth-iters", "2"],
    )
    iou = float(box_report["shape"]["silhouetteIoU"]["mean"])
    if iou < 0.85:
        raise SystemExit(f"FAIL selftest: box IoU {iou}")
    if int(box_report["shape"]["cornerSeamWarnings"]) < 1:
        raise SystemExit("FAIL selftest: box corner seams were not reported")
    if box_report["hull"]["surface"] != "primitive-box":
        raise SystemExit(f"FAIL selftest: box surface {box_report['hull']['surface']}")
    assert_depth(box_report, "skipped")
    if box_report["depthMetrics"]["refinement"]["applied"]:
        raise SystemExit("FAIL selftest: primitive recessed with depth")
    print("selftest primitive box ok")

    cyl = tmp / "cyl-src"
    call([PY, str(TOOL / "make_synthetic.py"), "--kind", "cylinder", "--out", str(cyl)])
    cyl_report = build(
        cyl / "views",
        cyl / "config.json",
        tmp / "cyl-out",
        ["--shape", "primitive", "--primitive", "cylinder", "--surface-grid", "40", "--smooth-iters", "2"],
    )
    cyl_iou = float(cyl_report["shape"]["silhouetteIoU"]["mean"])
    if cyl_iou < 0.80:
        raise SystemExit(f"FAIL selftest: cylinder IoU {cyl_iou}")
    if cyl_report["hull"]["surface"] != "primitive-cylinder":
        raise SystemExit("FAIL selftest: cylinder surface")
    assert_depth(cyl_report, "skipped")
    print("selftest primitive cylinder ok")

    turn = tmp / "turn-src"
    call([PY, str(TOOL / "make_synthetic.py"), "--kind", "turntable", "--out", str(turn)])
    photo = build(
        turn / "views",
        turn / "config.json",
        tmp / "turn-out",
        ["--shape", "photogrammetry", "--photogram-engine", "cpu", "--max-frames", "8", "--surface-grid", "40"],
    )
    stats = photo["shape"]
    if stats.get("method") != "photogrammetry" or not stats.get("ok"):
        raise SystemExit(f"FAIL selftest: photogrammetry {stats}")
    if float(stats["registeredFrameRatio"]) < 0.70:
        raise SystemExit(f"FAIL selftest: registered {stats['registeredFrameRatio']}")
    if float(stats["meanReprojectionPx"]) > 2.5:
        raise SystemExit(f"FAIL selftest: reprojection {stats['meanReprojectionPx']}")
    if int(stats["pointCount"]) < 30 or int(stats["meshFaces"]) < 100:
        raise SystemExit(f"FAIL selftest: cloud {stats['pointCount']} faces {stats['meshFaces']}")
    if float(stats["loopClosureSilhouetteIoU"]) < 0.90:
        raise SystemExit(f"FAIL selftest: loop {stats['loopClosureSilhouetteIoU']}")
    assert_depth(photo, "skipped")
    print("selftest photogrammetry ok")

    morph = tmp / "morph-src"
    call([PY, str(TOOL / "make_synthetic.py"), "--kind", "morph", "--out", str(morph)])
    code, text = call_raw(
        [
            PY,
            str(TOOL / "build.py"),
            "--views",
            str(morph / "views"),
            "--config",
            str(morph / "config.json"),
            "--out",
            str(tmp / "morph-out"),
            "--shape",
            "photogrammetry",
            "--photogram-engine",
            "cpu",
            "--max-frames",
            "8",
        ]
    )
    if code == 0 or "did not switch" not in text and "did not fall back" not in text:
        raise SystemExit(text.strip() or "FAIL selftest: morph did not FAIL")
    morph_report = json.loads((tmp / "morph-out" / "qc" / "report.json").read_text())
    if morph_report.get("ok") or (morph_report.get("shape") or {}).get("method") != "photogrammetry":
        raise SystemExit("FAIL selftest: morph report is not an explicit photogrammetry FAIL")
    if (morph_report.get("shape") or {}).get("ok"):
        raise SystemExit("FAIL selftest: morph shape.ok stayed true")
    if morph_report.get("hull", {}).get("surface") == "surface-nets" and morph_report.get("ok"):
        raise SystemExit("FAIL selftest: morph silently became the default hull")
    print("selftest morph FAIL ok")

    code, text = call_raw(
        [
            PY,
            str(TOOL / "build.py"),
            "--views",
            str(box / "views"),
            "--config",
            str(box / "config.json"),
            "--out",
            str(tmp / "compare-out"),
            "--compare",
            "--shape",
            "primitive",
            "--primitive",
            "box",
            "--surface-grid",
            "40",
            "--smooth-iters",
            "2",
        ]
    )
    if code != 0 or "COMPARE recommended=" not in text:
        raise SystemExit(text.strip() or "FAIL selftest: compare")
    comp_report = json.loads((tmp / "compare-out" / "qc" / "report.json").read_text())
    comparison = comp_report.get("comparison") or {}
    if comparison.get("schema") != "walkaround-compare-1":
        raise SystemExit(f"FAIL selftest: comparison schema {comparison.get('schema')}")
    ids = [row["id"] for row in comparison.get("methods") or []]
    if ids != ["default", "primitive-box"]:
        raise SystemExit(f"FAIL selftest: methods {ids}")
    if not (tmp / "compare-out" / "qc" / "report.md").is_file():
        raise SystemExit("FAIL selftest: report.md missing")
    for name in ("side-000.png", "side-090.png", "side-180.png", "side-270.png", "three-quarter.png"):
        for method in ("default", "primitive-box"):
            thumb = tmp / "compare-out" / "qc" / "compare" / method / name
            if not thumb.is_file():
                raise SystemExit(f"FAIL selftest: missing {thumb}")
    if comparison.get("recommended") not in ids:
        raise SystemExit("FAIL selftest: recommended method")
    assert_depth(comp_report, comp_report["depthMetrics"]["refinement"]["source"])
    sheet = contact_sheet(tmp / "compare-out" / "qc" / "compare")
    proof = TOOL / "proof"
    proof.mkdir(parents=True, exist_ok=True)
    sheet.save(proof / "shape-compare.png")
    print("selftest compare ok", "recommended", comparison.get("recommended"))


def contact_sheet(root: Path) -> Image.Image:
    tiles = []
    for method in ("default", "primitive-box"):
        for name in ("side-000.png", "side-090.png", "side-180.png", "side-270.png", "three-quarter.png"):
            tiles.append(Image.open(root / method / name).convert("RGB"))
    w, h = tiles[0].size
    sheet = Image.new("RGB", (w * 5 + 16, h * 2 + 8), (0, 0, 0))
    for i, tile in enumerate(tiles):
        sheet.paste(tile, ((i % 5) * (w + 4), (i // 5) * (h + 4)))
    return sheet


def side_by_side(left: Path, right: Path, dest: Path, scale: int = 1) -> None:
    a = Image.open(left).convert("RGB")
    b = Image.open(right).convert("RGB")
    if scale != 1:
        a = a.resize((a.width * scale, a.height * scale), Image.Resampling.NEAREST)
        b = b.resize((b.width * scale, b.height * scale), Image.Resampling.NEAREST)
    gap = 4 * scale
    canvas = Image.new("RGB", (a.width + gap + b.width, max(a.height, b.height)), (0, 0, 0))
    canvas.paste(a, (0, 0))
    canvas.paste(b, (a.width + gap, 0))
    dest.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dest)


def viewing_pair(before: Path, after: Path, dest: Path) -> None:
    """Same camera and fov, more pixels, so the staircase is visible. Not a legal QC."""
    sys.path.insert(0, str(TOOL))
    import hull
    import surface

    def load(out: Path):
        asset = json.loads((out / "asset.json").read_text())
        z = np.load(out / "hull.npz")
        views = []
        for cam in asset["cameras"]:
            rgba = np.array(Image.open(out / "views" / cam["file"]).convert("RGBA"))
            mask = np.array(Image.open(out / "masks" / cam["file"]).convert("L")) > 127
            views.append(
                {
                    "rgba": rgba,
                    "mask": mask,
                    "width": int(cam["width"]),
                    "height": int(cam["height"]),
                    "fovY": float(cam["fovYDeg"]),
                    "cam": {
                        "position": np.array(cam["position"], np.float64),
                        "right": np.array(cam["right"], np.float64),
                        "up": np.array(cam["up"], np.float64),
                        "forward": np.array(cam["forward"], np.float64),
                    },
                    "group": cam.get("group", "body"),
                }
            )
        return asset, z, views

    asset_b, zb, views_b = load(before)
    _asset_a, za, views_a = load(after)
    cam = dict(views_b[2]["cam"])
    # yaw-090 is the third still in this set. Same eye for both renders.
    fov = float(views_b[2]["fovY"])
    w, h = 480, 600
    solid = zb["solid"].astype(bool)
    half = -zb["origin"].astype(np.float64)
    surf = {
        "viewVol": zb["viewVol"],
        "seamVol": zb["seamVol"],
        "seamWVol": zb["seamWeightVol"],
    }
    rgba_b, _ = hull.render_view(solid, surf, views_b, half.astype(np.float64), zb["voxelSize"], cam, w, h, fov)
    bias = max(2.5 * float(np.min(za["voxelSize"])), 1e-3)
    zbuf = [
        surface.render_zbuffer(za["meshVertices"], za["meshIndices"], v["cam"], v["width"], v["height"], v["fovY"])
        for v in views_a
    ]
    groups = za["meshGroup"].astype(np.int32)
    ranges = []
    for i, v in enumerate(views_a):
        if not ranges or ranges[-1][2] != v["group"]:
            ranges.append([i, 1, v["group"]])
        else:
            ranges[-1][1] += 1
    group_ranges = [(r[0], r[1]) for r in ranges]
    buffers = surface.rasterize_mesh(
        za["meshVertices"], za["meshNormals"], za["meshIndices"], groups, cam, w, h, fov
    )
    rgba_a, _ = surface.project_fragments(buffers, views_a, zbuf, group_ranges, bias)
    side = Image.new("RGB", (w * 2 + 8, h), (0, 0, 0))
    side.paste(Image.fromarray(rgba_b[:, :, :3], "RGB"), (0, 0))
    side.paste(Image.fromarray(rgba_a[:, :, :3], "RGB"), (w + 8, 0))
    dest.parent.mkdir(parents=True, exist_ok=True)
    side.save(dest)


def write_proof(tmp: Path) -> None:
    proof = TOOL / "proof"
    proof.mkdir(parents=True, exist_ok=True)
    pinned = json.loads((ROCK / "config.json").read_text())
    old = json.loads((ROCK / "out" / "qc" / "report.json").read_text())
    dist = float(old["magnification"]["approachMinDistance"])
    pinned["approach"] = {"minDistance": dist}
    cfg = tmp / "pinned.json"
    cfg.write_text(json.dumps(pinned, indent=2) + "\n")
    before = tmp / "proof-before"
    after = tmp / "proof-after"
    build(ROCK / "views", cfg, before, ["--legacy-voxels", "--depth-dir", str(ROCK / "depth")])
    build(ROCK / "views", cfg, after, ["--depth-dir", str(ROCK / "depth")])
    for name in ("yaw-000.png", "yaw-090.png", "behind.png"):
        shutil.copyfile(before / "qc" / name, proof / f"before-{name}")
        shutil.copyfile(after / "qc" / name, proof / f"after-{name}")
        side_by_side(before / "qc" / name, after / "qc" / name, proof / f"compare-{name}")
        side_by_side(before / "qc" / name, after / "qc" / name, proof / f"compare-{name.replace('.png', '-x4.png')}", scale=4)
    viewing_pair(before, after, proof / "viewing-yaw-090.png")
    # Elevation and a supplied part. These are not the before/after pair.
    bowl = tmp / "bowl-src"
    if not (bowl / "config.json").exists():
        call([PY, str(TOOL / "make_synthetic.py"), "--kind", "bowl", "--out", str(bowl)])
        build(bowl / "views", bowl / "config.json", tmp / "bowl-out", ["--surface-grid", "48", "--smooth-iters", "4"])
    shutil.copyfile(tmp / "bowl-out" / "qc" / "top.png", proof / "bowl-top.png")
    assembly = tmp / "assembly-src"
    if not (assembly / "config.json").exists():
        call([PY, str(TOOL / "make_synthetic.py"), "--kind", "assembly", "--out", str(assembly)])
        build(
            assembly / "views",
            assembly / "config.json",
            tmp / "assembly-out",
            ["--surface-grid", "48", "--smooth-iters", "4"],
        )
    shutil.copyfile(tmp / "assembly-out" / "qc" / "yaw-090.png", proof / "assembly-yaw-090.png")
    after_report = json.loads((after / "qc" / "report.json").read_text())
    before_report = json.loads((before / "qc" / "report.json").read_text())
    note = {
        "cameraDistance": dist,
        "before": {
            "surface": before_report["hull"]["surface"],
            "vertices": before_report["hull"]["vertexCount"],
            "magnification": before_report["magnification"]["max"],
        },
        "after": {
            "surface": after_report["hull"]["surface"],
            "vertices": after_report["hull"]["vertexCount"],
            "triangles": after_report["hull"]["triangleCount"],
            "edges": after_report["hull"]["edges"],
            "magnification": after_report["magnification"]["max"],
            "seam": after_report["seam"]["meanFragmentSeamFraction"],
            "sources": after_report["sources"],
        },
    }
    (proof / "report.json").write_text(json.dumps(note, indent=2) + "\n")
    print("proof stills", proof)


def _eight(folder: Path, painter) -> tuple[Path, Path]:
    views = folder / "views"
    views.mkdir(parents=True)
    entries = []
    for yaw in range(0, 360, 45):
        name = f"yaw-{yaw:03d}.png"
        painter(views / name)
        entries.append({"file": name, "yawDeg": float(yaw)})
    cfg = {
        "name": folder.name,
        "objectSize": [1.2, 1.2, 1.2],
        "vote": 7,
        "grid": 16,
        "bgThreshold": 0.04,
        "camera": {"distance": 3.0, "eyeY": 0.0, "fovYDeg": 40.0},
        "views": entries,
    }
    config = folder / "config.json"
    config.write_text(json.dumps(cfg, indent=2) + "\n")
    return views, config


def _expect_fail(views: Path, config: Path, out: Path, needle: str) -> None:
    if out.exists():
        shutil.rmtree(out)
    code, text = call_raw([PY, str(TOOL / "build.py"), "--views", str(views), "--config", str(config), "--out", str(out)])
    if code == 0 or needle not in text:
        raise SystemExit(f"FAIL selftest: expected {needle}\n{text}")
    if (out / "asset.json").is_file():
        raise SystemExit("FAIL selftest: a rejected view set wrote asset.json")


def check_basis() -> None:
    proc = subprocess.run(
        ["node", "--test", str(TOOL / "runtime" / "basis.test.mjs")],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    if proc.returncode != 0:
        raise SystemExit(proc.stdout + proc.stderr)
    if str(TOOL) not in sys.path:
        sys.path.insert(0, str(TOOL))
    from gates import basis_report, view_index

    yaws = [float(i) for i in range(0, 360, 45)]
    if view_index(90.0, yaws) != yaws.index(90.0):
        raise SystemExit("FAIL selftest: bearing 90 did not select yaw 90")
    if view_index(90.0, yaws) == yaws.index(270.0):
        raise SystemExit("FAIL selftest: bearing 90 selected the mirror yaw")
    probe = basis_report([])
    if probe.get("status") != "PASS" or not probe.get("plusXAtYaw0IsScreenRight"):
        raise SystemExit(f"FAIL selftest: basis probe {probe}")
    print("selftest basis ok")


def check_rejects(tmp: Path) -> None:
    def cropped(path: Path) -> None:
        rgb = np.zeros((200, 160, 3), np.uint8)
        rgb[0:140, 30:130] = (180, 180, 180)
        Image.fromarray(rgb, "RGB").save(path)

    def holed(path: Path) -> None:
        h, w = 200, 160
        rgba = np.zeros((h, w, 4), np.uint8)
        ys, xs = np.mgrid[0:h, 0:w]
        body = ((ys - 100) / 60) ** 2 + ((xs - 80) / 40) ** 2 <= 1
        hole = ((ys - 100) / 18) ** 2 + ((xs - 80) / 14) ** 2 <= 1
        rgba[body] = (200, 180, 160, 255)
        rgba[hole] = (0, 0, 0, 0)
        Image.fromarray(rgba, "RGBA").save(path)

    def oversized(path: Path) -> None:
        rgb = np.zeros((80, 2100, 3), np.uint8)
        rgb[12:68, 80:2020] = (160, 160, 160)
        Image.fromarray(rgb, "RGB").save(path)

    views, config = _eight(tmp / "cropped", cropped)
    _expect_fail(views, config, tmp / "cropped-out", "FAIL margin")
    views, config = _eight(tmp / "holed", holed)
    _expect_fail(views, config, tmp / "holed-out", "FAIL holes")
    views, config = _eight(tmp / "oversized", oversized)
    _expect_fail(views, config, tmp / "oversized-out", "FAIL size")
    print("selftest source rejects ok")


def check_law65_play_sampling() -> None:
    """Play viewers sample stills with LINEAR_MIPMAP_LINEAR. QC nearest is measurement only.

    Law 65 (biome/docs/65-render-quality.md). Magnification limit stays 1.0.
    Issue https://github.com/StarBoltSprint/boltverse-odyssey/issues/153.
    """
    view = (TOOL / "web" / "view.html").read_text()
    runtime = (TOOL / "runtime" / "hullmesh.js").read_text()
    hull_src = (TOOL / "hull.py").read_text()
    surface_src = (TOOL / "surface.py").read_text()

    if "MAG_LIMIT = 1.0" not in hull_src:
        raise SystemExit("FAIL selftest: magnification limit is not 1.0")

    for label, text in (("view.html", view), ("hullmesh.js", runtime)):
        if "LINEAR_MIPMAP_LINEAR" not in text:
            raise SystemExit(f"FAIL selftest: {label} does not set LINEAR_MIPMAP_LINEAR")
        if "generateMipmap" not in text:
            raise SystemExit(f"FAIL selftest: {label} does not build mipmaps")
        if re.search(r"TEXTURE_(?:MIN|MAG)_FILTER\s*,\s*gl\.NEAREST", text):
            raise SystemExit(f"FAIL selftest: {label} sets NEAREST on a texture")
        if "texture(uViews" not in text:
            raise SystemExit(f"FAIL selftest: {label} colour pass does not sample with texture()")
        if re.search(r"\bcol\s*=\s*texelFetch", text):
            raise SystemExit(f"FAIL selftest: {label} colour is a texelFetch")

    proc = subprocess.run(
        [
            "node",
            str(ROOT / "tools" / "playcheck" / "src" / "renderlint.mjs"),
            str(TOOL / "web" / "view.html"),
            str(TOOL / "runtime" / "hullmesh.js"),
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    if proc.returncode != 0:
        raise SystemExit(
            "FAIL selftest: play viewer renderlint\n" + (proc.stdout or "") + (proc.stderr or "")
        )

    if '"sampling": "nearest"' in hull_src or '"mipmaps": False' in hull_src:
        raise SystemExit("FAIL selftest: hull asset still records nearest play sampling")
    if "LINEAR_MIPMAP_LINEAR" not in hull_src:
        raise SystemExit("FAIL selftest: hull asset does not record LINEAR_MIPMAP_LINEAR")

    sampler = surface_src.split("def _sample_nearest", 1)[-1][:500]
    if "measurement" not in sampler or "not the play view" not in sampler:
        raise SystemExit("FAIL selftest: QC nearest sampler is not marked measurement-only")
    print("selftest law65 sampling ok")


def main() -> int:
    proof = "--proof" in sys.argv
    check_law65_play_sampling()
    check_basis()
    with tempfile.TemporaryDirectory(prefix="walkaround-selftest-") as raw:
        tmp = Path(raw)
        check_rejects(tmp)
        check_rock(tmp)
        check_bowl(tmp)
        check_assembly(tmp)
        check_shapes(tmp)
        if proof:
            write_proof(tmp)
    print("PASS selftest")
    return 0


if __name__ == "__main__":
    sys.exit(main())

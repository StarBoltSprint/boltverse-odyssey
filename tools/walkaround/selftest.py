#!/usr/bin/env python3
"""Checks for the walk-around hull. Synthetic stills only. Not Imagine pixels.

  python3 tools/walkaround/selftest.py
  python3 tools/walkaround/selftest.py --proof
"""

from __future__ import annotations

import json
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
    proc = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True)
    text = (proc.stdout or "") + (proc.stderr or "")
    if proc.returncode != 0:
        raise SystemExit(text.strip() or f"FAIL command {cmd}")
    return text


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


def main() -> int:
    proof = "--proof" in sys.argv
    with tempfile.TemporaryDirectory(prefix="walkaround-selftest-") as raw:
        tmp = Path(raw)
        check_rock(tmp)
        check_bowl(tmp)
        check_assembly(tmp)
        if proof:
            write_proof(tmp)
    print("PASS selftest")
    return 0


if __name__ == "__main__":
    sys.exit(main())

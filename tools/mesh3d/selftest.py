#!/usr/bin/env python3
"""Synthetic checks for the invisible mesh. Not Imagine pixels.

  python3 tools/mesh3d/selftest.py
"""

from __future__ import annotations

import inspect
import json
import re
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from cameras import camera_pose, fov_y_deg, project_points, yaw_weight  # noqa: E402
from engines import align_yaw_scale, carve_visual_hull, triposr_status  # noqa: E402
from meshio import write_glb, write_obj  # noqa: E402
from shade import (  # noqa: E402
    build_source_z,
    coverage_ratio,
    fit_view_distance,
    ground_half,
    mask_iou,
    prepare_sources,
    render_frame,
    shade_points,
    silhouette,
)


def box_mesh(hx: float, hy: float, hz: float):
    c = np.array(
        [
            [-hx, -hy, -hz],
            [hx, -hy, -hz],
            [hx, -hy, hz],
            [-hx, -hy, hz],
            [-hx, hy, -hz],
            [hx, hy, -hz],
            [hx, hy, hz],
            [-hx, hy, hz],
        ],
        np.float32,
    )
    quads = [
        (0, 1, 2, 3),  # bottom
        (4, 7, 6, 5),  # top
        (0, 4, 5, 1),
        (1, 5, 6, 2),
        (2, 6, 7, 3),
        (3, 7, 4, 0),
    ]
    faces = []
    for a, b, c1, d in quads:
        faces.append((a, b, c1))
        faces.append((a, c1, d))
    faces = np.array(faces, np.int32)
    normals = np.zeros_like(c)
    # Radial normals are enough for the raster front test; face winding is CCW outward
    # if we look from outside. vertex normals from faces:
    from engines import _surface

    normals = _surface().vertex_normals(c, faces)
    return c, normals, faces


def paint(vertices, normals, faces, cam, w, h, fov_y, color) -> np.ndarray:
    from shade import rasterize

    buf = rasterize(vertices, normals, faces, cam, w, h, fov_y, want_attr=False)
    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[buf["hit"], 0] = color[0]
    rgba[buf["hit"], 1] = color[1]
    rgba[buf["hit"], 2] = color[2]
    rgba[buf["hit"], 3] = 255
    return rgba


def check_weights() -> None:
    if abs(yaw_weight(0) - 1.0) > 1e-6:
        raise SystemExit("FAIL weight 0")
    if abs(yaw_weight(45) - float(np.cos(np.deg2rad(45)))) > 1e-6:
        raise SystemExit("FAIL weight 45")
    if yaw_weight(45.01) != 0.0 or yaw_weight(-90) != 0.0:
        raise SystemExit("FAIL weight past 45")
    if abs(yaw_weight(360) - 1.0) > 1e-6:
        raise SystemExit("FAIL weight wrap")


def check_handedness() -> None:
    cam = camera_pose(0.0, 4.0, 0.0)
    point = np.array([[1.0, 0.0, 0.0]])
    u, _v, z = project_points(point, cam, 100, 100, fov_y_deg(24, 100, 100))
    if z[0] <= 0 or u[0] <= 50:
        raise SystemExit(f"FAIL handedness u={u[0]} z={z[0]}")


def check_projection_roundtrip() -> None:
    verts, normals, faces = box_mesh(0.40, 0.16, 0.22)
    w, h = 96, 54
    hfov = 24.0
    dist = 4.0
    elev = 18.0
    colors = {
        0: (220, 0, 0),
        45: (0, 0, 220),
        90: (0, 255, 0),
        180: (0, 128, 255),
        270: (255, 128, 0),
        315: (180, 0, 180),
    }
    views = []
    for yaw, color in colors.items():
        cam = camera_pose(yaw, dist, elev)
        fov = fov_y_deg(hfov, w, h)
        rgba = paint(verts, normals, faces, cam, w, h, fov, color)
        mask = rgba[:, :, 3] > 16
        if mask.sum() < 20:
            raise SystemExit(f"FAIL synthetic view {yaw} empty")
        views.append(
            {
                "file": f"yaw-{yaw:03d}.png",
                "path": "",
                "yawDeg": float(yaw),
                "rgba": rgba,
                "mask": mask,
                "width": w,
                "height": h,
            }
        )
    hull_views = [v for v in views if v["yawDeg"] in (0, 90, 180, 270)]
    mesh = carve_visual_hull(hull_views, (0, 90, 180, 270), dist, elev, hfov, grid=28, min_votes=4, dilate_px=0)
    if len(mesh["faces"]) < 8:
        raise SystemExit(f"FAIL hull faces {len(mesh['faces'])}")
    cam0 = camera_pose(0, dist, elev)
    fov = fov_y_deg(hfov, w, h)
    hit = silhouette(mesh["vertices"], mesh["faces"], cam0, w, h, fov)
    iou = mask_iou(hit, views[0]["mask"])
    if iou < 0.55:
        raise SystemExit(f"FAIL hull iou {iou:.3f}")

    sources = []
    for view in views:
        sources.append({**view, "cam": camera_pose(view["yawDeg"], dist, elev), "fovY": fov})
    zbuffers = build_source_z(mesh["vertices"], mesh["normals"], mesh["faces"], sources, z_scale=1.0)
    rgba, stats = render_frame(
        mesh["vertices"], mesh["normals"], mesh["faces"],
        camera_pose(0, dist, elev), sources, zbuffers, w, h, fov, None, 0.06,
    )
    if coverage_ratio(stats) < 0.7:
        raise SystemExit(f"FAIL coverage at yaw 0 {stats}")
    covered = rgba[:, :, 3] > 0
    # Viewer yaw 0 may blend 315 and 45 (both at 45°). Yaw 90 is the green sentinel.
    rgb = rgba[covered][:, :3].astype(np.int16)
    if rgb[:, 1].max() > 8:
        raise SystemExit(f"FAIL yaw 0 picked up yaw 90 green maxG={int(rgb[:, 1].max())}")
    if rgb[:, 0].max() < 150 or rgb[:, 2].max() > 230:
        raise SystemExit(f"FAIL yaw 0 colour left the 0/45/315 sources max={rgb.max(axis=0).tolist()}")
    empty = rgba[:, :, 3] == 0
    if np.any(rgba[empty][:, :3] != 0):
        raise SystemExit("FAIL uncovered texel was filled")

    mid, mid_stats = render_frame(
        mesh["vertices"], mesh["normals"], mesh["faces"],
        camera_pose(22.5, dist, elev), sources, zbuffers, w, h, fov, None, 0.06,
    )
    if mid_stats["ghostMean"] < 0.25:
        raise SystemExit(f"FAIL expected ghost at the 22.5 seam, got {mid_stats}")
    seam = (mid[:, :, 0] > 30) & (mid[:, :, 2] > 30) & (mid[:, :, 3] > 0)
    if int(seam.sum()) < 5:
        raise SystemExit(f"FAIL midpoint did not blend the two front views {mid_stats}")

    lows = mesh["vertices"]
    belly = lows[lows[:, 1] <= np.percentile(lows[:, 1], 12)]
    _rgb, belly_a, _delta = shade_points(belly, 0.0, sources, zbuffers, 0.06)
    if int(belly_a.max()) > 0:
        raise SystemExit(f"FAIL belly vertices were coloured {(belly_a > 0).mean():.2f}")
    low, low_stats = render_frame(
        mesh["vertices"], mesh["normals"], mesh["faces"],
        camera_pose(0, dist, -40), sources, zbuffers, w, h, fov, None, 0.06,
    )
    if low_stats["visible"] < 10:
        raise SystemExit("FAIL low camera saw nothing")
    if np.any(low[low[:, :, 3] == 0][:, :3] != 0):
        raise SystemExit("FAIL uncovered fill on the low camera")

    ground = ground_half(mesh["vertices"])
    buried, bstats = render_frame(
        mesh["vertices"], mesh["normals"], mesh["faces"],
        camera_pose(0, dist, elev), sources, zbuffers, w, h, fov, ground, 0.06,
    )
    if bstats["visible"] >= stats["visible"]:
        raise SystemExit("FAIL half-bury did not hide surface")
    if coverage_ratio(bstats) + 1e-6 < coverage_ratio(stats):
        raise SystemExit(
            f"FAIL bury coverage {coverage_ratio(bstats):.3f} < open {coverage_ratio(stats):.3f}"
        )

    fit = fit_view_distance(
        mesh["vertices"], mesh["faces"], views, (0, 90, 180, 270),
        dist, elev, hfov, 720, 1600, limit=1.0,
    )
    if not fit["withinLimit"] or fit["maxMagnification"] > 1.0 + 1e-3:
        raise SystemExit(f"FAIL magnification {fit}")
    if fit["viewDistance"] <= dist:
        raise SystemExit("FAIL phone camera was not pulled back from a small source")

    # Alignment recovers a yaw on the same box.
    from engines import transform_vertices

    spun = transform_vertices(verts, 30.0, 1.0, verts.mean(axis=0))
    aligned = align_yaw_scale(spun, faces, views, (0, 90, 180, 270), dist, elev, hfov, _iou_full)
    if aligned["iou"] < 0.45:
        raise SystemExit(f"FAIL align iou {aligned['iou']:.3f} yaw {aligned['yawDeg']}")


def _iou_full(vertices, faces, view, cam, fov_y) -> float:
    hit = silhouette(vertices, faces, cam, view["width"], view["height"], fov_y)
    return mask_iou(hit, view["mask"])


def check_files() -> None:
    verts, normals, faces = box_mesh(0.2, 0.2, 0.2)
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        write_obj(root / "m.obj", verts, normals, faces)
        text = (root / "m.obj").read_text()
        if "\nvt " in text or text.startswith("vt ") or "\nusemtl" in text:
            raise SystemExit("FAIL obj carries a texture")
        write_glb(root / "m.glb", verts, normals, faces)
        blob = (root / "m.glb").read_bytes()
        magic, version, length = struct.unpack_from("<III", blob, 0)
        if magic != 0x46546C67 or version != 2 or length != len(blob):
            raise SystemExit(f"FAIL glb header {magic:x} {version} {length} {len(blob)}")
        jlen = struct.unpack_from("<I", blob, 12)[0]
        js = blob[20 : 20 + jlen].decode("utf-8").strip()
        doc = json.loads(js)
        raw = json.dumps(doc)
        if "baseColor" in raw or "COLOR" in raw or "emissive" in raw:
            raise SystemExit("FAIL glb has a colour")
        if doc["meshes"][0]["extras"].get("invisibleShape") is not True:
            raise SystemExit("FAIL glb extras")


def check_status() -> None:
    ok, reason = triposr_status()
    if not isinstance(ok, bool) or not reason:
        raise SystemExit("FAIL triposr status")
    # Weights may be present on this machine and absent in CI. Either is honest.
    print(f"triposr available={ok} reason={reason[:180]}")


def check_law65_and_triposr() -> None:
    """Play stills use mipmaps. TripoSR is not auto and cannot feed a play build.

    Law 65 and the golden rule (2026-10-02). Magnification limit stays 1.0.
    Issue https://github.com/StarBoltSprint/boltverse-odyssey/issues/153.
    """
    viewer = (HERE / "viewer" / "main.js").read_text()
    build_src = (HERE / "build.py").read_text()
    shade_src = (HERE / "shade.py").read_text()

    if inspect.signature(fit_view_distance).parameters["limit"].default != 1.0:
        raise SystemExit("FAIL magnification limit was loosened")

    loader = viewer.split("function loadTexture", 1)[-1]
    if "NearestFilter" in loader:
        raise SystemExit("FAIL mesh3d viewer samples Imagine stills with NEAREST")
    if "LinearMipmapLinearFilter" not in loader or "generateMipmaps = true" not in loader:
        raise SystemExit("FAIL mesh3d viewer stills are not LINEAR_MIPMAP_LINEAR with mipmaps")
    colour = re.search(r"vec2 uv = ([^;]+);\s*vec4 src = fetchMap", viewer)
    if colour is None or "floor" in colour.group(1):
        raise SystemExit("FAIL mesh3d play colour snaps to a nearest texel")
    depth = viewer.split("new THREE.WebGLRenderTarget", 1)[-1][:500]
    if "NearestFilter" in depth and "measurement" not in depth:
        raise SystemExit("FAIL depth nearest is not marked as a measurement buffer")

    proc = subprocess.run(
        [
            "node",
            str(HERE.parent / "playcheck" / "src" / "renderlint.mjs"),
            str(HERE / "viewer" / "main.js"),
        ],
        text=True,
        capture_output=True,
    )
    if proc.returncode != 0:
        raise SystemExit("FAIL mesh3d viewer renderlint\n" + (proc.stdout or "") + (proc.stderr or ""))

    if re.search(r"""engine\s+in\s+\(\s*['\"]auto['\"]\s*,\s*['\"]triposr['\"]\s*\)""", build_src):
        raise SystemExit("FAIL triposr is an auto engine")
    if re.search(r"""used\s*=\s*['\"]triposr['\"]""", build_src):
        raise SystemExit("FAIL triposr can replace the play mesh")
    if re.search(r"""choices=\(\s*['\"]auto['\"]\s*,\s*['\"]visual-hull['\"]\s*,\s*['\"]triposr['\"]""", build_src):
        raise SystemExit("FAIL --engine still offers triposr")
    if "--experiment" not in build_src:
        raise SystemExit("FAIL triposr has no labelled experiment flag")
    if "LINEAR_MIPMAP_LINEAR" not in build_src or "source png nearest" in build_src:
        raise SystemExit("FAIL play texture is still described as nearest")

    sampler = shade_src.split("def _sample_nearest", 1)[-1][:500]
    if "measurement" not in sampler or "not the play view" not in sampler:
        raise SystemExit("FAIL QC nearest sampler is not marked measurement-only")

    from build import resolve_shape  # noqa: WPS433

    play = resolve_shape("auto", None)
    if play.get("attemptTriposr") or not play.get("feedsPlay") or play.get("shape") != "visual-hull":
        raise SystemExit(f"FAIL auto shape {play}")
    hull = resolve_shape("visual-hull", None)
    if hull.get("attemptTriposr") or not hull.get("feedsPlay") or hull.get("shape") != "visual-hull":
        raise SystemExit(f"FAIL visual-hull shape {hull}")
    try:
        resolve_shape("triposr", None)
    except SystemExit as exc:
        if "experiment" not in str(exc):
            raise SystemExit(f"FAIL bare triposr refusal {exc}") from exc
    else:
        raise SystemExit("FAIL bare triposr engine was accepted")
    exp = resolve_shape("visual-hull", "triposr")
    if exp.get("shape") != "visual-hull" or exp.get("attemptTriposr") is not True:
        raise SystemExit(f"FAIL experiment policy {exp}")
    if exp.get("experimentFeedsPlay") is not False:
        raise SystemExit("FAIL experiment triposr can feed a play build")
    committed = json.loads((HERE / "out" / "asset.json").read_text())
    if committed.get("engine") == "triposr" and committed.get("feedsPlay") is not False:
        raise SystemExit("FAIL committed triposr asset can feed a play build")
    print("selftest law65 sampling and triposr policy ok")


def main() -> int:
    check_law65_and_triposr()
    check_weights()
    check_handedness()
    check_files()
    check_status()
    check_projection_roundtrip()
    # shade_points is imported so a refactor that drops the blend fails here too.
    _ = shade_points
    print("PASS mesh3d selftest")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

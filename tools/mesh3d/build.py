#!/usr/bin/env python3
"""Project Imagine turnaround views onto an invisible ship mesh.

  python3 tools/mesh3d/build.py --views tools/mesh3d/inputs/ship --out tools/mesh3d/out

The mesh is shape only. Visible pixels are a cos(yaw) blend of Imagine
views, zero past 45 degrees. Uncovered texels stay transparent.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from cameras import HFOV_DEG, camera_pose, fov_y_deg  # noqa: E402
from engines import (  # noqa: E402
    HULL_YAWS,
    PROJECT_YAWS,
    TRIPOSR_CKPT,
    align_yaw_scale,
    carve_visual_hull,
    load_view_pngs,
    triposr_status,
)
from meshio import write_glb, write_obj  # noqa: E402
from shade import (  # noqa: E402
    build_source_z,
    coverage_ratio,
    fit_view_distance,
    ground_half,
    mask_iou,
    prepare_sources,
    render_frame,
    silhouette,
)


PHONE = (720, 1600)
# Stored on the KEEP hero chain. A new turnaround uses +15 (learn/geometry.md).
ELEVATION_DEG = 18.0
PHOTO_DISTANCE = 4.0


def _iou(vertices, faces, view, cam, fov_y) -> float:
    # Alignment only needs the silhouette ratio. A 160 px proxy matches the
    # full plate closely enough and keeps the yaw/scale search on CPU.
    scale = 160.0 / float(view["width"])
    w = 160
    h = max(8, int(round(view["height"] * scale)))
    small = (
        np.array(
            Image.fromarray(view["mask"].astype(np.uint8) * 255).resize(
                (w, h), Image.Resampling.NEAREST
            )
        )
        > 0
    )
    hit = silhouette(vertices, faces, cam, w, h, fov_y_deg(HFOV_DEG, w, h))
    return mask_iou(hit, small)


def _mean_iou(mesh, views, distance, elevation, hfov, yaws) -> float:
    scores = []
    fov_y = fov_y_deg(hfov, views[0]["width"], views[0]["height"])
    # Measure on a 320 px-wide proxy of each still so the gate stays cheap.
    for yaw in yaws:
        from engines import _pick

        view = _pick(views, yaw)
        scale = 320.0 / view["width"]
        w = 320
        h = max(8, int(round(view["height"] * scale)))
        small = np.array(Image.fromarray(view["mask"].astype(np.uint8) * 255).resize((w, h), Image.Resampling.NEAREST)) > 0
        cam = camera_pose(yaw, distance, elevation)
        hit = silhouette(mesh["vertices"], mesh["faces"], cam, w, h, fov_y_deg(hfov, w, h))
        scores.append(mask_iou(hit, small))
    return float(sum(scores) / len(scores))


def _carve_with_one_retry(views, distance, elevation, hfov) -> tuple[dict, list[dict]]:
    """Two carves at most. Keep the higher silhouette IoU. Then stop."""
    tries = []
    settings = (
        {"grid": 40, "min_votes": 3, "dilate_px": 8},
        {"grid": 40, "min_votes": 3, "dilate_px": 18},
    )
    best = None
    for spec in settings:
        mesh = carve_visual_hull(
            views,
            HULL_YAWS,
            distance,
            elevation,
            hfov,
            grid=spec["grid"],
            min_votes=spec["min_votes"],
            dilate_px=spec["dilate_px"],
        )
        if mesh["boundaryTouch"]:
            mesh = carve_visual_hull(
                views,
                HULL_YAWS,
                distance,
                elevation,
                hfov,
                grid=spec["grid"],
                min_votes=spec["min_votes"],
                dilate_px=spec["dilate_px"],
                extent=float(mesh["extent"]) * 1.4,
            )
        iou = _mean_iou(mesh, views, distance, elevation, hfov, HULL_YAWS) if len(mesh["faces"]) else 0.0
        row = {"iou": iou, **spec, "triangles": int(len(mesh["faces"])), "solid": mesh["solidCount"]}
        tries.append(row)
        mesh["silhouetteIoU"] = iou
        if best is None or iou > best["silhouetteIoU"]:
            best = mesh
        if iou >= 0.45 and len(mesh["faces"]) > 0:
            break
    return best, tries


def _try_triposr(image: Path, out_dir: Path) -> dict:
    ok, reason = triposr_status()
    if not ok:
        return {"ok": False, "reason": reason, "attempted": False}
    out_npz = out_dir / "qc" / "triposr.npz"
    note_path = out_npz.with_suffix(".json")
    if out_npz.is_file() and note_path.is_file():
        cached = json.loads(note_path.read_text())
        if cached.get("ok"):
            cached["attempted"] = True
            cached["reused"] = True
            return cached
    cmd = [sys.executable, str(HERE / "triposr_run.py"), str(image), str(out_npz), "48"]
    try:
        proc = subprocess.run(cmd, text=True, capture_output=True, timeout=420)
    except subprocess.TimeoutExpired:
        return {"ok": False, "attempted": True, "reason": "timeout 420s on CPU"}
    note_path = out_npz.with_suffix(".json")
    note = {}
    if note_path.is_file():
        note = json.loads(note_path.read_text())
    note["attempted"] = True
    note["returncode"] = proc.returncode
    if proc.returncode != 0:
        note["ok"] = False
        note.setdefault("reason", (proc.stderr or proc.stdout or "failed")[-500:])
    return note


def _cam_json(cam: dict) -> dict:
    def lst(a):
        return [round(float(x), 6) for x in a]

    return {
        "yawDeg": cam["yawDeg"],
        "elevationDeg": cam["elevationDeg"],
        "distance": cam["distance"],
        "position": lst(cam["position"]),
        "right": lst(cam["right"]),
        "up": lst(cam["up"]),
        "forward": lst(cam["forward"]),
    }


def build(views_dir: Path, out_dir: Path, engine: str, phone_scale: float) -> dict:
    t0 = time.time()
    views = load_view_pngs(views_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "qc").mkdir(exist_ok=True)
    (out_dir / "frames").mkdir(exist_ok=True)
    hull, tries = _carve_with_one_retry(views, PHOTO_DISTANCE, ELEVATION_DEG, HFOV_DEG)
    if hull is None or len(hull["faces"]) == 0:
        raise SystemExit("FAIL mesh3d: visual hull is empty")

    tri_note = {"ok": False, "attempted": False, "reason": "not requested"}
    mesh = hull
    used = "visual-hull"
    if engine in ("auto", "triposr"):
        image = views_dir / "yaw-000.png"
        tri_note = _try_triposr(image, out_dir)
        npz = out_dir / "qc" / "triposr.npz"
        if tri_note.get("ok") and npz.is_file():
            data = np.load(npz)
            aligned = align_yaw_scale(
                data["vertices"],
                data["faces"],
                views,
                HULL_YAWS,
                PHOTO_DISTANCE,
                ELEVATION_DEG,
                HFOV_DEG,
                _iou,
            )
            tri_note["alignIoU"] = aligned["iou"]
            tri_note["alignYawDeg"] = aligned["yawDeg"]
            tri_note["alignScale"] = aligned["scale"]
            if aligned["iou"] >= 0.15 and len(data["faces"]) > 0:
                from engines import _surface

                surf = _surface()
                verts = aligned["vertices"]
                faces = np.asarray(data["faces"], np.int32)
                faces = surf.orient_outward(verts, faces)
                normals = surf.vertex_normals(verts, faces)
                mesh = {
                    "vertices": verts,
                    "faces": faces,
                    "normals": normals,
                    "engine": "triposr",
                    "silhouetteIoU": aligned["iou"],
                }
                used = "triposr"
            else:
                tri_note["ok"] = False
                tri_note["reason"] = (
                    f"aligned silhouette IoU {aligned['iou']:.3f} below 0.15; "
                    "kept the visual hull. Network mesh was not shown."
                )

    sources = prepare_sources(views, PROJECT_YAWS, PHOTO_DISTANCE, ELEVATION_DEG, HFOV_DEG)
    z_bias = 0.08
    zbuffers = build_source_z(mesh["vertices"], mesh["normals"], mesh["faces"], sources, z_scale=0.5)
    phone_w = int(round(PHONE[0] * phone_scale))
    phone_h = int(round(PHONE[1] * phone_scale))
    fit = fit_view_distance(
        mesh["vertices"],
        mesh["faces"],
        views,
        HULL_YAWS,
        PHOTO_DISTANCE,
        ELEVATION_DEG,
        HFOV_DEG,
        PHONE[0],
        PHONE[1],
        limit=1.0,
    )
    if not fit["withinLimit"]:
        raise SystemExit(f"FAIL upscale maxMagnification={fit['maxMagnification']:.3f}")

    ground = ground_half(mesh["vertices"])
    phone_fov = fov_y_deg(HFOV_DEG, phone_w, phone_h)
    orbit = list(range(0, 360, 45))
    frame_stats = []
    sheets = []
    for yaw in orbit:
        viewer = camera_pose(yaw, fit["viewDistance"], ELEVATION_DEG)
        rgba, stats = render_frame(
            mesh["vertices"],
            mesh["normals"],
            mesh["faces"],
            viewer,
            sources,
            zbuffers,
            phone_w,
            phone_h,
            phone_fov,
            ground,
            z_bias,
        )
        stats["yawDeg"] = yaw
        stats["coverage"] = coverage_ratio(stats)
        frame_stats.append(stats)
        print(
            f"frame yaw={yaw:03d} coverage={stats['coverage']:.3f} "
            f"visible={stats['visible']} ghost={stats['ghostMean']:.3f}",
            flush=True,
        )
        frame_path = out_dir / "frames" / f"yaw-{yaw:03d}.png"
        Image.fromarray(rgba, "RGBA").save(frame_path)
        sheets.append(rgba)

    cols, rows = 4, 2
    sheet = Image.new("RGBA", (phone_w * cols, phone_h * rows), (0, 0, 0, 0))
    for i, rgba in enumerate(sheets):
        im = Image.fromarray(rgba, "RGBA")
        sheet.paste(im, ((i % cols) * phone_w, (i // cols) * phone_h))
    sheet_path = out_dir / "contact.png"
    sheet.save(sheet_path)

    mp4 = out_dir / "orbit.mp4"
    ffmpeg = shutil.which("ffmpeg")
    mp4_note = "ffmpeg missing"
    if ffmpeg:
        # Black stands in for empty alpha. It is not a sky texture.
        pattern = out_dir / "frames" / "yaw-%03d.png"
        # The files are yaw-000, yaw-045, ... ffmpeg %03d wants 000,001.
        seq = out_dir / "frames" / "seq"
        if seq.exists():
            shutil.rmtree(seq)
        seq.mkdir()
        for i, yaw in enumerate(orbit):
            src = out_dir / "frames" / f"yaw-{yaw:03d}.png"
            im = Image.open(src).convert("RGBA")
            bg = Image.new("RGB", im.size, (0, 0, 0))
            bg.paste(im, mask=im.getchannel("A"))
            bg.save(seq / f"f-{i:03d}.png")
        proc = subprocess.run(
            [
                ffmpeg, "-y", "-framerate", "2", "-i", str(seq / "f-%03d.png"),
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                str(mp4),
            ],
            capture_output=True, text=True,
        )
        mp4_note = "ok" if proc.returncode == 0 else (proc.stderr or "ffmpeg failed")[-300:]

    coverages = [row["coverage"] for row in frame_stats if row["visible"] > 0]
    ghosts = [row["ghostMean"] for row in frame_stats if row["blended"] > 0]
    write_obj(out_dir / "ship.obj", mesh["vertices"], mesh["normals"], mesh["faces"])
    write_glb(out_dir / "ship.glb", mesh["vertices"], mesh["normals"], mesh["faces"])

    # Per-texel coverage lives in the frame alpha (255 covered, 0 unseen or uncovered).
    # Face flags: a face whose centroid is covered from at least one orbit yaw.
    centroids = mesh["vertices"][mesh["faces"]].mean(axis=1)
    face_visible = np.zeros(len(mesh["faces"]), np.uint8)
    face_covered = np.zeros(len(mesh["faces"]), np.uint8)
    from shade import shade_points

    for yaw in orbit:
        above = centroids[:, 1] >= ground
        rgb, alpha, _delta = shade_points(centroids, yaw, sources, zbuffers, z_bias)
        face_visible[above] = 1
        face_covered[(above) & (alpha > 0)] = 1
    np.savez(
        out_dir / "coverage.npz",
        faceVisible=face_visible,
        faceCovered=face_covered,
        screenYaw=np.array([row["yawDeg"] for row in frame_stats], np.float32),
        screenVisible=np.array([row["visible"] for row in frame_stats], np.int32),
        screenCovered=np.array([row["covered"] for row in frame_stats], np.int32),
    )
    face_vis_n = int(face_visible.sum())
    face_cov = float(face_covered.sum()) / float(face_vis_n) if face_vis_n else 0.0

    asset = {
        "schema": "mesh3d-real-1",
        "engine": used,
        "drawsOwnPixels": False,
        "unlit": True,
        "blend": "cos(yawDelta), zero past 45deg",
        "elevationDeg": ELEVATION_DEG,
        "elevationSource": "KEEP prompt, eighteen degrees (learn/recipes/hull-ship-xai-starship-hero.md)",
        "hfovDeg": HFOV_DEG,
        "photoDistance": PHOTO_DISTANCE,
        "viewDistance": fit["viewDistance"],
        "groundY": ground,
        "bury": "half",
        "zBias": z_bias,
        "phone": [phone_w, phone_h],
        "projectYaws": list(PROJECT_YAWS),
        "hullYaws": list(HULL_YAWS),
        "views": [
            {
                "file": s["file"],
                "yawDeg": s["yawDeg"],
                "width": s["width"],
                "height": s["height"],
                "fovYDeg": s["fovY"],
                "camera": _cam_json(s["cam"]),
            }
            for s in sources
        ],
        "mesh": "ship.obj",
        "glb": "ship.glb",
        "triangles": int(len(mesh["faces"])),
        "vertices": int(len(mesh["vertices"])),
    }
    (out_dir / "asset.json").write_text(json.dumps(asset, indent=2) + "\n")

    report = {
        "ok": True,
        "engine": used,
        "visualHullTries": tries,
        "visualHullIoU": hull.get("silhouetteIoU"),
        "triposr": {k: v for k, v in tri_note.items() if k != "vertices"},
        "triposrWeights": str(TRIPOSR_CKPT),
        "triangles": int(len(mesh["faces"])),
        "vertices": int(len(mesh["vertices"])),
        "texture": "source png nearest, 1280x720, no atlas upsample",
        "phone": [phone_w, phone_h],
        "maxMagnification": fit["maxMagnification"],
        "magnificationPerView": fit["perView"],
        "viewDistance": fit["viewDistance"],
        "photoDistance": PHOTO_DISTANCE,
        "coverageByYaw": [
            {"yawDeg": row["yawDeg"], "visible": row["visible"], "covered": row["covered"], "fraction": row["coverage"]}
            for row in frame_stats
        ],
        "coverageMean": float(sum(coverages) / len(coverages)) if coverages else 0.0,
        "coverageMin": float(min(coverages)) if coverages else 0.0,
        "coverageFaceHalfBuried": face_cov,
        "coverageFaceNote": "above-ground face centroids that received a real texel from at least one orbit yaw; no facing test; coverageByYaw is the claim",
        "ghostMean": float(sum(ghosts) / len(ghosts)) if ghosts else 0.0,
        "ghostMax": float(max(ghosts)) if ghosts else 0.0,
        "seconds": round(time.time() - t0, 2),
        "mp4": mp4_note,
        "frames": "tools/mesh3d/out/frames",
        "contact": "tools/mesh3d/out/contact.png",
    }
    (out_dir / "qc" / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    cov = report["coverageMean"]
    mag = report["maxMagnification"]
    print(
        f"PASS mesh3d engine={used} coverageMean={cov:.3f} coverageMin={report['coverageMin']:.3f} "
        f"maxMagnification={mag:.3f} triangles={report['triangles']} ghostMean={report['ghostMean']:.3f}"
    )
    return report


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Invisible mesh + Imagine projection")
    parser.add_argument("--views", type=Path, default=HERE / "inputs" / "ship")
    parser.add_argument("--out", type=Path, default=HERE / "out")
    parser.add_argument("--engine", choices=("auto", "visual-hull", "triposr"), default="visual-hull")
    parser.add_argument("--phone-scale", type=float, default=1.0)
    args = parser.parse_args()
    build(args.views, args.out, args.engine, args.phone_scale)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

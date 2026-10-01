"""Comparison block for walkaround --compare.

Schema walkaround-compare-1. Scores are a reading aid. A FAIL stays a FAIL.
Pixels in the thumbnails are nearest samples of the Imagine (or synthetic) stills.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image

import hull
import surface


SCHEMA = "walkaround-compare-1"
THUMBS = (
    ("side-000.png", 0.0, None),
    ("side-090.png", 90.0, None),
    ("side-180.png", 180.0, None),
    ("side-270.png", 270.0, None),
    ("three-quarter.png", 45.0, 35.0),
)


def _iou(pred: np.ndarray, mask: np.ndarray) -> float:
    inter = np.logical_and(pred, mask).sum()
    union = np.logical_or(pred, mask).sum()
    if int(union) <= 0:
        return 0.0
    return float(inter / union)


def _load_views(method_dir: Path) -> tuple[dict, dict, list[dict]]:
    asset = json.loads((method_dir / "asset.json").read_text())
    blob = np.load(method_dir / "hull.npz")
    views = []
    for cam in asset["cameras"]:
        rgba = np.array(Image.open(method_dir / "views" / Path(cam["file"]).name).convert("RGBA"))
        mask_path = method_dir / "masks" / Path(cam["file"]).name
        mask = np.array(Image.open(mask_path).convert("L")) > 127
        views.append(
            {
                "file": Path(cam["file"]).name,
                "rgba": rgba,
                "mask": mask,
                "width": int(cam["width"]),
                "height": int(cam["height"]),
                "fovY": float(cam["fovYDeg"]),
                "yawDeg": float(cam["yawDeg"]),
                "elevationDeg": float(cam.get("elevationDeg") or 0.0),
                "group": cam.get("group", "body"),
                "cam": {
                    "position": np.array(cam["position"], np.float64),
                    "right": np.array(cam["right"], np.float64),
                    "up": np.array(cam["up"], np.float64),
                    "forward": np.array(cam["forward"], np.float64),
                },
            }
        )
    return asset, blob, views


def _body_ranges(views: list[dict]) -> list[tuple[int, int]]:
    ranges = []
    for i, view in enumerate(views):
        name = view.get("group", "body")
        if not ranges or ranges[-1][2] != name:
            ranges.append([i, 1, name])
        else:
            ranges[-1][1] += 1
    return [(row[0], row[1]) for row in ranges]


def silhouette_iou(method_dir: Path) -> dict:
    if not (method_dir / "hull.npz").is_file() or not (method_dir / "asset.json").is_file():
        return {"mean": None, "perView": []}
    asset, blob, views = _load_views(method_dir)
    if "meshVertices" not in blob.files:
        return {"mean": None, "perView": []}
    verts = blob["meshVertices"]
    normals = blob["meshNormals"]
    faces = blob["meshIndices"]
    groups = blob["meshGroup"].astype(np.int32) if "meshGroup" in blob.files else np.zeros(len(verts), np.int32)
    per = []
    for view in views:
        if view["group"] != "body":
            continue
        buffers = surface.rasterize_mesh(
            verts, normals, faces, groups, view["cam"], view["width"], view["height"], view["fovY"]
        )
        per.append(
            {
                "file": view["file"],
                "yawDeg": view["yawDeg"],
                "iou": round(_iou(buffers["hit"], view["mask"]), 4),
                "coverage": round(float(buffers["hit"].sum()) / max(1, int(view["mask"].sum())), 4),
            }
        )
    mean = float(np.mean([row["iou"] for row in per])) if per else None
    return {"mean": None if mean is None else round(mean, 4), "perView": per}


def write_thumbs(method_dir: Path, dest: Path) -> list[str]:
    dest.mkdir(parents=True, exist_ok=True)
    if not (method_dir / "asset.json").is_file() or not (method_dir / "hull.npz").is_file():
        return []
    asset, blob, views = _load_views(method_dir)
    if "meshVertices" not in blob.files or not views:
        return []
    verts = blob["meshVertices"]
    normals = blob["meshNormals"]
    faces = blob["meshIndices"]
    groups = blob["meshGroup"].astype(np.int32) if "meshGroup" in blob.files else np.zeros(len(verts), np.int32)
    ranges = _body_ranges(views)
    width = int(views[0]["width"])
    height = int(views[0]["height"])
    fov = float(views[0]["fovY"])
    distance = float(asset.get("approach", {}).get("minDistance") or np.linalg.norm(views[0]["cam"]["position"]))
    bias = max(2.5 * float(np.min(blob["voxelSize"])), 1e-3)
    zbuffers = [
        surface.render_zbuffer(verts, faces, view["cam"], view["width"], view["height"], view["fovY"]) for view in views
    ]
    written = []
    for name, yaw, elev in THUMBS:
        cam = hull.camera_pose(yaw, distance, 0.0, elev)
        buffers = surface.rasterize_mesh(verts, normals, faces, groups, cam, width, height, fov)
        rgba, _stats = surface.project_fragments(buffers, views, zbuffers, ranges, bias)
        Image.fromarray(rgba, "RGBA").save(dest / name)
        written.append(str(Path("qc") / "compare" / method_dir.name / name))
    return written


def _score(iou: float | None, seam: float | None, stretch: float | None, stretch_kind: str, mag: float | None, holes_ok: bool, ok: bool) -> float:
    iou_s = 0.0 if iou is None else max(0.0, min(1.0, iou))
    seam_s = 0.0 if seam is None else max(0.0, 1.0 - min(1.0, seam))
    if stretch is None:
        stretch_s = 0.0
    elif stretch_kind == "face":
        stretch_s = 1.0 / max(float(stretch), 1.0)
    else:
        stretch_s = max(0.0, 1.0 - abs(float(stretch) - 1.0))
    if mag is None:
        mag_s = 0.0
    elif mag <= 1.0:
        mag_s = 1.0
    else:
        mag_s = 1.0 / float(mag)
    hole_s = 1.0 if holes_ok else 0.0
    score = 0.45 * iou_s + 0.15 * seam_s + 0.15 * stretch_s + 0.15 * mag_s + 0.10 * hole_s
    if not ok:
        score *= 0.25
    return round(float(score), 4)


def _method_row(method_id: str, method_dir: Path, report: dict | None, thumbs: list[str], iou: dict) -> dict:
    report = report or {}
    hull_info = report.get("hull") if isinstance(report.get("hull"), dict) else {}
    seam = report.get("seam") if isinstance(report.get("seam"), dict) else {}
    mag = report.get("magnification") if isinstance(report.get("magnification"), dict) else {}
    holes = report.get("holes") if isinstance(report.get("holes"), dict) else {}
    shape = report.get("shape") if isinstance(report.get("shape"), dict) else {}
    edges = hull_info.get("edges") if isinstance(hull_info.get("edges"), dict) else {}
    face_stretch = shape.get("stretch") if isinstance(shape.get("stretch"), dict) else None
    coverages = [row["coverage"] for row in iou.get("perView") or [] if row.get("coverage") is not None]
    if face_stretch and face_stretch.get("mean") is not None:
        stretch = {"mean": face_stretch.get("mean"), "max": face_stretch.get("max"), "kind": "face"}
        stretch_value = face_stretch.get("mean")
        stretch_kind = "face"
    elif coverages:
        stretch = {
            "mean": round(float(np.mean(coverages)), 4),
            "max": round(float(np.max(coverages)), 4),
            "kind": "coverage",
        }
        stretch_value = stretch["mean"]
        stretch_kind = "coverage"
    else:
        stretch = {"mean": None, "max": None, "kind": "coverage"}
        stretch_value = None
        stretch_kind = "coverage"
    boundary = edges.get("boundary")
    accidental = holes.get("accidentalInteriorHoleFraction")
    holes_ok = (boundary in (0, None) or int(boundary or 0) == 0) and (
        accidental is None or float(accidental) <= 0.01
    )
    if shape.get("ok") is False:
        holes_ok = False
    ok = bool(report.get("ok"))
    depth = report.get("depthMetrics") if isinstance(report.get("depthMetrics"), dict) else {}
    return {
        "id": method_id,
        "ok": ok,
        "surface": hull_info.get("surface"),
        "score": _score(
            iou.get("mean"),
            seam.get("meanFragmentSeamFraction"),
            stretch_value,
            stretch_kind,
            mag.get("max"),
            holes_ok,
            ok,
        ),
        "silhouetteIoU": iou,
        "magnification": mag.get("max"),
        "seam": seam.get("meanFragmentSeamFraction"),
        "stretch": stretch,
        "holes": {
            "boundaryEdges": None if boundary is None else int(boundary),
            "accidentalInteriorHoleFraction": accidental,
            "watertight": holes.get("watertight"),
        },
        "hull": {
            "vertexCount": hull_info.get("vertexCount"),
            "triangleCount": hull_info.get("triangleCount"),
            "surface": hull_info.get("surface"),
            "bboxDepth": (depth or {}).get("bboxDepth", hull_info.get("bboxDepth")),
        },
        "depth": {
            "depthRange": report.get("depthRange"),
            "bboxDepth": (depth or {}).get("bboxDepth"),
            "meanOffsetM": ((depth or {}).get("refinement") or {}).get("meanOffsetM"),
            "maxOffsetM": ((depth or {}).get("refinement") or {}).get("maxOffsetM"),
        },
        "shape": shape or None,
        "thumbnails": thumbs,
        "failures": list(report.get("failures") or []),
    }


def write_comparison(out_dir: Path, methods: list[tuple[str, Path, dict | None]]) -> dict:
    rows = []
    for method_id, method_dir, report in methods:
        thumbs = write_thumbs(method_dir, out_dir / "qc" / "compare" / method_id)
        iou = silhouette_iou(method_dir)
        if report is None:
            report_path = method_dir / "qc" / "report.json"
            if report_path.is_file():
                report = json.loads(report_path.read_text())
        rows.append(_method_row(method_id, method_dir, report, thumbs, iou))
    eligible = [row for row in rows if row["ok"]]
    pool = eligible or rows
    best = max(pool, key=lambda row: row["score"]) if pool else None
    return {
        "schema": SCHEMA,
        "recommended": None if best is None else best["id"],
        "recommendedScore": None if best is None else best["score"],
        "recommendedOk": bool(best and best["ok"]),
        "weights": {
            "silhouetteIoU": 0.45,
            "seam": 0.15,
            "stretch": 0.15,
            "magnification": 0.15,
            "holes": 0.10,
        },
        "note": (
            "Recommended is the highest score among methods with ok true. "
            "A failed optional method is not replaced by the default. "
            "Thumbnails are four sides plus one 3/4-high view, nearest samples of the stills."
        ),
        "methods": rows,
    }


def report_md(comparison: dict) -> str:
    lines = [
        "# Walk-around comparison",
        "",
        f"Schema: `{comparison['schema']}`.",
        "",
        f"Recommended: **{comparison.get('recommended')}** (score {comparison.get('recommendedScore')}).",
        "",
        comparison.get("note") or "",
        "",
        "| method | ok | score | silhouette IoU | magnification | seam | stretch | bbox depth (m) |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for row in comparison.get("methods") or []:
        iou = (row.get("silhouetteIoU") or {}).get("mean")
        stretch = (row.get("stretch") or {}).get("mean")
        depth = (row.get("depth") or {}).get("bboxDepth")
        lines.append(
            "| {id} | {ok} | {score} | {iou} | {mag} | {seam} | {stretch} | {depth} |".format(
                id=row.get("id"),
                ok=row.get("ok"),
                score=row.get("score"),
                iou=iou,
                mag=row.get("magnification"),
                seam=row.get("seam"),
                stretch=stretch,
                depth=depth,
            )
        )
    lines.append("")
    lines.append("Per-view depth metres, refinement offsets, and bounding-box depth are `depthMetrics` in each method's `qc/report.json`.")
    lines.append("`depthRange`, `depthMin`, and `depthMax` are the same near/far span, copied for the report page.")
    lines.append("")
    return "\n".join(lines)

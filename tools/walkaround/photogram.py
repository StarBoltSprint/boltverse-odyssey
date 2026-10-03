"""CPU photogrammetry for one rigid turntable. No GPU.

The shape is invisible. QC colour stays a measurement sample of the HD stills,
not the play view. The play view uses LINEAR_MIPMAP_LINEAR.

Engine `cpu` (the default, and the one the selftest runs):
OpenCV SIFT on extracted frames, matches along the turn, triangulation in the
view-frame cameras, a one-degree yaw refinement, then a star-shaped mesh from
the point cloud. That densifier is one radius per direction around the
centroid. It does not recover a dent or a hole.

Engine `colmap`: COLMAP's CPU sparse mapper (SIFT GPU off, matching GPU off,
bundle adjustment GPU off), then the same star mesh on the aligned points.
If the `colmap` binary is missing, this engine FAILs. It does not switch to
`cpu` and it does not switch to the silhouette hull.

A poor registration FAILs in the report. Nothing here silently substitutes
the default method.
"""

from __future__ import annotations

import math
import shutil
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

import hull
import surface

MIN_REGISTERED_RATIO = 0.70
MAX_MEAN_REPROJ_PX = 2.5
MIN_LOOP_IOU = 0.80
MIN_POINTS = 30
REPROJ_INLIER_PX = 2.5


def _ffmpeg(*args: str) -> None:
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", *args],
        text=True,
        capture_output=True,
    )
    if proc.returncode != 0:
        tail = (proc.stderr or proc.stdout or "ffmpeg failed").strip()
        raise RuntimeError(tail[-800:])


def extract_frames(video: Path, dest: Path, max_frames: int) -> list[Path]:
    """Decode every frame, then keep at most `max_frames`, always the pinned ends."""
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)
    try:
        _ffmpeg("-i", str(video), "-vsync", "0", str(dest / "f%04d.png"))
    except RuntimeError as exc:
        raise RuntimeError(f"FAIL photogrammetry: ffmpeg could not read {video.name}: {exc}") from exc
    frames = sorted(dest.glob("f*.png"))
    if len(frames) < 2:
        raise RuntimeError(
            f"FAIL photogrammetry: {video.name} decoded {len(frames)} frame(s). A turntable clip needs a pinned first and last frame."
        )
    if len(frames) <= max_frames:
        return frames
    # Even samples, forced to include index 0 and the last frame.
    picks = np.linspace(0, len(frames) - 1, int(max_frames))
    idx = sorted({int(round(v)) for v in picks})
    idx[0] = 0
    idx[-1] = len(frames) - 1
    kept = []
    for n, i in enumerate(idx):
        src = frames[i]
        dst = dest / f"k{n:04d}.png"
        if src != dst:
            shutil.copyfile(src, dst)
        kept.append(dst)
    for frame in frames:
        if frame not in kept and frame.exists():
            frame.unlink()
    return kept


def _load_frame(path: Path, threshold: float) -> dict:
    rgba = np.array(Image.open(path).convert("RGBA"))
    mask = hull.silhouette_from_rgba(rgba, threshold, fill_holes=True)
    gray = (
        0.2126 * rgba[:, :, 0] + 0.7152 * rgba[:, :, 1] + 0.0722 * rgba[:, :, 2]
    ).astype(np.uint8)
    return {
        "rgba": rgba,
        "gray": gray,
        "mask": mask,
        "width": int(rgba.shape[1]),
        "height": int(rgba.shape[0]),
    }


def _specs_from_config(cfg: dict, config_path: Path, videos_dir: Path | None) -> tuple[list[dict], dict | None]:
    root = videos_dir if videos_dir is not None else config_path.parent

    def resolve(file_name: str) -> Path:
        path = Path(file_name)
        if path.is_file():
            return path
        for base in (root, config_path.parent, config_path.parent / "videos"):
            cand = base / file_name
            if cand.is_file():
                return cand
            cand = base / Path(file_name).name
            if cand.is_file():
                return cand
        return root / file_name

    clips = []
    for item in cfg.get("turntables") or []:
        clips.append(
            {
                "path": resolve(str(item["file"])),
                "yaw0": float(item.get("yawStartDeg", item.get("yawStart", 0))),
                "yaw1": float(item.get("yawEndDeg", item.get("yawEnd", 90))),
                "kind": "ring",
            }
        )
    top = None
    raw_top = cfg.get("topRise") or cfg.get("top_rise")
    if raw_top:
        top = {
            "path": resolve(str(raw_top["file"])),
            "yaw": float(raw_top.get("yawDeg", 0)),
            "elev0": float(raw_top.get("elevStartDeg", raw_top.get("elevStart", 10))),
            "elev1": float(raw_top.get("elevEndDeg", raw_top.get("elevEnd", 60))),
        }
    return clips, top


def _parse_turntable_cli(items: list[str] | None) -> list[dict]:
    clips = []
    for item in items or []:
        parts = item.split(":")
        # path may contain a colon only as the separators we add; windows not in play.
        # Accept path:yaw0:yaw1 with the path last-split so a single relative path works.
        if len(parts) < 3:
            raise RuntimeError(
                "FAIL photogrammetry: --turntable expects path:yawStart:yawEnd (example videos/q0.mp4:0:90)"
            )
        yaw1 = float(parts[-1])
        yaw0 = float(parts[-2])
        path = ":".join(parts[:-2])
        clips.append({"path": Path(path), "yaw0": yaw0, "yaw1": yaw1, "kind": "ring"})
    return clips


def _parse_top_cli(item: str | None) -> dict | None:
    if not item:
        return None
    parts = item.split(":")
    if len(parts) < 4:
        raise RuntimeError(
            "FAIL photogrammetry: --top-rise expects path:yaw:elevStart:elevEnd"
        )
    elev1 = float(parts[-1])
    elev0 = float(parts[-2])
    yaw = float(parts[-3])
    path = ":".join(parts[:-3])
    return {"path": Path(path), "yaw": yaw, "elev0": elev0, "elev1": elev1}


def _camera_for(yaw: float, elev: float, distance: float, eye_y: float) -> dict:
    if abs(elev) < 1e-6:
        return hull.camera_pose(yaw, distance, eye_y, None)
    return hull.camera_pose(yaw, distance, eye_y, elev)


def _matrix(cam: dict, width: int, height: int, fov: float) -> np.ndarray:
    fy = (height * 0.5) / math.tan(math.radians(fov) * 0.5)
    k = np.array([[fy, 0.0, (width - 1) * 0.5], [0.0, fy, (height - 1) * 0.5], [0.0, 0.0, 1.0]])
    rot = np.stack([cam["right"], cam["up"], cam["forward"]], axis=0)
    t = -rot @ cam["position"]
    return k @ np.hstack([rot, t.reshape(3, 1)])


def _sift():
    try:
        import cv2
    except ImportError as exc:
        raise RuntimeError(
            "FAIL photogrammetry: OpenCV is not installed, so CPU SIFT cannot run. "
            "Install opencv-python-headless (CPU, no GPU). "
            "This run did not fall back to the silhouette method."
        ) from exc
    return cv2


def _features(cv2, gray: np.ndarray):
    sift = cv2.SIFT_create(nfeatures=320, contrastThreshold=0.04, edgeThreshold=12)
    return sift.detectAndCompute(gray, None)


def _good_matches(cv2, feats_a, feats_b) -> list[tuple[int, int]]:
    kp_a, des_a = feats_a
    kp_b, des_b = feats_b
    if des_a is None or des_b is None or len(kp_a) < 8 or len(kp_b) < 8:
        return []
    matcher = cv2.BFMatcher()
    pairs = matcher.knnMatch(des_a, des_b, k=2)
    kept = []
    for pair in pairs:
        if len(pair) < 2:
            continue
        best, second = pair
        if best.distance >= 0.78 * second.distance:
            continue
        p0 = np.array(kp_a[best.queryIdx].pt)
        p1 = np.array(kp_b[best.trainIdx].pt)
        disp = float(np.linalg.norm(p0 - p1))
        if disp < 0.8 or disp > 28.0:
            continue
        kept.append((int(best.queryIdx), int(best.trainIdx)))
    return kept


def _chain_tracks(frame_feats: list, matches: list[list[tuple[int, int]]]) -> list[dict[int, tuple[float, float]]]:
    parent: dict[tuple[int, int], tuple[int, int]] = {}

    def find(node: tuple[int, int]) -> tuple[int, int]:
        while parent[node] != node:
            parent[node] = parent[parent[node]]
            node = parent[node]
        return node

    def union(a: tuple[int, int], b: tuple[int, int]) -> None:
        parent.setdefault(a, a)
        parent.setdefault(b, b)
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    for i, pairs in enumerate(matches):
        for ia, ib in pairs:
            union((i, ia), (i + 1, ib))
    groups: dict[tuple[int, int], list[tuple[int, int]]] = {}
    for node in parent:
        groups.setdefault(find(node), []).append(node)
    tracks = []
    for members in groups.values():
        by: dict[int, tuple[float, float]] = {}
        for fi, ki in members:
            kp = frame_feats[fi][0][ki].pt
            by[fi] = (float(kp[0]), float(kp[1]))
        if len(by) >= 3:
            tracks.append(by)
    return tracks


def _triangulate(p1: np.ndarray, p2: np.ndarray, x1: np.ndarray, x2: np.ndarray) -> np.ndarray | None:
    cv2 = _sift()
    x_h = cv2.triangulatePoints(p1, p2, x1.reshape(2, 1), x2.reshape(2, 1))
    if abs(float(x_h[3, 0])) < 1e-8:
        return None
    point = (x_h[:3, 0] / x_h[3, 0]).astype(np.float64)
    if not np.isfinite(point).all():
        return None
    return point


def _project(matrix: np.ndarray, point: np.ndarray) -> tuple[float, float, float]:
    clip = matrix @ np.array([point[0], point[1], point[2], 1.0])
    return float(clip[0] / clip[2]), float(clip[1] / clip[2]), float(clip[2])


def _observe(
    tracks: list[dict[int, tuple[float, float]]],
    matrices: list[np.ndarray],
    yaws: list[float],
) -> tuple[list[np.ndarray], list[float], list[list[float]]]:
    """Triangulate each track from its widest baseline. Return points, errors, per-frame errors."""
    points = []
    errors = []
    per_frame: list[list[float]] = [[] for _ in matrices]
    for track in tracks:
        frames = sorted(track)
        span = max(range(len(frames)), key=lambda i: _yaw_delta(yaws[frames[0]], yaws[frames[-1]]), default=0)
        del span
        a, b = frames[0], frames[-1]
        if _yaw_delta(yaws[a], yaws[b]) < 6.0:
            continue
        point = _triangulate(
            matrices[a],
            matrices[b],
            np.array(track[a], np.float64),
            np.array(track[b], np.float64),
        )
        if point is None or float(np.linalg.norm(point)) > 4.0:
            continue
        ok = True
        sample = []
        for fi, uv in track.items():
            u, v, z = _project(matrices[fi], point)
            if z <= 0.05:
                ok = False
                break
            err = math.hypot(u - uv[0], v - uv[1])
            sample.append((fi, err))
        if not ok or not sample:
            continue
        med = float(np.median([e for _, e in sample]))
        if med > 8.0:
            continue
        points.append(point)
        for fi, err in sample:
            errors.append(err)
            per_frame[fi].append(err)
    return points, errors, per_frame


def _yaw_delta(a: float, b: float) -> float:
    d = abs((b - a) % 360.0)
    return min(d, 360.0 - d)


def _refine_yaws(
    frames: list[dict],
    tracks: list[dict[int, tuple[float, float]]],
    distance: float,
    eye_y: float,
    fov: float,
) -> None:
    """One pass of ±2° on each ring frame. The first frame of the turn stays the gauge."""
    if not frames:
        return
    for index, frame in enumerate(frames):
        if frame.get("kind") != "ring" or index == 0:
            continue
        base = float(frame["yaw"])
        best_yaw = base
        best_err = None
        for delta in (-2.0, -1.0, 0.0, 1.0, 2.0):
            frame["yaw"] = base + delta
            matrices = [_matrix(_camera_for(f["yaw"], f["elev"], distance, eye_y), f["width"], f["height"], fov) for f in frames]
            yaws = [f["yaw"] for f in frames]
            _points, errors, per_frame = _observe(tracks, matrices, yaws)
            mine = per_frame[index]
            err = float(np.median(mine)) if mine else 99.0
            if best_err is None or err < best_err:
                best_err = err
                best_yaw = base + delta
        frame["yaw"] = best_yaw


def _loop_iou(first: np.ndarray, last: np.ndarray) -> float:
    if first.shape != last.shape:
        return 0.0
    inter = np.logical_and(first, last).sum()
    union = np.logical_or(first, last).sum()
    if union <= 0:
        return 0.0
    return float(inter / union)


def _radius_field(points: np.ndarray, n_el: int, n_az: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    center = np.median(points, axis=0)
    delta = points - center
    radius = np.linalg.norm(delta, axis=1)
    good = radius > 1e-4
    delta = delta[good]
    radius = radius[good]
    elev = np.arcsin(np.clip(delta[:, 1] / radius, -1.0, 1.0))
    az = np.arctan2(delta[:, 0], delta[:, 2])
    el_edges = np.linspace(-math.pi / 2, math.pi / 2, n_el + 1)
    az_edges = np.linspace(-math.pi, math.pi, n_az + 1)
    field = np.full((n_el, n_az), np.nan)
    for i in range(n_el):
        for j in range(n_az):
            sel = (
                (elev >= el_edges[i])
                & (elev < el_edges[i + 1] + (1e-6 if i == n_el - 1 else 0))
                & (az >= az_edges[j])
                & (az < az_edges[j + 1] + (1e-6 if j == n_az - 1 else 0))
            )
            if int(sel.sum()) >= 1:
                field[i, j] = float(np.percentile(radius[sel], 70))
    filled = field.copy()
    for _ in range(8):
        nxt = filled.copy()
        for i in range(n_el):
            for j in range(n_az):
                if np.isfinite(filled[i, j]):
                    continue
                acc = []
                for di in (-1, 0, 1):
                    for dj in (-1, 0, 1):
                        ii = i + di
                        jj = (j + dj) % n_az
                        if 0 <= ii < n_el and np.isfinite(filled[ii, jj]):
                            acc.append(filled[ii, jj])
                if acc:
                    nxt[i, j] = float(np.mean(acc))
        filled = nxt
    fallback = float(np.median(radius)) if len(radius) else 0.4
    filled = np.where(np.isfinite(filled), filled, fallback)
    # Light wrap blur so a single stray point does not spike a bin.
    blurred = filled.copy()
    for i in range(n_el):
        for j in range(n_az):
            acc = []
            for di in (-1, 0, 1):
                for dj in (-1, 0, 1):
                    ii = i + di
                    if 0 <= ii < n_el:
                        acc.append(filled[ii, (j + dj) % n_az])
            blurred[i, j] = float(np.mean(acc))
    return center, blurred, el_edges


def _sample_radius(field: np.ndarray, el_edges: np.ndarray, elev: float, az: float) -> float:
    n_el, n_az = field.shape
    elev = float(np.clip(elev, -math.pi / 2 + 1e-4, math.pi / 2 - 1e-4))
    az = (az + math.pi) % (2 * math.pi) - math.pi
    i = int(np.clip(np.searchsorted(el_edges, elev, side="right") - 1, 0, n_el - 1))
    az_edges = np.linspace(-math.pi, math.pi, n_az + 1)
    j = int(np.clip(np.searchsorted(az_edges, az, side="right") - 1, 0, n_az - 1))
    return float(field[i, j])


def star_mesh(points: np.ndarray, n_el: int = 12, n_az: int = 24) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Closed star-shaped surface. One radius per direction. Invisible shape only."""
    center, field, el_edges = _radius_field(points, n_el, n_az)
    south = float(np.mean(field[0]))
    north = float(np.mean(field[-1]))
    verts = [center + np.array([0.0, -south, 0.0])]
    rings = []
    for i in range(n_el):
        elev = 0.5 * (el_edges[i] + el_edges[i + 1])
        ring = []
        for j in range(n_az):
            az = -math.pi + (j + 0.5) * (2 * math.pi / n_az)
            radius = float(field[i, j])
            direction = np.array(
                [math.sin(az) * math.cos(elev), math.sin(elev), math.cos(az) * math.cos(elev)],
                np.float64,
            )
            ring.append(len(verts))
            verts.append(center + radius * direction)
        rings.append(ring)
    north_i = len(verts)
    verts.append(center + np.array([0.0, north, 0.0]))
    faces = []
    for j in range(n_az):
        faces.append((0, rings[0][j], rings[0][(j + 1) % n_az]))
    for i in range(n_el - 1):
        for j in range(n_az):
            a = rings[i][j]
            b = rings[i][(j + 1) % n_az]
            c = rings[i + 1][(j + 1) % n_az]
            d = rings[i + 1][j]
            faces.append((a, d, c))
            faces.append((a, c, b))
    for j in range(n_az):
        faces.append((north_i, rings[-1][(j + 1) % n_az], rings[-1][j]))
    vertices = np.asarray(verts, np.float32)
    tris = np.asarray(faces, np.int32)
    tris = surface.orient_outward(vertices, tris)
    step = float(np.linalg.norm(vertices.max(axis=0) - vertices.min(axis=0))) / 40.0
    vertices = surface.taubin_smooth(vertices, tris, iterations=2, max_step=max(step, 1e-3))
    tris = surface.orient_outward(vertices, tris)
    normals = surface.vertex_normals(vertices, tris)
    return vertices.astype(np.float32), tris.astype(np.int32), normals.astype(np.float32)


def voxelize_star(vertices: np.ndarray, n: int = 36) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    center = np.median(vertices, axis=0).astype(np.float64)
    delta = vertices.astype(np.float64) - center
    extent = np.max(np.abs(vertices.astype(np.float64)), axis=0)
    half = np.maximum(extent * 1.2, 0.2)
    vsize = (2.0 * half) / n
    solid = np.zeros((n, n, n), np.uint8)
    # Direction samples from the mesh, queried by nearest elevation/azimuth bin.
    radius = np.linalg.norm(delta, axis=1)
    elev = np.arcsin(np.clip(delta[:, 1] / np.maximum(radius, 1e-8), -1, 1))
    az = np.arctan2(delta[:, 0], delta[:, 2])
    n_el, n_az = 12, 24
    el_edges = np.linspace(-math.pi / 2, math.pi / 2, n_el + 1)
    field = np.full((n_el, n_az), np.nan)
    for i in range(len(vertices)):
        if radius[i] < 1e-5:
            continue
        ii = int(np.clip(np.searchsorted(el_edges, elev[i], side="right") - 1, 0, n_el - 1))
        jj = int(np.clip(np.floor((az[i] + math.pi) / (2 * math.pi) * n_az), 0, n_az - 1))
        if not np.isfinite(field[ii, jj]) or radius[i] > field[ii, jj]:
            field[ii, jj] = radius[i]
    for _ in range(6):
        nxt = field.copy()
        for i in range(n_el):
            for j in range(n_az):
                if np.isfinite(field[i, j]):
                    continue
                acc = []
                for di in (-1, 0, 1):
                    for dj in (-1, 0, 1):
                        ii = i + di
                        if 0 <= ii < n_el and np.isfinite(field[ii, (j + dj) % n_az]):
                            acc.append(field[ii, (j + dj) % n_az])
                if acc:
                    nxt[i, j] = float(np.mean(acc))
        field = nxt
    field = np.where(np.isfinite(field), field, float(np.median(radius)))
    xs = -half[0] + (np.arange(n) + 0.5) * vsize[0]
    ys = -half[1] + (np.arange(n) + 0.5) * vsize[1]
    zs = -half[2] + (np.arange(n) + 0.5) * vsize[2]
    grid = np.stack(np.meshgrid(xs, ys, zs, indexing="ij"), axis=-1) - center
    dist = np.linalg.norm(grid, axis=-1)
    elev_g = np.arcsin(np.clip(grid[..., 1] / np.maximum(dist, 1e-8), -1, 1))
    az_g = np.arctan2(grid[..., 0], grid[..., 2])
    ii = np.clip(np.searchsorted(el_edges, elev_g, side="right") - 1, 0, n_el - 1)
    jj = np.clip(np.floor((az_g + math.pi) / (2 * math.pi) * n_az), 0, n_az - 1).astype(int)
    limit = field[ii, jj]
    solid[dist <= limit * 1.02] = 1
    return solid, half.astype(np.float64), vsize.astype(np.float64)


def _fail_stats(reason: str, extra: dict | None = None) -> dict:
    stats = {
        "method": "photogrammetry",
        "engine": "cpu",
        "surface": "photogrammetry",
        "ok": False,
        "registeredFrameRatio": 0.0,
        "framesExtracted": 0,
        "framesRegistered": 0,
        "meanReprojectionPx": None,
        "medianReprojectionPx": None,
        "pointCount": 0,
        "meshFaces": 0,
        "holes": {"boundaryEdges": None, "nonManifoldEdges": None},
        "loopClosureSilhouetteIoU": None,
        "alignmentRmse": None,
        "meanYawCorrectionDeg": None,
        "thresholds": _thresholds(),
        "fallback": (
            "Registration is poor or the photos could not be read. "
            "Re-run without --shape photogrammetry so the default silhouette volume + surface nets is used. "
            "This run did not switch methods."
        ),
        "reason": reason,
    }
    if extra:
        stats.update(extra)
    return stats


def _thresholds() -> dict:
    return {
        "minRegisteredFrameRatio": MIN_REGISTERED_RATIO,
        "maxMeanReprojectionPx": MAX_MEAN_REPROJ_PX,
        "minLoopClosureSilhouetteIoU": MIN_LOOP_IOU,
        "minPointCount": MIN_POINTS,
        "reprojInlierPx": REPROJ_INLIER_PX,
    }


def _empty_mesh() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    return (
        np.zeros((0, 3), np.float32),
        np.zeros((0, 3), np.int32),
        np.zeros((0, 3), np.float32),
    )


def _colmap_points(work: Path, frames: list[dict], distance: float, eye_y: float) -> np.ndarray | None:
    """Optional COLMAP CPU sparse cloud, aligned onto the declared turntable."""
    colmap = shutil.which("colmap")
    if not colmap:
        raise RuntimeError(
            "FAIL photogrammetry: --photogram-engine colmap but `colmap` is not on PATH. "
            "Install COLMAP and re-run, or use --photogram-engine cpu. "
            "This run did not switch engines and did not fall back to the silhouette method."
        )
    image_dir = work / "colmap-images"
    image_dir.mkdir(parents=True, exist_ok=True)
    for i, frame in enumerate(frames):
        if frame.get("kind") != "ring":
            continue
        shutil.copyfile(frame["path"], image_dir / f"f{i:04d}.png")
    db = work / "colmap.db"
    sparse = work / "colmap-sparse"
    sparse.mkdir(exist_ok=True)
    if db.exists():
        db.unlink()
    commands = [
        [
            colmap, "feature_extractor",
            "--database_path", str(db),
            "--image_path", str(image_dir),
            "--ImageReader.single_camera", "1",
            "--SiftExtraction.use_gpu", "0",
        ],
        [
            colmap, "exhaustive_matcher",
            "--database_path", str(db),
            "--SiftMatching.use_gpu", "0",
        ],
        [
            colmap, "mapper",
            "--database_path", str(db),
            "--image_path", str(image_dir),
            "--output_path", str(sparse),
            "--Mapper.ba_use_gpu", "0",
        ],
    ]
    for cmd in commands:
        proc = subprocess.run(cmd, text=True, capture_output=True)
        if proc.returncode != 0:
            tail = (proc.stderr or proc.stdout or "").strip()[-600:]
            raise RuntimeError(
                "FAIL photogrammetry: COLMAP CPU command failed: "
                + " ".join(cmd[:3])
                + " "
                + tail
                + " This run did not fall back to the silhouette method."
            )
    model = next(sparse.glob("*"), None)
    if model is None:
        raise RuntimeError(
            "FAIL photogrammetry: COLMAP CPU mapper wrote no sparse model. "
            "This run did not fall back to the silhouette method."
        )
    txt = work / "colmap-txt"
    txt.mkdir(exist_ok=True)
    proc = subprocess.run(
        [colmap, "model_converter", "--input_path", str(model), "--output_path", str(txt), "--output_type", "TXT"],
        text=True,
        capture_output=True,
    )
    if proc.returncode != 0 or not (txt / "points3D.txt").is_file():
        raise RuntimeError(
            "FAIL photogrammetry: COLMAP model_converter produced no points3D.txt. "
            "This run did not fall back to the silhouette method."
        )
    pts = []
    for line in (txt / "points3D.txt").read_text().splitlines():
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        pts.append([float(parts[1]), float(parts[2]), float(parts[3])])
    if len(pts) < MIN_POINTS:
        raise RuntimeError(
            f"FAIL photogrammetry: COLMAP CPU reconstructed {len(pts)} points (need {MIN_POINTS}). "
            "This run did not fall back to the silhouette method."
        )
    cloud = np.asarray(pts, np.float64)
    # Declared camera centers, in filename order, are the alignment target.
    declared = []
    for frame in frames:
        if frame.get("kind") != "ring":
            continue
        declared.append(_camera_for(frame["yaw"], 0.0, distance, eye_y)["position"])
    declared = np.asarray(declared, np.float64)
    # COLMAP camera centers from images.txt (qw qx qy qz tx ty tz).
    centers = []
    lines = [ln for ln in (txt / "images.txt").read_text().splitlines() if ln and not ln.startswith("#")]
    # images.txt alternates a pose line and a points line.
    for line in lines[::2]:
        parts = line.split()
        qw, qx, qy, qz = map(float, parts[1:5])
        tx, ty, tz = map(float, parts[5:8])
        rot = _quat_to_rot(qw, qx, qy, qz)
        centers.append(-rot.T @ np.array([tx, ty, tz]))
    centers = np.asarray(centers, np.float64)
    if len(centers) < 3:
        raise RuntimeError(
            "FAIL photogrammetry: COLMAP registered fewer than 3 cameras. "
            "This run did not fall back to the silhouette method."
        )
    n = min(len(centers), len(declared))
    sim = _umeyama(centers[:n], declared[:n])
    aligned = (sim["scale"] * (cloud @ sim["rotation"].T)) + sim["translation"]
    return aligned


def _quat_to_rot(w: float, x: float, y: float, z: float) -> np.ndarray:
    n = math.sqrt(w * w + x * x + y * y + z * z)
    w, x, y, z = w / n, x / n, y / n, z / n
    return np.array(
        [
            [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
        ],
        np.float64,
    )


def _umeyama(src: np.ndarray, dst: np.ndarray) -> dict:
    """Similarity that maps src camera centers onto dst. Scale, rotation, translation."""
    mu_s = src.mean(axis=0)
    mu_d = dst.mean(axis=0)
    a = src - mu_s
    b = dst - mu_d
    cov = (b.T @ a) / len(src)
    u, s, vt = np.linalg.svd(cov)
    rot = u @ vt
    if np.linalg.det(rot) < 0:
        u[:, -1] *= -1
        rot = u @ vt
    var = float(np.mean(np.sum(a * a, axis=1)))
    scale = float(np.sum(s) / max(var, 1e-8))
    trans = mu_d - scale * (rot @ mu_s)
    mapped = (scale * (src @ rot.T)) + trans
    rmse = float(np.sqrt(np.mean(np.sum((mapped - dst) ** 2, axis=1))))
    return {"scale": scale, "rotation": rot, "translation": trans, "rmse": rmse}


def reconstruct(
    config_path: Path,
    cfg: dict,
    object_size: np.ndarray,
    out_dir: Path,
    videos_dir: Path | None = None,
    turntable_cli: list[str] | None = None,
    top_rise_cli: str | None = None,
    max_frames: int = 8,
    engine: str = "cpu",
) -> dict:
    """Return a mesh in the view frame plus registration stats. Failures do not switch methods."""
    distance = float(cfg.get("camera", {}).get("distance", 3.0))
    eye_y = float(cfg.get("camera", {}).get("eyeY", 0.0))
    fov = float(cfg.get("camera", {}).get("fovYDeg", 40.0))
    threshold = float(cfg.get("bgThreshold", 0.04))
    work = out_dir / ".frames"
    work.mkdir(parents=True, exist_ok=True)
    failures: list[str] = []
    try:
        clips = _parse_turntable_cli(turntable_cli) if turntable_cli else []
        top = _parse_top_cli(top_rise_cli)
        if not clips:
            clips, top_cfg = _specs_from_config(cfg, config_path, videos_dir)
            if top is None:
                top = top_cfg
        if len(clips) != 4:
            raise RuntimeError(
                f"FAIL photogrammetry: need 4 turntable videos of 90° each, found {len(clips)}. "
                "Put them in config turntables or pass --turntable four times. "
                "This run did not fall back to the silhouette method."
            )
        spans = [abs(c["yaw1"] - c["yaw0"]) % 360 for c in clips]
        if any(abs(span - 90.0) > 8.0 for span in spans):
            raise RuntimeError(
                "FAIL photogrammetry: each turntable clip must span 90° (pinned first and last). "
                f"Got spans {spans}. This run did not fall back to the silhouette method."
            )
        frames: list[dict] = []
        for clip_i, clip in enumerate(clips):
            if not clip["path"].is_file():
                raise RuntimeError(
                    f"FAIL photogrammetry: missing turntable video {clip['path']}. "
                    "This run did not fall back to the silhouette method."
                )
            paths = extract_frames(clip["path"], work / f"q{clip_i}", max_frames)
            for k, path in enumerate(paths):
                t = k / max(1, len(paths) - 1)
                yaw = clip["yaw0"] + (clip["yaw1"] - clip["yaw0"]) * t
                loaded = _load_frame(path, threshold)
                loaded.update(
                    {
                        "path": path,
                        "yaw": float(yaw),
                        "yawDeclared": float(yaw),
                        "elev": 0.0,
                        "kind": "ring",
                        "clip": clip_i,
                    }
                )
                frames.append(loaded)
        top_count = 0
        if top is not None:
            if not top["path"].is_file():
                raise RuntimeError(
                    f"FAIL photogrammetry: missing top-rise video {top['path']}. "
                    "This run did not fall back to the silhouette method."
                )
            paths = extract_frames(top["path"], work / "top", max(3, max_frames // 2))
            for k, path in enumerate(paths):
                t = k / max(1, len(paths) - 1)
                elev = top["elev0"] + (top["elev1"] - top["elev0"]) * t
                loaded = _load_frame(path, threshold)
                loaded.update(
                    {
                        "path": path,
                        "yaw": float(top["yaw"]),
                        "yawDeclared": float(top["yaw"]),
                        "elev": float(elev),
                        "kind": "top",
                        "clip": -1,
                    }
                )
                frames.append(loaded)
            top_count = len(paths)
        ring = [f for f in frames if f["kind"] == "ring"]
        if len(ring) < 8:
            raise RuntimeError(
                "FAIL photogrammetry: fewer than 8 ring frames after decode. "
                "This run did not fall back to the silhouette method."
            )
        loop = _loop_iou(ring[0]["mask"], ring[-1]["mask"])
        if engine == "colmap":
            cloud = _colmap_points(work, frames, distance, eye_y)
            # COLMAP path still reports the CPU pose reprojection of those points
            # after alignment, using the declared ring. Yaw correction stays 0.
            points = cloud
            errors = []
            per_frame = [[] for _ in frames]
            matrices = [
                _matrix(_camera_for(f["yaw"], f["elev"], distance, eye_y), f["width"], f["height"], fov)
                for f in frames
            ]
            mean_corr = 0.0
            declared_rmse = 0.0
        else:
            if engine != "cpu":
                raise RuntimeError(
                    f"FAIL photogrammetry: unknown engine {engine}. Use cpu or colmap. "
                    "This run did not fall back to the silhouette method."
                )
            cv2 = _sift()
            feats = []
            for frame in frames:
                feats.append(_features(cv2, frame["gray"]))
            # Match inside each clip, and inside the top-rise. Do not match across a 0° cut
            # (the pinned join), where displacement is ~0 and is not a baseline.
            matches: list[list[tuple[int, int]]] = [[] for _ in range(len(frames) - 1)]
            for i in range(len(frames) - 1):
                if frames[i]["kind"] != frames[i + 1]["kind"]:
                    continue
                if frames[i]["kind"] == "ring" and frames[i]["clip"] != frames[i + 1]["clip"]:
                    continue
                matches[i] = _good_matches(cv2, feats[i], feats[i + 1])
            tracks = _chain_tracks(feats, matches)
            _refine_yaws(frames, tracks, distance, eye_y, fov)
            matrices = [
                _matrix(_camera_for(f["yaw"], f["elev"], distance, eye_y), f["width"], f["height"], fov)
                for f in frames
            ]
            yaws = [float(f["yaw"]) for f in frames]
            points, errors, per_frame = _observe(tracks, matrices, yaws)
            corrections = [abs(float(f["yaw"]) - float(f["yawDeclared"])) for f in ring]
            mean_corr = float(np.mean(corrections)) if corrections else 0.0
            # Alignment of refined centers against the declared circle.
            refined = np.array(
                [_camera_for(f["yaw"], 0.0, distance, eye_y)["position"] for f in ring]
            )
            declared = np.array(
                [_camera_for(f["yawDeclared"], 0.0, distance, eye_y)["position"] for f in ring]
            )
            declared_rmse = float(np.sqrt(np.mean(np.sum((refined - declared) ** 2, axis=1))))
        point_count = int(len(points))
        registered = 0
        for frame, errs in zip(frames, per_frame):
            if frame["kind"] != "ring":
                continue
            inl = [e for e in errs if e <= REPROJ_INLIER_PX]
            if len(inl) >= 4:
                registered += 1
        ratio = registered / max(1, len(ring))
        mean_reproj = float(np.mean(errors)) if errors else None
        median_reproj = float(np.median(errors)) if errors else None
        reasons = []
        if ratio < MIN_REGISTERED_RATIO:
            reasons.append(f"registeredFrameRatio={ratio:.2f} < {MIN_REGISTERED_RATIO:.2f}")
        if mean_reproj is None or mean_reproj > MAX_MEAN_REPROJ_PX:
            shown = "none" if mean_reproj is None else f"{mean_reproj:.2f}"
            reasons.append(f"meanReprojectionPx={shown} > {MAX_MEAN_REPROJ_PX:.2f}")
        if loop < MIN_LOOP_IOU:
            reasons.append(
                f"loopClosureSilhouetteIoU={loop:.2f} < {MIN_LOOP_IOU:.2f} (pinned start and end disagree; the object may morph)"
            )
        if point_count < MIN_POINTS:
            reasons.append(f"pointCount={point_count} < {MIN_POINTS}")
        vertices, faces, normals = _empty_mesh()
        holes = {"boundaryEdges": None, "nonManifoldEdges": None, "manifoldEdges": None}
        if point_count >= 8:
            cloud = np.asarray(points, np.float64)
            vertices, faces, normals = star_mesh(cloud)
            hist = surface.manifold_edge_histogram(faces)
            holes = {
                "boundaryEdges": int(hist["boundary"]),
                "nonManifoldEdges": int(hist["nonManifold"]),
                "manifoldEdges": int(hist["manifold"]),
            }
            if int(hist["boundary"]) > 0:
                reasons.append(f"boundaryEdges={int(hist['boundary'])}")
        elif not reasons:
            reasons.append("no mesh")
        stats = {
            "method": "photogrammetry",
            "engine": engine,
            "surface": "photogrammetry",
            "ok": not reasons,
            "registeredFrameRatio": round(ratio, 4),
            "framesExtracted": len(frames),
            "ringFrames": len(ring),
            "framesRegistered": int(registered),
            "topRiseFrames": int(top_count),
            "meanReprojectionPx": None if mean_reproj is None else round(mean_reproj, 4),
            "medianReprojectionPx": None if median_reproj is None else round(median_reproj, 4),
            "pointCount": point_count,
            "meshFaces": int(len(faces)),
            "meshVertices": int(len(vertices)),
            "holes": holes,
            "loopClosureSilhouetteIoU": round(loop, 4),
            "alignmentRmse": round(float(declared_rmse), 5),
            "meanYawCorrectionDeg": round(float(mean_corr), 4),
            "thresholds": _thresholds(),
            "densifier": "star-radius",
            "densifierLimit": "One radius per direction around the centroid. A dent or a through-hole is not reconstructed.",
            "pixels": "HD stills are projected later at native resolution. Video frames are used for shape only.",
            "fallback": None,
        }
        if reasons:
            stats["ok"] = False
            stats["fallback"] = (
                "Registration is poor"
                + (" (the object may morph between frames)" if loop < MIN_LOOP_IOU else "")
                + ". Re-run without --shape photogrammetry so the default silhouette volume + surface nets is used. "
                "This run did not switch methods."
            )
            failures.append(
                "FAIL photogrammetry: "
                + "; ".join(reasons)
                + ". "
                + stats["fallback"]
            )
        if len(vertices) < 16:
            solid = np.zeros((8, 8, 8), np.uint8)
            half = np.array(object_size, np.float64) * 0.5
            vsize = (2.0 * half) / 8.0
            if not failures:
                failures.append(
                    "FAIL photogrammetry: the point cloud did not produce a mesh. "
                    "Re-run without --shape photogrammetry. This run did not switch methods."
                )
        else:
            solid, half, vsize = voxelize_star(vertices, n=36)
        return {
            "vertices": vertices,
            "normals": normals,
            "faces": faces,
            "solid": solid,
            "half": half,
            "vsize": vsize,
            "stats": stats,
            "failures": failures,
            "waive_silhouette_lock": False,
        }
    except RuntimeError as exc:
        message = str(exc)
        if not message.startswith("FAIL"):
            message = "FAIL photogrammetry: " + message
        if "did not fall back" not in message and "did not switch" not in message:
            message += " This run did not fall back to the silhouette method."
        vertices, faces, normals = _empty_mesh()
        half = np.array(object_size, np.float64) * 0.5
        return {
            "vertices": vertices,
            "normals": normals,
            "faces": faces,
            "solid": np.zeros((8, 8, 8), np.uint8),
            "half": half,
            "vsize": (2.0 * half) / 8.0,
            "stats": _fail_stats(message, {"engine": engine}),
            "failures": [message],
            "waive_silhouette_lock": False,
        }

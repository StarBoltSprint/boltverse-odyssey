"""Asset manifests, relief, and magnification. Shape only."""

from __future__ import annotations

import json
import math
from pathlib import Path

from tools.layout.geom import hypot, smoothstep
from tools.layout.noise import fbm, permutation


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError(f"{path} is not an object")
    return data


def qnum(value: float, places: int = 4) -> float:
    return float(f"{float(value):.{places}f}")


def dump_json(data: dict) -> str:
    return json.dumps(data, indent=2, sort_keys=True) + "\n"


def focal_px(view_px: float, fov_deg: float) -> float:
    return (view_px * 0.5) / math.tan(math.radians(fov_deg) * 0.5)


class Asset:
    def __init__(self, path: str, data: dict):
        self.path = path
        self.data = data
        self.name = str(data.get("name") or Path(path).parent.name)
        foot = data.get("footprint") or {}
        kind = str(foot.get("type") or "circle")
        if kind not in ("circle", "polygon"):
            raise ValueError(f"{path} footprint type {kind} is not circle or polygon")
        self.footprint_type = kind
        if kind == "circle":
            radius = foot.get("radius_m", (data.get("placement") or {}).get("collisionRadius"))
            if radius is None:
                raise ValueError(f"{path} has no footprint radius")
            self.radius_m = float(radius)
            self.local_polygon: list[tuple[float, float]] = []
        else:
            pts = foot.get("points") or []
            if len(pts) < 3:
                raise ValueError(f"{path} polygon needs at least 3 points")
            self.local_polygon = [(float(p[0]), float(p[1])) for p in pts]
            self.radius_m = max(hypot(x, z) for x, z in self.local_polygon)
        height = data.get("height_m")
        if height is None:
            half = data.get("halfExtent") or [self.radius_m, self.radius_m, self.radius_m]
            height = float(half[1]) * 2.0
        self.height_m = float(height)
        width = data.get("width_m")
        if width is None:
            width = self.radius_m * 2.0
        self.width_m = float(width)
        src = data.get("sourcePx") or {}
        if "height" not in src or "width" not in src:
            raise ValueError(f"{path} needs sourcePx.width and sourcePx.height")
        self.source_w = int(src["width"])
        self.source_h = int(src["height"])
        if self.source_w < 1 or self.source_h < 1:
            raise ValueError(f"{path} sourcePx must be at least 1")
        self.yaw_step = float(data.get("yawQuantizeDeg") or 1.0)
        approach = data.get("approach") or {}
        self.cap_distance = float(approach["capDistance"]) if "capDistance" in approach else None
        self.max_magnification = (
            float(approach["maxMagnification"]) if "maxMagnification" in approach else None
        )
        self.category = str(data.get("category") or "")

    def world_polygon(self, x: float, z: float, yaw_deg: float, scale: float) -> list[tuple[float, float]]:
        a = math.radians(yaw_deg)
        c, s = math.cos(a), math.sin(a)
        out = []
        for lx, lz in self.local_polygon:
            px, pz = lx * scale, lz * scale
            out.append((x + c * px - s * pz, z + s * px + c * pz))
        return out


def resolve_asset(path_str: str, roots: list[Path]) -> Path:
    raw = Path(path_str)
    if raw.is_file():
        return raw
    for root in roots:
        cand = (root / path_str).resolve()
        if cand.is_file():
            return cand
    raise FileNotFoundError(f"asset not found: {path_str}")


REPO = Path(__file__).resolve().parents[2]


def load_asset(path_str: str, roots: list[Path]) -> Asset:
    path = resolve_asset(path_str, list(roots) + [REPO])
    data = load_json(path)
    _fill_from_walkaround(path, data)
    return Asset(path_str, data)


def _fill_from_walkaround(asset_path: Path, data: dict) -> None:
    """Fill source pixels and a circle footprint from a walkaround folder when the manifest omits them."""
    if "sourcePx" not in data:
        report = asset_path.parent / "qc" / "report.json"
        if report.is_file():
            rep = json.loads(report.read_text(encoding="utf-8"))
            views = ((rep.get("silhouetteLock") or {}).get("perView")) or []
            if views and all("width" in v and "height" in v for v in views):
                data["sourcePx"] = {
                    "width": min(int(v["width"]) for v in views),
                    "height": min(int(v["height"]) for v in views),
                    "kind": "silhouette",
                }
        if "sourcePx" not in data:
            cams = data.get("cameras") or []
            if cams and "width" in cams[0] and "height" in cams[0]:
                data["sourcePx"] = {
                    "width": int(cams[0]["width"]),
                    "height": int(cams[0]["height"]),
                    "kind": "frame",
                }
    if "footprint" not in data:
        npz = asset_path.parent / "hull.npz"
        radius = None
        if npz.is_file():
            radius = _radius_from_npz(npz)
        if radius is None:
            raw = (data.get("placement") or {}).get("collisionRadius")
            if raw is not None:
                radius = float(raw)
        if radius is not None:
            data["footprint"] = {"type": "circle", "radius_m": radius}


def _radius_from_npz(path: Path) -> float | None:
    try:
        import numpy as np
    except ImportError:
        return None
    try:
        blob = np.load(path)
        solid = blob["solid"]
        origin = blob["origin"]
        vs = blob["voxelSize"]
        idx = np.argwhere(solid)
        if len(idx) == 0:
            return None
        xs = origin[0] + (idx[:, 0] + 0.5) * vs[0]
        zs = origin[2] + (idx[:, 2] + 0.5) * vs[2]
        return float(np.max(np.hypot(xs, zs)))
    except (KeyError, OSError, ValueError):
        return None


def relief_y(x: float, z: float, zone: dict, perm: list[int]) -> float:
    center = zone.get("center") or [0, 0]
    radius = float(zone["radius_m"])
    ground = zone.get("ground") or {}
    rel = ground.get("relief") or {}
    amp = float(rel.get("amp_m", 0.0))
    edge = float(rel.get("edge_height_m", 0.0))
    freq = float(rel.get("frequency", 0.12))
    octaves = int(rel.get("octaves", 3))
    fade_start = float(rel.get("edge_fade_start", 0.82))
    r = hypot(x - float(center[0]), z - float(center[1])) / radius if radius else 0.0
    fade = 1.0 - smoothstep(fade_start, 1.0, r)
    n = max(-1.0, min(1.0, fbm(x, z, perm, octaves, freq)))
    return edge + amp * n * fade


def perm_for_zone(zone: dict) -> list[int]:
    rel = ((zone.get("ground") or {}).get("relief") or {})
    return permutation(int(rel.get("seed", 1)))


def closest_m(
    scale: float,
    radius_m: float,
    height_m: float,
    base_y: float,
    hero_radius: float,
    boom_m: float,
    eye_height: float,
) -> float:
    horizontal = scale * radius_m + hero_radius + boom_m
    mid_y = base_y + height_m * scale * 0.5
    return max(0.05, hypot(horizontal, eye_height - mid_y))


def magnification(
    asset: Asset,
    scale: float,
    view: dict,
    hero_radius: float,
    base_y: float = 0.0,
    radius_m: float | None = None,
) -> dict:
    """On-screen magnification at the closest the follow camera can sit.

    Screen pixels come from the play view. Source pixels come from the manifest.
    When the manifest also has an approach cap, that figure is reported too and
    the value that matters is the larger of the two.
    """
    width = float(view.get("width", 720))
    height = float(view.get("height", 1600))
    fov = float(view.get("fov_y_deg", 40))
    boom = float(view.get("boom_m", 0.0))
    eye = float(view.get("eye_height_m", 0.9))
    mag_max = float(view.get("mag_max", 1.0))
    radius = asset.radius_m if radius_m is None else radius_m
    # Closest distance uses the visual footprint (scale × authored radius).
    dist = closest_m(scale, asset.radius_m, asset.height_m, base_y, hero_radius, boom, eye)
    focal = focal_px(height, fov)
    screen_h = (asset.height_m * scale / dist) * focal
    screen_w = (asset.width_m * scale / dist) * focal
    mag_h = screen_h / asset.source_h
    mag_w = screen_w / asset.source_w
    mag_px = max(mag_h, mag_w)
    mag_approach = None
    if asset.cap_distance and asset.max_magnification is not None and asset.cap_distance > 0:
        mag_approach = scale * asset.max_magnification * asset.cap_distance / dist
    mag = mag_px if mag_approach is None else max(mag_px, mag_approach)
    return {
        "mag": mag,
        "mag_px": mag_px,
        "mag_h": mag_h,
        "mag_w": mag_w,
        "mag_approach": mag_approach,
        "closest_m": dist,
        "mag_max": mag_max,
        "focal_px": focal,
        "screen_h": screen_h,
        "screen_w": screen_w,
        "source_h": asset.source_h,
        "source_w": asset.source_w,
        "radius_used_m": radius,
    }


def max_legal_scale(
    asset: Asset,
    view: dict,
    hero_radius: float,
    lo: float,
    hi: float,
) -> float:
    """Largest scale in [lo, hi] whose magnification is <= mag_max. May be < lo."""
    limit = float(view.get("mag_max", 1.0))
    if magnification(asset, lo, view, hero_radius)["mag"] > limit + 1e-6:
        # Search below lo so the caller can reject the asset.
        return _search_scale(asset, view, hero_radius, limit, 0.05, lo)
    if magnification(asset, hi, view, hero_radius)["mag"] <= limit + 1e-6:
        return hi
    return _search_scale(asset, view, hero_radius, limit, lo, hi)


def _search_scale(asset: Asset, view: dict, hero_radius: float, limit: float, lo: float, hi: float) -> float:
    for _ in range(40):
        mid = 0.5 * (lo + hi)
        if magnification(asset, mid, view, hero_radius)["mag"] <= limit:
            lo = mid
        else:
            hi = mid
    return lo

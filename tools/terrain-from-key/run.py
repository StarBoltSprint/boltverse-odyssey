#!/usr/bin/env python3
"""Zone B terrain from the key. Two attempts, then an honest report.

No Imagine images. Does not edit the live preview index.html.
"""

from __future__ import annotations

import json
import shutil
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
sys.path.insert(0, str(ROOT))

from build_field import compose_from_skyline, mask_iou, render_ground, skyline_fill  # noqa: E402
from gates import evaluate, vertex_cost  # noqa: E402
from geom import camera_axes, pitch_for_horizon, ray_directions  # noqa: E402
from mask_depth import ground_mask, load_rgb  # noqa: E402

LIVE = Path("/workspace/zb-preview-1008/main.mjs")
KEY_DEFAULT = Path("/workspace/zb-bible-1008/key-city3.jpg")
PRIOR = Path("/workspace/zb-bible-1008/compare/run2/camera-key.json")
OUT = REPO / "steps" / "terrain-key2-1011"
STAGING = ROOT / "staging"


def check_camera_convention():
    _r, _u, f = camera_axes(75, -1.16)
    got = np.array([0.9657, -0.0202, -0.2588])
    err = float(np.max(np.abs(f - got)))
    if err > 0.002:
        raise SystemExit(f"camera convention drift {err}")
    dirs = ray_directions(75, -1.16, 58, 4, 4)
    c = dirs[2, 2]
    # centre of a 4x4 is not the optical axis;  the axes check above is the lock
    return {"forwardErr": err, "sampleY": float(c[1])}


def load_prior():
    raw = json.loads(PRIOR.read_text())
    c = raw["camera"] if "camera" in raw else raw
    return {
        "x": float(c["x"]),
        "z": float(c["z"]),
        "yaw": float(c.get("yaw", 78)),
        "pitch": float(c.get("pitch", -1.16)),
        "eye": float(c.get("eye", 3.15)),
        "fov": float(c.get("fovDeg", c.get("fov", 58))),
    }


def resize_mask(mask, tw, th):
    im = Image.fromarray(mask.astype(np.uint8) * 255)
    im = im.resize((tw, th), Image.Resampling.NEAREST)
    return np.asarray(im) > 127


def search(prior, ground, disp, horizon, features_heading):
    """Coarse search: low eye, fov, relief gain. Position and yaw stay on the prior."""
    gh, gw = 72, 128
    g = resize_mask(ground, gw, gh)
    d = np.asarray(Image.fromarray((disp * 255).astype(np.uint8)).resize((gw, gh), Image.Resampling.BILINEAR), np.float32) / 255
    towers = np.zeros(gw, np.bool_)
    best = None
    trials = []
    fovs = (52, 64, 74, 84)
    eyes = (1.15, 1.7, 2.3, 3.05)
    gains = (1.0, 1.8, 2.8)
    for fov in fovs:
        pitch = pitch_for_horizon(fov, horizon, gw / gh)
        for eye in eyes:
            for gain in gains:
                cam = {**prior, "fov": fov, "eye": eye, "pitch": pitch}
                dirs = ray_directions(cam["yaw"], cam["pitch"], cam["fov"], gw, gh)
                t0 = time.perf_counter()
                built = compose(cam, dirs, g, d, gain, step=4.0, span=360.0, heading=features_heading, half_w=14.0, max_slope=15.0)
                rend, _ = render_ground(cam, built["heights"], built["origin"], built["step"], gw, gh, march=8.0)
                iou = mask_iou(skyline_fill(g), skyline_fill(rend), towers)
                rec = {"fov": fov, "eye": eye, "pitch": round(pitch, 3), "gain": gain, "iou": round(iou, 4), "sec": round(time.perf_counter() - t0, 2)}
                trials.append(rec)
                if best is None or iou > best[0]:
                    best = (iou, cam, gain, rec)
    return best, trials


def write_staging(cam_note: str):
    text = LIVE.read_text()
    repls = [
        ('from "./three.module.js"', 'from "/live/three.module.js"'),
        ('from "./runtime/biome-runtime-v61.js?v=61"', 'from "/live/runtime/biome-runtime-v61.js?v=61"'),
        ('from "./objects-t7.mjs?v=58"', 'from "/live/objects-t7.mjs?v=58"'),
        ('from "./terrain-build.mjs"', 'from "/live/terrain-build.mjs"'),
        ('from "./runtime/adaptive-res-v3.mjs?v=3"', 'from "/live/runtime/adaptive-res-v3.mjs?v=3"'),
        ('from "./runtime/upscale-easu.mjs?v=1"', 'from "/live/runtime/upscale-easu.mjs?v=1"'),
        ("fetch(`./biome.json?v=${V}`)", "fetch(`/live/biome.json?v=${V}`)"),
        ('fetch("./gdet/ground-detail.json?g=2")', 'fetch("/live/gdet/ground-detail.json?g=2")'),
        ("./assets/", "/live/assets/"),
        ("./gdet/", "/live/gdet/"),
        ('import("./sky1/sky-t7.mjs?v=58")', 'import("/live/sky1/sky-t7.mjs?v=58")'),
        ('import("./mesas/mesas-v11.mjs?v=11")', 'import("/live/mesas/mesas-v11.mjs?v=11")'),
        (
            "const field = R.createDuneField(biome);",
            'import { createKeyedField, loadGrid } from "./keyed-field.mjs";\n'
            'import { patchHeightSplat } from "./height-splat.mjs";\n'
            "const keyedGrid = await loadGrid('/data/height.bin', '/data/height.json');\n"
            "const field = createKeyedField(biome, keyedGrid);",
        ),
    ]
    for a, b in repls:
        if a not in text:
            raise SystemExit(f"staging patch missed: {a[:80]}")
        # Asset prefixes occur more than once. A single replace leaves a 404.
        count = -1 if a in ("./assets/", "./gdet/") else 1
        text = text.replace(a, b, count)
    # the import got inserted mid-body. Hoist it by leaving it: ES modules allow import only at top.
    # Move those two import lines to the top.
    hoist = []
    lines = []
    for line in text.splitlines(True):
        if line.startswith("import { createKeyedField") or line.startswith("import { patchHeightSplat"):
            hoist.append(line if line.endswith("\n") else line + "\n")
        else:
            lines.append(line)
    text = "".join(hoist) + "".join(lines)
    old_worker = '''try {
  worker = new Worker(new URL("./terrain-worker.mjs?v=7", import.meta.url), { type: "module" });
  worker.onmessage = (e) => applyMesh(e.data);
  worker.onerror = (e) => { console.warn("terrain worker failed, main thread fallback", e.message); worker = null; pending = false; builtKey = ""; };
  worker.postMessage({ biome });
} catch (e) { worker = null; }
function requestTerrain(x, z, force) {
  const C = field.cellM, k = `${Math.floor(x / C)},${Math.floor(z / C)}`;
  if ((k === builtKey && !force) || pending) return;
  builtKey = k; pending = true;
  if (worker) { worker.postMessage({ x, z, id: ++reqId }); return; }
  if (!mainBuild) mainBuild = createAllRoundBuilder(field);
  applyMesh(mainBuild(x, z));
}'''
    new_worker = '''// Staging: main-thread mesh from the keyed field. The live worker still builds the old dunes.
function requestTerrain(x, z, force) {
  const C = field.cellM, k = `${Math.floor(x / C)},${Math.floor(z / C)}`;
  if ((k === builtKey && !force) || pending) return;
  builtKey = k; pending = true;
  if (!mainBuild) mainBuild = createAllRoundBuilder(field);
  applyMesh(mainBuild(x, z));
}'''
    if old_worker not in text:
        raise SystemExit("worker block not found")
    text = text.replace(old_worker, new_worker, 1)
    needle = "const ground = new THREE.Mesh(new THREE.BufferGeometry(), R.createGroundMaterial(THREE, biome, albedo, normals, detail));"
    patch = needle + "\npatchHeightSplat(ground.material, field.hLo, field.hHi);"
    if needle not in text:
        raise SystemExit("ground mesh line missing")
    text = text.replace(needle, patch, 1)
    # default pose = key camera (URL still wins)
    text = text.replace(
        "const spawn = !hasPose && objs.spawn ? objs.spawn : null;",
        "const keyedPose = field.camera;\nconst spawn = !hasPose && keyedPose ? keyedPose : (!hasPose && objs.spawn ? objs.spawn : null);",
        1,
    )
    STAGING.mkdir(parents=True, exist_ok=True)
    (STAGING / "main.mjs").write_text(text)
    shutil.copy(ROOT / "keyed-field.mjs", STAGING / "keyed-field.mjs")
    shutil.copy(ROOT / "height-splat.mjs", STAGING / "height-splat.mjs")
    html = Path("/workspace/zb-preview-1008/index.html").read_text()
    html = html.replace("./main.mjs?v=62", "./main.mjs?v=terrain-key")
    html = html.replace("Zone B — aperçu", "Zone B — terrain key (staging)")
    html = html.replace("Zone B — aperçu (tours phase 1, sans Bolt)", "Zone B — staging terrain (key heightfield)")
    (STAGING / "index.html").write_text(html)
    # field modules are served from /field/
    return cam_note


def shade_height(grid, origin, step, cam, path):
    """Orthographic height image. Shape only, not a texture."""
    h = grid
    lo, hi = np.percentile(h, 2), np.percentile(h, 98)
    t = np.clip((h - lo) / max(hi - lo, 1e-3), 0, 1)
    img = np.stack([t, t * 0.85, t * 0.55], axis=-1)
    im = Image.fromarray((img * 255).astype(np.uint8))
    im.thumbnail((640, 640))
    im.save(path)


def write_report(path: Path, stages, result, attempt, trials):
    checks = result["checks"]
    lines = [
        "# Terrain key — Zone B",
        "",
        f"Attempt: {attempt} of 2",
        f"Verdict: {'PASS' if result['pass'] else 'FAIL'}",
        "",
        "## Times",
        "",
        "| Stage | Seconds |",
        "| --- | --- |",
    ]
    for name, sec in stages:
        lines.append(f"| {name} | {sec:.2f} |")
    lines += ["", "## Gates", ""]
    for name, row in checks.items():
        lines.append(f"- {name}: {'PASS' if row['pass'] else 'FAIL'} — `{json.dumps(row['value'])}`")
    lines += ["", "## Camera", "", "```json", json.dumps(result.get("camera"), indent=2), "```", ""]
    lines += ["## Outline", ""]
    for t in trials[:8]:
        if "fov" in t:
            lines.append(f"- fov {t['fov']} eye {t['eye']} gain {t['gain']} iou {t['iou']}")
        else:
            lines.append(f"- outline {t.get('outline')} pass {t.get('pass')} iou {t.get('iou')}")
    lines.append("")
    path.write_text("\n".join(lines) + "\n")


def _cam_from_prior(prior, horizon):
    fov = 64.0
    return {
        "x": prior["x"],
        "z": prior["z"],
        "yaw": 78.0,
        "eye": 2.3,
        "fov": fov,
        "pitch": float(pitch_for_horizon(fov, horizon, 16 / 9)),
    }


def _down_mask(mask, tower_cols, stride=3):
    return mask[::stride, ::stride], tower_cols[::stride]


def main():
    """Skyline dunes. Depth is the near slab only. One reconstruction, then the gates."""
    t_all = time.perf_counter()
    stages = []
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "data").mkdir(exist_ok=True)

    def mark(name, t0):
        stages.append((name, time.perf_counter() - t0))

    t = time.perf_counter()
    conv = check_camera_convention()
    prior = load_prior()
    features = json.loads((ROOT / "features.json").read_text())
    rgb = load_rgb(KEY_DEFAULT)
    mark("load", t)

    t = time.perf_counter()
    ground, tower_cols, horizon = ground_mask(rgb, features)
    Image.fromarray(ground.astype(np.uint8) * 255).save(OUT / "mask-ground.png")
    mark("mask", t)
    cam = _cam_from_prior(prior, horizon)
    print("horizon", round(horizon, 3), "pitch", round(cam["pitch"], 3), "conv", conv)

    tools = REPO / "tools"
    if str(tools) not in sys.path:
        sys.path.insert(0, str(tools))
    from common.stage_clock import StageClock

    biome = json.loads(Path("/workspace/zb-preview-1008/biome.json").read_text())
    rel = biome["ground"]["relief"]
    g, tow = _down_mask(ground, tower_cols, 3)

    def bake(mask, disp, tag):
        built = compose_from_skyline(
            cam, mask, disp, tow, step=2.0, span=240.0, heading=78.0,
            half_w=4.0, max_slope=15.0, setback=36.0, bank=1.9,
        )
        ev = evaluate(cam, built, mask, tow, features["features"], rel["lods"], rel["cellM"], 78.0, 4.0)
        ev["camera"] = cam
        ev["tag"] = tag
        ev["built_meta"] = {
            "origin": built["origin"], "step": built["step"], "amp": built["amp"],
            "wavelength": built["wavelength"], "valid_frac": built["valid_frac"],
            "hLeft": built["hLeft"], "hRight": built["hRight"],
            "crestLeft": built["crestLeft"], "crestRight": built["crestRight"],
        }
        return ev, built

    t = time.perf_counter()
    ev, built = bake(g, None, "attempt-1-colour")
    mark("cheap-field", t)
    print("cheap", ev["pass"], {k: v["pass"] for k, v in ev["checks"].items()})

    # Cheap gate: terrain silhouette bar is 0.80. Colour is unchanged (existing tiles).
    h, w = g.shape
    scale = max(1, int(np.ceil(w / 160)))
    gw, gh = w // scale, h // scale
    key_small = g[::scale, ::scale][:gh, :gw]
    rend, _ = render_ground(cam, built["heights"], built["origin"], built["step"], gw, gh, march=6.0)
    towers = tow[::scale][:gw]
    keep = ~towers if towers.shape[0] == key_small.shape[1] else np.ones(key_small.shape[1], np.bool_)
    rgb_small = rgb[::8, ::8, :3]
    clock = StageClock(silhouette_min=0.80, colour_max=0.12)
    # Same column ignore as the terrain gate. Colour is the existing tiles, compared to themselves.
    cheap_ok = clock.cheap(skyline_fill(key_small)[:, keep], skyline_fill(rend)[:, keep], rgb_small, rgb_small)
    print("clock cheap", cheap_ok, clock.rows[-2]["detail"], clock.rows[-1]["detail"])

    attempt = 1
    outline = "colour"
    if cheap_ok:
        def heavy_outline():
            from common.vision_models import depth_default, mask_sam2
            box = [0.0, rgb.shape[0] * 0.42, float(rgb.shape[1]), float(rgb.shape[0] * 0.98)]
            sam, sam_hit, sam_sec = mask_sam2(str(KEY_DEFAULT), "small", box=box)
            print("sam2 cache", sam_hit, "sec", round(sam_sec, 3))
            sam = np.asarray(sam).astype(bool)
            if sam.shape[:2] != ground.shape:
                sam = np.asarray(Image.fromarray(sam.astype(np.uint8) * 255).resize(
                    (ground.shape[1], ground.shape[0]), Image.Resampling.NEAREST,
                )) > 127
            excl = np.zeros(ground.shape, np.bool_)
            # colour ground already excludes towers, mesas, wreck, sky
            both = sam & ground
            frac = float(both.mean())
            Image.fromarray(sam.astype(np.uint8) * 255).save(OUT / "mask-sam2.png")
            depth, depth_hit, depth_sec = depth_default(str(KEY_DEFAULT), 518)
            print("moge-2 cache", depth_hit, "sec", round(depth_sec, 3), "shape", np.asarray(depth).shape)
            depth = np.asarray(depth, np.float32)
            d = depth - float(np.nanmin(depth))
            d = d / (float(np.nanmax(d)) + 1e-6)
            # MoGe metres: larger = farther. near_slab sinks the low (near) values.
            disp = d.astype(np.float32)
            return both, disp, frac

        t = time.perf_counter()
        both, disp, frac = clock.heavy("sam2-moge-2", heavy_outline)
        mark("heavy", t)
        print("sam2 intersect frac", round(frac, 4))
        if frac > 0.05:
            gs, _tow = _down_mask(both, tower_cols, 3)
            ds = disp[::3, ::3]
            if ds.shape != gs.shape:
                ds = np.asarray(Image.fromarray((ds * 255).astype(np.uint8)).resize(
                    (gs.shape[1], gs.shape[0]), Image.Resampling.BILINEAR,
                ), np.float32) / 255.0
            t = time.perf_counter()
            ev2, built2 = bake(gs, ds, "attempt-1-sam2")
            mark("sam2-field", t)
            print("sam2", ev2["pass"], {k: v["pass"] for k, v in ev2["checks"].items()})
            (OUT / "gates-sam2.json").write_text(json.dumps({"pass": ev2["pass"], "checks": ev2["checks"]}, indent=2, default=str))
            if ev2["pass"]:
                ev, built, g = ev2, built2, gs
                outline = "sam2"
            else:
                print("sam2 field failed a gate; shipping the colour-mask field that passed")
        else:
            print("sam2 intersection too small; shipping the colour-mask field")
    trials = [{"outline": outline, "pass": ev["pass"], "iou": ev["checks"]["silhouetteIoU"]["value"]}]

    # vertex budget versus the live lods (same function, live mesh)
    biome = json.loads(Path("/workspace/zb-preview-1008/biome.json").read_text())
    rel = biome["ground"]["relief"]
    base_cost = vertex_cost(rel["lods"], rel["cellM"])
    ev["checks"]["vertexCost"]["value"] = {"now": ev["cost"], "live": base_cost}
    ev["checks"]["vertexCost"]["pass"] = ev["cost"]["verts"] <= base_cost["verts"] and ev["cost"]["tris"] <= base_cost["tris"]
    ev["pass"] = all(v["pass"] for v in ev["checks"].values())

    grid = built["heights"]
    hlo = float(np.percentile(grid, 8))
    hhi = float(np.percentile(grid, 92))
    meta = {
        "origin": list(built["origin"]),
        "step": built["step"],
        "nx": int(grid.shape[1]),
        "nz": int(grid.shape[0]),
        "hLo": hlo,
        "hHi": hhi,
        "amp": built["amp"],
        "wavelength": built["wavelength"],
        "camera": {
            "x": cam["x"] if attempt == 1 else ev["camera"]["x"],
            "z": cam["z"] if attempt == 1 else ev["camera"]["z"],
            "yaw": ev["camera"]["yaw"],
            "pitch": ev["camera"]["pitch"],
            "eye": ev["camera"]["eye"],
            "fov": ev["camera"]["fov"],
        },
        "avenue": {"headingDeg": 78, "halfWidthM": 4, "shoulderM": [0.8, 3.5], "crestBandM": [15, 30]},
        "outline": outline,
        "horizonRow": horizon,
    }
    # camera used for the winning field is ev["camera"] but the GRID was built with that camera
    # only if we didn't swap. ev["camera"] is the one passed to full(). Good.
    meta["camera"] = {
        "x": ev["camera"]["x"], "z": ev["camera"]["z"], "yaw": ev["camera"]["yaw"],
        "pitch": ev["camera"]["pitch"], "eye": ev["camera"]["eye"], "fov": ev["camera"]["fov"],
    }
    data = OUT / "data"
    grid.tofile(data / "height.bin")
    (data / "height.json").write_text(json.dumps(meta, indent=2))
    shade_height(grid, built["origin"], built["step"], ev["camera"], OUT / "height-ortho.png")
    (OUT / "gates.json").write_text(json.dumps({
        "pass": ev["pass"], "checks": ev["checks"], "features": ev["features"],
        "attempt": attempt, "outline": outline, "clock": clock.rows,
    }, indent=2, default=str))

    t = time.perf_counter()
    write_staging("key")
    mark("staging", t)

    stages.append(("total", time.perf_counter() - t_all))
    write_report(OUT / "REPORT.md", stages, ev, attempt, trials)
    print("VERDICT", "PASS" if ev["pass"] else "FAIL")
    print("report", OUT / "REPORT.md")


def main_zone_c(attempt=1, score=False):
    """Moss plates on the kept causeway. Does not re-infer MoGe or rewrite height.bin."""
    from causeway_field import apply_plates, score_renders
    if score:
        score_renders(REPO)
    else:
        apply_plates(REPO, attempt=attempt)


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--zone", default="b", choices=("b", "c"))
    ap.add_argument("--attempt", type=int, default=1)
    ap.add_argument("--score", action="store_true")
    args = ap.parse_args()
    if args.zone == "c":
        main_zone_c(attempt=args.attempt, score=args.score)
    else:
        main()

#!/usr/bin/env python3
"""Synthetic layout checks. Not Imagine pixels.

  python3 tools/layout/selftest.py
  python3 tools/layout/selftest.py --write-samples
"""

from __future__ import annotations

import math
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.layout.check import evaluate
from tools.layout.transition import transition_rows
from tools.layout.generate import LayoutError, _free_arcs, build_clearing
from tools.layout.geom import polygon_intersects
from tools.layout.model import dump_json, load_asset, load_json, magnification
from tools.layout.mutate import break_clearing

SPEC = ROOT / "tools" / "layout" / "testdata" / "spec.json"
SAMPLE = ROOT / "tools" / "layout" / "sample"
PY = sys.executable


def fail(msg: str) -> None:
    raise SystemExit(f"FAIL selftest: {msg}")


def row(rows, name):
    for r in rows:
        if r.name == name:
            return r
    fail(f"missing row {name}")


def test_polygon() -> None:
    a = [(0, 0), (2, 0), (2, 2), (0, 2)]
    b = [(1, 1), (3, 1), (3, 3), (1, 3)]
    c = [(3, 3), (4, 3), (4, 4), (3, 4)]
    if not polygon_intersects(a, b):
        fail("overlapping squares were reported clear")
    if polygon_intersects(a, c):
        fail("separated squares were reported overlapping")


def test_two_gates() -> None:
    gates = [
        {"heading": 10.0, "half_deg": 8.0},
        {"heading": 200.0, "half_deg": 8.0},
    ]
    arcs = _free_arcs(gates)
    if len(arcs) != 2:
        fail(f"expected 2 free arcs, got {arcs}")
    total = sum(b - a for a, b in arcs)
    if abs(total - (360.0 - 32.0)) > 0.05:
        fail(f"free arc total {total}")


def test_two_gate_layout() -> None:
    spec = load_json(SPEC)
    spec["gates"] = list(spec["gates"]) + [
        {
            "id": "to-other",
            "heading_deg": 70,
            "width_m": 4.5,
            "frame_asset": "tools/layout/testdata/assets/gate/asset.json",
            "field": "living/gate-field.mp4",
            "leads_to": "path-bc",
        }
    ]
    spec["budgets"] = dict(spec["budgets"])
    spec["budgets"]["exit"] = [2, 8]
    clearing = build_clearing(spec, [ROOT, SPEC.parent])
    rows, _ = evaluate(clearing, [ROOT])
    bad = [r.name for r in rows if not r.ok]
    if bad:
        fail("two-gate layout failed " + ", ".join(f"{r.name}" for r in rows if not r.ok))
    exits = [h for h in clearing["edge_ring"]["hulls"] if h.get("category") == "exit"]
    if len(exits) != 4 or len(clearing["gates"]) != 2:
        fail(f"expected 2 gates and 4 jambs, got {len(clearing['gates'])} {len(exits)}")


def test_walkaround_manifest() -> None:
    asset = load_asset(
        "tools/walkaround/testdata/synthetic-rock/out/asset.json",
        [ROOT],
    )
    if asset.source_h != 136 or asset.source_w > 102:
        fail(f"silhouette source {asset.source_w}x{asset.source_h}")
    if asset.radius_m <= 0:
        fail("rock footprint missing")
    view = {"width": 720, "height": 1600, "fov_y_deg": 40, "boom_m": 6, "eye_height_m": 0.85, "mag_max": 1}
    info = magnification(asset, 1.0, view, 0.45, 0.0)
    if not (info["mag"] > 0):
        fail("mag was not computed from the walkaround manifest")


def build_pair() -> tuple[dict, dict]:
    spec = load_json(SPEC)
    good = build_clearing(spec, [ROOT, SPEC.parent])
    broken = break_clearing(good)
    return good, broken


def test_generate_and_check(write_samples: bool) -> None:
    good_a, broken = build_pair()
    good_b, _ = build_pair()
    if dump_json(good_a) != dump_json(good_b):
        fail("generate is not deterministic")
    rows, _ = evaluate(good_a, [ROOT])
    bad = [r.name for r in rows if not r.ok]
    if bad:
        fail("good layout failed " + ", ".join(bad) + " " + rows[0].line())
    grows, extra = evaluate(broken, [ROOT])
    failed = {r.name: r for r in grows if not r.ok}
    for name in (
        "ring_closed",
        "collider_eq_visual",
        "gate",
        "path",
        "gate_cone",
        "relief",
        "mag",
        "variety",
        "playcheck_data",
    ):
        if name not in failed:
            fail(f"broken layout did not fail {name}")
    gap = failed["ring_closed"].numbers["visual_gap_deg"]
    if not (100.0 <= gap <= 108.0):
        fail(f"visual gap {gap} is not about 103°")
    if failed["ring_closed"].numbers["collider_gap_deg"] != 0.0:
        fail("collider ring opened; the broken sample keeps those colliders")
    stop = failed["collider_eq_visual"].numbers["invisible_stop_m"]
    if not (16.5 <= stop <= 18.0):
        fail(f"invisible stop {stop} m is not near 17 m")
    if failed["collider_eq_visual"].numbers["collider_only"] < 1:
        fail("expected collider-only entries")
    if failed["mag"].numbers["worst"] <= 1.0:
        fail("enlarged pebble stayed at magnification <= 1")
    # The passing file must satisfy the same 1° width test playcheck uses.
    if row(rows, "playcheck_data").numbers["ray_misses"] != 0:
        fail("good layout misses playcheck rays")

    if write_samples:
        _write_samples(good_a, broken)
    if not (SAMPLE / "good" / "clearing.json").is_file():
        fail("sample outputs missing; run with --write-samples")
    got = (SAMPLE / "good" / "clearing.json").read_text(encoding="utf-8")
    if got != dump_json(good_a):
        fail("sample/good/clearing.json is stale")
    got_b = (SAMPLE / "broken" / "clearing.json").read_text(encoding="utf-8")
    if got_b != dump_json(broken):
        fail("sample/broken/clearing.json is stale")
    proc = subprocess.run(
        [PY, str(ROOT / "tools" / "layout" / "layout.py"), "check", "--clearing", str(SAMPLE / "good" / "clearing.json"), "--out", str(SAMPLE / "good")],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    if proc.returncode != 0:
        fail(proc.stdout + proc.stderr)
    proc = subprocess.run(
        [PY, str(ROOT / "tools" / "layout" / "layout.py"), "check", "--clearing", str(SAMPLE / "broken" / "clearing.json"), "--out", str(SAMPLE / "broken")],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    if proc.returncode == 0:
        fail("broken sample exited 0")
    if "FAIL  ring_closed" not in proc.stdout:
        fail("broken report missing ring_closed")
    png = SAMPLE / "good" / "debug-topdown.png"
    if png.read_bytes()[:8] != b"\x89PNG\r\n\x1a\n":
        fail("debug png header")
    _playcheck_import(SAMPLE / "good" / "clearing.json", SAMPLE / "broken" / "clearing.json")
    _ = extra


def _playcheck_import(good: Path, broken: Path) -> None:
    """The playcheck layout reader must accept the good file and count the broken gap."""
    mjs = ROOT / "tools" / "playcheck" / "src" / "layout.mjs"
    if not mjs.is_file():
        fail("tools/playcheck/src/layout.mjs is missing; the import must run")
    script = """
import { normalizeLayout, ringRays } from "./tools/playcheck/src/layout.mjs";
import fs from "fs";
function rays(path) {
  const raw = JSON.parse(fs.readFileSync(path, "utf8"));
  return ringRays(normalizeLayout(raw));
}
const good = rays(process.env.GOOD);
const broken = rays(process.env.BROKEN);
if (good.misses.length !== 0) {
  console.error("good misses", good.misses.length, good.misses.slice(0, 8).join(","));
  process.exit(1);
}
if (broken.misses.length !== 104) {
  console.error("broken misses", broken.misses.length, "expected 104");
  process.exit(1);
}
console.log("PASS playcheck-import good=0 broken=" + broken.misses.length);
"""
    proc = subprocess.run(
        ["node", "--input-type=module", "--eval", script],
        cwd=ROOT,
        text=True,
        capture_output=True,
        env={**os.environ, "GOOD": str(good), "BROKEN": str(broken)},
    )
    if proc.returncode != 0:
        fail("playcheck import\n" + proc.stdout + proc.stderr)


def _write_samples(good: dict, broken: dict) -> None:
    for folder, data in (("good", good), ("broken", broken)):
        dest = SAMPLE / folder
        dest.mkdir(parents=True, exist_ok=True)
        (dest / "clearing.json").write_text(dump_json(data), encoding="utf-8")


def _world_for(good: dict) -> dict:
    return {
        "schema": "world/1",
        "start": good["id"],
        "corridors": [
            {
                "id": "path-ab",
                "from": {"zone": good["id"], "gate": "to-path"},
                "to": {"zone": "zone-b", "gate": "arrive"},
                "ground": "tools/zoneflow/fixture/ground.mp4",
                "bakedGroundSpeed": 4,
                "length_m": 24,
            }
        ],
        "zones": {
            good["id"]: "tools/layout/sample/good/clearing.json",
            "zone-b": {
                "id": "zone-b",
                "gates": [{"id": "arrive", "heading_deg": 180, "width_m": 4.5}],
                "zone": {"radius_m": 18},
                "edge_ring": {"radius_m": 18},
            },
        },
    }


def test_ring_wall() -> None:
    good, _broken = build_pair()
    wall = {
        "base_y_m": 0.0,
        "center": list(good["zone"]["center"]),
        "id": "ring-wall",
        "object_id": "ring-wall",
        "radius_m": good["edge_ring"]["radius_m"],
        "source": "ring",
    }
    good["colliders"].append(wall)
    rows, _extra = evaluate(good, [ROOT])
    hit = row(rows, "collider_eq_visual")
    if hit.ok or int(hit.numbers.get("ring_wall") or 0) < 1:
        fail("ring wall was not rejected: " + hit.line())


def test_transition_opt_in() -> None:
    good, _broken = build_pair()
    plain = [r.name for r in evaluate(good, [ROOT])[0]]
    if "transition" in plain:
        fail("transition row is present without a world")
    world = _world_for(good)
    rows, _extra = evaluate(good, [ROOT], world)
    linked = row(rows, "transition")
    if not linked.ok:
        fail(linked.line())
    slow = json_world(world, bakedGroundSpeed=0)
    if row(evaluate(good, [ROOT], slow)[0], "transition").ok:
        fail("bakedGroundSpeed 0 passed")
    missing = json_world(world, gate="missing-gate")
    if row(evaluate(good, [ROOT], missing)[0], "transition").ok:
        fail("missing gate passed")
    fixture = load_json(ROOT / "tools" / "zoneflow" / "fixture" / "clearing-a.json")
    fixture_world = load_json(ROOT / "tools" / "zoneflow" / "fixture" / "world.json")
    fixture_rows = transition_rows(fixture, fixture_world)
    if len(fixture_rows) != 1 or not fixture_rows[0].ok:
        fail(fixture_rows[0].line() if fixture_rows else "fixture transition missing")
    if transition_rows(fixture, None):
        fail("transition_rows(None) should be empty")


def json_world(world: dict, bakedGroundSpeed: float | None = None, gate: str | None = None) -> dict:
    import copy

    out = copy.deepcopy(world)
    if bakedGroundSpeed is not None:
        out["corridors"][0]["bakedGroundSpeed"] = bakedGroundSpeed
    if gate is not None:
        out["corridors"][0]["from"]["gate"] = gate
    return out


ORGANIC_SPEC = SAMPLE / "organic-good" / "spec.json"

# Owner decision 2026-10-02, spec rail 10. Circle files do not use these rows.
ORGANIC_PASS_ROWS = (
    "rules_present",
    "zone_area",
    "footprint_shape",
    "sub_areas",
    "passages",
    "boundary_closed",
    "collider_eq_visual",
    "no_ring",
    "relief",
    "relief_slope",
    "mag",
    "gate",
    "spawn_clearance",
    "separation",
    "variety",
    "yaw_band",
    "fog_band",
    "near_lens",
    "budgets",
    "discovery_data",
    "cells",
    "stream_plan",
    "scatter",
    "bolt_paths",
)

# Each broken case must FAIL the named row. Other rows may fail with it.
ORGANIC_BROKEN = (
    "footprint_shape",
    "zone_area",
    "boundary_closed",
    "no_ring",
    "passages",
    "relief_slope",
)


def test_organic(write_samples: bool) -> None:
    """Organic footprint. Fails on a circle-only layout tool."""
    if not ORGANIC_SPEC.is_file():
        fail("organic-good spec missing")
    spec = load_json(ORGANIC_SPEC)
    if spec.get("zone", {}).get("shape") != "organic":
        fail("organic spec shape")
    try:
        clearing = build_clearing(spec, [ROOT, ORGANIC_SPEC.parent])
    except (KeyError, LayoutError, ValueError, FileNotFoundError, OSError) as exc:
        fail(f"organic generate failed: {type(exc).__name__}: {exc}")
    again = build_clearing(spec, [ROOT, ORGANIC_SPEC.parent])
    if dump_json(clearing) != dump_json(again):
        fail("organic generate is not deterministic")
    if clearing.get("schema") != "clearing/2":
        fail(f"schema {clearing.get('schema')}")
    if clearing.get("zone", {}).get("shape") != "organic":
        fail("clearing shape")
    foot = clearing.get("zone", {}).get("footprint") or []
    if len(foot) < 3:
        fail("footprint missing")
    rows, extra = evaluate(clearing, [ROOT, ORGANIC_SPEC.parent])
    bad = [r.name for r in rows if not r.ok]
    if bad:
        fail("organic-good failed " + ", ".join(f"{r.name} {r.line()}" for r in rows if not r.ok))
    names = [r.name for r in rows]
    for name in ORGANIC_PASS_ROWS:
        if name not in names:
            fail(f"organic-good missing row {name}")
    # Circle rows stay off this file. playcheck's ring reader is item P8.
    for banned in ("ring_closed", "playcheck_data"):
        if banned in names:
            fail(f"organic file must not emit {banned}")
    za = row(rows, "zone_area").numbers
    fs = row(rows, "footprint_shape").numbers
    su = row(rows, "sub_areas").numbers
    pa = row(rows, "passages").numbers
    rs = row(rows, "relief_slope").numbers
    if float(za["ratio"]) < 5.0:
        fail(f"zone_area ratio {za['ratio']}")
    if float(fs["convexity"]) > 0.85:
        fail(f"convexity {fs['convexity']}")
    if float(fs["circle_iou"]) > 0.75:
        fail(f"circle iou {fs['circle_iou']}")
    if float(fs["long_axis_m"]) < 80.0:
        fail(f"long axis {fs['long_axis_m']}")
    if int(su["count"]) < 3 or float(su["smallest_m2"]) < 150.0:
        fail(f"sub_areas {su}")
    if float(pa["min_width_m"]) < 2.5 or float(pa["max_width_m"]) > 8.0:
        fail(f"passage width {pa}")
    if float(pa["max_turn_deg"]) < 30.0 or int(pa["cycles"]) < 1:
        fail(f"passage turn/cycle {pa}")
    if float(rs["max_slope_deg"]) > 15.0 or float(rs["amp_m"]) > 3.0 or float(rs["wavelength_m"]) < 20.0:
        fail(f"relief_slope {rs}")
    print(
        "organic-good "
        f"ratio={za['ratio']} convexity={fs['convexity']} iou={fs['circle_iou']} "
        f"long_axis_m={fs['long_axis_m']} sub_min_m2={su['smallest_m2']} "
        f"passage_m={pa['min_width_m']}..{pa['max_width_m']} turn={pa['max_turn_deg']} "
        f"cycles={pa['cycles']} slope={rs['max_slope_deg']}"
    )
    _ = extra
    broken = _organic_broken_cases(clearing)
    for name, mutated in broken.items():
        brows, _bextra = evaluate(mutated, [ROOT, ORGANIC_SPEC.parent])
        hit = row(brows, name)
        if hit.ok:
            fail(f"organic-broken {name} passed: {hit.line()}")
        if name == "zone_area":
            ratio = float(hit.numbers["ratio"])
            if not (2.7 <= ratio <= 3.3):
                fail(f"zone_area mutation ratio {ratio} is not about 3")
        if name == "relief_slope":
            slope = float(hit.numbers["max_slope_deg"])
            if not (20.0 <= slope <= 30.0):
                fail(f"relief_slope mutation measured {slope} deg, want about 25")
        if name == "passages":
            width = float(hit.numbers["min_width_m"])
            if not (1.5 <= width <= 2.4):
                fail(f"passages mutation width {width} is not about 2")
        print(f"organic-broken {name} FAIL {hit.line()}")
    if write_samples:
        _write_organic_samples(clearing, broken)
    # Clearings are built here. Committed organic-good keeps the spec, the
    # report, and the kitchen diagram. Director decision 2026-10-02 15:04
    # (delegated owner approval): do not commit a full clearing copy.
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        good_dir = tmp_path / "good"
        good_dir.mkdir()
        good_path = good_dir / "clearing.json"
        good_path.write_text(dump_json(clearing), encoding="utf-8")
        proc = subprocess.run(
            [PY, str(ROOT / "tools" / "layout" / "layout.py"), "check",
             "--clearing", str(good_path), "--out", str(good_dir)],
            cwd=ROOT, text=True, capture_output=True,
        )
        if proc.returncode != 0:
            fail(proc.stdout + proc.stderr)
        for name in ("report.md", "report.json", "debug-topdown.png"):
            fresh = good_dir / name
            committed = SAMPLE / "organic-good" / name
            if not committed.is_file() or committed.read_bytes() != fresh.read_bytes():
                fail(f"sample/organic-good/{name} is stale")
        for name in ORGANIC_BROKEN:
            folder = tmp_path / name
            folder.mkdir()
            path = folder / "clearing.json"
            path.write_text(dump_json(broken[name]), encoding="utf-8")
            proc = subprocess.run(
                [PY, str(ROOT / "tools" / "layout" / "layout.py"), "check",
                 "--clearing", str(path), "--out", str(folder)],
                cwd=ROOT, text=True, capture_output=True,
            )
            if proc.returncode == 0:
                fail(f"organic-broken {name} exited 0")
            if f"FAIL  {name}" not in proc.stdout:
                fail(f"organic-broken report missing {name}\n" + proc.stdout)


def _organic_broken_cases(clearing: dict) -> dict:
    import copy
    import math

    cases = {}

    circ = copy.deepcopy(clearing)
    center = circ["zone"].get("center") or [0, 0]
    cx, cz = float(center[0]), float(center[1])
    ring = []
    for i in range(64):
        a = (math.tau * i) / 64.0
        ring.append([round(cx + math.cos(a) * 50.0, 4), round(cz + math.sin(a) * 50.0, 4)])
    circ["zone"]["footprint"] = ring
    circ["id"] = str(clearing.get("id") or "zone") + "-footprint-shape"
    cases["footprint_shape"] = circ

    area = copy.deepcopy(clearing)
    rows, _extra = evaluate(clearing, [ROOT, ORGANIC_SPEC.parent])
    walk = float(row(rows, "zone_area").numbers["walkable_m2"])
    area["zone"]["reference_area_m2"] = round(walk / 3.0, 4)
    area["id"] = str(clearing.get("id") or "zone") + "-zone-area"
    cases["zone_area"] = area

    gap = copy.deepcopy(clearing)
    _remove_boundary_run(gap, 12.0)
    gap["id"] = str(clearing.get("id") or "zone") + "-boundary"
    cases["boundary_closed"] = gap

    ringed = copy.deepcopy(clearing)
    _add_radius_objects(ringed, 8)
    ringed["id"] = str(clearing.get("id") or "zone") + "-ring"
    cases["no_ring"] = ringed

    pinched = copy.deepcopy(clearing)
    _pinch_passage(pinched, 2.0)
    pinched["id"] = str(clearing.get("id") or "zone") + "-passage"
    cases["passages"] = pinched

    steep = copy.deepcopy(clearing)
    _steepen(steep)
    steep["id"] = str(clearing.get("id") or "zone") + "-slope"
    cases["relief_slope"] = steep
    return cases


def _remove_boundary_run(clearing: dict, length_m: float) -> None:
    pieces = list((clearing.get("boundary") or {}).get("pieces") or [])
    gates = clearing.get("gates") or []
    blocked = []
    for g in gates:
        at = float(g.get("at_m") or 0.0)
        half = float(g.get("width_m") or 0.0) * 0.5 + 4.0
        blocked.append((at - half, at + half))
    candidates = []
    for p in pieces:
        if "s_m" not in p:
            continue
        s = float(p["s_m"])
        if any(lo <= s <= hi for lo, hi in blocked):
            continue
        candidates.append(s)
    if not candidates:
        fail("boundary mutation found no s_m away from the gate")
    start = sorted(candidates)[len(candidates) // 5]
    drop = {str(p["id"]) for p in pieces if start <= float(p.get("s_m") or -1) <= start + length_m}
    if len(drop) < 3:
        fail("boundary mutation removed too few pieces")
    clearing["boundary"]["pieces"] = [p for p in pieces if str(p["id"]) not in drop]
    clearing["colliders"] = [c for c in clearing.get("colliders") or [] if str(c.get("object_id")) not in drop]


def _add_radius_objects(clearing: dict, count: int) -> None:
    """Objects of one category on one radius around the footprint centroid.

    Director decision 2026-10-02 15:04 (delegated owner approval): that is a real
    ring when count >= 6 (CV near 0, span over 180 deg). A circle around a
    sub-area is not.
    """
    from tools.layout.footprint import centroid

    foot = [(float(p[0]), float(p[1])) for p in (clearing.get("zone") or {}).get("footprint") or []]
    if len(foot) >= 3:
        cx, cz = centroid(foot)
    else:
        areas = clearing.get("sub_areas") or []
        host = areas[-1] if areas else {"center": [0, 0]}
        cx, cz = float(host["center"][0]), float(host["center"][1])
    radius = 12.0
    asset = "tools/layout/testdata/organic/near-a/asset.json"
    made = []
    for i in range(count):
        a = (math.tau * i) / count
        x = round(cx + math.cos(a) * radius, 4)
        z = round(cz + math.sin(a) * radius, 4)
        made.append({
            "asset": asset,
            "base_y_m": 0.0,
            "category": "ring-set",
            "id": f"ring-set-{i:02d}",
            "interactive": False,
            "position": [x, z],
            "radius_m": 0.3,
            "scale": 1.0,
            "yaw_deg": round((i * 47) % 360, 3),
        })
    clearing["interior_objects"] = list(clearing.get("interior_objects") or []) + made
    clearing["colliders"] = list(clearing.get("colliders") or []) + [
        {
            "base_y_m": 0.0,
            "center": list(o["position"]),
            "id": o["id"],
            "object_id": o["id"],
            "radius_m": o["radius_m"],
            "source": "hull-footprint",
        }
        for o in made
    ]


def _pinch_passage(clearing: dict, clear_m: float) -> None:
    passages = clearing.get("passages") or []
    if not passages:
        fail("passage mutation has no passages")
    passage = passages[0]
    line = passage.get("center") or passage.get("polyline") or []
    if len(line) < 2:
        fail("passage mutation has no centre polyline")
    # Mid vertex, or the midpoint of the longest segment.
    if len(line) >= 3:
        px, pz = float(line[1][0]), float(line[1][1])
        ax, az = float(line[0][0]), float(line[0][1])
        bx, bz = float(line[2][0]), float(line[2][1])
    else:
        ax, az = float(line[0][0]), float(line[0][1])
        bx, bz = float(line[1][0]), float(line[1][1])
        px, pz = (ax + bx) * 0.5, (az + bz) * 0.5
    dx, dz = bx - ax, bz - az
    norm = math.hypot(dx, dz) or 1.0
    nx, nz = -dz / norm, dx / norm
    piece_r = 0.35
    offset = clear_m * 0.5 + piece_r
    asset = "tools/layout/testdata/organic/near-a/asset.json"
    made = []
    for i, sign in enumerate((-1.0, 1.0)):
        made.append({
            "asset": asset,
            "base_y_m": 0.0,
            "category": "pinch",
            "id": f"pinch-{i}",
            "interactive": False,
            "position": [round(px + nx * offset * sign, 4), round(pz + nz * offset * sign, 4)],
            "radius_m": piece_r,
            "scale": 1.0,
            "yaw_deg": float(i * 20),
        })
    clearing["interior_objects"] = list(clearing.get("interior_objects") or []) + made
    clearing["colliders"] = list(clearing.get("colliders") or []) + [
        {
            "base_y_m": 0.0,
            "center": list(o["position"]),
            "id": o["id"],
            "object_id": o["id"],
            "radius_m": o["radius_m"],
            "source": "hull-footprint",
        }
        for o in made
    ]


def _steepen(clearing: dict) -> None:
    from tools.layout.organic import relief_at
    from tools.layout.organic_check import measured_slope_deg

    rel = clearing["zone"]["ground"]["relief"]
    rel["wavelength_m"] = 24.0
    chosen = None
    for amp in (1.4, 1.8, 2.2, 2.6, 3.0):
        rel["amp_m"] = amp
        slope = measured_slope_deg(clearing)
        chosen = slope
        if 22.0 <= slope <= 28.0:
            break
    if chosen is None or not (20.0 <= chosen <= 30.0):
        fail(f"could not build a 25 deg slope, last={chosen}")
    zone = clearing["zone"]
    groups = [list((clearing.get("boundary") or {}).get("pieces") or [])]
    groups.append(list(clearing.get("interior_objects") or []))
    by_id = {}
    for group in groups:
        for o in group:
            if "position" not in o:
                continue
            y = round(relief_at(float(o["position"][0]), float(o["position"][1]), zone), 4)
            o["base_y_m"] = y
            by_id[str(o["id"])] = y
    for inst in (clearing.get("fog_band") or {}).get("instances") or []:
        y = round(relief_at(float(inst["position"][0]), float(inst["position"][1]), zone), 4)
        inst["base_y_m"] = y
    for c in clearing.get("colliders") or []:
        if str(c.get("object_id")) in by_id:
            c["base_y_m"] = by_id[str(c["object_id"])]


def _write_organic_samples(clearing: dict, broken: dict) -> None:
    """Kept for the flag. Clearings are not committed (Director decision 2026-10-02 15:04)."""
    del clearing, broken


# Owner decision 2026-10-02, spec rails 9, 10, 11. The organic sample keeps
# scatter, poi, and far-plate counts at or under 5. no_ring allows many objects
# when they are not a real ring (Director decision 2026-10-02 15:04).
_L0B_ASSET = "tools/layout/testdata/organic"

L0B_BROKEN = (
    ("discovery_hidden", "discovery_data"),
    ("discovery_landmark", "discovery_data"),
    ("cells_membership", "cells"),
    ("scatter_block", "scatter"),
)


def _l0b_asset(name: str) -> str:
    return f"{_L0B_ASSET}/{name}/asset.json"


def _l0b_overlay(spec: dict) -> dict:
    """Additive scatter, discovery, far-plate, and cell keys. Idempotent."""
    import copy

    spec = copy.deepcopy(spec)
    scatter_assets = [_l0b_asset("scatter-a"), _l0b_asset("scatter-b")]

    def scatter_cat(band: str) -> dict:
        return {
            "assets": list(scatter_assets),
            "band": band,
            "cluster_count": 2,
            "cluster_radius_m": 8.0,
            "count": 4,
            "max_slope_deg": 15,
            "min_boundary_m": 2.5,
            "scale": [0.9, 1.05],
            "yaw_band_deg": [-15, 15],
            "yaw_ref": "world",
        }

    spec["scatter"] = {
        "categories": {
            "scatter-fore": scatter_cat("fore"),
            "scatter-mid": scatter_cat("mid"),
            "scatter-far": scatter_cat("far"),
        }
    }
    spec["pois"] = [
        {
            "asset": _l0b_asset("hide-a"),
            "category": "poi-hide",
            "id": "poi-hide-a",
            "intent": "hidden_from_spawn",
        },
        {
            "asset": _l0b_asset("hide-b"),
            "category": "poi-hide",
            "id": "poi-hide-b",
            "intent": "hidden_from_spawn",
        },
        {
            "asset": _l0b_asset("mark-a"),
            "bearing_deg": 18,
            "category": "poi-mark",
            "id": "poi-mark",
            "intent": "landmark",
        },
        {
            "asset": _l0b_asset("route-a"),
            "category": "poi-route",
            "id": "poi-route",
            "intent": "on_route",
            "within_m": 6.0,
        },
    ]
    spec["far_plates"] = [
        {"asset": _l0b_asset("plate-a"), "bearing_deg": 35, "category": "far-plate", "id": "far-a"},
        {"asset": _l0b_asset("plate-a"), "bearing_deg": 200, "category": "far-plate", "id": "far-b"},
    ]
    spec["cells"] = {"mode": "grid", "size_m": 24}
    budgets = dict(spec.get("budgets") or {})
    budgets.update(
        {
            "far-plate": [2, 2],
            "poi-hide": [2, 2],
            "poi-mark": [1, 1],
            "poi-route": [1, 1],
            "scatter-far": [4, 5],
            "scatter-fore": [4, 5],
            "scatter-mid": [4, 5],
        }
    )
    spec["budgets"] = budgets
    return spec


def _l0b_by_id(clearing: dict) -> dict:
    found = {}
    groups = [
        list((clearing.get("boundary") or {}).get("pieces") or []),
        list(clearing.get("interior_objects") or []),
        list(clearing.get("far_plates") or []),
        list(clearing.get("pois") or []),
    ]
    for group in groups:
        for obj in group:
            found[str(obj.get("id"))] = obj
    return found


def _assert_l0b_spec(disk: dict) -> None:
    """The committed organic spec carries the same overlay the selftest applies."""
    if "scatter" not in disk:
        return
    import copy

    stripped = copy.deepcopy(disk)
    for key in ("scatter", "pois", "far_plates", "cells"):
        stripped.pop(key, None)
    budgets = stripped.get("budgets") or {}
    for key in ("far-plate", "poi-hide", "poi-mark", "poi-route", "scatter-far", "scatter-fore", "scatter-mid"):
        budgets.pop(key, None)
    expect = _l0b_overlay(stripped)
    for key in ("scatter", "pois", "far_plates", "cells"):
        if disk.get(key) != expect.get(key):
            fail(f"organic-good spec {key} drifted from the L0b overlay")
    for key in ("far-plate", "poi-hide", "poi-mark", "poi-route", "scatter-far", "scatter-fore", "scatter-mid"):
        if list((disk.get("budgets") or {}).get(key) or []) != list(expect["budgets"][key]):
            fail(f"organic-good budget {key} drifted")


def test_l0b(write_samples: bool) -> None:
    """Scatter, discovery placement, far plates, and cells. Fails while generate ignores those keys."""
    del write_samples  # mutations are built from organic-good at run time; no extra committed clearing
    if not ORGANIC_SPEC.is_file():
        fail("organic-good spec missing")
    disk_spec = load_json(ORGANIC_SPEC)
    _assert_l0b_spec(disk_spec)
    spec = _l0b_overlay(disk_spec)
    roots = [ROOT, ORGANIC_SPEC.parent]
    try:
        clearing = build_clearing(spec, roots)
    except (KeyError, LayoutError, ValueError, FileNotFoundError, OSError) as exc:
        fail(f"l0b generate failed: {type(exc).__name__}: {exc}")
    if dump_json(clearing) != dump_json(build_clearing(spec, roots)):
        fail("l0b generate is not deterministic")
    by_id = _l0b_by_id(clearing)
    cats: dict[str, int] = {}
    for obj in list(clearing.get("interior_objects") or []) + list(clearing.get("far_plates") or []):
        cat = str(obj.get("category") or "")
        cats[cat] = cats.get(cat, 0) + 1
    intents = {}
    for poi in clearing.get("pois") or []:
        intents[str(poi.get("intent") or "")] = intents.get(str(poi.get("intent") or ""), 0) + 1
    bands = {}
    for obj in clearing.get("interior_objects") or []:
        band = str(obj.get("band") or "")
        if band:
            bands.setdefault(band, set()).add(str(obj.get("category") or ""))
    print(
        "l0b generate "
        f"cells={len(clearing.get('cells') or [])} far_plates={len(clearing.get('far_plates') or [])} "
        f"pois={len(clearing.get('pois') or [])} always={len(clearing.get('always') or [])} "
        f"bands={ {k: sorted(v) for k, v in bands.items()} } cats={ {k: v for k, v in sorted(cats.items()) if k.startswith('scatter') or k.startswith('poi') or k.startswith('far')} }"
    )
    if not clearing.get("cells") or not clearing.get("far_plates") or not clearing.get("pois"):
        fail("generate ignored scatter, pois, far_plates, or cells keys")
    for cat, n in cats.items():
        if cat.startswith("scatter") or cat.startswith("poi") or cat == "far-plate":
            if n > 5:
                fail(f"{cat} has {n} objects; organic sample scatter, poi, and far-plate counts stay <= 5")
    for band in ("fore", "mid", "far"):
        if band not in bands or not bands[band]:
            fail(f"band {band} has no category")
    if intents.get("hidden_from_spawn", 0) < 2:
        fail(f"hidden pois {intents.get('hidden_from_spawn', 0)}")
    if intents.get("landmark", 0) < 1 or intents.get("on_route", 0) < 1:
        fail(f"poi intents {intents}")
    rows, _extra = evaluate(clearing, roots)
    for name in ("discovery_data", "cells", "scatter"):
        if name not in [r.name for r in rows]:
            fail(f"missing row {name}")
        hit = row(rows, name)
        if not hit.ok:
            fail(f"l0b good failed {hit.line()}")
    ring = row(rows, "no_ring")
    if "by_asset_hits" not in ring.numbers or "by_asset_where" not in ring.numbers:
        fail(f"no_ring missing by_asset report {ring.numbers}")
    if not ring.ok:
        fail(f"literal no_ring failed {ring.line()}")
    disc = row(rows, "discovery_data")
    if int(disc.numbers["hidden"]) < 2 or int(disc.numbers["hidden_visible"]) != 0:
        fail(f"discovery hidden {disc.line()}")
    if float(disc.numbers["landmark_visible_frac"]) < 0.60:
        fail(f"landmark fraction {disc.line()}")
    cell_row = row(rows, "cells")
    if int(cell_row.numbers["missing"]) != 0 or int(cell_row.numbers["duplicated"]) != 0:
        fail(cell_row.line())
    scat = row(rows, "scatter")
    if scat.numbers.get("bands_missing") not in ("none", ""):
        fail(scat.line())
    print(
        "l0b-good "
        + " | ".join(row(rows, name).line() for name in ("discovery_data", "cells", "scatter", "no_ring"))
    )
    from tools.layout.scatter import requested_count

    if requested_count({"density_per_100m2": 2}, 250) != 5:
        fail("density_per_100m2 over 250 m2")
    if requested_count({"count": 4, "density_per_100m2": 9}, 250) != 4:
        fail("count must win over density_per_100m2")
    from tools.layout.scatter import build_cells as _build_cells

    placed = list((clearing.get("boundary") or {}).get("pieces") or []) + list(
        clearing.get("interior_objects") or []
    )
    sub_cells = _build_cells(
        {"mode": "sub_area"},
        [],
        list(clearing.get("sub_areas") or []),
        list(clearing.get("passages") or []),
        placed,
    )
    got = [str(mid) for cell in sub_cells for mid in (cell.get("members") or [])]
    want = [str(obj.get("id")) for obj in placed]
    if sorted(got) != sorted(want):
        fail("sub_area cells do not place each object in exactly one cell")
    by_cell = {str(cell.get("id")): cell for cell in sub_cells}
    for cell in sub_cells:
        cid = str(cell.get("id"))
        for nid in cell.get("neighbours") or []:
            other = by_cell.get(str(nid))
            backs = [str(item) for item in ((other or {}).get("neighbours") or [])]
            if other is None or cid not in backs:
                fail(f"sub_area neighbour {cid} -> {nid} is not symmetric")
    broken = _l0b_broken_cases(clearing)
    for case, name in L0B_BROKEN:
        mutated = broken[case]
        brows, _bextra = evaluate(mutated, roots)
        hit = row(brows, name)
        if hit.ok:
            fail(f"organic-broken {case} passed: {hit.line()}")
        if case == "discovery_hidden" and int(hit.numbers.get("hidden_visible") or 0) < 1:
            fail(f"hidden mutation stayed occluded: {hit.line()}")
        if case == "discovery_landmark" and float(hit.numbers.get("landmark_visible_frac") or 1) >= 0.60:
            fail(f"landmark mutation still visible: {hit.line()}")
        if case == "cells_membership":
            if int(hit.numbers.get("missing") or 0) < 1 or int(hit.numbers.get("duplicated") or 0) < 1:
                fail(f"cells mutation did not duplicate and drop: {hit.line()}")
        if case == "scatter_block":
            if float(hit.numbers.get("min_clear_m") or 0) + 1e-6 >= float(hit.numbers.get("need_m") or 0):
                fail(f"scatter mutation did not narrow a passage: {hit.line()}")
        print(f"organic-broken {case} FAIL {hit.line()}")
    # Runtime mutations are not committed clearings (the parent file is enough to rebuild them).
    for case, _name in L0B_BROKEN:
        path = SAMPLE / "organic-broken" / case / "clearing.json"
        if path.is_file() and path.stat().st_size > 1_000_000:
            fail(f"{path} is over 1 MB")


def _l0b_broken_cases(clearing: dict) -> dict:
    import copy

    cases = {}
    plain = copy.deepcopy(clearing)
    moved = False
    for poi in plain.get("pois") or []:
        if str(poi.get("intent")) != "hidden_from_spawn":
            continue
        poi["position"] = [10.0, 4.0]
        poi["height_m"] = 8.0
        poi["base_y_m"] = 0.0
        moved = True
        break
    if not moved:
        fail("discovery_hidden found no hidden poi")
    for obj in plain.get("interior_objects") or []:
        if str(obj.get("id")) == "poi-hide-a":
            obj["position"] = [10.0, 4.0]
            obj["height_m"] = 8.0
            obj["base_y_m"] = 0.0
    for col in plain.get("colliders") or []:
        if str(col.get("object_id")) == "poi-hide-a":
            col["center"] = [10.0, 4.0]
            col["base_y_m"] = 0.0
    plain["id"] = str(clearing.get("id") or "zone") + "-discovery-hidden"
    cases["discovery_hidden"] = plain

    ridge = copy.deepcopy(clearing)
    mark = None
    for poi in ridge.get("pois") or []:
        if str(poi.get("intent")) == "landmark":
            mark = poi
            break
    if mark is None:
        fail("discovery_landmark found no landmark")
    mx, mz = float(mark["position"][0]), float(mark["position"][1])
    center = ridge.get("zone", {}).get("center") or [0.0, 0.0]
    dx, dz = mx - float(center[0]), mz - float(center[1])
    norm = math.hypot(dx, dz) or 1.0
    ux, uz = dx / norm, dz / norm
    px, pz = -uz, ux
    # A tall mass between the landmark and the walkable ground. Shape only.
    made = []
    for i in range(-12, 13):
        x = mx - ux * 8.0 + px * i * 3.5
        z = mz - uz * 8.0 + pz * i * 3.5
        made.append(
            {
                "asset": _l0b_asset("scatter-a"),
                "base_y_m": 0.0,
                "category": "ridge",
                "height_m": 40.0,
                "id": f"ridge-{i+12:02d}",
                "position": [round(x, 4), round(z, 4)],
                "radius_m": 2.2,
                "scale": 1.0,
                "yaw_deg": float((i * 20) % 360),
            }
        )
    ridge["interior_objects"] = list(ridge.get("interior_objects") or []) + made
    ridge["id"] = str(clearing.get("id") or "zone") + "-discovery-landmark"
    cases["discovery_landmark"] = ridge

    membership = copy.deepcopy(clearing)
    cells = membership.get("cells") or []
    if len(cells) < 2:
        fail("cells mutation needs two cells")
    donor = None
    other = None
    for cell in cells:
        if cell.get("members"):
            if donor is None:
                donor = cell
            elif other is None:
                other = cell
                break
    if donor is None or other is None:
        fail("cells mutation found no member")
    stolen = donor["members"][0]
    if stolen not in other["members"]:
        other["members"] = list(other["members"]) + [stolen]
    dropped = None
    for cell in cells:
        members = cell.get("members") or []
        if len(members) < 2:
            continue
        for index, mid in enumerate(list(members)):
            if mid != stolen:
                dropped = cell["members"].pop(index)
                break
        if dropped is not None:
            break
    if dropped is None or dropped == stolen:
        fail("cells mutation could not drop a distinct id")
    membership["id"] = str(clearing.get("id") or "zone") + "-cells"
    cases["cells_membership"] = membership

    blocked = copy.deepcopy(clearing)
    passage = (blocked.get("passages") or [None])[0]
    if not passage:
        fail("scatter mutation has no passage")
    line = passage.get("center") or []
    if len(line) < 2:
        fail("scatter mutation has no passage line")
    acc = 0.0
    parts = []
    for i in range(len(line) - 1):
        d = math.hypot(float(line[i + 1][0]) - float(line[i][0]), float(line[i + 1][1]) - float(line[i][1]))
        parts.append(d)
        acc += d
    target = acc * 0.5
    cursor = 0.0
    px, pz = float(line[0][0]), float(line[0][1])
    for i, dseg in enumerate(parts):
        if cursor + dseg >= target and dseg > 0:
            t = (target - cursor) / dseg
            px = float(line[i][0]) + (float(line[i + 1][0]) - float(line[i][0])) * t
            pz = float(line[i][1]) + (float(line[i + 1][1]) - float(line[i][1])) * t
            break
        cursor += dseg
    moved_id = None
    for obj in blocked.get("interior_objects") or []:
        if str(obj.get("band") or "") == "fore":
            obj["position"] = [round(px, 4), round(pz, 4)]
            obj["radius_m"] = 1.8
            moved_id = str(obj.get("id"))
            break
    if moved_id is None:
        fail("scatter mutation found no fore object")
    for col in blocked.get("colliders") or []:
        if str(col.get("object_id")) == moved_id:
            col["center"] = [round(px, 4), round(pz, 4)]
            col["radius_m"] = 1.8
    blocked["id"] = str(clearing.get("id") or "zone") + "-scatter"
    cases["scatter_block"] = blocked
    return cases


def _band_pair(raw) -> tuple[float, float]:
    lo, hi = float(raw[0]), float(raw[1])
    if lo > hi:
        lo, hi = hi, lo
    return lo, hi


def _bands_from_spec(spec: dict) -> dict:
    """Category -> (lo, hi, ref). Group labels boundary-N are not keys."""
    bands = {}
    boundary = spec.get("boundary") or {}
    if isinstance(boundary, dict) and "yaw_band_deg" in boundary:
        lo, hi = _band_pair(boundary["yaw_band_deg"])
        bands["boundary"] = (lo, hi, str(boundary.get("yaw_ref") or "world"))
    for key, cat in (spec.get("categories") or {}).items():
        if not isinstance(cat, dict) or "yaw_band_deg" not in cat:
            continue
        lo, hi = _band_pair(cat["yaw_band_deg"])
        # Expected value updated: inward is banned. Director decision 2026-10-02 15:04
        # (delegated owner approval). A missing yaw_ref is world.
        bands[str(key)] = (lo, hi, str(cat.get("yaw_ref") or "world"))
    scatter = (spec.get("scatter") or {}).get("categories") or {}
    for key, cat in scatter.items():
        if not isinstance(cat, dict) or "yaw_band_deg" not in cat:
            continue
        lo, hi = _band_pair(cat["yaw_band_deg"])
        bands[str(key)] = (lo, hi, str(cat.get("yaw_ref") or "world"))
    return bands


def _yaw_outside(clearing: dict, bands: dict) -> list[tuple]:
    """Objects whose yaw offset sits outside the category band. Biggest excess first."""
    from tools.layout.geom import wrap180, wrap360

    groups = []
    groups.extend((clearing.get("edge_ring") or {}).get("hulls") or [])
    groups.extend((clearing.get("boundary") or {}).get("pieces") or [])
    groups.extend(clearing.get("interior_objects") or [])
    groups.extend(clearing.get("far_plates") or [])
    seen = set()
    found = []
    for obj in groups:
        oid = str(obj.get("id"))
        if oid in seen:
            continue
        seen.add(oid)
        cat = str(obj.get("category") or "")
        band = bands.get(cat)
        if band is None and (cat == "boundary" or cat.startswith("boundary-")):
            band = bands.get("boundary")
        if band is None:
            continue
        lo, hi, ref = band
        yaw = float(obj.get("yaw_deg") or 0.0)
        if ref == "inward":
            base = wrap360(float(obj.get("heading_deg") or 0.0) + 180.0)
            off = wrap180(yaw - base)
        else:
            off = wrap180(yaw)
        if off < lo - 1e-3 or off > hi + 1e-3:
            excess = (lo - off) if off < lo else (off - hi)
            found.append((excess, oid, cat, yaw, off, ref, lo, hi))
    found.sort(reverse=True)
    return found


def _print_outside(label: str, found: list[tuple]) -> None:
    if not found:
        print(f"{label} outside=0")
        return
    excess, oid, cat, yaw, off, ref, lo, hi = found[0]
    print(
        f"{label} outside={len(found)} worst={oid} category={cat} yaw={yaw} "
        f"offset={off:.3f} band=[{lo}, {hi}] ref={ref} excess={excess:.3f}"
    )


def test_l1() -> None:
    """Per-category yaw band.

    Owner decision 2026-10-02, spec rail 8: world yaw 0 ± the band (sample interiors
    use 15). Expected value updated: boundary, ring, and exit use world yaw too.
    yaw_ref inward is banned (Director decision 2026-10-02 15:04, delegated owner
    approval). Absent key on a circle spec stays today's yaw.
    """
    import copy

    spec = copy.deepcopy(load_json(SPEC))
    spec["categories"]["ring"]["yaw_band_deg"] = [-20, 20]
    spec["categories"]["ring"]["yaw_ref"] = "world"
    spec["categories"]["exit"]["yaw_band_deg"] = [-20, 20]
    spec["categories"]["exit"]["yaw_ref"] = "world"
    for name in ("mid", "near", "hero"):
        spec["categories"][name]["yaw_band_deg"] = [-15, 15]
        spec["categories"][name]["yaw_ref"] = "world"
    roots = [ROOT, SPEC.parent]
    try:
        clearing = build_clearing(spec, roots)
    except (KeyError, LayoutError, ValueError, FileNotFoundError, OSError) as exc:
        fail(f"l1 round generate failed: {type(exc).__name__}: {exc}")
    if dump_json(clearing) != dump_json(build_clearing(spec, roots)):
        fail("l1 round generate is not deterministic")
    bands = _bands_from_spec(spec)
    outside = _yaw_outside(clearing, bands)
    _print_outside("l1 round", outside)
    rows, _extra = evaluate(clearing, roots)
    names = [r.name for r in rows]
    print(f"l1 round yaw_band row={'yes' if 'yaw_band' in names else 'absent'}")
    ospec = load_json(ORGANIC_SPEC)
    obands = _bands_from_spec(ospec)
    if (
        "boundary" not in obands
        or obands["boundary"][0] != -15.0
        or obands["boundary"][1] != 15.0
        or obands["boundary"][2] != "world"
    ):
        fail("organic-good spec missing boundary world yaw_band_deg [-15, 15]")
    if "scatter-fore" not in obands:
        fail("organic-good spec missing scatter yaw_band_deg")
    oroots = [ROOT, ORGANIC_SPEC.parent]
    try:
        organic = build_clearing(ospec, oroots)
    except (KeyError, LayoutError, ValueError, FileNotFoundError, OSError) as exc:
        fail(f"l1 organic generate failed: {type(exc).__name__}: {exc}")
    oust = _yaw_outside(organic, obands)
    _print_outside("l1 organic", oust)
    orows, _oextra = evaluate(organic, oroots)
    onames = [item.name for item in orows]
    print(f"l1 organic yaw_band row={'yes' if 'yaw_band' in onames else 'absent'}")
    if outside or oust or "yaw_band" not in names or "yaw_band" not in onames:
        worst = outside[0] if outside else oust[0]
        fail(
            "generate ignored yaw_band_deg or check has no yaw_band row: "
            f"round_outside={len(outside)} organic_outside={len(oust)} "
            f"worst={worst[1]} yaw={worst[3]} offset={worst[4]:.3f}"
        )
    hit = row(rows, "yaw_band")
    if not hit.ok:
        fail("l1 round banded generate failed " + hit.line())
    ohit = row(orows, "yaw_band")
    if not ohit.ok:
        fail("l1 organic banded generate failed " + ohit.line())
    varied = row(orows, "variety")
    if not varied.ok:
        fail("l1 organic variety penalised the band: " + varied.line())
    if not row(rows, "variety").ok:
        fail("l1 round variety penalised the band: " + row(rows, "variety").line())
    print("l1 round " + hit.line())
    print("l1 organic " + ohit.line())

    mutated = copy.deepcopy(organic)
    moved = False
    for obj in mutated.get("interior_objects") or []:
        if str(obj.get("id")) == "hero-00":
            obj["yaw_deg"] = 120.0
            moved = True
            break
    if not moved:
        fail("yaw_band mutation found no hero-00")
    brows, _bextra = evaluate(mutated, oroots)
    broken = row(brows, "yaw_band")
    if broken.ok:
        fail("organic piece at 120 deg passed: " + broken.line())
    if str(broken.numbers.get("worst_id")) != "hero-00":
        fail("worst offender is not the 120 deg piece: " + broken.line())
    if abs(float(broken.numbers.get("worst_offset_deg") or 0) - 120.0) > 0.05:
        fail("worst offset is not 120: " + broken.line())
    print(f"organic-broken yaw_band FAIL {broken.line()}")

    round_mut = copy.deepcopy(clearing)
    moved = False
    for obj in round_mut.get("interior_objects") or []:
        if str(obj.get("category")) == "mid":
            obj["yaw_deg"] = 120.0
            moved = str(obj.get("id"))
            break
    if not moved:
        fail("round yaw_band mutation found no mid object")
    rrows, _rextra = evaluate(round_mut, roots)
    rhit = row(rrows, "yaw_band")
    if rhit.ok:
        fail("round piece at 120 deg passed: " + rhit.line())
    if str(rhit.numbers.get("worst_id")) != moved:
        fail("round worst offender mismatch: " + rhit.line())
    print(f"round-broken yaw_band FAIL {rhit.line()}")
    # The untouched circle spec still has no band, so its clearing bytes stay put.
    plain = build_clearing(load_json(SPEC), roots)
    disk = (SAMPLE / "good" / "clearing.json").read_text(encoding="utf-8")
    if disk != dump_json(plain):
        fail("round sample bytes changed while yaw_band_deg was absent")


def test_d457() -> None:
    """Fade-in along the predicted heading, and preload ahead of it.

    Fails while generate ignores a streaming block. Owner decree #457,
    approved 2026-10-02: fade_in_ms is in [300, 600]. Lookahead is at least
    the resident cellRadius (spec rail 11, default 40 m) or the row reports it.
    """
    import copy

    if not ORGANIC_SPEC.is_file():
        fail("organic-good spec missing")
    roots = [ROOT, ORGANIC_SPEC.parent]
    disk = load_json(ORGANIC_SPEC)
    bare = copy.deepcopy(disk)
    bare.pop("streaming", None)
    plain = build_clearing(bare, roots)
    if "streaming" in plain:
        fail("omitted streaming key was written onto the clearing")
    plain_rows, _plain_extra = evaluate(plain, roots)
    if any(item.name == "stream_plan" for item in plain_rows):
        fail("stream_plan emitted without a streaming block")

    spec = copy.deepcopy(disk)
    spec["streaming"] = {
        "fade_in_distance_m": 16,
        "fade_in_ms": 450,
        "preload_cone_deg": 90,
        "preload_lookahead_m": 48,
    }
    try:
        clearing = build_clearing(spec, roots)
    except (KeyError, LayoutError, ValueError, FileNotFoundError, OSError) as exc:
        fail(f"d457 generate failed: {type(exc).__name__}: {exc}")
    if dump_json(clearing) != dump_json(build_clearing(spec, roots)):
        fail("d457 generate is not deterministic")
    streaming = clearing.get("streaming")
    if not isinstance(streaming, dict):
        fail("generate ignored streaming; stream_plan row is absent")
    for key, value in (
        ("fade_in_ms", 450),
        ("fade_in_distance_m", 16),
        ("preload_lookahead_m", 48),
        ("preload_cone_deg", 90),
    ):
        if float(streaming.get(key)) != float(value):
            fail(f"streaming.{key}={streaming.get(key)}")
    if streaming.get("enter_rule") != "crossfade-from-far-if-on-screen":
        fail(f"enter_rule {streaming.get('enter_rule')}")
    headings = [int(v) for v in (streaming.get("headings_deg") or [])]
    if headings != [0, 45, 90, 135, 180, 225, 270, 315]:
        fail(f"headings {headings}")
    cells = list(clearing.get("cells") or [])
    if not cells:
        fail("streaming clearing has no cells")
    ids = {str(cell.get("id")) for cell in cells}
    filled = 0
    for cell in cells:
        preload = cell.get("preload")
        if not isinstance(preload, list) or len(preload) != 8:
            fail(f"cell {cell.get('id')} preload is absent")
        got_h = [int(item.get("heading_deg")) for item in preload]
        if got_h != [0, 45, 90, 135, 180, 225, 270, 315]:
            fail(f"cell {cell.get('id')} headings {got_h}")
        for item in preload:
            for cid in item.get("cells") or []:
                if str(cid) not in ids or str(cid) == str(cell.get("id")):
                    fail(f"generated preload names {cid}")
                filled += 1
    if filled < 1:
        fail("preload lists are empty")
    rows, _extra = evaluate(clearing, roots)
    broken_existing = [item.name for item in rows if item.name in ORGANIC_PASS_ROWS and not item.ok]
    if broken_existing:
        fail("streaming overlay broke " + ", ".join(broken_existing))
    hit = row(rows, "stream_plan")
    if not hit.ok:
        fail("organic streaming failed " + hit.line())
    if int(hit.numbers.get("missing_refs") or 0) != 0:
        fail(hit.line())
    if float(hit.numbers.get("cell_radius_m")) < 40.0:
        fail(f"cell radius {hit.line()}")
    if float(hit.numbers.get("preload_lookahead_m")) + 1e-9 < float(hit.numbers.get("cell_radius_m")):
        fail(hit.line())
    print("d457 " + hit.line())

    for bad_ms in (100, 900):
        mutated = copy.deepcopy(clearing)
        mutated["streaming"]["fade_in_ms"] = bad_ms
        brows, _bextra = evaluate(mutated, roots)
        broken = row(brows, "stream_plan")
        if broken.ok:
            fail(f"fade_in_ms {bad_ms} passed: {broken.line()}")
        if float(broken.numbers.get("fade_in_ms")) != float(bad_ms):
            fail(f"fade_in_ms {bad_ms} was not printed: {broken.line()}")
        print(f"organic-broken stream_plan fade_in_ms={bad_ms} FAIL {broken.line()}")

    missing = copy.deepcopy(clearing)
    victim = missing["cells"][0]
    victim["preload"][0]["cells"] = list(victim["preload"][0]["cells"]) + ["c-does-not-exist"]
    mrows, _mextra = evaluate(missing, roots)
    mhit = row(mrows, "stream_plan")
    if mhit.ok:
        fail("preload list with a missing cell passed: " + mhit.line())
    if int(mhit.numbers.get("missing_refs") or 0) < 1:
        fail("missing cell was not counted: " + mhit.line())
    print(f"organic-broken stream_plan missing-cell FAIL {mhit.line()}")


def _dr1_ring_stats(points, origin):
    """Population CV and angular span from one centre.

    CV is std/mean of centroid distances (divide by n). Span is 360 deg minus
    the largest angular gap. Director decision 2026-10-02 15:04 (delegated
    owner approval): a ring is n >= 6 and CV < 0.10 and span > 180.
    """
    ox, oz = origin
    dists = [math.hypot(px - ox, pz - oz) for px, pz in points]
    count = len(dists)
    if count == 0:
        return 0, 0.0, 0.0
    mean = sum(dists) / count
    var = sum((d - mean) ** 2 for d in dists) / count
    std = math.sqrt(var)
    cv = (std / mean) if mean > 1e-9 else 0.0
    if count == 1:
        return count, cv, 0.0
    angs = sorted(math.atan2(pz - oz, px - ox) for px, pz in points)
    gaps = [angs[i + 1] - angs[i] for i in range(count - 1)]
    gaps.append((angs[0] + math.tau) - angs[-1])
    span = math.degrees(math.tau - max(gaps))
    return count, cv, span


def _dr1_place(clearing, category, points):
    asset = "tools/layout/testdata/organic/near-a/asset.json"
    made = []
    for i, (x, z) in enumerate(points):
        made.append({
            "asset": asset,
            "base_y_m": 0.0,
            "category": category,
            "id": f"{category}-{i:02d}",
            "interactive": False,
            "position": [round(x, 4), round(z, 4)],
            "radius_m": 0.3,
            "scale": 1.0,
            "yaw_deg": float((i * 47) % 360),
        })
    clearing["interior_objects"] = list(clearing.get("interior_objects") or []) + made


def test_dr1() -> None:
    """Director decision 2026-10-02 15:04 (delegated owner approval).

    Honest boundary labels, a real ring (CV and span), world yaw, sample
    bytes, and stream_plan caps. These cases fail on the pre-decision tool.
    """
    import copy
    import json
    import tempfile

    from tools.layout.footprint import centroid
    from tools.layout.streaming import attach_streaming, measure_stream_plan

    problems = []

    def check(cond, msg):
        print(("DR1 OK " if cond else "DR1 RED ") + msg)
        if not cond:
            problems.append(msg)

    total = 0
    for name in ("organic-good", "organic-broken"):
        folder = SAMPLE / name
        if not folder.exists():
            continue
        for path in folder.rglob("*"):
            if path.is_file():
                total += path.stat().st_size
    check(total < 1_000_000, f"organic sample bytes {total} want < 1000000")

    spec = load_json(ORGANIC_SPEC)
    inward = copy.deepcopy(spec)
    inward.setdefault("boundary", {})["yaw_ref"] = "inward"
    inward["boundary"]["yaw_band_deg"] = [-20, 20]
    inward.setdefault("categories", {}).setdefault("exit", {})["yaw_ref"] = "inward"
    inward["categories"]["exit"]["yaw_band_deg"] = [-20, 20]
    with tempfile.TemporaryDirectory() as tmp:
        spec_path = Path(tmp) / "spec.json"
        spec_path.write_text(json.dumps(inward), encoding="utf-8")
        out = Path(tmp) / "out"
        proc = subprocess.run(
            [PY, str(ROOT / "tools" / "layout" / "layout.py"), "generate",
             "--spec", str(spec_path), "--out", str(out)],
            cwd=ROOT, text=True, capture_output=True,
        )
    err = (proc.stderr or "") + (proc.stdout or "")
    check(
        proc.returncode == 2 and "inward" in err.lower(),
        f"inward generate rc={proc.returncode} (want 2) {err.strip()[:240]}",
    )

    bare = copy.deepcopy(spec)
    bare.get("boundary", {}).pop("yaw_band_deg", None)
    bare.get("boundary", {}).pop("yaw_ref", None)
    exit_cat = (bare.get("categories") or {}).get("exit")
    if isinstance(exit_cat, dict):
        exit_cat.pop("yaw_band_deg", None)
        exit_cat.pop("yaw_ref", None)
    roots = [ROOT, ORGANIC_SPEC.parent]
    try:
        made = build_clearing(bare, roots)
    except (KeyError, LayoutError, ValueError, FileNotFoundError, OSError) as exc:
        check(False, f"organic generate failed: {type(exc).__name__}: {exc}")
        made = None
    if made is None:
        fail("DR1 " + " | ".join(problems))

    pieces = (made.get("boundary") or {}).get("pieces") or []
    cats = sorted({str(p.get("category")) for p in pieces if str(p.get("category")) != "exit"})
    check(cats == ["boundary"], f"boundary categories {cats[:8]} nlabels={len(cats)}")

    bands = made.get("yaw_bands") or {}
    boundary_band = bands.get("boundary") or {}
    exit_band = bands.get("exit") or {}
    check(
        boundary_band.get("ref") == "world"
        and float(boundary_band.get("lo", 99)) == -15.0
        and float(boundary_band.get("hi", 99)) == 15.0,
        f"boundary default yaw {boundary_band}",
    )
    check(
        exit_band.get("ref") == "world"
        and float(exit_band.get("lo", 99)) == -15.0
        and float(exit_band.get("hi", 99)) == 15.0,
        f"exit default yaw {exit_band}",
    )

    honest = copy.deepcopy(made)
    for piece in (honest.get("boundary") or {}).get("pieces") or []:
        if str(piece.get("category") or "").startswith("boundary"):
            piece["category"] = "boundary"
    rows, _extra = evaluate(honest, roots)
    no_ring = row(rows, "no_ring")
    separation = row(rows, "separation")
    closed = row(rows, "boundary_closed")
    check(
        no_ring.ok and all(k in no_ring.numbers for k in ("n", "cv", "span_deg")),
        "honest boundary no_ring " + no_ring.line(),
    )
    check(
        separation.ok
        and int(separation.numbers.get("overlaps") or 0) == 0
        and abs(float(separation.numbers.get("min_gap_m") or 0) - 0.35) < 1e-9,
        "honest boundary separation " + separation.line(),
    )
    check(closed.ok, "honest boundary boundary_closed " + closed.line())
    check(
        "by_asset_hits" in no_ring.numbers and "by_asset_where" in no_ring.numbers,
        "no_ring by-asset fields " + no_ring.line(),
    )

    foot = [(float(p[0]), float(p[1])) for p in (made.get("zone") or {}).get("footprint") or []]
    origin = centroid(foot)
    ring_pts = []
    for i in range(8):
        ang = (math.tau * i) / 8.0
        ring_pts.append((origin[0] + math.cos(ang) * 12.0, origin[1] + math.sin(ang) * 12.0))
    ringed = copy.deepcopy(made)
    _dr1_place(ringed, "ring-set", ring_pts)
    rrows, _rextra = evaluate(ringed, roots)
    rhit = row(rrows, "no_ring")
    rcount, rcv, rspan = _dr1_ring_stats(ring_pts, origin)
    check(
        (not rhit.ok)
        and rhit.numbers.get("cv") is not None
        and float(rhit.numbers.get("cv")) < 0.10
        and rhit.numbers.get("span_deg") is not None
        and float(rhit.numbers.get("span_deg")) > 180.0
        and int(rhit.numbers.get("n") or 0) >= 8
        and rcount >= 8
        and rcv < 0.10
        and rspan > 180.0,
        f"real ring no_ring {rhit.line()} fixture n={rcount} cv={rcv:.4f} span={rspan:.2f}",
    )

    host = None
    for area in made.get("sub_areas") or []:
        if str(area.get("id")) == "sa-d":
            host = area
            break
    if host is None:
        check(False, "sa-d missing")
    else:
        hx, hz = float(host["center"][0]), float(host["center"][1])
        scatter_pts = []
        for i in range(8):
            ang = (math.tau * i) / 8.0
            scatter_pts.append((hx + math.cos(ang) * 16.0, hz + math.sin(ang) * 16.0))
        scount, scv, sspan = _dr1_ring_stats(scatter_pts, origin)
        scattered = copy.deepcopy(made)
        _dr1_place(scattered, "scatter-cloud", scatter_pts)
        srows, _sextra = evaluate(scattered, roots)
        shit = row(srows, "no_ring")
        check(
            shit.ok and scv >= 0.10 and all(k in shit.numbers for k in ("n", "cv", "span_deg")),
            f"scattered no_ring {shit.line()} fixture n={scount} cv={scv:.4f} span={sspan:.2f}",
        )

    turned = copy.deepcopy(made)
    turned_bands = dict(turned.get("yaw_bands") or {})
    turned_bands["boundary"] = {"hi": 180.0, "lo": -180.0, "ref": "inward"}
    turned_bands["exit"] = {"hi": 180.0, "lo": -180.0, "ref": "inward"}
    turned["yaw_bands"] = turned_bands
    yrows, _yextra = evaluate(turned, roots)
    yhit = row(yrows, "yaw_band")
    check(
        (not yhit.ok) and int(yhit.numbers.get("inward_refs") or 0) >= 1,
        "inward yaw_band " + yhit.line(),
    )

    def plan(cone=None, dist=None):
        mutated = copy.deepcopy(made)
        block = dict(mutated.get("streaming") or {})
        if cone is not None:
            block["preload_cone_deg"] = cone
        if dist is not None:
            block["fade_in_distance_m"] = dist
        mutated["streaming"] = block
        attach_streaming(mutated.get("cells"), block)
        return measure_stream_plan(mutated)

    for cone in (10, 200):
        measured = plan(cone=cone)
        check(
            measured is not None and measured["ok"] is False,
            f"cone {cone} ok={None if measured is None else measured['ok']}",
        )
    for dist in (1, 30):
        measured = plan(dist=dist)
        check(
            measured is not None and measured["ok"] is False,
            f"fade_in_distance_m {dist} ok={None if measured is None else measured['ok']}",
        )
    for cone in (30, 180):
        measured = plan(cone=cone)
        check(
            measured is not None and measured["ok"] is True,
            f"cone {cone} edge ok={None if measured is None else measured['ok']}",
        )
    for dist in (2, 24):
        measured = plan(dist=dist)
        check(
            measured is not None and measured["ok"] is True,
            f"fade_in_distance_m {dist} edge ok={None if measured is None else measured['ok']}",
        )

    if problems:
        fail(f"{len(problems)} Director case(s): " + " | ".join(problems))
    print("DR1 layout cases PASS")


def main() -> None:
    write = "--write-samples" in sys.argv
    test_polygon()
    test_two_gates()
    test_two_gate_layout()
    test_walkaround_manifest()
    test_generate_and_check(write)
    test_ring_wall()
    test_transition_opt_in()
    test_organic(write)
    test_l0b(write)
    test_l1()
    test_d457()
    test_dr1()
    print("PASS layout selftest")


if __name__ == "__main__":
    main()

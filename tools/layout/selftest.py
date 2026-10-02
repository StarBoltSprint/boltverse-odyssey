#!/usr/bin/env python3
"""Synthetic layout checks. Not Imagine pixels.

  python3 tools/layout/selftest.py
  python3 tools/layout/selftest.py --write-samples
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.layout.check import evaluate
from tools.layout.transition import transition_rows
from tools.layout.generate import _free_arcs, build_clearing
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


def main() -> None:
    write = "--write-samples" in sys.argv
    test_polygon()
    test_two_gates()
    test_two_gate_layout()
    test_walkaround_manifest()
    test_generate_and_check(write)
    test_ring_wall()
    test_transition_opt_in()
    print("PASS layout selftest")


if __name__ == "__main__":
    main()

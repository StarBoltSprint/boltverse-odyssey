#!/usr/bin/env python3
"""Kitchen checks for load-time corridor placement. Not Imagine pixels.

  python3 tools/wfc-path/selftest.py
"""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
SPEC = HERE / "testdata" / "spec.json"
CONTRADICTION = HERE / "testdata" / "contradiction.json"
PY = sys.executable

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.layout.transition import transition_rows


def load_wfc():
    spec = importlib.util.spec_from_file_location("wfc_path_tool", HERE / "wfc.py")
    if spec is None or spec.loader is None:
        raise SystemExit("FAIL selftest: cannot load wfc.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


wfc = load_wfc()


def fail(msg: str) -> None:
    raise SystemExit(f"FAIL selftest: {msg}")


def run_cli(spec: Path, out: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [PY, str(HERE / "wfc.py"), "generate", "--spec", str(spec), "--out", str(out)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )


def read_spec() -> dict:
    return json.loads(SPEC.read_text(encoding="utf-8"))


def neighbor_ok(layout: dict, spec: dict) -> None:
    tiles = wfc.parse_tiles(spec)
    cols = layout["grid"]["cols"]
    rows = layout["grid"]["rows"]
    grid = [[""] * cols for _ in range(rows)]
    for cell in layout["grid"]["cells"]:
        grid[cell["y"]][cell["x"]] = cell["tile"]
        if not str(cell["asset"]).strip():
            fail(f"empty asset on {cell['x']},{cell['y']}")
    wfc._check_neighbors(grid, tiles)


def test_bytes() -> dict:
    with tempfile.TemporaryDirectory() as tmp:
        first = Path(tmp) / "a"
        second = Path(tmp) / "b"
        left = run_cli(SPEC, first)
        right = run_cli(SPEC, second)
        if left.returncode != 0:
            fail(f"generate exit {left.returncode}: {left.stdout} {left.stderr}")
        if right.returncode != 0:
            fail(f"second generate exit {right.returncode}: {right.stdout}")
        if not left.stdout.startswith("PASS "):
            fail(f"stdout {left.stdout!r}")
        a = (first / "path-layout.json").read_bytes()
        b = (second / "path-layout.json").read_bytes()
        if a != b:
            fail("same seed wrote different bytes")
        diagram = (first / "diagram.txt").read_text(encoding="utf-8")
        if "kitchen diagram — not a play view" not in diagram:
            fail("diagram label")
        if "> = = = = = <" not in diagram:
            fail(f"diagram path\n{diagram}")
        svg = (first / "diagram.svg").read_text(encoding="utf-8")
        if "<image" in svg or "data:image" in svg:
            fail("svg embeds a picture")
        if "not a play view" not in svg:
            fail("svg label")
        layout = json.loads(a.decode("utf-8"))
    if layout["when"] != "load" or layout["draws_pixels"] is not False:
        fail("placement flags")
    if layout["schema"] != "wfc-path/1" or layout["seed"] != 11:
        fail("schema or seed")
    return layout


def test_straight(layout: dict, spec: dict) -> None:
    neighbor_ok(layout, spec)
    if len(layout["corridors"]) != 1 or len(layout["world_corridors"]) != 1:
        fail("corridor count")
    corridor = layout["corridors"][0]
    world = layout["world_corridors"][0]
    if not corridor["straight"] or len(corridor["segments"]) != 1:
        fail("straight segment")
    if corridor["segments"][0]["axis"] != "x":
        fail("axis")
    if world["id"] != "path-ab":
        fail("world id")
    if world["from"] != {"gate": "out", "zone": "zone-a"}:
        fail(f"from {world['from']}")
    if world["to"] != {"gate": "in", "zone": "zone-b"}:
        fail(f"to {world['to']}")
    if world["ground"] != "testdata/assets/corridor-ground":
        fail("ground")
    if world["bakedGroundSpeed"] != 4:
        fail("speed")
    if abs(world["length_m"] - 5.4) > 1e-6:
        fail(f"length {world['length_m']}")
    allowed = {"bakedGroundSpeed", "from", "ground", "id", "length_m", "to"}
    if set(world) != allowed:
        fail(f"world keys {sorted(world)}")
    waypoints = corridor["waypoints"]
    if len(waypoints) != 7:
        fail("waypoints")
    zs = {point[1] for point in waypoints}
    if zs != {1.35}:
        fail(f"z {zs}")
    if waypoints[0][0] != 0.45 or waypoints[-1][0] != 5.85:
        fail(f"ends {waypoints[0]} {waypoints[-1]}")
    roles = [cell["tile"] for cell in layout["grid"]["cells"] if cell["y"] == 1]
    if roles != ["gate-e", "path-ew", "path-ew", "path-ew", "path-ew", "path-ew", "gate-w"]:
        fail(f"row {roles}")


def test_seed_stable_path(spec: dict) -> None:
    one = wfc.build(spec)
    other = wfc.build({**spec, "seed": 99})
    if one["grid"] != other["grid"] or one["corridors"] != other["corridors"]:
        fail("unique corridor changed with the seed")
    if one["world_corridors"] != other["world_corridors"]:
        fail("unique world record changed with the seed")


def test_seed_changes_fill(spec: dict) -> None:
    tiles = json.loads(json.dumps(spec["tiles"]))
    tiles.append(
        {
            "id": "fill-b",
            "role": "fill",
            "asset": "testdata/tiles/fill-b",
            "mark": "b",
            "weight": 1,
            "sockets": {"n": "void", "e": "void", "s": "void", "w": "void"},
        }
    )
    layouts = [wfc.build({**spec, "seed": seed, "tiles": tiles}) for seed in (1, 2, 3, 4)]
    dumps = [wfc.dump_json(layout) for layout in layouts]
    if len(set(dumps)) < 2:
        fail("seeds did not change the fill")

    def row(layout: dict) -> list[str]:
        return [cell["tile"] for cell in layout["grid"]["cells"] if cell["y"] == 1]

    if any(row(layout) != row(layouts[0]) for layout in layouts):
        fail("seed changed the corridor tiles")
    varied = {**spec, "tiles": tiles}
    for layout in layouts:
        neighbor_ok(layout, varied)
        if any(not cell["asset"] for cell in layout["grid"]["cells"]):
            fail("seeded fill asset")


def test_contradiction() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "bad"
        proc = run_cli(CONTRADICTION, out)
        if proc.returncode != 1:
            fail(f"contradiction exit {proc.returncode}: {proc.stdout}")
        if "FAIL contradiction at 1,0" not in proc.stdout:
            fail(f"contradiction text {proc.stdout!r}")
        if (out / "path-layout.json").exists():
            fail("contradiction wrote a layout")


def test_refuse(spec: dict) -> None:
    try:
        wfc.build({**spec, "when": "run"})
    except wfc.WfcError as exc:
        if exc.code != 1 or "mid-run" not in str(exc):
            fail(f"mid-run {exc}")
    else:
        fail("mid-run was accepted")

    tiles = json.loads(json.dumps(spec["tiles"]))
    tiles[0]["asset"] = "  "
    try:
        wfc.build({**spec, "tiles": tiles})
    except wfc.WfcError as exc:
        if exc.code != 1 or "empty asset ref: tile empty" not in str(exc):
            fail(f"empty tile {exc}")
    else:
        fail("empty tile asset was accepted")

    links = json.loads(json.dumps(spec["links"]))
    links[0]["ground"] = ""
    try:
        wfc.build({**spec, "links": links})
    except wfc.WfcError as exc:
        if exc.code != 1 or "empty asset ref: link path-ab ground" not in str(exc):
            fail(f"empty ground {exc}")
    else:
        fail("empty ground was accepted")

    away = json.loads(json.dumps(spec))
    away["gates"] = [
        {"id": "gate-a", "cell": [0, 1], "tile": "gate-w", "zone": "zone-a", "gate": "out"},
        {"id": "gate-b", "cell": [6, 1], "tile": "gate-e", "zone": "zone-b", "gate": "in"},
    ]
    try:
        wfc.build(away)
    except wfc.WfcError as exc:
        if exc.code != 1 or "disconnected: path-ab" not in str(exc):
            fail(f"disconnected {exc}")
    else:
        fail("facing-away gates were joined")

    fills = json.loads(json.dumps(spec["tiles"]))
    fills.append(
        {
            "id": "other-fill",
            "role": "fill",
            "asset": "testdata/tiles/other-fill",
            "sockets": {"n": "void", "e": "path", "s": "void", "w": "void"},
        }
    )
    try:
        wfc.build({**spec, "tiles": fills})
    except wfc.WfcError as exc:
        if exc.code != 2 or "fill tiles must share sockets" not in str(exc):
            fail(f"fill sockets {exc}")
    else:
        fail("mismatched fill sockets were accepted")


def test_bend() -> None:
    spec = {
        "schema": "wfc-path/1",
        "seed": 3,
        "when": "load",
        "allow_bends": True,
        "grid": {"cols": 3, "rows": 3, "tile_m": 1},
        "tiles": [
            {
                "id": "empty",
                "role": "fill",
                "asset": "testdata/tiles/empty",
                "mark": ".",
                "sockets": {"n": "void", "e": "void", "s": "void", "w": "void"},
            },
            {
                "id": "path-ew",
                "role": "path",
                "asset": "testdata/tiles/path-ew",
                "mark": "=",
                "sockets": {"n": "void", "e": "path", "s": "void", "w": "path"},
            },
            {
                "id": "path-ns",
                "role": "path",
                "asset": "testdata/tiles/path-ns",
                "mark": "|",
                "sockets": {"n": "path", "e": "void", "s": "path", "w": "void"},
            },
            {
                "id": "corner-ne",
                "role": "path",
                "asset": "testdata/tiles/corner-ne",
                "mark": "L",
                "sockets": {"n": "path", "e": "path", "s": "void", "w": "void"},
            },
            {
                "id": "gate-s",
                "role": "gate",
                "asset": "testdata/tiles/gate-s",
                "mark": "v",
                "sockets": {"n": "void", "e": "void", "s": "path", "w": "void"},
            },
            {
                "id": "gate-w",
                "role": "gate",
                "asset": "testdata/tiles/gate-w",
                "mark": "<",
                "sockets": {"n": "void", "e": "void", "s": "void", "w": "path"},
            },
        ],
        "gates": [
            {"id": "gate-a", "cell": [0, 0], "tile": "gate-s", "zone": "zone-a", "gate": "out"},
            {"id": "gate-b", "cell": [2, 2], "tile": "gate-w", "zone": "zone-b", "gate": "in"},
        ],
        "pins": [
            {"cell": [0, 1], "tile": "path-ns"},
            {"cell": [0, 2], "tile": "corner-ne"},
            {"cell": [1, 2], "tile": "path-ew"},
        ],
        "links": [
            {
                "id": "path-ab",
                "from": "gate-a",
                "to": "gate-b",
                "ground": "testdata/assets/corridor-ground",
                "bakedGroundSpeed": 4,
            }
        ],
    }
    layout = wfc.build(spec)
    neighbor_ok(layout, spec)
    corridor = layout["corridors"][0]
    if corridor["straight"] or len(corridor["segments"]) != 2:
        fail(f"bend segments {corridor['segments']}")
    axes = [segment["axis"] for segment in corridor["segments"]]
    if axes != ["z", "x"]:
        fail(f"axes {axes}")
    for segment in corridor["segments"]:
        cells = segment["cells"]
        xs = {cell[0] for cell in cells}
        zs = {cell[1] for cell in cells}
        if len(xs) != 1 and len(zs) != 1:
            fail(f"segment not straight {cells}")
    if layout["world_corridors"]:
        fail("a bend was copied into world_corridors")
    banned = {**spec, "allow_bends": False}
    try:
        wfc.build(banned)
    except wfc.WfcError as exc:
        if exc.code != 1 or "bend: path-ab" not in str(exc):
            fail(f"bend refuse {exc}")
    else:
        fail("a bend was accepted as one corridor")


def test_transition(layout: dict) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        ground = Path(tmp) / "ground.mp4"
        ground.write_bytes(b"fixture\n")
        record = json.loads(json.dumps(layout["world_corridors"][0]))
        record["ground"] = str(ground)
        clearing_a = {
            "id": "zone-a",
            "zone": {"shape": "organic"},
            "gates": [{"id": "out", "width_m": 4, "leads_to": "path-ab"}],
        }
        clearing_b = {
            "id": "zone-b",
            "zone": {"shape": "organic"},
            "gates": [{"id": "in", "width_m": 4}],
        }
        world = {
            "corridors": [record],
            "zones": {"zone-a": clearing_a, "zone-b": clearing_b},
        }
        for clearing in (clearing_a, clearing_b):
            rows = transition_rows(clearing, world)
            if len(rows) != 1 or rows[0].name != "transition" or not rows[0].ok:
                fail(f"transition {clearing['id']} {rows[0].line() if rows else 'missing'}")


def main() -> None:
    spec = read_spec()
    layout = test_bytes()
    test_straight(layout, spec)
    test_seed_stable_path(spec)
    test_seed_changes_fill(spec)
    test_contradiction()
    test_refuse(spec)
    test_bend()
    test_transition(layout)
    print("PASS tools/wfc-path/selftest.py")


if __name__ == "__main__":
    main()

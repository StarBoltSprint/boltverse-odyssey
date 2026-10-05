#!/usr/bin/env python3
"""Load-time corridor placement between zone gates. Does not draw a world.

  python3 tools/wfc-path/wfc.py generate --spec tools/wfc-path/testdata/spec.json --out /tmp/wfc

Wave Function Collapse picks already-cooked tile ids by neighbor sockets.
It writes a grid, waypoints, and straight corridor records. It does not
shade, and it refuses to run when the spec says the solve happens during play.
"""

from __future__ import annotations

import argparse
import json
import math
import random
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import NoReturn

DIRS = (
    ("n", 0, -1, "s"),
    ("e", 1, 0, "w"),
    ("s", 0, 1, "n"),
    ("w", -1, 0, "e"),
)
SIDES = ("n", "e", "s", "w")
SCHEMA = "wfc-path/1"
MAX_CELLS = 4096


class WfcError(Exception):
    def __init__(self, message: str, code: int = 1):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class Tile:
    id: str
    asset: str
    role: str
    sockets: dict[str, str]
    weight: int
    mark: str


def dump_json(data: dict) -> str:
    return json.dumps(data, indent=2, sort_keys=True) + "\n"


def qnum(value: float) -> float:
    return round(float(value), 6)


def _fail_spec(message: str) -> NoReturn:
    raise WfcError(f"FAIL spec: {message}", 2)


def _as_int(value, label: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        _fail_spec(f"{label} is not an integer")
    return value


def _cell(value, label: str, cols: int, rows: int) -> tuple[int, int]:
    if not isinstance(value, list) or len(value) != 2:
        _fail_spec(f"{label} cell is not [col, row]")
    x = _as_int(value[0], f"{label} col")
    y = _as_int(value[1], f"{label} row")
    if x < 0 or y < 0 or x >= cols or y >= rows:
        _fail_spec(f"{label} cell is outside the grid")
    return x, y


def _sockets(raw, label: str) -> dict[str, str]:
    if not isinstance(raw, dict):
        _fail_spec(f"{label} sockets")
    out: dict[str, str] = {}
    for side in SIDES:
        value = raw.get(side)
        if not isinstance(value, str) or not value.strip():
            _fail_spec(f"{label} socket {side}")
        out[side] = value.strip()
    return out


def _mark(raw, tile_id: str) -> str:
    if raw is None:
        return tile_id[:1] or "?"
    if not isinstance(raw, str) or len(raw) != 1 or raw == "\n":
        _fail_spec(f"tile {tile_id} mark")
    return raw


def parse_tiles(spec: dict) -> dict[str, Tile]:
    raw_tiles = spec.get("tiles")
    if not isinstance(raw_tiles, list) or not raw_tiles:
        _fail_spec("tiles")
    if len(raw_tiles) > 64:
        _fail_spec("tiles")
    tiles: dict[str, Tile] = {}
    for item in raw_tiles:
        if not isinstance(item, dict):
            _fail_spec("tiles")
        tile_id = item.get("id")
        if not isinstance(tile_id, str) or not tile_id.strip():
            _fail_spec("tile id")
        tile_id = tile_id.strip()
        if tile_id in tiles:
            _fail_spec(f"duplicate tile {tile_id}")
        asset = item.get("asset")
        if not isinstance(asset, str) or not asset.strip():
            raise WfcError(f"FAIL empty asset ref: tile {tile_id}", 1)
        role = item.get("role")
        if role not in ("fill", "path", "gate"):
            _fail_spec(f"tile {tile_id} role")
        weight = item.get("weight", 1)
        weight = _as_int(weight, f"tile {tile_id} weight")
        if weight < 1:
            _fail_spec(f"tile {tile_id} weight")
        tiles[tile_id] = Tile(
            id=tile_id,
            asset=asset.strip(),
            role=role,
            sockets=_sockets(item.get("sockets"), f"tile {tile_id}"),
            weight=weight,
            mark=_mark(item.get("mark"), tile_id),
        )
    fills = [tile for tile in tiles.values() if tile.role == "fill"]
    if not fills:
        _fail_spec("no fill tile")
    fill_sig = tuple(fills[0].sockets[side] for side in SIDES)
    for tile in fills[1:]:
        if tuple(tile.sockets[side] for side in SIDES) != fill_sig:
            _fail_spec("fill tiles must share sockets")
    return tiles


def fill_labels(tiles: dict[str, Tile]) -> set[str]:
    labels: set[str] = set()
    for tile in tiles.values():
        if tile.role == "fill":
            labels.update(tile.sockets.values())
    return labels


def preferred(options: set[str], tiles: dict[str, Tile]) -> list[str]:
    fills = sorted(tid for tid in options if tiles[tid].role == "fill")
    if fills:
        return fills
    paths = sorted(tid for tid in options if tiles[tid].role == "path")
    if paths:
        return paths
    return sorted(options)


def entropy(options: list[str], tiles: dict[str, Tile]) -> float:
    if len(options) <= 1:
        return 0.0
    total = sum(tiles[tid].weight for tid in options)
    acc = 0.0
    for tid in options:
        p = tiles[tid].weight / total
        acc -= p * math.log(p)
    return acc


def choose(rng: random.Random, options: set[str], tiles: dict[str, Tile]) -> str:
    bag: list[str] = []
    for tid in preferred(options, tiles):
        bag.extend([tid] * tiles[tid].weight)
    if len(bag) == 1:
        return bag[0]
    return bag[rng.randrange(len(bag))]


def propagate(domains: list[list[set[str]]], tiles: dict[str, Tile]) -> None:
    rows = len(domains)
    cols = len(domains[0])
    queue = deque((x, y) for y in range(rows) for x in range(cols))
    steps = 0
    limit = rows * cols * max(1, len(tiles)) * 8
    while queue:
        steps += 1
        if steps > limit:
            _fail_spec("propagate did not finish")
        x, y = queue.popleft()
        here = domains[y][x]
        if not here:
            raise WfcError(f"FAIL contradiction at {x},{y}", 1)
        for direction, dx, dy, opposite in DIRS:
            nx = x + dx
            ny = y + dy
            if nx < 0 or ny < 0 or nx >= cols or ny >= rows:
                continue
            kept: set[str] = set()
            for tid in domains[ny][nx]:
                want = tiles[tid].sockets[opposite]
                if any(tiles[hid].sockets[direction] == want for hid in here):
                    kept.add(tid)
            if not kept:
                raise WfcError(f"FAIL contradiction at {nx},{ny}", 1)
            if kept != domains[ny][nx]:
                domains[ny][nx] = kept
                queue.append((nx, ny))


def pick_open(domains: list[list[set[str]]], tiles: dict[str, Tile]) -> tuple[int, int] | None:
    best: tuple[int, int] | None = None
    best_key: tuple[float, int, int] | None = None
    for y, row in enumerate(domains):
        for x, options in enumerate(row):
            if len(options) <= 1:
                continue
            group = preferred(options, tiles)
            key = (entropy(group, tiles), y, x)
            if best_key is None or key < best_key:
                best_key = key
                best = (x, y)
    return best


def solve(spec: dict, tiles: dict[str, Tile], cols: int, rows: int) -> list[list[str]]:
    open_ids = {tid for tid, tile in tiles.items() if tile.role != "gate"}
    if not open_ids:
        _fail_spec("no fill or path tile")
    domains = [[set(open_ids) for _ in range(cols)] for _ in range(rows)]
    occupied: set[tuple[int, int]] = set()

    gates = spec.get("gates")
    if not isinstance(gates, list) or len(gates) < 2:
        _fail_spec("gates")
    for gate in gates:
        if not isinstance(gate, dict):
            _fail_spec("gates")
        gate_id = gate.get("id")
        if not isinstance(gate_id, str) or not gate_id.strip():
            _fail_spec("gate id")
        tile_id = gate.get("tile")
        if not isinstance(tile_id, str) or tile_id not in tiles:
            _fail_spec(f"gate {gate_id} tile")
        if tiles[tile_id].role != "gate":
            _fail_spec(f"gate {gate_id} tile")
        x, y = _cell(gate.get("cell"), f"gate {gate_id}", cols, rows)
        if (x, y) in occupied:
            _fail_spec(f"gate {gate_id} cell")
        occupied.add((x, y))
        domains[y][x] = {tile_id}

    pins = spec.get("pins") or []
    if not isinstance(pins, list):
        _fail_spec("pins")
    for pin in pins:
        if not isinstance(pin, dict):
            _fail_spec("pins")
        tile_id = pin.get("tile")
        if not isinstance(tile_id, str) or tile_id not in tiles:
            _fail_spec("pin tile")
        x, y = _cell(pin.get("cell"), "pin", cols, rows)
        if (x, y) in occupied:
            _fail_spec("pin cell")
        occupied.add((x, y))
        domains[y][x] = {tile_id}

    propagate(domains, tiles)
    rng = random.Random(_as_int(spec.get("seed"), "seed"))
    steps = 0
    while True:
        cell = pick_open(domains, tiles)
        if cell is None:
            break
        steps += 1
        if steps > cols * rows:
            _fail_spec("collapse did not finish")
        x, y = cell
        domains[y][x] = {choose(rng, domains[y][x], tiles)}
        propagate(domains, tiles)

    return [[next(iter(domains[y][x])) for x in range(cols)] for y in range(rows)]


def _gate_index(spec: dict, cols: int, rows: int) -> dict[str, dict]:
    index: dict[str, dict] = {}
    for gate in spec["gates"]:
        gate_id = str(gate["id"]).strip()
        if gate_id in index:
            _fail_spec(f"duplicate gate {gate_id}")
        zone = gate.get("zone")
        name = gate.get("gate")
        if not isinstance(zone, str) or not zone.strip():
            _fail_spec(f"gate {gate_id} zone")
        if not isinstance(name, str) or not name.strip():
            _fail_spec(f"gate {gate_id} gate")
        x, y = _cell(gate.get("cell"), f"gate {gate_id}", cols, rows)
        index[gate_id] = {
            "id": gate_id,
            "tile": gate["tile"],
            "cell": (x, y),
            "zone": zone.strip(),
            "gate": name.strip(),
        }
    return index


def _path_edge(a: Tile, b: Tile, direction: str, opposite: str, blocked: set[str]) -> bool:
    if a.role == "fill" or b.role == "fill":
        return False
    sock = a.sockets[direction]
    if sock != b.sockets[opposite] or sock in blocked:
        return False
    return True


def walk_link(
    grid: list[list[str]],
    tiles: dict[str, Tile],
    start: tuple[int, int],
    goal: tuple[int, int],
    blocked: set[str],
    link_id: str,
) -> list[tuple[int, int]]:
    if start == goal:
        _fail_spec(f"link {link_id} endpoints share a cell")
    rows = len(grid)
    cols = len(grid[0])
    prev: dict[tuple[int, int], tuple[int, int] | None] = {start: None}
    queue = deque([start])
    found = False
    while queue:
        x, y = queue.popleft()
        if (x, y) == goal:
            found = True
            break
        here = tiles[grid[y][x]]
        for direction, dx, dy, opposite in DIRS:
            nx = x + dx
            ny = y + dy
            if nx < 0 or ny < 0 or nx >= cols or ny >= rows or (nx, ny) in prev:
                continue
            other = tiles[grid[ny][nx]]
            if not _path_edge(here, other, direction, opposite, blocked):
                continue
            prev[(nx, ny)] = (x, y)
            queue.append((nx, ny))
    if not found:
        raise WfcError(f"FAIL disconnected: {link_id}", 1)
    path: list[tuple[int, int]] = []
    cur: tuple[int, int] | None = goal
    while cur is not None:
        path.append(cur)
        cur = prev[cur]
    path.reverse()
    return path


def straight_runs(path: list[tuple[int, int]]) -> list[list[tuple[int, int]]]:
    run = [path[0]]
    heading: tuple[int, int] | None = None
    runs: list[list[tuple[int, int]]] = []
    for nxt in path[1:]:
        step = (nxt[0] - run[-1][0], nxt[1] - run[-1][1])
        if step not in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            _fail_spec("diagonal step")
        if heading is None or step == heading:
            heading = step
            run.append(nxt)
            continue
        runs.append(run)
        run = [run[-1], nxt]
        heading = step
    runs.append(run)
    return runs


def _segment(run: list[tuple[int, int]], grid: list[list[str]], tiles: dict[str, Tile], tile_m: float) -> dict:
    step = (run[1][0] - run[0][0], run[1][1] - run[0][1])
    axis = "x" if step[0] != 0 else "z"
    ids = [grid[y][x] for x, y in run]
    assets: list[str] = []
    for tile_id in ids:
        asset = tiles[tile_id].asset
        if asset not in assets:
            assets.append(asset)
    return {
        "axis": axis,
        "assets": assets,
        "cells": [[x, y] for x, y in run],
        "length_m": qnum((len(run) - 1) * tile_m),
        "tiles": ids,
    }


def _links(spec: dict, grid: list[list[str]], tiles: dict[str, Tile], cols: int, rows: int, tile_m: float) -> tuple[list[dict], list[dict], set[tuple[int, int]]]:
    gates = _gate_index(spec, cols, rows)
    raw_links = spec.get("links")
    if not isinstance(raw_links, list) or not raw_links:
        _fail_spec("links")
    allow_bends = bool(spec.get("allow_bends", False))
    blocked = fill_labels(tiles)
    corridors: list[dict] = []
    world: list[dict] = []
    used: set[tuple[int, int]] = set()
    seen: set[str] = set()
    for link in raw_links:
        if not isinstance(link, dict):
            _fail_spec("links")
        link_id = link.get("id")
        if not isinstance(link_id, str) or not link_id.strip():
            _fail_spec("link id")
        link_id = link_id.strip()
        if link_id in seen:
            _fail_spec(f"duplicate link {link_id}")
        seen.add(link_id)
        origin = gates.get(str(link.get("from") or ""))
        dest = gates.get(str(link.get("to") or ""))
        if origin is None or dest is None:
            _fail_spec(f"link {link_id} gates")
        ground = link.get("ground")
        if not isinstance(ground, str) or not ground.strip():
            raise WfcError(f"FAIL empty asset ref: link {link_id} ground", 1)
        speed = link.get("bakedGroundSpeed")
        if isinstance(speed, bool) or not isinstance(speed, (int, float)) or speed <= 0:
            _fail_spec(f"link {link_id} bakedGroundSpeed")
        path = walk_link(grid, tiles, origin["cell"], dest["cell"], blocked, link_id)
        runs = straight_runs(path)
        if len(runs) != 1 and not allow_bends:
            raise WfcError(f"FAIL bend: {link_id} runs={len(runs)}", 1)
        for cell in path:
            used.add(cell)
        segments = [_segment(run, grid, tiles, tile_m) for run in runs]
        length = qnum(sum(segment["length_m"] for segment in segments))
        waypoints = [[qnum((x + 0.5) * tile_m), qnum((y + 0.5) * tile_m)] for x, y in path]
        corridor = {
            "bakedGroundSpeed": speed,
            "from": {
                "cell": [origin["cell"][0], origin["cell"][1]],
                "gate": origin["gate"],
                "zone": origin["zone"],
            },
            "ground": ground.strip(),
            "id": link_id,
            "length_m": length,
            "segments": segments,
            "straight": len(runs) == 1,
            "to": {
                "cell": [dest["cell"][0], dest["cell"][1]],
                "gate": dest["gate"],
                "zone": dest["zone"],
            },
            "waypoints": waypoints,
        }
        corridors.append(corridor)
        if corridor["straight"]:
            world.append(
                {
                    "bakedGroundSpeed": speed,
                    "from": {"gate": origin["gate"], "zone": origin["zone"]},
                    "ground": ground.strip(),
                    "id": link_id,
                    "length_m": length,
                    "to": {"gate": dest["gate"], "zone": dest["zone"]},
                }
            )
    return corridors, world, used


def _reject_strays(grid: list[list[str]], tiles: dict[str, Tile], used: set[tuple[int, int]]) -> None:
    for y, row in enumerate(grid):
        for x, tile_id in enumerate(row):
            if tiles[tile_id].role == "path" and (x, y) not in used:
                raise WfcError(f"FAIL stray path at {x},{y}", 1)


def _check_neighbors(grid: list[list[str]], tiles: dict[str, Tile]) -> None:
    rows = len(grid)
    cols = len(grid[0])
    for y, row in enumerate(grid):
        for x, tile_id in enumerate(row):
            here = tiles[tile_id]
            for direction, dx, dy, opposite in DIRS:
                nx = x + dx
                ny = y + dy
                if nx < 0 or ny < 0 or nx >= cols or ny >= rows:
                    continue
                other = tiles[grid[ny][nx]]
                if here.sockets[direction] != other.sockets[opposite]:
                    raise WfcError(f"FAIL contradiction at {nx},{ny}", 1)


def prepare(spec: dict) -> None:
    if not isinstance(spec, dict):
        _fail_spec("root")
    schema = spec.get("schema", SCHEMA)
    if schema != SCHEMA:
        _fail_spec("schema")
    when = spec.get("when", "load")
    if when != "load":
        raise WfcError(f"FAIL mid-run WFC: when is {when!r}", 1)
    _as_int(spec.get("seed"), "seed")
    grid = spec.get("grid")
    if not isinstance(grid, dict):
        _fail_spec("grid")
    cols = _as_int(grid.get("cols"), "grid.cols")
    rows = _as_int(grid.get("rows"), "grid.rows")
    if cols < 1 or rows < 1 or cols * rows > MAX_CELLS:
        _fail_spec("grid size")
    tile_m = grid.get("tile_m")
    if isinstance(tile_m, bool) or not isinstance(tile_m, (int, float)) or tile_m <= 0:
        _fail_spec("grid.tile_m")
    if spec.get("allow_bends") not in (None, True, False):
        _fail_spec("allow_bends")


def build(spec: dict) -> dict:
    prepare(spec)
    tiles = parse_tiles(spec)
    grid_spec = spec["grid"]
    cols = int(grid_spec["cols"])
    rows = int(grid_spec["rows"])
    tile_m = float(grid_spec["tile_m"])
    solved = solve(spec, tiles, cols, rows)
    _check_neighbors(solved, tiles)
    corridors, world, used = _links(spec, solved, tiles, cols, rows, tile_m)
    _reject_strays(solved, tiles, used)
    cells = []
    for y in range(rows):
        for x in range(cols):
            tile = tiles[solved[y][x]]
            cells.append(
                {
                    "asset": tile.asset,
                    "mark": tile.mark,
                    "role": tile.role,
                    "tile": tile.id,
                    "x": x,
                    "y": y,
                }
            )
    return {
        "corridors": corridors,
        "draws_pixels": False,
        "grid": {"cells": cells, "cols": cols, "rows": rows, "tile_m": tile_m},
        "schema": SCHEMA,
        "seed": int(spec["seed"]),
        "when": "load",
        "world_corridors": world,
    }


def ascii_diagram(layout: dict) -> str:
    cols = int(layout["grid"]["cols"])
    rows = [["."] * cols for _ in range(int(layout["grid"]["rows"]))]
    for cell in layout["grid"]["cells"]:
        rows[int(cell["y"])][int(cell["x"])] = str(cell["mark"])
    lines = ["kitchen diagram — not a play view", ""]
    lines.extend(" ".join(row) for row in rows)
    lines.append("")
    return "\n".join(lines)


def _xml(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def svg_diagram(layout: dict) -> str:
    cols = int(layout["grid"]["cols"])
    rows = int(layout["grid"]["rows"])
    cell = 28
    pad = 16
    width = pad * 2 + cols * cell
    height = pad * 2 + rows * cell
    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        "<title>kitchen diagram — not a play view</title>",
        "<desc>Indices only. Not Imagine. Not a play frame.</desc>",
        f'<rect x="0" y="0" width="{width}" height="{height}" fill="#f4f1ea"/>',
    ]
    for item in layout["grid"]["cells"]:
        x = pad + int(item["x"]) * cell
        y = pad + int(item["y"]) * cell
        parts.append(
            f'<rect x="{x}" y="{y}" width="{cell}" height="{cell}" fill="none" stroke="#222"/>'
        )
        parts.append(
            f'<text x="{x + cell / 2}" y="{y + cell / 2 + 4}" text-anchor="middle" '
            f'font-family="monospace" font-size="12" fill="#222">{_xml(str(item["mark"]))}</text>'
        )
    parts.append("</svg>")
    parts.append("")
    return "\n".join(parts)


def generate(spec: dict, out: Path) -> dict:
    layout = build(spec)
    out.mkdir(parents=True, exist_ok=True)
    (out / "path-layout.json").write_text(dump_json(layout), encoding="utf-8")
    (out / "diagram.txt").write_text(ascii_diagram(layout), encoding="utf-8")
    (out / "diagram.svg").write_text(svg_diagram(layout), encoding="utf-8")
    return layout


def load_spec(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise WfcError(f"FAIL spec: cannot read {path}", 2) from None
    except json.JSONDecodeError as exc:
        raise WfcError(f"FAIL spec: {exc.msg}", 2) from None
    if not isinstance(data, dict):
        _fail_spec("root")
    return data


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Place a corridor between gates. Does not draw.")
    sub = parser.add_subparsers(dest="cmd", required=True)
    gen = sub.add_parser("generate", help="spec → path-layout.json")
    gen.add_argument("--spec", required=True, type=Path)
    gen.add_argument("--out", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        if args.cmd == "generate":
            generate(load_spec(args.spec), args.out)
            print(f"PASS {args.out / 'path-layout.json'}")
        return 0
    except WfcError as exc:
        print(str(exc))
        return exc.code


if __name__ == "__main__":
    raise SystemExit(main())

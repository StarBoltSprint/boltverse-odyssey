# 68 — WFC path placement (load time, any biome)

Kitchen only. Not a hang. Not a play scene. Number **68** because [64](64-imagine-build-limits.md) is already the Imagine build limits page.

This page is the corridor tile solve between two zone gates. The zone file stays [`tools/layout`](../../tools/layout/README.md) ([doc 63](63-layout-file-and-validator.md)). The world graph stays doc 62: a zone, a straight corridor, a zone. The tool is [`tools/wfc-path`](../../tools/wfc-path/README.md).

Wave Function Collapse here means **placement**. A cell stores a tile id. The id's `asset` string names an Imagine file that was already cooked. The solve writes positions, tile indices, waypoints, and corridor records. It does not shade, composite, or invent a mesh.

Simplex, in [`GROK.md`](../../GROK.md), places already-cooked assets and does not draw. WFC is the same kind of placement, used once, when the corridor between two gates is laid out. Drawing stays Imagine.

## When it runs

`when` is `load`. The solve happens in the kitchen, before play, and the bytes are stored. The same seed writes the same `path-layout.json`.

A spec with any other `when` fails: `FAIL mid-run WFC`. That includes a solve that would rebuild the path while Bolt is running. [`COLD_START-biome-method.md`](COLD_START-biome-method.md) still bans WFC for the next forest chunk during play. This tool does not place herbe, arbres, or a new chunk. It places the corridor that doc 62 already defined: one straight run from a gate to a gate.

## Placement streaming

SmiR, 2026-10-06. The world awakens as Bolt runs. This is not a second `when` for `wfc.py`. The corridor tile solve stays `load`. What changed is placement of solids that were already cooked.

During the run, code may stream those solids ahead of Bolt. The pool is fixed. A slot that falls far behind is recycled onto a later seat. The same seed and the same speed history write the same seats. A faster pace may fill more of the pool. A new seat starts beyond a near radius and eases into place (rise, scale). It does not pop in against the camera.

Still forbidden: drawing or generating a pixel or a mesh in code, a flat card or a billboard, and rebuilding this path layout while Bolt runs. Far objects stay real 3D (a cheaper LOD solid when one already exists). Sky is the only backdrop. Phone caps in law 65 still bind the live pool, the draws, and the textures.

## Inputs

One JSON spec, schema `wfc-path/1`.

| Field | Meaning |
| --- | --- |
| `seed` | Integer. Same seed, same output bytes. |
| `when` | `load`. Omitted means `load`. |
| `grid.cols`, `grid.rows` | Cell counts. Cap 4096 cells. |
| `grid.tile_m` | Metres per cell. The fixture uses `0.9`, the same ground step as doc 63. |
| `tiles[]` | `id`, `role` (`fill`, `path`, or `gate`), `asset` (non-empty path string), `sockets` (`n`, `e`, `s`, `w`), optional `weight` and one-character `mark`. |
| `gates[]` | `id`, `cell` `[col, row]`, `tile`, `zone`, `gate`. The tile's role is `gate`. |
| `links[]` | `id`, `from`, `to` (gate ids), `ground` (non-empty path string), `bakedGroundSpeed` (number above 0). |
| `pins[]` | Optional. `{ "cell", "tile" }` fixes a cell before the collapse. |
| `allow_bends` | Optional. Omitted means false. |

Socket `n` is the neighbor at row − 1. Socket `s` is row + 1. Socket `e` is col + 1. Socket `w` is col − 1. Two neighbors agree when the facing sockets are the same string. World position of a cell is `x = (col + 0.5) * tile_m`, `z = (row + 0.5) * tile_m`.

Fill tiles share one socket pattern. Those labels are closed sides. A path step is a matching socket whose label is not a fill label, and neither cell is fill. Gate tiles are legal only on `gates` (or on a pin).

Collapse order is the lowest entropy, then the lowest row, then the lowest column. Inside one cell, a fill tile is taken while any fill tile still fits. The seed chooses among tiles of that same role. A path tile is placed when the sockets have removed the fills. That keeps an optional path tile from spawning a second corridor beside the link.

## Outputs

`python3 tools/wfc-path/wfc.py generate --spec <spec.json> --out <dir>` writes:

| File | What it is |
| --- | --- |
| `path-layout.json` | Schema `wfc-path/1`. Grid, corridors, `world_corridors`. `draws_pixels` is false. `when` is `load`. |
| `diagram.txt` | ASCII marks. Kitchen diagram. |
| `diagram.svg` | The same marks as stroked cells and text. Kitchen diagram. |

`path-layout.json` corridors carry `waypoints` (`[x, z]` at cell centres), `length_m`, `straight`, and `segments`. Each segment is one axis (`x` or `z`) and lists the cell tile ids and asset strings.

`world_corridors` keeps the keys [`tools/layout`](../../tools/layout/README.md) already checks on `world.json`:

```json
{
  "world_corridors": [
    {
      "id": "path-ab",
      "from": { "zone": "zone-a", "gate": "out" },
      "to": { "zone": "zone-b", "gate": "in" },
      "ground": "testdata/assets/corridor-ground",
      "bakedGroundSpeed": 4,
      "length_m": 5.4
    }
  ]
}
```

Copy that list into `world.json` `corridors` when the cook is ready to hang the link. Leave waypoints and the grid in `path-layout.json`. On the zone file, `gates[].leads_to` is this corridor id, or it is omitted. A different `leads_to` fails the layout `transition` row.

A link with more than one straight run is omitted from `world_corridors`. Doc 62 corridors are one straight direction. Set `allow_bends` only to inspect the segment list in the kitchen. Those segments are not a play corridor until each run has its own gate pair.

The fixture `tools/wfc-path/testdata/spec.json` is synthetic. Its asset strings are not Imagine files. The solved row is `> = = = = = <`, length **5.4** m, one world corridor `path-ab`. `testdata/contradiction.json` is the adjacent-gate fail.

## KEEP / FAIL

| | Rule |
| --- | --- |
| KEEP | `when` is `load`. Same seed, same `path-layout.json` bytes. Every neighbor pair shares socket labels. Every tile `asset` and every link `ground` is a non-empty path string. Each `world_corridors` record is one straight run between two gates. `draws_pixels` is false. |
| FAIL | `when` is anything else (mid-run rewrite). |
| FAIL | A tile `asset` or a link `ground` is empty. The string is not opened here; an empty string still fails. |
| FAIL | A cell's domain goes empty (`FAIL contradiction at col,row`). No layout file is written. |
| FAIL | The two gates are not joined by path sockets (`FAIL disconnected`). |
| FAIL | The joined cells bend and `allow_bends` is false (`FAIL bend`). |
| FAIL | A path tile sits off every link (`FAIL stray path`). |
| FAIL | Code draws, shades, or builds a mesh for the corridor. A PathGenerator that paints is the GROK.md fail. The SVG and the ASCII file are kitchen diagrams of the indices. |

## What this does not do

Zone interiors, footprints, and colliders stay in `clearing.json` via `tools/layout`. The handoff movie, the preload, and the crossfade stay in [`biome/scripts/zone-flow`](../../biome/scripts/zone-flow/README.md) and the synthetic [`tools/zoneflow`](../../tools/zoneflow/README.md) fixture. This tool does not edit that fixture.

The cook hang is [`tools/wfc-path/hang.py`](../../tools/wfc-path/hang.py). It copies `world_corridors` into `world.json` `corridors` and writes gate stubs whose `leads_to` is the corridor id. The checked-in hang is [`packs/corridor-ab`](../../packs/corridor-ab/README.md). It places zone A ground stills that were already cooked. The play page streams the existing arch, Eclipse Gate, and wreck lofts, plus the boulder and stone hulls, from a seed while Bolt runs. That stream is the placement rule above. It does not cook a corridor video, a zone B pack, or a second gate mesh. It does not solve WFC again. The synthetic fixture in `testdata/` stays synthetic. This command does not edit [`tools/zoneflow/fixture`](../../tools/zoneflow/fixture/world.json). It does not change a collider. Phone caps in law 65 are unchanged for the solve itself: `wfc.py` adds no draw call. The play page is a separate walk.

`layout.py check --world` still checks `bakedGroundSpeed`, `length_m`, the ground file on disk, and the gates named in each `clearing.json`. Point `ground` at the real Imagine file before that check. This command only checks that the string is non-empty.

## Command

```bash
python3 tools/wfc-path/wfc.py generate \
  --spec tools/wfc-path/testdata/spec.json \
  --out /tmp/wfc

python3 tools/wfc-path/selftest.py
```

Exit **0** writes the layout. Exit **1** is a rule fail. Exit **2** means the spec cannot be read. A layout PASS is not a play URL.

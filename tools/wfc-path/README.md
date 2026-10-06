# tools/wfc-path

Places the corridor between two zone gates. Load time only. Python 3.10+. Standard library only.

The solve stores tile ids, waypoints, and straight segment records. Each id is a path string to an Imagine asset that is already cooked. This command does not open those files, draw a texel, or build a mesh.

Law: [`biome/docs/68-wfc-path-placement.md`](../../biome/docs/68-wfc-path-placement.md).

## Zones, then the corridor

[`tools/layout`](../layout/README.md) writes one `clearing.json` per zone (doc 63): footprint, gates, interiors, colliders. A gate's `leads_to` names the corridor.

Doc 62 is the graph: zone, straight corridor, zone. [`tools/layout`](../layout/transition.py) `transition` (only with `--world`) checks that graph on `world.json`: `bakedGroundSpeed` above 0, `length_m` above 0, the ground file present, and the from / to gates present in the clearings.

This tool fills the straight run between those gates. It writes a sibling `path-layout.json`. It does not write `clearing.json`, and it does not edit [`tools/zoneflow/fixture`](../zoneflow/fixture/world.json).

| | `tools/layout` | `tools/wfc-path` |
| --- | --- | --- |
| Unit | One zone | One corridor between two gates |
| File | `clearing.json` | `path-layout.json` |
| Shape | Footprint, gates, objects | Grid, waypoints, straight segments |
| Pixels | Names Imagine assets | Names Imagine assets already cooked |

## Command

From the repo root:

```bash
python3 tools/wfc-path/wfc.py generate \
  --spec tools/wfc-path/testdata/spec.json \
  --out /tmp/wfc

python3 tools/wfc-path/selftest.py
```

Exit **0** prints `PASS` and writes `path-layout.json`, `diagram.txt`, and `diagram.svg`. Exit **1** is a rule failure (contradiction, empty asset, mid-run, disconnected gates, a bend). Exit **2** means the spec cannot be read. A failure does not write the layout.

The diagram is a kitchen picture of the marks. It is not a play view and not an Imagine still.

## Spec

Schema `wfc-path/1`. Worked file: `testdata/spec.json` (synthetic ids, no binary art). `testdata/contradiction.json` is the adjacent-gate fail.

- `seed` — same seed, same output bytes.
- `when` — `load`. Any other value fails. Omitted means `load`.
- `grid` — `cols`, `rows`, `tile_m`.
- `tiles` — `id`, `role` (`fill` / `path` / `gate`), `asset`, `sockets` (`n` `e` `s` `w`). Optional `weight` (default 1) and `mark`.
- `gates` — `id`, `cell` `[col, row]`, `tile`, `zone`, `gate`.
- `links` — `id`, `from`, `to` (those gate ids), `ground`, `bakedGroundSpeed`.
- `pins` — optional fixed cells.
- `allow_bends` — default false. A bend is refused unless this is true, and a bent link is left out of `world_corridors`.

Socket `n` faces row − 1, `s` faces row + 1, `e` faces col + 1, `w` faces col − 1. Neighbors match when those strings are equal. Fill tiles share one socket pattern. The seed picks among tiles of the same role; a fill is kept while a fill still fits, so a spare path tile does not open a second corridor.

Cell centre in metres: `x = (col + 0.5) * tile_m`, `z = (row + 0.5) * tile_m`.

## world.json

`world_corridors` uses the keys the transition row already reads:

`id`, `from.zone`, `from.gate`, `to.zone`, `to.gate`, `ground`, `bakedGroundSpeed`, `length_m`.

Copy those objects into `world.json` `corridors` when the cook hangs the link. Keep waypoints in `path-layout.json`. Set the zone gate's `leads_to` to the corridor id, or leave `leads_to` unset. This command checks that `ground` is a non-empty string. `layout.py check --world` is the check that the file exists.

The fixture's straight solve is one record, `path-ab`, length 5.4 m, from `zone-a` / `out` to `zone-b` / `in`.

## Hang

`wfc.py` does not open the asset files. The hang does, and it refuses a missing file.

```bash
python3 tools/wfc-path/hang.py \
  --spec tools/wfc-path/cook/spec.json \
  --out packs/corridor-ab

python3 tools/wfc-path/hang_selftest.py
```

That spec points at zone A ground stills already in the repo. `hang.py` copies `world_corridors` into `world.json` `corridors`, writes one clearing stub per gate, and sets the from-gate `leads_to` to the corridor id. Waypoints stay in `path-layout.json`. The play page is `packs/corridor-ab/play/`. Serve the repo root and open `/packs/corridor-ab/play/`. Hold the screen to walk.

## Honest limits

- `wfc.py` still treats asset paths as strings. A missing file passes that command and fails `hang.py`.
- No corridor video is cooked. The hung floor is the zone A ground stills, one file per solved cell. `bakedGroundSpeed` is stored for zone-flow and is not applied to a still.
- Zone B has no pack. The arrival plate reuses a zone A ground still until Ember Mesa exists.
- The Eclipse Gate loft stays in `packs/zone-a`. This strip does not build a gate mesh.
- The clearing stubs are the handoff only. `layout.py check --world` is claimed for the `transition` row. The other zone rows are not a layout PASS.
- `allow_bends` is a kitchen segment list. Doc 62 play corridors stay one straight run.
- Determinism uses CPython `random.Random`. Two runs of one seed match on that interpreter.

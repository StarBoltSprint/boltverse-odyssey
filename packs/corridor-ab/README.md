# Corridor A → B

Bolt walks a load-time WFC corridor from the zone A gate to the zone B gate. The solve is placement only. Every floor texel is a zone A ground still that was already cooked. Nothing in this folder is a new Imagine file.

```bash
python3 tools/wfc-path/hang.py \
  --spec tools/wfc-path/cook/spec.json \
  --out packs/corridor-ab

python3 tools/wfc-path/hang_selftest.py
node --test packs/corridor-ab/play/place.test.mjs
```

Serve the repo root, then open the play page:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

`http://127.0.0.1:8765/packs/corridor-ab/play/`

Hold the screen to walk. Release to stop. Bolt uses `lock/bolt-gallop-cycle.mp4` while moving and `lock/bolt-idle-breath.mp4` when stopped. `?debug=1` shows the handoff line. `?shot=mid` stands on the corridor. The framebuffer from that stand is `proof/walk-mid.png` (zone A stills and the idle lock, not a new painting).

## What is hung

| File | Role |
| --- | --- |
| `path-layout.json` | Grid, waypoints, segments. `when` is `load`. `draws_pixels` is false. |
| `world.json` | `corridors` copied from `world_corridors`. Same keys `tools/layout` already checks. |
| `clearing-zone-a.json` | Handoff stub. Gate `out` `leads_to` is `path-ab`. |
| `clearing-zone-b.json` | Handoff stub for the arrival gate. |
| `play/` | Places each solved cell's Imagine file on that cell and walks Bolt with zone-flow. |

`diagram.txt` and `diagram.svg` are the kitchen index picture. They are not the play view.

The ground file on the corridor record is `packs/zone-a/src/ground/m1.png`. Cell assets are `m0`–`m5`. The zone plates are `m0` and `m6`. The sky slice is `packs/zone-a/src/sky/sky-0.jpg`. Tile step is 1.45 m, the step already declared on the zone A ground.

## What Bolt can do

From the zone A stub, walk to the gate. Zone-flow preloads the corridor and crossfades. On the corridor, Bolt follows the waypoints. At the far gate the handoff opens the zone B stub.

## What still waits

- A scrolling corridor ground video, empty of Bolt, with `bakedGroundSpeed` measured from that clip. The number `4` is stored so the transition row has a speed. It is not applied to a still.
- A zone B pack (Ember Mesa). The arrival plate reuses `m6.png` from zone A. It is not Ember Mesa.
- The Eclipse Gate loft. It stays in `packs/zone-a` and is not rebuilt on this strip.
- The relief clearing `packs/zone-a/clearing.json` has no `gates[]` entry. These stubs are the handoff, not a rewrite of that pack.

`layout.py check --world` is the transition row only. The stubs are not an organic zone PASS.

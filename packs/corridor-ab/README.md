# Corridor A → B

Bolt walks one straight load-time WFC corridor from the zone A gate to the zone B gate. The run is 79.75 m. The solve is placement only. Nothing in this folder is a new Imagine file.

```bash
python3 tools/wfc-path/hang.py \
  --spec tools/wfc-path/cook/spec.json \
  --out packs/corridor-ab

python3 tools/wfc-path/hang_selftest.py
node --test packs/corridor-ab/play/*.test.mjs
```

Serve the repo root, then open the play page:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

`http://127.0.0.1:8765/packs/corridor-ab/play/`

The stick is on the left, the same control as zone A. Stick right turns right. Stick left turns left. A swipe up on the rest of the screen looks up, then the tilt eases back to level. Holding the stick forward walks. Pushing it hard sprints: speed climbs while the hold lasts and eases back on release. `?debug=1` shows the perf line. `?shot=walk` and `?shot=sprint` stand on the run at that pace. `?shot=film` sprints forward so solids can rise ahead. `?seed=` changes the stream.

The paw menu has one extra row, **Nouvelle aventure**. It writes an adventure card for a new seed and plays it on this corridor (intro text, then the seeded stream, Echo Shard pickups, the goal timer, ending text). The end card offers **Continuer** (the next hook) or **Retour à la Citadelle** (back to the spawn). `?adventure=1&seed=` opens that card directly. Seed **1024** is the lost xAI ship: the wreck stands in for the hull. `?shot=intro`, `?shot=mid`, and `?shot=adventure` are the proof shots. Walk and sprint shots do not mount the paw. The card contract is [`biome/docs/69-adventure-generator.md`](../../biome/docs/69-adventure-generator.md). The Codex, the segment catalogue, is [`tools/adventure/library.json`](../../tools/adventure/library.json). A passed run stores its truth, a Star Core revelation, in the shared Archives progress.

## What is procedural now

The floor solve is decided once, when the page loads. The props stream while Bolt runs.

| Piece | How |
| --- | --- |
| Floor tiles | The WFC solve in `path-layout.json` still decides the link at load (`when` is `load`, `draws_pixels` is false). One quad paints `packs/zone-a/src/ground/m3.png` at its native 1024². The sampler repeats it. Four windows of that same still crossfade so a rim cannot line up into a square. |
| Where Bolt may walk | Zone-flow, on the straight link, when he stays near it. Yaw is free. Nothing clamps him with an invisible wall. Contact uses the loft faces and each live rock's hull footprint. |
| Speed | Walk, then a climb toward the sprint cap while the stick stays hard forward. Release eases the speed back. |
| Arch, Eclipse Gate, wreck | The zone A lofts. One of each is seated ahead of Bolt from the seed and recycled when it falls behind. The arch opening stays walkable. |
| Boulder and stone hulls | A seeded pool. Slots appear ahead, rise into place, and recycle behind. A faster pace fills more of the pool. The same seed and the same speed history rebuild the same slots. |

The sky is zone A's closed dome: horizon, upper, and high slices, the zenith cap, and the stars, dust, and nebula loops. It follows the eye, so a turn or a tilt stays inside the sky. Sky is the only backdrop.

Zone A's shard and ground-detail cuts are crossed cards. This page does not hang those cards. The small solids are the boulder and stone hulls.

## What still needs Imagine corridor tiles

- A scrolling corridor ground video, empty of Bolt, with `bakedGroundSpeed` measured from that clip. The floor is still the zone A ground stills (`m0`–`m5`), repeated on the 1.45 m step.
- A zone B pack (Ember Mesa). The arrival plate reuses `m6.png` from zone A.
- No second gate mesh was built. The Eclipse Gate on this run is the loft already in `packs/zone-a`.

`layout.py check --world` is the transition row only. The stubs are not an organic zone PASS.

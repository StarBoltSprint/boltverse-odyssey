# Jade sheet prompts

Law [47](../../docs/47-jade-sheet-cook.md). One subject on empty air. No binaries in this folder.

Every still is a noun line, then this suffix, verbatim.

```
single isolated subject, full-body cutout, transparent background,
no other trees, no path, no road, no sky plate, no horizon, no dog,
no wolf, no German Shepherd, no creature, no text, no UI,
rear three-quarter, camera height 0.6 meters, locked late-day light,
warm gold rim from upper left, cool cyan fill, Jade Canopy moss world,
crystal-never-chrome, still photo, sharp silhouette
```

## Noun lines

Bole (512×1024, trunk only, roots at the bottom edge):

- v0 — straight young bole, tight oval trunk, moss collar, no canopy
- v1 — bole leaning left, wide flat trunk, moss collar, no canopy
- v2 — split fork bole, two trunk lobes, moss collar, no canopy
- v3 — thick scarred bole, ragged bark, moss collar, no canopy

Crown (1024×1024, canopy only, lens at mid-canopy, same yaw, not top-down, alpha holes are sky holes):

- v0 — tight oval canopy, leaves only, no trunk
- v1 — wide flat canopy, leaves only, no trunk
- v2 — two-lobe canopy, leaves only, no trunk
- v3 — ragged canopy, leaves only, no trunk

Ruin (1024×1024, two pillars and a lintel, the gap is alpha):

- v0 — two slim pillars, tight gap, stone lintel
- v1 — ruin leaning left, wide lintel
- v2 — ruin with two openings
- v3 — thick scarred stones, ragged lintel

Crystal (512×1024, one shard, point up):

- v0 — one straight crystal shard, point up
- v1 — crystal shard leaning left, point up
- v2 — two crystal shards, points up
- v3 — thick scarred crystal shard, point up

Fern (768×512, low clump, contact at the bottom):

- v0 — tight oval fern clump
- v1 — wide flat fern clump, lean left
- v2 — fern clump in two lobes
- v3 — ragged fern clump

Impostor (128×128, still, never a video):

- readable silhouette only, no interior detail

`crown_imp` is optional. The far tree ghost is `bole_imp_vN.png`.

## Crown loop

Boles do not loop. A crown loop is `crown_vN.mp4`, 2–3 s. Keep the suffix. Add, after it:

```
2–3 second loop, first frame matches last frame, wind in the leaves only, camera locked, no truck
```

If the loop ticks, freeze frame 0.

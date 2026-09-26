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

FX (256×256, one speck, alpha around it, same suffix, no Bolt). Law [53](../../docs/53-gpu-particles.md) samples these. Names only:

- `fx/moss_dust_v0.png` — one fleck of moss dust
- `fx/pollen_v0.png` — one pollen grain, alternate mote
- `fx/ember_v0.png` — one ember spark
- `fx/spark_dust_v0.png` — one shard of crystal dust, quartz, never chrome

The Howl shatter's primary picture is the burst film (law 52). Names only. This PR does not cook the files. Point sparks do not replace a missing shard.

```
public/decor/jade/fx/crystal_burst_v0.mp4 … v3.mp4
public/decor/jade/fx/crystal_burst_v0.png
```

The png is frame 0, the still crystal. One file per crystal variant.

| | |
|---|---|
| Dur | 0.9–1.1 s |
| Res | 512×1024, same frame as `crystal_vN.png` |
| Alpha | native, or a chroma lock with cyan despill |
| Cam | same rear-three-quarter, withers, late-day light lock |
| Frame 0 | the same shard as `crystal_vN.png` |
| Last | empty dust, no second shard |
| Cam clip | locked. No truck, no yaw |
| Bolt | forbidden |

Prompt, after the shared suffix:

```
isolated shard cracking into cyan-gold dust, transparent background,
no grove, no dog, one shot, not a loop
```

QC: overlay frame 0 on `crystal_vN.png`. A jump is a recook. Card to burst is a 1-frame cross, not a morph. No loop. End hides the quad. Until the mp4 exists, the GPU points are the break. When it exists, the film carries the form and the points are the halo. Picture-time advances the quad with sim dt. Pause freezes it. The wall clock does not.

## Crown loop

Boles do not loop. A crown loop is `crown_vN.mp4`, 2–3 s. Keep the suffix. Add, after it:

```
2–3 second loop, first frame matches last frame, wind in the leaves only, camera locked, no truck
```

If the loop ticks, freeze frame 0.

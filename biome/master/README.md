# master — hung B-stack (road + cutout)

This folder is the Sprint **`/master` stack** the LanePlayer wires.

These **are** the r38 B-stack masters:

| file | role |
|---|---|
| `road.mp4` | empty road plate — **master clock** |
| `road-bar.mp4` | cousin — center jersey (1 lane, approaches, last = empty) |
| `road-blast.mp4` | cousin — center meteor (starts FAR, approaches, last = empty) |
| `bolt.mp4` | Bolt green-screen cutout / gallop |
| `road.jpg` | road still / first-frame poster |

Dealer: empty → bar → blast. Cook + Hang: [../docs/09-recette-biome.md](../docs/09-recette-biome.md).


Drop a later PASS encode here after [../GROK.md](../GROK.md). Encode: 720×1280, H264, `-an`, short GOP, `+faststart`.

If a later recook is needed: **do not invent them.** Cook with [../prompts/](../prompts/) + imagine-hooks `image` + `last_frame`, or play stock Sprint in-app.

The optional biome preview (archive — **not attached at boot**) is **not** this stack — it lives at [`stock/biome/`](../../stock/biome/README.md). Boot teaser = [`stock/citadel/`](../../stock/citadel/README.md).

Do not Hang a dual-dog road. Do not Hang a sitting cutout.

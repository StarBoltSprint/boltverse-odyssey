# master — hung B-stack (road + cutout)

This folder is the Sprint **`/master` stack** the LanePlayer wires.

| file | role |
|---|---|
| `road.mp4` | empty-plate travel — **master clock** (`?v=r19wide` on Live) |
| `bolt.mp4` | Bolt luma cutout / gallop (`?v=r19wide`) |
| `road.jpg` | first-frame poster (Live). `road-first.jpg` is the same job if you cook a new plate. |

Drop PASS encodes here after [../GROK.md](../GROK.md). Encode: 720×1280, H264, `-an`, short GOP, `+faststart`.

## Binaries

If these files are missing from git (LFS / not cooked yet): **do not invent them.** Cook with [../prompts/](../prompts/) + imagine-hooks `image` + `last_frame`, or play stock Sprint in-app.

The optional biome preview (archive — **not attached at boot**) is **not** this stack — it lives at [`stock/biome/`](../../stock/biome/README.md). Boot teaser = [`stock/citadel/`](../../stock/citadel/README.md).

Do not Hang a dual-dog road. Do not Hang a sitting cutout.

# master — hung B-stack (road + cutout)

These **are** the r38 KEEP stack served at `/master/` on Play.
LanePlayer `VER = r38` (`/master/road.mp4?v=r38` + `/master/bolt.mp4?v=r38`).

Do **not** substitute [`stock/biome/`](../../stock/biome/README.md) teasers for this stack. Console teasers stay chat / Play preview media only.

| file | role |
|---|---|
| `road.mp4` | empty-plate dusk treadmill — **master clock** (`?v=r38`) |
| `bolt.mp4` | green-screen Bolt gallop, same trim (`?v=r38`) |
| `road.jpg` | first-frame poster |

Binaries live in this folder (`biome/master/`). Drop a later PASS encode here after [../GROK.md](../GROK.md). Encode: 720×1280, H264, `-an`, short GOP, `+faststart`.

If these files are missing from git (LFS / not cooked yet): **do not invent them.** Cook with [../prompts/](../prompts/) + imagine-hooks `image` + `last_frame`, or play stock Sprint in-app.

Do not Hang a dual-dog road. Do not Hang a sitting cutout.

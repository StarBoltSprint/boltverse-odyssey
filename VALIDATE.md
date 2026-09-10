# VALIDATE — box check (not Smoke)

After cooking a pack, **before** push and **before** giving the player URL:

```
python3 scripts/validate-pack.py packs/<id>
node scripts/validate-pack.mjs packs/<id>
node scripts/smoke-pack.mjs packs/<id>
```

Exit `0` = PACK PASS. Exit `1` = do not hang. Recook. Do not give `/r/<id>`.

This is the **box**. It does not look at Bolt, clones, or first/last frames. That is [SMOKE.md](SMOKE.md).

## What it requires

| Check | Why |
|---|---|
| `room.json` parses | not a pack |
| 3 stills: `spawn.jpg` `at-a.jpg` `at-b.jpg` | graph |
| 5 films: breath-spawn, breath-A, breath-B, walk-spawn-A, walk-spawn-B | minimum playable |
| Each mp4: H264, `yuv420p`, **no audio**, 720x1280 | autoplay / plate |

Needs `ffprobe` or `ffmpeg`. Walk-A-B, walk-B-A, enter clips are optional here.

FAIL = Grok recooks that file (cap 2, see SMOKE.md). Never push a FAIL pack. The player will ignore a dead still and fall back to the golden hall — do not rely on that.

The pack contract: [PACK.md](PACK.md). This script is the box. Smoke is the eye, before write.

Also the graph (still not Smoke):

- `camera` lock-off
- edges `spawn+A` and `spawn+B`
- A↔B / ENTER: if `required: true`, the file and `to` must be there; else ignore

Still no pHash, no face. Box only.

`validate-pack.py` = folder only (no ffprobe). `.mjs` = same + H264/mute if ffprobe is there.

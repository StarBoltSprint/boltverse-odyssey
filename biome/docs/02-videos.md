# 02 — videos (films)

**STOP — HARD SPLIT.** NEVER Imagine Agent / chat Imagine for these clips.

Walks / travel / gallop / **cousin plates** = `scripts/imagine-hooks.mjs`:

- Hall: `imagineClip` — `image` + **`last_frame`**
- Biome road: `imagineBiomeClip` — `image` + **`last_frame`** (distinct, ZERO dog)

Chat `imagine_image_to_video` / `imagine_reference_to_video` have **no** `last_frame` — banned.

## Road (empty plate)

**10 s.** Lock-off. Travel **baked** — world rushes HARD the whole clip. Speed **ULTRA CONSTANT** first→last: NEVER slow down, NEVER accelerate, NEVER ease-in/out. `playbackRate` later is ~1.0–1.2 only. (SPEED REF in [../GROK.md](../GROK.md)).

First still ≠ last still. World advanced: what he passed is gone.

**ZERO** Bolt in the mp4. Dual dogs = FAIL.

Paste: [../prompts/video-empty-plate.txt](../prompts/video-empty-plate.txt).

Chain: extract last frame → that file **is** `image` of the next road.

```
ffmpeg -y -sseof -0.12 -i road-N.mp4 -frames:v 1 \
  -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" \
  road-N-last.jpg
```

Or `extractLastFrame(src, dest)` from the hook.

## Cousin plate (bar / arch / puddle)

Same camera, same crop. Hazard **baked in** the pixels (wet contact), not a sticker.

**THREE lanes. Hazard = 1 or 2 lanes. NEVER all three.** Always one free dodge corridor. Full-width steel bar = FAIL (cannot dodge).

Paste: [../prompts/video-hazard-plate.txt](../prompts/video-hazard-plate.txt).

| | first | last |
|---|---|---|
| empty → cousin | last(empty) or lock+hazard | — |
| cousin → empty | — | **first(empty)** |

`imagineBiomeClip({ kind: "hazard", first, last, dest, seconds: 10 })`.

Then match travel to the empty plate: [08-plate-speed.md](08-plate-speed.md).

## Bolt cutout (gallop)

Imagine **gallop video loop**. Soft black / alpha. Preserve fine paw dust — do not hard-key wipe low-alpha. No code/CSS fake splash.

He **GALLOPS** the whole clip. NEVER sits. NEVER howls. NEVER a second dog. NEVER profile / face.

Plant in play: lower third, paws on `groundY`. [../PLAY.md](../PLAY.md) seek-sync.

Paste: [../prompts/video-bolt-mid.txt](../prompts/video-bolt-mid.txt).

## Encode

See [../GROK.md](../GROK.md). H264, `yuv420p`, `-an`, `+faststart`, short GOP (`-g 15`) so seek-sync lands.

## Hang

PASS pair → [../master/](../master/README.md). FAIL crawl / sit / baked dog → do not Hang.

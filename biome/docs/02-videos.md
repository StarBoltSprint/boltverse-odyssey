# 02 — videos (films)

**STOP — HARD SPLIT.** NEVER Imagine Agent / chat Imagine for these clips.

Walks / travel / gallop / **cousin plates** = `scripts/imagine-hooks.mjs`:

- Hall: `imagineClip` — `image` + **`last_frame`**
- Biome road: `imagineBiomeClip` — `image` + **`last_frame`** (distinct, ZERO dog)

Chat `imagine_image_to_video` / `imagine_reference_to_video` have **no** `last_frame` — banned.

## Road (empty plate)

**Lock-off.** Travel **baked** — world rushes HARD the whole clip. Speed **ULTRA CONSTANT** t=0→last: NEVER slow down (not for a crash, impact, or obstacle), NEVER accelerate, NEVER ease-in/out. (SPEED REF in [../GROK.md](../GROK.md)).

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

## Cousin plate (bar / arch / meteor)

Same camera, same crop. Hazard **baked in** the pixels (wet contact), not a sticker.

**THREE lanes. Hazard = 1 or 2 lanes. NEVER all three.** Always one free dodge corridor. Full-width steel bar / crater = FAIL (cannot dodge).

**SPAWN LAW:** first frame the hazard is FAR AHEAD (small, vanishing point). It approaches and exits the BOTTOM. A first-frame close-up pops on the hero = FAIL.

**WIDTH LAW:** it may get closer (taller) but never wider than the lane(s) it started in. Never a wall, gantry, or shock-ring.

**OBJECT, not a verb.** Jersey / rock / crate = Imagine can hold 1 lane. “Explosion / crater / bloom” = Imagine fills all three — dress the still yourself (composite a 48–72 px speck onto `empty-last`) instead of an image-edit.

Paste: [../prompts/video-hazard-plate.txt](../prompts/video-hazard-plate.txt). Still: [../prompts/image-hazard-plate.txt](../prompts/image-hazard-plate.txt). Full cook: [09-recette-biome.md](09-recette-biome.md).

| | first | last |
|---|---|---|
| empty → cousin | last(empty) **+ hazard FAR and small** | — |
| cousin → empty | — | **first(empty)** |

`imagineBiomeClip({ kind: "hazard", first, last, dest, seconds: 10 })`.

Then match travel to the empty plate: [08-plate-speed.md](08-plate-speed.md). Explosions fool SAD → `--duration-match`, not `--match`.


## Bolt cutout (gallop)

**HARD law:** [10-bolt-cutout-law.md](10-bolt-cutout-law.md).

`imagineBoltClip` — `image` + `last_frame` = **the same still**. 6 s. **IN PLACE / treadmill.** Never hall `imagineClip`. Never chat Imagine. Word “rear” alone is not enough.

He **rotary-gallops** the whole clip (stretch then gather; hind legs fully back). NEVER stands, trots, pauses, sits, howls. NEVER a second dog. NEVER ¾ / profile / face / yaw / look-back. NEVER a road or set in the plate (I2V invents travelling → he turns).

Background stays **flat `#00FF00`**. Key later: [05-key.md](05-key.md). No JS reflection. No puddle shadow.

Plant in play: lower third, paws already glued; game plants on the bottom of the blob. [../PLAY.md](../PLAY.md).

Paste: [../prompts/video-bolt-mid.txt](../prompts/video-bolt-mid.txt). QC frames 0 / 2 / 4 / 5.8 — one yaw frame = throw.

## Encode

See [../GROK.md](../GROK.md). H264, `yuv420p`, `-an`, `+faststart`, short GOP (`-g 15`) so seek-sync lands.

## Hang

PASS pair → [../master/](../master/README.md). FAIL crawl / sit / baked dog → do not Hang.

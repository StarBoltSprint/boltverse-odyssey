# 02 — videos (films)

**STOP — HARD SPLIT.** NEVER Imagine Agent / chat Imagine for these clips.

Walks / travel / gallop / **cousin plates** = `scripts/imagine-hooks.mjs` with real **first + last**:

- Hall: `imagineClip` — `image` + **`last_frame`** (citadel only — **banned** for biome Bolt)
- Biome road / Video A: `imagineBiomeClip` — `image` + **`last_frame`** (distinct, ZERO dog, **48fps**)
- Bolt cutout: `imagineBoltClip` — `first` + `last` = **cycle bookends on green** (**48fps**, IN PLACE)

Chat `imagine_image_to_video` / `imagine_reference_to_video` have **no** `last_frame` — banned. If hooks / `XAI_API_KEY` unavailable → **REFUSE** / stock. Do **not** fall back to chat I2V.

**Make biome:** décor scrolls; Bolt sprints **IN PLACE**. Pipeline: [10-bolt-cutout-law.md](10-bolt-cutout-law.md). Never bake Bolt into a single final film. Never a 3-Bolt multi-lane mask.

## Road (empty plate)

**Lock-off.** Travel **baked** — world rushes HARD the whole clip. Speed **ULTRA CONSTANT** t=0→last: NEVER slow down (not for a crash, impact, or obstacle), NEVER accelerate, NEVER ease-in/out. (SPEED REF in [../GROK.md](../GROK.md)).

First still ≠ last still. World advanced: what he passed is gone.

**ZERO** Bolt in the mp4. Dual dogs = FAIL. **48fps**. This is **Video A**.

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


## Video B — gait source (kitchen, not Hung)

SAME décor rush as Video A + Bolt mid-lane **IN PLACE**, natural rotary gallop, `@ref` [`lock/bolt-back.jpg`](../../lock/bolt-back.jpg) **or** [`biome/lock/bolt-back.jpg`](../lock/bolt-back.jpg) (same bytes; attach in chat first). Camera locked. **48fps**.

Green-only I2V invents a walk — B exists so gait is natural. Extract **one** cycle (start, 2–3 mids chronological, end ≈ start). Repose onto `#00FF00`. **Do not Hang B.** API / Build hooks with real `image` + distinct `last_frame`. Not hall `imagineClip`. Not `imagineBiomeClip` (ZERO dog). Not chat Imagine.

## Bolt cutout (gallop)

**HARD law:** [10-bolt-cutout-law.md](10-bolt-cutout-law.md).

`imagineBoltClip` — `first` + `last` = [`lock/bolt-gallop-cycle-first.jpg`](../../lock/bolt-gallop-cycle-first.jpg) (**same file**). Attach motion teacher [`lock/bolt-gallop-cycle.mp4`](../../lock/bolt-gallop-cycle.mp4) first. Loop seam = **hard cut** — do **not** optical-flow morph last→first. Optional mid frames as Imagine `@ref` chronological. 6 s. **48fps.** **IN PLACE / treadmill.** Never hall `imagineClip`. **BAN** inventing a new gallop from chat Imagine without this teacher. Word “rear” alone is not enough.

He **rotary-gallops** the whole clip (stretch then gather; hind legs fully back). NEVER stands, trots, pauses, sits, howls. NEVER a second dog. NEVER ¾ / profile / face / yaw / look-back. NEVER a road or set in the **green** plate (I2V invents travelling → he turns).

Background stays **flat `#00FF00`**. Key later onto Video A: [05-key.md](05-key.md). Match rates (no skate). L/M/R = code X shift of **one** Bolt layer. No JS reflection. No puddle shadow. Never a 3-Bolt mask. Never one baked final film.

Plant in play: lower third, paws already glued; game plants on the bottom of the blob. [../PLAY.md](../PLAY.md).

Paste: [../prompts/video-bolt-mid.txt](../prompts/video-bolt-mid.txt). QC frames 0 / 2 / 4 / 5.8 — one yaw frame = throw.

## Encode

See [../GROK.md](../GROK.md). H264, `yuv420p`, `-an`, `+faststart`, short GOP (`-g 15`) so seek-sync lands.

## Hang

PASS pair → [../master/](../master/README.md) as an **ADD**. FAIL crawl / sit / baked dog → do not Hang. **HARD LOCK — Hang ≠ wipe:** never `rm` hung `road.mp4` / war / night to land a new biome. Law: [09-recette-biome.md](09-recette-biome.md).

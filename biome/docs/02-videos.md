# 02 — videos (films)

**STOP — HARD SPLIT.** NEVER Imagine Agent / chat Imagine for these clips.

Walks / travel / gallop / **cousin plates** = `scripts/imagine-hooks.mjs` with real **first + last**:

- Hall: `imagineClip` — `image` + **`last_frame`** (citadel only — **banned** for biome Bolt)
- Biome road / Video A: `imagineBiomeClip` — `image` + **`last_frame`** (distinct, ZERO dog, **48fps**)
- Bolt cutout: **REUSE** [`lock/bolt-gallop-cycle.mp4`](../../lock/bolt-gallop-cycle.mp4) — key + despill + composite. `imagineBoltClip` = **SmiR only** (replace the lock)

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


## Video B — gait source (**SmiR only** — not a new-biome job)

Video B / extract / `imagineBoltClip` is **not** the new-biome path. A fresh Grok **REUSES** [`lock/bolt-gallop-cycle.mp4`](../../lock/bolt-gallop-cycle.mp4). **FAIL** if Grok invents a new Bolt sprint clip. Only SmiR can authorize a new cycle cook to replace the lock.

## Bolt cutout (gallop)

**HARD law:** [10-bolt-cutout-law.md](10-bolt-cutout-law.md).

**PRIORITY 0 — REUSE, not invent.** Take sealed [`lock/bolt-gallop-cycle.mp4`](../../lock/bolt-gallop-cycle.mp4) as the Bolt motion asset. Key + despill + composite onto Video A. **FAIL** if Grok invents a new Bolt sprint clip. Only SmiR can authorize `imagineBoltClip` / a new cycle cook to replace the lock. Loop seam = **hard cut** — do **not** optical-flow morph last→first. Never hall `imagineClip`. Word “rear” alone is not enough.

He **rotary-gallops** the whole clip (stretch then gather; hind legs fully back). NEVER stands, trots, pauses, sits, howls. NEVER a second dog. NEVER ¾ / profile / face / yaw / look-back. NEVER a road or set in the **green** plate (I2V invents travelling → he turns).

That **howls** is the green cutout only: the dog in the gallop cycle does not stop and vocalize. It is not a ban on the Sprint attack plate. Split below.

Background stays **flat `#00FF00`**. Key later onto Video A: [05-key.md](05-key.md). Match rates (no skate). L/M/R = code X shift of **one** Bolt layer. No JS reflection. No puddle shadow. Never a 3-Bolt mask. Never one baked final film.

Plant in play: lower third, paws already glued; game plants on the bottom of the blob. [../PLAY.md](../PLAY.md).

Do **not** paste `video-bolt-mid.txt` to cook a new sprint. QC the **reused** sealed cycle — one yaw frame = the lock is bad (SmiR reseal only).

## Howl split (hall breath vs Sprint attack)

Two films share a word. They are not the same cook.

| | Hall breath | Sprint attack Howl |
|---|---|---|
| Where | Citadel hall | Lane biome |
| Picture | Dog standing, chest and belly rise, paws planted, tail sway | **No dog.** Vertical yellow/blue rings, white core, progressive left → right |
| Camera | Locked. Same still twice | Locked tripod. Only the rings move |
| Key | The hall plate | Pure `#000000`. No shatter in this file |
| Cook | `imagineClip` breath: `image` + `last_frame` = the **same** still ([FILMS.md](../../FILMS.md) `breath-spawn` / `breath-A` / `breath-B`) | **REUSE** [`fx/howl/howl-attack.mp4`](../fx/howl/howl-attack.mp4) (SmiR KEEP). Law [32](32-howl-gpu-targets.md) |

Hall breath is not an attack and not a ring stack. Sprint Howl is not a breath and not a pose on the green cycle. Do not cook the attack by making Bolt howl inside `lock/bolt-gallop-cycle.mp4`. Do not cook the breath as a black-key VFX plate.

## Encode

See [../GROK.md](../GROK.md). H264, `yuv420p`, `-an`, `+faststart`, short GOP (`-g 15`) so seek-sync lands.

## Hang

PASS pair → [../master/](../master/README.md) as an **ADD**. FAIL crawl / sit / baked dog → do not Hang. **HARD LOCK — Hang ≠ wipe:** never `rm` hung `road.mp4` / war / night to land a new biome. Law: [09-recette-biome.md](09-recette-biome.md).

# 10 — Bolt cutout LAW (HARD)

Kitchen SoT. English OK. Keep Pack terms. SmiR 2026-09-18.

This page is **the** Bolt still + gallop law for every biome. Road plates stay empty. Bolt is a **keyed layer**.  
Read with [09-recette-biome.md](09-recette-biome.md) · [05-key.md](05-key.md) · [01-images.md](01-images.md) · [02-videos.md](02-videos.md).

**Product method (make / add a biome):** décor scrolls (rush); Bolt sprints **IN PLACE** (treadmill). Mid-lane for the gait cook. **48fps** on cooked plates. Style teacher = [`lock/bolt-back.jpg`](../../lock/bolt-back.jpg) (`@ref`). Hang ≠ wipe.

**HARD — hooks first + last.** Road / empty rush = [`imagineBiomeClip`](../../scripts/imagine-hooks.mjs) (`image` + distinct `last_frame`). Bolt cutout = [`imagineBoltClip`](../../scripts/imagine-hooks.mjs) (`first` + `last` = cycle bookends on green). Chat Imagine UI alone = **banned**. Imagine Agent video without first+last = **banned**. Hall `imagineClip` = **banned** for this layer. If hooks / `XAI_API_KEY` unavailable → **REFUSE** / stock. Do **not** fall back to chat I2V.

**Word “rear” alone is not enough.** I2V ignores “never yaw” unless the still is already **100% strict rear** AND the clip is **IN PLACE / treadmill**. Green-only I2V from a single still invents a walk — that is why Video B exists.

---

## STYLE (SmiR eye — lock this first)

Identity teacher = [`lock/bolt-back.jpg`](../../lock/bolt-back.jpg). **This still IS Bolt** for biome videos.

Coat + silhouette + **strict rear**. Fluffy white GSD. Rim light. Not a different dog.

**@ref / Imagine reference** `lock/bolt-back.jpg` for **every** Bolt still / clip.

Black void on the teacher = **STYLE only**. Biome cooks still go to flat `#00FF00` + light bake from the empty plate. Do **not** copy the void into the keyed layer.

**NOT** photoreal VFX. **NOT** a real-dog photo.

Current FAIL example: clean key, but **¾ rear** → crab-walk. Throw. Recook the still. Do not I2V a ¾ plate.

Identity **base** stays a full-white German Shepherd (white coat forever). Décor-matching skin ON TOP of that white base is OK (ember / ice / dusk rim). Not a different dog.

---

## 1. Camera

Imagine **ORBITS** when the still is not 100% rear **OR** the clip “runs in a set”.

| Lock | Law |
|---|---|
| Angle | **Strict rear.** X only. Tail **center**. Back of ears. Never cheek / flank / ¾. |
| Camera | **Locked.** No pan. No orbit. No yaw. No chase. Not too far / not too close. Clear center corridor. |
| Motion vs cam | He moves **away from the camera** (stuck in his back). |
| Plant | **Mid-lane** for the gait cook. |
| Magic words | **IN PLACE / treadmill.** |

**Explicit bans:** three-quarter, side view, profile, turns, looks back, runs down the road.

If he “runs on a road”, Imagine invents travelling → he **turns**.

---

## 2. Identity

| Lock | Law |
|---|---|
| Coat | Full-white GSD. White coat forever. Skin ON TOP OK. |
| Teacher | [`lock/bolt-back.jpg`](../../lock/bolt-back.jpg) — coat / rear camera. Not hall scale. |
| Collar | **Teal fabric** collar from behind. Not chrome. Not a tube. |
| Ears | **Two pointed GSD ears EVERY frame.** |
| Count | **One** subject. **Never** a 3-Bolt multi-lane mask. |
| Size | Constant. |
| Plant | Paws in the **lower third**. |

---

## 3. Background

**Hung Bolt plate = flat `#00FF00` ONLY.**

**Ban on the keyed layer:** road, city, gold pipe, ring, puddle, floor, drawn shadow, halo.

Any **set** in the **green** still → I2V thinks “scene” → **orbits**.

Soft black / magenta / gradient / studio floor = FAIL for this cook. Recette “magenta/vert” is **void**. `#00FF00` only.

Video B (gait source) is the **one** kitchen exception: same décor rush as Video A, Bolt mid-lane IN PLACE. Video B is **not** Hung. Do **not** ship it as the player film.

---

## 4. Motion

| Lock | Law |
|---|---|
| Start still | **ALREADY in sprint.** One rear leg **extended**. |
| Never | Standing still (else walk / trot). Stand / trot / pause. |
| Gait | **Rotary gallop:** body stretches then gathers. Hind legs drive **fully back**. |
| Never | Four paws under the belly. |
| Place | **IN PLACE / treadmill.** Décor scrolls. Bolt does **not** travel the plate. |
| Clock | Hung cutout **6 s**. 4–5 cycles. First ≈ last. Constant speed 0→6 s. |
| Rate | **48fps** on cooked plates. Match rates at key (no skate). |

---

## 5. Biome link

| Lock | Law |
|---|---|
| Layers | Bolt is **NOT** in the hung road plate. Plate = empty road (Video A). Bolt = keyed layer. Recook Bolt = replace **`bolt.mp4` only**. That is OK. Do **NOT** delete road plates (`road.mp4` / war / night / …). Hang ≠ wipe: [09-recette-biome.md](09-recette-biome.md). |
| Light | **BAKED in fur** from **one** A/B road frame (warm dusk rim on back / ear tips; darker belly). Light only. |
| Never | JS reflection. Puddle shadow. Baking Bolt into a **single final film** with no cutout stack. |
| Identity | Same Pack Bolt across biomes. **Only light changes.** |
| Plant | Paws already glued in the film. Game plants on the **bottom of the blob**. |
| Lanes | L/M/R = code **X shift of one Bolt layer**. Never three Bolts. Never a 3-lane mask. |

---

## 6. Pipeline order (do not invert)

Make / add a biome **always** this order. Soft KEEP banned.

1. **Empty plaque style** — still ZERO dog. Paste [image-empty-plate.txt](../prompts/image-empty-plate.txt) + biome `{PAINT}`. Camera locked (not too far / not too close; clear center corridor).
2. **Video A — empty rush** — plaque défile à fond. [`imagineBiomeClip`](../../scripts/imagine-hooks.mjs) with real `image` + distinct `last_frame` (world advanced). **48fps**. ZERO dog. Paste [video-empty-plate.txt](../prompts/video-empty-plate.txt).
3. **Video B — gait source** — SAME décor rush + Bolt mid-lane **IN PLACE**, natural rotary gallop, `@ref` [`lock/bolt-back.jpg`](../../lock/bolt-back.jpg). Camera locked. **48fps**. Kitchen only — **do not Hang**. This exists so gait is natural (green-only I2V invents walk). API / Build hooks with real `image` + distinct `last_frame`. **Not** hall `imagineClip`. **Not** `imagineBiomeClip` (that injects ZERO dog). **Not** chat Imagine.
4. **Extract best gallop cycle** from B — several frames of **ONE** cycle (start, 2–3 mids chronological, end). End ≈ start for loop.
5. **Repose cycle onto flat `#00FF00`** — each frame / the I2V pair already on green (no décor). Style still matches [`lock/bolt-back.jpg`](../../lock/bolt-back.jpg). Light bake from **one** A/B road frame OK (light only).
6. **Video Bolt cutout (green)** — [`imagineBoltClip`](../../scripts/imagine-hooks.mjs) with:
   - `first` = cycle start on green
   - `last` = cycle end on green (≈ start for loop)
   - optional mid frames as Imagine `@ref` in chronological order (prompt says sequence)
   - `promptFile` [`biome/prompts/video-bolt-mid.txt`](../prompts/video-bolt-mid.txt)
   - **48fps**, IN PLACE / treadmill
7. **Chroma key** ([05-key.md](05-key.md)) → plant cutout on Video A. Match rates (no skate). L/M/R = code X shift of **one** Bolt layer.

QC still (step 5) — rear, two ears, flat `#00FF00`, sprint pose. If **¾** or **gold pipe** → **THROW**. No I2V.  
QC frames 0 / 2 / 4 / 5.8 of the green clip — one yaw frame = **throw the clip**.  
Then green key + `killCrown` (gold **pipe sat**, NOT cream fur).

Hung PASS / sealed skip stays. `--force` recooks. Soft KEEP banned.

### HARD BAN — chat Imagine alone

Grok **MUST** use API / Build hooks with **first frame + last frame**:

| Job | Hook | Cable |
|---|---|---|
| Road / empty rush (Video A) | `imagineBiomeClip` | `image` + distinct `last_frame` (world advanced). ZERO dog. 48fps. |
| Bolt cutout (green) | `imagineBoltClip` | `first` + `last` = cycle bookends on green. 48fps. |

**BANNED:**

- chat Imagine UI alone (`imagine_image_to_video` / `imagine_reference_to_video` / chat stills for this cook)
- Imagine Agent video without first+last
- hall `imagineClip`
- inventing prompts
- baking Bolt into a single final film with no cutout stack
- 3-Bolt multi-lane mask

If hooks / `XAI_API_KEY` unavailable → **REFUSE** / stock — do not fall back to chat I2V.

---

## 7. Never put in the prompt

- three-quarter / cinematic orbit / camera follows
- runs along highway / city behind (on the **green** cutout)
- wet road / reflection / contact shadow
- chrome collar / gold pipe
- stands still then starts running

---

## Why he still turns (or walks)

I2V **ignores** “never yaw” unless:

1. the still is already **strict rear** (tail center, back of ears, no cheek), **and**
2. the clip is **IN PLACE / treadmill** (green cycle bookends — not a road travel pair).

Green-only I2V from one still invents a **walk**. That is why Video B (décor rush + Bolt mid-lane IN PLACE) is the gait source. Extract one cycle, repose on `#00FF00`, then `imagineBoltClip`.

A ¾-rear still with a clean key still crab-walks. Photoreal + ¾ = double FAIL.

---

## Hook (do not use hall `imagineClip`)

Hall `imagineClip` injects citadel HALL_LAW. `imagineBiomeClip` is **ZERO dog** + distinct `last_frame` (road travel — Video A only). Both are **wrong** for the green cutout.

```js
await imagineBoltClip({
  first: "bolt-cycle-start.jpg",  // cycle start on #00FF00
  last: "bolt-cycle-end.jpg",     // cycle end ≈ start — in place
  dest: "biome/master/bolt.mp4",
  seconds: 6,
  promptFile: "biome/prompts/video-bolt-mid.txt",
});
```

Optional mid-cycle frames = Imagine `@ref` in chronological order (prompt says sequence). Same still twice remains legal if the cycle bookends are the same file.

Cannot run `node` + `XAI_API_KEY` → **REFUSE**. Stock Sprint. Do **not** fall back to chat `imagine_image_to_video` / `imagine_reference_to_video` / Imagine Agent video.

Paste blocks: [image-bolt-mid.txt](../prompts/image-bolt-mid.txt) · [video-bolt-mid.txt](../prompts/video-bolt-mid.txt).

---

## Audio / SFX

Hung films stay **`-an`**. Audio on the mp4 **kills autoplay**.

No SFX binaries are hung under `biome/master/` or `biome/assets/`. Do **not** invent wav / mp3 / voice beds. Future SFX (if SmiR reseals) is a **separate Live layer**, never baked into `road*.mp4` / `bolt.mp4`.

---

## Share gap (Boltverse Odyssey Game `92bece13…`)

Already on `main` — do not re-upload:

| Piece | Where |
|---|---|
| `imagineBiomeClip` + `last_frame` + plate-speed | `222ab94` · [08-plate-speed.md](08-plate-speed.md) · `scripts/plate-speed.py` |
| Hazard 1–2 lanes, never all three | `e17bd5c` · `16ad062` |
| 10 s ultra-constant rush | `7484af8` |
| SPEED LAW through crash / impact | `08dac34` |
| Full dusk-canyon recette + box | `9a738e7` · [09-recette-biome.md](09-recette-biome.md) |
| Hung dusk→night→war cousins + live LanePlayer | `4b25526` · [LanePlayer.tsx](../reference/LanePlayer.tsx) |
| Pack pointer | [07-pack-live.md](07-pack-live.md) · [`client/pack.js`](../../client/pack.js) |

Hung plates **present** under [`biome/master/`](../master/README.md): `road.mp4`, `road-bar.mp4`, `road-blast.mp4`, `road-car.mp4`, `road-gap.mp4`, `road-show.mp4`, `road-duel.mp4`, `road-gate.mp4`, `road-night.mp4`, `road-war1.mp4` … `road-war3.mp4`, `bolt.mp4`, `road.jpg`.

**HARD LOCK — Hang ≠ wipe.** These road plates stay. A new biome ADDs `road-<biome>*.mp4` beside them. Recooking this layer may overwrite `bolt.mp4` only. Never `rm` the road library to “make room”.

**Absent (do not invent binaries):**

- Share-only SFX notes / audio beds — no files on disk.
- Grok share transcript (`92bece13…`) — not retrievable as extra paste; this page is the SoT for Bolt.
- `biome/assets/` — empty pointer ([README](../assets/README.md)). Not the `/master` stack.

This page + `imagineBiomeClip` + `imagineBoltClip` + the Bolt prompts are the cook law. Do **not** re-upload `node_modules` / recordings.

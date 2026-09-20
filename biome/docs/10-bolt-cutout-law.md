# 10 — Bolt cutout LAW (HARD)

Kitchen SoT. English OK. Keep Pack terms. SmiR 2026-09-18.

This page is **the** Bolt still + gallop law for every biome. Road plates stay empty. Bolt is a **keyed layer**.  
Read with [09-recette-biome.md](09-recette-biome.md) · [05-key.md](05-key.md) · [01-images.md](01-images.md) · [02-videos.md](02-videos.md) · [13-make-bolt-lane.md](13-make-bolt-lane.md) (Make Bolt Lane brief) · [13b-anti-sticker-contact.md](13b-anti-sticker-contact.md) (compositor anti-sticker + contact shadow) · [13c-green-despill.md](13c-green-despill.md) (green key + despill factory) · [14-rotary-gallop.md](14-rotary-gallop.md) (rotary cycle / plate-time cadence).

**PRIORITY 0 — Bolt sprint for new biomes = REUSE, not invent.**
A fresh Grok in a new Build convo must **NOT** cook a new Bolt gallop from scratch (no new Imagine dog sprint). Pipeline is:
1. Empty road plate only (Video A) — biome décor, no dog.
2. Take sealed [`lock/bolt-gallop-cycle.mp4`](../../lock/bolt-gallop-cycle.mp4) as the Bolt motion asset (already rear / green / rotary).
3. Key + despill cutout from that cycle.
4. Composite cutout onto the scrolling empty plate (AFF stack). Speed/scroll = plate; gait = locked cycle.

**FAIL** if Grok invents a new Bolt sprint clip for a biome cook. Only SmiR can authorize a new cycle cook to replace the lock.
Style teacher [`lock/bolt-back.jpg`](../../lock/bolt-back.jpg) still applies if any still / repose is needed; motion teacher = the sealed cycle mp4.

**Product method (make / add a biome):** décor scrolls (rush); Bolt sprints **IN PLACE** (treadmill) via the **locked cycle**, not a new Imagine dog. Mid-lane. **48fps** on cooked plates. Hang ≠ wipe.

**HARD LOCK — new biome Bolt (SmiR 2026-09-18 FAIL).** New biome (any name — Tide, Frost, Ember, invented): **always** `@ref` [`lock/bolt-back.jpg`](../../lock/bolt-back.jpg). **BAN** copying hung `biome/master/bolt.mp4` / canyon Bolt as the identity. Light bake from the **new** empty plaque is OK; identity = teacher. Hang **only** the new plates beside existing masters. Do **NOT** rebuild canyon→war first. Do **NOT** require Beat 3 recook as a gate. Name + décor `{PAINT}` allowed / encouraged. Tide is one example. Never refuse “I can only do Tide.” Pipeline below + hooks first/last still apply. Catalog lists **hung** biomes only; a biome in cook is not hung until hung.

**HARD — hooks first + last (Video A only).** Road / empty rush = [`imagineBiomeClip`](../../scripts/imagine-hooks.mjs) (`image` + distinct `last_frame`). Bolt motion for a new biome = **REUSE** [`lock/bolt-gallop-cycle.mp4`](../../lock/bolt-gallop-cycle.mp4) — no new Imagine dog sprint. [`imagineBoltClip`](../../scripts/imagine-hooks.mjs) is **SmiR-only** to replace the lock. Chat Imagine UI alone = **banned**. Imagine Agent video = **banned** for this layer. Hall `imagineClip` = **banned** for this layer. If hooks / `XAI_API_KEY` unavailable for Video A → **REFUSE** / stock. Do **not** fall back to chat I2V.

**Word “rear” alone is not enough.** I2V invents a walk or a new dog. That is why a new biome **REUSES** the sealed cycle instead of cooking a sprint.

---

## STYLE (SmiR eye — lock this first)

**PRIORITY 0 TEACHER GATE** — before ANY Bolt still / clip / cook for a biome:
1. Open [`lock/bolt-back.jpg`](../../lock/bolt-back.jpg) **or** [`biome/lock/bolt-back.jpg`](../lock/bolt-back.jpg) (same bytes — either path OK).
2. **Attach / show that exact image in the Build chat** so the session has the pixels.
3. Then **@ref** it on every Bolt Imagine call.
4. If the teacher is not shown → **STOP. No cook. FAIL.**
5. Soft KEEP banned without teacher proof.

`STEP 0: attach lock/bolt-back.jpg (or biome/lock/bolt-back.jpg) in chat before cooking Bolt.`

**PRIORITY 0 — REUSE the sealed cycle.** [`lock/bolt-gallop-cycle.mp4`](../../lock/bolt-gallop-cycle.mp4) **is** the Bolt motion asset (already rear / green / rotary). Key + despill it. Composite onto Video A. Do **not** Imagine a new dog sprint. **FAIL** if Grok invents a new Bolt sprint clip. Only SmiR can authorize a new cycle cook to replace the lock. [`lock/bolt-gallop-cycle-first.jpg`](../../lock/bolt-gallop-cycle-first.jpg) = first frame (repose / still only). [`lock/bolt-gallop-cycle-12s-preview.mp4`](../../lock/bolt-gallop-cycle-12s-preview.mp4) = preview only. Loop seam = **hard cut** — never optical-flow morph last→first.

This hang does **not** wipe `biome/master/bolt.mp4`. Hang ≠ wipe. Law: [14-rotary-gallop.md](14-rotary-gallop.md) · [`lock/README.md`](../../lock/README.md).

**HARD BAN as identity sources** (never @ref as Sprint biome Bolt teacher):
- `biome/master/bolt.mp4` / hung bolt — OUTPUT only, never @ref as style teacher
- `lock/bolt-back-prev.jpg` — archive only, never @ref
- `lock/RIG-*`, `lock/SEAL-*`, `lock/example-*`, `lock/sill-*` — Citadel hall locks, **NOT** Sprint biome Bolt teacher
- Any local `bolt-rear-*.jpg` invented in a Build sandbox

Identity teacher = [`lock/bolt-back.jpg`](../../lock/bolt-back.jpg) **or** [`biome/lock/bolt-back.jpg`](../lock/bolt-back.jpg). **This still IS Bolt** for biome videos.

Coat + silhouette + **strict rear**. Fluffy white GSD. Rim light. Not a different dog.

**@ref / Imagine reference** `lock/bolt-back.jpg` or `biome/lock/bolt-back.jpg` for **every** Bolt still / clip.

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
| Teacher | [`lock/bolt-back.jpg`](../../lock/bolt-back.jpg) **or** [`biome/lock/bolt-back.jpg`](../lock/bolt-back.jpg) — coat / rear camera. Not hall scale. Never hung `bolt.mp4`. |
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

Video B is **SmiR only** (replace the lock). A new biome does **not** cook Video B. **REUSE** [`lock/bolt-gallop-cycle.mp4`](../../lock/bolt-gallop-cycle.mp4).

---

## 4. Motion

| Lock | Law |
|---|---|
| Start still | **ALREADY in sprint.** One rear leg **extended**. |
| Never | Standing still (else walk / trot). Stand / trot / pause. |
| Gait | **Rotary gallop:** body stretches then gathers. Hind legs drive **fully back**. |
| Never | Four paws under the belly. |
| Place | **IN PLACE / treadmill.** Décor scrolls. Bolt does **not** travel the plate. |
| Clock | Gait = sealed [`lock/bolt-gallop-cycle.mp4`](../../lock/bolt-gallop-cycle.mp4) (1s hard-cut closed period, loop forever). Speed/scroll = plate. Do **not** cook a new 6 s sprint. |
| Rate | **48fps** on cooked plates. Match rates at key (no skate). |

---

## 5. Biome link

| Lock | Law |
|---|---|
| Layers | Bolt is **NOT** in the hung road plate. Plate = empty road (Video A). Bolt = keyed layer from **REUSE** [`lock/bolt-gallop-cycle.mp4`](../../lock/bolt-gallop-cycle.mp4). **FAIL** if Grok invents a new sprint / recooks `bolt.mp4` from Imagine. Only SmiR can replace the lock. **BAN** copying hung `biome/master/bolt.mp4` / canyon Bolt as the new-biome identity. Do **NOT** delete road plates (`road.mp4` / war / night / …). Hang ≠ wipe: [09-recette-biome.md](09-recette-biome.md). |
| Light | **BAKED in fur** from **one** A/B road frame of **this** biome’s empty plaque (warm dusk rim on back / ear tips; darker belly). Light only. |
| Never | JS reflection. Puddle shadow. Baking Bolt into a **single final film** with no cutout stack. Copying hung canyon `bolt.mp4` as identity. |
| Identity | Same Pack Bolt across biomes via the **teacher**, not a file copy. **Only light changes.** |
| Plant | Paws already glued in the film. Game plants on the **bottom of the blob**. |
| Lanes | L/M/R = code **X shift of one Bolt layer**. Never three Bolts. Never a 3-lane mask. |

---

## 6. Pipeline order (do not invert)

**PRIORITY 0 — new biome Bolt = REUSE the sealed cycle. Do not invent a sprint.**

Make / add a biome **always** this order. Soft KEEP banned.

1. **Empty plaque style** — still ZERO dog. Paste [image-empty-plate.txt](../prompts/image-empty-plate.txt) + biome `{PAINT}`. Camera locked (not too far / not too close; clear center corridor).
2. **Video A — empty rush** — plaque défile à fond. [`imagineBiomeClip`](../../scripts/imagine-hooks.mjs) with real `image` + distinct `last_frame` (world advanced). **48fps**. ZERO dog. Paste [video-empty-plate.txt](../prompts/video-empty-plate.txt).
3. **REUSE sealed cycle** — take [`lock/bolt-gallop-cycle.mp4`](../../lock/bolt-gallop-cycle.mp4) as the Bolt motion asset (already rear / green / rotary). Do **not** Imagine a new dog sprint. Do **not** run Video B / `imagineBoltClip` for a biome cook.
4. **Key + despill** — chroma key ([05-key.md](05-key.md)) + despill ([13c-green-despill.md](13c-green-despill.md)) from **that** cycle.
5. **Composite** — plant cutout on Video A (AFF stack). Speed/scroll = plate; gait = locked cycle. Match rates (no skate). L/M/R = code X shift of **one** Bolt layer.

QC the **reused** cycle — rear, two ears, flat `#00FF00`, sprint pose. If **¾** or **gold pipe** → **THROW** (that would be a bad lock — do not invent a replacement). Then green key + `killCrown` (gold **pipe sat**, NOT cream fur).

**FAIL** if Grok invents a new Bolt sprint clip for a biome cook.

Hung PASS / sealed skip stays. Soft KEEP banned.

### SmiR only — replace the lock

Video B / extract / repose / `imagineBoltClip` is **not** the new-biome path. Only SmiR can authorize a new cycle cook to replace `lock/bolt-gallop-cycle.mp4`. Until then the lock is frozen. Loop seam = **hard cut** on the closed period — never optical-flow morph last→first.

### HARD BAN — invent a new Bolt sprint

Grok **MUST** cook Video A with API / Build hooks (`image` + `last_frame`). Bolt = **REUSE** the sealed cycle.

| Job | Hook / asset | Cable |
|---|---|---|
| Road / empty rush (Video A) | `imagineBiomeClip` | `image` + distinct `last_frame` (world advanced). ZERO dog. 48fps. |
| Bolt cutout (green) | **REUSE** [`lock/bolt-gallop-cycle.mp4`](../../lock/bolt-gallop-cycle.mp4) | Key + despill + composite onto A. No new Imagine dog sprint. |

**BANNED:**

- inventing a new Bolt sprint clip for a biome cook (chat Imagine, `imagineBoltClip`, Agent video, or any new dog gallop)
- chat Imagine UI alone (`imagine_image_to_video` / `imagine_reference_to_video` / chat stills for this cook)
- Imagine Agent video
- hall `imagineClip`
- inventing prompts
- optical-flow / morph last→first on the closed cycle (seam = **hard cut**)
- baking Bolt into a single final film with no cutout stack
- 3-Bolt multi-lane mask

If hooks / `XAI_API_KEY` unavailable for Video A → **REFUSE** / stock — do not fall back to chat I2V. Do **not** invent a Bolt sprint as a workaround.

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

Green-only I2V from one still invents a **walk** or a **new dog**. That is why a new biome **REUSES** [`lock/bolt-gallop-cycle.mp4`](../../lock/bolt-gallop-cycle.mp4) — key + despill + composite. Do not cook a sprint.

A ¾-rear still with a clean key still crab-walks. Photoreal + ¾ = double FAIL.

---

## Hook (do not use hall `imagineClip`)

Hall `imagineClip` injects citadel HALL_LAW. `imagineBiomeClip` is **ZERO dog** + distinct `last_frame` (road travel — Video A only). Both are **wrong** as a Bolt sprint cook.

**New biome Bolt = REUSE** [`lock/bolt-gallop-cycle.mp4`](../../lock/bolt-gallop-cycle.mp4). Key + despill ([13c](13c-green-despill.md)) → composite onto Video A. Do **not** call `imagineBoltClip`.

`imagineBoltClip` / Video B = **SmiR only**, to replace the lock. A fresh Grok must not run it.

Cannot run `node` + `XAI_API_KEY` for Video A → **REFUSE**. Stock Sprint. Do **not** fall back to chat `imagine_image_to_video` / `imagine_reference_to_video` / Imagine Agent video. Do **not** invent a Bolt sprint.

Paste blocks (Video A / still repose only): [image-empty-plate.txt](../prompts/image-empty-plate.txt) · [video-empty-plate.txt](../prompts/video-empty-plate.txt). Style still if needed: [image-bolt-mid.txt](../prompts/image-bolt-mid.txt) + `@ref` `lock/bolt-back.jpg`.

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

**HARD LOCK — Hang ≠ wipe.** These road plates stay. A new biome ADDs `road-<biome>*.mp4` beside them. Bolt motion = **REUSE** `lock/bolt-gallop-cycle.mp4` — do **not** overwrite `bolt.mp4` with a new Imagine sprint. Only SmiR can replace the lock. **BAN** copying hung `bolt.mp4` / canyon Bolt as the new-biome identity. Never `rm` the road library to “make room”. Do **NOT** rebuild canyon→war first.

**Absent (do not invent binaries):**

- Share-only SFX notes / audio beds — no files on disk.
- Grok share transcript (`92bece13…`) — not retrievable as extra paste; this page is the SoT for Bolt.
- `biome/assets/` — empty pointer ([README](../assets/README.md)). Not the `/master` stack.

This page + `imagineBiomeClip` (Video A) + **REUSE** `lock/bolt-gallop-cycle.mp4` are the cook law. `imagineBoltClip` = SmiR only. Do **not** re-upload `node_modules` / recordings.

# 10 — Bolt cutout LAW (HARD)

Kitchen SoT. English OK. Keep Pack terms.

This page is **the** Bolt still + gallop law for every biome. Road plates stay empty. Bolt is a **keyed layer**.  
Read with [09-recette-biome.md](09-recette-biome.md) · [05-key.md](05-key.md) · [01-images.md](01-images.md) · [02-videos.md](02-videos.md).  
Hooks: [`imagineBoltClip`](../../scripts/imagine-hooks.mjs) — `image` + `last_frame` = **the same still**. Chat Imagine alone = **banned**.

**Word “rear” alone is not enough.** I2V ignores “never yaw” unless the still is already **100% strict rear** AND the clip is **IN PLACE / treadmill**.

---

## STYLE (SmiR eye — lock this first)

Pack Bolt = **stylized heroic 3D game shepherd**. Chunky clean fur. Bold silhouette.

**NOT** photoreal VFX. **NOT** a real-dog photo.

Current FAIL example: clean key, but **¾ rear** → crab-walk + too photoreal. Throw. Recook the still. Do not I2V a ¾ plate.

Identity **base** stays a full-white German Shepherd (white coat forever). Décor-matching skin ON TOP of that white base is OK (ember / ice / dusk rim). Not a different dog.

---

## 1. Camera

Imagine **ORBITS** when the still is not 100% rear **OR** the clip “runs in a set”.

| Lock | Law |
|---|---|
| Angle | **Strict rear.** X only. Tail **center**. Back of ears. Never cheek / flank / ¾. |
| Camera | **Locked.** No pan. No orbit. No yaw. No chase. |
| Motion vs cam | He moves **away from the camera** (stuck in his back). |
| Magic words | **IN PLACE / treadmill.** |

**Explicit bans:** three-quarter, side view, profile, turns, looks back, runs down the road.

If he “runs on a road”, Imagine invents travelling → he **turns**.

---

## 2. Identity

| Lock | Law |
|---|---|
| Coat | Full-white GSD. White coat forever. Skin ON TOP OK. |
| Collar | **Teal fabric** collar from behind. Not chrome. Not a tube. |
| Ears | **Two pointed GSD ears EVERY frame.** |
| Count | **One** subject. |
| Size | Constant. |
| Plant | Paws in the **lower third**. |

---

## 3. Background

**Flat `#00FF00` ONLY.**

**Ban:** road, city, gold pipe, ring, puddle, floor, drawn shadow, halo.

Any **set** in the still → I2V thinks “scene” → **orbits**.

Soft black / magenta / gradient / studio floor = FAIL for this cook. Recette “magenta/vert” is **void**. `#00FF00` only.

---

## 4. Motion

| Lock | Law |
|---|---|
| Start still | **ALREADY in sprint.** One rear leg **extended**. |
| Never | Standing still (else walk / trot). Stand / trot / pause. |
| Gait | **Rotary gallop:** body stretches then gathers. Hind legs drive **fully back**. |
| Never | Four paws under the belly. |
| Clock | **6 s.** 4–5 cycles. First ≈ last. Constant speed 0→6 s. |

---

## 5. Biome link

| Lock | Law |
|---|---|
| Layers | Bolt is **NOT** in the road plate. Plate = empty road. Bolt = keyed layer. |
| Light | **BAKED in fur** from **one** plate frame (warm dusk rim on back / ear tips; darker belly). |
| Never | JS reflection. Puddle shadow. |
| Identity | Same Pack Bolt across biomes. **Only light changes.** |
| Plant | Paws already glued in the film. Game plants on the **bottom of the blob**. |

---

## 6. Pipeline order (do not invert)

1. **Known rear still** — already 100% rear, already in sprint, flat green.
2. **R2I light bake** — `IMAGE_0` = one road frame (**light only**). `IMAGE_1` = Bolt rear. Prompt: **copy IMAGE_1 camera exactly.** Ignore IMAGE_0’s road / set / dog-if-any.
3. **QC still** — rear, two ears, flat `#00FF00`, sprint pose. If **¾** or **gold pipe** → **THROW**. No I2V.
4. **I2V from THAT still** — 6 s, in place, never yaw. API hooks: `image` + `last_frame` = **same still** (`imagineBoltClip`). Chat Imagine alone = **banned**.
5. **QC frames 0 / 2 / 4 / 5.8** — one yaw frame = **throw the clip**.
6. **Then** green key + `killCrown` (gold **pipe sat**, NOT cream fur). [05-key.md](05-key.md).

Hung PASS / sealed skip stays. `--force` recooks. Soft KEEP banned.

---

## 7. Never put in the prompt

- three-quarter / cinematic orbit / camera follows
- runs along highway / city behind
- wet road / reflection / contact shadow
- chrome collar / gold pipe
- stands still then starts running

---

## Why he still turns

I2V **ignores** “never yaw” unless:

1. the still is already **strict rear** (tail center, back of ears, no cheek), **and**
2. the clip is **IN PLACE / treadmill** (same still twice — not a road travel pair).

A ¾-rear still with a clean key still crab-walks. Photoreal + ¾ = double FAIL.

---

## Hook (do not use hall `imagineClip`)

Hall `imagineClip` injects citadel HALL_LAW. `imagineBiomeClip` is **ZERO dog** + distinct `last_frame` (road travel). Both are **wrong** for this layer.

```js
await imagineBoltClip({
  first: "bolt-rear.jpg",
  last: "bolt-rear.jpg",   // SAME still — in place
  dest: "biome/master/bolt.mp4",
  seconds: 6,
  promptFile: "biome/prompts/video-bolt-mid.txt",
});
```

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

**Absent (do not invent binaries):**

- Share-only SFX notes / audio beds — no files on disk.
- Grok share transcript (`92bece13…`) — not retrievable as extra paste; this page is the SoT for Bolt.
- `biome/assets/` — empty pointer ([README](../assets/README.md)). Not the `/master` stack.

This page + `imagineBoltClip` + the Bolt prompts are the missing cook law from that share. Do **not** re-upload `node_modules` / recordings.

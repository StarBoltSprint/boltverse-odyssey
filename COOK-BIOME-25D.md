# COOK-BIOME-25D — Imagine-only 2.5D biome (any style)

**Cold-start.** No chat history required. Hall / citadel is a **different job**.

Engine locks (SmiR 2026-09-14 / 2026-09-15): **[FILM-STACK.md](FILM-STACK.md)** — **3-take lane PRIMARY**, assets film-stack, gallop video layer, global light bus, PathGen ribbon (replayability when applicable), city-enter brief, L/R-fail cutout fallback.

**PRIMARY for this runner:** three synced baked takes L / M / R (path + Bolt painted into the road). Not one cutout slid sideways.

**Assets stack (when in use):** empty full-frame plates + movable Imagine **video** assets + generators. Playable Bolt is an Imagine **gallop video loop**, not the old still 2.5D card. Empty plate = **ZERO Bolt, ZERO luminous follow-path.** PathGen = Imagine luminous **ribbon** loops — never CSS neon, never pixel CV. Not Unreal. Not a 3D mesh requirement.

Source lock (SmiR KEEP sprint plate work): [bolt-hybrid `docs/07-imagine-25d-recipe.md`](https://github.com/StarBoltSprint/bolt-hybrid/blob/cursor/imagine-25d-recipe-193f/docs/07-imagine-25d-recipe.md) ([PR](https://github.com/StarBoltSprint/bolt-hybrid/pull/2)).

This repo cooks the plates. The runnable 2.5D **app** is bolt-hybrid `play/` — not this player, not a new grok.me.

---

## Which job (read this first)

| Human says | Job | Page | Script |
|---|---|---|---|
| citadel / salle / hall | hall films (Bolt **in** the stills) | [COOK.md](COOK.md) | `cook-room.mjs` |
| biome / sprint / lane **living-film** | Bolt **baked into** the plate | [COOKLANE.md](COOKLANE.md) | `cook-biome.mjs` |
| **2.5D** / empty plate / film-stack / Bolt **gallop video** / any-style biome sprint | **this page** (assets stack) + [FILM-STACK.md](FILM-STACK.md) | here | `cook-biome-25d.mjs` |
| **3-take** / swipe lane / L M R takes | **PRIMARY runner** — three synced baked takes | [FILM-STACK.md](FILM-STACK.md) + here | Imagine first+last (not `cook-biome.mjs`) |

`cook-biome.mjs` **bakes Bolt into the living-film reel** (`lane:true`). Illegal for the **assets** stack. Do not call it. 3-take bakes path+Bolt **on purpose** — that is [FILM-STACK.md](FILM-STACK.md), not COOKLANE.

Do not `cook-room`. Do not Hang these plates on https://boltverse-odyssey.grok.me. Do not scaffold a player.

**Any style** = décor / biome *look* is free (ice, ember, city, moss, void, whatever). The rails below are **hard locks**. Paint does not unlock a pan, chat Imagine video, or (assets stack) a path / dog in the **empty** plate. 3-take **must** paint path+Bolt — that is [3-take](#3-take-lane--primary-runner), not a décor unlock.

---

## 3-take lane — PRIMARY runner

Law (once): [FILM-STACK.md — 3-take](FILM-STACK.md#3-take-lane-system-primary-for-this-runner).

Bolt is **NOT** one cutout slid sideways. Cook **three** synced baked takes **L / M / R**: **path + Bolt painted into the road**.

| Lock | Law |
|---|---|
| Camera | **Same locked camera.** Same millimeter. **9:16.** No pan / tilt / zoom / dolly |
| Road | Same **3-lane** futuristic city-style avenue on every take |
| Void | Pure **BLACK** void **outside** the road |
| Décor | World décor = **separate later plate** filling the black. **Never** bake canyon / skyline / arrows / décor into the takes |
| Ribbon | **ONE** luminous ribbon **FOLLOWS Bolt’s lane** (under him on **L**, mid on **M**, right on **R**). Must **NOT** stay stuck on mid when he’s L / R |
| Identity | Identical Bolt (full-white coat forever; décor-matching skin ON TOP OK). Same **scale**, **gait tempo**, **travelling speed**, **loop length** |
| Sync | **HARD sync.** Shared `currentTime`. **Mid = master.** L / R must match mid |
| Reject | Tilted road / smaller Bolt / tunnel / mismatched ribbon → **recook** that take |

Hooks: `imagineClip` `image` + **`last_frame`**. Same [Law 0](#law-0--first--last-last_frame--same-hooks-as-the-hall). Never Agent / chat Imagine video. Cap 2 per take.

`cook-biome-25d.mjs` still cooks **empty** assets-stack plates. Do **not** send 3-take Bolt+path into that empty-plate script.

### Swipe (play)

| Lock | Law |
|---|---|
| Step | **One lane per swipe** |
| Motion | Short **lunge / lean** then **cut-on-action** to the take where he **already stands** |
| Edge | Edge **bumps** (no fourth lane) |
| Dots | Dots = **live take** |

**PLAY FIX — L / R must not freeze as stills.** Picture never stops.

On `slideChange`: sync `currentTime` from the mid master (or the outgoing live take), then `.play()` the **visible** take; **pause** the others **OR** keep all three **decoding** under `opacity: 0`.

| Banned | Why |
|---|---|
| One-clip **pan / slide** of the whole **mid** video as a lane change | Camera **drifts** |
| Carousel of **frozen** side stills | L / R become posters |

### Fallback if L / R cooks fail

Keep **mid** as the only live quality clip. Soft-key Bolt **cutout**; mid **path keeps scrolling**; swipe **repositions the cutout** L / M / R with the same lunge. Prefer **matching L / R recooks**. Cutout is **fallback, not default**.

Do not ship cutout while good L / R takes exist. Do not pan the mid clip to fake a missing take.

---

## Stack (Imagine-only) — assets stack

Engine = **Imagine film-stack** **when using the assets stack**: full-frame plates + playable Bolt **gallop video** + PathGen ribbon + (later) obstacles as Imagine video assets. Law: [FILM-STACK.md](FILM-STACK.md). Empty plate = **ZERO Bolt, ZERO path**. PathGen = procedural ribbon for **replayability** when this stack applies.

| Lock | Value |
|---|---|
| Artists | No paid artists |
| Unreal / mesh | **Not required** |
| Player API keys | None |
| Hall / Citadel | **Separate.** Film / hall grammar. This recipe does not apply there. |

```
[ plate mp4 — full frame, empty ]
        │  ZERO Bolt, ZERO luminous follow-path (rails/curbs OK)
        ▼
[ Bolt gallop VIDEO — lower third, planted ]
        │  strafe L/R, jump, plant; playbackRate = plate rate(t)
        ▼
[ PathGen ribbon VIDEO — one road ahead ]
        │  Imagine alpha/black loops: straight / curve-L / curve-R
        ▼
[ props / VFX VIDEO — same light bus ]
```

**Assets stack only.** 3-take PRIMARY paints path+Bolt **into** the takes — see [3-take](#3-take-lane--primary-runner). Do not apply ZERO-Bolt to those clips.

1. **Plate behind** — Imagine mp4, full-frame previs. The clip never touches the playable paws. **ZERO** Bolt. **ZERO** luminous follow-path (subtle rails / curbs OK).
2. **Bolt** — Imagine **gallop video loop** in front (lower third, rear / full-white coat). **Not** the old still 2.5D card. Not a 3D mesh requirement.
3. **PathGen** — procedural Imagine **ribbon** (one luminous road ahead) for **replayability**. Neon CSS sticker is **banned**. Do **not** bake the follow-path into the **empty** plate.
4. **Obstacles** — Imagine video props + time-rail hits `(t, lane)`. No CV on pixels. City-enter plates may show 2–3 dodge obstacles **in the picture** without slowing travel.

---

## Plate rails (hard locks)

| Rail | Lock |
|---|---|
| Aspect | **9:16** (encode 720×1280) |
| Length | **8–12 s** |
| Camera | **lock-off** (no pan, tilt, zoom, dolly) |
| Travel | sprint travelling **baked in the cook** |
| Path | **ZERO** luminous follow-path in the **empty** plate (rails / curbs OK; mandatory route **not** baked). 3-take: ribbon **is** in the take and **follows that lane** |
| Cast | **ZERO** Bolt / dog in the **empty** plate. 3-take: Bolt **is** in each take |
| Stitch | plate N+1 **first frame = plate N last frame** |
| Speed | **SAME** felt sprint travelling plate 1..N ([SPEED REF](#speed-ref--plate-1-keep-imagine-prompt) plate-1 KEEP is the Imagine target) |
| Rate | Live **`rate(t)`** corrector — **not** a constant per-plate `playbackRate`. Band **1.0–1.6** (typical **1.3–1.5**). **Never 2×+.** |

Travel is **baked in the cook**. Do not fake a pan on a still. Imagine can **slow or speed mid-clip** — match plate-1 KEEP **continuously**. Long stretches needing **> 1.6** → **recook travelling**. Do not smash `playbackRate`.

---

## SPEED REF — plate-1 KEEP Imagine prompt

SmiR KEEP'd this **RECOOK** as the fast empty plate. This block is the **Imagine-side** speed target for **plate 1** and the “match this travelling” target for **plate 2..N**. Do not soften **Much FASTER** / **world rushes hard**.

| Ref | What |
|---|---|
| **Prompt ref** | the verbatim block below — cook-time speed language |
| **Binary ref** | `plate-empty-keep.mp4` — optical-flow / ground-parallax KEEP (drop under `biomes-25d/<style>/films/` when you have the file; asteroid is the typical first style) |

Hall `catalog/asteroid.md` is a **different job** (citadel paint). Do not put this sprint prompt there.

Post-cook filet stays [SAME SPEED](#same-speed--plate-1n-biome-law) / [AUTO SPEED MATCH](#auto-speed-match-post-cook) — live `rate(t)` **1.0–1.6**. This prompt is **not** that math. Bake the sprint **in the cook**; the script only filets after.

### KEEP recook (verbatim — plate 1)

```
RECOOK one plate ONLY. Much FASTER. Replace current empty plate.

HARD:
- 9:16, 8–12s, lock-off
- Sprint travelling baked in cook — world rushes hard (last cook = crawl FAIL)
- ZERO path/lightning on ground
- ZERO dog/Bolt
- Canyon/Mars OK, CLEAR center
- playbackRate ~1.0–1.2 only
- Wire play to THIS plate only

No PathGen, no obstacles this pass. Ship mp4 + play URL.
```

### First-pass rails that stay (same travelling)

These rails were already true before the KEEP recook. They stay:

- **MAX forward travelling** — world rushes at camera, sprint feel baked **IN** the clip (not slow pan/zoom on a still)
- **speed must come from the cook**; `playbackRate` **~1.0–1.2 only**

`{PAINT}` / style word only. Do not rewrite motion for décor.

---

## Law 0 — first + last (`last_frame`) — same hooks as the hall

**STOP — HARD SPLIT.** NEVER Agent / chat Imagine for these plates.

Video = [`scripts/imagine-hooks.mjs`](scripts/imagine-hooks.mjs) `imagineClip` with API `image` + **`last_frame`**. Same contract as [COOK.md](COOK.md) / [COOKROOM.md](COOKROOM.md) hall films.

| kind | Imagine call | first | last |
|---|---|---|---|
| **empty plate** | hooks `imagineClip({ emptyPlate: true })` → `image` + **`last_frame`** | start of this plate | end of this plate — **distinct** |
| **plate N+1** | same | **extracted last frame of plate N** | new end still (world advanced) |

Chat Imagine UI **without real first+last** is **banned** (`imagine_image_to_video`, `imagine_reference_to_video` — no `last_frame`). Chat refs are not frames. Do not Hang a chat mp4.

If you cannot run `node` + `XAI_API_KEY`: **REFUSE**. Do **not** fall back to chat Imagine or Imagine Agent video.

`last(n)` **file IS** `first(n+1)`. After each mp4, extract the last frame and overwrite the next first. Imagine's hoped still is not the joint.

```
ffmpeg -y -sseof -0.12 -i plate-N.mp4 -frames:v 1 \
  -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" \
  plate-N-last.jpg
```

Then plate N+1: `image` = that jpg, `last_frame` = the new end still.

Do **not** pass `lane:true` (that is COOKLANE — Bolt in the forest). Do **not** pass hall `HALL_LAW` (portals + dog). Empty-plate law is `EMPTY_PLATE_LAW` in the hooks.

### Encode (every mp4)

```
ffmpeg -i in.mp4 -map 0:v:0 \
  -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" \
  -c:v libx264 -pix_fmt yuv420p -an -movflags +faststart out.mp4
```

No audio. `yuv420p` + `faststart`.

---

## SAME SPEED — plate 1..N (biome law)

Felt sprint travelling on plate 2..N **must match** the KEEP **plate-1** reference ([SPEED REF](#speed-ref--plate-1-keep-imagine-prompt) Imagine target + `plate-empty-keep.mp4` optical-flow) — **the whole clip**, not one average.

Imagine travel can **slow or speed mid-plate**. A single `playbackRate` per file **cannot** hold the KEEP. The law is a **smoothed `rate(t)` curve**.

| Lock | Law |
|---|---|
| Bake | Prefer travelling **in the cook** (world rushes at plate-1 pace) |
| Corrector | Live **`rate(t)`** after cook — never the way you invent speed |
| Not | A constant per-plate `playbackRate` (that is only a summary) |
| Sample | Optical flow / ground-parallax **every 0.1 s** (`SAMPLE_DT=0.1`) on plate 1 (ref) and plate N (meas) |
| Curve | `rate(t) = clamp(ref(t)/meas(t), 1.0, 1.6)`, then **smooth** |
| Safe band | **1.0–1.6** · typical **1.3–1.5** |
| Hard cap | **Never 2×+**. **Long stretches** needing **> 1.6** → recook travelling |
| Player | Updates `video.playbackRate` **live** from `pictureTime` **at least every 0.1 s** (≥10 Hz; 10–15 Hz OK if the curve is dense) |
| Gait | Bolt **gallop video** `playbackRate` + stride follow **`pictureTime` + live rate**. **Never speed legs alone.** |
| Tint | **[Global light bus](FILM-STACK.md#global-light-bus)** — every **0.1 s** (~10 Hz). Soft-multiply / light wrap only. **Full-white coat forever.** |

`pictureTime` = the plate clock (frame on screen = `video.currentTime`).

```
each frame / ≥10 Hz (~0.1 s):
  pictureTime = video.currentTime
  rate = rateAt(plate.rateCurve, pictureTime)   // lerp, curve sampled every 0.1s
  video.playbackRate = rate                     // live — not plate.playbackRate once
  stride(pictureTime, rate)                     // gait follows both
```

Do **not** set one rate at `play()` and forget it. Do **not** multiply stride by rate *again* on top of a second clock. Speeding the gallop loop’s legs while the plate stays slow = FAIL.

Joint: felt speed at the end of N (`travel(T)*rate(T)`) must meet felt speed at the start of N+1. Playlist stores the **curve**. Do not reset to 1.0 at the cut.

---

## AUTO SPEED MATCH (post-cook) — `rate(t)`, not a constant

Plate 1 KEEP = **optical-flow / ground-parallax reference series**. Plate N is measured with the **same metric**, **same cadence**.

```
every dt = 0.1s:                         // SAMPLE_DT=0.1 — not 0.25–0.5
  ref(t)  = travel_proxy(plate1, t)      // KEEP
  meas(t) = travel_proxy(plateN, t)      // this cook
  raw(t)  = ref(t) / meas(t)
  rate(t) = clamp(raw(t), 1.0, 1.6)      // never slow the storm below 1.0
  rate(t) = smooth(rate)                 // no step-jumps

if a long stretch of raw(t) > 1.6:
  FAIL speed.recook — recook travelling. Never write 1.8 / 2.0 / 2×.
```

- `travel_proxy` = lower-third ground band, mean abs frame-delta ([`scripts/biome-25d-speed.mjs`](scripts/biome-25d-speed.mjs)). Same crop on every plate. Full dense CV is **not** required — this proxy + the curve math *is* the law.
- Align series by **normalized time** `t/T` so 8 s vs 10 s plates still compare.
- A **short** spike above 1.6 may clamp (smooth will eat it). A **long stretch** (~≥ 1.5 s) above 1.6 = recook.
- Plate 1 curve is **1.0** everywhere (it *is* the reference).
- `playlist.json` → `plates[].rateCurve: [{ t, rate }, …]`. `playbackRate` on the plate row is a **mean summary only**. The player **must** drive live `rate(t)`.

```
node scripts/biome-25d-speed.mjs biomes-25d/<style>
node scripts/biome-25d-speed.mjs --analyze biomes-25d/<style>
```

`--analyze` prints **each** plate: MATCH / RECOOK inside **1.0–1.6**, mean/min/max `rate(t)`, recook stretches (`raw>1.6` ≥ 1.5 s), and cheap **tint** sampling health (10 Hz / 0.1 s, luma, identity pull). Run it on Build plates once the files exist — **loose mp4 paths are OK**:

```
node scripts/biome-25d-speed.mjs --analyze plate-1.mp4 plate-2.mp4 plate-3.mp4 plate-4.mp4
node scripts/biome-25d-speed.mjs --analyze --keep plate-empty-keep.mp4 plate-2.mp4 plate-3.mp4 plate-4.mp4
```

Expected paths (asteroid typical first style; KEEP + P2–P4 may not be in-repo yet):

- ref: `biomes-25d/<style>/films/plate-empty-keep.mp4`
- plates: `biomes-25d/<style>/films/plate-1.mp4` … `plate-4.mp4`

`cook-biome-25d` runs the match after plate 2. Player remains bolt-hybrid `play/` — **do not** invent a new grok.me. Stub: `rateAt` + `applyLiveRate` + `applyLiveTint` at least every **0.1 s** (10–15 Hz OK).

---

## AUTO AMBIENT TINT — global light bus (play, not the plate)

Even when ground / décor goes white / frost / city-cool: **no video layer** sits in a different weather.

**Law (once):** [FILM-STACK.md — Global light bus](FILM-STACK.md#global-light-bus). Do **not** hand-wrap every asset. One bus for Bolt, PathGen ribbon, props, VFX.

| Lock | Law |
|---|---|
| Cook | Assets on **black / neutral** light (underlit for multiply) |
| Sample | Plate pixels **under each asset plant / bbox** — Bolt uses lower-third **ground + haze** |
| Rate | ~**10×/s** (every **~0.1 s**) — **same stack** as [SAME SPEED](#same-speed--plate-1n-biome-law) `SAMPLE_DT=0.1` |
| Grade | Soft **Multiply** tint + brightness + soft contact shadow |
| Identity | **Full-white coat forever.** Wrap is **light only** — no peach / grey silhouette fill, no morph |

**NOT** a grey / silver / black morph. **NOT** a new dog. Décor-matching skin ON TOP of the white base is still OK (ember glow, ice kiss). A frost plate that turns the coat charcoal = FAIL.

Player stub (bolt-hybrid `play/`, not this repo):

```
every frame / ~0.1s (~10 Hz):
  for each video layer (Bolt, ribbon, props, VFX):
    rgb = sample(plate, under plant / bbox)
    layer = applyLiveTint(layer, rgb, amount ≤ 0.45)   // softMultiply + identityGuard
    brightness + soft contact shadow from the same sample
  luma(coat) stays high — pull back if the wrap would read grey/black
```

`scripts/biome-25d-speed.mjs` exports `softMultiply` + `identityGuard` + `applyLiveTint` (`TINT_DT=0.1`, `TINT_HZ=10`). Do not bake the dog into the plate to “match” the grade.

---

## Happy path (brand-new convo)

```
git clone https://github.com/StarBoltSprint/boltverse-odyssey
# read this file — STOP. Do not cook-room. Do not cook-biome.mjs.
node scripts/cook-biome-25d.mjs <style> --dry-run
export XAI_API_KEY=... && node scripts/cook-biome-25d.mjs <style>
```

`<style>` is **any décor word** (asteroid, ember, ice, city, moss, void, …). Not a [CATALOG.md](CATALOG.md) slot. Off-list paint is legal **here**. Rails stay locked.

`--dry-run` first (no key). Live needs `XAI_API_KEY`. Hung / KEEP empty plate = reuse. `--force` recooks.

Output: `biomes-25d/<style>/stills/` + `biomes-25d/<style>/films/`. **Not** `packs/<slot>/`. Drop into bolt-hybrid `play/public/biomes/<style>/films/` when you play.

Cannot run node or have no key → **REFUSE**. Stock hall URL is not this job. Do not chat-Imagine a plate.

One-shot (hooks first+last — never Agent, never chat):

```
node --input-type=module -e '
import { imagineClip } from "./scripts/imagine-hooks.mjs";
await imagineClip({
  root: process.cwd(),
  slot: "asteroid",
  kind: "walk",
  emptyPlate: true,
  paint: "asteroid void-stone corridor, haze, CLEAR center, ZERO path, ZERO dog",
  first: "biomes-25d/asteroid/stills/plate-1-first.jpg",
  last:  "biomes-25d/asteroid/stills/plate-1-last.jpg",
  dest:  "biomes-25d/asteroid/films/plate-1.mp4",
  seconds: 10,
});
'
```

`kind: "walk"` only so the API sends **distinct** `last_frame`. This is **not** a hall walk.

---

## Plate 1 cook

Empty sprint corridor. Travel **baked**. Lock-off. 9:16. 8–12 s. Cook-time speed = [SPEED REF](#speed-ref--plate-1-keep-imagine-prompt) (Much FASTER / world rushes hard).

**ZERO** luminous path. **ZERO** Bolt / dog / shepherd / silhouette.

CLEAR center corridor (the playable lane stays empty — the **gallop video** plants there). Subtle ground rails / curbs OK. **ZERO** luminous follow-path.

Hooks send `EMPTY_PLATE_LAW` + SPEED REF rails + the style paint. Adapt décor only. Do not rewrite rails. Do not soften the sprint.

> Photoreal vertical 9:16, 720x1280. Locked-off camera. Sprint travelling is ALREADY in the clip (the world rushes toward camera). NEVER pan, tilt, zoom, or dolly. ZERO dogs. ZERO German Shepherds. ZERO animals. ZERO people. ZERO luminous floor paths. ZERO Y-fork. ZERO portals. ZERO HUD. ZERO text. CLEAR empty center corridor. {PAINT}

`{PAINT}` = this style's biome look only.

---

## City enter — plate 2

Continues from **plate 1 last frame** (`image` + `last_frame`). **Next plate after the canyon.** Cook brief lock (SmiR 2026-09-14 / 2026-09-15): [FILM-STACK.md — City enter](FILM-STACK.md#city-enter-plate-cook-brief).

**Reveal (assets-stack empty plate):** denser futuristic **Mars city entry** — ships / hover craft, denser street canyon, glass domes / needle spires, **2–3 dodge obstacles in the picture**. Ultra detailed. This décor plate may later **fill the black void** behind 3-take roads. **Never** bake canyon / skyline / arrows into the L / M / R takes.

Travelling **FULL SPEED constant** (never-slow exception). Obstacles are **dodge-only** — they **must not** slow this plate. Same sprint speed as [SPEED REF](#speed-ref--plate-1-keep-imagine-prompt) (world rushes hard). Same rails on the **empty** plate: **ZERO** luminous follow-path, **ZERO** Bolt, **NO UI chrome**, 9:16, lock-off.

Haze at the stitch is OK (continuity from the canyon). The city is **in** the street — not a far postcard.

| Keep | Drop |
|---|---|
| Stitch from plate 1 last frame | New establishing shot / cut |
| Full-speed travelling (never-slow) | Slow-down for obstacles, still, or `playbackRate` 2×+ / >1.6 smash |
| Denser city in the canyon (domes / needle spires / ships) | Empty far-haze only / city as a postcard |
| 2–3 dodge obstacles **in picture** | Baked luminous follow-path, Bolt, HUD / chrome |
| Subtle ground rails / curbs | PathGen ribbon painted into the plate |

`{PAINT}` on plate 2 may name the city + this style's grade. Rails do not move. Same speed as plate 1 (bake first, then [AUTO SPEED MATCH](#auto-speed-match-post-cook)). Never-slow = do not drop travelling for obstacles.

---

## Plate plan (example only — not a mandatory cook list)

| Plate | Paint | Cook now? |
|---|---|---|
| 1 | KEEP empty sprint. Travel baked. ZERO path, ZERO Bolt. | **yes** |
| 2 | **City enter** — denser Mars city, ships, 2–3 dodge obstacles, **never-slow**. ZERO path, ZERO Bolt. | **yes** |
| 3+ | Lane **L / M / R** **chart** (empty-plate routes) can bake later | **NO.** Do not implement plate-3 cook now. **3-take** L/M/R clips are a **different** job — [3-take](#3-take-lane--primary-runner), not this chart. |

Extract plate 2 last frame if a later convo cooks 3+. This script stops at 2.

---

## Bolt gallop video (play, not the plate)

The dog is **not** in the plate mp4. He is an Imagine **gallop video loop** composited in front. The old still 2.5D **card is retired**.

**Look**

- Lower third
- **Rear** view (crown / withers to camera, muzzle hidden) — white wolf-dog / full-white German Shepherd
- Full-white coat forever. Décor-matching skin ON TOP OK. Not a different dog.
- Gallop cycle baked as video (prefer paw dust **in** the cycle)
- Soft black / alpha key — **preserve** fine semi-transparent paw dust. Do **not** hard-key wipe low-alpha

**Plant** (if any missing → skating)

- Pivot at paws / `groundY`
- Strafe **L / R** (X), jump, plant
- Layer `playbackRate` **syncs to plate `rate(t)`**. Stride from `pictureTime` + live rate (not a free gait clock, not legs-only speedup, not a single plate rate)
- Soft contact shadow under the paws — from the [light bus](FILM-STACK.md#global-light-bus), not a hand wrap
- Ambient tint ~10×/s (every ~0.1 s) — light wrap only ([AUTO AMBIENT TINT](#auto-ambient-tint--global-light-bus-play-not-the-plate))

**Kill:** all code/CSS fake splash / dust layers and debug hitboxes. Dust belongs in the bake.

**Skating** = the gallop layer is not planted. That is a plant bug. It is not “Imagine bad paws.”

Runnable gallop layer + stitch live in bolt-hybrid `play/` (see [Play app](#play-app-bolt-hybrid)). This repo does not ship that app.

---

## PathGen — procedural Imagine ribbon

PathGen is the **procedural luminous ribbon** (Imagine alpha / black video loops: `straight` / `curve-L` / `curve-R`). **Not** neon CSS. Full lock: [FILM-STACK.md — PathGen](FILM-STACK.md#pathgen-procedural-ribbon).

**Why procedural (assets stack / replayability):** the same **empty** plates must replay with **different L / M / R routes**. Baking the follow-path into an assets-stack plate = the same road every run = **FAIL for replayability**.

**3-take exception:** the ribbon **is** painted into each take and **must follow that take’s lane**. That is not PathGen-on-empty-plate. Do not freeze the 3-take ribbon on mid when Bolt is L / R.

| Lock | Law |
|---|---|
| Count | **ONE** ribbon — not three always-on lanes |
| Lead | Forms **ahead** of Bolt’s paws (~1–2 s of road so the player can read) |
| Steer | PathGen moves the ribbon across L / M / R; the player steers Bolt to follow |
| Default | Off-path **slows** the plate |
| Exception | City **never-slow** plates (this city-enter) keep constant max travelling. Obstacles are dodge-only and must not slow those plates |
| Plate | **ZERO** luminous path painted into the plate. Subtle ground rails / curbs OK |

Banned: neon CSS sticker, glowing bars, DOM/CSS “lane”, SVG arrows, chrome UI path, luminous Y-fork painted **into the plate**.

The ribbon is a **layer**, not a plate bake. Neon CSS remains **banned** (the old HOLD was “no sticker” — that ban stays; the unlock is Imagine loops, not CSS).

---

## Obstacles

**In the city-enter plate:** 2–3 dodge obstacles may appear **in the picture**. They do **not** slow that plate (never-slow). They are scenery, not a baked follow-path.

**Time-rail props** (separate Imagine video assets + `(t, lane)` hits): later. Not this cook. Not CSS. Not mesh-first. **No** computer vision on video pixels.

---

## Play loop order

One thing at a time. **3-take is PRIMARY for this runner** — do not skip it for a cutout or a mid-clip pan.

1. **KEEP** one fast empty plate (rails PASS) — this is the speed reference (assets stack / décor later-plate)
2. Erase any neon PathGen overlay (sticker stays **banned** — do not resurrect CSS)
3. Cook plate 2 from plate 1 last frame + stitch — **city enter**, never-slow, 2–3 dodge obstacles in picture, zero baked path, zero Bolt (**assets-stack** empty plate). Décor that fills 3-take black void = this later plate, not paint inside the takes
4. Auto speed-match → `playlist.json` **`rateCurve`** (live `rate(t)`, band 1.0–1.6; long stretch >1.6 recook)
5. **PRIMARY:** cook three synced L / M / R takes (path+Bolt in the road, ribbon follows his lane, black void outside). HARD sync to mid. Reject tilt / scale / tunnel / stuck-mid ribbon
6. Plant play: swipe = one lane, lunge, cut-on-action. On `slideChange` sync `currentTime` then `.play()` the visible take (pause others **or** decode under opacity 0). Picture never stops
7. Assets-stack plant (when that stack is in use): Bolt **gallop video** (`groundY`, `pictureTime` + live rate, contact shadow) + **[light bus](FILM-STACK.md#global-light-bus)** ~10×/s (every ~0.1 s). PathGen = one Imagine ribbon ahead of the paws
8. If L / R FAIL: mid-only live clip + soft-key **cutout** fallback (path keeps scrolling). Prefer recook L / R. Never ship a mid-clip pan as a lane
9. Plate 3+ L/M/R **chart** (empty-plate routes) later. Obstacles `(t, lane)` on the time-rail — city-enter dodge-only must not slow the plate

---

## Play app (bolt-hybrid)

This repo is the **recipe**. The 2.5D app is **not** here.

| Path | Role |
|---|---|
| [bolt-hybrid `play/`](https://github.com/StarBoltSprint/bolt-hybrid/tree/cursor/imagine-25d-recipe-193f/play) | runnable 2.5D Vite app — branch `biome-25d` / recipe branch |
| `play/public/biomes/<id>/films/` | drop cooked plates |
| `play/public/hybrid/run/` | Bolt **gallop video** (old still card retired) |
| `play/src/dom-swap.ts` | vis/hid stitch |
| [bolt-hybrid `game/`](https://github.com/StarBoltSprint/bolt-hybrid/tree/cursor/imagine-25d-recipe-193f/game) | Three.js hybrid proto (mesh + SprintCore) — **different stack**. Do not copy it here. |

```
cd play && npm i && npm run dev
```

Hall player stays https://boltverse-odyssey.grok.me — **do not** publish a new grok.me for 2.5D.

---

## FAIL (recook that plate, do not ship)

- Bolt / dog / silhouette / second animal in the **empty** plate (assets stack)
- Luminous follow-path baked into the **empty** plate / Y-fork / neon sticker / CSS bars sold as PathGen
- PathGen as three always-on neon lanes, or a ribbon that does not form ahead of the paws
- 3-take sold as **one cutout** slid sideways (PRIMARY is three baked takes)
- 3-take ribbon stuck on **mid** when Bolt is L / R
- Canyon / skyline / arrows / décor baked **into** a 3-take (void must stay black; décor is a later plate)
- Tilted road / smaller Bolt / tunnel / mismatched ribbon / desynced gait or loop length (mid is master)
- Lane change = **pan / slide** of the whole mid clip (camera drifts)
- Carousel of **frozen** L / R stills — or L / R that do not `.play()` after `slideChange` (picture stops)
- Cutout shipped as **default** while L / R recooks were not tried (fallback only)
- Chat Imagine UI without `last_frame`
- Imagine Agent video
- `cook-biome.mjs` / `lane:true` (dog baked in)
- `cook-room` / hall portals in the plate
- Camera move / pan / tilt / zoom / dolly
- Plate not 9:16 / not 8–12 s
- Constant per-plate `playbackRate` sold as the match (law is **`rate(t)`**)
- `playbackRate` 2×+ or a **long stretch > 1.6** smashed instead of recook travelling
- Felt speed dump at the joint (playlist forgot the curve / reset to 1.0)
- Bolt legs sped without `pictureTime` + live rate
- Ambient tint / light-bus wrap that greys / blacks the coat, or peach / grey silhouette fill
- Hand-wrap per asset instead of the one light bus
- Hard-key wipe of Bolt low-alpha (kills baked paw dust) / fake CSS splash or debug hitboxes
- Plate-3 cook / L/M/R chart implemented in this script
- Plate N+1 first ≠ plate N last (file)
- New establishing cut instead of stitch
- City-enter plate that slows for obstacles (never-slow lock)
- Dual dogs (plate + gallop layer)
- Reading obstacles from pixels
- Skating gallop layer sold as “Imagine paws”
- Playable Bolt sold as a still 2.5D **card**
- New grok.me / Vite scaffold in **this** repo

Cap 2. FAIL → `biomes-25d/<style>/.kitchen/fail/` then delete from `films/`. Never Hang FAIL on the hall player.

---

## One line

**Hall = dog in the room. COOKLANE = living-film dog in the reel. PRIMARY runner = three synced baked takes. Assets stack = empty reel + planted gallop video.** Style is free. Rails are not. 3-take + light bus + PathGen: [FILM-STACK.md](FILM-STACK.md).

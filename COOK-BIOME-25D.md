# COOK-BIOME-25D — Imagine-only 2.5D biome (any style)

**Cold-start.** No chat history required. Hall / citadel is a **different job**.

Lock: Imagine plates + a playable **2.5D Bolt card**. Not Unreal. Not a 3D mesh requirement. PathGen and obstacles come later as Imagine 2.5D assets — never CSS neon, never pixel CV.

Source lock (SmiR KEEP sprint plate work): [bolt-hybrid `docs/07-imagine-25d-recipe.md`](https://github.com/StarBoltSprint/bolt-hybrid/blob/cursor/imagine-25d-recipe-193f/docs/07-imagine-25d-recipe.md) ([PR](https://github.com/StarBoltSprint/bolt-hybrid/pull/2)).

This repo cooks the plates. The runnable 2.5D **app** is bolt-hybrid `play/` — not this player, not a new grok.me.

---

## Which job (read this first)

| Human says | Job | Page | Script |
|---|---|---|---|
| citadel / salle / hall | hall films (Bolt **in** the stills) | [COOK.md](COOK.md) | `cook-room.mjs` |
| biome / sprint / lane **living-film** | Bolt **baked into** the plate | [COOKLANE.md](COOKLANE.md) | `cook-biome.mjs` |
| **2.5D** / empty plate / Bolt **card** / any-style biome sprint | **this page** | here | `cook-biome-25d.mjs` |

`cook-biome.mjs` **bakes Bolt into the reel** (`lane:true`). Illegal for this stack. Do not call it.

Do not `cook-room`. Do not Hang these plates on https://boltverse-odyssey.grok.me. Do not scaffold a player.

**Any style** = décor / biome *look* is free (ice, ember, city, moss, void, whatever). The rails below are **hard locks**. Paint does not unlock a pan, a path, a dog in the plate, or chat Imagine video.

---

## Stack (Imagine-only)

Engine = **Imagine gamified**: full-frame plates + playable Bolt card + (later) PathGen / obstacles as Imagine 2.5D assets.

| Lock | Value |
|---|---|
| Artists | No paid artists |
| Unreal / mesh | **Not required** |
| Player API keys | None |
| Hall / Citadel | **Separate.** Film / hall grammar. This recipe does not apply there. |

```
[ plate mp4 — full frame, empty ]
        │  never draws Bolt, never draws path
        ▼
[ Bolt card — lower third, planted ]
        │  paws = pivot, X strafe only
        ▼
[ PathGen / obstacles — HOLD / later ]
          Imagine 2.5D assets + (t, lane)
```

1. **Plate behind** — Imagine mp4, full-frame previs. The clip never touches the playable paws.
2. **Bolt** — 2.5D Imagine **card** in front (lower third, back view). Not a 3D mesh requirement.
3. **PathGen** — **HOLD.** Neon CSS sticker is rejected. When revisited: real Imagine 2.5D tiles only.
4. **Obstacles** — later. Imagine 2.5D props + time-rail hits `(t, lane)`. No CV on pixels.

---

## Plate rails (hard locks)

| Rail | Lock |
|---|---|
| Aspect | **9:16** (encode 720×1280) |
| Length | **8–12 s** |
| Camera | **lock-off** (no pan, tilt, zoom, dolly) |
| Travel | sprint travelling **baked in the cook** |
| Path | **ZERO** luminous path in the plate |
| Cast | **ZERO** Bolt / dog in the plate |
| Stitch | plate N+1 **first frame = plate N last frame** |
| Rate | `playbackRate` **~1.0–1.2 only** after a fast cook |

Travel is cooked. Do not fake a pan on a still. Do not run `playbackRate` 2×+ to fake speed.

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

Empty sprint corridor. Travel **baked**. Lock-off. 9:16. 8–12 s.

**ZERO** luminous path. **ZERO** Bolt / dog / shepherd / silhouette.

CLEAR center corridor (the playable lane stays empty — the **card** will sit there).

Hooks send `EMPTY_PLATE_LAW` + the style paint. Adapt décor only. Do not rewrite rails.

> Photoreal vertical 9:16, 720x1280. Locked-off camera. Sprint travelling is ALREADY in the clip (the world rushes toward camera). NEVER pan, tilt, zoom, or dolly. ZERO dogs. ZERO German Shepherds. ZERO animals. ZERO people. ZERO luminous floor paths. ZERO Y-fork. ZERO portals. ZERO HUD. ZERO text. CLEAR empty center corridor. {PAINT}

`{PAINT}` = this style's biome look only.

---

## Plate 2 cook (required example)

Continues from **plate 1 last frame** (`image` + `last_frame`). Same sprint speed. Same rails: **ZERO** path, **ZERO** Bolt.

**Reveal:** futuristic city begins to emerge from haze — distant domes / spires / neon. Keep a **CLEAR** center corridor (playable lane stays empty).

| Keep | Drop |
|---|---|
| Stitch from plate 1 last frame | New establishing shot / cut |
| Sprint travelling at plate 1 speed | Slow-down, still, or 2×+ `playbackRate` |
| City as far haze (domes / spires / neon) | City filling the corridor |
| CLEAR center | Luminous path, Bolt, clutter in the lane |

`{PAINT}` on plate 2 may name the city + this style's grade. Rails do not move.

After plate 2: extract last frame → that file is plate 3 first, if you cook further.

---

## Bolt card (play, not the plate)

The dog is **not** in the mp4. He is a 2.5D Imagine card composited in front.

**Look**

- Lower third
- **Back** view (crown / withers to camera, muzzle hidden)
- Full-white German Shepherd base (white coat forever). Décor-matching skin ON TOP OK. Not a different dog.
- Prefer a flat back-view run cycle
- Warm grade match to the plate when possible

**Plant** (if any missing → skating)

- Pivot at paws / `groundY`
- Strafe **X only**
- Stride from `pictureTime` (plate clock, not a free gait clock)
- Soft contact shadow under the paws

**Skating** = the card is not planted. That is a plant bug. It is not “Imagine bad paws.”

Runnable card + stitch live in bolt-hybrid `play/` (see [Play app](#play-app-bolt-hybrid)). This repo does not ship that app.

---

## PathGen — HOLD

**HOLD.** Do not invent a path this sprint.

Banned: neon CSS sticker, glowing bars, DOM/CSS “lane”, SVG arrows, chrome UI path, luminous Y-fork painted **into the plate**.

When revisited: **only real Imagine 2.5D tiles**. Same empty-plate rails (the tiles are a layer, not a plate bake).

---

## Obstacles — later

Later. Not this cook.

When they land:

- Imagine **2.5D** props (not CSS, not mesh-first)
- Hits on a **time-rail**: `(t, lane)`
- **No** computer vision on video pixels

---

## Play loop order

One thing at a time.

1. **KEEP** one fast empty plate (rails PASS)
2. Erase any neon PathGen overlay
3. Cook plate 2 from plate 1 last frame + stitch — city from haze, sprint speed, CLEAR center, zero path, zero Bolt
4. Plant the Bolt card (`groundY`, `pictureTime`, contact shadow)
5. Later: Imagine PathGen tiles, then obstacles `(t, lane)`

---

## Play app (bolt-hybrid)

This repo is the **recipe**. The 2.5D app is **not** here.

| Path | Role |
|---|---|
| [bolt-hybrid `play/`](https://github.com/StarBoltSprint/bolt-hybrid/tree/cursor/imagine-25d-recipe-193f/play) | runnable 2.5D Vite app — branch `biome-25d` / recipe branch |
| `play/public/biomes/<id>/films/` | drop cooked plates |
| `play/public/hybrid/run/` | Bolt card |
| `play/src/dom-swap.ts` | vis/hid stitch |
| [bolt-hybrid `game/`](https://github.com/StarBoltSprint/bolt-hybrid/tree/cursor/imagine-25d-recipe-193f/game) | Three.js hybrid proto (mesh + SprintCore) — **different stack**. Do not copy it here. |

```
cd play && npm i && npm run dev
```

Hall player stays https://boltverse-odyssey.grok.me — **do not** publish a new grok.me for 2.5D.

---

## FAIL (recook that plate, do not ship)

- Bolt / dog / silhouette / second animal in the plate
- Luminous path / Y-fork / neon sticker / CSS bars in the plate or as “PathGen”
- Chat Imagine UI without `last_frame`
- Imagine Agent video
- `cook-biome.mjs` / `lane:true` (dog baked in)
- `cook-room` / hall portals in the plate
- Camera move / pan / tilt / zoom / dolly
- Plate not 9:16 / not 8–12 s
- `playbackRate` 2×+ to fake sprint
- Plate N+1 first ≠ plate N last (file)
- New establishing cut instead of stitch
- City filling the center corridor
- Dual dogs (plate + card)
- Reading obstacles from pixels
- Skating card sold as “Imagine paws”
- New grok.me / Vite scaffold in **this** repo

Cap 2. FAIL → `biomes-25d/<style>/.kitchen/fail/` then delete from `films/`. Never Hang FAIL on the hall player.

---

## One line

**Hall = dog in the room. COOKLANE = dog in the reel. This page = empty reel + planted card.** Style is free. Rails are not.

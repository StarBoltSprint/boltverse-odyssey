# 36 — GPU zones + Lena procedural (Engine hang note)

**Sealed 2026-09-23 (SmiR Director lock).** Cook / Engine hang. Hang ≠ wipe. Does not recook hung masters. Does not invent a gallop. Does not change a Live URL.

Runtime: [`../scripts/lena-lod/lenaLod.js`](../scripts/lena-lod/lenaLod.js) — `lenaFrame` / `lenaResolve` / `bibFile`.  
Bib cook: [`COLD_START-lena-bib.md`](COLD_START-lena-bib.md)  
Zone paste: [`COLD_START-gpu-zones.md`](COLD_START-gpu-zones.md)  
Kit: [`../scripts/biome-cook/README.md`](../scripts/biome-cook/README.md) — read this **before** empty stills and Video A. Cone math is [`../scripts/howl-live/howlLive.js`](../scripts/howl-live/howlLive.js) (`howlPose`, `pickHowlLane`). Draw the quad like Bolt.

GPU already works for Bolt ([15](15-gpu-compositor.md) · [17](17-live-compositor.md)). This law says **where the next layers sit**. Zones are stacked keyed plates over densify. They are not slices of one densify film.

---

## Dual stack

| | **Rail A — densify (film)** | **Rail B — GPU (layers)** |
|---|---|---|
| What | Continuous plate, first → last | Imagine VIDEO keyed plates, composited **over** densify |
| Pattern | One plate. Identity lock. Camera lock. MAE between plates ([33](33-plate-mae-qc.md)) | Same successful pattern as clean GPU Bolt |
| Cinema | Dodge events baked in the plate (meteors and kin). Dodge-only. | Keyed layers the GPU places |
| Zones | The route itself | Stacked keyed layers |

**Do not chop one densify Video A into spatial GPU tiles.** A tile cut breaks MAE seams, morphs at the edges, drops the camera lock, and reads as a sticker. Densify stays one continuous film. GPU adds layers on top of it.

Rail A dodge cinema stays dodge. A meteor baked in the plate is not a destroyable. Destroyables live on Rail B.

---

## Zone map

Useful zones. Stack order is compositor order. Each zone is its own keyed layer (or the densify plate). None of them is a crop of the densify frame.

| # | Zone | Rail | Rule |
|---|---|---|---|
| 1 | **densify** | A | Route + dodge cinema. Continuous plate. Laws [22-m](22-m-densify-snowball.md) · [28](28-stills-two-rails.md) · [33](33-plate-mae-qc.md) · [35](35-lane-materials.md) before the empty still. |
| 2 | **Bolt** | B | GPU keyed identity lock. Already the KEEP pattern ([10](10-bolt-cutout-law.md) · [15](15-gpu-compositor.md) · [17](17-live-compositor.md)). REUSE `lock/bolt-gallop-cycle.mp4`. |
| 3 | **obstacles / crystals / orbs** | B | Imagine keyed assets. **Placement is procedural.** Anti-sticker ([13b](13b-anti-sticker-contact.md) · [15](15-gpu-compositor.md) · [17](17-live-compositor.md)). Shatter = a **separate plate per object type** ([32](32-howl-gpu-targets.md)). |
| 4 | **Howl** | B | Imagine VIDEO KEEP rings (yellow / blue), GPU composite ([32](32-howl-gpu-targets.md) · [34](34-howl-live-aim.md) · [`../fx/howl/howl-attack.mp4`](../fx/howl/howl-attack.mp4)). Never invent procedural Howl FX. |
| 5 | **sky / vault** (optional) | B | Only as a true keyed parallax / billboard layer. Never a crop of densify. |

---

## Lena — Dr Lena Voss (“How you move”)

Procedural **yes** on Rail B, on spawn, and on LOD. Procedural here means **when and where** a hung Imagine asset appears. It does not mean inventing the look in code.

- **Meaningful Sprint** densifies the world via `m` ([22-m](22-m-densify-snowball.md)). Success adds a detail. Miss drops one tier. Picture is the clock.
- **Smart Preload** when the sprint climbs. The next plate and the next keyed layer are ready before the paws arrive.
- **Procedural Spawn** in front of the paws. Seed + timing. The asset stays a high-quality Imagine keyed plate. Call `lenaFrame`.
- **Paw-to-Galaxy LOD** — earth → near space → deep space (`worldLod`). On the cone, far / mid / near pick `generator` / `detail` / `rock`, and `preloadOf` warms the next file before the swap. Journey and path: [18](18-room-starmap-lena.md) · [19](19-luminous-path-climb.md) · [21](21-paw-to-galaxy.md). Bib names: [`COLD_START-lena-bib.md`](COLD_START-lena-bib.md).
- **Howl targets column** — procedural crystals now. Later: ship / mech. Those targets are destroyable by Howl. Plate-baked events stay dodge-only (Rail A, law [25](25-hazard-cone.md)).
- **Path beat** — the chemin reveals one lane ~3 s ahead of contact so the player can SIDES. Same cone. Densify stays this plate. Law [37](37-path-beat.md). LOD fills the world; the path beat tells which lane to be in.

Cold Groks, roles so the names stay distinct:

| Name | Owns |
|---|---|
| **Dr Lena Voss** | How you move. Spawn, preload, LOD, Rail B placement. |
| **Path beat** | Which lane, and when. Reveal ~3 s ahead. Hit / miss at contact. Law [37](37-path-beat.md). |
| **Marcus** | Resonance / `m` grade. |
| **Priya** | Quest / why. |
| **Elena** | Pack / rifts. |

---

## BAN

These are **FAIL**:

- Chopping one densify Video A into GPU spatial tiles
- Baking destroyables or Howl into densify plates
- Procedural invent of the Howl look (rings must be the Imagine KEEP)
- Sticker spawn with no anti-sticker contact law ([13b](13b-anti-sticker-contact.md))
- Hanging a Build conversation URL or a share link. A play URL, when one is hung at all, is Live only. This note adds none.

---

## Cook hygiene (secondary)

Film-strip Imagine canvas: one column per plate (P0, P4, …). Pin Bolt + vault + lane refs in the column header. Short FRAME prompts. First still + last still before Video A. Build hangs Live / code **after** KEEP. Build does not drive the Imagine session first+last.

---

## What Grok does

1. Read this law **before** the empty still and before Video A.
2. Cook Rail A as one continuous densify plate. Lane material first ([35](35-lane-materials.md)). Dodge cinema stays in the plate.
3. Composite Rail B as keyed layers on the GPU rails Bolt already uses. Placement is `lenaFrame`. Pixels stay Imagine bibs from `bibFile`.
4. Lena owns spawn / preload / LOD timing. Marcus / Priya / Elena stay on their columns above.
5. Hang ≠ wipe. ADD plates. Do not wipe masters. Do not invent a gallop. Do not invent a Howl.

## FAIL

- Spatial GPU tiles cut from one densify plate
- A destroyable or a Howl baked into `road-<biome>*.mp4`
- A shader, laser, or code-drawn Howl
- A keyed spawn with no plate bounce and no contact
- A sky/vault layer that is a cropped densify frame
- A new play URL, Build `/c/` link, or `grok.com/share` hung from this note

Related: [15](15-gpu-compositor.md) · [17](17-live-compositor.md) · [32](32-howl-gpu-targets.md) · [34](34-howl-live-aim.md) · [18](18-room-starmap-lena.md) · [19](19-luminous-path-climb.md) · [21](21-paw-to-galaxy.md) · [22-m](22-m-densify-snowball.md) · [25](25-hazard-cone.md) · [28](28-stills-two-rails.md) · [33](33-plate-mae-qc.md) · [35](35-lane-materials.md) · [37](37-path-beat.md) (chemin ~3 s ahead; densify stays this loop) · runtime [`../scripts/lena-lod/lenaLod.js`](../scripts/lena-lod/lenaLod.js) · path beat [`../scripts/path-beat/pathBeat.js`](../scripts/path-beat/pathBeat.js) · paste [`COLD_START-gpu-zones.md`](COLD_START-gpu-zones.md) · bib [`COLD_START-lena-bib.md`](COLD_START-lena-bib.md) · path [`COLD_START-path-beat.md`](COLD_START-path-beat.md)

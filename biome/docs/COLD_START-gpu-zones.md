# COLD START — GPU zones + Lena procedural (paste before empty stills / Video A)

Read `biome/docs/36-gpu-zones-lena-procedural.md`. Runtime: `biome/scripts/lena-lod/lenaLod.js` (`lenaFrame`). Bib cook: `biome/docs/COLD_START-lena-bib.md`. Hang ≠ wipe. No new play URL.

**Rail A densify (film):** one continuous plate, first → last. Dodge cinema (meteors and kin) is baked in the plate and stays dodge-only. Identity lock. Camera lock. MAE between plates. Do not chop that plate into spatial GPU tiles (MAE seams, edge morph, camera lock, sticker look).

**Rail B GPU (layers):** Imagine VIDEO keyed plates composited over densify — the same pattern as clean GPU Bolt. Zones are stacked keyed layers.

| Zone | Rule |
|---|---|
| densify | Route + dodge cinema (Rail A) |
| Bolt | GPU keyed identity lock (KEEP pattern) |
| obstacles / crystals / orbs | Imagine keyed assets. Placement procedural. Anti-sticker. Shatter = a separate plate per object type |
| Howl | Imagine VIDEO KEEP rings (yellow / blue), GPU composite. Never invent procedural Howl FX |
| sky / vault (optional) | True keyed parallax / billboard only. Never a crop of densify |

**Dr Lena Voss (“How you move”)** — procedural on Rail B / spawn / LOD. Timing and placement only. Look stays Imagine keyed.

- Meaningful Sprint densifies the world via `m`
- Smart Preload when the sprint climbs
- Procedural Spawn in front of the paws (seed + timing)
- Paw-to-Galaxy LOD: earth → near space → deep space (`18` / `19` / `21`)
- Howl targets: procedural crystals now; later ship / mech. Destroyable by Howl. Plate-baked events stay dodge-only

Marcus = resonance / `m` grade. Priya = quest / why. Elena = Pack / rifts.

**BAN:** densify cut into GPU spatial tiles · destroyables or Howl baked into densify · procedural Howl look · sticker spawn without anti-sticker contact · Build / share conversation URLs. **GPU is REQUIRED.** **FAIL if Build paints the path into Video A** (or a lane target, a generator, or a Lena detail). Those are keyed GPU layers over the clean densify loop.

**Path beat (law 37):** the chemin reveals one lane ~3 s ahead of contact on this same cone. Densify stays the loop above. LOD fills the world; `pathBeatFrame` tells which lane to be in. Read `biome/docs/37-path-beat.md`. Paste `biome/docs/COLD_START-path-beat.md`. Runtime: `biome/scripts/path-beat/pathBeat.js`.

**Light layers + openables (law 38):** playable lights and doors, chests, generators, and hatches are keyed GPU layers on this same cone. Imagine cooks light-only plates and closed/open/transition bibs. GPU owns intensity, tint, hit, and open/close. Do not bake them into Video A. Plate zones are `road` | `sideL` | `sideR`. Road lanes hold the path beat, Howl hits, and critical openables. Shoulders (calm void / berms) may hold décor LOD, light layers, openables, and generators — same cone, `gradeFromPlate`, GPU over densify. Keep densify sides relatively empty. FAIL if side clutter is baked into Video A. `lenaFrame` takes `plateZone`. Read `biome/docs/38-gpu-light-openable.md`. Paste `biome/docs/COLD_START-gpu-light-openable.md`. Runtime: `biome/scripts/gpu-light/gpuLight.js` (`lightLayerFrame`) · `biome/scripts/gpu-openable/gpuOpenable.js` (`openableFrame`).

Film-strip (short): one column per plate, Bolt + vault + lane refs in the header, short FRAME prompts, first + last before Video A. Build hangs Live / code after KEEP.

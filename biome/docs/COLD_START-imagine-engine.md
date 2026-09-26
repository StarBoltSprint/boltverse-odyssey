# COLD START — Imagine Engine (any biome)

A **playable biome composite** (lane slide, glance, wings, foes, howl, any paint) pastes [`COLD_START-biome-method.md`](COLD_START-biome-method.md) first. This file stays the densify and Imagine Live keyed-prop paste (laws 39–42). It overrides older gates that still hang still-bib LOD or path-beat cards.

Read GitHub `main` first:

1. `biome/docs/00-PRIORITY0-any-biome.md`
2. `biome/docs/35-lane-materials.md`
3. `biome/docs/39-imagine-live-light.md`
4. `biome/docs/40-nebula-cycle.md` — cycle pattern optional
5. `biome/docs/41-eclipse-look.md` — optional look biome only
6. Cook kit: `biome/docs/COLD_START-biome-cook.md` · `biome/scripts/biome-cook/README.md`

## HARD OVERRIDE (proven Nebula Lane)

- Lane / destroyable / dodge props = **Imagine Video** filmed in the plate's three colors, pure black, clean luma key (`uClean`), **no regrade**. Same path as Bolt. Law 39. Runtime numbers: `biome/scripts/imagine-live/imagineLive.js`.
- **BAN** still / sprite / bib-grade LOD for lane props (law 36 still-bib path for crystals/fern/rock on lanes = FAIL). Law 36 GPU zones still OK for *architecture* (layers over densify, not tiles) but props that must look like Bolt use **39**, not still LOD.
- **BAN** path-beat grey/beige **rectangles** as obstacles or reveal UI (Nebula FAIL). Path beat law 37 may still exist as *in-world light/form* later — do not draw opaque rect cards. Prefer crystal (howl destroy) + globule (SIDES dodge) pattern; arcs HOLD unless width matches one lane.
- Densify = Rail A continuous plate (session first+last). GPU = Rail B. Never bake Bolt / howl / openables into densify.
- Howl: Imagine ring in plate colors; tap crystal fires howl; howl stops on contact; `howlFireSec ≈ 0.28`.
- Optional multi-biome cycle: 30 s hold + ~3.2 s fade; continue from last frame; trim slow head (law 40).
- Optional eclipse look: drag yaw ONLY on that biome (law 41).

## Fixed

- REUSE Bolt cycle `lock/bolt-gallop-cycle.mp4` (6 s / 96 fps / 534 / green / rear). Never invent a gallop. Never `lock/bolt-gallop-cycle-0.93s-prev.mp4`.
- GPU compositor law 17. `GPU_VER` 24. Copy `biome/scripts/bolt-key-gl/bolt-key-gl.ts` + `wet-fx.ts`. Quad dest. Luma protect. No scissor. No IGN bars.
- Hang the existing play URL only: `https://boltverse-odysseyyyy.grok.me`. Hang ≠ wipe. No new grok.me.

## Order

lane material → empty stills law 20 → Video A first+last → geo/hazard/mae QC → GPU Bolt → Imagine Live props (39) → howl aim → hang.

## FAIL

- still props with plate grade
- grey shadow cards
- path rectangles
- one-still I2V
- invent gallop
- bake dog into road
- Magpie full-frame regen
- claim PASS without QC scripts

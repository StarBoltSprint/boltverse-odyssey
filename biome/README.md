# biome — Sprint / lane recipe (lives under odyssey/biome)

**This folder is the lane-recipe tree.** Citadel halls stay at the repo root (`cook-room`, `packs/`, `stock/citadel`).

[`StarBoltSprint/bolt-lane-recipe`](https://github.com/StarBoltSprint/bolt-lane-recipe) may remain as a private **mirror / archive**. Cook biome **here**.

This folder is a **recipe**, not an app. Do **not** scaffold a new grok.me. Play = native Grok Build game console (in-app). Kitchen Live stays https://boltverse-odysseyyyy.grok.me (`VER = r38`). Never open old three-y `boltverse-odysseyyy.grok.me` as Beat 3 Sprint (superseded — do not open it for boot).

**Play / Live KEEP:** https://boltboltverse-odyssey.grok.me

**HARD BAN — no improvised boot prose.** *play / lance* player text = locked Welcome/Return only ([../START.md](../START.md) / [../GROK.md](../GROK.md)). Ban: control tutorials · « world is rolling » · « plant a lane » · film-keeps-moving essays. This folder is kitchen.

**HARD LOCK — Hang ≠ wipe.** New biome = ADD `road-<biome>*.mp4` + plates-index / dealer entries. KEEP canyon→cars→duel→night→war. NEVER `rm` hung masters. Law: [docs/09-recette-biome.md](docs/09-recette-biome.md).

**START HERE (biome cook):** [scripts/biome-cook/README.md](scripts/biome-cook/README.md) · paste [docs/COLD_START-biome-cook.md](docs/COLD_START-biome-cook.md).

**HARD LOCK — Chat biome catalog (on ask).** **what biomes** / **which runs** / **what can I play** → hung chapters only (never invent). `play canyon` / `only Tide`. Never on Welcome. No chrome picker. Hang grows the list; wipe shrinks it = FAIL.

## Engine lock (read PLAY first)

**[PLAY.md](PLAY.md)** is the law:

- **B stack** = road (empty plate) + Bolt **cutout** (gallop video). Two living `<video>`s. One canvas.
- **Key** = Vlahos chroma + crown sat kill + 1px feather. Not luma. [docs/05-key.md](docs/05-key.md)
- **Plant** = canvas X only (`SHIFT = 30`). Dual road hold — no black flash.
- **loop forever** — `muted playsInline autoPlay` + watchdog.
- **No wallet / keys** in the player.
- **No 3-take L / M / R as default.**
- **r38** — [reference/LanePlayer.tsx](reference/LanePlayer.tsx). Cookbook: [docs/06-techniques.md](docs/06-techniques.md).

## Map

| path | what |
|---|---|
| [PLAY.md](PLAY.md) | B-stack engine locks |
| [CONSOLE.md](CONSOLE.md) | Grok = console, Sprint = in-app Play |
| [GROK.md](GROK.md) | kitchen — how to cook empty plate + cutout |
| [docs/01-images.md](docs/01-images.md) | stills: empty plate + Bolt mid |
| [docs/02-videos.md](docs/02-videos.md) | films: first+last, never Agent video |
| [docs/03-decoupe-swipe.md](docs/03-decoupe-swipe.md) | swipe = plant the cutout on X |
| [docs/04-play.md](docs/04-play.md) | LanePlayer + `/master` stack |
| [docs/05-key.md](docs/05-key.md) | chroma + crown (not luma) |
| [docs/06-techniques.md](docs/06-techniques.md) | **what actually worked** (and what we killed) |
| [docs/07-pack-live.md](docs/07-pack-live.md) | gate `sub` → registry (TEMPORARY Pack API = `https://boltverse-pack.vercel.app`, not `*.grok.me`) |
| [docs/08-plate-speed.md](docs/08-plate-speed.md) | measure + warp cousin rush to the empty clock |
| [docs/09-recette-biome.md](docs/09-recette-biome.md) | **full biome cook** — empty → cousin → speed → dealer → box |
| [docs/10-bolt-cutout-law.md](docs/10-bolt-cutout-law.md) | **HARD Bolt cutout** — **REUSE** [`lock/bolt-gallop-cycle.mp4`](../lock/bolt-gallop-cycle.mp4); key + despill + composite. Do not invent a sprint. |
| [docs/11-plate-order.md](docs/11-plate-order.md) | **HARD LOCK dealer playlist** — canyon → cars → duel → night → war. New biome = new entries. Hang ≠ wipe. |
| [docs/12-lane-path-ribbon.md](docs/12-lane-path-ribbon.md) | **HARD living-film Lane control** — empty road + Bolt cutout + `path.json` ribbon. Without the chart = film. With it = game. Not SprintCore / Nebula editor. |
| [docs/12b-adaptive-curvature.md](docs/12b-adaptive-curvature.md) | Cook-time table placement — adapt samples on turns (not clicks). Clock still \(\ell\). Sibling of 12. |
| [docs/13-make-bolt-lane.md](docs/13-make-bolt-lane.md) | **HARD — make controllable Bolt on a Lane** — product brief / order of work. Not the ribbon sampling essay (12 + 12b). |
| [docs/13b-anti-sticker-contact.md](docs/13b-anti-sticker-contact.md) | Compositor anti-sticker + contact shadow. Sibling of 13. Not Imagine bake. |
| [docs/13c-green-despill.md](docs/13c-green-despill.md) | Green key + vector despill factory. Sibling of 13 / 13b. Not the road plate. |
| [docs/13d-auto-scale.md](docs/13d-auto-scale.md) | Auto-scale Bolt from the road — `computeScale` / `assertScale`. Grok must not pick size by eye. |
| [docs/14-rotary-gallop.md](docs/14-rotary-gallop.md) | Rotary gallop + ribbon turn. Sibling of 13. **REUSE** sealed [`lock/bolt-gallop-cycle.mp4`](../lock/bolt-gallop-cycle.mp4); hard-cut seam. |
| [docs/14c-gallop-clock.md](docs/14c-gallop-clock.md) | Gallop clock anti-saccadé — native 96 fps, `CYCLE_FRAMES=534`, phase from `plate_time`, `assertGallopClock`. |
| [docs/15-gpu-compositor.md](docs/15-gpu-compositor.md) | **GPU compositor** — WebGL; hung [`scripts/bolt-key-gl/bolt-key-gl.ts`](scripts/bolt-key-gl/bolt-key-gl.ts); canon 6 s / 534-frame cycle; FX table drawn in this family; ban `getImageData` hot path. |
| [docs/16-biome-ground-fx.md](docs/16-biome-ground-fx.md) | **Biome ground FX + grade** — paw prints / splash / dust per `{PAINT}`. Frost-parity for any biome. |
| [docs/17-live-compositor.md](docs/17-live-compositor.md) | **Live compositor** — what actually stuck Bolt: quad dest, luma protect, plate bounce, sin grain, rVFC, FX quads. FAIL = old scissor/IGN sketch. |
| [docs/00-PRIORITY0-any-biome.md](docs/00-PRIORITY0-any-biome.md) | **PRIORITY 0 any biome** — GPU + sealed 6 s + FX table. Frost-parity for a cold Grok / random player. |
| [docs/COLD_START-any-biome.md](docs/COLD_START-any-biome.md) | Kitchen paste — cook **any** biome (supersedes COLD_START-gpu-6s as the cook paste). |
| [docs/COLD_START-gpu-6s.md](docs/COLD_START-gpu-6s.md) | Kitchen note — REUSE 6s lock + GPU law 15. Cook paste superseded by [COLD_START-any-biome.md](docs/COLD_START-any-biome.md). |
| [docs/18-room-starmap-lena.md](docs/18-room-starmap-lena.md) | **Player journey** — room star map → constellation → seal → door → biome → Lena climb → sealed planet. |
| [docs/COLD_START-room-starmap.md](docs/COLD_START-room-starmap.md) | Kitchen paste — room + star map + Lena climb (read 18 first). |
| [docs/19-luminous-path-climb.md](docs/19-luminous-path-climb.md) | **Lena climb** — luminous 3-lane path under Bolt (not float). Same L/C/R + REUSE 6s. |
| [docs/COLD_START-luminous-path.md](docs/COLD_START-luminous-path.md) | Kitchen paste — luminous path climb (read 19 first). |
| [docs/20-default-plate-proportions.md](docs/20-default-plate-proportions.md) | **Default empty-still skeleton** — full measure set (frame + scale + GPU start), any biome. φ audit only. Player may override. |
| [docs/35-lane-materials.md](docs/35-lane-materials.md) | **Lane materials** — Pack menu A–D before P0 stills. Ban grey concrete as the silent default. |
| [docs/COLD_START-lane-materials.md](docs/COLD_START-lane-materials.md) | Kitchen paste — law 35. |
| [docs/36-gpu-zones-lena-procedural.md](docs/36-gpu-zones-lena-procedural.md) | **GPU zones + Lena procedural** — keyed layers over densify. Do not tile one densify plate. |
| [docs/COLD_START-gpu-zones.md](docs/COLD_START-gpu-zones.md) | Kitchen paste — law 36. |
| [docs/COLD_START-lena-bib.md](docs/COLD_START-lena-bib.md) | Bib cook — Imagine keyed LODs, then `lenaFrame`. |
| [scripts/lena-lod/lenaLod.js](scripts/lena-lod/lenaLod.js) | **Lena runtime** — far/mid/near bands, procedural spawn on the Howl cone. |
| [docs/20b-frost-aurora-proportions.md](docs/20b-frost-aurora-proportions.md) | Frost aurora KEEP numbers (worked example of law 20). |
| [docs/COLD_START-frost-aurora.md](docs/COLD_START-frost-aurora.md) | Kitchen paste — hang Frost aurora beside Beat (read 20 then 20b). |
| [docs/21-paw-to-galaxy.md](docs/21-paw-to-galaxy.md) | **Paw-to-Galaxy climb** — incline degrees, duration, space look-around, camera bans. |
| [docs/COLD_START-paw-to-galaxy.md](docs/COLD_START-paw-to-galaxy.md) | Kitchen paste — Paw-to-Galaxy climb (read 21 first). |
| [docs/22-m-densify-snowball.md](docs/22-m-densify-snowball.md) | **m densify snowball** — same-biome base plate + cumulative Imagine `@` refs (≤12). Success keeps prior refs; miss drops one tier. |
| [docs/COLD_START-m-densify.md](docs/COLD_START-m-densify.md) | Kitchen paste — m densify snowball (read 22-m-densify first). |
| [docs/23-plate-geo-qc.md](docs/23-plate-geo-qc.md) | **Plate geometric QC** — 1-point, lock-off, sag. PASS before hang. |
| [docs/COLD_START-geo-qc.md](docs/COLD_START-geo-qc.md) | Kitchen paste — law 23. |
| [docs/24-camera-1point.md](docs/24-camera-1point.md) | **Sprint camera** — conical 1-point lock-off. |
| [docs/COLD_START-camera.md](docs/COLD_START-camera.md) | Kitchen paste — law 24. |
| [docs/25-hazard-cone.md](docs/25-hazard-cone.md) | **Hazard on the cone** — rail A dodge events, 1–2 lanes, not destroyable. |
| [docs/COLD_START-hazard.md](docs/COLD_START-hazard.md) | Kitchen paste — law 25. |
| [docs/26-biome-sprint-plan.md](docs/26-biome-sprint-plan.md) | **10-plate sprint plan** before d1. Includes GPU Howl target column (law 32). |
| [docs/26b-frost-sprint-plan.md](docs/26b-frost-sprint-plan.md) | Frost worked example. GPU Howl cells stay —. |
| [docs/COLD_START-sprint-plan.md](docs/COLD_START-sprint-plan.md) | Kitchen paste — law 26. |
| [docs/plans/frost-sprint.md](docs/plans/frost-sprint.md) | Frost plan a cold Grok executes. |
| [docs/plans/prismwake-sprint.md](docs/plans/prismwake-sprint.md) | Prismwake plan. GPU Howl targets named (quartz / prism / storm). |
| [docs/COLD_START-prismwake.md](docs/COLD_START-prismwake.md) | Kitchen paste — Prismwake. |
| [docs/27-native-road-slide.md](docs/27-native-road-slide.md) | Optional native road-slide catalog. Not the default cook. |
| [docs/28-stills-two-rails.md](docs/28-stills-two-rails.md) | **Stills two rails** — décor snowballs, events swap. |
| [docs/COLD_START-stills-two-rails.md](docs/COLD_START-stills-two-rails.md) | Kitchen paste — laws 28–31. |
| [docs/29-imagine-compiler.md](docs/29-imagine-compiler.md) | Imagine bakes the world. It does not play it. Seam = law 33. |
| [docs/30-i2i-prompt.md](docs/30-i2i-prompt.md) | i2i prompt — numbered refs, one delta. |
| [docs/31-light-lock.md](docs/31-light-lock.md) | **Light lock** — persistent vs event. Seam WB / road luma = law 33. |
| [docs/32-howl-gpu-targets.md](docs/32-howl-gpu-targets.md) | **Howl GPU targets** — rail A dodge vs rail B keyed destroyables. Shatter per type. Howl = Imagine VIDEO. |
| [docs/COLD_START-howl-gpu.md](docs/COLD_START-howl-gpu.md) | Kitchen paste — law 32. |
| [fx/howl/howl-attack.mp4](fx/howl/howl-attack.mp4) | **Howl attack KEEP** (SmiR). Vertical rings, birth narrow → wider, locked cam, black key, no shatter. [fx/howl/README.md](fx/howl/README.md). |
| [docs/33-plate-mae-qc.md](docs/33-plate-mae-qc.md) | **Plate seam MAE** — last frame N vs first N+1. Exit non-zero = FAIL. |
| [docs/COLD_START-plate-mae.md](docs/COLD_START-plate-mae.md) | Kitchen paste — law 33. |
| [scripts/plate-geo-qc/](scripts/plate-geo-qc/) | Law 23 judge — `plate-geo-qc.py`. |
| [scripts/plate-hazard-qc/](scripts/plate-hazard-qc/) | Law 25 judge — `plate-hazard-qc.py`. |
| [scripts/plate-mae-qc/](scripts/plate-mae-qc/) | Law 33 judge — `plate-mae-qc.py`. |
| [scripts/curvature-sample/](scripts/curvature-sample/) | Cook-time adaptive resample — `node demo.js`; `resamplePath` → write `path.json`. Not play LanePlayer. |
| [scripts/chroma-despill/](scripts/chroma-despill/) | Cook-time vector despill — `node demo.js`; `vectorDespill` after key, before grade. Not play LanePlayer. |
| [scripts/bolt-scale/](scripts/bolt-scale/) | Cook-time Bolt auto-scale — `node demo.js`; `computeScale` / `assertScale` from lane width. |
| [scripts/gallop-clock/](scripts/gallop-clock/) | Cook/play gallop clock — `node demo.js`; native 96 fps, no 1-of-N stepping. |
| [scripts/bolt-key-gl/](scripts/bolt-key-gl/) | **GPU compositor (law 15+17)** — [`bolt-key-gl.ts`](scripts/bolt-key-gl/bolt-key-gl.ts) + [`wet-fx.ts`](scripts/bolt-key-gl/wet-fx.ts) + [`WIRE.md`](scripts/bolt-key-gl/WIRE.md). Quad dest, bounce, luma protect. **FAIL** = scissor/IGN sketch. |
| [prompts/](prompts/) | Imagine paste blocks (swap `{PAINT}` only) |
| [reference/LanePlayer.tsx](reference/LanePlayer.tsx) | r38 compositor (not a grok.me) |
| [reference/lane-css.css](reference/lane-css.css) | 9:16 B-stack CSS |
| [master/README.md](master/README.md) | hung road + cutout master |
| [master/ASSETS.md](master/ASSETS.md) | Pack `assetId` pointer — law SoT on registry; do not invent local ids |
| [../client/pack.js](../client/pack.js) | Pack client floor — `BOLTVERSE_PACK_ORIGIN` = `https://boltverse-pack.vercel.app` (TEMPORARY) |
| [stock/biome/](../stock/biome/README.md) | optional archive (`preview-loop.mp4`) — **not attached at boot** |

Citadel cook is unchanged: [../COOKROOM.md](../COOKROOM.md) · [../AGENTS.md](../AGENTS.md).

## Happy path (biome cook)

Kitchen — do not read aloud. biome / Sprint cook / lane / B-stack / green-screen / chroma → **MUST read this order before cooking:**

```
# 1. biome/PLAY.md
# 2. biome/docs/06-techniques.md   ← what worked r38 (Sprint cook bible)
# 3. biome/docs/09-recette-biome.md ← empty + cousin + speed + box (do this)
# 4. biome/docs/10-bolt-cutout-law.md ← HARD Bolt cutout (REUSE lock/bolt-gallop-cycle.mp4 → key + composite)
# 5. biome/docs/11-plate-order.md ← HARD LOCK dealer playlist (canyon → cars → duel → night → war)
# 6. biome/docs/05-key.md
# 7. biome/reference/LanePlayer.tsx
# 8. biome/docs/12-lane-path-ribbon.md ← living-film Lane path.json (not SprintCore)
# 9. biome/docs/13-make-bolt-lane.md ← make controllable Bolt on a Lane (product brief)
#    biome/docs/13b-anti-sticker-contact.md ← compositor anti-sticker + contact shadow
#    biome/docs/13c-green-despill.md ← green key + despill factory
#    biome/docs/13d-auto-scale.md ← auto-scale from the road (computeScale / assertScale)
#    biome/docs/14-rotary-gallop.md ← rotary gallop + ribbon turn
#    biome/docs/14c-gallop-clock.md ← gallop-clock anti-saccadé (assertGallopClock)
#    biome/docs/15-gpu-compositor.md ← GPU compositor (bolt-key-gl.ts; ban getImageData)
#    biome/docs/16-biome-ground-fx.md ← biome-adaptive ground FX + grade
#    biome/docs/17-live-compositor.md ← Live GPU (bounce / protect / sin grain / FX quads)
#    biome/docs/00-PRIORITY0-any-biome.md ← Frost-parity for ANY biome (cold Grok)
#    biome/docs/COLD_START-any-biome.md ← cook paste (supersedes COLD_START-gpu-6s)
#    biome/docs/18-room-starmap-lena.md ← player journey (room star map → seal → door → biome → Lena)
#    biome/docs/COLD_START-room-starmap.md ← kitchen paste for that journey
#    biome/docs/19-luminous-path-climb.md ← Lena climb = luminous 3-lane path (not float)
#    biome/docs/COLD_START-luminous-path.md ← kitchen paste for the climb path
#    biome/docs/20-default-plate-proportions.md ← empty still defaults (ANY biome)
#    biome/docs/35-lane-materials.md ← lane material menu before P0 stills (not asphalt)
#    biome/docs/COLD_START-lane-materials.md
#    biome/docs/36-gpu-zones-lena-procedural.md ← GPU zones = keyed layers over densify (not tiles)
#    biome/docs/COLD_START-gpu-zones.md
#    biome/docs/20b-frost-aurora-proportions.md ← Frost aurora KEEP numbers
#    biome/docs/21-paw-to-galaxy.md ← Paw-to-Galaxy incline / duration / space look
#    biome/docs/COLD_START-paw-to-galaxy.md ← kitchen paste for law 21
#    biome/docs/22-m-densify-snowball.md ← same-biome m densify snowball refs (≤12)
#    biome/docs/COLD_START-m-densify.md ← kitchen paste for m densify
#    biome/docs/23-plate-geo-qc.md ← geometric judge before hang
#    biome/docs/COLD_START-geo-qc.md
#    biome/docs/24-camera-1point.md ← conical 1-point lock-off
#    biome/docs/COLD_START-camera.md
#    biome/docs/25-hazard-cone.md ← rail A dodge (not destroyable)
#    biome/docs/COLD_START-hazard.md
#    biome/docs/26-biome-sprint-plan.md ← 10-plate plan + GPU Howl column
#    biome/docs/COLD_START-sprint-plan.md
#    biome/docs/27-native-road-slide.md ← optional catalog, not the default
#    biome/docs/28-stills-two-rails.md ← décor snowballs, events swap
#    biome/docs/COLD_START-stills-two-rails.md
#    biome/docs/29-imagine-compiler.md
#    biome/docs/30-i2i-prompt.md
#    biome/docs/31-light-lock.md
#    biome/docs/32-howl-gpu-targets.md ← rail B keyed Howl targets + Imagine VIDEO Howl
#    biome/docs/COLD_START-howl-gpu.md
#    biome/fx/howl/howl-attack.mp4 ← SmiR KEEP Howl attack (REUSE; do not recook)
#    biome/docs/33-plate-mae-qc.md ← last N vs first N+1, exit non-zero = FAIL
#    biome/docs/COLD_START-plate-mae.md
# then biome/GROK.md

# stills + films = Imagine Video first+last (session primary; optional CLI when XAI_API_KEY is set)
# drop masters into biome/master/   ← ADD. NEVER wipe hung canyon/war. Hang ≠ wipe.
```

Video A does not wait on `node` or `XAI_API_KEY`. Pin both stills in the SuperGrok session, hang the mp4, run `plate-mae-qc.py`. One-still I2V does not Hang. Missing key is not a stop.

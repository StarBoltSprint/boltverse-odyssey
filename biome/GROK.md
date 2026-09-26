# GROK — biome / Sprint cook (kitchen)

**START HERE:** a playable biome composite (any paint) pastes [`docs/COLD_START-biome-method.md`](docs/COLD_START-biome-method.md) first. Obey the **FAIL / HARD** block at the top of that paste. The world is Imagine videos used as assets. No other language or engine builds the world. Three.js, Babylon, Unity, Unreal-as-world, Vite/TS, raw WebGL meshes, or a procedural shader scene with no Imagine mp4s is FAIL (Velum-class). The player is Bolt, the StarBoltSprint dog already on this GitHub. Use the sealed GPU Bolt (`lock/bolt-gallop-cycle.mp4`). Do not invent a player craft. A manta, ray, ship, or mesh hero is FAIL (Velum manta-class). Details (rocks, ruins, vapor, crystals, path dressing, terrain relief dressing, vegetation dressing beyond the sealed herbe/arbres cook) are also Imagine Video — cooked plates or keyed layers over densify/sol/ciel. Mesh or live procedural generators for path, terrain, vegetation, ruins, or details (old Three.js PathGenerator / Terrain / Detail class) are FAIL. Simplex placement of already-cooked herbe/arbres stays. Simplex (and placement noise) places already-cooked Imagine assets only. It does not draw the world. Drawing is Imagine Video. Noise that paints terrain, relief, or details is FAIL. GPU only composites keyed layers over those videos. No playable hang until the mp4s exist and play. That paste holds both world cooks: **A** road densify (one continuous Imagine plate, law 20) and **B** forest / open ground (law 43 — black, four skies, one ground tile, horizon, GPU trees and Bolt). Densify / QC order for a road stays [`scripts/biome-cook/README.md`](scripts/biome-cook/README.md) · [`docs/COLD_START-biome-cook.md`](docs/COLD_START-biome-cook.md). Imagine Live keyed props stay [`docs/COLD_START-imagine-engine.md`](docs/COLD_START-imagine-engine.md) (laws 39–42). Law 44 is the Imagine volume stack on open ground ([docs/44-imagine-volume-stack.md](docs/44-imagine-volume-stack.md)): collision capsule and look parallax on the existing spawn rows. Do not invent a second law 43 or a second volume law.

Repo: `https://github.com/StarBoltSprint/boltverse-odyssey`  
**This folder** = Biome / Sprint lane recipe. Citadel halls = repo root.

Hung / Live (kitchen only): https://boltverse-odysseyyyy.grok.me  
Do **not** paste that URL in a player reply. Never open old three-y `boltverse-odysseyyy.grok.me` as Beat 3 Sprint (superseded — do not open it for boot).

**STOP — HARD SPLIT.** Imagine Agent is obligatoire for STYLE stills when restyling. **NEVER** for Sprint films, empty-plate travel, cutout gallop, or any video. Films = imagine-hooks first-frame + last-frame. Soft KEEP banned.

**PRIORITY 0 TEACHER GATE** — before ANY Bolt still / clip / cook for a biome:
1. Open [`lock/bolt-back.jpg`](../lock/bolt-back.jpg) **or** [`biome/lock/bolt-back.jpg`](lock/bolt-back.jpg) (same bytes — either path OK).
2. **Attach / show that exact image in the Build chat** so the session has the pixels.
3. Then **@ref** it on every Bolt Imagine call.
4. If the teacher is not shown → **STOP. No cook. FAIL.**
5. Soft KEEP banned without teacher proof.

`STEP 0: attach lock/bolt-back.jpg (or biome/lock/bolt-back.jpg) in chat before cooking Bolt.`

**PRIORITY 0 — Bolt sprint for new biomes = REUSE, not invent.**
A fresh Grok in a new Build convo must **NOT** cook a new Bolt gallop from scratch (no new Imagine dog sprint). Pipeline is:
1. Empty road plate only (Video A) — biome décor, no dog.
2. Take sealed [`lock/bolt-gallop-cycle.mp4`](../lock/bolt-gallop-cycle.mp4) as the Bolt motion asset (**CANON ~5.56 s / 534 frames / 96 fps** — already rear / green / rotary). Same bytes as `lock/bolt-gallop-cycle-96fps-loop6s.mp4`. Play: `loop=true`, rate **1×**. Never seek every frame. Never cache 534 canvases. Old `lock/bolt-gallop-cycle-0.93s-prev.mp4` (89-frame) = **ARCHIVE only — FAIL if used as play cycle**. Law: [docs/15-gpu-compositor.md](docs/15-gpu-compositor.md) · any-biome [docs/00-PRIORITY0-any-biome.md](docs/00-PRIORITY0-any-biome.md) · paste [docs/COLD_START-any-biome.md](docs/COLD_START-any-biome.md) (supersedes [COLD_START-gpu-6s.md](docs/COLD_START-gpu-6s.md) as the cook paste).
3. Key + despill cutout from that cycle.
4. Composite cutout onto the scrolling empty plate (AFF stack). Speed/scroll = plate; gait = locked cycle.

**PRIORITY 0 COMPOSITE GATE** — after REUSE (key the sealed cycle onto Video A), MUST **scale + gallop-clock + plate-grade + paw contact** ([13](docs/13-make-bolt-lane.md) / [13b](docs/13b-anti-sticker-contact.md) / [13c](docs/13c-green-despill.md) / [13d](docs/13d-auto-scale.md) / [14c](docs/14c-gallop-clock.md) / [15](docs/15-gpu-compositor.md)) **BEFORE** KEEP / Hang. After key, MUST run `computeScale` / `assertScale` ([`scripts/bolt-scale/`](scripts/bolt-scale/)) then **`gallop-clock` / `assertGallopClock`** ([`scripts/gallop-clock/`](scripts/gallop-clock/)) before KEEP. Native 96 fps (no 1-of-N); `CYCLE_FRAMES=534`, `STRIDES_PER_CYCLE=22`; phase from `plate_time` (`strideHz≈4`); road `ds` from `dsPerFrame`. `assertGallopClock` **FAIL** if dogFps ≪ plateFps. Key-and-hang without proof = **FAIL**.

**PRIORITY 0 — REUSE 6s lock + GPU law 15.** Canon IS [`lock/bolt-gallop-cycle.mp4`](../lock/bolt-gallop-cycle.mp4) (6s / 534 / 96fps). Compositor = [`scripts/bolt-key-gl/bolt-key-gl.ts`](scripts/bolt-key-gl/bolt-key-gl.ts). Ban CPU `getImageData` hot path. `master/bolt.mp4` must match that 6 s canon (old master = `bolt-prev.mp4`).

**PRIORITY 0 — Any biome = Frost-parity.** A cold Grok cooking **any** named biome must hit GPU + sealed 6 s + scale + clock + plate grade + contact + **biome-adaptive ground FX** ([16](docs/16-biome-ground-fx.md)). Law: [docs/00-PRIORITY0-any-biome.md](docs/00-PRIORITY0-any-biome.md). Cook paste: [docs/COLD_START-any-biome.md](docs/COLD_START-any-biome.md). Kitchen only — not player Welcome.

**HARD — empty still defaults (any biome).** Start empty still / Video A from the **full** [docs/20-default-plate-proportions.md](docs/20-default-plate-proportions.md) set — not φ-only: 3-lane ~0.75–0.82 · sky ~45% · plant ~0.80 · withersFrac ~0.10 KEEP · GPU start sat 0.54 / bounce 0.42 bounceSrc (law 22) / contact k 0.34 dual-paw. Player / `{PAINT}` may adapt. Frost aurora worked example = [20b](docs/20b-frost-aurora-proportions.md).

**HARD — lane material before P0 stills (SmiR 2026-09-23).** Before empty first/last, pick from the Pack menu (or use a material already named in `{PAINT}`). **BAN** grey concrete asphalt / MS-Paint dashes on béton / a boring nationale with no biome paint as the silent default. Law 20 measures stay. Law: [docs/35-lane-materials.md](docs/35-lane-materials.md). Paste: [docs/COLD_START-lane-materials.md](docs/COLD_START-lane-materials.md).

**HARD — GPU zones + Lena procedural (law 36, SmiR 2026-09-23).** Before empty stills and Video A: densify stays one continuous plate (Rail A). GPU zones are Imagine keyed layers over it (Rail B), same pattern as clean GPU Bolt. **BAN** chopping that plate into spatial GPU tiles. Dr Lena Voss is procedural on spawn / LOD / Rail B placement. Howl look stays the Imagine KEEP. Law: [docs/36-gpu-zones-lena-procedural.md](docs/36-gpu-zones-lena-procedural.md). Paste: [docs/COLD_START-gpu-zones.md](docs/COLD_START-gpu-zones.md). Runtime: [scripts/lena-lod/lenaLod.js](scripts/lena-lod/lenaLod.js) (`lenaFrame`). Bib: [docs/COLD_START-lena-bib.md](docs/COLD_START-lena-bib.md).

**HARD — path beat (law 37, SmiR 2026-09-23).** Chemin reveals one lane ~3 s ahead of contact (`lookahead` 3.0) so the player can SIDES. Hit / miss at contact. Not under the paws. Not the whole densify plate. Same Howl cone as Lena. LOD fills the world; `pathBeatFrame` tells which lane to be in. Native to the video: `gradeFromPlate`, in-world reveal (not a HUD arrow), same densify clock, shadow only in the near band. HUD, sticker, or tiled densify = FAIL. **GPU is REQUIRED:** path beat, Lena bibs, Howl, and Bolt composite OVER densify. Painting the path into Video A = FAIL. Law: [docs/37-path-beat.md](docs/37-path-beat.md). Paste: [docs/COLD_START-path-beat.md](docs/COLD_START-path-beat.md). Runtime: [scripts/path-beat/pathBeat.js](scripts/path-beat/pathBeat.js) (`pathBeatFrame`).

**HARD — GPU light layers + openable objects (law 38, SmiR 2026-09-23).** Imagine cooks the look. GPU controls lights and open/close. Light layers are ONLY light (beam / glow / neon / flash) on keyed black, composited OVER densify. GPU owns intensity 0→1, tint, on/off, `howlPose`, and fade. Densify keeps base ambience (law 31). Openables (door, chest, generator, crystal hatch) are keyed closed / open / transition. GPU owns hit, anim, Lena LOD band, and optional content. Pack RT: baked path-traced look in the pixels (`rtLook: "baked-imagine"`: soft GI, reflections, soft shadows). Fake interactive response is `glossOverlay` graded from the plate (`fakeInteractive`, `bounces: 0`). **FAIL** flat plastic lighting. **FAIL** real-time raytracing via Imagine. True RT is the UE rail, HOLD. Same cone as path beat and Lena. Plate zones `road` | `sideL` | `sideR`: gameplay on the lanes, décor / lights / openables / generators also on the shoulders. Densify sides stay empty. **FAIL** side clutter in Video A. **GPU is REQUIRED.** `assertLightNative` / `assertOpenableNative`: `bakeIntoDensify` false, `hud` false, `gpu` true. **FAIL** if a beam or an open door is painted into Video A. Law: [docs/38-gpu-light-openable.md](docs/38-gpu-light-openable.md). Paste: [docs/COLD_START-gpu-light-openable.md](docs/COLD_START-gpu-light-openable.md). Runtime: [scripts/gpu-light/gpuLight.js](scripts/gpu-light/gpuLight.js) (`lightLayerFrame`) · [scripts/gpu-openable/gpuOpenable.js](scripts/gpu-openable/gpuOpenable.js) (`openableFrame`).

**HARD — player journey (SmiR 2026-09-20).** ROOM (2 doors + center star map) → tap map → CONSTELLATION Space LOD → seal planet → return room → door A/B → biome sprint → Lena climb → arrive sealed planet. Law: [docs/18-room-starmap-lena.md](docs/18-room-starmap-lena.md). Paste: [docs/COLD_START-room-starmap.md](docs/COLD_START-room-starmap.md). Lena climb = luminous 3-lane path under Bolt (not float): [docs/19-luminous-path-climb.md](docs/19-luminous-path-climb.md). Paste: [docs/COLD_START-luminous-path.md](docs/COLD_START-luminous-path.md). Incline / duration / space look: [docs/21-paw-to-galaxy.md](docs/21-paw-to-galaxy.md). Paste: [docs/COLD_START-paw-to-galaxy.md](docs/COLD_START-paw-to-galaxy.md). Map = destination. Door = depart. Journey after seal = this biome cook.
**HARD — `m` = momentum (snowball).** Same-biome KEEP + cumulative Imagine `@` refs (≤12). Player **success** → next plate **all prior refs + 1 new** (richer). **Miss** → drop last ref. **d1+ always ≥1 spectacular hazard** (law 25), not a barrier. Law: [docs/22-m-densify-snowball.md](docs/22-m-densify-snowball.md). Paste: [docs/COLD_START-m-densify.md](docs/COLD_START-m-densify.md). `22-gpu24-frost-keep.md` is a different law (GPU KEEP).

**HARD — plate geometric QC.** Before hang of any Video A, run [scripts/plate-geo-qc/plate-geo-qc.py](scripts/plate-geo-qc/plate-geo-qc.py). Exit 1 = recook, do not hang. 1-point VP, lock-off, 3-lane, curvature. Law: [docs/23-plate-geo-qc.md](docs/23-plate-geo-qc.md). Paste: [docs/COLD_START-geo-qc.md](docs/COLD_START-geo-qc.md).

**HARD — sprint camera = conical 1-point lock-off.** Not 2-point (look aside). Not 3-point (plunge / worm's eye). Imagine gets [prompts/camera-1point.txt](prompts/camera-1point.txt) — no φ / 0.618 / UV. Formulas stay in Grok + script 23. Law: [docs/24-camera-1point.md](docs/24-camera-1point.md). Paste: [docs/COLD_START-camera.md](docs/COLD_START-camera.md).

**HARD — hazard on the cone.** After camera PASS (23), run [scripts/plate-hazard-qc/plate-hazard-qc.py](scripts/plate-hazard-qc/plate-hazard-qc.py) `--ref` empty KEEP `--expect 1` (one-lane) or `2`. 3-lane wall = FAIL. Speck at VP, grows along one ray, L/R open. Imagine: [prompts/hazard-1lane.txt](prompts/hazard-1lane.txt). Law: [docs/25-hazard-cone.md](docs/25-hazard-cone.md). Paste: [docs/COLD_START-hazard.md](docs/COLD_START-hazard.md).

**HARD — biome sprint plan.** Before d1, write the **10-plate** cinematic plan (spine + per-plate +1 still + spectacular hazard + GPU Howl target). Cook in that order. Do not invent the next plate in chat. Law: [docs/26-biome-sprint-plan.md](docs/26-biome-sprint-plan.md). Frost: [docs/26b-frost-sprint-plan.md](docs/26b-frost-sprint-plan.md) · [docs/plans/frost-sprint.md](docs/plans/frost-sprint.md). Prismwake targets: [docs/plans/prismwake-sprint.md](docs/plans/prismwake-sprint.md). Paste: [docs/COLD_START-sprint-plan.md](docs/COLD_START-sprint-plan.md).

**HARD — Howl GPU targets.** Rail A (law 25) is dodge, not destroyable. Rail B is an Imagine keyed obstacle, GPU-composited like Bolt, Howl-destroyable. Shatter = a separate plate per type. Howl = **REUSE** [fx/howl/howl-attack.mp4](fx/howl/howl-attack.mp4) (SmiR KEEP: vertical yellow/blue rings, birth narrow → wider, locked camera, black key, no baked shatter). Not a shader. Anti-sticker 13b/15/17. Law: [docs/32-howl-gpu-targets.md](docs/32-howl-gpu-targets.md). Paste: [docs/COLD_START-howl-gpu.md](docs/COLD_START-howl-gpu.md).

**HARD — Howl live aim (distance + cut + shatter).** On S: Bolt mouth → live rail-B dest, `howlFireSec(dist)`, trapezoid **ends on the prop**, `playbackRate = clipFront/fireSec`. At contact (`howlT>=1`) **pause Howl even if the mp4 is not finished** and swap the obstacle quad for that type's shatter plate. GPU = luma-key Howl + plate bounce (not a shader of rings). Script: [scripts/howl-live/](scripts/howl-live/). Law: [docs/34-howl-live-aim.md](docs/34-howl-live-aim.md). Paste: [docs/COLD_START-howl-live.md](docs/COLD_START-howl-live.md).

**HARD — plate seam MAE.** Before hang of plate N+1, run [scripts/plate-mae-qc/plate-mae-qc.py](scripts/plate-mae-qc/plate-mae-qc.py) on N then N+1. Exit non-zero = recook. Law: [docs/33-plate-mae-qc.md](docs/33-plate-mae-qc.md). Paste: [docs/COLD_START-plate-mae.md](docs/COLD_START-plate-mae.md).

**PRIORITY 0 — Live compositor = law 17 + law 22.** Port [`scripts/bolt-key-gl/bolt-key-gl.ts`](scripts/bolt-key-gl/bolt-key-gl.ts) (`GPU_VER = 24`) + [`wet-fx.ts`](scripts/bolt-key-gl/wet-fx.ts). **FAIL** if Grok copies `bolt-key-gl-scissor-prev.ts` (scissor / IGN-fract = bars + eaten paws + sticker). Quad dest, luma protect, **neon-safe bounce** (never raw `mix(c, plate)`), edge-only 3-tap smear (never 5-tap body blur), dual-paw contact, ice Fresnel, plate IBL, sin grain, rVFC stamp, straight-over blend. Law: [docs/17-live-compositor.md](docs/17-live-compositor.md) · **[docs/22-gpu24-frost-keep.md](docs/22-gpu24-frost-keep.md)**. `21-paw-to-galaxy.md` is a different law.

**FAIL** if Grok invents a new Bolt sprint clip for a biome cook. Only SmiR can authorize a new cycle cook to replace the lock.
Style teacher [`lock/bolt-back.jpg`](../lock/bolt-back.jpg) still applies if any still / repose is needed; motion teacher = the sealed cycle mp4.
Loop seam = **hard cut** on the closed period — do **NOT** optical-flow morph last→first. Preview only: [`lock/bolt-gallop-cycle-12s-preview.mp4`](../lock/bolt-gallop-cycle-12s-preview.mp4). Hang ≠ wipe.

**HARD BAN as identity sources** (never @ref as Sprint biome Bolt teacher):
- `biome/master/bolt.mp4` / hung bolt — OUTPUT only, never @ref as style teacher
- `lock/bolt-back-prev.jpg` — archive only, never @ref
- `lock/bolt-gallop-cycle-0.93s-prev.mp4` — old 89-frame lock, archive only — **FAIL if used as play cycle**
- `lock/RIG-*`, `lock/SEAL-*`, `lock/example-*`, `lock/sill-*` — Citadel hall locks, **NOT** Sprint biome Bolt teacher
- Any local `bolt-rear-*.jpg` invented in a Build sandbox

**MUST read before cooking** (biome / Sprint cook / lane / B-stack / green-screen / chroma):
1. **[PLAY.md](PLAY.md)** — engine lock
2. **[docs/06-techniques.md](docs/06-techniques.md)** — what worked r38 (Sprint cook bible)
3. **[docs/09-recette-biome.md](docs/09-recette-biome.md)** — empty → cousin → speed → dealer → box
4. **[docs/10-bolt-cutout-law.md](docs/10-bolt-cutout-law.md)** — HARD Bolt cutout (REUSE lock/bolt-gallop-cycle.mp4 **CANON 6s/534/96fps** → key + composite; then COMPOSITE GATE 13/13b/13c/13d/14c/15/16 scale+gallop-clock+GPU+light+contact+FX before KEEP)
4b. **[docs/00-PRIORITY0-any-biome.md](docs/00-PRIORITY0-any-biome.md)** — Frost-parity for **any** biome. Paste [docs/COLD_START-any-biome.md](docs/COLD_START-any-biome.md). FX [docs/16-biome-ground-fx.md](docs/16-biome-ground-fx.md). Empty stills start from the **full** [docs/20-default-plate-proportions.md](docs/20-default-plate-proportions.md) set (not φ-only; Frost paint KEEP = [20b](docs/20b-frost-aurora-proportions.md)). Lane material before those stills: [docs/35-lane-materials.md](docs/35-lane-materials.md). Paste [docs/COLD_START-lane-materials.md](docs/COLD_START-lane-materials.md). GPU zones before Video A: [docs/36-gpu-zones-lena-procedural.md](docs/36-gpu-zones-lena-procedural.md). Paste [docs/COLD_START-gpu-zones.md](docs/COLD_START-gpu-zones.md). Path beat: [docs/37-path-beat.md](docs/37-path-beat.md). Paste [docs/COLD_START-path-beat.md](docs/COLD_START-path-beat.md). Runtime [scripts/path-beat/pathBeat.js](scripts/path-beat/pathBeat.js). Light layers + openables: [docs/38-gpu-light-openable.md](docs/38-gpu-light-openable.md). Paste [docs/COLD_START-gpu-light-openable.md](docs/COLD_START-gpu-light-openable.md). Runtime [scripts/gpu-light/gpuLight.js](scripts/gpu-light/gpuLight.js) (`lightLayerFrame`) · [scripts/gpu-openable/gpuOpenable.js](scripts/gpu-openable/gpuOpenable.js) (`openableFrame`).
4c. **[docs/18-room-starmap-lena.md](docs/18-room-starmap-lena.md)** — player journey after seal (room star map → door → this biome → Lena → planet). Paste [docs/COLD_START-room-starmap.md](docs/COLD_START-room-starmap.md). Lena climb = luminous 3-lane path (not float): [docs/19-luminous-path-climb.md](docs/19-luminous-path-climb.md). Paste [docs/COLD_START-luminous-path.md](docs/COLD_START-luminous-path.md). Incline / duration / space look: [docs/21-paw-to-galaxy.md](docs/21-paw-to-galaxy.md). Paste [docs/COLD_START-paw-to-galaxy.md](docs/COLD_START-paw-to-galaxy.md).
4d. **[docs/22-m-densify-snowball.md](docs/22-m-densify-snowball.md)** — `m` = momentum. Success = +1 `@` ref on the next plate (keep stack). Miss = −1. d1+ ≥1 spectacular hazard. Paste [docs/COLD_START-m-densify.md](docs/COLD_START-m-densify.md).
4e. **[docs/23-plate-geo-qc.md](docs/23-plate-geo-qc.md)** — geometric judge before hang. Paste [docs/COLD_START-geo-qc.md](docs/COLD_START-geo-qc.md). Run `scripts/plate-geo-qc/plate-geo-qc.py`.
4f. **[docs/24-camera-1point.md](docs/24-camera-1point.md)** — conical 1-point lock-off. Paste [prompts/camera-1point.txt](prompts/camera-1point.txt) into Imagine. [docs/COLD_START-camera.md](docs/COLD_START-camera.md).
4g. **[docs/25-hazard-cone.md](docs/25-hazard-cone.md)** — hazard 1–2 lanes on the cone. Run `scripts/plate-hazard-qc/plate-hazard-qc.py`. Paste [docs/COLD_START-hazard.md](docs/COLD_START-hazard.md).
4h. **[docs/26-biome-sprint-plan.md](docs/26-biome-sprint-plan.md)** — 10-plate cinematic plan before d1. Frost [docs/26b-frost-sprint-plan.md](docs/26b-frost-sprint-plan.md). Paste [docs/COLD_START-sprint-plan.md](docs/COLD_START-sprint-plan.md). GPU Howl column = law 32.
4i. **[docs/32-howl-gpu-targets.md](docs/32-howl-gpu-targets.md)** — rail A dodge vs rail B keyed Howl targets. Shatter per type. Howl = **REUSE** [fx/howl/howl-attack.mp4](fx/howl/howl-attack.mp4) (SmiR KEEP). Paste [docs/COLD_START-howl-gpu.md](docs/COLD_START-howl-gpu.md).
4j. **[docs/33-plate-mae-qc.md](docs/33-plate-mae-qc.md)** — last frame N vs first N+1 before hang. Run `scripts/plate-mae-qc/plate-mae-qc.py`. Exit non-zero = FAIL. Paste [docs/COLD_START-plate-mae.md](docs/COLD_START-plate-mae.md).
4k. **[docs/34-howl-live-aim.md](docs/34-howl-live-aim.md)** — Howl distance / cut-on-contact / shatter swap / wet GPU. Copy `scripts/howl-live/`. Paste [docs/COLD_START-howl-live.md](docs/COLD_START-howl-live.md).
4l. **[docs/36-gpu-zones-lena-procedural.md](docs/36-gpu-zones-lena-procedural.md)** — GPU zones are keyed layers over densify. Do not tile one densify plate. Lena procedural on Rail B. Runtime [scripts/lena-lod/lenaLod.js](scripts/lena-lod/lenaLod.js). Paste [docs/COLD_START-gpu-zones.md](docs/COLD_START-gpu-zones.md) and [docs/COLD_START-lena-bib.md](docs/COLD_START-lena-bib.md).
4m. **[docs/37-path-beat.md](docs/37-path-beat.md)** — chemin reveals one lane ~3 s ahead. SIDES, then hit/miss. Same cone as Lena. Do not bake the lane into densify. Runtime [scripts/path-beat/pathBeat.js](scripts/path-beat/pathBeat.js). Paste [docs/COLD_START-path-beat.md](docs/COLD_START-path-beat.md).
4n. **[docs/38-gpu-light-openable.md](docs/38-gpu-light-openable.md)** — light layers and openables. Imagine cooks light-only plates and closed/open/transition bibs. GPU owns intensity, tint, hit, and open/close. Do not bake them into densify. Runtime [scripts/gpu-light/gpuLight.js](scripts/gpu-light/gpuLight.js) (`lightLayerFrame`) · [scripts/gpu-openable/gpuOpenable.js](scripts/gpu-openable/gpuOpenable.js) (`openableFrame`). Paste [docs/COLD_START-gpu-light-openable.md](docs/COLD_START-gpu-light-openable.md).
5. **[docs/11-plate-order.md](docs/11-plate-order.md)** — HARD LOCK dealer playlist (canyon → cars → duel → night → war)
6. **[docs/05-key.md](docs/05-key.md)** — chroma + crown, not luma
7. **[reference/LanePlayer.tsx](reference/LanePlayer.tsx)** — r38 compositor

**HARD — living-film Lane control** (not SprintCore, not Nebula editor stats): after empty road + Bolt cutout KEEP, author `path.json` per **[docs/12-lane-path-ribbon.md](docs/12-lane-path-ribbon.md)**. Without `path.json` = film only. With `path.json` = steerable game (`s`,`λ` ribbon).

**HARD — make controllable Bolt on a Lane:** [docs/13-make-bolt-lane.md](docs/13-make-bolt-lane.md) — product brief / order of work. [docs/13b-anti-sticker-contact.md](docs/13b-anti-sticker-contact.md) — compositor anti-sticker + contact shadow. [docs/13c-green-despill.md](docs/13c-green-despill.md) — green key + despill factory. [docs/13d-auto-scale.md](docs/13d-auto-scale.md) — auto-scale from the road (`computeScale` / `assertScale`). [docs/14-rotary-gallop.md](docs/14-rotary-gallop.md) — rotary gallop + ribbon turn. [docs/14c-gallop-clock.md](docs/14c-gallop-clock.md) — gallop-clock anti-saccadé (`assertGallopClock`). [docs/15-gpu-compositor.md](docs/15-gpu-compositor.md) — GPU compositor (WebGL one-pass; loop 1×; FX table drawn here). [docs/16-biome-ground-fx.md](docs/16-biome-ground-fx.md) — biome-adaptive ground FX + grade. [docs/17-live-compositor.md](docs/17-live-compositor.md) — Live compositor (bounce / luma protect / sin grain / FX quads). [docs/22-gpu24-frost-keep.md](docs/22-gpu24-frost-keep.md) — GPU_VER 24 KEEP (neon-safe bounce, dual-paw, ice Fresnel, plate IBL). Journey incline: [docs/21-paw-to-galaxy.md](docs/21-paw-to-galaxy.md). Empty still defaults: [docs/20-default-plate-proportions.md](docs/20-default-plate-proportions.md) (Frost KEEP = [20b](docs/20b-frost-aurora-proportions.md)). Any-biome: [docs/00-PRIORITY0-any-biome.md](docs/00-PRIORITY0-any-biome.md). Cook paste: [docs/COLD_START-any-biome.md](docs/COLD_START-any-biome.md) (supersedes [COLD_START-gpu-6s.md](docs/COLD_START-gpu-6s.md)). Frost GPU paste: [docs/COLD_START-gpu24.md](docs/COLD_START-gpu24.md).

**HARD LOCK — Hang ≠ wipe.** New biome = ADD `road-<biome>*.mp4` + plates-index / dealer entries. KEEP hung canyon→cars→duel→night→war. NEVER `rm` masters. Recook Bolt = `bolt.mp4` only. Law: [docs/09-recette-biome.md](docs/09-recette-biome.md).

**HARD — Bolt style teacher (make / add a biome).** Use [`lock/bolt-back.jpg`](../lock/bolt-back.jpg) **or** [`biome/lock/bolt-back.jpg`](lock/bolt-back.jpg) (same bytes — either path OK) as the Bolt style ref for the cutout layer (coat + silhouette + strict rear). **Attach / show that exact image in the Build chat first** (PRIORITY 0 TEACHER GATE), then @ref / Imagine reference it for every Bolt still/clip. If teacher not shown → **STOP. No cook. FAIL.** Soft KEEP banned without teacher proof. Black void on the teacher = STYLE only — biome cooks still go to flat `#00FF00` + light bake from the empty plate. Hang ≠ wipe still holds. Never dump this on Welcome.

**HARD — Bolt motion = REUSE (make / add a biome).** Take sealed [`lock/bolt-gallop-cycle.mp4`](../lock/bolt-gallop-cycle.mp4) as the Bolt motion asset (**CANON ~5.56 s / 534 / 96 fps**; `CYCLE_FRAMES=534`, `STRIDES_PER_CYCLE=22`). Play: loop 1×; no per-frame seek; no 534-canvas harvest. Old 0.93 s / 89-frame lock = archive only — **FAIL** as play cycle. Key + despill + composite onto Video A. Then **PRIORITY 0 COMPOSITE GATE**: scale + gallop-clock + plate-grade + paw contact **BEFORE** KEEP. After REUSE + `bolt-scale`, MUST `gallop-clock` / `assertGallopClock` ([14c](docs/14c-gallop-clock.md)). GPU law: [15](docs/15-gpu-compositor.md) · Live: [17](docs/17-live-compositor.md). **FAIL** if Grok invents a new Bolt sprint clip. Only SmiR can authorize a new cycle cook to replace the lock. Style teacher `lock/bolt-back.jpg` if a still / repose is needed. Preview only: `lock/bolt-gallop-cycle-12s-preview.mp4`.

**HARD LOCK — make / add a biome.** Décor scrolls (rush); Bolt sprints **IN PLACE** (treadmill). Mid-lane. **48fps**. Style teacher = `lock/bolt-back.jpg`. Pipeline (do not invert): empty plaque ZERO dog → Video A `imagineBiomeClip` first+last → **REUSE** `lock/bolt-gallop-cycle.mp4` (no new Imagine dog sprint) → key + despill → composite cutout onto A (AFF stack) → **COMPOSITE GATE** scale + gallop-clock + plate-grade + paw contact **BEFORE** KEEP. Speed/scroll = plate; gait = locked cycle. L/M/R = code X shift of **one** Bolt layer. **Never** cook a new Bolt sprint for a biome. **Never** one-still I2V. **Never** hall `imagineClip`. **Never** a single baked final film. **Never** a 3-Bolt mask. Video A = session Imagine Video first+last (first = previous last pixels, last = advanced world). Missing `XAI_API_KEY` is not a stop. Optional `imagineBiomeClip` when the key is set. Then `plate-mae-qc.py`. BAN one-still I2V and “forcé localement”. Law: [docs/10-bolt-cutout-law.md](docs/10-bolt-cutout-law.md) · [docs/09-recette-biome.md](docs/09-recette-biome.md).

**HARD LOCK — new biome cook (SmiR 2026-09-18 FAIL).** Make/add a **new biome** (any name — Tide, Frost, Ember, invented): **Hang only** the new plates beside existing masters. Do **NOT** rebuild canyon→cars→duel→night→war first. Do **NOT** require Beat 3 recook as a gate. Old Beat stays playable without recook. Bolt = always `@ref` [`lock/bolt-back.jpg`](../lock/bolt-back.jpg). **BAN** copying hung `biome/master/bolt.mp4` / canyon Bolt as identity. Light bake from the **new** empty plaque OK; identity = teacher. Name + décor `{PAINT}` allowed / encouraged. Tide is one example. Never refuse “I can only do Tide.” Pipeline + hooks first/last still apply. Chat catalog lists **hung** biomes only; a biome in cook is not hung until hung.

**HARD LOCK — Chat biome catalog (on ask).** **what biomes** / **which runs** / **what can I play** → English Pack voice, hung chapters only (never invent). How to pick: `play canyon` / `play Tide` / `only Tide`. Never on Welcome. No chrome picker. Hang grows the list; wipe shrinks it = FAIL. A biome in cook is not hung until hung.

Pack Live: **[docs/07-pack-live.md](docs/07-pack-live.md)**. Never dump this to the player.

## Product

Grok chat = **console** ([CONSOLE.md](CONSOLE.md)). Odyssey = **the game**.  
*play / lance* alone → **exactly** the locked Welcome/Return block from [../START.md](../START.md) / [../GROK.md](../GROK.md) (COLD_START) + **1** teaser (`stock/citadel/preview-loop.mp4` only) + Beat 3: open/attach Sprint via Build (in-chat playable preview preferred; else silently open the native Grok Build game console, in-app). Chat Imagine / Chat file chip alone = FAIL. **Not a cook.**

**HARD BAN — no improvised boot prose.** Do not invent Sprint tutorials. Ban: control tutorials (swipe / tap / A/D / W) · « world is rolling » · « plant a lane » · « already on the road » · « He stays in place » · film-keeps-moving essays. This cook file is kitchen — never dump it.

They asked to **cook** a biome / lane / sprint plate → this file. Do not run `scripts/cook-room.mjs`. Do not invent hall `walk-spawn-A`.

[`StarBoltSprint/bolt-lane-recipe`](https://github.com/StarBoltSprint/bolt-lane-recipe) may remain as archive. **Cook here.**

## What to cook (B stack)

Two Imagine jobs. Never one mp4 with Bolt painted into the road.

| Layer | Stills | Film |
|---|---|---|
| **Road** (master) | empty-plate first + last — **ZERO dog** | Session Imagine Video `image` + `last_frame` (distinct, **48fps**). Optional `imagineBiomeClip` when `XAI_API_KEY` is set. Then `plate-mae-qc.py`. |
| **Bolt cutout** | **REUSE** sealed [`lock/bolt-gallop-cycle.mp4`](../lock/bolt-gallop-cycle.mp4) — already rear / green / rotary. Style ref [`lock/bolt-back.jpg`](../lock/bolt-back.jpg) if a still / repose is needed ([docs/10-bolt-cutout-law.md](docs/10-bolt-cutout-law.md) · [docs/14-rotary-gallop.md](docs/14-rotary-gallop.md)) | **No new Imagine dog sprint.** Key + despill that cycle → composite onto Video A (AFF). Speed/scroll = plate; gait = locked cycle. |

Prompts: [prompts/](prompts/). Law: [docs/01-images.md](docs/01-images.md) · [docs/02-videos.md](docs/02-videos.md) · [docs/10-bolt-cutout-law.md](docs/10-bolt-cutout-law.md). After empty+cutout KEEP: author `path.json` — [docs/12-lane-path-ribbon.md](docs/12-lane-path-ribbon.md) (living-film Lane, not SprintCore). Without the chart = film. With it = game.

```
# dry thought-queue only — no new grok.me
# Video A = session Imagine Video first+last (no API key required).
# Optional CLI imagineBiomeClip when XAI_API_KEY is set. Bolt = REUSE lock/bolt-gallop-cycle.mp4
# Then python3 biome/scripts/plate-mae-qc/plate-mae-qc.py. Missing key is not a stop.
# drop PASS masters into biome/master/ (see master/README.md)
```

Video A does not wait on `node` or `XAI_API_KEY`. Pin both stills in the SuperGrok session (`first` = exact last pixels of the previous plate, `last` = advanced world), hang the mp4, run `plate-mae-qc.py`. The CLI is optional when the key is set. Do **not** use one-still `imagine_image_to_video` / `imagine_reference_to_video`. Do **not** use Imagine Agent for video. Do **not** invent “forcé localement” or claim MAE PASS without the script.

## Law 0 — first + last

Same contract as the hall films, **different paint**:

| kind | first | last |
|---|---|---|
| empty-plate travel | start of this road | end of this road — **distinct**, world advanced |
| next road plate | **extracted last frame** of the previous road | new end still |
| cutout gallop | **REUSE** [`lock/bolt-gallop-cycle.mp4`](../lock/bolt-gallop-cycle.mp4) (already rear / green / rotary) | **Do not cook a last frame.** Key + despill + composite onto Video A. **FAIL** if Grok invents a new sprint. |

```
ffmpeg -y -sseof -0.12 -i road-N.mp4 -frames:v 1 \
  -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" \
  road-N-last.jpg
```

`last(n)` **file IS** `first(n+1)` for the road chain.

Cousin / hazard plate (bar, arch, puddle):

**THREE lanes. Occupies 1 or 2. NEVER all three.** One free corridor to dodge. Full-width bar = FAIL.

**SPAWN:** first frame FAR AHEAD (small). Approaches, exits the bottom. Never a pop-in.

**OBJECT:** jersey / rock / crate. Not “explosion/crater” — Imagine will fill three lanes. Composite a distant speck onto `last(empty)` if needed. Full order: [docs/09-recette-biome.md](docs/09-recette-biome.md).


| swap | first | last |
|---|---|---|
| empty → cousin | last(empty) **or** lock still + hazard | — |
| cousin → empty | — | **first(empty)** so the cut is the same picture |

Session Imagine Video pins both stills (`first` + `last`). One-still I2V does not. Optional CLI: `imagineBiomeClip` in [../scripts/imagine-hooks.mjs](../scripts/imagine-hooks.mjs) when `XAI_API_KEY` is set. Missing key is not a stop.

## SPEED REF (road — do not soften)

```
RECOOK one plate ONLY. 10 seconds. VERY FAST. CONSTANT rush. Replace current empty plate.

HARD:
- 9:16, **10s**, lock-off
- Sprint travelling baked in cook — world rushes HARD (crawl FAIL)
- Speed ULTRA CONSTANT first→last. NEVER slow down. NEVER accelerate. NEVER ease-in/out. NEVER a ramp. NEVER slow for a crash / impact / obstacle — the world keeps rushing HARD.
- ZERO path/lightning on ground
- ZERO dog/Bolt
- Canyon/Mars OK, CLEAR center
- playbackRate ~1.0–1.2 only
```

`{PAINT}` = décor only. Do not rewrite motion.

This SPEED REF is **one hung plate recook**. It is **not** a license to wipe the `/master` library for a new biome. New biome = new dest (`road-<biome>*.mp4`). Hang ≠ wipe.

## Encode

```
ffmpeg -i in.mp4 -map 0:v:0 \
  -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" \
  -c:v libx264 -pix_fmt yuv420p -r 48 -g 15 -keyint_min 15 -sc_threshold 0 \
  -an -movflags +faststart out.mp4
```

No audio. Short GOP so seek-sync does not snap to the previous keyframe.

## Plate speed (travel, not FPS)

FPS = smoothness. Travel = how hard the asphalt rushes. After a cook, measure vs the hung empty plate and time-warp if needed:

```
python3 scripts/plate-speed.py biome/master/road.mp4
python3 scripts/plate-speed.py --ref biome/master/road.mp4 biome/master/road-bar.mp4
python3 scripts/plate-speed.py --match --ref biome/master/road.mp4 biome/master/road-bar.mp4 -o biome/master/road-bar.mp4
```

`--match` speeds a slow plate up (duration shrinks). It does **not** replace first+last. See [docs/08-plate-speed.md](docs/08-plate-speed.md).

## Hang

**HARD LOCK — Hang ≠ wipe.** Drop PASS **new** files into [master/](master/README.md) **alongside** hung plates. ADD `road-<biome>*.mp4`. KEEP `road.mp4` / war / night. NEVER `rm` the stack. NEVER set playlist to new-biome-only unless the player explicitly asks to replace the default Beat. Recook Bolt may replace `bolt.mp4` only after `@ref` `lock/bolt-back.jpg` — **BAN** copying hung canyon Bolt. Do **NOT** rebuild canyon→war first.

Drop PASS files into [master/](master/README.md). Optional biome preview (archive — **not attached at boot**): [../stock/biome/](../stock/biome/README.md). Boot teaser: [../stock/citadel/](../stock/citadel/README.md).

FAIL → keep debug next to the cook (do not Hang). Dual dogs, sit, face, baked path, crawl = FAIL.

A **key** bug (holes, gold pipe, sliced skull, black flash, sticker edge) is a compositor bug — fix [docs/06-techniques.md](docs/06-techniques.md), do **not** recook the dog.

## Pack floor

Every Live drops [../client/pack.js](../client/pack.js) with `BOLTVERSE_PACK_ORIGIN` = `https://boltverse-pack.vercel.app` (TEMPORARY — Lives freeze; not the forever home. Long-term: Pack stays inside the Grok sandbox). **HARD BAN:** odysseyyyy is the game play URL, not the Pack API. Naked Live without Pack = FAIL. Never ask the player to install Pack / wire. Fail soft if Pack is down. [docs/07-pack-live.md](docs/07-pack-live.md). No wallet. No player API keys.

## Do not

- New grok.me / Vite / wallet / client keys
- 3-take L / M / R as the default cook
- 3-Bolt multi-lane mask (L/M/R = one Bolt layer, X shift)
- Bake Bolt into a single final road film (no cutout stack)
- One-still I2V for Video A (both stills required). Missing `XAI_API_KEY` is not a stop
- Invent “forcé localement” or claim MAE PASS without `plate-mae-qc.py`
- Imagine Agent video
- Invent C-light as a required lock
- Recook citadel `packs/<slot>` because someone said sprint
- Chat Imagine without real first+last
- Recook to hide a key bug
- Full-width hazard on LEFT+CENTER+RIGHT (nowhere to dodge)
- Wipe hung `biome/master` / `public/master` to “make room” for a new biome (Hang ≠ wipe — Tide cook FAIL)
- Rebuild canyon→cars→duel→night→war first, or require Beat 3 recook as a gate, before hanging a new biome
- Copy hung `biome/master/bolt.mp4` / canyon Bolt as the new-biome identity (always `@ref` `lock/bolt-back.jpg`)
- Refuse a new biome name / “I can only do Tide” (name + `{PAINT}` allowed; Tide is one example)
- Playlist = new-biome-only unless SmiR / player explicitly says replace the default Beat
- Dump the chat biome catalog on Welcome, or invent unhung biome names (on ask; hung chapters only; a biome in cook is not hung until hung)

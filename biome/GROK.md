# GROK — biome / Sprint cook (kitchen)

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

**HARD — player journey (SmiR 2026-09-20).** ROOM (2 doors + center star map) → tap map → CONSTELLATION Space LOD → seal planet → return room → door A/B → biome sprint → Lena climb → arrive sealed planet. Law: [docs/18-room-starmap-lena.md](docs/18-room-starmap-lena.md). Paste: [docs/COLD_START-room-starmap.md](docs/COLD_START-room-starmap.md). Lena climb = luminous 3-lane path under Bolt (not float): [docs/19-luminous-path-climb.md](docs/19-luminous-path-climb.md). Paste: [docs/COLD_START-luminous-path.md](docs/COLD_START-luminous-path.md). Incline / duration / space look: [docs/21-paw-to-galaxy.md](docs/21-paw-to-galaxy.md). Paste: [docs/COLD_START-paw-to-galaxy.md](docs/COLD_START-paw-to-galaxy.md). Map = destination. Door = depart. Journey after seal = this biome cook.
**HARD — m densify snowball.** Same-biome base plate loop + cumulative Imagine `@` refs (≤12). Success adds a detail and keeps prior refs; miss drops one tier. Law: [docs/22-m-densify-snowball.md](docs/22-m-densify-snowball.md). Paste: [docs/COLD_START-m-densify.md](docs/COLD_START-m-densify.md). `22-gpu24-frost-keep.md` is a different law (GPU KEEP).

**HARD — plate geometric QC.** Before hang of any Video A, run [scripts/plate-geo-qc/plate-geo-qc.py](scripts/plate-geo-qc/plate-geo-qc.py). Exit 1 = recook, do not hang. 1-point VP, lock-off, 3-lane, curvature. Law: [docs/23-plate-geo-qc.md](docs/23-plate-geo-qc.md). Paste: [docs/COLD_START-geo-qc.md](docs/COLD_START-geo-qc.md).

**HARD — sprint camera = conical 1-point lock-off.** Not 2-point (look aside). Not 3-point (plunge / worm's eye). Imagine gets [prompts/camera-1point.txt](prompts/camera-1point.txt) — no φ / 0.618 / UV. Formulas stay in Grok + script 23. Law: [docs/24-camera-1point.md](docs/24-camera-1point.md). Paste: [docs/COLD_START-camera.md](docs/COLD_START-camera.md).

**HARD — hazard on the cone.** After camera PASS (23), run [scripts/plate-hazard-qc/plate-hazard-qc.py](scripts/plate-hazard-qc/plate-hazard-qc.py) `--ref` empty KEEP `--expect 1` (one-lane) or `2`. 3-lane wall = FAIL. Speck at VP, grows along one ray, L/R open. Imagine: [prompts/hazard-1lane.txt](prompts/hazard-1lane.txt). Law: [docs/25-hazard-cone.md](docs/25-hazard-cone.md). Paste: [docs/COLD_START-hazard.md](docs/COLD_START-hazard.md).

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
4b. **[docs/00-PRIORITY0-any-biome.md](docs/00-PRIORITY0-any-biome.md)** — Frost-parity for **any** biome. Paste [docs/COLD_START-any-biome.md](docs/COLD_START-any-biome.md). FX [docs/16-biome-ground-fx.md](docs/16-biome-ground-fx.md). Empty stills start from the **full** [docs/20-default-plate-proportions.md](docs/20-default-plate-proportions.md) set (not φ-only; Frost paint KEEP = [20b](docs/20b-frost-aurora-proportions.md)).
4c. **[docs/18-room-starmap-lena.md](docs/18-room-starmap-lena.md)** — player journey after seal (room star map → door → this biome → Lena → planet). Paste [docs/COLD_START-room-starmap.md](docs/COLD_START-room-starmap.md). Lena climb = luminous 3-lane path (not float): [docs/19-luminous-path-climb.md](docs/19-luminous-path-climb.md). Paste [docs/COLD_START-luminous-path.md](docs/COLD_START-luminous-path.md). Incline / duration / space look: [docs/21-paw-to-galaxy.md](docs/21-paw-to-galaxy.md). Paste [docs/COLD_START-paw-to-galaxy.md](docs/COLD_START-paw-to-galaxy.md).
4d. **[docs/22-m-densify-snowball.md](docs/22-m-densify-snowball.md)** — same-biome m densify snowball refs (≤12). Paste [docs/COLD_START-m-densify.md](docs/COLD_START-m-densify.md).
4e. **[docs/23-plate-geo-qc.md](docs/23-plate-geo-qc.md)** — geometric judge before hang. Paste [docs/COLD_START-geo-qc.md](docs/COLD_START-geo-qc.md). Run `scripts/plate-geo-qc/plate-geo-qc.py`.
4f. **[docs/24-camera-1point.md](docs/24-camera-1point.md)** — conical 1-point lock-off. Paste [prompts/camera-1point.txt](prompts/camera-1point.txt) into Imagine. [docs/COLD_START-camera.md](docs/COLD_START-camera.md).
4g. **[docs/25-hazard-cone.md](docs/25-hazard-cone.md)** — hazard 1–2 lanes on the cone. Run `scripts/plate-hazard-qc/plate-hazard-qc.py`. Paste [docs/COLD_START-hazard.md](docs/COLD_START-hazard.md).
5. **[docs/11-plate-order.md](docs/11-plate-order.md)** — HARD LOCK dealer playlist (canyon → cars → duel → night → war)
6. **[docs/05-key.md](docs/05-key.md)** — chroma + crown, not luma
7. **[reference/LanePlayer.tsx](reference/LanePlayer.tsx)** — r38 compositor

**HARD — living-film Lane control** (not SprintCore, not Nebula editor stats): after empty road + Bolt cutout KEEP, author `path.json` per **[docs/12-lane-path-ribbon.md](docs/12-lane-path-ribbon.md)**. Without `path.json` = film only. With `path.json` = steerable game (`s`,`λ` ribbon).

**HARD — make controllable Bolt on a Lane:** [docs/13-make-bolt-lane.md](docs/13-make-bolt-lane.md) — product brief / order of work. [docs/13b-anti-sticker-contact.md](docs/13b-anti-sticker-contact.md) — compositor anti-sticker + contact shadow. [docs/13c-green-despill.md](docs/13c-green-despill.md) — green key + despill factory. [docs/13d-auto-scale.md](docs/13d-auto-scale.md) — auto-scale from the road (`computeScale` / `assertScale`). [docs/14-rotary-gallop.md](docs/14-rotary-gallop.md) — rotary gallop + ribbon turn. [docs/14c-gallop-clock.md](docs/14c-gallop-clock.md) — gallop-clock anti-saccadé (`assertGallopClock`). [docs/15-gpu-compositor.md](docs/15-gpu-compositor.md) — GPU compositor (WebGL one-pass; loop 1×; FX table drawn here). [docs/16-biome-ground-fx.md](docs/16-biome-ground-fx.md) — biome-adaptive ground FX + grade. [docs/17-live-compositor.md](docs/17-live-compositor.md) — Live compositor (bounce / luma protect / sin grain / FX quads). [docs/22-gpu24-frost-keep.md](docs/22-gpu24-frost-keep.md) — GPU_VER 24 KEEP (neon-safe bounce, dual-paw, ice Fresnel, plate IBL). Journey incline: [docs/21-paw-to-galaxy.md](docs/21-paw-to-galaxy.md). Empty still defaults: [docs/20-default-plate-proportions.md](docs/20-default-plate-proportions.md) (Frost KEEP = [20b](docs/20b-frost-aurora-proportions.md)). Any-biome: [docs/00-PRIORITY0-any-biome.md](docs/00-PRIORITY0-any-biome.md). Cook paste: [docs/COLD_START-any-biome.md](docs/COLD_START-any-biome.md) (supersedes [COLD_START-gpu-6s.md](docs/COLD_START-gpu-6s.md)). Frost GPU paste: [docs/COLD_START-gpu24.md](docs/COLD_START-gpu24.md).

**HARD LOCK — Hang ≠ wipe.** New biome = ADD `road-<biome>*.mp4` + plates-index / dealer entries. KEEP hung canyon→cars→duel→night→war. NEVER `rm` masters. Recook Bolt = `bolt.mp4` only. Law: [docs/09-recette-biome.md](docs/09-recette-biome.md).

**HARD — Bolt style teacher (make / add a biome).** Use [`lock/bolt-back.jpg`](../lock/bolt-back.jpg) **or** [`biome/lock/bolt-back.jpg`](lock/bolt-back.jpg) (same bytes — either path OK) as the Bolt style ref for the cutout layer (coat + silhouette + strict rear). **Attach / show that exact image in the Build chat first** (PRIORITY 0 TEACHER GATE), then @ref / Imagine reference it for every Bolt still/clip. If teacher not shown → **STOP. No cook. FAIL.** Soft KEEP banned without teacher proof. Black void on the teacher = STYLE only — biome cooks still go to flat `#00FF00` + light bake from the empty plate. Hang ≠ wipe still holds. Never dump this on Welcome.

**HARD — Bolt motion = REUSE (make / add a biome).** Take sealed [`lock/bolt-gallop-cycle.mp4`](../lock/bolt-gallop-cycle.mp4) as the Bolt motion asset (**CANON ~5.56 s / 534 / 96 fps**; `CYCLE_FRAMES=534`, `STRIDES_PER_CYCLE=22`). Play: loop 1×; no per-frame seek; no 534-canvas harvest. Old 0.93 s / 89-frame lock = archive only — **FAIL** as play cycle. Key + despill + composite onto Video A. Then **PRIORITY 0 COMPOSITE GATE**: scale + gallop-clock + plate-grade + paw contact **BEFORE** KEEP. After REUSE + `bolt-scale`, MUST `gallop-clock` / `assertGallopClock` ([14c](docs/14c-gallop-clock.md)). GPU law: [15](docs/15-gpu-compositor.md) · Live: [17](docs/17-live-compositor.md). **FAIL** if Grok invents a new Bolt sprint clip. Only SmiR can authorize a new cycle cook to replace the lock. Style teacher `lock/bolt-back.jpg` if a still / repose is needed. Preview only: `lock/bolt-gallop-cycle-12s-preview.mp4`.

**HARD LOCK — make / add a biome.** Décor scrolls (rush); Bolt sprints **IN PLACE** (treadmill). Mid-lane. **48fps**. Style teacher = `lock/bolt-back.jpg`. Pipeline (do not invert): empty plaque ZERO dog → Video A `imagineBiomeClip` first+last → **REUSE** `lock/bolt-gallop-cycle.mp4` (no new Imagine dog sprint) → key + despill → composite cutout onto A (AFF stack) → **COMPOSITE GATE** scale + gallop-clock + plate-grade + paw contact **BEFORE** KEEP. Speed/scroll = plate; gait = locked cycle. L/M/R = code X shift of **one** Bolt layer. **Never** cook a new Bolt sprint for a biome. **Never** chat Imagine alone. **Never** hall `imagineClip`. **Never** a single baked final film. **Never** a 3-Bolt mask. No `XAI_API_KEY` → REFUSE / stock. Law: [docs/10-bolt-cutout-law.md](docs/10-bolt-cutout-law.md) · [docs/09-recette-biome.md](docs/09-recette-biome.md).

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
| **Road** (master) | empty-plate first + last — **ZERO dog** | `imagineBiomeClip` `image` + `last_frame` (distinct, **48fps**) |
| **Bolt cutout** | **REUSE** sealed [`lock/bolt-gallop-cycle.mp4`](../lock/bolt-gallop-cycle.mp4) — already rear / green / rotary. Style ref [`lock/bolt-back.jpg`](../lock/bolt-back.jpg) if a still / repose is needed ([docs/10-bolt-cutout-law.md](docs/10-bolt-cutout-law.md) · [docs/14-rotary-gallop.md](docs/14-rotary-gallop.md)) | **No new Imagine dog sprint.** Key + despill that cycle → composite onto Video A (AFF). Speed/scroll = plate; gait = locked cycle. |

Prompts: [prompts/](prompts/). Law: [docs/01-images.md](docs/01-images.md) · [docs/02-videos.md](docs/02-videos.md) · [docs/10-bolt-cutout-law.md](docs/10-bolt-cutout-law.md). After empty+cutout KEEP: author `path.json` — [docs/12-lane-path-ribbon.md](docs/12-lane-path-ribbon.md) (living-film Lane, not SprintCore). Without the chart = film. With it = game.

```
# dry thought-queue only — no new grok.me
# live cook needs XAI_API_KEY + imagineBiomeClip (road). Bolt = REUSE lock/bolt-gallop-cycle.mp4 (imagineBoltClip = SmiR only)
# drop PASS masters into biome/master/ (see master/README.md)
```

Cannot run `node` + `XAI_API_KEY` → **REFUSE**. Open stock Sprint in-app. Do **not** use chat `imagine_image_to_video` / `imagine_reference_to_video` (no `last_frame`). Do **not** use Imagine Agent for video.

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

Chat Imagine has no `last_frame`. Use `imagineBiomeClip` in [../scripts/imagine-hooks.mjs](../scripts/imagine-hooks.mjs).

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
- Chat Imagine alone for Video A / Video B / Bolt (hooks first+last only)
- Invent C-light as a required lock
- Recook citadel `packs/<slot>` because someone said sprint
- Chat Imagine without real first+last
- Imagine Agent video
- Recook to hide a key bug
- Full-width hazard on LEFT+CENTER+RIGHT (nowhere to dodge)
- Wipe hung `biome/master` / `public/master` to “make room” for a new biome (Hang ≠ wipe — Tide cook FAIL)
- Rebuild canyon→cars→duel→night→war first, or require Beat 3 recook as a gate, before hanging a new biome
- Copy hung `biome/master/bolt.mp4` / canyon Bolt as the new-biome identity (always `@ref` `lock/bolt-back.jpg`)
- Refuse a new biome name / “I can only do Tide” (name + `{PAINT}` allowed; Tide is one example)
- Playlist = new-biome-only unless SmiR / player explicitly says replace the default Beat
- Dump the chat biome catalog on Welcome, or invent unhung biome names (on ask; hung chapters only; a biome in cook is not hung until hung)

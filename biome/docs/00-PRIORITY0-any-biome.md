# PRIORITY 0 — Any biome = Frost-parity (random player, cold Grok)

**START HERE** → [`../scripts/biome-cook/README.md`](../scripts/biome-cook/README.md) in order (steps 1→17). Paste [`COLD_START-biome-cook.md`](COLD_START-biome-cook.md). This file stays the parity law.

**Audience:** a brand-new Grok in a brand-new conversation, cooking **any** named biome (Frost, Tide, Ember, invented `{PAINT}`). Not Frost-only.

**Target parity:** same *feel* as the sealed Frost Live finale —
GPU compositor (no CPU `getImageData` hot path) · sealed **6 s** gallop · auto-scale · **plate bounce** · contact shadow · **biome-adaptive ground FX** · hang ≠ wipe · Pack auto-wire.

**Live compositor = [17-live-compositor.md](17-live-compositor.md).** Copying the old scissor / IGN-fract sketch = **FAIL**.

**GPU_VER 24 KEEP = [22-gpu24-frost-keep.md](22-gpu24-frost-keep.md).** (`21-paw-to-galaxy.md` is a different law.) Do **not** `mix(c, plate, 0.10)` raw. Do **not** 5-tap smear the body. Dual-paw contact, ice Fresnel, plate IBL. Copy hung `bolt-key-gl.ts` (`GPU_VER = 24`).

**Empty still defaults = [20-default-plate-proportions.md](20-default-plate-proportions.md).** Start **any** biome empty still / Video A from the **full** measure set — not φ-only, not Frost-only: 3-lane **~0.75–0.82** · sky **~45%** · plant **~0.80** · Bolt X **0.50** · withersFrac **~0.10 KEEP** · GPU start sat **0.54** / bounce **0.42 bounceSrc** / contact `k` **0.34** dual-paw (law 22). Player / `{PAINT}` may adapt. Frost aurora is the worked example ([20b](20b-frost-aurora-proportions.md)). Ice-hole / Beat-narrow road as silent default / grow Bolt to fake withersMin 0.22 = **FAIL**.

**Lane material = [35-lane-materials.md](35-lane-materials.md).** Law 20 does not paint the road. Before P0 stills, propose menu A–D (Obsidian glass, Crystal quartz, Luminous ribbon, Mix vault) unless `{PAINT}` already names a surface. Grey concrete asphalt / MS-Paint dashes on béton / a boring nationale with no biome paint = **FAIL** as the silent default.

Player may be random. Grok must not ask them to install Pack, invent a dog sprint, or wipe old biomes.

---

## A. Fixed forever (every biome)

| Piece | Law | Where |
|---|---|---|
| Bolt motion | **REUSE** `lock/bolt-gallop-cycle.mp4` = **6 s / 96 fps / 534 frames / `#00FF00` / rear** | [lock/README.md](../../lock/README.md) |
| Style teacher | `lock/bolt-back.jpg` (show in chat before still/repose) | [10](10-bolt-cutout-law.md) |
| Architecture | B-stack: empty road Video A + keyed Bolt cutout. Never bake Bolt into one film | [09](09-recette-biome.md) |
| Compositor | **GPU from frame 0** — copy `bolt-key-gl.ts` **+** `wet-fx.ts` (`GPU_VER 24`). Quad dest, luma protect, **neon-safe bounce**, dual-paw contact, ice IBL, rVFC stamp | [22](22-gpu24-frost-keep.md) · [17](17-live-compositor.md) · [15](15-gpu-compositor.md) · [WIRE](../scripts/bolt-key-gl/WIRE.md) |
| Scale | `computeScale` / `assertScale` (13d) after key. On a **wide** law-20 road, withersFrac ~0.10 is KEEP — do not grow to 0.22 | [13d](13d-auto-scale.md) · [20](20-default-plate-proportions.md) |
| Clock | `gallop-clock` / `assertGallopClock` (14c) — native fps, `plate_time` | [14c](14c-gallop-clock.md) |
| Contact | Paw multiply shadow on **road** (13b); weaker in air | [13b](13b-anti-sticker-contact.md) |
| Light | **Plate IBL HARD** — neon-stripped `bounceSrc` + hemi sky/fill (law 22). Never raw plate mix | [22](22-gpu24-frost-keep.md) · [17](17-live-compositor.md) · [13b](13b-anti-sticker-contact.md) |
| Ground FX | **Biome table** — paw trails + splash/dust, Euler quads, phase-locked | [16](16-biome-ground-fx.md) · `wet-fx.ts` |
| Hang | ADD plates beside masters. Never wipe canyon→war | [09](09-recette-biome.md) |
| Plate geo | `plate-geo-qc.py` **PASS before hang** (1-point / lock-off / sag) | [23](23-plate-geo-qc.md) |
| Camera | Sprint = **conical 1-point lock-off**. Paste `camera-1point.txt`. Not 2-pt / 3-pt on Video A | [24](24-camera-1point.md) |
| Hazard | 1–2 lanes on the cone. `plate-hazard-qc.py --expect 1` PASS. Never a 3-lane wall. Rail A is **dodge**, not destroyable | [25](25-hazard-cone.md) |
| Howl targets | Rail B = Imagine keyed obstacles, GPU-placed like Bolt, Howl-destroyable. Shatter = separate plate per type. Howl = **REUSE** [`fx/howl/howl-attack.mp4`](../fx/howl/howl-attack.mp4) (SmiR KEEP). Vertical rings, birth narrow → wider, locked cam, black key, no baked shatter. Not a shader. Width/speed may tune in Live | [32](32-howl-gpu-targets.md) |
| Howl live | Bolt→target trapezoid, `howlFireSec`, **cut on contact**, shatter swap, wet GPU (bounce + road mix). Copy `scripts/howl-live/` | [34](34-howl-live-aim.md) |
| Plate seam | `plate-mae-qc.py` last frame N vs first N+1 **before hang**. Exit non-zero = FAIL | [33](33-plate-mae-qc.md) |
| Momentum `m` | Success → next plate **+1 `@` ref** (keep stack, richer). Miss → −1. d1+ **≥1 spectacular hazard** | [22-m](22-m-densify-snowball.md) |
| Sprint plan | **10 plates written before d1.** Spine + per-plate beat / +1 / hazard / GPU Howl target. Cook in order | [26](26-biome-sprint-plan.md) |
| Pack | Auto-embed `BOLTVERSE_PACK_ORIGIN=https://boltverse-pack.vercel.app` + `pack.js` | [07](07-pack-live.md) |
| Play controls | A/D or side swipe = lanes · W / swipe up = jump | [PLAY.md](../PLAY.md) |

Constants:
```
CYCLE_FPS = 96
CYCLE_FRAMES = 534
STRIDES_PER_CYCLE = 22
bolt.loop = true
playRate = 1
```

Remux lock → Live `public/master/bolt.mp4` (`-an` +faststart), bump `?v=`. Do **not** invent a new gallop. Archive `lock/bolt-gallop-cycle-0.93s-prev.mp4` = FAIL as play cycle.

---

## B. Biome-variable (`{PAINT}` + FX row)

Only these change per biome:

1. **Empty plate paint** — **lane material**, roads, light, weather (`image-empty-plate.txt` + `{PAINT}`, and `{LANE_MATERIAL}` from [35](35-lane-materials.md)). Frame skeleton starts from [20](20-default-plate-proportions.md) unless the player asked a different framing. Law 20 is width / sky / plant / 1-point. It is not a concrete highway. Before P0 stills, propose menu A–D unless `{PAINT}` already names the road. **BAN** grey concrete asphalt, MS-Paint dashes on béton, and a boring nationale with no biome paint as the silent default.
2. **Hazard cousins** — same camera grammar, biome objects.
3. **Grade / FX row** from [16](16-biome-ground-fx.md) + `uniformsFor(chap)` in [17](17-live-compositor.md).
4. **File names** — `road-<biome>.mp4`, `road-<biome>-*.mp4`, never overwrite hung `road.mp4` unless SmiR says replace Beat.
5. **Frost KEEP picture** (if hanging Frost) — aurora + thin snow + green neon dashes. Measures in [20b](20b-frost-aurora-proportions.md). Paste [COLD_START-frost-aurora.md](COLD_START-frost-aurora.md).

Bolt identity, gallop file, GPU path, scale, clock, Pack = **identical**.

---

## C. Ordered cook (copy this)

1. Show `lock/bolt-back.jpg` + `lock/bolt-gallop-cycle.mp4` in chat (teacher gate).
2. Still empty first + distinct last — ZERO dog. **Lane material first** ([35](35-lane-materials.md)): menu A–D, or the material already inside `{PAINT}`. Then **law 20 frame measures**. Grey concrete asphalt as silent default = FAIL. **Law 36 before this still:** densify stays one plate. GPU zones are keyed layers over it ([36](36-gpu-zones-lena-procedural.md)). Runtime [`../scripts/lena-lod/lenaLod.js`](../scripts/lena-lod/lenaLod.js). Do not slice Video A into spatial GPU tiles. **Law 37** does not bake lanes into that plate: the chemin is `pathBeatFrame` (~3 s ahead) on the Howl cone ([37](37-path-beat.md)). **Law 38** does not bake playable lights or open states into that plate: `lightLayerFrame` / `openableFrame` on the same cone ([38](38-gpu-light-openable.md)).
3. Video A — extract last frame of the previous plate (P0: empty first still) → cook the last still → Imagine Video **first+last** (SuperGrok session, or `imagineBiomeClip` when `XAI_API_KEY` is set). **48 fps**, SPEED LAW. Then `plate-mae-qc.py` (P0 has no seam). Missing key is not a stop. Frost: **no** `setpts` 2.7× warp ([20b](20b-frost-aurora-proportions.md)).
3b. **Law 23 geo qc PASS** — `python3 biome/scripts/plate-geo-qc/plate-geo-qc.py` the new plate. FAIL = recook, do not hang. Imagine camera block: [camera-1point.txt](../prompts/camera-1point.txt) (law 24).
4. REUSE lock cycle → key + despill (13c) — **law 17** GPU even in cook QA.
5. `computeScale` / `assertScale` (13d). Wide road: do not grow Bolt to hit withersMin.
6. Wire Live: `makeCompositor` **before** `getContext("2d")` ([17](17-live-compositor.md)).
7. `gallop-clock` / native loop 1× (14c).
8. Plate **IBL + bounce (law 22)** + **dual-paw** contact + ice FX row (16 / wet-fx). No 5-tap body blur. No skateboard shadow. No dark frost prints.
9. Hazards (spawn far, 1–2 lanes, plate-speed match). **Law 25** `plate-hazard-qc.py --expect 1` PASS before hang. Rail A stays dodge-only.
9b. **Law 32** only when the sprint plan names a GPU Howl target. Keyed obstacle + per-type shatter. Howl attack = **REUSE** [`../fx/howl/howl-attack.mp4`](../fx/howl/howl-attack.mp4) (SmiR KEEP — do not recook). Anti-sticker 13b / 15 / 17. Do not bake them into the road. Do not shader the rings.
9b2. **Law 34** wire: copy `biome/scripts/howl-live/`. Trapezoid Bolt mouth → prop (inset tip). `playbackRate = clipFront/fireSec`. **Pause Howl on contact** even if the mp4 remains. Swap that type’s shatter. Wet GPU (`howlWet.glsl`). Noun is biome-variable; math is not. BAN dogs / laser / overshoot.
9b3. **Law 37** path beat: copy `biome/scripts/path-beat/`. `pathBeatFrame` each tick. Target lane reveals ~3 s ahead **in the road** (`lookahead` 3.0) — lane lights, detail forms, void fills. Not a HUD arrow. `gradeFromPlate`. Approach = densify / Lena step. Shadow only in the near band. SIDES resolves at contact (`hit` / `miss`). Same cone as Howl / Lena. Densify stays one clock, one loop. `assertPathNative` must be empty. **GPU is REQUIRED** — do not paint the path into Video A. Do not tile it. Paste [COLD_START-path-beat.md](COLD_START-path-beat.md).
9b4. **Law 38** light layers + openables: copy `biome/scripts/gpu-light/` and `biome/scripts/gpu-openable/`. Imagine cooks light-only keyed plates (beam / glow / neon / flash) and closed / open / transition bibs. `lightLayerFrame` owns intensity, tint, on/off, cone, fade. `openableFrame` owns hit, open/close, Lena band, optional content. Same `howlPose`. Plate zones `road` | `sideL` | `sideR`: gameplay on the lanes, décor / lights / openables / generators also on the shoulders. Densify sides stay relatively empty. `assertLightNative` and `assertOpenableNative` must be empty. **GPU is REQUIRED** — do not paint a beam, an open door, or side clutter into Video A. Pack RT: baked path-traced look (`rtLook: "baked-imagine"`). Fake interactive gloss, `bounces: 0`. FAIL flat plastic. FAIL real-time raytracing via Imagine. True RT is the UE rail, HOLD. Paste [COLD_START-gpu-light-openable.md](COLD_START-gpu-light-openable.md).
9c. **Law 33** seam PASS — `plate-mae-qc.py` last(N) vs first(N+1) — before hang of any plate after P0. Exit non-zero = recook.
10. Hang ≠ wipe + Pack wire + bump `GPU_VER`.
11. Smoke: dogFps ≈ min(96, display); hind paws intact; **no vertical bars**; **no neon stripe through torso**; **sharp interior** (not body-blur); shadow on road (no skateboard); FX visible on plant; coat matches THIS plate; no truck scale.

**FAIL** if: invent sprint · CPU key every rAF · **copy scissor/IGN sketch** · wipe masters · hang without composite gate · skip bounce / FX row · bake Bolt into road mp4 · SPH / Box2D · grey concrete / béton highway as silent lane default (law 35) · chop one densify plate into spatial GPU tiles (law 36) · bake the target lane into densify Video A (law 37) · bake a playable light, an open door / chest / generator / hatch, or side clutter into densify Video A (law 38) · ice-hole / Beat-narrow road as silent default · grow Bolt to fake withersMin on a wide road · **raw `mix(c, plate)` neon leak** · **5-tap body smear** · **print RGB < 0.3 on frost** · `cSharp = rgb/a` double unpremul · shader a Howl or bake shatter into it (law 32) · Howl overshoots the prop or keeps playing after contact (law 34) · hang a seam that law 33 FAILed · stop Video A because `XAI_API_KEY` is unset · one-still I2V · “forcé localement” · claim MAE PASS without `plate-mae-qc.py`.

---

## D. Cold-start message (kitchen — paste into Build when cooking)

**START HERE:** [`../scripts/biome-cook/README.md`](../scripts/biome-cook/README.md) · paste [`COLD_START-biome-cook.md`](COLD_START-biome-cook.md). Follow that order. The pastes below stay the parity briefs.

Use [COLD_START-any-biome.md](COLD_START-any-biome.md) (starts empty stills from [law 20](20-default-plate-proportions.md)). Frost GPU KEEP paste: [COLD_START-gpu24.md](COLD_START-gpu24.md). Frost picture KEEP: [COLD_START-frost-aurora.md](COLD_START-frost-aurora.md). Do **not** use the old Frost share paste that said “don’t use `lock/bolt-gallop-cycle.mp4`” — on `main` that file **is** the 6 s canon.

Player boot (“start odyssey”) stays [START.md](../../START.md) — Welcome + teaser + play URL. This doc is **cook**, not Welcome.

**Play / Live KEEP:** https://boltboltverse-odyssey.grok.me

---

## E. Journey after seal

This biome cook is **after** the player seals a planet on the room star map and taps door A/B. ROOM (2 doors + center star map) → constellation Space LOD → seal planet → return room → door → **this biome sprint** → Dr Lena Paw-to-Galaxy climb → arrive sealed planet. Law: [18-room-starmap-lena.md](18-room-starmap-lena.md). Paste: [COLD_START-room-starmap.md](COLD_START-room-starmap.md). Lena climb = **luminous 3-lane path** under Bolt (not float); same L/C/R + REUSE 6s. Law: [19-luminous-path-climb.md](19-luminous-path-climb.md). Paste: [COLD_START-luminous-path.md](COLD_START-luminous-path.md). Incline / duration / space look: [21-paw-to-galaxy.md](21-paw-to-galaxy.md). Paste: [COLD_START-paw-to-galaxy.md](COLD_START-paw-to-galaxy.md). Map = destination. Door = depart. Hang ≠ wipe.

# GROK.md — handoff for a fresh Grok

Read this **before** touching code or recooking a film.

This repo is **boltverse-constellation** (`StarBoltSprint/boltverse-constellation`).
It is the **SPACE LOD KEEP** of the Star Map.

**HARD BAN:** do not open PRs, push, or edit `boltverse-odyssey`, Pack, biome/master, or any Odyssey file. Copy of Law 0 only. This KEEP lives alone.

The player is on **Samsung Browser, portrait phone**. They have no shell. They watch a live preview. Speak in product terms, never ports or paths.

---

## Product (what they should see)

One void. **Star Core** in the middle. Five worlds hung with **real gaps**.

| Id | Name | Kind |
|----|------|------|
| `core` | Star Core | round glowing **orb** + lightning filaments. Not an anatomical heart. |
| `tide` | Tide | ocean + ring |
| `canyon` | Canyon | rust desert (LOD rocket zoom lives here) |
| `crystal` | Crystal | ice |
| `hollow` | Hollow | dark moon |
| `drift` | Drift | ash |

- Zoom **in** on Core → cinematic fullscreen Imagine loop.
- Zoom **out** → constellation, void between plates.
- **No collage.** No grid. No rectangles. No play-gate splash.
- Imagine videos are **billboards**. Twist / tiny parallax is OK so they do not read as stickers.
- Canyon only, extra: pinch further → approach plate → aerial canyon → oblique flyover. **One crossfade at a time. No camera cut.**

Controls: pinch, twist, drag. Buttons **Core** / **Map**. Title names the focused world.

---

## Files that matter

| Piece | Path |
|-------|------|
| Map, pinch, LOD mix, Core/Map | `src/components/constellation/ConstellationMap.tsx` |
| Void stars / nebula | `src/components/constellation/Starfield.tsx` |
| Positions, video URLs, LOD alphas | `src/lib/constellation/world.ts` |
| Camera, pinch tame | `src/lib/constellation/camera.ts` |
| Sphere impostor + flat plates | `src/lib/constellation/impostor.ts` |
| Cooker (first+last Imagine) | `scripts/imagine-planet-hooks.mjs` |
| Kill Imagine dolly | `scripts/lock_globe.py` |
| Optical-flow slow-mo | `scripts/rife_slow.py` |
| Law | `LAW.md` |
| Cook details | `METHOD.md` |
| This handoff | `GROK.md` |

Live films: `public/videos/<id>.mp4` + `.jpg` poster. Cache-bust `?v=` in `world.ts` after every replace.

Canyon extra: `canyon-lod1` (closer globe), `canyon-lod2` (nadir aerial), `canyon-lod3` (oblique flyover).

---

## Law 0 — how every orbital film is cooked

**Always** first frame **and** last frame. API `POST /videos/generations` with `image` + `last_frame`.

Never chat Imagine. Never `image_to_video` on one still for a spin. If first = last, Imagine **holds still**.

```
still  →  last still (~15–20° yaw of the SAME body, same pixel radius)
       →  Imagine video (locked tripod prompt)
       →  lock_globe     (constant radius + center)   ← FIRST
       →  RIFE 4×        (same fps, more frames)
       →  ping-pong      (forward + reverse = loop)
       →  public/videos/<id>.mp4
```

**Order is law.** RIFE on an unlocked clip **amplifies zoom**. Lock first.

Prompt, every time:

- CAMERA LOCKED — tripod. No pan, tilt, zoom, dolly, push, pull, flyover.
- FULL disc always visible. Black void around the limb.
- NO morph. NO size change. ONE body only.
- ONLY a slow axial rotation (planets) **or** pulse + filament wave (Core).
- Core is a **round orb**, not a heart. Filaments stay in every frame.

```bash
export XAI_API_KEY=...
export RIFE_ROOT=/tmp/Practical-RIFE
node scripts/imagine-planet-hooks.mjs canyon
```

Do **not** recook `canyon.mp4` / `canyon-lod1.mp4` unless the user explicitly asks. They locked those.

---

## Sphere impostor (why it looks 3D, not a sticker)

The film is a **square**. The shader cuts a **geometric disc** (`IMPOSTOR[id].source`).

- Interior stays opaque — **including the night side**.
- **Never luma-key the body.** Keying dark pixels punches a hole in the terminator (Tide / Canyon black-circle bug).
- One sample. Never stamp a second disc (nested-globe bug).
- Fake volume: `z = sqrt(1 − r²)` + tiny parallax. Freeze parallax (`para = 0`) during LOD fades.
- Star Core may keep a **soft luma corona** (it is a star).
- Canyon `source` sits **inside** the painted globe so a leftover halo cannot show as a crescent.

`uFlat > 0.5` → skip the disc, sample the full plate (LOD2 / LOD3 aerial).

---

## LOD rocket zoom (Canyon first)

Goal: pinch toward Canyon like a rocket approaching, **no camera cut**, only Imagine plates.

`u = globeU(platePx, source, vw, vh)` — `u = 1` when the disc limb touches the **short** side of the screen.

| Band | Plate | Alpha | What you see |
|------|-------|-------|----------------|
| LOD0 | `canyon.mp4` | holds, then yields | round orbital globe |
| LOD1 | `canyon-lod1.mp4` | `lod1Alpha` from u≈0.85 | sharper globe, **same circle** |
| LOD2 | `canyon-lod2.mp4` | `lod2Alpha` from u≈0.94 | nadir aerial canyon, `flat` |
| LOD3 | `canyon-lod3.mp4` | `lod3Alpha` from u≈3.2 | oblique flyover, `flat` |

Rules:

1. **Globe stays a circle.** Cap disc diameter to `0.86 × min(vw,vh)`. Never let it become an oval / egg.
2. `u` is computed from the **uncapped** size so pinch past fill still drives LOD2.
3. One fade at a time. LOD2 covers as soon as the globe fills — do **not** keep zooming a cropped oval globe.
4. Sticky focus: once `u > 0.7` or `zoom > maxZMap`, title stays CANYON.
5. Hide other planets when `a1 > 0.22`.
6. Samsung: pause unused videos. Budget ~3 decoders. Globe **or** surface, not both at full play.
7. Canvas buffer **must** match `canvas.clientWidth/Height` (not `window.innerHeight`). Samsung URL bar stretches a mismatched bitmap into an oval.
8. `tameZoomFactor` kills 2×–10× Samsung pinch jumps but must **not** feel dead. Clamp ~0.78–1.28, gain 1 → 0.62 at surface.

Do **not** recook LOD0/LOD1 to “fix” the oval. The oval is a **draw/cap/aspect** bug, not a film bug.

---

## Bugs we already paid for (do not regress)

| Symptom | Cause | Fix (already in tree) |
|---------|--------|------------------------|
| Black disc / eaten night side | luma-key on the body | geometric disc only |
| Nested second globe | two discs / halo ring | one sample, source inside paint |
| Sticker / flat card | no impostor, no parallax | disc + z + tiny twist |
| Planet morphs / grows in film | Imagine dolly | lock_globe then RIFE |
| Fast cartoon spin | raw Imagine | RIFE 4× + ping-pong |
| Core is an anatomical heart | bad prompt | round orb + filaments, recook Core |
| Core heart frozen, only filaments move | still first=last + no boil | distinct last still + shader boil |
| Play splash | gate page | removed — land on the map |
| Planet **vanishes** into void at high zoom | plate bigger than canvas, UV clip, LOD gap | cap disc, overlap LOD bands, lod0 holds until lod2 covers |
| Title jumps to DRIFT while in Canyon | focus lost | sticky focus |
| Zoom **jumps** (`boum boum`) | raw pinch factor 2–10× | `tameZoomFactor` |
| Zoom too numb after that | gain 0.2 | restored ~1.0 map / 0.62 surface |
| **Oval / egg globe** on Samsung | canvas bitmap stretched to `h-dvh` ≠ `innerHeight`, and/or disc diameter > short side | measure `clientWidth/Height`, square cap |
| Square aerial plate with black bars | lod2 sized as a card | `flat` fullscreen cover |
| LOD2 identity jump | mismatched crop | recook from the same canyon still, inner crop |

If the user sends a video of a vanish or an oval: **look at the frames**, then fix draw/cap/LOD mix. Do not recook orbital films.

---

## Samsung

- Hard refresh (close tab, reopen) after `data-rev` bump on the root (`ConstellationMap` `data-rev="lod3e"`).
- Max ~3 playing `<video>` elements. Pause lod0/lod1 when lod2 is covering.
- Pinch events are noisy. Never apply raw `d / prev.d`.
- `visualViewport` resize/scroll must remeasure. URL bar lies.

---

## Recook commands

```bash
# orbital worlds (Law 0)
node scripts/imagine-planet-hooks.mjs canyon
node scripts/imagine-planet-hooks.mjs --force core

# lock + measure
python3 scripts/lock_globe.py --video in.mp4 --output locked.mp4
python3 scripts/lock_globe.py --measure --video locked.mp4 --output -
python3 scripts/lock_globe.py --star --video core-in.mp4 --output core-locked.mp4

# RIFE
export RIFE_ROOT=/tmp/Practical-RIFE
python3 scripts/rife_slow.py --video locked.mp4 --output rife-raw.mp4 --multi 4 --fps 24
```

Kitchen leftovers: `public/videos/_spin/` (gitignored).

LOD2/LOD3 were cooked with Imagine **image-to-image** from a crop of `canyon-lod1.jpg` (inner ~76–84% to drop vignette), then video with first=last-ish locked camera over terrain. Do not morph the globe into the canyon. Do not change LOD0.

---

## Push

Public repo only: **https://github.com/StarBoltSprint/boltverse-constellation**

```bash
# KEEP only. Never boltverse-odyssey.
```

After replacing a video, bump `?v=` in `world.ts` and `data-rev` on the map root.

---

## Do not

- Touch Odyssey.
- Luma-key a planet interior.
- Mix a second disc on the first.
- Let the globe become an oval.
- Recook a locked film to fix a shader bug.
- Turn the sky into a photo wall.
- Add a play-gate.
- Stack 5 videos playing on Samsung.
- Invent a 3D mesh canyon — Imagine plates only, no camera cut.

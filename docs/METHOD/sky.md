# Sky — recipe (any biome)

Back to [METHOD.md](../METHOD.md). **Status: IN TEST** — zone A step 2 (branch `zone-a-step2-sky`) built it; Director QC
2026-10-03 found blockers (§4), so it is not approved yet. The METHOD sky row (2026-10-02) stays the law; this page is how to
build it. Palettes and exact Imagine prompt text stay in untracked `*.local.*` files and in
`/workspace/grokcli/out/<zone>-step<N>/provenance.json`.

## 1. Parts

| Part | What | Pixels from |
|---|---|---|
| Ring | 8 chained Imagine slices (60° HFOV, 45° step), pixel-joined into one closed 360° strip; ≥ ~32 px per degree so magnification ≤ 1.0 at the play hfov (720 px / 22.7°). Joins: 2–4 % crossfade of the two slices' own pixels (`resolveSeamBlend`), after the slice gate. | Imagine `image_gen` / `image_edit` chain |
| Cap | One Imagine zenith still projected around the pole, blended into the ring top with the two images' own pixels. Must cover every elevation above the ring with texels at magnification ≤ 1.0 (no edge clamp smear). | Imagine still |
| Living layers | ≥ 3 seamless Imagine video loops of different lengths (about 13 / 17 / 29 s; first = last frame or ping-pong). One decoder per layer; **sampled per slice at the start offsets in `sky.json`** (see `tools/sky/README.md`), keyed over the ring, never one low-res frame stretched over 360°. ≤ 4 decoders incl. Bolt. | Imagine `image_to_video` / `reference_to_video` |
| Fog | Fog colour sampled by code from the ring's horizon band pixels. Never typed. | Imagine pixels (sampled) |

The ring is a far backdrop: centred on the eye, it never moves with Bolt.

## 2. Steps (~1 h)

1. `python3 tools/kits/kit.py show --id <id>` (sun azimuth / elevation / kelvin, time of day). Write the local prompt file.
2. Ring: anchor slice, then chained edits around the circle (each edit sees its neighbour), the last one also sees the first.
   Put the kit's sun glow in the slices that face the sun azimuth. Gate: `python3 tools/sky/check.py --slices <dir>`.
3. Cap: one zenith still from the ring's top colours (edit with ring slices as sources).
4. Layers: stars, dust and nebula loops from ring frames; gate `python3 tools/sky/check.py --manifest sky.json`.
5. Hang it: dome in eye space, ring band + cap + layers; fog from `sampleHorizon`. Check mag, decoders, texMB.
6. QC on the phone view (412×915 CSS, DPR 2, plus landscape): all 8 joins incl. the wrap, straight up, the highest crest,
   the rim, the sun azimuth, and a ≥ 20 s turning clip that crosses every layer's loop restart.

## 3. Gates

`python3 tools/sky/check.py` (slices + manifest), `python3 tools/sky/selftest.py`, root `npm test`, `tools/playcheck` npm
test; play mag_max ≤ 1.0 **for every sky texel that is visible, layers and cap included**; no console errors.

## 4. Pitfalls seen in zone A step 2 (Director QC 2026-10-03)

- One 848×480 video frame stretched across the whole 360° and mixed at high weight: about 13× magnification and a washed-out
  sky. Breaks law 65 even though the slice mag reads 0.994.
- Fading that veil out at azimuth 0: a hard vertical seam and brightness step at heading 0.
- Cap texture clamped to its edge between the ring top and about 77° elevation: radial streaks, a near-flat slab and a
  pole notch when looking up.
- Video loop restart: the layer drops for a frame when `loop` seeks back to 0 (`uploadVideo` returns false) — a visible flash.
  Hold the last uploaded frame instead of dropping the layer's weight.
- Sun glow present in the slice pixels but not readable in play once the layers cover it.

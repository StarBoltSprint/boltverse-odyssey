# COLD START — Nebula Lane (laws 39, 40, 41)

Read this **first** if the player says Nebula Lane, the 4th biome, eclipse, or "look left and see the planet".

Then read, in order:

1. [39-imagine-live-light.md](39-imagine-live-light.md) — a prop is an Imagine video lit like the plate. Clean key. No regrade.
2. [40-nebula-cycle.md](40-nebula-cycle.md) — nebula → shore → disk → eclipse, 30 s + 3.2 s fade, continue from the last frame, trim the slow head.
3. [41-eclipse-look.md](41-eclipse-look.md) — 3D yaw only on eclipse. Videos stay videos.

## Do this

1. Keep the sealed Bolt cycle. Do not cook a new dog.
2. Cook four road plates. Lock the lane count and the vanishing point on every one. Shore rushes like nebula. Disk continues from its own last frame (do not loop the 6 s mouth). Eclipse continues from the disk's last frame. Trim the glued first 1–2 s.
3. Crossfade with two textures and `uMix`. Lerp Bolt's uniforms with the same mix. Wait until the next video is ready.
4. Crystal, globule, howl ring: one Imagine video each, pure black, plate colors. `uClean` returns the video color. `howlFireSec = 0.28`. The howl stops on the crystal it was aimed at. No rectangles. No arcs.
5. On eclipse only: drag yaws (`look * 0.62`). Tap still changes lane. Ice card on the left, copper giant on the right, both off-screen at rest. Sky shader behind them. Ease back on release.
6. Optional gate at start: "Depuis le début" (`biomeIdx = 0`) or "4e biome" (`biomeIdx = 3`). Freeze `runT` until the choice.

## Fail

- A still, a mesh, or a graded bib where law 39 asked for a video.
- A 6 s tunnel that rewinds to its first frame.
- Yaw on a biome that is not eclipse.
- UV slide and yaw together.
- Stars baked into the planet file.

Numbers: [../scripts/imagine-live/imagineLive.js](../scripts/imagine-live/imagineLive.js) and [../scripts/eclipse-look/eclipseLook.js](../scripts/eclipse-look/eclipseLook.js).

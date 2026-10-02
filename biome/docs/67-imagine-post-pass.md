# 67 — Light post-pass on Imagine pixels (fog, grade, bloom) — EXCEPTION

Kitchen only. Not a hang. **HARD / EXCEPTION ONLY — owner-approved (SmiR) 2026-10-02.** Official exception.

**This page names no biome, no sky style, and no colour.** Paint stays in the Imagine assets. Each player picks the style. This page only says which light passes code may run on top of those pixels.

Every source pixel still comes from Imagine. Code may adjust Imagine pixels with the three passes below. It never adds a pixel of its own. Law [59](59-invisible-depth-carrier.md) stays the only no-mesh exception. Law [65](65-render-quality.md) stays the draw path. This page sits on top of both and does not loosen either. Do not invent a second post-pass law.

## ALLOWED — three light passes, nothing else

Code **MAY** apply these three passes on top of Imagine pixels:

1. **Distance / exponential fog.** The fog colour is **sampled from an Imagine sky or plate** of that same scene (for example, a horizon band of the sky plate, averaged). Never an invented colour, never a hard-coded RGB, never a colour picked by eye. Fog follows the invisible shape's depth (law 59 relief / hull / ground distance). It never hides a missing asset.
2. **Light colour grading.** A tone curve (ACES- or AgX-style), subtle saturation and contrast. **One consistent grade per biome**: every zone, corridor, plate, and keyed layer of that biome goes through the same grade. No per-object grade, no grade that changes with the camera.
3. **Subtle bloom on bright Imagine highlights.** Only pixels that are already bright in the Imagine source bloom. Bloom strength is capped (see Bolt lock). Bloom never invents a light source.

## Still FORBIDDEN

Everything else stays forbidden, as before:

- real-time lights, light sources, or any lighting model;
- shadows (cast, contact, or screen-space) drawn in code — "Never draw shadows in code" stays;
- ambient occlusion (SSAO or any other);
- computed reflections or refraction (SSR, cube maps, planar mirrors);
- code-drawn particles (law [53](53-gpu-particles.md) stays: every particle samples an Imagine texture);
- non-Imagine 3D models or non-Imagine textures (no `.glb`, no stock texture, no procedural noise texture);
- any pass that draws its own colour, shape, or detail.

Laws 38 (`raytrace` false, fake interactive light only from keyed Imagine light layers) and 59 (the carrier never draws its own pixels) are unchanged.

## Phone budget

- Holds on the **720×1600** phone play view (360×800 CSS at DPR 2, law 65 `fullscreen` row).
- Prefer **one combined fullscreen pass** (fog + grade + bloom composite) at **native resolution**. A **half-resolution bloom** buffer (bright-pass + blur) is allowed; the composite stays native.
- **Zero quality loss** (law 65 rule 1): no visible banding, no blur, no sharpness loss on the Imagine pixels. Magnification stays ≤ 1.0. Grade and fog never soften the picture; only the bloom halo itself is soft. If banding shows, fix precision or add dither; do not drop the pass resolution.
- Law 65 filtering and mipmap rules still apply to every world texture under the pass (`LINEAR_MIPMAP_LINEAR` + mipmaps on stills, `LINEAR` on video, no `NEAREST` on a world texture). The pass target itself is never upscaled onto the screen.
- The pass allocates nothing per frame (law 65 rule 6).

## Bolt lock

- Bolt (`lock/bolt-gallop-cycle.mp4` gallop and `lock/bolt-idle-breath.mp4` idle breath) stays **readable**. Fog and grade must not wash him out: his white coat and silhouette stay distinct from the ground and sky at every distance he can stand at.
- Bloom strength is **capped**; Bolt's coat must not glow or bleed into the plate. If the coat crosses the bloom threshold, lower the strength or raise the threshold, never recook Bolt.
- The pass never changes the Bolt files. Same wolf, same key.

## Perf report — fps before and after

Every take that adds or changes this pass reports **fps before and after** the pass, on the same build and the same walk:

- `Post-pass: fps_avg before=<n> after=<n>, fps_1low before=<n> after=<n>, frame_ms before=<n> after=<n>, bloom=<native|half>`
- Measure with the pass off, then on (`tools/playcheck/run` twice, and the `?perf=1` overlay of [`tools/perf`](../../tools/perf/README.md) on a real phone when one is available). The law 65 perf line (`drawCalls`, `texMB`, `activeVideos`, `jsMs`) stays required on both runs.
- SwiftShader frame time stays informational (law 65). The before/after numbers are still printed.

## Companion — lock the light in the Imagine prompts

Fog and grade stay coherent only when the plates agree. For every scene, the Imagine prompts of **all plates** (sky, ground tiles, backdrop, object views, corridor video, living loops) lock the same three things:

- **one sun direction** (same side, same elevation in every plate);
- **one time of day**;
- **one palette**.

Write those three once in the scene's spec file (law [64](64-imagine-build-limits.md)) and repeat them verbatim in every prompt. A plate with a second sun or another time of day is recooked, not fixed by the grade. This matches the one-sun rule in [`COLD_START-meadow-jobs.md`](COLD_START-meadow-jobs.md) and one cook, one palette in law [48](48-jade-plate-cook.md).

## FAIL

- A fog colour that was not sampled from an Imagine sky or plate.
- More than one grade in the same biome, or a grade that pumps with the camera.
- Bloom on pixels that were not bright in the Imagine source, or a bloom that makes Bolt glow.
- Any real-time light, shadow, AO, reflection, refraction, code-drawn particle, or non-Imagine model / texture sneaked in as "post-processing".
- Visible banding, blur, or sharpness loss on the 720×1600 view.
- Bolt washed out by fog or grade.
- A take that adds the pass without fps before / after in its perf report.

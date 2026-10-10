# Phone performance (2026-10-10, Zone B on the owner's Galaxy S20 FE / Adreno 650)

## The rule
**Remove only work that never reaches the screen.** The look comes first: the 512 px/m ground detail, POM, materials, bombing and native-resolution Imagine pixels are not perf knobs.
- An optimisation ships only if phone-shaped captures at 1.5, 3, 8 and 30 m are identical to the previous build: mean |diff| ≤ 1/255 and no visible change in the A/B crops (`tools/perf/phone-bench/ab-identity.mjs` + `ab_sheet.py`). Bit-identical (max 0) is the norm.
- Allowed: overdraw that depth testing throws away anyway (draw order), loop-invariant maths hoisted out of loops, fetches skipped where their weight is 0 or beyond a fade, invisible geometry, per-frame recomputation, duplicate fetches.
- Not allowed as a "perf fix": lower aniso, fewer POM steps, shorter detail reach, no bombing, a single splat layer, implicit derivatives, half-res layers. Measure them as `[diag]` rows to locate the cost, never ship them.

## Measure on the phone, not the box
- The box has no GPU. SwiftShader timings are relative and noisy (load average 15-30), and they did not predict the phone (box: canvas fix -25 %; phone: still 30 fps).
- Use `tools/perf/phone-bench/bench.html`: one link, about 4 min, a big table the owner can screenshot, and a result link the agent decodes with `decode.mjs`.
- Readback timing (render + `readPixels`) inflates numbers on Chrome Android. Use the pipelined metric (3 renders per rAF, median interval / 3).
- Fragment counts (`overdraw.mjs`) beat timing for cheap layers. Transparent layers measured ≤ 0.16 screen and 1-2 fetches each: < 1 % of the frame, although a noisy timing had blamed them for 26 %.

## Lessons from the Zone B pass
1. **Canvas at the device ratio = fixed full-screen cost.** With the scene in an offscreen target at the internal ratio, a canvas at DPR 2.6-3 still paid a 2.6 Mpx grade + upsample + compositor pass every frame. The canvas follows the adaptive level (cap 2) and the scene renders 1:1 (1 fetch grade). Only the short sprint dip upsamples with RCAS.
2. **Adaptive ratio controller** (`tools/biome/runtime/adaptive-res.mjs`, tests in `adaptive-res.test.mjs`):
   - Starts at the cap.
   - Ignores 8 s of warm-up after ready and any 1 s window with an outlier stall (> 250 ms and > 3× median).
   - Decides on the window's median frame time.
   - Drops one rung after 3 s under 44 fps and never while the median is ≥ 44. Climbs one rung after 3 s at ≥ 50 fps (vsync-friendly).
   - Each change is followed by a settle window. A rung that fails is blocked 20/40/80/120 s, then closed for the session after its 3rd failure, so it cannot oscillate.
   - Ladder: 2 → 1.875 → 1.75 → (detail reach 30 → 16 m) → … → 1.25.
3. **Draw order (lossless).** The sky dome was drawn first over the whole screen and the ground before the towers and mesas, so every hidden sky and ground pixel was fully shaded and then overwritten. The order is now: opaques → ground → sky dome (far plane, depth-tested) → opaque meshes without depth write → transparents. With depth testing the result does not depend on the order, and captures are bit-identical (max diff 0).
4. **POM loop (lossless).** cos/sin of the two bombing-variant angles and the rotated gradients were recomputed at every POM step (up to 12 steps × 2 variants + 2 shadow taps). They are now computed once per pixel. Same maths, same fetches, bit-identical. `#define G_OLDPOM` brings the old loop back for A/B.
5. **Phone numbers (bench v1, S20 FE, sync metric):** base at ratio 2 was 56.8 ms and "ground only" 53.3 ms, so the ground fragment shader is about 94 % of the frame. Bench v2+ separates GPU, CPU and readback. Target: base at ratio 2 ≤ 16.7 ms (60 fps), at least ≤ 22 ms.

## Checks
- **object gate:** runtime rows "perf: canvas ratio <= cap", "perf: sky dome drawn after the opaques", "perf: ground after the other opaques", "perf: adaptive controller on". They read the page's `window.__perfReport()`. A page without it gets an INFO row.
- **imagine-to-3d auto.py `perf` stage:** when `perf.phoneBench` (a result link or a decoded JSON file) is in the spec, the base row is scored against `perf.phoneTargetMs` (default 22). Without a phone bench the row is NEEDS_PHONE (owner action). The box never claims phone fps.

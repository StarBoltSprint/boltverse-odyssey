# AAA feel at runtime — phone-cheap (IN TEST, 2026-10-08)

**Status: IN TEST.** Module `tools/biome/runtime/biome-runtime.js` (not wired into the game yet). Complements
[`aaa-look.md`](aaa-look.md) from PR #188 when that lands; law 67 still governs what may ship.

| Lever | Setting from the bible | Why |
|---|---|---|
| Tone mapping | `none` (`NoToneMapping`) | Imagine plates are already graded; a tone curve would shift them away from the anchor. |
| Fog | 3 bands near / mid / far, warm → cool, colours sampled from the stitched sky, height falloff, desaturation | Depth and scale; ties the solids to the sky. Applied in linear before output. Scene fog off. |
| Grade | one fullscreen pass: vignette + 4 % grain (+ identity LUT unless `post.runtimeLut`) | Uniform grain hides plate-to-plate differences; one pass on phones. |
| Sky | equirect sphere, `textureGrad` lookup | No wrap seam, no mip pop at u = 0. |
| Planet | own sphere + ring mesh opposite the sun, slow spin | Never painted into the sky. |
| Camera | FOV 58 → 70 at sprint, damping 4, pixel ratio cap 1.5 | Speed read without shake; trauma exists but is **disabled** (no-shake rule). |
| Budgets | drawCalls ≤ 12, tris ≤ 150 k, texMB ≤ 64 per biome, KTX2 ETC1S | Standing rule 9 (phone). |
| Ambient life | dust / shimmer layers are Imagine videos (existing recipes) | Not part of this module. |

Proof: `node --test tools/biome/runtime/biome-runtime.test.mjs` (7 tests) and
`node tools/biome/runtime/glsl-compile-check.mjs` (compiles the fog, grade and sky shaders in headless WebGL2).

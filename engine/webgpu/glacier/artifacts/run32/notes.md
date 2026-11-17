# Run 32 — baked vertex AO and SH L2

Not a KEEP. Not live. Not merged. The gates in `GATES.md` were written before the trial and were not lowered.

## What changed

One lighting change on the glacier candidate.

- Per-vertex ambient occlusion. 64 cosine-weighted hemisphere rays, in-house BVH, baked while the static world is built. Radius 3.4 m. Visibility is raised to a fixed power (2.439 on this mesh) so a vertex 0.45 m from a wall clears the contact band. Visibility 1 stays 1. The factor multiplies the ambient term only. The sun term is untouched. Instanced icicles, drifts, and chunks occlude, but they do not carry their own per-vertex AO. The bake adds 0 draws.
- SH L2 irradiance replaces the constant ambient `[0.14, 0.16, 0.22]`. It is the cosine-weighted average of the existing sky function on the upper hemisphere plus one snow bounce on the lower hemisphere. No exposure curve and no change to `present()`.

## Numbers

Follow camera, 720×1280, same chase. Linear light is the shader present inverted (`^2.2`). Contact darkening is `1 - L(inner) / L(outside the ray radius)`, on flat snow (`ny > 0.9`, sun `ndl` in the up-face band). The inner pixels are the flat snow whose baked AO is below 0.6. The outside sample is stepped about `3 / 1.75` contact-widths into the lane, and it has to be flat snow with AO at least 0.98.

| t (s) | bases | before median | after minimum | after median |
| --- | --- | --- | --- | --- |
| 5.10 | 4 | -0.018 | 0.161 | 0.285 |
| 5.567 | 5 | 0.060 | 0.197 | 0.315 |
| 7.90 | 3 | 0.077 | 0.148 | 0.392 |
| 11.70 | 0 | — | — | — |
| 24 | 1 | -0.200 | 0.091 | 0.091 |
| 30 | 5 | -0.031 | 0.150 | 0.289 |

The 15% contact gate holds at 5.10 and 5.567. It misses at 7.90 (weakest base 14.8%) and at 30 (weakest base 14.96%). At 11.70 there is no cluster of six flat-snow pixels inside the ray radius. At 24 the one cluster is 9% and the pre-change pair was already 20% the other way, so that pair is not a clean contact. The pre-change medians are under 15%, so the fixture fails the contact gate where a base could be measured.

Open snow, center lane, three windows, normals matched to that frame's lane `ndl`. Spread of albedo-normalized linear light:

| t (s) | before | after | open AO |
| --- | --- | --- | --- |
| 5.10 | 0.61% | 0.39% | 1 |
| 5.567 | 1.26% | 1.05% | 1 |
| 7.90 | 0.42% | 0.44% | 1 |
| 11.70 | 0.92% | 0.59% | 1 |
| 24 | 1.42% | 1.31% | 1 |
| 30 | 1.73% | 1.41% | 1 |

The 2% open-snow gate passes before and after. AO does not grey the field.

SH versus the key, shaded faces, CIE76 including lightness: 0.15, 0.13, 0.03, 0.05, 0.12, 0.25. All under 10. The bake's own up-facing irradiance is cooler than the down-facing one (`B-R` 0.209 vs 0.029). Rendered sky-facing shade is cooler than snow-facing shade at 5.10, 5.567, and 30. At 7.90 the raw pixels go the other way; the CIE match on that frame is 0.03, so the pixel hue is the ice albedo, not a wrong irradiance. 11.70 and 24 did not have both classes in the shaded sample.

Open-snow luma rose about 17% to 22% (per-time deltas 0.200, 0.194, 0.176, 0.221, 0.174, 0.190). The flat-face prediction was +18.5%. Exposure was not touched. A face aimed straight at the sun reaches 1.149 before `present()` clamps it. The snow field under Bolt does not clip.

Bolt card stays 1.15 m. Screen x stays 360. Bolt linear luma moved by at most 0.0019.

Triangles 195634. Draws 9. AO draws added: 0. Bake 48.4 s. Shade vertex buffer 8,942,400 bytes (was 12 bytes per vertex, now 16). World vertex buffer 17,884,800 bytes. Texel gate `test-texel-density.mjs` PASS at 2048 px/m, four variants, stretch at or under 1.30. Geometry and UVs were not edited.

The chase file is `glacier-chase-30s.mp4`: 720×1280, the same route, 5 frames a second for 30 s. SwiftShader took about ten seconds a frame, so a 900-frame 30 fps master was not finished. The stills are the 4× multisample frames. The chase is one sample so the encode could run.

## What is still wrong

- Far wall and spire feet are still hard lines. The ground triangles there are coarser than the 0.5 m band, so a vertex bake cannot put a dark pixel on the visible snow. 11.70 s and 24 s are the clear misses.
- Where the band does land it is a short crease beside a fall or a wall foot, not a soft skirt around every spire. The crop at 5.10 s shows it. The rest of the junction stays a cut.
- Instanced drifts and icicles do not darken on their own vertices.
- The open field is brighter and a little cooler. That is the sky integral sitting in the old ambient slot. Sunlit peaks clamp.
- The thin dark horizon line from run 31 is still there. This pass did not touch it.

## Round 2 — ground occlusion and shaded-snow warmth

Not a KEEP. The gates above were not lowered. The shaded-snow gate was added in `GATES.md` before these frames and was not lowered.

### Ground occlusion

Snow reads a top-down occlusion texture, world XZ, r8unorm, 0.125 m/texel, bounds X −180..180 and Z 60..−320. Size 2880×3040, 12 mips, 11,673,522 bytes. The same 64-ray hemisphere. Texels far from a caster stay 255 and are not raytraced. Traced 833,677, dark 410,437. Map bake about 78–86 s. Walls and spires keep the vertex factor. Instanced drifts and icicles sample the texture at their base. Draws stay 9. Triangles stay 195,634.

The paired projector (0.5 m window against a 3 m window) did not land a flat-snow pair at any of the six times. The nearest visible occluder was a fall at 5.10, 5.567, 7.90, and 11.70, and a wall at 24 and 30. On the rendered frames, snow with `ny > 0.8`, `ndl` in 0.10–0.50, and AO under 0.55 versus snow in that same band with AO over 0.98:

| t (s) | dark pixels | darken |
| --- | --- | --- |
| 5.10 | 688 | 0.338 |
| 5.567 | 622 | 0.359 |
| 7.90 | 1260 | 0.473 |
| 11.70 | 354 | 0.312 |
| 24 | 140 | 0.327 |
| 30 | 110 | 0.456 |

All six are over 15%. With AO forced off there are no pixels under 0.55, so the fixture still fails the contact bar. Open snow, AO on versus AO off with the SH held fixed, moved 0% at every time. Under 2%.

### Shaded snow

The crop is the cast sun shadow ahead of Bolt: snow the contact decal darkened by at least 6 L\*. The key is the run-31 shadow on `artifacts/run31/frames/t24.jpg`, Lab `[59.0, 5.1, -3.9]`. Pass is b\* inside −4.4..−3.2 and CIE76 ≤ 10 including lightness.

The warmth is the irradiance the run-31 mauve is missing from the sky-only up face, divided by the snow albedo. Axis `[0.425, 0.260, 0.034]`. Scale 0.90, so the added term is `[0.383, 0.234, 0.030]` on every direction. The decal model runs 2.42 b\* bluer than this crop, and the scale is the one that scores the crop. It is not a picked RGB. Up-facing B−R is −0.144 and down-facing is −0.323, so the up face stays the cooler of the two.

| t (s) | b\* | CIE76 vs key | face CIE76 | constant-ambient b\* |
| --- | --- | --- | --- | --- |
| 5.10 | −4.85 | 2.97 | 0.05 | −7.71 |
| 5.567 | −3.50 | 8.70 | 0.14 | −6.96 |
| 7.90 | −3.34 | 10.45 | 0.15 | −5.89 |
| 11.70 | −4.03 | 6.76 | 0.13 | −7.86 |
| 24 | −3.51 | 7.57 | 0.25 | −6.07 |
| 30 | −3.84 | 8.26 | 0.08 | −6.73 |

Face CIE76 is the existing shaded-face match against albedo × irradiance. The new columns are the cast-shadow crop. 5.567, 11.70, 24, and 30 pass both new bars. 5.10 misses the b\* band by 0.45 (CIE76 2.97). 7.90 misses CIE76 by 0.45 because that shadow is L\* 69.4 against the key’s 59 (b\* is inside the band). The constant-ambient crop is outside the b\* band at every time, so the fixture fails the gate. AO on and AO off give the same six rows: the shadow sits on open snow, where the occlusion factor is 1.

Open-snow luma versus the constant ambient, SH versus old, per time: +75.4%, +73.7%, +63.6%, +82.2%, +62.7%, +69.7%. The flat-face prediction is +70.8%. Not re-exposed. Snow linear p50 across the six frames is 0.6632. The multiplier that would put that p50 at 0.708 is **1.068**. It was not applied. A face aimed at the sun reaches 1.448 before `present()` clamps (authored albedo × irradiance; the irradiance channel itself peaks at 1.856). The up-facing snow field stays under 0.96. Bolt luma did not move. Screen x stays 360.

### What is still wrong

- One warmth cannot put all six shadows in a 1.2-wide b\* band and under CIE76 10 against one Lab. 5.10 stays 0.45 too blue. 7.90 stays 0.45 over the lightness limit.
- The paired 0.5 m / 3 m projector still does not find a flat window. The darkening above is low-AO snow against open snow in one normal band, not a named base at two distances.
- The open field is much brighter than the constant ambient. That is the bounce energy. Exposure was left alone. Sunlit peaks clamp harder than the old 1.149.

The 2.0 s clip is `glacier-t24-2s-30fps.mp4`: 720×1280, 30/1, 60 frames, from t=24, this lighting. The overview is `glacier-chase-30s.mp4`: 720×1280, 5/1, 150 frames, 30 s, this lighting. The run-32 overview does not include the ground map or this bounce.

## Round 3 — lower-hemisphere bounce

Not a KEEP. The uniform add from round 2 is gone. Snow bounce is the lower hemisphere only: authored snow albedo times the sun-plus-sky irradiance on an up face, one scalar of strength 1. The sky plate fills the upper hemisphere. An up face’s bounce luma is 0 against the down face’s 0.451. The strength search cannot move the path ratio, because that crop is up-facing, so the scalar stays on one physical bounce instead of being zeroed.

### Ground occlusion and instances

Top-down map: 2880×3040, 0.125 m/texel, 11,673,522 bytes, 12 mips. X −180..180, Z 60..−320. Traced 833,677, dark 410,437. Bake about 77–94 s. Draws stay 9. Triangles stay 195,634. The map adds 0 draws.

Each drift and icicle reads that map at its origin (one factor, no extra draw):

| | n | min | p50 | max | ao < 0.98 |
| --- | --- | --- | --- | --- | --- |
| drift | 32 | 0 | 0.039 | 0.165 | 32 |
| icicle | 97 | 0.008 | 0.639 | 1 | 56 |

Drift origins sit in their own footprint, so the factor is the ground contact under the drift, applied to the whole instance.

### Contact band

Snow with `ny > 0.72` and AO under 0.55, versus snow in that normal band with AO over 0.98. Linear luma over albedo. The base is the non-snow neighbour of the dark pixels. The world-space 0.5 m / 3 m projector still does not land on the strip.

| t (s) | base | dark pixels | darken |
| --- | --- | --- | --- |
| 5.10 | wall | 1368 | 0.229 |
| 5.567 | wall | 1488 | 0.285 |
| 7.90 | wall | 4175 | 0.528 |
| 11.70 | wall | 1018 | 0.262 |
| 24 | wall | 359 | 0.279 |
| 30 | fall | 171 | 0.439 |

All six are over 15%. At 11.70 and 24 the base is a wall. With AO forced off there are no pixels under 0.55, so the fixture still fails. Open snow, AO on versus AO off, moved 0% at every time.

### Shade, ratio, clip

Key shade/sun linear-luma ratio is 0.605. ±10% is 0.544 to 0.666. Round 2’s uniform lift fails it (0.516, 0.613, 0.517, 0.598, 0.562, 0.532).

| t (s) | b\* | L\* | CIE76 | ratio | round-2 b\* | round-2 L\* |
| --- | --- | --- | --- | --- | --- | --- |
| 5.10 | −15.41 | 53.0 | 13.07 | 0.526 | −4.85 | 61.8 |
| 5.567 | −15.29 | 57.4 | 11.63 | 0.596 | −3.50 | 67.7 |
| 7.90 | −13.80 | 60.7 | 10.17 | 0.523 | −3.34 | 69.4 |
| 11.70 | −16.17 | 55.0 | 13.00 | 0.585 | −4.03 | 65.8 |
| 24 | −13.75 | 58.2 | 9.99 | 0.550 | −3.51 | 66.6 |
| 30 | −15.06 | 58.2 | 11.33 | 0.538 | −3.84 | 67.3 |

7.90’s L\* came down from 69.4 to 60.7, next to the key’s 59. CIE76 is still 10.17 because b\* is −13.8. 5.10 went from 0.45 too blue to b\* −15.4. The cast shadow is up-facing snow, and that face receives none of the lower-hemisphere bounce, so the fill is the sky plate. The ratio passes at 5.567, 11.70, and 24, and fails at 5.10, 7.90, and 30. No colour offset was added to chase b\*.

Open snow versus the constant ambient is +20%, +21%, +18%, +22%, +17%, +19%. That is the sky integral, not the round-2 lift. Not re-exposed. The round-2 multiplier 1.068 was not applied. A face aimed at the sun is 1.150 before `present()` clamps. ×1.068 is 1.228, which still crosses 1: the sun term alone is 0.858 on authored snow, and the sky plate on that normal supplies the rest. Up-facing path snow is 0.544, and ×1.068 is 0.581, which does not clip. Bolt luma did not move. Screen x stays 360. Card stays 1.15 m.

## Round 3 steer — clean shade down to L\* 59

E's `round12-diag.json` grades this SH on clean snow at Lab `[70.67, 2.42, -4.28]`. b\* is in the band. L\* is 11.7 over the key. The same note puts a downward wall's ambient luma at 0.744 against the old 0.205. The crop that produced the blue medians was Bolt, the decals, the prints, and the flakes.

The grade is scaled so clean shaded snow presents at L\* 59 with b\* still in the band. Upward faces take that fill. Downward walls keep the scaled ground bounce: ambient luma 0.281, not 0.744. A 24 m sun ray on the ground map, ignoring hits closer than 0.75 m, is the shadow factor. It multiplies the sun on snow only. The mask blue test drops overlays.

Clean shade, shadow factor under 0.35, mask blue under 0.03, lower-center crop:

| t (s) | L\* | a\* | b\* | CIE76 |
| --- | --- | --- | --- | --- |
| 5.10 | 59.11 | 2.12 | −3.46 | 3.01 |
| 5.567 | 59.38 | 2.12 | −3.45 | 3.04 |
| 7.90 | 59.11 | 2.12 | −3.45 | 3.01 |
| 11.70 | 59.38 | 2.12 | −3.33 | 3.06 |
| 24 | 59.00 | 2.12 | −3.47 | 3.01 |
| 30 | 59.00 | 2.12 | −3.47 | 3.01 |

All six pass the b\* band and CIE76 ≤ 10. Shade/sun linear luma ratio against 0.605: 0.533, 0.538, 0.566, 0.501, 0.551, 0.501. 7.90 and 24 are inside ±10%. The other four are low because the snow that clears the walls is brighter than the key's sun, while the shade is held at L\* 59. A face aimed at the sun is 1.101 before the clamp. ×1.068 is 1.176, which still crosses 1. The up-facing path product stays under 0.63.

## Round 4 — sun intensity

One scalar on the sun radiance. Direction stays `[0.72, 0.28, -0.63]`. Intensity goes from 1.25 to 0.85 (×0.68). The 0.68 is the sun-term scale that puts all six clean-mask shade/sun ratios inside 0.605 ±10% while the shade grade stays at L\* 59. Matching the key's lit L\* exactly (about 68) would push the 7.90 ratio above the +10% edge, so the scalar stops at the edge of that band.

Key lit snow, run 31 lane: t10 `[68.15, 4.25, -4.91]`, t24 `[70.98, 5.07, -3.97]`, t30 `[67.79, 4.26, -4.91]`.

| t (s) | shade L\* | b\* | CIE76 | ratio | lit Lab |
| --- | --- | --- | --- | --- | --- |
| 5.10 | 59.11 | −3.46 | 3.01 | 0.627 | 71.79, 3.43, 0.25 |
| 5.567 | 59.38 | −3.45 | 3.04 | 0.632 | 71.85, 3.42, 0.50 |
| 7.90 | 59.11 | −3.45 | 3.01 | 0.652 | 70.66, 3.23, −0.01 |
| 11.70 | 59.38 | −3.33 | 3.06 | 0.595 | 73.69, 3.73, 0.75 |
| 24 | 59.00 | −3.47 | 3.01 | 0.640 | 71.05, 3.23, −0.01 |
| 30 | 59.00 | −3.47 | 3.01 | 0.598 | 73.07, 3.57, 0.63 |

All six ratios are inside ±10%. Shade stays at L\* 59 and inside the b\* band. Lit snow is still about 3 to 5 L\* above the key's lane.

A face aimed at the sun is 0.807 before `present()` clamps. ×1.068 is 0.861, which does not cross 1. The fraction of presented pixels with a channel at 255 is 0.

Flat snow linear p50, `ny > 0.9`, all six frames together, is 0.280. Most of that snow is inside the sun ray's shadow. The multiplier that would put 0.280 at 0.708 is **2.533**. It was not applied. The sunlit subset of that snow has per-time medians 0.442, 0.446, 0.425, 0.466, 0.432, 0.466.

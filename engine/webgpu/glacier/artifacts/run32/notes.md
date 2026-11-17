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

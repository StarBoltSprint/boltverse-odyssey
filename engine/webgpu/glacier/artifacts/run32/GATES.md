# Run 32 gates — D6 baked vertex AO + SH L2

Locked before the trial. These numbers are not lowered after a result comes back.

Camera for every geometry and lighting gate: the real follow camera, 720×1280, lateral offset 0, the chase integrator (`chaseInput` / `integrate` / bolt idle), times **5.10, 5.567, 7.9, 11.70, 24, 30 s**. Not a level mcam. Not a gate pose.

Linear luma inverts the shader present: `(byte/255)^2.2`, then `0.2126 R + 0.7152 G + 0.0722 B`.

## Contact AO (blocking)

At each time, every on-screen spire or wall base whose 0.5 m snow window and whose snow window at 3 m each hold at least 8 snow pixels:

`darken = 1 - L(0.5 m) / L(3 m)` must be **>= 0.15**.

L is the median linear luma. Snow is material 0 on the surface under the follow camera, excluding the Bolt card. A time with no measurable base does not pass. The fixture (pre-change frames, same route) must **fail** this gate: median darken across measured bases **< 0.15**.

## Open snow (blocking)

Snow at least **5 m** from any non-ground occluder (wall, fall, arch, mountain, tall snow, icicle, drift, chunk). At least two separated 0.4 m windows per time, upward normals only (`ny > 0.75`).

`(max meanL - min meanL) / mean(meanL) < 0.02`.

L here is median linear luma divided by median linear albedo luma in that same window, so a texture variant is not counted as occlusion. The 2% is the light.

AO must not grey the field. A uniform shift of every window is not this gate. The fixture must **pass**.

## SH ambient (blocking)

Shaded-face colour in those same follow frames: `ndl < 0.12`, `ndv > 0.45`, surface pixels, CIE76 **<= 10 including lightness**, against albedo × (SH ambient(n) × AO + the existing sun term). No hue-only shortcut. The limit is not relaxed.

Sign: among shaded pixels, sky-facing (`ny > 0.25`) is cooler than snow-facing (`ny < -0.05`): mean linear `(B - R)` of the sky-facing class is greater. Frames that contain both classes must agree. The bake’s own up-versus-down eval must agree even when a frame lacks one class.

## Shaded snow (blocking)

Added after the contact trial, before this measurement. Not a replacement for the shaded-face CIE76 above.

At each of the six times, the crop is the cast sun shadow on snow ahead of Bolt: snow pixels in the follow frame, in the band just in front of the paws, where the beauty is at least 6 L\* darker than the surface. That darkening is the contact shadow along the dawn sun.

The key is the run-31 cast shadow ahead of Bolt (`artifacts/run31/frames/t24.jpg`), Lab `[59.0, 5.1, -3.9]`. Its b\* sits in the mauve band **-4.4 to -3.2**.

Both must hold, on every time:

- median b\* of the crop is inside **-4.4 .. -3.2**
- CIE76 of that median Lab against the key is **<= 10, including lightness**

The limit is the existing CIE76 limit. It is not raised. The fixture is the constant-ambient frames (`run32/before`). That build must **fail** this gate.

The lever is the snow-bounce warmth. Its colour is the irradiance the run-31 mauve is missing from the sky-only up face (`scene(mauve) / snow albedo − sky up`), and its scale is the one that puts this crop on the key. It is not a hand-set RGB.

## What is reported, not retuned

If the SH changes mean open-snow luma, the delta is reported. Exposure, the present curve, and sun intensity stay as they are. No EV compensation.

Bolt card height stays **1.15 m**. Follow view stays centred (screen x **360**). Bolt linear luma stays within **0.01** of the pre-change frame unless the bake actually touches him; if it does, that is reported.

Phone budget: **<= 200,000** triangles, **<= 12** draws. The AO bake adds **0** draws. Bake milliseconds and shade vertex-buffer bytes are reported.

Texel gate `biome-factory/texel-gate.mjs` stays blocking at `MIN_PX_PER_M=2048`.

## Method this trial is allowed to use

- Per-vertex ambient occlusion, 64 cosine-weighted hemisphere rays, in-house, baked while the static world is built. It multiplies the ambient term only.
- Ray length is a contact length so snow at 3 m and snow at 5 m are outside it. A fixed exponent on the ray visibility is allowed only because visibility 1 stays 1. The exponent is recorded. It is not a second threshold.
- SH L2 irradiance from the existing sky function plus one snow-bounce term, replacing the constant ambient colour. One scalar is not applied to hide the luma delta.

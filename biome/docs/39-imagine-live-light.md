# 39 — Imagine live light (the crystal method)

Cook gate for any GPU prop that must look as good as Bolt. Proven on Nebula Lane: the crystal, then the howl ring.

The secret is not a light in the engine. **The clip is already lit like the plate.** The GPU only cuts the black and plants the quad. It must not recolor the picture.

## Why the old props died

Stills and side LOD sprites went through the bib grade (`uClean` off). That shader samples the plate and mixes the sprite toward it: AO, wrap darkening, neon bounce. Facets turn to mud. A photo on the shoulder never reads as a thing that lives in the nebula.

Bolt stays sharp because his shader keys luma and **returns the video color**. A prop has to take that path, not the grade path.

## Film it in the plate light

One Imagine video per prop. Not a mesh. Not a still.

| | Crystal (lane prop) | Howl ring |
|---|---|---|
| Frame | one object, centered | one ring, centered |
| Ground | **pure black** | **pure black** |
| Contact | base on the **bottom edge** | ring does not touch the edges |
| Light | the plate's colors, inside the object | same colors, not a second sun |
| Motion | slow turn, loopable, no camera move | slow pulse, light traveling the ring |
| Size | 720p, **2:3**, 6 s | 720p, **1:1**, 6 s |
| Count | one clip, every crystal is that clip | one clip, every ring stamp is that clip |

Nebula plate light is magenta, teal, and gold. The crystal prompt that matched:

> A single tall faceted crystal, like a precious quartz shard, isolated on a pure solid black background. The crystal stands upright in the center, its base touching the bottom edge of the frame, the whole stone visible with space above the tip. Facets are sharp and photographic. Light inside the stone shifts between magenta, teal, and gold, matching a nebula. The crystal slowly turns in place, facets catching light, no camera move, no cut, no ground plane, no text, no other objects. Cinematic, high detail, seamless slow spin.

Howl ring, same light, not the old gold fire hoop:

> A single luminous shockwave ring, centered, isolated on a pure solid black background. One ring only, not touching the edges, with plenty of black around it. The ring is a thin torus of nebula light: magenta and violet gas, a teal inner edge, and gold sparks traveling around the circle. It slowly pulses and breathes, light sliding through the ring the way light moves inside a crystal. No fire, no flame, no second ring, no ground, no camera move, no text, no other objects.

Swap the color words for another biome. Do not add "cinematic lighting" that invents a new exposure. Law [31](31-light-lock.md) still holds: the plate exposure stays. The prop is filmed **in** that light, not brighter than it.

Measure the clip once. Nebula crystal base sat at **0.92** of the frame height. That number is `SHARD_BASE`. If the base is not near the bottom, the prop floats.

## GPU — clean key, then stop

Hidden `<video>`, loop, muted. Upload the frame every tick (`texImage2D`, stamp = `currentTime`). Draw with the clean branch and **return**. Do not fall through into the plate grade.

```glsl
float luma = dot(p.rgb, vec3(0.299, 0.587, 0.114));
if (uClean > 0.5) {
  float live = smoothstep(0.04, 0.18, luma);
  gl_FragColor = vec4(p.rgb * live * uGain, live * uGain);
  return;
}
```

`0.04 → 0.18` keeps the dim facet color and drops the black. Premultiply. One texture, many quads (different lane, same decoder).

Howl already keys this way (`HOWL_FS`, threshold `0.035 → 0.16`). Replacing the ring file is enough. Do not add a second grade on the ring.

## Plant on a lane

Not a physics engine. `howlPose(lane, z, …)` from law [34](34-howl-live-aim.md): vanishing point → lane center (`LANE_W`). The quad's contact is `groundY - height * SHARD_BASE`.

Nebula numbers that read in front of Bolt, not as a speck and not on his paws:

| | Value |
|---|---|
| Spawn `z` | `0.32 + random * 0.10` (mid band, howlable) |
| Drift | `z -= dt * 0.055` |
| Despawn | `z < 0.05` |
| Alive cap | 2, one per lane |
| Next pop | `2.4 + random * 1.8` s |
| Height | `ch * (0.09 + 0.12 * t)` |

`t` comes from `howlPose`. Bigger as it approaches. The video does not change size. Perspective does.

## Howl destroys the one you tap

Store each crystal's screen rect (canvas pixels, pad ~36). A tap that hits a rect sets `aimId` and fires the howl. The beam `far` is **that** crystal's `pose.ground`, even if Bolt is on another lane. On `howlStep.hit`, shatter that id (scale up, gain to 0 in 0.32 s). Swipe-down with no tap still breaks the howlable crystal on Bolt's own lane.

## Do not

- Regrade the clip toward the plate. That is what made the LOD rocks ugly.
- Spawn props in the sky, then drop them onto the shoulder.
- Put lane props outside the lanes. A crystal is a target. It sits in a lane.
- Use a still, a sprite sheet, or a 3D mesh for this class of prop.
- Cook a gold fire howl onto a magenta plate. Recook the ring in the plate colors.
- Check the mp4 in as the law. The law is the prompt + the clean key. Regenerate the clip per biome.

## Runtime

`biome/scripts/imagine-live/imagineLive.js` — prompt, thresholds, spawn numbers. Paste: [COLD_START-imagine-live.md](COLD_START-imagine-live.md).

## Related

[05](05-key.md) · [15](15-gpu-compositor.md) · [29](29-imagine-compiler.md) · [31](31-light-lock.md) · [32](32-howl-gpu-targets.md) · [34](34-howl-live-aim.md)

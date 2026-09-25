# VISTA — GPU sky and lava ground

Kitchen only. Read this before touching the plain behind the citadel.
Repo: `StarBoltSprint/boltverse-odyssey`. Play code is `src/game/pyre-stage.tsx` in the Build sandbox, and `pyre/src/pyre-stage.tsx` in this repo. They must stay the same file.

The filmed 12-step grid is not the vista anymore. Once the door is open (`doorMode === "out"` and `vistaHold` or `outArrived`), the world is two video textures on the GPU plus Bolt keyed on top. Do not cook another cell. Do not bake Bolt into the plate. Do not go back to Perlin or Simplex for the ground. The player rejected that. The ground is an Imagine video, same idea as the sky.

## What is on screen

Draw order, every frame, only while `onPlain`:

1. Clear to black.
2. Sky quad, top band, no blend. Four portrait videos, one of them (or two, during the fade) uploaded this frame.
3. Ground quad, full screen, `SRC_ALPHA`. It discards above the horizon and fades into the sky, so the moon is not covered.
4. Bolt, already keyed, on top. He is not in either video.

`uploadVideo` binds the texture first, then returns if `readyState < 2`. If you bind after the early return, the wolf video leaks into the sky. That bug already happened.

Only upload a sky face that is on screen. Pause the other three. Upload `ground.mp4` every new frame while the plain is up, and pause it when you leave.

## Sky — four videos, full-frame fade, no vertical cut

Files: `public/master/decor/sky-0.mp4` … `sky-3.mp4`. Portrait, 9:16, moon round, camera locked. `sky-0` is the moon. The other three continue the same red cloud sky around the circle.

Do not stitch two videos side by side in one frame. That draws a hard vertical line (moon on the left, clouds on the right). The fade is a full-frame dissolve.

```
band = 0.76
span = 0.7
ang  = fract(0.125 - orbit / (2 * PI))
slice = ang * 4
faceA = floor(slice) mod 4
f     = fract(slice)
u0    = (1 - span) * f
```

For most of the quadrant the image slides: `u0` moves 30% of the texture, so a small swipe is a small pan, not a jump to 90°. When `f > 0.55`, the next face comes in across the whole quad:

```
faceB = (faceA + 1) mod 4
u1    = 0
t     = (f - 0.55) / 0.45
mix   = t * t * (3 - 2 * t)
```

`u1` stays 0 so the fade lands exactly on the start of the next video. The next quadrant then continues the slide. Smoothstep, not a step. A step in the last 20% with `span` near 0.9 feels like the camera snaps from 0° to 90°.

Vertical crop, so the moon stays a circle and sits above the horizon:

```
bandAspect = (canvasWidth / canvasHeight) / band
vidAspect  = videoWidth / videoHeight
vSpan = min(0.9, (vidAspect * span) / bandAspect)
v1 = 0.9
v0 = max(0, v1 - vSpan)
```

Shader samples `vec2(uU0 + vUv.x * uSpan, mix(uV0, uV1, vUv.y))` and `mix`es the two faces by `uMix`. Quad is `quad(0, 0, 1, band)`.

Orbit gain on a ground swipe is `(2 * PI) / 0.85`. No clamp. No snap on release. The same `orbit` drives the sky and the ground. If only the ground uses it, the moon stays glued and the floor looks like it is spinning under a fixed camera.

## Ground — one Imagine video, real perspective, scroll along the look direction

File: `public/master/decor/ground.mp4`. Top-down lava, camera locked, cracks pulsing, edges made to tile. It is the GPU texture `uPath`. `path.jpg` is only the fallback before the video decodes. Do not draw the green-screen rocks or spires on this vista. The player asked for them to be removed.

`plateOffset` still runs the world. North/south drag sets `plateWish`, `plateV` eases toward it and damps to 0 on release. `plateOffset += plateV * dt`. Never clamp it.

The fragment shader is `PLATE_FS`. Enable `GL_OES_standard_derivatives` before the program is compiled.

```
horizon = 0.36
discard if vUv.y > horizon
dy    = max(0.02, horizon - vUv.y)
depth = 0.72 / dy
x     = (vUv.x - 0.5) * depth * 1.2
ahead = depth + uScroll * 2.0
wx    = x * cos(yaw) - ahead * sin(yaw)
wz    = x * sin(yaw) + ahead * cos(yaw)
```

`uYaw` is `orbit`. `uScroll` is `plateOffset`.

Scroll is `ahead`, not `wz += uScroll`. If you add scroll in world +Z, a 180° turn keeps the lava moving the old way. Putting it in `ahead` makes the ground recede along wherever the camera is looking.

`x` scale `1.2` is the ground's horizontal field of view. `0.52` made the floor whip across the screen much faster than the sky during a turn. Do not lower it again or the ground and the moon stop moving together.

Tile with `p = vec2(wx, wz) * 0.18`, then a narrow seam crossfade so the repeat is not a hard cut:

```
f = fract(p)
a = texture(uPath, f)
b = texture(uPath, fract(p + 0.5))
edge = max(abs(f.x - 0.5), abs(f.y - 0.5)) * 2
stone = mix(a, b, smoothstep(0.92, 1.0, edge))
```

A wide seam (`smoothstep` from 0.5) ghosts the lava. Keep it in the outer 8%.

Kill the stretched horizon with derivatives, then fade into the sky before the fade eats the moon:

```
stretch = max(length(dFdx(p)), length(dFdy(p)))
sharp   = 1 - smoothstep(0.02, 0.055, stretch)
intoSky = 1 - smoothstep(0.26, 0.35, vUv.y)
alpha   = sharp * intoSky
```

`horizon` 0.56 covered half the moon. `0.36` with the fade ending at `0.35` leaves the moon clear and the join is a thin band, same idea as the sky fades. Do not paint an opaque dark fog over the horizon. That reads as a black strip. The alpha lets the red sky show through.

Blend mode is `SRC_ALPHA, ONE_MINUS_SRC_ALPHA`. Draw the ground after the sky.

## Gait

When the pose is the run or the backstep, set `playbackRate = 0.55 + sprint * 1.05` with `sprint = min(1, abs(plateV) / 1.8)`. The legs and the ground then speed up together. Do not seek the run clip. The stand at the start of the file was already cut out.

## Do not

- Draw two sky videos next to each other. Full-frame `mix` only.
- Snap orbit to 90°. The slide inside `span` is what makes the in-between angles.
- Stretch one 16:9 sky into the phone. The moon becomes an oval.
- Use Perlin, Simplex, or fbm for this ground. The player wants the Imagine lava video.
- Add scroll on world Z. It ignores the turn.
- Raise the horizon to "meet the moon". It covers the moon.
- Fade the ground with a wide alpha from `y = 0.4`. The lava doubles.
- Bind a texture unit and then return early. Bind first.
- Upload every sky video every frame. Only the live face and the face you are fading to.

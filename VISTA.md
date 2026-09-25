# VISTA — GPU sky and lava ground

Kitchen only. Read this before touching the plain behind the citadel.
Repo: `StarBoltSprint/boltverse-odyssey`. Play code is `src/game/pyre-stage.tsx` in the Build sandbox, and `pyre/src/pyre-stage.tsx` in this repo. They must stay the same file.

The filmed 12-step grid is not the vista anymore. Once the door is open (`doorMode === "out"` and `vistaHold` or `outArrived`), the world is two video textures on the GPU plus Bolt keyed on top. Do not cook another cell. Do not bake Bolt into the plate. Do not go back to Perlin or Simplex for the ground. The player rejected that. The ground is an Imagine video, same idea as the sky.

The finger writes two numbers only: `orbit` (yaw, radians) and `plateV` (speed). Sky, ground and the run clip are derived from the film cards at the top of `src/game/pyre-stage.tsx` (`SKY`, `GROUND`, `RUN`). Do not put a new coefficient in the shader. Change the card.

- `SKY.span` is the moon size. `SKY.fadeDeg` is how many degrees the full-frame fade lasts. `SKY.moonBottom` is where the ground fade ends, so the horizon follows the moon.
- Ground field of view is the sky field of view times `GROUND.detail`. Lava reads faster than the moon, so `detail` is above 1. Scroll is `plateOffset / GROUND.tileMeters`.
- Run `playbackRate` is `RUN.idleRate + abs(speed) * RUN.strideSeconds / RUN.strideMeters`. Legs and lava share `plateV`.

## What is on screen

Draw order, every frame, only while `onPlain`:

1. Clear to black.
2. Sky quad, top band, no blend. Four portrait videos, one of them (or two, during the fade) uploaded this frame.
3. Ground quad, full screen, `SRC_ALPHA`. It discards above the horizon and fades into the sky, so the moon is not covered.
4. Bolt, already keyed, on top. He is not in either video.

`uploadVideo` binds the texture first, then returns if `readyState < 2`. If you bind after the early return, the wolf video leaks into the sky. That bug already happened.

Keep all four sky videos playing while the plain is up. Pausing the hidden ones makes the next face black for about a second on a fast turn. Upload `ground.mp4` every new frame while the plain is up, and pause it when you leave.

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

`uYaw` is `orbit` (the camera). Travel is not `uScroll`. See "Heading" below. The `ahead = depth + uScroll` form tied the lava to the camera, so a profile run slid the wrong way once the camera caught up.

Scroll used to be `ahead`, not `wz += uScroll`. Both of those are wrong now. `ahead` follows the camera. A scalar `uScroll` added after the yaw replays every meter already run along the new heading and the ground teleports.

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
- Do not add the whole distance as `pivot = uPivot + uScroll`. The lava jumps when he turns. Integrate `worldX` / `worldZ` (Heading, below).
- Raise the horizon to "meet the moon". It covers the moon.
- Fade the ground with a wide alpha from `y = 0.4`. The lava doubles.
- Bind a texture unit and then return early. Bind first.
- Do not pause the three sky faces that are off screen. A fast yaw then samples a video with no decoded frame and the sky goes black for about a second. Keep all four playing.

## Heading — profile run, then the camera gets behind him

This replaces the old "scroll lives in `ahead`" note and the "pause the other skies" note.

Two angles, not one:

- `selfAng` is where Bolt faces and where the lava travels.
- `orbit` is the camera. It rotates the view around his feet. It does not move the lava by itself.

A flat swipe left or right, on him or on the ground, writes `selfAng` only. Gain is `2π` across the screen width, so a quarter of the screen is a profile. The camera stays put. Once he is clearly sideways (`turned` between 0.7 and 2.5 rad and the finger has moved more than 16% of the width), `profileGo` starts and `plateWish` goes to 1.25. He runs in profile. After 0.7s, `chase` eases `orbit` onto `selfAng` (rate `1 - exp(-dt * 4.5)`), so the camera walks behind him and the back-run clip takes over. Releasing the finger also starts that ease if he is already past 0.7 rad, then the speed damps to 0.

While `profileGo` or `abs(plateV) > 0.08`, the pose is the nearest run, never a standing idle. Standing idles are what looked frozen on a fast left-right flick.

| Nearest angle | File |
|---|---|
| 0, back | `public/master/bolt-thunder-run.mp4` |
| π/2, screen left | `public/master/bolt-thunder-run-left.mp4` |
| 3π/2, screen right | `public/master/bolt-thunder-run-right.mp4` |

The two profile runs are image-to-video of the matching idle still. Prompt: same wolf, locked profile, running in place toward that side, feet at the same height, flat green screen, no camera move, 6s, loop. Copy them to `pyre/master/` in this repo. Key them with the same green key as the other thunder clips. Do not show `bolt-thunder-left-idle` or `right-idle` while he is moving.

Each frame, move the ground by the step only. Do not rotate the distance already traveled.

```
scrolled = plateV * dt / GROUND.tileMeters
worldX += -sin(selfAng) * scrolled
worldZ +=  cos(selfAng) * scrolled
```

`uYaw` is still `orbit`. Around the feet:

```
relZ = depth - uPivot
wx = x * cos(orbit) - relZ * sin(orbit) + worldX
wz = x * sin(orbit) + relZ * cos(orbit) + uPivot + worldZ
```

At yaw 0 and heading 0 this matches the old `wz = depth + scroll`. When he runs in profile, the lava slides sideways. When the camera later matches `selfAng`, that same world step is forward on screen. Fold `orbit` and add the same delta to `selfAng` when they meet, or the next swipe thinks he is still turned.

Swipe up still runs straight ahead. It does not change `selfAng`.

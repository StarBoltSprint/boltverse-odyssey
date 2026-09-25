# PLAIN — Thunderwolf vista, one native ground

The nine-cell grid below is retired. The plain the player is on now is `VISTA.md`: one lava video, four sky videos, profile runs, `selfAng` for heading and `orbit` for the camera. Do not rebuild the grid.

Kitchen only. Do not read this to the player.
Repo: `StarBoltSprint/boltverse-odyssey`. Play lives in the Build preview, source `src/game/pyre-stage.tsx`.

The plain behind the citadel is not one seekable video. Mobile `video.currentTime` only lands on keyframes, so the ground is a JPEG strip. The Thunderwolf is a second video, keyed, drawn by the GPU on top. He is never baked into the plate.

## Grid

Nine cells. Twelve one-way steps. The way back is the same strip played in reverse.

```
        west         center        east
far     A1 -------- A2 -------- A3
         |          |          |
mid     B1 -------- B2 -------- B3
         |          |          |
near    C1 -------- C2 -------- C3     C2 = the locked vista. Never regenerate it.
```

| Step | File | Step | File |
|---|---|---|---|
| C1→B1 | `c1b1` | C1→C2 | `c1c2` |
| C2→B2 | `c2b2` | C2→C3 | `c2c3` |
| C3→B3 | `c3b3` | B1→B2 | `b1b2` |
| B1→A1 | `b1a1` | B2→B3 | `b2b3` |
| B2→A2 | `b2a2` | A1→A2 | `a1a2` |
| B3→A3 | `b3a3` | A2→A3 | `a2a3` |

`gx` and `gy` live in `[0, 2]`. Start is `(1, 0)` = C2.

## Cook a step (do not skip, do not invent a new painting)

1. Lock C2 from the existing plain still. Every other cell is an image-edit of its neighbor, never from scratch. Same moon, same citadel, same lava grammar. Camera height locked. No creature. No zoom.
2. One midpoint still per edge. Two references: start and end. Prompt: one photograph halfway between them. Same world.
3. One 6s 9:16 video. Three references, in order: first, mid, last. Prompt: one uncut camera move, start locked on the first, pass the second, end locked on the third. No wolf. No zoom. No orbit. Forward steps walk. Side steps slide.
4. The seam is the extracted last frame, not the still you hoped for. That extracted frame is the first frame of the next clip.
5. Cut the video. Do not scrub the mp4 on the phone.

```
ffmpeg -i STEP.mp4 -vf "fps=12/6,scale=720:-2" -start_number 1 -q:v 5 public/master/grid/NAME-%02d.jpg
```

Twelve JPEGs. `shotAt(pack, t)` picks the frame and walks backward until one is decoded.

## Play

One drag, one axis. Snap the other axis to the nearest integer so he stays on a grid line.

- Drag on him, vertical: `gy`. Up is forward. Gain = `height * 0.62`.
- Drag on him, horizontal: `gx`. Gain = `width * 0.46`.
- On release, `gx` and `gy` stay. Do not spring back. Do not snap to a cell.

Node `(1, 0)` shows the living vista video, not a JPEG. Any other node shows the last frame of the strip that arrives there. A segment shows `shotAt` at the fractional part.

## Camera look is not walking

Swipe the ground, not him, and mostly horizontal. That orbits. It does not change `gx`.

- Range is `[-PI/2, PI/2]`. Gain = `SIDE / 0.36`.
- Finger to the left raises orbit. Positive orbit is `plain-left`. Negative is `plain-right`.
- On release, snap to `-SIDE`, `0`, or `+SIDE`. It stays. Swipe back to center.
- While `|orbit| > 0.05`, the orbit plate wins over the grid. Do not also show `plain-go-l` / `plain-go-r`. Those freeze on frame 0 and feel blocked.
- A mostly horizontal slide is not a body arc. The arc test runs only when the chord is not a sideways slide.

Body arc (unchanged, strict): length ≥ 150, deviation ≥ 64, deviation ≥ chord × 0.48, sweep ≥ 1.15 rad, consistent curvature. That turns him. It does not turn the camera.

## The moon must keep turning

A JPEG is a dead plate. Three cases:

| Where he is | What plays |
|---|---|
| Center, not looking | `citadel-plain.mp4` loop. Never cover it with `plain-go` just because `roomDepth` is 0.06. |
| Look parked full left or right, finger up | `plain-left-live.mp4` / `plain-right-live.mp4` |
| Forward of center, finger up, `|gx-1| < 0.28` | nearest idle loop |

Idle loops, each an image-to-video of that exact JPEG. Locked camera. Moon rotates. Clouds drift. Lava breathes. No creature. 6s. Loop.

```
public/master/live/c2b2-03.mp4   gy 0.20
public/master/live/c2b2-06.mp4   gy 0.46
public/master/live/c2b2-09.mp4   gy 0.71
public/master/live/c2b2-12.mp4   gy 0.96
public/master/live/b2a2-06.mp4   gy 1.46
public/master/live/b2a2-12.mp4   gy 1.96
```

While the finger is down, show the JPEG so the ground tracks the finger. If the loop is not decoded yet, keep the JPEG. Never flash black. Pause the loops that are not on screen.

Side look loops are the same cook, from `plain-left-16.jpg` and `plain-right-16.jpg`, 10s.

## Thunderwolf on the GPU

- While `thunderOn`, never draw the dog. Remember `thunderHold`, the last thunder clip that was ready. If the next clip's `readyState` drops, keep drawing `thunderHold`. Do not upload `boltIdle` over that texture.
- Zoom floor is 1. Pinch and wheel: `Math.max(1, Math.min(2.35, z))`. He cannot shrink the plate into the black.
- Key, in `BOLT_FS` `keyed()`: alpha falls only on real green, `smoothstep(0.34, 0.72, greenness)`. Despill any `g` above `max(r, b)` from `0.008`. Do not raise the cutoff or the white fur gets eaten. Lava is red, so it is untouched.
- The run clip itself crops a hand or a paw on some frames. Those pixels are not in the file. Do not replace that clip with a new generation that changes the armor. A new run is allowed only if every frame keeps a real margin and the armor matches.

## Menu taps

`touch-action: manipulation` on `.pyre-cover` and the buttons. The frame listener returns immediately when the target is inside `.pyre-cover`. Buttons use `onPointerUp` with `preventDefault` and `stopPropagation`. Do not set `touch-action: none` on the frame while the menu is up.

## Procedural plain — this is what is built

The filmed 12-step grid is no longer the vista. Once the door is open and the vista has settled (`onBlack`), the world is an empty plate. Do not cook another cell video. Do not put Bolt in the plate.

One number moves everything: `plateOffset`.

- A north/south drag sets `plateWish`. `plateV` eases toward it and damps to 0 when the finger lifts. Bolt stopped means the plate is stopped.
- Each frame: `plateOffset += plateV * dt`. Do not clamp it. The world is endless.
- The path shader, every rock, every spire, and the citadel all read that same `plateOffset`. They cannot drift apart.

### Camera is 360, and it is the camera, not only the floor

- A flat ground swipe (not an arc, not on Bolt) adds to `orbit`. Gain = `(2 * PI) / 0.85`. No clamp. No snap on release. A second swipe continues.
- While the finger is up, wrap `orbit` into `[-PI, PI]`. `sin`/`cos` already loop, the wrap is only so the number stays small.
- The floor uses `uYaw = orbit` inside `PLATE_FS`.
- The sky must use the same `orbit`. If only the floor rotates, the moon stays glued and it feels like the ground is spinning under a fixed camera.
- Sky pan: `spin = ((orbit / PI) % 2 + 2) % 2`. Draw the sky quad at `x = spin - 2` and `x = spin`. One full turn slides the moon off one side and brings it back from the other. Swipe right lowers `orbit` and the moon moves left, same way the props move.
- Clear the color buffer to black before the sky, or the old moon stays painted in the gap.

### Sky must be a portrait video

A 16:9 sky stretched into the phone becomes an oval moon. Cook it like this:

1. Imagine a 9:16 still. Round blood moon in the upper third. Lower half empty and near black. No ground, no citadel.
2. Image-to-video, 6s, 720p, 9:16. Moon rotates, clouds drift, camera fixed, moon stays a circle.
3. Compress: `ffmpeg -an -c:v libx264 -crf 26 -pix_fmt yuv420p -movflags +faststart`.
4. Draw it with its real aspect. `skyH = screenAspect / (videoWidth / videoHeight)`. On a phone that is almost the full screen. Never force it into a square band.

File: `public/master/decor/sky.mp4`.

## Path

The path shader in this file is the old one. Do not put it back. The vista that plays now is [VISTA.md](VISTA.md): four portrait sky videos with a full-frame fade, and `ground.mp4` on the GPU with the scroll inside the look direction. Horizon is `0.36`. No rocks, no spires, no Perlin.

`public/master/decor/path.jpg` remains the still the ground video was cooked from, and the fallback before `ground.mp4` decodes.

### Props, same key as Bolt

Green-screen stills, not baked into the path:

| File | What | Where |
|---|---|---|
| `decor/rock.jpg` | one boulder | on the path, sides only |
| `decor/spire.jpg` | one gothic spire | on the path, sides only |
| `decor/citadel.jpg` | skyline | horizon, not on the feet |

`PROP_FS`: if `g - max(r, b) > 0.14`, discard. Do not fade by luma or the black rock disappears.

Place with the inverse of the plate shader:

```
x     = dx * cos + dz * sin
depth = -dx * sin + dz * cos
dz    = worldZ - plateOffset
```

Clamp anything farther than 6.5 back onto the horizon so the citadel stays on the skyline until you arrive. Skip a rock or a spire when `depth < 1.7` or `|x| < 1.35`. If you do not, it is drawn through Bolt.

Seed with `sin(n * 127.1)`. Same cell, same prop. Draw far to near.

### Run loop

`bolt-thunder-run.mp4` starts with him standing. A phone seek is useless: the file has one keyframe, at 0, and Samsung plays the stand while it catches up.

Cut the stand out of the file. Loop the file. Do not seek.

```
ffmpeg -ss 2.25 -to 5.7 -i bolt-thunder-run.mp4 -an -c:v libx264 -crf 18 -pix_fmt yuv420p -g 1 -movflags +faststart
```

Check the new first frame and the new last frame are both mid-stride. Then `loop = true`. Bump the `?v=` on the video tag or the phone keeps the old clip.

### Do not

- Seek the run clip to hide the stand. Trim the file.
- Stretch the sky. Portrait video, real aspect.
- Pan the floor and leave the moon fixed.
- Snap the camera back to 180.
- Plant a spire on his feet.
- Film a new ground video per meter. The plate speed is the world.

## Do not

- Seek a ground mp4 on the phone.
- Bake Bolt into the plate.
- Regenerate C2.
- Treat a left swipe as a failed right orbit. Left is `plain-left`, and it must reach the last frame.
- Cover the center vista with a JPEG.
- Let `thunderOn` fall through to the dog for even one frame.
- Zoom below 1.

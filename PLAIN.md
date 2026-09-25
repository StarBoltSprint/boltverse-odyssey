# PLAIN — Thunderwolf vista, one native ground

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

## Procedural plain (not built — next cook)

Do not film another world video per meter. Film once:

- one empty ground that scrolls
- one sky loop (moon)
- Bolt: back, left, right
- each prop: one cutout loop, sometimes three angles

Place props as quads, same math as the foes (`z`, scale toward the horizon). Seed is `hash(cellX, cellZ)`. Same cell, same prop. One flipbook texture per prop type, shared by every instance. The shader picks the frame. LOD: far = 1 still, mid = 4 frames, near = the whole loop, behind the camera = drop the cell. Bolt stays the one real video.

## Do not

- Seek a ground mp4 on the phone.
- Bake Bolt into the plate.
- Regenerate C2.
- Treat a left swipe as a failed right orbit. Left is `plain-left`, and it must reach the last frame.
- Cover the center vista with a JPEG.
- Let `thunderOn` fall through to the dog for even one frame.
- Zoom below 1.

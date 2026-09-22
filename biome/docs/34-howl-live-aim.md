# 34 — Howl live aim (distance, cut, shatter swap, wet GPU)

**Sealed 2026-09-22 (SmiR / Eclipta Live).** Hang ≠ wipe. Law [32](32-howl-gpu-targets.md) hangs the three Imagine plates. **This file wires them.** A cold Grok copies [`../scripts/howl-live/`](../scripts/howl-live/) — do not invent a laser, a shader of rings, or a floating card.

Paste: [`COLD_START-howl-live.md`](COLD_START-howl-live.md)  
Script: [`../scripts/howl-live/howlLive.js`](../scripts/howl-live/howlLive.js)  
Shader: [`../scripts/howl-live/howlWet.glsl`](../scripts/howl-live/howlWet.glsl)  
Howl KEEP: [`../fx/howl/howl-attack.mp4`](../fx/howl/howl-attack.mp4)

Imagine post: https://grok.com/imagine/post/fd87eff5-39a5-4cd0-a356-ea2a81262ba5

---

## Three films, one contact (never one file)

| Role | File | Key | Lives until |
|---|---|---|---|
| Howl KEEP | `fx/howl/howl-attack.mp4` | pure `#000000` luma | **S** → contact. Then **pause**, even if the mp4 is not finished. |
| Obstacle (rail B) | `obstacle-{type}.mp4` | `#00FF00` | riding the cone, GPU-placed like Bolt |
| Shatter (per type) | `shatter-{type}.mp4` | `#00FF00` | contact → `shatterSec` (~0.86 s), then despawn |

A quartz hit never plays a prism shatter. Howl never contains shards. Obstacle never contains rings.

The **noun** is biome-variable (iron-stone, ice shard, ember geode, tide shell, …). The **math is not**. Dogs / wolves / animals as obstacles = **FAIL**.

---

## Aim — all numbers on fire, every frame

The KEEP video is **one** plate of vertical yellow/blue rings that birth on the **left** and grow **right**. Live does not slide that plate from A to B. Live **stretches a trapezoid** from Bolt’s mouth to the prop. The video **fills** the trapezoid. Rings pop in place.

On **S** (and every rAF while `howlT >= 0`):

```
mouth = (bolt.dest.x + bolt.dest.w * 0.5,  bolt.dest.y + bolt.dest.h * 0.18)
rock  = (mark.dest.x + mark.dest.w * 0.5,  mark.dest.y + mark.dest.h * 0.48)
dist  = hypot(rock - mouth)
fireSec = clamp(0.32, 0.70,  0.3 + (dist / canvasH) * 0.72)
playbackRate = clipFront / fireSec     // clipFront = 3.1 s of KEEP that holds the useful rings
howlT += dt / fireSec                  // 0 → 1
beam = howlFxBeam(mouth, rock, rockW, bolt.dest.w)
```

`howlFxBeam` (see the script):

- unit vector Bolt → rock
- **inset** the tip by `min(rockW * 0.14, len * 0.08)` so the last ring **sits on** the prop, never past it
- thickness at mouth `t0 = min(boltW * 0.3, rockW * 0.55)` (Bolt-head)
- thickness at tip `t1 = max(rockW * 1.02, boltW * 0.22)` (prop size)
- quad corners `A,C` at mouth, `B,D` at the inset tip

KEEP `uv.x` = along the beam (0 = mouth, 1 = rock). `uv.y` = across. Vertex shader:

```
pos = mix(mix(A,C,uv.y), mix(B,D,uv.y), uv.x)
```

**BAN:** translating the Howl quad as a sticker from point A to point B · a thin laser · procedural rings · overshoot past the prop · a beam that starts beside Bolt instead of in his mouth.

---

## Cut — contact kills the Howl video

`HOWL.arrive = 1`. When `howlT >= 1`:

1. `howl.pause()` immediately. Do **not** wait for `ended`. The KEEP may still have seconds left. Cut it.
2. If the obstacle is still live: `shatterT = 0`, seek shatter plate to 0, play it, **swap** the mark video from obstacle → shatter (same dest quad, slight grow).
3. `howlT = -1`. Beam gone. Splash/dust (law 16) at the plant.

If the player Howls a miss (no live mark), still play a short beam then cut. Never leave a looping Howl.

---

## Shatter swap

Same compositor as Bolt / the obstacle (green key, despill, plate bounce, contact shadow). Dest grows `1 + shatterT * 0.32` around the plant. When `shatterT >= 1`, despawn the mark. A new obstacle may spawn after `HOWL.cooldown`.

`playbackRate` of shatter is fast (~7) so the break reads in ~0.86 s.

---

## Wet GPU (anti-sticker) — copy `howlWet.glsl`

Howl key is **luma on black**, not green. Two passes on the same trapezoid:

1. **Glow** — dest expanded ~2.18×, `blend ONE/ONE`, `uGlow=1`. Road spill.
2. **Core** — exact beam, `blend ONE/ONE_MINUS_SRC_ALPHA`, `uGlow=0`. Premul rings.

Fragment: 5-tap luma, `smoothstep` alpha, **plate bounce** (neon-stripped, same family as law 22), mix a little **road** and **wet** sample under the beam so it sits on THIS plate’s light. `uGain` climbs with `howlT`.

Obstacle / shatter use the **keyed Bolt draw** (green + bounce + planted contact shadow). Sit `k` high when planted. No CSS sprite. No scissor card.

---

## Spawn (rail B) — far, 1 file, never a wall

`howlPose` walks `z: 1 → exitZ` on a **seeded lane**. Same cone as law 25:

\[
x(y) = x_{VP} + b_{lane}(y - y_v),\quad w(y) = k_{lane}(y - y_v)
\]

First appearance = **tiny, at the VP**. Bolt does not move; the world comes to him. `pickHowlLane` **must not** close the last free corridor (if rail A already occupies 2 lanes, GPU target = —).

---

## Adapt to another biome (copy this)

1. **REUSE** `fx/howl/howl-attack.mp4`. Do not recook the rings. Width/speed tune here, pixels stay KEEP.
2. Cook `obstacle-{noun}.mp4` from [`../prompts/howl-obstacle.txt`](../prompts/howl-obstacle.txt) — swap the noun only. Green `#00FF00`. One object. No road, no dog, no rings, no shatter.
3. Cook `shatter-{noun}.mp4` from [`../prompts/howl-shatter.txt`](../prompts/howl-shatter.txt) — shards of **that** noun only.
4. Register:

```
{ id: "{noun}", obstacle: "/master/obstacle-{noun}.mp4", shatter: "/master/shatter-{noun}.mp4" }
```

5. Copy `howlLive.js` + `howlWet.glsl` into Live (`plates.ts` + `bolt-key-gl.ts`). Do not rewrite the math.
6. Grade follows **this** road (law 22 bounce). A studio-lit prop on a night plate is a sticker.

Eclipta worked example: noun = black iron-stone (`obstacle-rock` / `shatter-rock`). Plan column = GPU Howl target ([26](26-biome-sprint-plan.md)).

---

## FAIL if

- Howl is a shader / laser / lightning / homemade rings
- the hung KEEP is recooked
- Howl overshoots the prop or starts beside Bolt
- Howl keeps playing after contact
- shatter is inside the Howl file or shared across types
- obstacle / Howl reads as a floating card (no bounce, no contact, knife alpha)
- dogs / animals as rail B
- GPU target closes the last free lane

Related: [32](32-howl-gpu-targets.md) · [13b](13b-anti-sticker-contact.md) · [15](15-gpu-compositor.md) · [17](17-live-compositor.md) · [22](22-gpu24-frost-keep.md) · [16](16-biome-ground-fx.md) · [25](25-hazard-cone.md) · [00](00-PRIORITY0-any-biome.md)

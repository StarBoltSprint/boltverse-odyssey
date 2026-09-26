# 50 — Heightfield posture

**Go 2026-09-26 (SmiR).** Kitchen only. Do not read this to the player.

Height is **posture**, not population. `s + 101` is a different page of the same book, so the ground rolls wider than the grove. Trees still come from n1 / n2 / n3. Hills only say how high the paws and the kit sit.

Jobs: law [46](46-four-picture-jobs.md). The flat room: law [48](48-jade-plate-cook.md). The kit that sits on this number: law [49](49-two-plane-tree.md). The optional rise named in law [44](44-imagine-volume-stack.md) is this page. Stub: [`height.ts`](../scripts/jade-lod/height.ts).

---

## Field

```
s = 7749
page = s + 101          // never 0 / 17 / 31 (spawn pages)
L_h = 28 m              // broader than tree L = 14
base = 0.20 m
amp = 0.20 m            // peak 0.40
raw = fbm(x/L_h, z/L_h, page, octaves=3)
h0 = base + amp * raw
```

Three octaves only. An elder gets no extra dirt. The fern stands on the same field. The last octave is about 7 m, longer than a stride. Do not raise this to 4 while the amplitude is 20 cm. The full page/octave/L lock, including spawn, is law [51](51-octave-map.md).

Spawn is `s+0` / `s+17` / `s+31` at L = 14 / 40 / 22. Height is `s+101` at L = 28. Same `s` on every client. Never `if h > 0.3 spawn elder`.

`fbm` is the hung `valueNoise` (`hash2` in [`noise.ts`](../scripts/jade-lod/noise.ts)). Three octaves per pawn. No `Math.sin` shortcut. No `Date.now` inside `h`.

---

## Path flatten

```
center(z) = (fbm(0, z/64, s+7, octaves=2) - 0.5) * 18
d = abs(x - center(z))
w = 1 - smoothstep(pathHalf * 0.55, pathHalf * 1.15, d)
h = mix(h0, base, w)
```

Toward the base, not a trench. `pathHalf` is 3.4. The same `d` skips spawn and tints the shader. Two octaves only. Do not bake the road, or stones, into the mp4. A hard step at the corridor edge is FAIL. The path page is law [52](52-engine-vs-play.md). It is not a spawn octave.

---

## Who samples

| Who | When | Value |
|---|---|---|
| Bolt | every physics tick | `h(x,z)` then `dog.y = h + 0.45` (withers) |
| New kit | once, at spawn | `kit.groundY` stays static |
| Shadow | from the stored kit | `kit.groundY + 0.02` |
| Volume | from the stored kit | base = `kit.groundY` |
| Ground mp4 | never | mesh stays `y = 0` |

Snap the pawn each tick. No 200 ms lerp. The card group takes `kit.groundY` once. Do not re-sample it every frame (that shimmers).

---

## Collision

Test the xz disc first, then `y = h + foot`. No triangle-mesh collider.

The volume cylinder runs from `kit.groundY` to `kit.groundY + hBole`. Never leave the volume base at 0 while the group sits on a bump.

---

## Ground plate

The video plane is `y = 0` (a later 2% dish is optional). Do not warp the MediaTexture mesh with `h`. If a hoof gap ever shows, raise the base. The film stays the flat Imagine plate.

---

## FAIL

- Reusing the spawn noise for `h`.
- `amp` at 1 m or more without a collision change.
- A long lerp on the pawn's `y`.
- Warping the ground mp4.
- A hard-step flatten.
- A volume base stuck at 0.
- Spawning on a height threshold.
- `Date.now` inside `h`.

---

## Done-when

Stand on the path. The paws sit at 0.20 plus the 0.45 withers, and the corridor eases out to the field with a smoothstep, not a step and not a trench. Off the path the rise stays inside 0.20–0.40. A new bole stores `groundY` once. Its shadow is 2 cm above that, and its cylinder starts there, not at 0. Move Bolt. His `y` snaps the same tick. The card does not shimmer. The ground film is still the flat plane at `y = 0`. An elder and a fern on the same `(x, z)` share `h`. Nothing in spawn reads this page.

World stays Imagine Video assets. The player stays the sealed Bolt. No wallet. No player API keys. Hang URL stays `https://boltverse-odysseyyyy.grok.me`.

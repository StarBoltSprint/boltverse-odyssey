# 54 — Path noise valley

**Go 2026-09-26 (SmiR).** Kitchen only. Do not read this to the player. The valley paste is the authority.

The path is no longer `|x| < 3.4`. It is a valley in the same book as the trees. Its own page, a wider `L`, fewer octaves. Spawn, height, and the plate tint all read the same distance to that valley.

Stub: [`../scripts/jade-lod/path.ts`](../scripts/jade-lod/path.ts). Height applies the flatten. Spawn skips with `onPath`. The plate multiply is [`plates.ts`](../scripts/jade-lod/plates.ts) `groundAlbedo`. The octave note is law [51](51-octave-map.md). Engine versus play stays law [52](52-engine-vs-play.md).

---

## Page

```
s = 7749
page = s + 7          // not 0 / 17 / 31 / 101
L_path = 64 m
octaves = 2           // 3 = snake under paws
wander = 18 m         // ±9 m around x=0
pathHalf = 3.4
center(z) = (fbm(0, z/L_path, page, 2) - 0.5) * wander
d(x,z) = abs(x - center(z))
onPath = d < pathHalf
```

`x` does not enter `fbm`. The center is a function of `z` only. A ribbon that also takes `x` twists, and the pawn climbs a turn that is not there.

Octave 1 is the ~64 m meander. Octave 2 is the ~32 m shoulder. `wander` 18 keeps the ribbon inside ±9 m. The debug line is `x = center(z)`.

Knots are the formula. Consumers sample those knots every 4 m in `z` and lerp. One center per pawn tick, per spawn site, and per tint. Same `fbm` / `hash2`. Deterministic.

---

## Same d

**Spawn.** `onPath` → skip the site. Not `abs(x) < pathHalf`.

**Height.** `w = 1 - smoothstep(pathHalf * 0.55, pathHalf * 1.15, d)`. `h = mix(h0, base, w)`. Soft shoulders. No step at 3.4. Toward the base, not a trench.

**Ground plate.** Do not paint a road in the mp4. A shader strip only:

```
strip = 1 - smoothstep(pathHalf * 0.7, pathHalf * 1.3, d)
albedo *= mix(1, 0.72, strip)
```

**Volumes.** Nothing special. No spawn means no capsule on the ribbon. There is no volume path.

**Pawn.** No magnet. `onPath` is not a SprintCore rail. A later 5% assist is not this cut (`PATH_ASSIST` stays 0).

---

## Not

- A hand spline. Noise is the default.
- An `n4` spawn field used as the road.
- A depression carved into the video plate.
- `center(x, z)` as 2D islands.
- Three or more octaves on this page.

---

## FAIL

- Spawn still on `abs(x)` while height uses `d`.
- Two different centers.
- A baked road in the mp4.
- A huge wander with no debug line `x = center(z)`.
- A forced magnet on the first cut.

---

## Done-when

Walk the valley. Spawn, the posture, and the tint read one `d`. A site with `d < 3.4` grows no tree and no capsule. `h` eases between `0.55` and `1.15` times `pathHalf`, with no step at 3.4. The ground mp4 is still a floor. The shader darkens with `mix(1, 0.72, strip)` between `0.7` and `1.3` times `pathHalf`. `center` ignores `x` and stays inside ±9 m. The debug line is that center. The pawn is not pulled onto it. Octaves stay 2. The page stays `s+7`. The woods did not gain a second path.

World stays Imagine Video assets. Placement only. Particle look stays the Imagine cutouts. The player stays the sealed Bolt. No wallet. No player API keys. Hang URL stays `https://boltverse-odysseyyyy.grok.me`.

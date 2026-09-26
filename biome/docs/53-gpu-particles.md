# 53 — GPU particles

**Go 2026-09-26 (SmiR).** Kitchen only. Do not read this to the player.

A spark layer on the field. Mask-friendly motes, paw sparks, and the Howl burst. The sim is in the vertex shader. The CPU only writes births. One `Points` draw, about 1400 slots. This is GPU playback, not a compute sandbox. It is enough for motes, paws, and a Howl. A million moss specks would want a position texture. That density is not Jade v1.

**Imagine texture obligatoire.** The engine path stays one draw, vertex sim, CPU births. The **look** of every point samples an Imagine-cooked cutout, or a short Imagine burst plate. A flat colored disc, or a procedural-only blob, is not a keep. Crystal is quartz. Crystal is never chrome.

Particles are an FX overlay. They are not the world. They do not spawn a tree. They do not draw terrain. The ground stays the Imagine plate. The Howl rings stay the KEEP in [32](32-howl-gpu-targets.md) and [34](34-howl-live-aim.md). The shatter rule stays law [52](52-engine-vs-play.md): a walk does not shatter. A confirmed Howl does, inside the 25° cone, one press, one target. The primary shatter picture is `public/decor/jade/fx/crystal_burst_vN.mp4` (names only until the cook exists). Point sparks sit on top of that film and still sample an Imagine dust sheet. Unbound film: 80 stand-in points and the crystal still breaks. Bound film: 40 points, life 0.4–0.7, a halo. The points do not invent the shard.

Stub: [`../scripts/jade-lod/particles.ts`](../scripts/jade-lod/particles.ts). Snippets: [`particles.vert.glsl`](../scripts/jade-lod/particles.vert.glsl), [`particles.frag.glsl`](../scripts/jade-lod/particles.frag.glsl). No `three` import. No demo binary.

---

## Playback tape

Shipped particles are a **playback tape**, not a particle-physics engine. Birth, velocity, and life sit in the buffers. The vertex shader integrates `p + v*t + g*t²`. A slot never sees its neighbors. It never sees a trunk. It never writes SprintCore. That is VFX.

A particle-physics engine is a different machine. Its grains touch each other, the colliders, and the pawn.

Three machines. Do not fold them into one.

| Machine | Job | Jade |
|---|---|---|
| VFX integrator | motes, paw sparks, Howl burst look | this law. Keep it. |
| Granular / PBD | debris that settles, moss you can kick | optional later, 80 grains at most |
| Rigid body (Rapier, Cannon, Ammo) | crates and doors | not dust, not the forest |

Bolt's thud is a disc query. Trees are capsules. The dog stays SprintCore. Do not move the sprint into Chaos or Rapier so the woods can be rigid. A hybrid that does that is banned.

What Jade needs:

- Motes, paws, and the Howl look stay on this tape. Imagine textures stay mandatory.
- A Howl that must land and stay is an optional Verlet, 80 grains at most, against `h(x, z)` and the volume discs, dead after 1 s. Not Rapier. The shatter picture stays `crystal_burst_vN.mp4` in law [52](52-engine-vs-play.md).
- A fern you can kick is that same small Verlet. It is not a rigid-body forest.
- Fluid and smoke volumes are not this field. Do not build them.

Any solver, if one is ever switched on, ticks picture-time. The step is the sim `dt`, the same clock as fade and SprintCore at 1/60. Pause freezes births and the integration. `Date.now` is FAIL. A collide reads the volume table and `h(x, z)`. It does not read video pixels.

**Lock.** Do not adopt a particle-physics engine for the field. Keep this VFX tape. Rapier is only for rigid toys later. SprintCore is the dog. Volumes are the woods. Particles are the weather. An engine that eats all three is chrome FAIL.

---

## Buffer

Ring of 1400. Attributes: position (origin), `aVel`, `aBirth`, `aLife`, `aSeed`, `aKind`. The cursor wraps. A dead slot stays in the buffer with `aBirth` in the past. The shader sets point size to 0. One draw, always.

```
p = origin + vel * age + gravity(kind) * age * age
```

The fragment samples the sheet at `gl_PointCoord`. Alpha below 0.02 discards. The rest is premultiplied add (`tex.rgb * a`). There is no `vec3` color stand-in.

| Kind | Number | Imagine sheet | When |
|---|---|---|---|
| mote | 0 | `moss_dust_v0.png` (alternate `pollen_v0.png`) | every 0.18 s around Bolt |
| paw | 1 | `ember_v0.png` | sprint faster than 3.2, every 0.06 s |
| burst | 2 | `spark_dust_v0.png` | Howl halo or stand-in, on top of `crystal_burst_vN.mp4` |

Sheets live in `public/decor/jade/sheets/fx/`. They are cutouts, law [47](47-jade-sheet-cook.md): one subject, transparent, no Bolt. An atlas may replace the three files later. No png ships in this repo.

A missing sheet hides that kind (`fxVisible` returns `hide`, and the fragment discards when `uHas*` is off). HOLD is the same choice. Do not ship a colored disc as the keep look.

---

## Play hooks

Shift + WASD is the sprint. Above 3.2 it writes paw sparks, if the ember sheet is bound.

H or Space is one Howl. The verb in law [52](52-engine-vs-play.md) picks the nearest shard inside the cone (8 m, 12.5° half-angle, origin 0.4 m in front of the pawn). That id still returns when the dust sheet is missing, so the crystal breaks and the points do not draw. With the dust sheet and no mp4 yet, 80 burst slots birth at the shard. With the mp4 bound, 40 slots birth, life 0.4–0.7. No shard in the cone: 80 slots birth in front of the muzzle, and nothing is deleted. A hold does not fire again. The HUD chip reads `fx GPU`.

The burst film is the primary FX when it exists. These points are the stand-in until then, and a halo after. They are not a second Howl film. They are not a colored disc standing in for the plate. They are not an 8 m sphere.

---

## FAIL

- A mesh per sprite at this density.
- Particles that spawn trees.
- Particles used as the terrain detail drawer.
- A compute sandbox required for Jade v1.
- Chrome crystals.
- A spark layer that replaces the ground film.
- A solid-color `gl_Point` disc, or any procedural-only blob, with no Imagine map.
- Shipping colored discs when the sheet is missing. Hide the FX, or HOLD.
- A particle-physics engine for motes, paws, or the Howl look.
- Sparks that read each other, read trunks, or write SprintCore.
- Rapier, Cannon, Ammo, or Chaos used for dust or for the forest.
- Moving the sprint into a rigid-body solver so the woods can be simulated.
- `Date.now` as the particle clock, or as the burst-film clock. Pause must freeze births, the integration, and the mp4.
- An 8 m sphere used as the Howl test. The test is the cone in law [52](52-engine-vs-play.md).
- Colliding a spark against video pixels.
- A fluid or a smoke volume standing in for the field.
- One engine that owns the dog, the woods, and the weather.

---

## Done-when

Stand still with `moss_dust_v0` bound. Motes appear around Bolt about every 0.18 s, one draw, each point a cutout. Unbind the sheet. The motes disappear. They do not turn into jade discs. Sprint with `ember_v0` bound. Paw sparks leave the paws. Press H on a crystal 6 m in front. The card is gone the same frame, the capsule is gone, the burst quad runs (the mp4 when it is cooked, otherwise the 80 points), and those points sample `spark_dust_v0`. With the film bound the halo is 40 points, life 0.4–0.7. Press H in an empty corridor. The pose plays and the points sit in front of the muzzle. Nothing dies. A crystal behind the head survives. No dust sheet: the points stay hidden and the shatter still happens. Dead slots stay in the buffer and draw at size 0. The cursor wraps. The forest did not gain a tree from a spark. The sparks did not stick to a trunk and did not move Bolt. Pause freezes the tape. The ground film is still the plate.

World stays Imagine Video assets. The player stays the sealed Bolt. No wallet. No player API keys. Hang URL stays `https://boltverse-odysseyyyy.grok.me`.

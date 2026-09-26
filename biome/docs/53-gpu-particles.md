# 53 — GPU particles

**Go 2026-09-26 (SmiR).** Kitchen only. Do not read this to the player.

A spark layer on the field. Mask-friendly motes, paw sparks, and the Howl burst. The sim is in the vertex shader. The CPU only writes births. One `Points` draw, about 1400 slots. This is GPU playback, not a compute sandbox. It is enough for motes, paws, and a Howl. A million moss specks would want a position texture. That density is not Jade v1.

Particles are an FX overlay. They are not the world. They do not spawn a tree. They do not draw terrain. The ground stays the Imagine plate. Crystal dust is cyan, not chrome. The Howl rings stay the KEEP in [32](32-howl-gpu-targets.md) and [34](34-howl-live-aim.md). The shatter rule stays law [52](52-engine-vs-play.md): a walk does not shatter. A confirmed Howl does.

Stub: [`../scripts/jade-lod/particles.ts`](../scripts/jade-lod/particles.ts). Snippets: [`particles.vert.glsl`](../scripts/jade-lod/particles.vert.glsl), [`particles.frag.glsl`](../scripts/jade-lod/particles.frag.glsl). No `three` import. No demo binary.

---

## Buffer

Ring of 1400. Attributes: position (origin), `aVel`, `aBirth`, `aLife`, `aSeed`, `aKind`. The cursor wraps. A dead slot stays in the buffer with `aBirth` in the past. The shader sets point size to 0. One draw, always.

```
p = origin + vel * age + gravity(kind) * age * age
```

The fragment is a disc, then `discard`, then premultiplied add.

| Kind | Number | Color | When |
|---|---|---|---|
| mote | 0 | jade | every 0.18 s around Bolt |
| paw | 1 | orange | sprint faster than 3.2, every 0.06 s |
| burst | 2 | cyan | Howl |

---

## Play hooks

Shift + WASD is the sprint. Above 3.2 it writes paw sparks.

H or Space is the Howl. The nearest crystal within 8 m shatters: hide the card, drop the volume, write 80 burst slots. No crystal in range: the 80 slots birth in front of the muzzle. The HUD chip reads `fx GPU`.

The Imagine burst clip from law 52 still plays. These points are the sparks on top of it. They are not a second Howl film.

---

## FAIL

- A mesh per sprite at this density.
- Particles that spawn trees.
- Particles used as the terrain detail drawer.
- A compute sandbox required for Jade v1.
- Chrome crystals.
- A spark layer that replaces the ground film.

---

## Done-when

Stand still. Jade motes appear around Bolt about every 0.18 s, one draw. Sprint. Orange sparks leave the paws. Press H on a crystal inside 8 m. The card is gone the same frame, the capsule is gone, and 80 cyan points leave that point. Press H in an empty corridor. The burst is in front of the muzzle. Dead slots stay in the buffer and draw at size 0. The cursor wraps. The forest did not gain a tree from a spark. The ground film is still the plate.

World stays Imagine Video assets. The player stays the sealed Bolt. No wallet. No player API keys. Hang URL stays `https://boltverse-odysseyyyy.grok.me`.

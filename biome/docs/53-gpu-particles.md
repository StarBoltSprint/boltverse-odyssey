# 53 — GPU particles

**Go 2026-09-26 (SmiR).** Kitchen only. Do not read this to the player.

A spark layer on the field. Mask-friendly motes, paw sparks, and the Howl burst. The sim is in the vertex shader. The CPU only writes births. One `Points` draw, about 1400 slots. This is GPU playback, not a compute sandbox. It is enough for motes, paws, and a Howl. A million moss specks would want a position texture. That density is not Jade v1.

**Imagine texture obligatoire.** The engine path stays one draw, vertex sim, CPU births. The **look** of every point samples an Imagine-cooked cutout, or a short Imagine burst plate. A flat colored disc, or a procedural-only blob, is not a keep. Crystal is quartz. Crystal is never chrome.

Particles are an FX overlay. They are not the world. They do not spawn a tree. They do not draw terrain. The ground stays the Imagine plate. The Howl rings stay the KEEP in [32](32-howl-gpu-targets.md) and [34](34-howl-live-aim.md). The shatter rule stays law [52](52-engine-vs-play.md): a walk does not shatter. A confirmed Howl does. The primary shatter picture is the cooked burst plate `crystal_burst_vN`. Point sparks, when they draw, sit on top of that plate and still sample an Imagine dust sheet.

Stub: [`../scripts/jade-lod/particles.ts`](../scripts/jade-lod/particles.ts). Snippets: [`particles.vert.glsl`](../scripts/jade-lod/particles.vert.glsl), [`particles.frag.glsl`](../scripts/jade-lod/particles.frag.glsl). No `three` import. No demo binary.

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
| burst | 2 | `spark_dust_v0.png` | Howl, on top of `crystal_burst_vN` |

Sheets live in `public/decor/jade/sheets/fx/`. They are cutouts, law [47](47-jade-sheet-cook.md): one subject, transparent, no Bolt. An atlas may replace the three files later. No png ships in this repo.

A missing sheet hides that kind (`fxVisible` returns `hide`, and the fragment discards when `uHas*` is off). HOLD is the same choice. Do not ship a colored disc as the keep look.

---

## Play hooks

Shift + WASD is the sprint. Above 3.2 it writes paw sparks, if the ember sheet is bound.

H or Space is the Howl. The nearest crystal within 8 m shatters: hide the card, drop the volume, play `crystal_burst_vN`. That id still returns when the dust sheet is missing, so the plate plays and the points do not. Point sparks, if the dust sheet is bound, write 80 burst slots at that crystal. No crystal in range: the same 80 slots birth in front of the muzzle, still on the dust sheet. The HUD chip reads `fx GPU`.

The burst plate is the primary FX. These points are sparks on top of it. They are not a second Howl film. They are not a colored disc standing in for the plate.

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

---

## Done-when

Stand still with `moss_dust_v0` bound. Motes appear around Bolt about every 0.18 s, one draw, each point a cutout. Unbind the sheet. The motes disappear. They do not turn into jade discs. Sprint with `ember_v0` bound. Paw sparks leave the paws. Press H on a crystal inside 8 m. The card is gone the same frame, the capsule is gone, `crystal_burst_vN` plays, and 80 points sample `spark_dust_v0` at that crystal. Press H in an empty corridor. The burst plate and the points sit in front of the muzzle. No dust sheet: the points stay hidden and the plate, if cooked, is still the shatter. Dead slots stay in the buffer and draw at size 0. The cursor wraps. The forest did not gain a tree from a spark. The ground film is still the plate.

World stays Imagine Video assets. The player stays the sealed Bolt. No wallet. No player API keys. Hang URL stays `https://boltverse-odysseyyyy.grok.me`.

# 28 — Stills two rails (décor snowballs, events swap)

Extends [22-m](22-m-densify-snowball.md). Cook gate for any biome densify.

Imagine copies **every** `@` ref. A last-frame wall in the stack = every later plate is a wall. **Two rails. Never mixed.**

## Rails

| Rail | Snowball? | Role |
|---|---|---|
| **KEEP** | no, frozen | Geometry teacher. 1-point, 3 lanes, dark asphalt. Always **first** `@`. Never densified. Never replaced by a richer plate. |
| **décor/** | yes, `m` | **One noun** per still, **off the lanes** (light, weather, flora, distant life). |
| **event/** | **no — swap** | Cinematic hazard of **this** plate. Next plate **forgets** it. |

Events in the décor snowball **deposit** (crystal wall, geode in a lane). FAIL.

## One still = one noun

Not “a richer nationale”. i2i from KEEP (or the last good décor still) + **one** ADD. If you recook a whole world, Imagine invents three nouns.

## Clip refs (cap 12)

```
@KEEP  @décor[0..m]  @event-of-THIS-plate
```

- Last frame of a clip **never** enters the stack. It is a tween, not a +1.
- Video `t99` / UUID stills / `bolt-back` on a road cook = FAIL.
- Miss → drop newest **décor** still. Recook from the remaining pack. Do not `@` a failed last.

## Three keyframes (the clip is a tween)

| Key | Content |
|---|---|
| **first** | KEEP + décor. Event FAR or absent. |
| **mid** | Event **in the air**, 1–2 lanes, one free corridor. |
| **last** | i2i of first. **Closer, not fuller.** Event **GONE**. Exposure ≤ first. |

Spectacle lives at **mid**. Last is travel. World ADVANCED ≠ more objects ≠ brighter.

## Play `m`

- Success → next plate (richer). At peak, **hold** the last hung plate — never wrap to empty KEEP.
- Miss (on the obstacle at `tPass`) → `m-1`, previous plate.
- Default Bolt stays **empty Video A + GPU keyed cycle** ([10](10-bolt-cutout-law.md)). Native-slide is [27](27-native-road-slide.md) catalog only.

## Related

[22-m](22-m-densify-snowball.md) · [25](25-hazard-cone.md) · [26](26-biome-sprint-plan.md) · [29](29-imagine-compiler.md) · [30](30-i2i-prompt.md) · [31](31-light-lock.md) · [36](36-gpu-zones-lena-procedural.md) · [COLD_START-stills-two-rails.md](COLD_START-stills-two-rails.md)

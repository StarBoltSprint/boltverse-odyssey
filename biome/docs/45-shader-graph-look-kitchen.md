# 45 — Shader graph look kitchen

**Go 2026-09-26 (SmiR).** Kitchen only. Do not read this to the player.

Law [44](44-imagine-volume-stack.md) poses the card and the capsule. This law shades that card. The graph does not spawn trees, pick LOD, or own the capsule. Nodes shade a card or a plate the CPU already posed.

This file is the recipe for a later cold Grok. It does not ship a new player. It does not rewrite `pyre-stage`. Three.js is not the world.

---

## Who decides

| Job | Graph | CPU / SprintCore |
|---|---|---|
| Sample Imagine plate | yes | — |
| Cutout / fade alpha | yes | fade `t` as a scalar |
| Premultiply, fog, tint | yes | — |
| Billboard yaw 70/30 | no | `billboardYaw` |
| Which meshLod | no | `holdBand` |
| Capsule | never | occupancy grid |

`holdBand` is the sticky band in [`../scripts/jade-lod/lod.ts`](../scripts/jade-lod/lod.ts) (enter / leave hysteresis). `billboardYaw` is in [`billboard.ts`](../scripts/jade-lod/billboard.ts). Fade `t` is [`fade.ts`](../scripts/jade-lod/fade.ts). The capsule is `volumes` from `tickField` — the occupancy the paws hit. The graph never reads it.

**FAIL:** a node that reads world position to decide a tree exists. That is spawn moved into the shader.

---

## Jade card

One card the CPU already placed. Flattened chain, also the comment on [`card.frag.glsl`](../scripts/jade-lod/card.frag.glsl): sample → multiply fade → discard cutoff → premultiply.

1. Texture Sample (Imagine sheet) on UV0. Later, atlas UV from `AtlasRect[variant]`. RGB is bark and crown. A is the key.
2. Multiply alpha by the FadeAlpha scalar (0–1) from the fade module. `A' = A * FadeAlpha`.
3. Kill: if `A' < Cutoff`, discard. Cutoff `0.45` at rest, `0.02` while fading. Clip, not blend. Clip writes depth.
4. Premultiply: `RGB' = RGB * A'`. Unlit / emissive. Imagine plates are unlit.
5. Fog or mist lerps with camera distance (cheap depth). It is not a second noise that fights seed `s`.
6. Optional crown tint is a static variant switch, 0–3. No per-pixel noise roll.

Resting cards: Unlit + Opacity Mask. Fading cards: Unlit + Translucent, depth write off. Two material instances. Swap onto the fade instance for the ≤8 dissolves. The resting forest stays on the mask.

---

## One graph, two qualities

Same maps. Two instances.

| Instance | Quality | Depth | Who |
|---|---|---|---|
| Mask | no translucency | writes | every resting card |
| Fade | translucency, premultiplied | off | at most 8 dissolves |

The mask graph and the fade graph stay apart. One uber translucent shader for the whole forest is FAIL. The browser port of the mask path is `MeshBasicMaterial` + `alphaTest`. The fade path is the second material.

---

## Parameters

The graph exposes these. Idle values are the resting mask.

| Pin | Rest | Fade |
|---|---|---|
| Map | Imagine sheet | same sheet |
| AtlasRect | variant rect, when an atlas exists | same |
| FadeAlpha | `1` | fade `t` |
| Cutoff | `0.45` | `0.02` |
| MistColor | plate mist | same |
| MistStart / MistEnd | cheap camera-distance fog | same |
| UnlitBoost | unlit plate gain | same |

---

## Ground and sky

A different graph. World-projected MediaTexture, a looping video mesh. UV is world XZ times scale, plus scroll on the Pack clock. Opacity mask only for a keyed hole. The ground texture is never the thing that places trunks.

Sky: spherical UV, yaw only.

An optional second, slower ground sample for roots or puddles is fine. It still does not spawn trees.

---

## Unreal Hybrid

The card graph hangs on `M_CardJade`. The ground graph hangs on `M_PlateGround`. The browser demo's `MeshBasicMaterial` + `alphaTest` is the mask path. That import does not make Three.js the world.

---

## FAIL

- A node that reads world position to decide a tree exists (spawn moved into the shader).
- Scene Color, or a depth peel, used to draw trunks.
- World-aligned noise used as the spawn.
- A dither fade standing in for the hysteresis belt.
- Subsurface scatter on every fern.
- Variance shadow maps on cards. The contact blob is the shadow.
- Parallax occlusion on the ground film.
- One uber translucent shader for the resting forest.
- Sampling the ground texture to place trunks.
- The graph choosing yaw, `holdBand`, or the capsule.

World stays Imagine Video assets. GPU composites keyed layers only. The player stays the sealed Bolt. No wallet. No player API keys. Hang URL stays `https://boltverse-odysseyyyy.grok.me`.

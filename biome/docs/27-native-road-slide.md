# 27 — Native road-slide (OPTIONAL catalog)

**This is not a law. This is not a cook gate. A cold Grok MUST NOT switch a biome to this.**

Default Bolt on every biome stays **empty Video A + GPU keyed cycle** ([10](10-bolt-cutout-law.md) · [15](15-gpu-compositor.md) · [00](00-PRIORITY0-any-biome.md)).

Use this page **only** if the player explicitly asks for a native-baked Bolt / road-slide illusion. SmiR did. That does not replace the default.

---

## What it is

Bolt is **cooked into the Imagine clip** (light, ice, paw contact, spray — all native pixels). A/D does **not** move Bolt in the mp4. The **road UV slides**. The player sees L / C / R. In the file, the wolf never left the center.

Frost take that got closest: Samsung rec `Recording_20260921_153331` — hint *A / D — NATIVE CLIP, THE ROAD SLIDES*.

---

## Four files (same camera, same 6.04 s, same 48 fps, same 720×1280)

| File | Role |
|---|---|
| `master/native-C.mp4` | Imagine I2V. Bolt **baked** on the **center** ice. Rear, running, KEEP cliffs / aurora. |
| `master/empty-C.mp4` / `master/bolt-clean.mp4` | Same plate **empty**. Clean plate. Same rush, same VP. Zero dog. |
| `master/bolt-matte.mp4` | Luma matte of Bolt, **baked offline** (not guessed in the shader). Silhouette per frame. |
| Live `ROAD_SLIDE = true` | Shader samples native clip at a shifted UV, punches with the matte, fills the hole from the clean plate. |

Shader sketch (Live `lane-player.tsx` `SLIDE_FS` when `ROAD_SLIDE`):

```
dx = λ * amp * 2 * K_lane * max(0, plantY − VP.y)
uv' = (u − dx, v)
a = matte(uv').r
color = mix(clean(uv).rgb, native(uv').rgb, a)
```

`λ` = lane (−1 / 0 / +1). Bolt pixels stay native. The world slides under him.

---

## Why it almost worked

- Lighting / contact / scale match the road (no chroma sticker).
- One clip, not three L/M/R films.
- Dodge is an illusion: reverse of a 1-point symmetric cone.

## Why a ghost remains

The hole of the matte sits on the **center neon**. Clean-plate ice does not reconstruct that green stripe (4:2:0 chroma + high-contrast line). Wolf-shaped smear stays in the old lane.

**If this experiment is ever finished:** three equal lanes, Bolt in the **middle of empty ice**, neon **only** as the two inner dividers (left and right of him — never under paws). Then the clean plate is just ice, and the ghost has nothing to stick to. Symmetric cone so a slide of one lane width lands exactly on the neighbor lane.

Do **not** Python-paint dashes on the plate. Imagine only.

---

## Bans (even if the player asks)

- Do not make this the default cook.
- Do not invent a new gallop cycle to replace `lock/bolt-gallop-cycle.mp4` for GPU biomes.
- Do not hang native-C as Video A for a GPU biome (that double-draws a dog).
- Do not GPU-key on top of a native-C plate.
- Matte must be baked (`bolt-matte.mp4`). Shader-guessed luma = FAIL (halo).

---

## Default reminder

Empty plate. Sealed green-screen cycle. GPU compositor. That is the law. This page is a lab note.

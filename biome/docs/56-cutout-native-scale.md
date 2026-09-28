# 56 — Cutout native scale

**Go 2026-09-28 (SmiR).** Kitchen only. Do not read this to the player. HARD.

A keyed or cut Imagine asset that is placed onto another video or plate is cooked **at or above** its final on-screen pixel size. The compositor may **shrink** (`scale ≤ 1`). It does not enlarge.

**Never enlarge a small cutout** (`scale > 1`). Upscale goes soft, mushy, lissé. Pack word: **liche**.

Law [20](20-default-plate-proportions.md) and law [13d](13d-auto-scale.md) already target `withersFrac ~0.10` on a wide chase road. That number is the **cook size**. It is not a post-composite stretch. `computeScale` / `assertScale` still own the lane clamp (anti-truck). If they want `scale > 1` to hit the target, **recook the cut larger**. Do not stretch the pixels.

LOD near / mid / far are **separate cooks**. Law [46](46-four-picture-jobs.md) and law [47](47-jade-sheet-cook.md) already name the canvases (near sheet vs `*_imp` at 64–128 px). Law [55](55-budget-banddraw.md) picks the chair. It does not resize the texture. Shrinking a near sheet onto a mid quad is allowed (`scale ≤ 1`). Blowing a far sheet up to near is FAIL.

Light, shadow, and aura prefer GPU overlays (laws [17](17-live-compositor.md), [22](22-gpu24-frost-keep.md), [38](38-gpu-light-openable.md)) over re-baking them into the cut.

If the object's size is already fixed inside one densify plate and it does not move from plate to plate, **bake it into that plate**. Cut-then-upscale is the wrong job. This does not license baking Bolt, the path beat, a beam, or an open door into Video A (laws [10](10-bolt-cutout-law.md), [37](37-path-beat.md), [38](38-gpu-light-openable.md) stay).

Bolt motion stays the sealed [`lock/bolt-gallop-cycle.mp4`](../../lock/bolt-gallop-cycle.mp4). This law does not authorize a new sprint. The sealed cycle is already the play size: shrink it onto the plate. A small still of the dog stretched up to `withersFrac ~0.10` is FAIL.

Empty plates stay empty of Bolt (laws [47](47-jade-sheet-cook.md), [48](48-jade-plate-cook.md)). Simplex still only places. Imagine still draws. Three.js is not the world.

Meadow heading / run / sky split is the paste [`COLD_START-meadow-jobs.md`](COLD_START-meadow-jobs.md). It is not a second scale law, and it is not a biome number for Engine decrees ~697–706.

---

## Pixel scale

`scale` here is **sample scale**: on-screen pixels divided by the cutout's native pixels. It is not the meter height of a card, and it is not law 44's parallax.

| | KEEP | FAIL |
|---|---|---|
| Compositor scale | `≤ 1` (shrink to the plate) | `> 1` (enlarge) |
| `withersFrac ~0.10` | cook the Imagine asset so the dog already reads that size, then shrink to the lane | stretch a small key until the withers match |
| LOD | one cook per band (near sheet, mid sheet, far imp) | one far sheet scaled up to near |
| Light / shadow / aura | GPU overlay on the keyed layer | re-bake glow or shadow into the cut to fake size |
| Décor whose size never changes across plates | bake into that densify / sol plate | cut it small and upscale |

Lanczos, "sharpen in the compositor", or a second pass that grows the alpha is still `scale > 1`.

---

## FAIL

- `scale > 1` on any keyed cut (tree, ruin, crystal, fern, FX speck, foe, wing, Bolt still).
- One far impostor blown up for the near chair (liche).
- Treating law 20 / 13d `withersFrac ~0.10` as permission to stretch after the key.
- Re-baking light, contact shadow, or aura into the cut instead of a GPU overlay.
- Cutting a static plate object out small, then enlarging it, when it could have stayed in the plate.
- Baking Bolt, the path, a beam, or an open state into densify in order to dodge this law.
- A new Bolt gallop cooked "bigger" to satisfy this law. The sealed cycle is the dog. Only SmiR replaces it.

---

## Done-when

- Every keyed layer on the plate was cooked at or above its on-screen pixel size.
- `assertScale` reports `scale ≤ 1`, and the lane clamp from law 13d still passes.
- Near, mid, and far use their own cooks. The far imp is never the near picture.
- Contact, bounce, and aura are compositor overlays.
- Ground and sky plates are still empty of Bolt.

World stays Imagine Video assets. The player stays the sealed Bolt. No wallet. No player API keys. Hang URL stays `https://boltverse-odysseyyyy.grok.me`.

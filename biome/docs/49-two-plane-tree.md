# 49 — Two-plane tree

**Go 2026-09-26 (SmiR).** Kitchen only. Do not read this to the player.

Two planes are one tree **split by job**. The bole is architecture. It stays a mask almost always. The crown is weather. It is allowed to dissolve. They share an address. They do not share a material path. The impostor is a third far silhouette, not a tiny copy of both.

A single quad forces a translucent fade on the walkable trunk. Depth write dies, the sort goes wrong, and the pawn ghosts through the bark.

Jobs: law [46](46-four-picture-jobs.md). Cheap fade cap: law [44](44-imagine-volume-stack.md). Sheet names: law [47](47-jade-sheet-cook.md). Stub: [`twoPlane.ts`](../scripts/jade-lod/twoPlane.ts).

Only bole and elder are two planes. Ruin has no crown.

---

## Transforms

Parent group at `(row.x, h(x,z), row.z)`. `h` is law [50](50-heightfield-posture.md), sampled once into `kit.groundY`. The group is not yawed. Children are local:

| Child | Local | Size |
|---|---|---|
| Bole | `(0, hBole * 0.5, 0)` | `wBole × hBole` |
| Crown | `(0, hBole + hCrown * 0.5, 0)` | `wCrown × hCrown` |
| Shadow | `(0, 0.02, 0)` | flat disc, radius `r * 2.2` |
| Impostor | `(0, (hBole + hCrown) * 0.35, 0)` | about `1.2 × 1.6` |
| Wire | `(0, hBole * 0.5, 0)` | cylinder `r × hBole` |

| Kind | hBole | hCrown | wBole | wCrown |
|---|---|---|---|---|
| bole | 2.4 | 2.0 | 0.85 | 2.1 |
| elder | 4.2 | 3.2 | 1.15 | 2.8 |
| ruin | 2.8 | — | 3.2 | one card |
| crystal | 1.6 | — | 0.7 | one card |
| fern | 0.6 | — | 1.1 | one card |

Yaw is per child. Do not yaw the whole group.

| Child | Mix toward the camera |
|---|---|
| Bole | 0.55 |
| Crown | 0.85 |
| Impostor | 0.90 |
| Shadow | none |

---

## Visibility, resting

| Band | Shown |
|---|---|
| Near | bole + crown + shadow |
| Mid | bole only |
| Far | impostor only |
| Cull | nothing |

Far does not keep a hidden bole.

---

## Fade edges

Only two edges matter for the trunk. The cap stays 8. A two-plane near ↔ mid fade is **one** slot. Shadow follows the crown. It does not take a second slot. That slot follows `bandDraw`, not `holdBand` (law [55](55-budget-banddraw.md)). A budget demote near → mid is this same crown fade, 220 ms. A budget promote reverses from the current `t` and does not require `dist < 12`. Volume follows `bandDraw`: mid still has the bole capsule, far and cull have none.

| Edge | ms | What moves | Volume |
|---|---|---|---|
| Near → mid | 220 | crown `a` 1→0, shadow 0.28→0, bole stays cutout | stays |
| Mid → near | 220 | the reverse | stays |
| Mid → far | 280 | bole may go translucent **this edge only**; impostor fades in; crown is already 0 | snaps **off** at the 44 m leave, not at the fade midpoint |
| Far → mid | 280 | bole comes back; impostor fades out | snaps **on** at the 40 m enter, even if bole `a` is still 0.3 |
| Far ↔ cull | 180 | impostor quad only, scale 1.00 ↔ 0.35 with the alpha. Not the bole. Not the group. | none |

A budget demote starts the official near → mid fade. It does not snap. A sprint through the belt snaps the matrix and skips the fade.

---

## Materials and sort

Bole and crown are separate material instances. Idle is mask, depth write, front side. The crown is translucent only while `0 < a < 1`. The bole is translucent only on mid ↔ far. The shadow is always translucent, depth write off, opacity `0.28 * aCrown`.

`renderOrder`: shadow 2, impostor 3, bole 4, crown 5. A fading crown has depth write false. On mid ↔ far both bole and impostor have depth write false, and the impostor draws before the bole.

---

## Collision

Cylinder on the bole only: `{ x, z, r: 0.28 | 0.55, h: hBole, block }`. The crown is not a hitbox. Elder `0.55` is the thicker bole sheet, not the crown width.

---

## Edge cases

- Budget demote: start the near → mid fade. Do not snap.
- Sprint through the belt: snap the matrix. Skip the fade.
- Missing crown: near looks like mid.
- Missing bole: skip the tree, or fall back to v0. No floating crown.
- Lean v1: offset the crown `x` by −0.15. Volume `xz` stays.

---

## Done-when

Walk up to a bole. The trunk is a cutout and writes depth. The crown is a second card. Step back through near → mid. In 220 ms the crown and the shadow dissolve, the bole does not go translucent, and the capsule stays. One slot is used, not two. Step through mid → far. The crown is already gone. The bole may fade only here, the impostor fades in, and the capsule drops at 44 m, not halfway through the 280 ms. Come back. The capsule is on at 40 m while the bole alpha is still low. Far shows the impostor only. Cull shrinks that impostor to 0.35 over 180 ms, then it is gone. Scale does not go to 0. The bole is not in that scale. No volume. Elder’s hit is 0.55 m on the bole, not the 2.8 m crown. A v1 crown sits 0.15 m to the side and the capsule does not. A missing bole does not leave a crown in the air.

World stays Imagine Video assets. The player stays the sealed Bolt. No wallet. No player API keys. Hang URL stays `https://boltverse-odysseyyyy.grok.me`.

# 55 — holdBand versus bandDraw

**Go 2026-09-26 (SmiR).** Kitchen only. Do not read this to the player. The budget paste is the authority.

`holdBand` is who the tree is, in meters. The budget is what we draw. Writing the quota into `prev` is FAIL. The split is two fields and one fade.

```
prev[id].band   // sticky, meters only — holdBand
row.bandDraw    // after the quota — GPU and volume see this
row.meshLod     // from bandDraw
```

`holdBand` never reads `bandDraw`. The budget never writes `prev`.

Stub: [`../scripts/jade-lod/lod.ts`](../scripts/jade-lod/lod.ts) `holdBand`, `promoteLod`, `applyLod`. The memory ring that keeps `prev` is law [52](52-engine-vs-play.md). The crown fade is law [49](49-two-plane-tree.md): one slot, 220 ms. The cap of 8 is [`fade.ts`](../scripts/jade-lod/fade.ts).

---

## Quotas

Chairs, not identity.

| Band | Chairs |
|---|---|
| near | 24 |
| mid | 64 |
| far | 96 |

---

## Each frame

1. For each geo row: distance, `band = holdBand(id, dist)`, push `{ row, dist, band }`.
2. Sort by distance, ascending.
3. Counters start at zero. For each item: `draw = band`. If that chair is full, demote `near → mid → far → cull`. Then count the chair it landed in. Set `bandDraw`, `meshLod`, and `volume` from `draw`, not from `prev.band`.
4. `prev[id].band` stays `item.band`.

`holdBand` looks at the id, the distance, `prev.band`, and the enter / leave lines. It does not look at counters, fades, a missing kit, or geo versus mem.

`promoteLod` is the only writer of `bandDraw`. It does not touch `prev`.

---

## Fade

A change in `bandDraw` may start a fade. A change in `prev.band` alone does not.

`kit.lod` in the memory stash is the sticky band. It is not the picture, and it is not a second `prev` map. `meshLod` is the picture.

A budget demote near → mid is the crown-only fade, 220 ms, one slot per tree. Not one slot per plane. A budget promote mid → near reverses that fade from the current `t`. It does not require `dist < 12`.

More than 8 fades: snap the farthest. The nearest 24 have priority.

---

## Volumes and pools

Volume follows `bandDraw`, not `prev.band`. Mid still has the bole capsule. Far and cull have none. Far `meshLod` is the planted cross (law [49](49-two-plane-tree.md)), not a camera card.

Bole pool: `bandDraw` is near or mid, and the tree is not fading. Crown pool: `bandDraw === near` only. A tree that is still near in `prev` but mid in `bandDraw` sits in the bole pool, not the crown pool.

---

## FAIL

- `prev.set` after the quota, with the draw band.
- A volume taken from `prev.band`.
- Requiring `dist < 12` before a budget-demoted crown may return.
- Counting a fade per plane.
- Two `prev` maps that copy each other.

---

## Done-when

Thirty boles inside 10 m: 24 crowns and 6 bare trunks. Cull 6 of the crowned ones out to far. The 6 bare trunks take the crowns where they stand. Their `prev.band` never went mid.

World stays Imagine Video assets. The player stays the sealed Bolt. No wallet. No player API keys. Hang URL stays `https://boltverse-odysseyyyy.grok.me`.

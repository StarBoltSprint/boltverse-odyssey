# 47 — Jade sheet cook

**Go 2026-09-26 (SmiR).** Kitchen only. Do not read this to the player.

Sheets are **cutouts**, not places. Each file is one subject on empty air. The field graph instances them. A sheet that already looks like a forest makes the seed plant a forest on a forest.

Law [46](46-four-picture-jobs.md) names the picture jobs. The two-plane kit is law [49](49-two-plane-tree.md). This law is the cook. No png and no mp4 ship in this repo. Do not rewrite `pyre-stage`. Three.js is not the world. Ground and sky plates are the empty room (law [48](48-jade-plate-cook.md)). Sheets stay cutouts. `bole_v0` has no horizon.

Prompts: [`../scripts/jade-lod/SHEETS.md`](../scripts/jade-lod/SHEETS.md). Names: [`../scripts/jade-lod/twoPlane.ts`](../scripts/jade-lod/twoPlane.ts).

---

## Folder

`public/decor/jade/sheets/`

```
bole_v0.png … bole_v3.png
crown_v0.png … crown_v3.png
bole_imp_v0.png … bole_imp_v3.png
crown_imp optional (far usually bole_imp only)
ruin_v0..v3 + ruin_imp
crystal_v0..v3 + crystal_imp
fern_v0..v3 + fern_imp
fx/moss_dust_v0.png
fx/pollen_v0.png
fx/ember_v0.png
fx/spark_dust_v0.png
```

`vN` is `row.variant` 0–3. The same `N` on bole and crown is a pair: same bark temperature, same light. Elder uses this bole/crown family at the larger quad. `hash2` (the spawn salt) picks the variant. No per-tree art direction.

FX sheets are cutouts too. One subject, transparent, no Bolt. Law [53](53-gpu-particles.md) samples them on the point. `moss_dust` is the mote. `pollen` is the alternate mote. `ember` is the paw spark. `spark_dust` is the Howl point burst. An atlas may replace the three live files later. The primary shatter picture is not a point: it is `public/decor/jade/fx/crystal_burst_vN.mp4` (law [52](52-engine-vs-play.md), rails in [`../scripts/jade-lod/SHEETS.md`](../scripts/jade-lod/SHEETS.md)). Names only until that cook exists. A missing FX sheet hides that particle kind. It does not fall back to a colored disc. Tree sheets still fall back to v0.

Hung `spawnChunk` still emits 0–2. The cook set is 0–3 so v3 can land without a new scatter.

A loop only when a crown must breathe: `crown_v0.mp4`, 2–3 s, first frame matches the last, muted, no camera move. Boles stay stills.

---

## Canvas

| Sheet | Size | Subject fill |
|---|---|---|
| bole | 512×1024 | trunk in the middle third, roots at the bottom edge |
| crown | 1024×1024 | canopy centered, alpha holes are sky holes |
| ruin | 1024×1024 | two pillars and a lintel, the gap is alpha |
| crystal | 512×1024 | one shard, point up |
| fern | 768×512 | low clump, contact at the bottom |
| `*_imp` | 128×128 | a readable silhouette only |
| `fx/*` | 256×256 | one speck, pollen, ember, or dust, alpha around it |

Premultiplied PNG, or straight PNG plus a locked key. No JPEG. No background plate baked in.

---

## Camera and light

Every prompt. Rear three-quarter. Lens about 0.6 m, withers height. The crown keeps that yaw. Its lens rises to mid-canopy. It is not a top-down. One sun, upper left: warm gold rim, cool cyan fill. The same hour as `jade_ground` (late-day gold). No fog on the sheet. An optional dirt kiss at the bole bottom only.

The shared suffix is hung verbatim in [`SHEETS.md`](../scripts/jade-lod/SHEETS.md). Noun lines sit in front of it. They do not rewrite it.

---

## Key

Native alpha is the preferred file. A green plate, when one is used, is a chroma key, not a luma key. Feather 1 px. Despill toward the cyan fill.

**FAIL:** a green halo. QC is a drop onto `jade_ground`. A wrong-light disc is a recook. It is not an inner-glow fix.

---

## Variants

Not random. `hash2` picks the index.

| v | Bole / crown | Ruin | Crystal | Fern |
|---|---|---|---|---|
| 0 | straight young / tight oval | two slim pillars, tight gap | one straight shard | tight oval clump |
| 1 | lean left / wide flat | lean left, wide lintel | shard leans left | wide flat clump |
| 2 | split fork / two lobes | two openings | two shards | two lobes |
| 3 | thick scarred / ragged | thick scarred stones, ragged lintel | thick scarred shard | ragged clump |

---

## Wire

```
TEX.bole[2].bole / .crown / .imp
```

Lookup is `row.kind` + `row.variant` only. Capsule `r` comes from `KIND_TABLE` on the bole, never the crown. A missing file falls back to v0. The row stays visible.

Far impostors are stills. Never a video at 128. `crown_imp` is optional. The far ghost is `bole_imp`.

Crown loops: 2–3 s, first ≈ last (MAE, same bar as Odyssey), wind in the leaves, camera truck stays zero. If the loop ticks, freeze frame 0.

---

## FAIL

- A second trunk, distant woods, a path, or a sky gradient in the sheet.
- Bolt, a wolf, or any creature.
- Hero angle, low angle, or top-down.
- A sun that is not the ground plate's sun.
- A crown that includes the trunk. A bole that includes the full canopy.
- A ruin that is a solid wall.
- Text or UI.
- An impostor whose silhouette does not read.
- An FX sheet that is a forest, a path, a sky, Bolt, or a flat colored disc.
- A particle keep that draws when its FX sheet is missing.

---

## Done-when

Later cook. This repo does not run it.

16 bole/crown pairs, plus ruin, crystal, and fern × 4, plus impostors. Drop v0 on the live field. Near is trunk + canopy on the same `(x, z)`. Mid is the trunk. Far is the 128 ghost. Walk around: no baked woods sliding, no second dog, capsule on the bole.

World stays Imagine Video assets. The player stays the sealed Bolt. No wallet. No player API keys. Hang URL stays `https://boltverse-odysseyyyy.grok.me`.

# 35 — Lane materials (Pack menu before P0 stills)

**Sealed 2026-09-23 (SmiR).** Hang ≠ wipe. Docs + paste only. Does not recook hung masters. Does not invent a gallop.

Paste: [`COLD_START-lane-materials.md`](COLD_START-lane-materials.md)  
Kit step: [`../scripts/biome-cook/README.md`](../scripts/biome-cook/README.md) step 3  
Prompt token: [`../prompts/image-empty-plate.txt`](../prompts/image-empty-plate.txt) `{LANE_MATERIAL}`

Grammar stays Pack. **3 lanes / corridors. 1-point lock-off. ZERO dog in Video A.** Law [20](20-default-plate-proportions.md) measures the frame (width ~0.75–0.82, sky ~45%, plant ~0.80). Those numbers are not a material. They do not mean “paint asphalt”.

---

## Menu (exact names)

Propose this menu **before** empty first / last stills. If the player already named a road material inside `{PAINT}`, use that and do not re-ask. Otherwise offer A–D and wait. Do not cook P0 on a silent default.

| Key | Name | Look |
|---|---|---|
| A | Obsidian glass | Black mirror / obsidian road; cyan luminous edges or dashes in the reflection; pale ground beside |
| B | Crystal quartz | THREE translucent crystal/quartz lane ribbons; light refracts through; soft luminous edges (not painted asphalt dashes); pale ground |
| C | Luminous ribbon | Road = solidified light / Pack ribbon path (align with law [12](12-lane-path-ribbon.md) lane-path vibe); not concrete |
| D | Mix vault | Obsidian or crystal path + volumetric nebula-as-sky (thick 3D gas ceiling lighting the world) — not flat black night, not storm-grey clouds only |

`{PAINT}` **includes** the chosen lane material. Swap `{LANE_MATERIAL}` with the Look sentence (or the player’s own material words) **before** the Imagine paste. Leave the token in the prompt = FAIL. Fill it with unspoken grey concrete = FAIL.

### Swap text (use the row, do not invent a fifth road)

- **A** — black mirror obsidian road, cyan luminous edges in the reflection, pale ground beside the lanes
- **B** — three translucent crystal quartz lane ribbons, light refracting through, soft luminous edges, pale ground, not painted asphalt dashes
- **C** — three solidified-light Pack ribbon lanes, not concrete
- **D** — obsidian or crystal lane path under a volumetric nebula sky, thick 3D gas ceiling lighting the world, not flat black night, not storm-grey clouds only

Menu D picks **one** path (obsidian or crystal) plus the nebula ceiling. It is not a new key.

---

## BAN (silent default)

These are **FAIL** when nobody asked for them:

- grey concrete asphalt highway
- MS-Paint dashes on béton
- boring moderne nationale with no biome paint

A player who **names** concrete, asphalt, or a highway may have that surface. Silence is not that name.

Hung paints that already name a surface stay hung. Frost thin snow, Prismwake obsidian-glass, Cometwake iron-obsidian, canyon→war: do not recook them to match a new pick. This menu is the choice when `{PAINT}` does not already imply a road.

“Wide nationale” in law [20](20-default-plate-proportions.md) / [24](24-camera-1point.md) means the **wide frame** (not a corridor, not an ice hole). It is not an order to paint béton.

---

## Prompt lines that are not a material

[`image-empty-plate.txt`](../prompts/image-empty-plate.txt) and [`video-empty-plate.txt`](../prompts/video-empty-plate.txt) say **no extra follow-path** on top of the lane surface, and no lightning on the ground.

That ban is a second control ribbon, a HUD path, or lightning. It is not “the road must be concrete”.

- Menu **C** makes the three lane ribbons themselves the light. That **is** the road (law 12 vibe). Do not also paint dashes on béton, and do not add a second glowing path.
- Menu **B** is the lane ribbons. “Not a pile in the lanes” means no extra crystal heap. The ribbons stay.
- Video A last still uses the **same** `{LANE_MATERIAL}`, only closer. It does not revert to dark asphalt.

---

## What Grok does

1. Read `{PAINT}`. If it already implies a road material, set `{LANE_MATERIAL}` to that and say which key it matches when one of A–D fits.
2. Otherwise propose A–D (names + looks) and wait.
3. Then cook empty first + distinct last from law 20 **measures**, ZERO dog, with `{LANE_MATERIAL}` swapped in.
4. Hang ≠ wipe. ADD plates. Do not wipe masters. Do not invent a gallop.

## FAIL

- P0 stills before a material is chosen or already implied by `{PAINT}`
- Grey concrete / béton dashes / boring nationale as the unspoken road
- Reading law 20 width as “must be asphalt”
- Leaving `{LANE_MATERIAL}` unsubstituted
- A second follow-path, lightning, Y-fork, portal, HUD, or dog in Video A
- Recooking hung masters to force this menu

## Related

[20](20-default-plate-proportions.md) · [12](12-lane-path-ribbon.md) · [00](00-PRIORITY0-any-biome.md) · [24](24-camera-1point.md) · paste [`COLD_START-lane-materials.md`](COLD_START-lane-materials.md) · kit [`../scripts/biome-cook/README.md`](../scripts/biome-cook/README.md)

# Rocks — the approved recipe (any biome)

**Status: IN TEST (2026-10-03).** Owner phone QC still open. Merged to main 2026-10-03 (PR #162, zone A step 3).
Known issues: rock skins reach magnification 1.15–1.32 up close; one shape per type; the crest hull is not carved.
Part 1 is the generic kit-driven generator.
Part 2 fills it for The Howling Eclipse (zone A). Part 3 is only material ideas for Ember Mesa and Cascade Verdance.

Every visible pixel is an Imagine still: an 8-view hull skin, or a keyed cutout at or under 30 cm.
Code places, seats, and builds the invisible hull and the colliders. It does not draw, tint, or light the rock.
Distance fade is the zone fog already on the scene target (colour sampled from the Imagine sky). Instances stay
resident, so rocks do not pop.

## Part 1 — Generic recipe

### 1. Inputs

| Input | Where | Used for |
|---|---|---|
| Kit id, sun, time of day | `biome/kits/<id>.json` (`python3 tools/kits/kit.py show --id <id>`) | Prompt slots only. Never typed into the placer. |
| Subject words | Untracked local prompt file | Prompt slots `{SUBJECT}`, `{SCALE_CUE}` |
| Counts, metres, seed, corridor, texture caps | `tools/rocks/numbers/<id>.json` (no palette, no prompt text) | Placement, seating, collision, cook size |
| Eight stills per solid | Inbox `views/<type>/yaw-000.jpg` … `yaw-315.jpg` | Hull carve |
| One or two stills per pebble | Inbox `pebbles/<name>.jpg` | Upright cutout |

### 2. What gets a hull

| Class | Cook | Collider |
|---|---|---|
| Stone, boulder, crest / outcrop | 8 views, every 45°, one sharp V0, then each next view is an edit of V0 plus the previous view | Yes, upright yaw only |
| Pebble, chip, shard ≤ 30 cm | One keyed side still, two crossed world-locked quads | No |

Rejected, do not ship: a sphere, blob, or capsule; a camera-facing card for a solid; a 3-view or 4-view swap; a ring or a stone circle; a grid or a row; a mesh from a single photo.

### 3. Prompt templates

Slots only. Exact lines for a cooked zone live in the local prompt file, not here.

**R1 — hero still** (`image_edit`, one source = a ground tile of this biome, `aspect_ratio` 1:1)

```
First image is the ground material. Turn that same material into one freestanding {SUBJECT}.
{SCALE_CUE}. Sharp irregular silhouette, not a sphere and not a blob.
Centered, empty margin on every side, flat chroma-key green, no floor, no contact shadow, no second rock.
Camera fifteen degrees above the horizon, moderate telephoto, {timeOfDay}.
```

**R2 — orbit step** (`image_edit`, image 1 = yaw 0, image 2 = the previous yaw, 1:1)

```
Same single {SUBJECT}, same cracks, same proportions. Orbit the camera forty-five degrees to the right.
Keep the height in frame within a few percent of image 1. Flat chroma-key green, empty margin, no floor, no shadow.
```

**R3 — pebble** (`image_edit`, one ground tile, 1:1)

```
Side view of one {SUBJECT} at most thirty centimetres tall, angular, lower middle of the frame.
Flat chroma-key green, empty margin, no ground plane, no shadow, no text.
```

Stop after two failed cooks of the same defect. Record it. Do not spend a third still on it.

### 4. One command

```
python3 tools/rocks/build.py --kit <id>
```

The tool keys the green screen (flood from the border, no despill), scales plates down so heights agree,
runs `tools/objsheet/sheet.py`, then `tools/walkaround/build.py` (surface nets, vote 7 of 8, no mesh generator).
It writes `packs/<pack>/src/rocks/` (asset, mesh, views, cutouts, `manifest.json`).
Placement check alone: `python3 tools/rocks/selftest.py`.

### 5. Placement and seating

- Deterministic hash. Cluster seeds on a jittered lattice, then stones and boulders in an annulus, pebbles farther out, crests only on high ground beside the path.
- Corridor: half-width and heading from the numbers file, plus a bubble around spawn. A rock is rejected when its footprint enters that keep-out.
- Neighbours of the same type inside the clone radius must differ in yaw or in scale. Cutout neighbours may differ by variant instead.
- Seat: sample the relief on a 3×3 under the footprint and put the mesh bottom on the minimum. No pitch. The uphill side sinks by at most `spanMax`. Steeper footprints are not placed.
- Scale stays inside the type range and at or under 1. Texture long side is `maxTex`, so the play view does not enlarge the still (`LINEAR_MIPMAP_LINEAR`, DPR ≤ 2).

### 6. Play

`packs/<pack>/play/rocks.js` loads after the first frame. Hulls are instanced (one draw per type, at most 64).
Pebbles are one instanced draw of two crossed quads, world-locked, alpha tested, into the same scene target as the ground
so the existing fog covers them. No per-frame allocation. Missing manifest: the zone still boots.

## Part 2 — Filled example: The Howling Eclipse (zone A step 3)

Kit `howling-eclipse`. Numbers `tools/rocks/numbers/howling-eclipse.json`. Seed `20261003`.
Spawn (−6, −14), heading 32°, corridor half-width 4.2 m, bubble 9.5 m, length 80 m.

| Type | Count | World size (m) | Scale | min across (m) | max tex | Collider |
|---|---:|---|---|---:|---:|---|
| crest | 6 | 1.75 × 1.65 × 1.60 | 0.90–1.00 | 9.2 | 640 | yes |
| boulder | 16 | 1.55 × 1.35 × 1.45 | 0.92–1.00 | 10.0 | 512 | yes |
| stone | 28 | 0.54 × 0.95 × 0.50 | 0.62–1.00 | 6.0 | 512 | yes |
| pebble | 40 | height 0.16–0.26 | 0.78–1.00 | 4.8 | 384 | no |

Crests also require macro height ≥ 0.45 m. Span caps: crest 0.32 m, boulder 0.28 m, stone 0.20 m, pebble 0.10 m.
Six cluster seeds, step 11 m, separation 16 m. Clone radius 4.2 m, yaw gap 38°, scale gap 0.12.
Command: `python3 tools/rocks/build.py --kit howling-eclipse`.

Subjects (words only here): a tall jagged plate-stone, a bulky broken boulder, a compact three-peak outcrop, a chip cluster, a low shard. Exact prompts and still ids are in the local file and `provenance.json`.

This pass carved the boulder and the stone. It did not carve the crest. Yaw 90 and yaw 270 of that outcrop are shorter than the other six, and they are also the denser plates. Shrinking the tall plates to match height breaks the area lock. Enlarging the short plates is forbidden. Two cooks were already spent, so the crest stays a known issue. The placer still writes the six crest slots. Play skips them when `assets` has no crest hull. The boulders (1.35 m) are the pieces that cut the sky at the 1.22 m eye.

The carve is shorter than that kit height when the still keeps a margin. Play sets `drawScale` so the mesh height matches `objectSize` times the instance scale, and uses the same scale on the collider. The texture file is not enlarged. An upright hull still cannot tilt: on a slope the gap or the sink stays inside `spanMax`.

## Part 3 — Ember Mesa and Cascade Verdance

Same generator. New numbers file, new Imagine kit, same corridor rule tuned to that zone's spawn.

| Role | Ember Mesa | Cascade Verdance |
|---|---|---|
| Crest | stacked sandstone ledge with a broken lip | mossy slate rib, wet along the cracks |
| Boulder | heat-split block, grit in the joints | water-worn boulder, one pale mineral seam |
| Stone | sharp scree chunk | small slate shard |
| Pebble | desert chips and a grit clump, ≤ 30 cm | wet pebbles and a moss cap, ≤ 30 cm |

**Zone B step 1g (2026-10-04) — IN TEST.** This pass did not run `tools/rocks/build.py`. It placed 22 upright keyed cutouts (`pile.png`, `tuft.png`, heights 0.26 m and 0.18 m) beside the lane, and six touch blocks on the loft. The lane in front of the paws stays clear. This does not replace the zone A rocks recipe.

## Pitfalls

- A long ridge fails the area lock between front and side. Cook a compact outcrop, about as deep as wide.
- A dull chroma screen will not separate at a strict green test. Flood a slightly wider green, still from the border only. Do not despill.
- One short orbit view pulls the set. Scale the taller plates down to it. Do not scale any plate up. If the short view is also the denser view, that down-scale breaks the area lock. Two cooks, then stop and list it.
- Upright hulls cannot hug a slope. Reject a footprint whose relief span exceeds the cap, and seat on the low side.
- Eight 1024 views of three types blow the phone texture cap. Cap the keyed plate (`maxTex`) and keep large rocks farther from the chase so magnification stays ≤ 1.
- Do not paint rocks into the ground skins or the sky. Read height. Do not edit `field.js` to move a rock.

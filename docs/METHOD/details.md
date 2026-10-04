# Details — micro-detail generator (any biome)

**Status: IN TEST (2026-10-04).** Owner phone QC still open. Not APPROVED. Not VALIDATED.
Part 1 is the generic kit-driven generator.
Part 2 fills it for The Howling Eclipse (zone A, step 5). Part 3 is only material ideas for Ember Mesa and Cascade Verdance.

Every visible pixel is an Imagine still, keyed from its own pixels. Code places, seats, and instances the cards.
It does not draw, tint, light, or build a collider. Distance fade is the zone fog already on the scene target.
Instances stay resident, so details do not pop inside the chase range.

## Relationship to the ground cards and the rock pebbles

**Keep beside.** Do not absorb either layer.

| Layer | What it is | Where it sits | This generator |
|---|---|---|---|
| Ground cutout cards | `terrain.js` `buildCards`, families c0–c2, 200 points, 400 crossed quads, zone-wide | On the ground mesh, larger than these cards | Untouched. Different size, different atlas. |
| Rock pebbles | TerrainFeatureGenerator, 40 upright cutouts, ≤ 30 cm, outside the corridor (`minAcross` 4.8 m) | Off the running path, with a collider-free card but inside the rock manifest | Untouched. The dense detail band is inside `nearHalf` 3.2 m, so it does not sit on that pebble ring. |
| DetailGenerator | This page. Smaller, denser, no collider | Inside and beside the running corridor and the clearing, where rocks are refused | New. |

A sparse ground card and a detail may overlap in plan. They are different sizes. They do not share a texture or a draw.

## Part 1 — Generic recipe

### 1. Inputs

| Input | Where | Used for |
|---|---|---|
| Kit id | `biome/kits/<id>.json` (`python3 tools/kits/kit.py show --id <id>`) | Identity check only. The placer never reads paint. |
| Subject words | Untracked local prompt file | Prompt slots `{SUBJECT}`, `{COUNT}`, `{SCALE_CUE}` |
| Counts, metres, seed, corridor, bands, texture caps | `tools/details/numbers/<id>.json` (no palette, no prompt text) | Placement, seating, atlas cap |
| One sheet per type | Inbox `<sheet>` named in the numbers file | Several separate subjects on one flat field, keyed and cropped |

### 2. What a detail is

A detail is one upright subject at or under 30 cm. Play draws two crossed world-locked quads (yaw and yaw + 90°). Not a camera-facing card. Not a mesh. No collider. Bolt gallops through every card.

Types in the numbers file are the biome's own names. Zone A uses shard, pebble, ridge, and tuft. Another biome may rename the types. The placer does not care about the names except for the ridge / shard / tuft gates in `place.py` (hollows, cracks, height). A new name skips those gates and still scatters.

### 3. Prompt templates

Slots only. Exact lines for a cooked zone live in the local prompt file, not here.

**D1 — sheet** (`image_edit`, one source = a ground tile of this biome, one call, several subjects)

```
First image is the ground material. Paint {COUNT} separate {SUBJECT} on one sheet.
{SCALE_CUE}. Each one is freestanding, with a gap of empty field between neighbours.
Flat chroma-key field, no floor, no contact shadow, no text, no second scene.
```

**D2 — one subject, if a sheet fails** (`image_edit`, same ground tile)

```
First image is the ground material. One freestanding {SUBJECT}.
{SCALE_CUE}. Centered, empty margin, flat chroma-key field, no floor, no shadow.
```

Stop after two failed cooks of the same defect. Record it. Do not spend a third still on it.
A sheet that keys into several crops is one call, not one call per crop.

### 4. Prep and key

`tools/details/build.py` floods the key from the border with the same channel test as the rock pebble key.
No despill and no tint. Components thinner than 14 px on the short side, or with a bounding-box fill under 0.12, are dropped.
A type may set `minArea` (tufts). The pack scales crops **down** only, into one atlas under `atlasMaxSide` and `atlasMaxTexMB`.
Edges of opaque pixels are bled a few pixels into the empty alpha so mipmaps do not pull a dark rim. The file is not premultiplied.
`maxHeightM` for a crop is `contentH / texelsPerM`. Instance height is clamped to that, so a still is never enlarged.

### 5. Placement and seating

- Deterministic hash from `seed` and the type name. Same numbers, same points.
- Path frame: spawn and heading from the numbers file (the rock corridor copy). Forward and right come from that heading.
- Bands: 72% of samples inside `nearHalf`, 18% between near and `midHalf`, 10% out to `farHalf`. Both sides. No lattice, no ring, no row.
- Pebbles: 28% retarget to a solid's annulus, from hull radius + 0.55 m to + 2.05 m, still outside the hull.
- Reject: outside the zone radius times `insideFrac`, farther than `farHalf` unless inside `clearingR`, inside `spawnClearM` of spawn, or inside a solid hull + 0.1 m.
- Ridge prefers a hollow or a crack. Shard prefers a crack. Tuft prefers the mid height band. Each gate is a hash, not a hard wall, so a few still land elsewhere.
- Neighbours of the same type inside `neighbourM` must differ in variant or in yaw (at least 28°). If not, the yaw steps and the variant changes.
- Seat at load, not per frame. `y` is the minimum of a 3×3 sample of the **drawn** relief (`heightAt`, macro plus micro) minus a few millimetres and the bottom pad. The quad grows up. World-locked. No camera yaw.

### 6. Play

`packs/<pack>/play/details.js` fetches the manifest **after the first frame**. `?details=0` skips the mount. A missing manifest boots an empty layer.
One texture, one instanced draw, `STATIC_DRAW`, `LINEAR_MIPMAP_LINEAR`, alpha test, depth write, no blend. The draw is skipped in the id pass.
No per-frame allocation. No collider. Fog is the scene fog. Magnification for a card is `focal * worldHeight / (distance * contentH)`, with distance floored at 0.35 m so a camera inside a card does not report infinity.

### 7. One command and QC

```
python3 tools/details/build.py --kit <id>
python3 tools/details/selftest.py
```

The build writes `packs/<pack>/src/details/atlas.png` and `manifest.json`.
The selftest checks the numbers file (schema, no hex, no palette words), kit id, height ≤ 30 cm, no collider, deterministic placement, at least 90% of the asked count, near density above 0.4 per m² and at least 3× the far density, a spawn keep-out, and a separation gap.

## Part 2 — Filled example: The Howling Eclipse (zone A step 5)

Kit `howling-eclipse`. Numbers `tools/details/numbers/howling-eclipse.json`. Seed `20261004`.
Spawn (−6, −14), heading 32°, corridor half-width 4.2 m, bubble 9.5 m, length 80 m (copied from the rock numbers).
Bands: near 3.2 m, mid 7.5 m, far 16 m, clearing radius 14 m. `texelsPerM` 1800. Focal 1793 px. Atlas cap 11 MiB, side 2048.

| Type | Count | Height (m) | Scale | min separation (m) | Variants kept | texels/m | mag 1 at (m) |
|---|---:|---|---|---:|---:|---:|---:|
| shard | 260 | 0.11–0.16 | 0.94–1 | 0.36 | 4 | 1801.2 | 0.995 |
| pebble | 220 | 0.12–0.18 | 0.94–1 | 0.32 | 4 | 1800.1 | 0.996 |
| ridge | 100 | 0.08–0.14 | 0.94–1 | 0.90 | 4 | 1820.8 | 0.985 |
| tuft | 120 | 0.12–0.18 | 0.94–1 | 0.42 | 3 | 1800.9 | 0.996 |

Placed 700. Drawn 1400 (two quads each, all resident). Near 1.0547 / m², far 0.0703 / m², clearing 214.
Atlas 2048×1024, 10.667 MiB. One extra draw. Load measured in the step 5 report.
Command: `python3 tools/details/build.py --kit howling-eclipse`.

Subjects (words only here): angular chips, small stones, low dust ridges, low wiry tufts. Exact prompts and still ids are in the local file and `provenance.json`.

## Part 3 — Ember Mesa and Cascade Verdance

Same generator. New numbers file, new sheets from that biome's ground tile, same command.

| Role | Ember Mesa | Cascade Verdance |
|---|---|---|
| Shard | heat-cracked cinder chips | small wet stone flakes |
| Pebble | grit clods and cooled droplets | creek pebbles |
| Ridge | low ash lips in the hollows | low silt lips along the damp |
| Tuft | dry wire tufts | short reed clumps |

## Pitfalls

- A sheet with no empty gap between subjects keys as one blob. Ask for a gap, or split by hand only from the Imagine pixels.
- A joined mirror under a stone survives a mask correlation under about 0.6. Two cooks, then keep it and list it.
- Thin needles key into separate sticks and fail the 14 px side gate. The clump variants remain.
- An oblique sheet becomes a fin, not a flat lip. Height is still clamped. Do not recook past the stop rule.
- Sampling `lat = hash^k * farHalf` pushes points outward. Force the near band with an explicit roll.
- Do not put these cards on the rock pebble ring, and do not retarget them into a solid hull.
- Do not add the detail magnification into the hero `mag` the play gate already checks. Report it beside that number.
- Dark cards on a dark plate vanish in the chase until their world height uses the texel budget (`texelsPerM`). Stay at or under `maxHeightM`. Never enlarge the still.

## Known issues (2026-10-04, stop after two)

- Two crystal crops read soft and low-contrast at the base. Second cook. Not recooked.
- One pebble crop keeps a joined mirror. Second cook. Not recooked.
- Two ridge crops are oblique crests. The broken lip keyed as two pieces. Not recooked.
- One tuft group broke into needles and was dropped. Three clumps remain. Not recooked.
- A thin key fringe can remain. No despill.
- Chase detail magnification measured 0.642. An aimed close pose measured 0.999. A lower eye inside the scatter measured 1.392, because a card was closer than the about-1 m mag-1 distance. Listed, not enlarged.
- At the chase boom the plates still read as a carpet. The cards are flecks there. At eye height they stand up. Not recooked.
- One pebble keeps a joined mirror, so that stone sits proud of the surface. Second cook. Not recooked.

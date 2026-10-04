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

**D3 — one feature** (`image_edit`, one source = a ground tile of this biome, one subject)

```
First image is the ground material. One freestanding {SUBJECT}, centred, filling most of the frame.
{SCALE_CUE}. Side view from a low camera. Flat chroma-key field, opaque subject,
a grit skirt on the subject, no floor, no text.
```

### 3b. Feature rule (v2)

A feature is one Imagine still of one subject, keyed and packed on its own, drawn as **one** world-locked card (not a crossed pair). World height comes from that still's pixel height: `maxHeightM = contentH / texelsPerM`, and texels per metre stay high enough that magnification is at most 1 when the chase eye passes at `minAcross` minus the slide margin. Never enlarge the still. Scale the crop down only to fit the feature atlas.

Place fewer of them than the micro cards. Keep them near the path and on the flanks, and put some on the crests so the ground line cuts the sky. Seat on the drawn triangles. Bury the base a few centimetres so the card edge sits in the surface and the painted skirt stays the contact. A feature taller than about 0.3 m stays off the running line (`runClearM`, plus half the card width). **Since v3.1 every feature is a real obstacle.** Its collider is a thin box across the card, `bodyWPx` wide: the union of opaque columns over the lower half of the rock body, above the dust collar, measured from the still's own alpha. So it is never wider than the rock the card shows. It is offset by `bodyCxPx`, flipped with the card's mirror. Half depth is 0.15 m, or a quarter of that width if smaller. The card is one plane, so depth is not measured. Bolt is pushed out like any solid. The running line stays clear, so the straight gallop is never blocked. Micro cards never collide.

Yaw faces back along the corridor, with a hash jitter, so the chase view sees the face and neighbours do not share a yaw. One still may repeat as a variant. A second still of the same type is a second variant. A card may be drawn mirrored (U flipped, no pixel changed) only when its nearest same-type neighbour is at least 4.5 m away, so a mirror twin never stands beside it (v3, 2026-10-04).

**Near band (v3).** Clumps of one to four features of different types walk along each side of the running line, 1.5–4 m across. Gaps come from smooth value noise along the path (placement only), with open stretches where the noise is low, so the band does not read as a row. A near card's height is the tallest its own pixels allow: `h ≤ dmin · contentH / focal`, with `dmin = (|lat| − slideM) / sin(fovHalfDeg)`. That is the closest a chase eye, slid by up to `slideM`, can be while the card is still inside the frame. Taller cards therefore stand farther out. `runClearM` plus half the card width keeps every card off the running line.

**Seating (v3).** `build.py` measures the painted dust collar at the foot of each still from its own pixels (`skirtPx`: bottom rows of clearly higher luma than the body). Play sinks `skirtBuryFrac` (0.85) of it under the drawn ground, on top of the bottom pad and `buryM`. The rock body rises out of the surface instead of standing on a disc of dust.

### 4. Prep and key

`tools/details/build.py` floods the key from the border with the same channel test as the rock pebble key.
No despill and no tint. Components thinner than 14 px on the short side, or with a bounding-box fill under 0.12, are dropped.
A type may set `minArea` (tufts). The pack scales crops **down** only, into one atlas under `atlasMaxSide` and `atlasMaxTexMB`.
Edges of opaque pixels are bled a few pixels into the empty alpha so mipmaps do not pull a dark rim. The file is not premultiplied.
`maxHeightM` for a crop is `contentH / texelsPerM`. Instance height is clamped to that, so a still is never enlarged.

### 5. Placement and seating

- Deterministic hash from `seed` and the type name. Same numbers, same points.
- Path frame: spawn and heading from the numbers file (the rock corridor copy). Forward and right come from that heading.
- Clumps first (optional `clumps` block): `count` centres, 80% inside `nearHalf`, the rest out to `midHalf`. Each clump takes `members` cards of mixed types (weights in `mix`) inside a jittered `radiusM`, with `sepM` between members. Centres keep 1.6 × `radiusM` from earlier cards so clumps do not merge into a carpet. A clump reads as one small terrain feature from the chase boom, where a lone card is a fleck.
- Bands: 72% of samples inside `nearHalf`, 18% between near and `midHalf`, 10% out to `farHalf`. Both sides. No lattice, no ring, no row.
- Pebbles: 28% retarget to a solid's annulus, from hull radius + 0.55 m to + 2.05 m, still outside the hull.
- Reject: outside the zone radius times `insideFrac`, farther than `farHalf` unless inside `clearingR`, inside `spawnClearM` of spawn, or inside a solid hull + 0.1 m.
- Ridge prefers a hollow or a crack. Shard prefers a crack. Tuft prefers the mid height band. Each gate is a hash, not a hard wall, so a few still land elsewhere.
- Neighbours of the same type inside `neighbourM` must differ in variant or in yaw (at least 28°). If not, the yaw steps and the variant changes.
- Seat at load, not per frame, on the **drawn triangles** (`terrain.meshHeightAt`: the ground mesh grid, linear inside each triangle). `y` is the lowest drawn height under the bottom edge of every crossed plane (5 samples per plane across the content width) minus a few millimetres and the bottom pad. The quad grows up. World-locked. No camera yaw.
- Do not seat on `heightAt` alone: it carries micro relief (up to about ±0.12 m) between mesh vertices that the mesh does not draw. Seated on it, the median card sank 13% and 20 of 700 cards were fully under the drawn ground (measured 2026-10-04). On the drawn triangles: 0 cards more than half buried, 0 floating.

### 6. Play

`packs/<pack>/play/details.js` fetches the manifest **after the first frame**. `?details=0` skips the mount. A missing manifest boots an empty layer.
One texture, one instanced draw, `STATIC_DRAW`, `LINEAR_MIPMAP_LINEAR`, alpha test, depth write, no blend. The draw is skipped in the id pass.
No per-frame allocation. Micro cards have no collider; feature colliders are handed to `play.js` (`detailLayer.colliders`). The chase eye keeps 0.6 m off every feature collider. A camera candidate that is inside that margin, or that sees Bolt through a card, is not a legal pose. As a safety net, the eased eye is pulled toward Bolt along the boom line, to the last clear point (bisected, so the pull is smooth). Fog is the scene fog. Magnification for a card is `focal * worldHeight / (distance * contentH)`, with distance floored at 0.35 m so a camera inside a card does not report infinity. Since v3 only cards whose bounding sphere meets the view frustum count (an off-screen card paints no pixel), and a feature card uses the distance to its nearest point, not its centre. `snapshot().featureMag` reports the feature layer alone.

**Upload (v3 fix).** Every atlas is uploaded with `UNPACK_FLIP_Y_WEBGL` set to true and premultiply off, then the previous flags are restored. Both are shared GL state that other layers change between awaits. Before this fix, the atlases were uploaded with whatever flag another layer had left. The cards then sampled a vertically mirrored band of the atlas: mostly empty pixels for the micro cards (flecks) and a neighbour's interior or the skirt on top for the features ("hovering" lids).

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
| shard | 420 + clumps = 702 | 0.12–0.24 (capped by `maxHeightM`) | 0.94–1 | 0.36 | 4 | 1801.2 | 0.995 |
| pebble | 380 + clumps = 783 | 0.13–0.24 (capped) | 0.94–1 | 0.32 | 4 | 1800.8 | 0.996 |
| ridge | 140 + clumps = 194 | 0.10–0.24 (capped) | 0.94–1 | 0.90 | 4 | 1800.4 | 0.996 |
| tuft | 220 + clumps = 319 | 0.13–0.24 (capped) | 0.94–1 | 0.42 | 3 | 1799.5 | 0.996 |

Clumps: 170 centres, 3–7 members, radius 0.6 m, member gap 0.17 m, mix pebble 0.4 / shard 0.35 / tuft 0.15 / ridge 0.1. Height ranges reach each still's own `maxHeightM` (contentH / 1800), so no card is enlarged.

Placed 1998. Drawn 3996 (two quads each, all resident). Near 2.8168 / m², far 0.1585 / m², clearing 567. (First pass: 700 / 1400, near 1.0547 / m².)
Atlas 2048×1024, 10.667 MiB. One extra draw. Load measured in the step 5 report.
Command: `python3 tools/details/build.py --kit howling-eclipse`.

Subjects (words only here): angular chips, small stones, low dust ridges, low wiry tufts. Exact prompts and still ids are in the local file and `provenance.json`.

### v2 features (zone A step 5b)

Same command. A second atlas `features.png` and `features.json`, one extra instanced draw, one card each. Slide margin 0.4 m, eye used for the cap 1.30 m, bury 0.05 m, running-line clearance 0.95 m. Focal 1793 px.

| Type | Placed | Height (m) | min across (m) | Variants | texels/m | mag 1 at (m) |
|---|---:|---|---:|---:|---:|---:|
| cluster | 18 | 0.70–0.76 | 2.15 | 1 | 911.0 | 1.968 |
| slab | 26 | 0.34–0.43 | 1.40 | 1 | 1231.9 | 1.455 |
| crest | 12 | 0.77–1.07 | 4.80 | 1 | 428.1 | 4.188 |
| pile | 16 | 0.45–0.46 | 1.85 | 1 | 996.1 | 1.800 |

Placed 72. Drawn 72. Feature atlas 1937×1238, 12.197 MiB. Micro atlas unchanged (2048×1024, 10.667 MiB). Worst chase magnification over 120 gallop ticks stayed 0.777 (the micro cards). A low eye measured 2.52.

Subjects (words only here): one cluster, one raised slab, one crest, one pile. Exact prompts are in the local file.

### v3.1 micro thinning and variant weights (zone A, code only, 2026-10-04)

`thin` block in the numbers file, applied by `thin_micro` after the features are placed. A card is kept with probability `typeKeep · (floorKeep + (1 − floorKeep) · affinity^power)`. Affinity is the larger of two terms. Mass affinity is 1 within 0.5 m of a feature or rock edge, falling to 0 at 2.4 m. Crack affinity is 0.7 × (1 − `crack_amt` / 0.07). Bare stretches: 2D value noise at a 6.5 m scale drops every card below 0.4 unless it sits at a mass. Variants are re-chosen by weight: existing stills only, no pixel change, height clamped to the new still's cap. Variants listed in `clumpOnly` (the two clear crystal shards, all four pebble stills) may appear only where affinity is at least 0.75. They also get low weights (crystals 0.08, pebbles `typeKeep` 0.14). Zone A result: 1998 → 714 cards (−64%), clump-only stills 66 (9%), near 1.29/m², far 0.036/m².

### v3 near band (zone A, code only, 2026-10-04)

No Imagine call and no new texture. Same command. `features.near`: lateral 1.5–4 m, along −6 to 80 m, gaps 1.1–4.2 m from value noise, open stretches below noise 0.38, one to four members per clump, clump radius 1.1 m, slide 1.0 m, frame half-angle 15.4°, minimum height 0.3 m, same-type gap 2.2 m, mix slab 0.34 / pile 0.28 / cluster 0.24 / crest 0.14. Type ceilings raised to slab 0.75, pile 0.8, cluster 1.15, crest 1.2 m (each still's own cap binds first).

Placed 165 features (72 from v2 plus 93 in the near band: cluster 28, slab 19, crest 23, pile 23). Near heights: slab 0.56–0.75 m, pile 0.70–0.79 m, cluster 0.67–1.15 m, crest 0.55–1.15 m. drawCalls 12, texMB 259.2 (unchanged). Download 42.21 MB. Chase: worst feature magnification 0.644 over 120 gallop ticks and 0.796 over 420 ticks (frustum metric). Gallop blocked 0, speed 4.4.

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
- A feature atlas that rounds up to the next power of two wastes the phone cap. Pack the used rectangle.
- A chase view with a narrow horizontal field only shows a feature near the path when that feature is a few metres ahead. Cards kept far off the line read as horizon marks, not as ground relief.
- One still repeated on every instance of a type reads as a stamp when the cards are large. A second still is a new cook, not a mirror.

## Known issues (2026-10-04, stop after two)

- Two crystal crops read soft and low-contrast at the base. Second cook. Not recooked.
- One pebble crop keeps a joined mirror. Second cook. Not recooked.
- Two ridge crops are oblique crests. The broken lip keyed as two pieces. Not recooked.
- One tuft group broke into needles and was dropped. Three clumps remain. Not recooked.
- A thin key fringe can remain. No despill.
- Chase detail magnification measured 0.642. An aimed close pose measured 0.999. A lower eye inside the scatter measured 1.392, because a card was closer than the about-1 m mag-1 distance. Listed, not enlarged.
- At the chase boom the plates still read as a carpet. The cards are flecks there. At eye height they stand up. Not recooked. Code-only follow-up (seat on the drawn mesh, 2.85× cards, clumps, heights up to each still's texel cap) roughly doubles to triples the visible cards in the chase frame but does not change the read: a 0.13–0.23 m card at 5–10 m is 25–80 px on a 1600 px screen. A real fix needs larger source crops (one subject per still, D2) so taller cards stay at mag ≤ 1, which costs new Imagine calls.
- Crossed planes show as a V or an X on thin tufts seen at about 45°.
- Low-eye debug poses (eye 0.4–0.5 m above the ground inside the scatter) measure detail mag 1.27–2.49, because the nearest card is under 0.5 m away (the metric ignores the frustum). The ground plates reach 2.3–3.0 at the same poses. The chase camera (eye ≥ 1.22 m) measured at most 0.78.
- One pebble keeps a joined mirror, so that stone sits proud of the surface. Second cook. Not recooked.
- v2 (2026-10-04): the chase sky line gains feature silhouettes. The near plates in the chase boom still read as a carpet with flecks. The narrow view and the running-line clearance keep a 0.7 m card at about 40–100 px there. Not recooked.
- v2: the first cluster cook was not packed (it did not match the ground). The packed cluster is the second cook, one variant, so the 18 clusters share that still (yaw and scale differ). Stop after two on that first cook.
- v2: crest texels per metre are 428, so magnification 1 sits at 4.2 m. The crest band stays outside that.
- v2: a low eye measured feature-inclusive detail magnification 2.52. The chase run measured 0.777.
- v2: a two-pixel key erode takes the mixed edge off the feature stills. A thin rim can remain. No despill.
- v3: the UV flip bug above is fixed. The micro cards now show their real stills: crystals and pebbles, high contrast against the plates, dense (2.8/m² near the path). From the chase they read as a busy, evenly spread peg field. The micro density was raised while the cards were invisible flecks, so it probably wants thinning. Owner call.
- v3: the near band still reads as two loose lines flanking the path in the wide view. Open stretches break it, but they don't remove it.
- v3: the bottom of the chase frame (the 4–8 m in front of the eye) only shows about ±1.2 m around the running line. The narrow 22.7° view puts the 1.5–4 m band out of frame there, so that strip still shows the plates and micro cards.
- v3 (fixed in v3.1): features had no collider, so off-line steering went through a card and the camera could enter one. v3.1 adds measured-width colliders and the eye guard.
- v3.1: a collider is thin across the card, because the card is one plane and its depth is unknown. Seen from the side, Bolt can stop with his head past the card plane.

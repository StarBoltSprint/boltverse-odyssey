# Ruins — kit-driven RuinGenerator (any biome)

**Status: IN TEST (2026-10-03).** Owner phone QC still open. Do not mark this APPROVED or VALIDATED.

Part 1 is the generic kit-driven generator.
Part 2 fills it for The Howling Eclipse (zone A step 4): the Eclipse Gate and one crashed-ship wreck.
Part 3 is only placement ideas for Ember Mesa and Cascade Verdance.

Every visible pixel is an unlit Imagine still. Code measures sections, lofts the volume, seats the mesh on the relief, and keeps a corridor. It does not draw, tint, or light. The existing zone fog is the only grade on these pixels (law 67, already on the scene target).

The wreck is lore. Bolt does not board it or drive it.

## Part 1 — Generic recipe

### 1. Inputs

| Input | Where | Used for |
|---|---|---|
| Kit id | `biome/kits/<id>.json` | Name of the zone. Prompt slots stay out of this file's cook path. |
| Subject words | Untracked local prompt file | The Imagine call. Never typed into the placer. |
| Metres, positions, seat caps, keep-outs, texture caps | `tools/ruins/numbers/<id>.json` (numbers only, no prompt text) | Placement, seating, magnification, corridor |
| Gate plates | Inbox `front.jpg`, `side.jpg`, `sec-pier-l.jpg`, `sec-pier-r.jpg`, `sec-lintel.jpg` | Front elevation, thickness, left and right sections |
| Wreck plates | Sealed hard-object skins, or a new measured set | One loft. Do not invent a second hull generator. |

### 2. What gets a volume

| Class | Cook | Collider |
|---|---|---|
| Landmark gate | Front elevation plus one edge-on side, and two different pier sections plus one lintel section. Left and right are read separately. The opening stays a hole. | Keep-out circle. The body eases out. The chase is not snapped. |
| Crashed ship | Reuse a validated measured loft when one exists. Pitch and sink are numbers. Nose contact seats on the relief. | Same keep-out. Not a vehicle. |

Rejected, do not ship: a camera-facing card; an angle swap as the solid; a mirrored half; a code-filled hole; a second copy of a part that is still painted on the skin; a mesh from a single photo; any generator other than a measured loft.

### 3. Prompt templates

Slots only. Exact lines for a cooked zone live in the local prompt file, not here.

**U1 — front elevation** (`image_gen`, tall aspect)

```
Orthographic front elevation of one {SUBJECT}, filling the frame with a small empty margin.
No perspective, no camera tilt, no ground, no sky, no text, no border.
Flat empty background the reader can segment. One mass. The opening is a real hole.
Left and right masses are different. <TONE from the local file>.
```

**U2 — side elevation** (`image_gen`, tall aspect)

```
Orthographic side elevation, one slab seen exactly edge-on. Flat empty background, small margin.
No ground, no sky, no text, no second object, no perspective, no camera tilt.
The shape is the thickness of the wall. <TONE from the local file>.
```

**U3 — section** (`image_gen`, square)

```
Orthographic filled cross-section of one {SUBJECT} part, a flat diagram silhouette, centered, small margin.
One solid shape on a flat empty background. No holes, no shading, no texture, no ground, no text, no second shape.
```

Stop after two failed cooks of the same defect. Record it. Do not spend a third still on it.

### 4. One command

```
python3 tools/ruins/build.py --kit <id>
python3 tools/ruins/selftest.py --kit <id>
```

The tool writes `packs/<pack>/src/ruins/` (`gate.ruin`, `wreck.ruin`, skins, colour-free `.PROMPT.txt` siblings, `manifest.json`, `measure.json`).
Placement check is the selftest. The hard-object gate stays `python3 tools/hard-objects/rebuild.py` and is not loosened.

### 5. Placement and seating

- Positions are numbers in the kit file. There is no second plan file.
- The gate faces spawn. Yaw is derived from that bearing. The wreck yaw and pitch are numbers.
- Seat: sample `heightAt` at the contact point and subtract `sinkM`. The gate sink is a small bite into the ridge. The wreck sink is the ploughed nose. The mesh minimum sits on that contact after the pitch, so the rest of the hull is not floated.
- Corridor: half-width, heading, bubble, and length from the numbers file. A keep circle that enters that ribbon is rejected.
- Magnification: `minApproachM = focalPx / texelsPerM`. The keep radius is the horizontal radius plus that approach. Stills use `LINEAR_MIPMAP_LINEAR` and mipmaps. Do not enlarge a plate.
- The keep slides the body by at most 0.35 m per solve. It does not set `blocked` and it is not on the chase line test.

### 6. Play

`packs/<pack>/play/ruins.js` loads after the first frame. One static upload per skin. Drawn into the same scene target as the ground, before the composite, and only on the colour pass. No per-frame allocation. A missing manifest still boots the zone.

## Part 2 — Filled example: The Howling Eclipse (zone A step 4)

Kit `howling-eclipse`. Numbers `tools/ruins/numbers/howling-eclipse.json`.
Spawn (−6, −14), heading 32°, corridor half-width 4.2 m, bubble 9.5 m, length 80 m.
Sky dome radius in play is 90 m. Both objects sit inside the walkable rim.

| Object | Position (x, z) | Size | texels / m | nearest allowed (m) | keep (m) | Seat |
|---|---|---|---:|---:|---:|---|
| Eclipse Gate | (2.0, 37.1) | height 7.4 m, width 4.538 m, depth 2.89 m | 155.81 | 11.508 | 15.176 | contact height minus 0.18 m |
| Wreck | (−24.0, 12.0), yaw 128°, pitch −14° | length 14 m, height 3.997 m | 160.07 | 11.201 | 18.141 | contact height minus 0.85 m |

Gate: 51.7 m from spawn, bearing about 9°, outside the spawn field of view of heading 32°. Corridor clearance about 20.3 m (edge 16.1 m). Rim distance about 85 m.
Wreck: 31.6 m from spawn, bearing about −35°, outside the spawn frame, in a lower pocket. Corridor clearance about 29.0 m. Rim distance about 70 m.

Command: `python3 tools/ruins/build.py --kit howling-eclipse`.

The gate loft reads the front plate on a 5 px grid. The walk opening meets the bottom border, so a flood from the corner does not see it. The hole is the tall dark span between the jambs, plus enclosed voids of at least 800 px. Cells in that hole have no faces. Left of the hole uses `sec-pier-l`. Right uses `sec-pier-r`. The band above the hole uses `sec-lintel`. Thickness comes from the side plate, scaled per cell. The back reuses the front skin. The ring is paint on that skin, not a second volume.

The wreck is the validated Howl loft (`tools/hard-objects/rebuild.py`), scaled to 14 m, pitched −14° about Z, then dropped so the lowest vertex is the contact. Skins are byte copies of the sealed port, starboard, top, belly, and stern plates. Nacelles, bells, turrets, and the bridge volume are not rebuilt (`skinNacelles` 0, `skinBells` 0). The hangar gap stays a hole. The bow cap reuses the port skin's bow column.

Play draws both after the first frame. Measured load on the software GL path was a few hundred milliseconds after `firstFrameMs`. Draw calls move from 10 to 17 (seven ruin draws). See `packs/zone-a/proof/step4/REPORT.md` for the play numbers.

## Part 3 — Ember Mesa and Cascade Verdance

Same generator. New numbers file, new plates, same corridor rule tuned to that zone's spawn.

| Role | Ember Mesa | Cascade Verdance |
|---|---|---|
| Landmark | A tall split slab arch on the far high bench, opening kept as a hole | A fallen lintel span across a side cut, readable from the far bank |
| Wreck | A short hull in a side pocket, nose in the slope, off the spawn heading | A longer hull in a lower pool, off the first frame, seated on the bank |

## Pitfalls

- A side plate that shows the whole gateway is not a thickness. Reject it. One retry, then stop.
- Imagine near-black is not a zero luma. Threshold the plate from the border median, not from a fixed 16.
- An arch that meets the bottom border is outside a corner flood. Measure the dark span between the first and last stone of each row.
- Section plates are silhouettes. They scale thickness. They are not a second pair of piers.
- Do not add the chase boom onto the keep. The corridor would close. A camera that backs into the mass can exceed magnification 1. The heading gallop stays outside the keep.
- `lookAt` does not move Bolt. An eye on the hero makes bolt magnification explode. Put the hero about 6 m from the eye before reading `mag`.
- An eye under `heightAt` looks through the ground sheet. The wreck can be seated and still be missing from that frame.
- Do not register the keep on the chase line test. A hard push there snaps the camera.
- Do not edit the sealed Howl plates or loosen `tools/hard-objects/rebuild.py`. New code stays in `tools/ruins/` and `packs/<pack>/src/ruins/`.

## Known issues

- The front plate has a mild perspective and a relief face on the left jamb. Two cooks were not spent on that plate. It stays.
- Pier sections read as elevation silhouettes, not footprints. Left section slots are not cut as shafts.
- The ring is skin, not a volume. The back of the gate reuses the front skin. Cracks under 800 px are filled.
- The wreck wears the sealed Howl plating. Scorch, torn paint, and lit windows were not recooked (quota). Nacelle, bell, turret, and bridge volumes are omitted, not duplicated.
- The player circles the keep and does not walk through the arch. Backing the camera into the mass can exceed magnification 1.
- The old take-10 gate card in the HUD still points at a dead far coordinate. It is not this landmark.

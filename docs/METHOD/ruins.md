# Ruins — kit-driven RuinGenerator (any biome)

**Status: IN TEST (2026-10-03; colliders 2026-10-04).** Owner phone QC still open. Do not mark this APPROVED or VALIDATED.

Part 1 is the generic kit-driven generator.
Part 2 fills it for The Howling Eclipse (zone A step 4): the Eclipse Gate and one crashed-ship wreck.
Part 3 is only placement ideas for Ember Mesa and Cascade Verdance.

Every visible pixel is an unlit Imagine still. Code measures sections, lofts the volume, seats the mesh on the relief, and keeps a corridor. It does not draw, tint, or light. The existing zone fog is the only grade on these pixels (law 67, already on the scene target).

The wreck is lore. Bolt does not drive it. Since 2026-10-04 he can run into its hangar bay (owner decision: no invisible walls).

## Part 1 — Generic recipe

### 1. Inputs

| Input | Where | Used for |
|---|---|---|
| Kit id | `biome/kits/<id>.json` | Name of the zone. Prompt slots stay out of this file's cook path. |
| Subject words | Untracked local prompt file | The Imagine call. Never typed into the placer. |
| Metres, positions, seat caps, collider band, texture caps | `tools/ruins/numbers/<id>.json` (numbers only, no prompt text) | Placement, seating, magnification, corridor, colliders |
| Gate plates | Inbox `front.jpg`, `side.jpg`, optional `detail.jpg`, `sec-pier-l.jpg`, `sec-pier-r.jpg`, `sec-lintel.jpg` | Front elevation, thickness, a surface plate for the near faces, left and right sections |
| Wreck plates | Sealed hard-object skins, or a new measured set | One loft. Do not invent a second hull generator. |

### 2. What gets a volume

| Class | Cook | Collider |
|---|---|---|
| Landmark gate | Front elevation plus one edge-on side, and two different pier sections plus one lintel section. Left and right are read separately. The opening stays a hole. A surface plate may cover the thickness faces (packed beside the elevation in one atlas, unscaled). | Tight colliders from the drawn faces (section 7). The opening is walkable at full gallop. |
| Crashed ship | Reuse a validated measured loft when one exists. Pitch and sink are numbers. Seat on the lowest vertex, or (`"seat": "sill"`) on the hangar sill so the bay floor is the ground. | Same colliders. The hangar bay is walkable. Not a vehicle. |

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
- Corridor: half-width, heading, bubble, and length from the numbers file. The real footprint (horizontal radius plus Bolt's body radius) must stay out of that ribbon.
- Magnification: `minApproachM = focalPx / texelsPerM` is reported, not enforced: since 2026-10-04 Bolt can walk up to the faces, so close-ups can exceed magnification 1 (known issue, measured by the ruinwalk probe). A nearer surface plate can carry a higher texel rate on the thickness faces. Stills use `LINEAR_MIPMAP_LINEAR` and mipmaps. Do not enlarge a plate.
- There is no keep-out circle (superseded 2026-10-04). Collisions follow the drawn faces, section 7.

### 6. Play

`packs/<pack>/play/ruins.js` loads after the first frame. One static upload per skin. Drawn into the same scene target as the ground, before the composite, and only on the colour pass. No per-frame allocation. A missing manifest still boots the zone.

### 7. Colliders — no invisible walls (owner decision 2026-10-04)

Collisions follow the real geometry. There are no hand-placed boxes and no keep-out circles.
The colliders are rebuilt in play from the same `.ruin` faces that carry the Imagine skins, so any gate or wreck the generator measures (an arch, a 25–30 m monolith, a longer hull) gets its colliders with no edit. Code builds shape only; no pixel, no colour.

**Body (2D, Bolt).** `packs/<pack>/play/collide.js` `buildCollider(groups, frame, heightAt, opt)`:

1. Sample every triangle at `min(cellM, voxM) / 2`. Put each sample on a `cellM` grid in the object frame and read the live relief under it.
2. A sample within `stepM` above the relief lifts the floor there (a sill, a buried hull foot). Bolt walks on it.
3. A sample between `stepM` and `clearM` above that floor is a wall cell (Bolt's body band). Faces above the band (lintel, hull deck) and under it (buried belly) are not walls, so an opening stays an opening.
4. Free cells not reachable from the grid border (a pier's hollow, a sealed hull) become solid.
5. Exact Euclidean distance transform → signed distance field, one 3×3 blur so a stair-stepped wall reads smooth.

`collide(ox, oz, x, z, r)` moves the body in sub-steps of one cell. Inside `r` of a wall it is pushed out along the field gradient, so it slides along the face. Only a head-on push (progress < 12 % for 3 ticks) sets `blocked` and stops the gallop.

**Camera (3D).** The same samples fill a `voxM` occupancy grid; its distance transform (one 3×3×3 blur) is `clearance(x, y, z)` and `clearGrad()`; `segFree()` sphere-marches a line.
In `play.js` the chase line from Bolt's head to the eye eases in (`ruinBoom`): boom length, swing round Bolt and line rise (lower, flatter line under a lintel or deck) are critically damped springs with speed and acceleration caps; a look-ahead on Bolt's own collided path starts the ease before the face arrives. The eye is then a small sphere that cannot come within `RUIN_EYE_SAFE` (0.5 m) of a face (near plane 0.35 m): it moves from where it was toward the chase eye in 4 cm sub-steps, slides on faces with a soft band, and keeps any one-frame jump above 0.4 m as an offset that a spring takes back. Off the ruins the offset is zero and the chase is unchanged. No pose ever snaps because of a ruin.

**Numbers.** `tools/ruins/numbers/<id>.json` → `"collider": {bodyRadiusM 0.3, stepM 0.25, clearM 1.3, cellM 0.1, voxM 0.15, padM 1.2}`, copied into the manifest. The manifest also carries each object's `bounds`, the gate's `openingBoxM` and the wreck's `hangar` (sill, lintel, port side) so tests can derive routes.

**Build gate.** `tools/ruins/build.py` runs the same rule in Python (`tools/ruins/colliders.py`) on flat ground at the seat and refuses a cook whose gate opening or wreck hangar is not walkable for the body radius. `selftest.py` rebuilds the field from the shipped meshes and fails if the opening or the hangar is blocked, a pier or the closed hull side is not a wall, or any object still carries `keepRadiusM`.

**Proof.** `tools/playcheck/src/ruinwalk.test.mjs` (in `npm test`): full-gallop arch run, hangar in/turn/out, head-on runs into each pier and the closed hull, 30° slides, and sweeps across and around both ruins. Ground truth comes straight from the `.ruin` faces, not from `collide.js`: every contact must have a drawn face within body radius + 0.2 m, a stop must be within 0.2 m of the face, the body never enters a face, and lines 0.2 m clear of the bounds touch nothing. Camera: no pop, no acceleration reversal (shake), near plane never opens a face.

**API (play).** `ruinLayer.collide`, `lift`, `near`, `clearance`, `clearGrad`, `segFree`, `where`, `probe` (per-part close-up magnification from the face UVs), `info().colliders`. Debug page: `__play.ruinWhere`, `ruinClearance`, `ruinProbe`, `camState`, `tick(dt, { draw: false })`.

## Part 2 — Filled example: The Howling Eclipse (zone A step 4)

Kit `howling-eclipse`. Numbers `tools/ruins/numbers/howling-eclipse.json`.
Spawn (−6, −14), heading 32°, corridor half-width 4.2 m, bubble 9.5 m, length 80 m.
Sky dome radius in play is 90 m. Both objects sit inside the walkable rim.

| Object | Position (x, z) | Size | texels / m | mag-1 distance (m) | footprint (m) | Seat |
|---|---|---|---:|---:|---:|---|
| Eclipse Gate | (18.451, 25.657), yaw −2.5891 rad; opening on the corridor 50 m from spawn | height 28 m (mesh span 27.7 m), width 16.18 m, depth 6.82 m; opening 7.314 × 18.558 m (7.12 m free in the body band) | elevation 36.64; thickness faces 182.99 | 48.932 on the elevation; 9.80 on the thickness faces | 10.53 | contact height minus 0.18 m |
| Wreck | (−24.0, 14.0), yaw 205°, pitch −2° | length 32 m, height 4.116 m; hangar 6.2 m long, 1.81 m clear, 3.25 m deep | 70.03 | 25.603 | 16.068 | hangar sill on the relief minus 0.05 m |

2026-10-04: the old keep radii (15.176 m and 18.141 m) are gone. The wreck was re-seated at 32 m on its hangar sill so Bolt (2.15 m sprite, 0.3 m body) fits through the bay; its plates are the same sealed Howl plates, so its texel density dropped from 160 to 70 per metre (magnification at close range is a known issue below).

Gate, step 4b (2026-10-04): the opening centre sits on the heading-32 corridor at 50 m from spawn, inside the rim and under the 90 m dome. The elevation is one skin. Thickness faces sample a second plate packed beside it, unscaled. The 7.4 m arch at (2.0, 37.1) is retired.
Wreck: 31.6 m from spawn, bearing about −35°, outside the spawn frame, in a lower pocket. Corridor clearance about 29.0 m. Rim distance about 70 m.

Command: `python3 tools/ruins/build.py --kit howling-eclipse`.

The gate loft reads the front plate on a 5 px grid. Large components are joined so a hairline seam does not drop a slab. The hole is the tall dark span between the jambs, plus enclosed voids of at least 800 px. Cells in that hole have no faces. Left of the hole uses `sec-pier-l`. Right uses `sec-pier-r`. The band above the hole uses `sec-lintel`. Thickness comes from the side plate, scaled per cell. Front and back use the elevation. Thickness faces use the surface plate, repeated along the wall with no scale-up, and packed into one atlas. The ring is not a second volume.

The wreck is the validated Howl loft (`tools/hard-objects/rebuild.py`), scaled to 32 m (14 m until 2026-10-04), pitched −2° about Z (−14° before), then seated so the hangar sill sits on the relief. Skins are byte copies of the sealed port, starboard, top, belly, and stern plates. Nacelles, bells, turrets, and the bridge volume are not rebuilt (`skinNacelles` 0, `skinBells` 0). The hangar gap stays a hole. The bow cap reuses the port skin's bow column.

Play draws both after the first frame. Step 4b packs the gate into one skin, so ruin draws go from 7 to 6 and the zone draw count from 17 to 16. Texture memory stays on the step-4 budget. See `packs/zone-a/proof/step4b/REPORT.md`.

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
- (Superseded 2026-10-04: there is no keep.) Do not hand-place collider boxes or circles; rebuild from the faces.
- A raw voxel distance field has a stepped gradient; a camera sliding on it shakes. Blur it once.
- A first-order chase with a rate cap jumps to full speed when its goal moves. Use a critically damped spring with speed and acceleration caps for every eased camera value.
- Projecting a camera point out of a thin wall along the gradient flips side when the point crosses the wall's middle (a metre pop). Move the eye from where it was, in short sub-steps, so it can never cross a face.
- Rocks are not ruins: a rock on the arch axis is a visible blocker (stone-36 sits 2 m behind the gate's back face).
- `lookAt` does not move Bolt. An eye on the hero makes bolt magnification explode. Put the hero about 6 m from the eye before reading `mag`.
- An eye under `heightAt` looks through the ground sheet. The wreck can be seated and still be missing from that frame.
- A ruin face on the chase line only costs pose score; it never makes a pose illegal, so it cannot force the snap path.
- Do not edit the sealed Howl plates or loosen `tools/hard-objects/rebuild.py`. New code stays in `tools/ruins/` and `packs/<pack>/src/ruins/`.

## Known issues

- The front plate has a mild perspective and a relief face on the left jamb. Two cooks were not spent on that plate. It stays.
- Pier sections read as elevation silhouettes, not footprints. Left section slots are not cut as shafts.
- Step 4b: the eclipse mark is painted above the lintel, on the empty part of the elevation, not as a frame inside the opening. Two cooks did not seat it in the arch. It was not cooked again. It is not a second volume, so nothing was inpainted off the skin.
- The elevation is 36.64 texels/m. The heading gallop measured a worst close-up of 14.99 on that face at 3.265 m (along 59.25, centreline). Thickness faces are 182.99 texels/m (about 9.8 m); a wall eye measured that face at 3.19. Edge samples are binned at 0.32 m. The miss is reported, not hidden.
- The mesh spans 27.7 m of the 28 m scale. The last partial row of the plate is outside the 5 px grid.
- The wreck wears the sealed Howl plating. Scorch, torn paint, and lit windows were not recooked (quota). Nacelle, bell, turret, and bridge volumes are omitted, not duplicated.
- (Resolved 2026-10-04) Bolt now walks through the arch and into the hangar; the keep-out is gone.
- Close-up magnification near the ruins exceeds 1 (pixels are never stretched by code, but Bolt can now stand next to a 70 texels/m hull): see the step 4 collision report for the worst measured values (gate pier, wreck hull inside the bay, and Bolt's own sprite when the boom is short in the bay).
- Turning on the spot deep in the hangar: the chase eye orbits at about 13 m/s and meets the outer hull; it slows over two frames (two acceleration reversals counted, no pop, near plane clear).
- The old take-10 gate card in the HUD still points at a dead far coordinate. It is not this landmark.

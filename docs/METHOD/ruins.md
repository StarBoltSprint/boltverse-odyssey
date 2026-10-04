# Ruins — kit-driven RuinGenerator (any biome)

**Status: IN TEST (2026-10-03; colliders 2026-10-04; old arch kept beside the monolith, owner decision 2026-10-04 09:25).** Owner phone QC still open. Do not mark this APPROVED or VALIDATED.

Part 1 is the generic kit-driven generator.
Part 2 fills it for The Howling Eclipse (zone A step 4): the Eclipse Gate, the kept step 4 arch, and one crashed-ship wreck.
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
Two more stages keep the shake at zero (2026-10-04): near a ruin the chase heading follows Bolt's heading through a critically damped, rate-capped spring (80°/s near a ruin, handed back to the rigid chase once converged), so turning on the spot in the hangar does not whip the eye round into the hull; and the drawn eye tracks the solved eye (position and velocity) through a critically damped follower whose acceleration is capped at 30 m/s², below the shake threshold, so a face contact, a swing or a boom ease bends the eye's path but cannot reverse it frame to frame. A 0.4 m hard guard behind it keeps the near plane off the faces.

**Numbers.** `tools/ruins/numbers/<id>.json` → `"collider": {bodyRadiusM 0.3, stepM 0.25, clearM 1.3, cellM 0.1, voxM 0.15, padM 1.2}`, copied into the manifest. The manifest also carries each object's `bounds`, the gate's `openingBoxM` and the wreck's `hangar` (sill, lintel, port side) so tests can derive routes.

**Build gate.** `tools/ruins/build.py` runs the same rule in Python (`tools/ruins/colliders.py`) on flat ground at the seat and refuses a cook whose gate opening or wreck hangar is not walkable for the body radius. `selftest.py` rebuilds the field from the shipped meshes and fails if the opening or the hangar is blocked, a pier or the closed hull side is not a wall, or any object still carries `keepRadiusM`.

**Proof.** `tools/playcheck/src/ruinwalk.test.mjs` (in `npm test`): full-gallop arch run, hangar in/turn/out, head-on runs into each pier and the closed hull, 30° slides, and sweeps across and around both ruins. Ground truth comes straight from the `.ruin` faces, not from `collide.js`: every contact must have a drawn face within body radius + 0.2 m, a stop must be within 0.2 m of the face, the body never enters a face, and lines 0.2 m clear of the bounds touch nothing. Camera: no pop, zero acceleration reversals (shake) on every run (arches, hangar turn, walls, slides and all sweep lines), near plane never opens a face.

**API (play).** `ruinLayer.collide`, `lift`, `near`, `clearance`, `clearGrad`, `segFree`, `where`, `probe` (per-part close-up magnification from the face UVs), `info().colliders`. Debug page: `__play.ruinWhere`, `ruinClearance`, `ruinProbe`, `camState`, `tick(dt, { draw: false })`.

### 8. Sealed ruins — keeping an earlier model (owner decision 2026-10-04 09:25)

The owner can keep an earlier ruin beside a new one. It is not re-measured and not re-cooked.

- Folder: `tools/ruins/sealed/<id>/` holds the byte copies of the earlier `.ruin` mesh, its skins, their colour-free `.PROMPT.txt` siblings, and `sealed.json` (metres, opening box, bounds, parts, texel rate, source commit). Numbers only.
- Numbers file: `"sealed": [{"id", "dir", "x", "z", "face": "spawn" | "yawDeg", "sinkM"}]`. Position is a number; yaw faces spawn unless given.
- `tools/ruins/sealed.py` packs the skins side by side into one atlas (top aligned, unscaled, no pixel touched) and remaps the UVs, so a kept ruin costs one draw.
- `build.py` refuses a sealed placement that meets the corridor or the spawn bubble, sits outside the rim or the dome, comes within `2 × body radius + 1 m` of another ruin, leaves less than `2 × body radius + 2 m` between its footprint and the walkable rim (Bolt must be able to walk all the way round), or has a rock on the walking line through its opening. It then runs the same opening walk on the body field as for the gate.
- The manifest gets one more object (`frame: gate`, `sealed: <dir>`) with `openingBoxM`, `bounds` and `depthM`. Play, colliders (section 7), `selftest.py` and the `ruinwalk` playcheck treat it like any gate: full-gallop run through its opening, piers are walls, sweeps across and around it, zero camera shake.

## Part 2 — Filled example: The Howling Eclipse (zone A step 4)

Kit `howling-eclipse`. Numbers `tools/ruins/numbers/howling-eclipse.json`.
Spawn (−6, −14), heading 32°, corridor half-width 4.2 m, bubble 9.5 m, length 80 m.
Sky dome radius in play is 90 m. All three objects sit inside the walkable rim.

| Object | Position (x, z) | Size | texels / m | mag-1 distance (m) | footprint (m) | Seat |
|---|---|---|---:|---:|---:|---|
| Eclipse Gate | (18.451, 25.657), yaw −2.5891 rad; opening on the corridor 50 m from spawn | height 28 m (mesh span 27.7 m), width 16.18 m, depth 6.82 m; opening 7.314 × 18.558 m (7.12 m free in the body band) | elevation 36.64; thickness faces 182.99 | 48.932 on the elevation; 9.80 on the thickness faces | 10.53 | contact height minus 0.18 m |
| Kept arch (step 4, sealed) | (−5.0, 39.0), yaw −3.1227 rad (faces spawn); 53 m from spawn, 27.0 m from the monolith centre, 27.2 m off the corridor line | height 7.4 m, width 4.54 m, depth 2.89 m; opening 2.43 × 5.19 m (1.82 m free in the body band) | 155.81 | 11.508 | 3.668 | contact height minus 0.18 m |
| Wreck | (−24.0, 14.0), yaw 205°, pitch −2° | length 32 m, height 4.116 m; hangar 6.2 m long, 1.81 m clear, 3.25 m deep | 70.03 | 25.603 | 16.068 | hangar sill on the relief minus 0.05 m |

2026-10-04: the old keep radii (15.176 m and 18.141 m) are gone. The wreck was re-seated at 32 m on its hangar sill so Bolt (2.15 m sprite, 0.3 m body) fits through the bay; its plates are the same sealed Howl plates, so its texel density dropped from 160 to 70 per metre (magnification at close range is a known issue below).

Gate, step 4b (2026-10-04): the opening centre sits on the heading-32 corridor at 50 m from spawn, inside the rim and under the 90 m dome. The elevation is one skin. Thickness faces sample a second plate packed beside it, unscaled. The 7.4 m arch first stood at (2.0, 37.1). Since the owner decision of 2026-10-04 09:25 it is kept as a second ruin at (−5.0, 39.0): off the corridor, 5.3 m of walkable room behind it to the rim, 1.06 m from the nearest rock to its walking line, 3.3 m from the nearest rock to its footprint. Its skins (front and side) are packed into one 1664 × 1248 atlas.
Wreck: 31.6 m from spawn, bearing about −35°, outside the spawn frame, in a lower pocket. Corridor clearance about 29.0 m. Rim distance about 70 m.

Command: `python3 tools/ruins/build.py --kit howling-eclipse`.

The gate loft reads the front plate on a 5 px grid. Large components are joined so a hairline seam does not drop a slab. The hole is the tall dark span between the jambs, plus enclosed voids of at least 800 px. Cells in that hole have no faces. Left of the hole uses `sec-pier-l`. Right uses `sec-pier-r`. The band above the hole uses `sec-lintel`. Thickness comes from the side plate, scaled per cell. Front and back use the elevation. Thickness faces use the surface plate, repeated along the wall with no scale-up, and packed into one atlas. The ring is not a second volume.

The wreck is the validated Howl loft (`tools/hard-objects/rebuild.py`), scaled to 32 m (14 m until 2026-10-04), pitched −2° about Z (−14° before), then seated so the hangar sill sits on the relief. Skins are byte copies of the sealed port, starboard, top, belly, and stern plates. Nacelles, bells, turrets, and the bridge volume are not rebuilt (`skinNacelles` 0, `skinBells` 0). The hangar gap stays a hole. The bow cap reuses the port skin's bow column.

Play draws all three after the first frame. Step 4b packs the gate into one skin, so ruin draws went from 7 to 6 and the zone draw count from 17 to 16. The kept arch adds one draw (zone 17) and its atlas adds 10.6 MB of texture memory (282.8 → 293.4 texMB, over the step 4 figure; reported, not hidden). Download 43.17 → 47.77 MB (the arch mesh is 4.5 MB). See `packs/zone-a/proof/step4b/REPORT.md`.

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
- Rocks are not ruins: a rock on the arch axis is a visible blocker (stone-36 sat about 2 m behind the old arch's back face on its walking line; the build now refuses a sealed placement with a rock on the line).
- `field.contain` (the walkable rim) pushes Bolt radially. A ruin placed near the rim can trap him between the rim and its side: the build checks the room between the footprint and the rim.
- A camera stage that only clamps (a hard push out of a face, a rate cap that drops) gives a one-frame kink. Bound the acceleration of the drawn eye instead.
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
- (Resolved 2026-10-04) Turning on the spot deep in the hangar: two acceleration reversals. Fixed by the chase-heading spring; the strict check now counts 0.
- The hangar interior has no Imagine skin yet; it reads black.
- Worst close-up magnification: 43× on the wreck hull inside the bay at 0.85 m camera distance; about 15× on the monolith elevation (36.64 texels/m at 3.2 m); 3–3.7× on the kept arch's piers.
- The monolith's ring and crown silhouette is stair-stepped (5 px loft grid).
- The kept arch costs one draw and 10.6 MB of texture memory (texMB 293.4).
- The old take-10 gate card in the HUD still points at a dead far coordinate. It is not this landmark. Since 2026-10-04 the HUD text is hidden for players and shows only with `?debug=1`.

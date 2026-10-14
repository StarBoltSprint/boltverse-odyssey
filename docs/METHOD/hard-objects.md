# Hard objects — measured loft (Howl-class frigate)

Back to [METHOD.md](../METHOD.md). This page is the recipe. Status: **VALIDATED** — SmiR 2026-10-03 21:36 Paris, on the phone, after PR #161.
The known issues in section 11 are accepted as declared, not blockers. Contradiction 12 in [decisions-log.md](decisions-log.md) is **RESOLVED**:
[law 59](../../biome/docs/59-invisible-depth-carrier.md#amendment-2026-10-03-lofted-measured-section-hulls) now says lofted measured-section hulls are an approved invisible carrier; every visible pixel stays unlit Imagine.

The first IN TEST row on METHOD.md said "plates as offset copies along computed normals". **This recipe does not do that.**
The plates are the measure and the unlit skin of one lofted volume. A normal is used only to pick which skin a quad
uses (roof, belly, port, starboard) and to flip the quad outward. There is no second shell pushed out along the normal.
Do not add one.

**Approved by SmiR 2026-10-03** (these two points were APPROVED first; the whole recipe is VALIDATED since 2026-10-03 21:36, see the status line):
1. The hull is **lofted measured cross-sections only** — no offset shell, no other hull generator.
2. **Colour-free templates in the repo, exact Imagine prompts only in the untracked local file** (section 0).

## 0. What you are allowed to change

Build only the frigate. Do not edit the capital ship, the corvette, the flight, or Bolt.
Do not edit the flight sky (`tools/sky` or the biome sky). The turntable backdrop is `backdrop.jpg` in this folder, one plate, not a cube.
This folder does not wire itself into a flight. `mountFrigate`'s default place `(280, 22, -250)`, yaw `0.42`,
is the flight-world slot. Leave that default. Callers that want a turntable pass `{ x: 0, y: 0, z: 0, yaw: 0 }`.

Palettes and Imagine prompt text stay out of tracked files (METHOD.md, 2026-10-03), **this folder included**.
Each JPEG has a sibling `.PROMPT.txt` (the gate requires it) holding only the colour-free contract: STATUS, ROLE,
PIXELS / ASPECT, JOB and a colour-free ASK template. The tone / palette / subject wording that produced these plates
lives in the untracked local file `/workspace/grokcli/next/METHOD/hard-objects-prompts.local.md` (one section per plate).

The verbatim Imagine tool-call strings were not stored (JPEG EXIF is JFIF only; no session log kept the call).
**The JPEG is the locked ruler.** The contract to copy if a plate must be replaced is written in section 3
(STATUS, ROLE, ASK template) plus the local file above for the tone lines. It is not a recovered transcript.

## 1. Files

| Path | What it is |
|---|---|
| `tools/hard-objects/images/*.jpg` | Skin plates, part plates, 3 sharpened port edits, and `backdrop.jpg` (turntable only). |
| `tools/hard-objects/images/measure/` | Rulers only. `top.jpg`, `belly.jpg`, `stern.jpg`, `port.jpg`, `stbd.jpg` still show the painted parts. Not skins. |
| `tools/hard-objects/images/*.PROMPT.txt` | Generation contract next to each JPEG. Required by the gate. |
| `tools/hard-objects/frigate.ts` | Reader, loft, part builder, unlit skins. The skinned mesh. |
| `tools/hard-objects/frigate-view.ts` | Optional turntable (orbit, pinch, face buttons, one-lap tour). Not the flight. |
| `tools/hard-objects/rebuild.py` | Measurement gate + hull OBJ. No parts, no skins, no UVs. |
| `tools/hard-objects/out/` | Written by the gate. Gitignored. |

`frigate.ts` loads `/biome/frigate/<name>.jpg`. That URL is the Void Orbit app's `public/biome/frigate/<name>.jpg`.
There is no such directory in **this** repo. This repo only keeps the bytes in `tools/hard-objects/images/`.
This hall repo has no `three` dependency and must not gain one. Do not `npm install three` here to "make it compile".
The gate that proves the measure is Python. To see the skinned mesh, use the other workspace (the one that already
has `three`): copy the loaded JPEGs, including `measure/`, into its `public/biome/frigate/`, copy `frigate.ts` and `frigate-view.ts`
next to its scene, and call `mountFrigate` or `mountFrigateView`. Do not copy the flight, the capital, or the corvette
into this PR, and do not copy this recipe into those files.

The three `port-detail-*.jpg` files are **not loaded**. They are image-to-image crops of `port.jpg`
(aft `x 40–860`, mid `x 780–1620`, bow `x 1500–2360`, all `y 40–490`). They are sharper and misaligned.
Do not skin the hull with them.

## 2. Local frame (do not flip this)

| | |
|---|---|
| `+X` | bow |
| `−X` | stern |
| `+Y` | up |
| `+Z` | port |
| `−Z` | starboard |
| Image x, on port / starboard / top / belly | increases stern → bow. **Left = stern.** |
| Image y, on an elevation | small y = up (deck). |
| Image y, on top and on belly | small y = **starboard** (`−Z`). Large y = port (`+Z`). |
| Belly | bow to the right, **same side up as the top**. Not a mirrored underside. |
| Section image | looking toward the bow. **Left = port**, right = starboard. |
| `u` | 0 at the stern, 1 at the bow. |
| `LEN` | 224. About twice the corvette (112). Change it only for a new ship, and only in both files. |
| `NU`, `NS` | 84 stations along the length, 64 samples around the ring. |
| Stations | `0.08` stern, `0.34` shoulder, `0.56` mid (hangar), `0.90` bow. Section order is that list. |

Why small y on the plan is starboard: the bridge exists only on `stbd.jpg`, and its bright windows sit toward the
**top** of `top.jpg`. If you swap the sides, the tower lands on the port side. That was a real bug (section 9).

World from a section ray: `sx = (hitX − cx) / halfW`, `z = −sx * beam`. So `sx < 0` (left of the section) is `+Z` port.
`beam` is `beamPort` when `sx < 0`, else `beamStbd`. The two beams are not mirrors.

## 3. Which images to ask for

Ask for one plate per row. Aspects below are the ones that produced these pixel sizes.
The prompt file is written from this section alone. Do not open another file to find a shorter prompt,
and do not regenerate a locked JPEG to "match" the ASK.

| File | Pixels | Aspect | Why it exists |
|---|---|---|---|
| `port.jpg` | 2400×528 | 50:11 | Port skin. Hangar hole stays. Stern nozzles are not painted here. The locked box is `measure/port.jpg`. |
| `stbd.jpg` | 2400×528 | 50:11 | Starboard elevation and skin. Closed side, three hatches, **bridge bump**. |
| `top.jpg` | 2400×528 | 50:11 | Plan skin. Plain deck plating where the island was lifted. Nacelle XZ is **not** read here. |
| `belly.jpg` | 2400×528 | 50:11 | Underside skin. Plain plating. Ventral position is **not** read here. |
| `stern.jpg` | 1408×1408 | 1:1 | Stern cap skin. Plain plating. The four bells are **not** painted here. |
| `measure/top.jpg` | 2400×528 | 50:11 | Plan ruler. Nacelles and deck parts stay painted. Beams are read here. Not a skin. |
| `measure/belly.jpg` | 2400×528 | 50:11 | Belly ruler. Ventral turret and painted bells stay. Not a skin. |
| `measure/stern.jpg` | 1408×1408 | 1:1 | Stern ruler. Exactly four bells. Not a skin. |
| `measure/port.jpg` | 2400×528 | 50:11 | Port ruler. The locked elevation box. Stern nozzles stay painted. Not a skin. |
| `measure/stbd.jpg` | 2400×528 | 50:11 | Starboard ruler. Stern nozzles stay painted. Not a skin. |
| `bell.jpg` | 2160×864 | 5:2 | Bell cone unwrap. Mouth band at the left edge. Not the stern plate. |
| `bell-front.jpg` | 1408×1408 | 1:1 | Bell mouth. One circle, corners empty. Not the stern plate. |
| `sec-stern.jpg` | 1408×1408 | 1:1 | Filled slice at u=0.08. |
| `sec-shoulder.jpg` | 1408×1408 | 1:1 | Filled slice at the shoulder, u=0.34. |
| `sec-mid.jpg` | 1408×1408 | 1:1 | Filled slice at the hangar station, u=0.56. Do not cut the hangar out of this slice. |
| `sec-bow.jpg` | 1408×1408 | 1:1 | Filled slice at u=0.90. Often the tall one. |
| `nacelle.jpg` | 2160×864 | 5:2 | One nacelle, side silhouette and skin. |
| `nacelle-front.jpg` | 1408×1408 | 1:1 | Nacelle cap. Content must not touch the corners. |
| `turret.jpg` | 1792×1008 | 16:9 | One twin turret, side. Shared by dorsal and ventral. |
| `turret-front.jpg` | 1408×1408 | 1:1 | Turret cap. Shared. |
| `bridge.jpg` | 1152×1728 | 2:3 | Tower alone, side. |
| `bridge-front.jpg` | 1152×1728 | 2:3 | Tower cap. |
| `pylon.jpg` | 1152×1728 | 2:3 | One strut. Used as **both** the side map and the cap map. |
| `hangar.jpg` | 1792×1008 | 16:9 | Inner walls of the port bay. Crops, not one poster. The mouth stays open. |
| `backdrop.jpg` | 1280×1728 | wide plate | Turntable background only. One plate. Not a cube. Not loaded by the hull. |
| `port-detail-aft.jpg` | 1904×1040 | image-to-image | Stern third of `port.jpg`, crop x 40–860, y 40–490. Reference only. Not loaded. |
| `port-detail-mid.jpg` | 1920×1024 | image-to-image | Mid third, crop x 780–1620, y 40–490. Reference only. Not loaded. |
| `port-detail-bow.jpg` | 1952×1008 | image-to-image | Bow third, crop x 1500–2360, y 40–490. Reference only. Not loaded. |

Shared contract. Write `images/<name>.PROMPT.txt` as the STATUS header, then the ROLE block, then `JOB` and the
job line, then the colour-free `ASK` template below. Nothing else. No palette words, no hex, no verbatim prompt text:
the tone / accent wording goes in the untracked local prompts file (section 0).

ROLE block. One of these first lines, then PIXELS and ASPECT from the table above:

- Loaded elevation or plan skin (`port`, `stbd`, `top`, `belly`, `stern`): `ROLE unlit skin. Loaded by frigate.ts as /biome/frigate/<name>.jpg.`
- Measure ruler (`measure/top`, `measure/belly`, `measure/stern`, `measure/port`, `measure/stbd`): `ROLE measure only. NOT a hull skin. Loaded by frigate.ts as /biome/frigate/measure/<name>.jpg.`
- Loaded section (`sec-*.jpg`): `ROLE section measure only (not a skin). Loaded by frigate.ts as /biome/frigate/<name>.jpg.`
- Loaded part (`nacelle`, `nacelle-front`, `turret`, `turret-front`, `bridge`, `bridge-front`, `pylon`, `hangar`, `bell`, `bell-front`): `ROLE part skin. Loaded by frigate.ts as /biome/frigate/<name>.jpg.`
- The three `port-detail-*.jpg`: `ROLE reference only. NOT loaded by frigate.ts. Do not skin the hull with this file.`

Then, for every file including the detail crops: `PIXELS <width>x<height>. ASPECT <aspect>.`
Then `JOB` and the job line from the table below. Detail crops have no `/biome/frigate/` load path.

```
STATUS
The verbatim Imagine tool-call string that produced this JPEG was not stored.
The file's EXIF is JFIF only (no prompt, no comment). No session log kept the call.
This JPEG is the locked ruler. Do not regenerate it and treat the new file as this plate.
Block ASK is the generation contract to copy if the plate must be replaced.
It matches this file's pixel size, aspect and job. It is not a recovered transcript.
```

ASK template, every plate (colour-free; fill `<TONE + ACCENTS>` from the local prompts file, never in the repo):

> Imagine, aspect `<aspect>`. Orthographic, no perspective, no camera tilt, no ground, no stars, no other ship, no text,
> no border, no watermark. Plain empty background the reader can segment. One object, filling the frame with a small
> empty margin. `<TONE + ACCENTS>`. Panels, seams, hatches and vents readable at phone size.
> Subject: the JOB line, nothing else.

The skins must stay readable mid-tones (METHOD.md row), so the section 4 luminance masks work.

Job line (one per file, after the paragraph):

| File | Job line |
|---|---|
| `port.jpg` | Port skin, bow right. Real hangar hole. No tower. No stern nozzles (those stay on `measure/port.jpg`). Shoulder step about one third from the stern. Nacelles detached, not touching the hull mask. |
| `stbd.jpg` | Starboard elevation, bow right, same length. Closed side, armoured belt, three hatches, no hole. Bridge tower on the deck, in the silhouette. |
| `measure/port.jpg` | Port ruler, bow right. The locked elevation box. Stern nozzles stay painted so length can be read. Not a skin. |
| `measure/stbd.jpg` | Starboard ruler, bow right. Stern nozzles stay painted. Not a skin. |
| `bell.jpg` | One bell cone, unwrapped, mouth band at the left edge, alone. Aspect 5:2. Not the stern plate. |
| `bell-front.jpg` | Mouth of one bell, one circle, corners empty. Aspect 1:1. Not the stern plate. |
| `top.jpg` | Plan skin, bow right. Top edge is starboard. Plain deck plating. Nacelles, deck turret and bridge island are not on this plate. Their place is `measure/top.jpg`. |
| `belly.jpg` | Belly skin, bow right, same side up as the top. Plain plating. The ventral turret is not on this plate. Its place is `measure/belly.jpg`. |
| `stern.jpg` | Stern cap skin, centred, plain plating. No bells. The four bells stay on `measure/stern.jpg`. |
| `measure/top.jpg` | Plan ruler. Two stern nacelles and the deck parts stay painted so position and size can be read. Not a skin. |
| `measure/belly.jpg` | Belly ruler. The ventral turret and the painted bells stay so position and size can be read. Not a skin. |
| `measure/stern.jpg` | Stern ruler. Exactly four bells. Each core passes the bell-core channel test. Not a skin. |
| `sec-stern.jpg` | Filled cross-section at 8% from the stern, looking forward. Left = port. One closed outline. Not a side view. |
| `sec-shoulder.jpg` | Same, at the shoulder step, about one third from the stern. |
| `sec-mid.jpg` | Same, at 56% (hangar station). Do not cut the hangar out of this slice. |
| `sec-bow.jpg` | Same, at 90%. The slice may be tall. Keep all of it in frame. |
| `nacelle.jpg` | One nacelle, side, nose right, alone. Aspect 5:2. |
| `nacelle-front.jpg` | Front of one nacelle, centred, metal not touching the corners. Aspect 1:1. |
| `turret.jpg` | One twin-barrel turret, side, alone. Aspect 16:9. |
| `turret-front.jpg` | Front of that turret, two barrels, corners empty. Aspect 1:1. |
| `bridge.jpg` | Bridge tower alone, side, portrait 2:3, a few lit windows. |
| `bridge-front.jpg` | Front of that tower, portrait 2:3, corners empty. |
| `pylon.jpg` | One narrow strut, portrait 2:3, alone. Not a hull plate. |
| `hangar.jpg` | Interior wall plate. Crops of it skin the bay walls. The port mouth stays open. |
| `backdrop.jpg` | One continuous backdrop. Cover at magnification ≤ 1. A wider frame must not smear an edge pixel. Not a cube and not a typed clear. |
| `port-detail-aft.jpg` | Image-to-image of port crop x 40–860, y 40–490. Sharpen in place. Do not move the silhouette or fill a hole. |
| `port-detail-mid.jpg` | Image-to-image of port crop x 780–1620, y 40–490. Keep the hangar hole. |
| `port-detail-bow.jpg` | Image-to-image of port crop x 1500–2360, y 40–490. Do not add a hangar. |

## 4. Check a plate before you use it

Do this on the pixels before changing a threshold. Luminance is `0.2126 R + 0.7152 G + 0.0722 B`.

1. Plates (elevations, plans, parts, stern): mask where luminance **> 16**. Sections: **> 18**.
2. Connected components, 4-neighbour. Keep a component only if you know its **start pixel** `(sx, sy)` —
   the pixel where the flood discovered it. Also store the centroid, but do not flood from the centroid.
3. The hull is the component with the **most pixels**, not the component whose box starts at the corner.
   Flood the keep-mask from that component's own `(sx, sy)`.
   The code does not compare the top two sizes. You stop, as a person, only when you cannot point at one
   component and call it the hull. Do not add a ratio the code does not have.
4. The hull content box should sit inside a dark margin, not cropped by the frame.
   On these locked plates that margin is about 75 px (`x0` near 75, `x1` past 2200 on a 2400-wide plate).
   The Howl gate in section 12 checks that box. A new ship records its own box in its own gate. Do not copy 75.
   A flat uniform fill can have a luma standard deviation of only 3–6. Low variation is not "empty"
   if the mask is one component with a real contour. There is no std-dev threshold in the code.
5. **The centroid may lie in a hole.** The hangar centroid is empty. An empty centroid is not an empty hull.
   Never seed a flood from the centroid, and never seed from the first mask pixel inside the bounding box
   (a nacelle can sit in that corner and steal the hull).
6. Column scan, top to bottom. A run that breaks for **more than 36 px** is an interior gap.
   The hangar is the **longest contiguous run of columns** whose largest gap is **≥ 70 px**.
   A stern notch of about 52 px must not win, or `holeU0` becomes 0 and the aft hull is deleted.
7. Sections: flood background in from the image border. Dark pixels you cannot reach are interior; fill them.
   A painted window in a section must not punch the volume. The hangar is **not** read from a section.
8. Bells, on `stern.jpg` only: `B > 80` and `B > R + 18` and `B > G`, blobs of at least 80 px.
   Sort by pixel count, descending, and take the first 4. If you do not get 4, the stern plate is not measurable.
   Do not invent the missing bells in code. The code has no "close in size" ratio: it always keeps the
   single largest component as the hull (`min` size 8 px to be listed). A human stops only when they cannot
   point at one component and call it the hull. Do not invent a second threshold for that.
9. `frigate.ts` `blobs()` queues at most **800000** pixels. The port hull is about 402000, so it fits.
   A full-frame 2400×528 mask is about 1.27 million and **will be truncated**. If the reported count is
   far below the visible hull, raise the cap. Do not "fix" it by changing the seed.
   `rebuild.py` has no cap (it uses lists). The TypeScript cap is the one that can silently clip.

Only after 1–8 pass do you trust the plate. The locked Howl set already passes; the gate in section 12
re-checks the numbers that moved when a seed was wrong. Section 11 is the open-issue list, not the gate.

## 5. How the contours are read

**Elevation (port drives deck and keel).** For each of the 84 stations, `u = i / 83`, sample the column at
`x = box.x0 + u * (box.x1 − box.x0)` on the port keep-mask.
A column's `topY` is the smallest masked y and `botY` the largest, even when a gap sits between them
(the hole is recorded separately; it does not split the column). Empty columns copy the previous station.
`yRef` is the mean of `(topY + botY) / 2` over columns that have any mask. Then

- `hullTop = (yRef − topY) * portScale`
- `hullBot = (yRef − botY) * portScale`
- `portScale = LEN / (box.x1 − box.x0)`

Starboard is read the same way into `stbdTop`. `align` is the median of `(stbdTop[i] − hullTop[i])`.
The bridge bump is `stbdTop − align − hullTop`. Do not add `align` onto `hullTop`.
Starboard does not replace the port deck or keel.

**Plan (top drives the two beams).** Centreline `centerPx` is the median column midpoint of `top.jpg`
for `u` in `[0.72, 0.94]` (the bow, where the nacelles are not). Then

- `beamStbd = max(0.8, (centerPx − topY) * topScale)` — top of the picture, starboard
- `beamPort = max(0.8, (botY − centerPx) * topScale)` — bottom of the picture, port

**Hole.** On the port columns, track the longest run with a gap ≥ 70 px.
`sTop = (botY − gapTop) / (botY − topY)`, `sBot = (botY − gapBot) / (botY − topY)`,
and the run keeps the min `sBot` and the max `sTop`. That is the window in section `sy`.

**Section rays.** Mask at 18, fill enclosed holes, content box.
Start at the box centre. If that pixel is empty, walk outward: radius 1, 2, … 119, and at each radius 12 angles
`k / 12 * τ` for `k = 0..11`. The first masked pixel becomes the ray origin `(cx, cy)`.
`halfW = max(8, max(box.x1 − cx, cx − box.x0))` using that origin, not the box centre if it moved.
`H = max(8, box.y1 − box.y0)`.
Cast 64 rays. Sample `j` has angle `a = j / 64 * τ`. Image `+x` (toward the right, starboard) is `sin(a)`.
Image `+y` (down the picture, toward the keel) is `cos(a)`. So `a = 0` walks down. Step 0.8 px.
Stop at the first miss or at `limit = hypot(box.x1 − box.x0, box.y1 − box.y0) + 8`.
Do **not** stop at `halfW * 1.8` — that clips a tall bow.
Store `sx = (hitX − cx) / halfW`, `sy = (box.y1 − hitY) / H`. `sy` 0 is the keel side of the picture, 1 is the deck side.
`sx > 0` is image-right, starboard, world `z < 0`.

**Between stations.** Stations are `[0.08, 0.34, 0.56, 0.90]`. Walk `ia` while `ia < 2` and `u > station[ia+1]`.
`k = clamp((u − station[ia]) / (station[ia+1] − station[ia]), 0, 1)`. Lerp `sx` and `sy`.
`u` below 0.08 stays on `sec-stern` (`k` clamps to 0). `u` above 0.90 stays on `sec-bow` (`k` clamps to 1).
Do not extrapolate.

**Shoulder.** After the four curves exist, `smoothKeep` runs on `hullTop`, `hullBot`, `beamPort`, `beamStbd`.
Endpoints stay. For a middle sample, `jump = max(|a[i]−a[i−1]|, |a[i+1]−a[i]|)`. If `jump > 1.6`, leave `a[i]`.
Otherwise `a[i] = 0.5*a[i] + 0.25*a[i−1] + 0.25*a[i+1]`. The shoulder step survives. Do not box-blur the whole curve.

## 6. Volume

For station `i`, sample `j`:

```
x = (u − 0.5) * LEN
y = keel + sy * (deck − keel)
z = −sx * beam          beam = beamPort if sx < 0 else beamStbd
```

Full ring. Port and starboard are different beams. Do not mirror a half-hull.

Quad `i,j` → `i+1,j` → `i+1,j+1` → `i,j+1` (`j` wraps). Name those corners A, B, C, D.
`n = normalize(cross(B−A, D−A))`. `cy` is the mean of the four y values, `cz` the mean of the four z.
`midY = (hullTop[i] + hullBot[i]) / 2`. `outward = n.y * (cy − midY) + n.z * cz`. If `outward < 0`, flip `n`.
Drop the quad when it is the hangar window: flipped `n.z > 0.2`, `cz > 0`, `u` inside `[holeU0, holeU1]`,
mean `sy` inside `[holeS0, holeS1]`, and the hole run is longer than 4 stations.

Skin bucket, after the flip: `n.y > 0.62` roof, `n.y < −0.48` belly, else port if `cz ≥ 0` else starboard.

Caps: station 0 is the stern, station 83 is the bow. Fan from the loop centroid.
Bow triangle order is `(centre, k, k+1)`. Stern order is `(centre, k+1, k)` so the fan faces `−X`.
Bow cap UVs come from the side plates (port image where `z ≥ 0`, starboard image where `z < 0`).
Stern cap UVs come from `stern.jpg` via the stern UV in section 8.

`rebuild.py` writes the same rings as an OBJ and omits the hangar quads the same way (it tests `z > 0`,
not the outward-normal test). Faces in the OBJ are quads. The TypeScript mesh splits each kept quad into two
triangles and also adds caps, so the OBJ face count is not the draw-call count.

## 7. Parts

Parts are prisms. `addPrism(side, front, length)` uses `N = 28` samples, `u = i / 27`.
The side silhouette is the first and last pixel in that column with luminance > 16.
Scale so the side content-box width equals `length`.
`sideH` is the world height of that silhouette (`max top − min bottom`).
The front content box is the mask > 16 on the front image, not the full frame.
`thick = max(0.35, ((frontBox.x1 − frontBox.x0) / max(8, frontBox.y1 − frontBox.y0)) * sideH)`.
Caps sample that front content box, not UV 0–1, so empty corners are not stretched across the cap.
The two big side faces sample the side image from the silhouette top to the silhouette bottom.
The thin top and bottom faces do **not** repeat one row across the thickness. `rho` is content width over the prism length (world units per source pixel, inverted: pixels per unit). `band` is `clamp(round(max(thick, 0.2) * rho), 2, content height − 2)` so the band is about as many texels as the thickness is world units. Caps use an isotropic crop of the front content box (`du`/`dv` from `thick * rho` and face height `rho`), not the full box stretched to the cap.
`low` is the smallest silhouette y in the prism's local frame, before `rotation.x`.

Placement is in the hull frame. `placePrism` sets `position` and then `rotation.x`.

| Part | Where the numbers come from | Where it is put |
|---|---|---|
| Nacelles | `measure/top.jpg` components after the hull, min **800** px. Not the port plate. The port plate puts them amidships; that reading is wrong. The plan has no height, so Y is the hull's vertical centre at that station, not a side-pod reading. | `u = (cx − measureTopBox.x0) / width`. `i = round(u * 83)`. `length = max(6, pixelWidth * measureScale)`. `x = (u−0.5)*LEN`. `y = (hullTop[i] + hullBot[i]) / 2`. `z = (cy − measureCenter) * measureScale` (positive z = port). `rotation.x = 0`. The roof skin does not paint them. |
| Pylon | One prism of `pylon.jpg`. Both maps are `pylon.jpg`. Uniform scale. The plate's aspect is kept (`height / width`, about 6). The prism is never wider than that plate. | `outward = sign(z)`, or `+1` if `z` is 0. `hullZ = beamPort[i]` if `outward > 0`, else `−beamStbd[i]`. `span = |z − hullZ| + 0.35`. Length of the prism is `span / aspect`, so the local long axis equals `span`. `rotation.x = +π/2` when the gap is toward port, else `−π/2`. Position z is the gap midpoint, shifted by the local midpoint so the strut sits in the gap. No `scale.set` fattening. |
| Dorsal turret | Port components min **400** px, not the hull, whose centre is **above the local deck**: `cy < column.topY + 4`. The biggest such blob. Do not test `cy < hullBox.y0 + 8` — the turret centre can sit below the hull box top (it did: cy 89, box y0 75) and still be above the local deck. | `u` from the blob centre on the **port** box, `i = round(u * 83)`. `length` from pixel width × `portScale`. `x = (u−0.5)*LEN`. `y = hullTop[i] − prism.low`. `z = 0`. `rotation.x = 0`. The roof skin no longer paints a second turret. The 3D turret stays. |
| Ventral turret | `measure/belly.jpg` components after the hull, min 800 px. Dark fraction = share of samples (step 2 px) with luminance < 18. Take the darkest only if it beats the lightest extra blob by **more than 0.08**. If it does not, add **no** ventral turret. | `u` from the measure belly box, `i = round(u * 83)`. `rotation.x = π`. `z = (cy − bellyBoxMid) * bellyScale`. Positive z is still port. After the half-turn, local `y` flips, so the highest world point of the prism is `position.y − low`. Set `position.y = surfaceY + low` (no sink). `surfaceY` is the underside ring sample at station `i` (`sy ≤ 0.5`) closest in `z`. The belly skin does not paint it. |
| Bridge | Longest run of stations where `stbdTop − align − hullTop > 3.2`. `bridgeU` = centre of that run. `bridgeH` = peak of that bump. | `x = (bridgeU − 0.5) * LEN`. `bi = round(bridgeU * 83)`. `rotation.x = 0`. `z` from pixels on `measure/top.jpg` with luminance **> 200**, stepped by 2, inside `u ∈ [bridgeU−0.1, bridgeU+0.16]`. If more than 8 such samples, `z = (meanY − measureCenter) * measureScale`. Else `z = −max(1.5, beamStbd[bi]*0.28)`. Build the prism at length 1. `towerScale = max(4, bridgeH) / (high − low)`, one uniform scalar. `y = hullTop[bi] − low * towerScale`. The roof skin does not paint the island. |
| Bells | The 4 largest blobs on `measure/stern.jpg` that pass the bell-core channel test (section 4). | Station 0, after a one-column speck at the cleaned stern tip is replaced by the next station's deck and keel (the speck is not a section). Uniform scale `min(faceW / plateW, faceH / plateH)` of the measure-stern content box onto that face, centred. `y = faceY − (cy − plateMidY) * scale`, `z = faceZ − (cx − plateMidX) * scale` (image left = port = +Z, larger image y = lower world y). `r = blue half-width * scale * 1.65` so the gold ring is included and the four stay gapped. `len` is how far `measure/port.jpg` sticks past the cleaned port skin: `clamp((skinPort.x0 − measurePort.x0) * portMeasureScale, 2.2, 8)`, about 2.8. Not the stern taper. 24 segments. Cone skin is `bell.jpg` (`u` along the cone, 0 at the mouth). Mouth disc is `bell-front.jpg` inside its painted circle. Do not skin the cones with `measure/stern.jpg`. |
| Hangar bay | The four port-side ring samples closest in `sy` to the hole corners: `(holeU0, holeS1)`, `(holeU1, holeS1)`, `(holeU0, holeS0)`, `(holeU1, holeS0)`. | `depth = max(8, beamPort[42] * 0.82)`. Inset is `(x, y, z − depth)`. The far corners are pulled 0.72 of the way toward the inset centre in x and y, so the opening is larger than the far bulkhead and the side walls read as depth. No quad on the port mouth. Wall crops of `hangar.jpg`: back `u 0.08–0.92, v 0.08–0.92`; floor `v 0.72–0.98`; ceiling `v 0.02–0.28`; aft wall `u 0.02–0.28`; fore wall `u 0.72–0.98`. Rim quads take the port UV of each outer corner, not one shared texel. Starboard skin stays closed. |

Numbers from the TypeScript after the seed fix. **Section 12 does not gate pylons or the bridge.**
It gates the port box, the top box, `topScale`, the hole `u` window, 4 bells, 2 nacelles, and the OBJ face count.
These decimals are the reading, not extra PASS rows: measure hull box `140,119–2337,401` (the raw content box still starts at `x0 = 75` on the five engine mouths), `topScale` `0.102`,
nacelles `x = −106.3`, `z = −17.51` and `+17.45`, length `23.96` (the gate only checks `length ≤ 40` and `|x| ≥ 70`).
Pylon keeps the plate aspect (about 6) and spans the gap. Hole `u` `0.289–0.482` (`n = 17`).
Bridge `u` about `0.42`, height about `13`. Four bells, read from `measure/stern.jpg`. The clean stern skin has none. The cones wear `bell.jpg`, not that plate.

## 8. Unlit skins

The hull JPEG is the skin. Where a part has real volume, a second JPEG in `images/measure/` is the ruler. The skin does not paint that part again. No code colour. No computed light.

- Material: `MeshBasicMaterial({ map, toneMapped: false, side: DoubleSide })`. Default material colour (no tint). Nothing else.
- Texture (law 65): `SRGBColorSpace`, `minFilter = LinearMipmapLinearFilter`, `magFilter = LinearFilter`,
  `generateMipmaps = true`, `ClampToEdgeWrapping` on S and T. Never `NearestFilter`.
- Renderer around it (the turntable, not the flight): `NoToneMapping`, output `SRGBColorSpace`. No typed clear colour. The backdrop is one camera-child plane of `backdrop.jpg` (1280×1728), not `scene.background`. When cover-fit stays at magnification ≤ 1 the plane crops the plate (`repeat` below 1). When a frame is wider than the plate, the plate stays at magnification 1 in the centre and the margins are interior 64 px tiles, not a stretched edge. Not a cube. Not the flight sky.
  pixel ratio `min(devicePixelRatio, 1.5)` when `matchMedia("(max-width: 800px)")` matches, else `min(devicePixelRatio, 2)`, fov 46.

Side UV, per station, not one box for the whole ship: `sy = 1` maps to that station's deck pixel, `sy = 0` to its keel pixel.
`deckRef` is `stbdImgTop` sorted ascending, index `floor(0.6 * 84)`. `stbdImgTop` is the image row of the deck, not world Y.
Any station with `deckRef − stbdImgTop > 28` is marked empty and filled by linear interpolation from the nearest
real neighbours, so the tower image is not smeared down the hull. The tower mesh carries `bridge.jpg` instead.

Plan UV: `x = box.x0 + u * (box.x1 − box.x0)`, `y = center + z / scale`, then `pixUV = (x / width, 1 − y / height)`.
For the roof, `center` is `centerPx` and `scale` is `topScale`.
For the belly, `center` is `(bellyBox.y0 + bellyBox.y1) / 2` and `scale = LEN / (bellyBox.x1 − bellyBox.x0)`.
Bug 2's word `mid` means that centre: `centerPx` on the roof, the belly-box centre on the belly. Do not flip the belly UV.

Stern UV on the cap uses the clean `stern.jpg` box. Bell cones do **not** sample that plate or `measure/stern.jpg`.
`H = max(0.001, hullTop[0] − hullBot[0])`, `t = clamp((y − hullBot[0]) / H, 0, 1)`,
`py = sternBox.y1 − t * (sternBox.y1 − sternBox.y0)`.
`half = max(1, (sternBox.x1 − sternBox.x0) * 0.5)`, `mid = (sternBox.x0 + sternBox.x1) * 0.5`,
`reach = max(beamPort[0], beamStbd[0], 0.001)`, `px = mid − (z / reach) * half`.
Then the same `pixUV`. Do not use UV 0–1 on `stern.jpg` or the empty corners cover the cap.

Law 65 (the play-still rule, not one of the owner QC issues in section 11): stills use `LINEAR_MIPMAP_LINEAR` and
mipmaps, never `NEAREST`. The first test build used nearest; it was switched to law 65 sampling at merge review
(2026-10-03). Do not go back to nearest. Do not resample the plates. Magnification ≤ 1 is a separate rule (section 9).

## 9. Magnification and the phone

Texels per world unit on the port plate: `(portBox.x1 − portBox.x0) / LEN`. On the locked plate that is about
**10.1** (about 2269 px over 224 units). Magnification ≤ 1 means one source texel is not stretched across
more than one screen pixel. The default camera frames the **whole ship**, so the 224-unit length fits the
screen and the magnification stays under 1. Pinch and wheel set a `zoomed` flag and may go closer; that is
the user looking, not the default.

Turntable (`frigate-view.ts`), if you use it:

- Look-at `(0, 3, 0)`. The ship root is at the origin with yaw 0. The fit box below is centred on the origin, not on the look-at.
- `θ` is yaw around Y, `φ` is elevation. Camera position is
  `look + dist * (cos φ · cos θ, sin φ, cos φ · sin θ)`.
- Faces: port `θ = π/2`, `φ = 0.16`; starboard `θ = −π/2`, `φ = 0.16`; bow `θ = 0`, `φ = 0.12`;
  stern `θ = π`, `φ = 0.1`; top `θ = π/2`, `φ = 1.15`; belly `θ = π/2`, `φ = −1.05`.
- Wanted up is continuous. Project world +X onto the plane perpendicular to the view. `smoothstep` that perpendicular length from 0 to 1 and blend world +Y toward it. No aspect test and no threshold, so the roll does not snap. The live `camera.up` eases toward that vector (`1 − exp(−dt * 2.2)`) and is renormalised. Fit and the zoom floor use the eased up.
- Zoom floor is magnification 1 at the aim point: `viewH / (2 * tan(fov/2) * 10.1)`, which matches the horizontal texel limit. Pinch, wheel and `look` cannot go closer than that distance. A surface nearer than the aim point can still exceed magnification 1; the cap does not hold for the whole depth of the frame. `step(dt)` and `freeze()` advance one frame with the rAF stopped, so a clip can be exactly 25 fps.
- Fit, unless the user has zoomed. Half-extents `hx, hy, hz = 120, 34, 28` (a box on the origin).
  Forward `F = (−cos φ · cos θ, −sin φ, −cos φ · sin θ)`, right `R = F × up`.
  Over the 8 corners, `maxU` is the max `|dot(corner, up)|` and `maxR` the max `|dot(corner, right)|`.
  Vertical fov `v = 46°` in radians. Horizontal `h = 2 * atan(tan(v/2) * aspect)`.
  `dist = max(maxU / tan(v/2), maxR / tan(h/2)) * 1.16`.
  A bounding sphere plus `min(hfov, vfov)` pulls the camera so far back that the ship is a thin band. Do not put it back.
- Drag `0.0075` rad per px in θ, `0.006` in φ, φ clamped to `[-1.15, 1.25]`.
- Tour: add `2π` to θ at `0.45` rad/s. Each frame `φ += (0.32 − φ) * min(1, dt * 3)` with `dt` in seconds, capped at 0.05.
  Stop when the added angle reaches `2π`. No separate ease duration.
- Phone check: portrait frame shows the whole length, panels readable, no second ship, no Bolt, no starfield.
  A thin stripe on an empty frame is a failed frame, not a failed hull.

## 10. Bugs and the fix for each

1. **Hull mask seeded on an empty hangar pixel.** The flood started at the blob centroid. The centroid sits in
   the hangar hole, the keep-mask came back empty, the hull vanished. A half-applied edit also left `sx, sy`
   unset. **Fix:** when a component is discovered, store that start pixel on the blob. `largestMask` floods
   from `blob.sx, blob.sy` only. Never from the centroid.

2. **Plates read on the wrong side.** Small image y was treated as port. The bridge then sat on the port side.
   **Fix:** small y on `top.jpg` and `belly.jpg` is starboard. `beamStbd = (centerPx − topY) * scale`,
   `beamPort = (botY − centerPx) * scale`. Plan `y = mid + z / scale`. Belly is not mirrored.

3. **Top plate seeded on a nacelle, so the ship became a blade.** The flood started at the first mask pixel
   inside the hull box. That pixel was the stern nacelle overlapping the box (about `75,49–310,126`).
   `topScale` jumped to about `0.95`. Nacelles became length 224, one of them near `z ≈ 326`.
   **Fix:** pick the component with the most pixels, flood from its own start pixel, never from a box corner.
   After the fix the raw content box is about `75,119–2337,401`. The locked hull, past the five engine mouths, is `140,119–2337,401` and `topScale` about `0.102`.
   The gate fails if `topBox.y0` is not above 100, which is what the nacelle seed looks like.

4. **Pylons read as giant slabs.** Same cause as 3. The gap from a nacelle at `z ≈ 326` to the hull
   was huge, and `scale = span / long` became a slab. **Fix:** bug 3's seed. After it, span is about 4.8–5.0
   and scale about 0.8. A thin pylon can still be hard to see; that is open issue 3, not this bug.
   Do not delete the pylon code because the QC says "no visible pylons".

5. **Stern notch stole the hangar.** A gap of about 52 px at `u = 0` set `holeU0 = 0` and would delete the
   aft hull. **Fix:** only gaps ≥ 70 px count, and only the longest contiguous run wins. Gaps shorter than
   36 px are not recorded at all.

6. **Bow section clipped.** Rays stopped at `halfW * 1.8`, so a tall bow lost its top and bottom.
   **Fix:** `limit = hypot(box) + 8`.

7. **Tower smeared down the starboard skin.** The starboard content box includes the bridge, so one UV
   span mapped the tower image onto the whole side. **Fix:** per-station deck/keel pixels, and stations
   where `deckRef − topY > 28` are interpolated from their neighbours (section 8).

8. **Dorsal turret rejected.** The test `cy < hull.y0 + 8` failed (centre 89, box top 75) even though the
   turret sits above the local deck. **Fix:** `cy < localColumn.topY + 4`.

9. **Nacelles placed amidships.** Blobs "below" the hull on the port elevation are the painted nacelles
   along the side, not the stern pods. **Fix:** take nacelle XZ from `measure/top.jpg` only.

10. **Portrait frame was a thin band.** The camera fit a bounding sphere with `min(horizontal fov, vertical fov)`,
    so on a 390×844 phone the distance went to about 729 and the ship was a stripe.
    **Fix:** section 9 (length-up, AABB `(120, 34, 28) * 1.16`). This is in `frigate-view.ts` only.

## 11. QC issues

Fixed in PR #161 and validated by SmiR on the phone, 2026-10-03 21:36:

1. **No second copy of a part on the plates that were actually cleaned.** Engine bells, nacelles, the deck turret and the ventral gun are measured on `images/measure/` and built once. `stern.jpg` and `belly.jpg` are plain plating. The port skin no longer paints the four stern nozzles. Not a code rectangle.
2. **Pylon aspect.** The strut keeps the plate's aspect (about 6). It is not widened to 2.05–3.4. Magnification on the pylon stays ≤ 1.
3. **Ventral seat.** The turret tip sits on the underside sample. The old 0.45 sink is gone.
4. **Bells.** Four cones, one 2×2, gaps kept, on the stern bulkhead rather than a one-pixel tip. Cone skin is `bell.jpg`. Mouth is `bell-front.jpg`. They are not sampled from the painted stern plate.
5. **Plan lock.** The raw measure-plan content box starts at `x0 = 75`, the tips of the five painted engine mouths. The locked hull is the first solid column run past those mouths: `140, 119, 2337, 401`, `topScale` `0.102`. Beams use that hull. Erasing the mouths does not move this lock.
6. **Backdrop.** One Imagine plate, 1280×1728. Not a 9:16 strip. Portrait 720×1600 cover is about 0.93. A wider frame does not smear the edge texel.
7. **Camera.** `camera.up` eases continuously. There is no binary length-up flip. Distance uses the eased up. The proof clip is 25 fps from `step(1/25)`.
8. **Deck skin.** An Imagine edit removed the painted dorsal turret and the dotted island footprint. Only interior pixels were pasted. The skin's largest box stayed `75, 119, 2337, 401`.

Earlier mesh fixes still stand: open port bay with `hangar.jpg` walls. Proof clip for this pass: `tools/hard-objects/qc/howl-single.mp4` (stern, deck, nacelles and pylons, belly, bay, 25 fps, eased). `howl-fixes.mp4` is an older pass.

Accepted known issues (SmiR 2026-10-03: declared and accepted; do not spend Imagine quota on them; a fix is welcome, not required):

- **Bolt.** Owner QC showed Bolt as a carved blob instead of the Imagine video `lock/bolt-gallop-cycle.mp4` / `lock/bolt-idle-breath.mp4`. This folder does not draw Bolt. Do not carve, hull, or recook Bolt.
- **Starboard nozzles.** `stbd.jpg` still paints the four stern nozzles and the lower pods beside the 3D bells. Three full Imagine redraws and one local clone failed (they redrew the ship or left a speckled flare). Stopped. Do not start another full-frame redraw.
- **Streaks.** The bridge tower roof still repeats the side-plate lip across its thickness. Not signed off.
- **Black faces.** Bridge side wedge, nacelle inner face, stern edge strips, deck block and the bay's aft edge were not signed off from a still.
- **Plan stern mouths.** `top.jpg` still paints five engine circles (not four). The locked hull starts at the solid stern edge (`x0 = 140`), so the mouths are no longer the lock. An inpaint cleared the tips but left the arcs cut in half, so that paste was not kept. The 3D bells are the volume. The footprint stays.

## 12. Run the gate

From the repo root (the directory that contains `tools/` and `docs/`):

```
python3 -m pip install 'pillow>=10'
python3 tools/hard-objects/rebuild.py
```

This gate passed on Pillow 12.3.0. Pillow missing → exit **2**.
The script requires these 28 JPEGs and a sibling `.PROMPT.txt` for each (same basename). Missing either → exit **1**:

`port.jpg`, `stbd.jpg`, `top.jpg`, `belly.jpg`, `stern.jpg`, `sec-stern.jpg`, `sec-shoulder.jpg`, `sec-mid.jpg`,
`sec-bow.jpg`, `nacelle.jpg`, `nacelle-front.jpg`, `turret.jpg`, `turret-front.jpg`, `bridge.jpg`, `bridge-front.jpg`,
`pylon.jpg`, `hangar.jpg`, `backdrop.jpg`, `port-detail-aft.jpg`, `port-detail-mid.jpg`, `port-detail-bow.jpg`,
`measure/top.jpg`, `measure/belly.jpg`, `measure/stern.jpg`, `measure/port.jpg`, `measure/stbd.jpg`,
`bell.jpg`, `bell-front.jpg`.

A locked number moved → exit **1** and the word `FAIL`. Success → exit **0**, the last line is `PASS`, and these files appear:

- `tools/hard-objects/out/report.json` with keys `images`, `portBox` (the **measure** port box), `skinPortBox`, `topBox` (the **measure hull**, past the engine mouths), `skinTopBox`, `topScale`,
  `texelsPerUnit`, `hole` (u0, u1, s0, s1, n), `bells`, `skinBells`, `skinNacelles`, `portNozzles`, `nacelles` (each `u`, `x`, `z`, `length`), `verts`, `faces`, `length`.
  No pylon key. No bridge key. Those are section 7 readings, not this file.
- `tools/hard-objects/out/frigate.obj` (hull quads, hangar window omitted). `length` in the JSON is the constant `LEN` (224).

`topScale = LEN / hullWidth`, where the hull width starts at the first solid column of the measure plan, not at the engine mouths. A wrong `LEN` fails the `topScale` row by itself. Do not add a second LEN check. Beams in the OBJ and in `frigate.ts` are lofted from that hull box. The locked port box is `measure/port.jpg`, not the skin. `skinPortBox` and `skinTopBox` are reported and not range-checked. `skinTopBox` still starts at the five mouths.

PASS means all of the following. If one fails, the measure is wrong; do not loosen the test to go green.

| Check | Range |
|---|---|
| Port content box | measure port: `x0` in 70..90, `x1` > 2200, height > 200 |
| Top content box | measure hull, not the engine mouths: `x0` in 130..160, `y0` > 100, `x1` > 2200 |
| `topScale` | (0.09, 0.11), from the measure plan |
| Hole | `n ≥ 10`, `u0` in (0.25, 0.36), `u1` in (0.44, 0.55) |
| Bells | exactly 4, on `measure/stern.jpg` |
| Skin bells | exactly 0 on `stern.jpg` |
| Skin nacelles | exactly 0 detached components on `top.jpg` |
| Port nozzles | exactly 0 blue cores on the port **skin** |
| Nacelles | exactly 2, from the measure plan, each `length ≤ 40` and `|x| ≥ 70` |
| OBJ faces | ≥ 4000 |

`y0` near 49 on the top box means the nacelle stole the seed again (bug 3). Stop.

What PASS does **not** mean: skins, pylons, turrets, the bridge, the hangar interior, magnification, or a phone shot.
Those live in `frigate.ts` and `frigate-view.ts`. Read sections 7–9. Do not expect `rebuild.py` to draw them.

## 13. How to make a new ship

1. Copy the folder to `tools/hard-objects/<ship>/` (new images, new `frigate.ts`, new `rebuild.py`).
   Do not reuse the Howl JPEGs for a different hull. Do not edit the Howl gate to make the new ship pass.
2. Ask Imagine with the section 3 contract (STATUS, ROLE, job line, colour-free ASK template) plus your own tone
   lines kept in an untracked `*.local.md`. Write the colour-free text to `<name>.PROMPT.txt` beside the JPEG
   **before** you run the gate (missing prompt → exit 1). Never put palette words, hex or verbatim prompts in it. The JPEG you keep is the ruler, not a fresh regeneration.
3. Run section 4 on every plate. If a plate fails, replace that plate. Do not paper over it with a threshold.
4. Change `LEN` only if this ship is a different length, and change it in **both** the TypeScript and the Python.
   Change the four stations only if the section pictures were taken at different `u`.
   Keep the frame in section 2 unless the new pictures were drawn in a different orientation, and then
   write the new orientation in the copy of this page. Do not silently swap port and starboard.
5. Point the new `frigate.ts` loaders at `/biome/frigate-<ship>/<name>.jpg` in that other workspace's `public/` tree.
   Leave the Howl loaders on `/biome/frigate/<name>.jpg`. There is still no `public/` directory in this repo.
6. Replace the PASS ranges in the **new** `rebuild.py` with the boxes you measured in step 3.
   Keep the same failure rules: empty centroid must not be the seed, box-corner must not be the seed,
   hangar gap ≥ 70 and longest run, four bells or the stern plate is rejected, nacelles from the plan.
7. Run `python3 tools/hard-objects/<ship>/rebuild.py`. Expected: exit 0, `PASS`, `out/report.json`, `out/frigate.obj`
   with on the order of `NU * NS` vertices (84×64 = 5376) and a face count below that because of the hole.
8. Skins: same files, unlit, section 8. Phone: section 9, whole ship in frame, magnification ≤ 1 at that frame.
9. Do not touch the capital, the corvette, the flight, or the flight sky. Do not mark the method APPROVED.
   Phone QC is still required. Copy any new open issue into section 11 rather than hiding it.

## 14. Order a fresh reader follows

1. Read section 0 and do not open the flight.
2. Confirm the JPEGs and `.PROMPT.txt` files in section 1 and section 12 exist. Do not regenerate them.
3. Read the frame in section 2 once. Do not flip y.
4. Run section 12. If it is not `PASS`, stop and re-read section 10 bugs 1 and 3. Do not edit the ranges.
5. Only if you need the skinned mesh: copy images and the two `.ts` files into the app that already has `three`,
   serve the JPEGs at `/biome/frigate/`, call `mountFrigate` or `mountFrigateView`. Do not add `three` to this repo.
6. Section 11 lists what this pass fixed and what is still open. Do not mark the recipe APPROVED.

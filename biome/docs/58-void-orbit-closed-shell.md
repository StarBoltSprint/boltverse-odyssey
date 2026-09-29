# 58 — Void Orbit closed shell (the method that shipped)

**Not a hang law.** This page is the method that replaced the depth-sheet in [57](57-void-orbit-ship-relief.md). It does **not** replace [44](44-imagine-volume-stack.md). Kitchen only. Do not read this to the player.

Playable source: [`../void-orbit/void-biome.ts`](../void-orbit/void-biome.ts). Plates: [`../void-orbit/stills/`](../void-orbit/stills/).

No Blender. No Maya. No `.obj`. Language is **TypeScript**. The picture is drawn by **Three.js** on WebGL. Imagine only paints the plates. The mesh is scaffolding so those pixels have a volume.

---

## The rule

One photograph stretched over the whole ship goes soft up close, and it lies as soon as you leave its normal. A procedural color (a black tube, a gold ring painted in a shader) is not the ship.

What holds:

1. Imagine paints a locked orthographic view of **this** ship, on black, ship frozen in the frame.
2. The code reads the pixels. Whatever is not the black field is the silhouette.
3. That silhouette becomes a closed mesh. Each face receives **its own** plate. Nothing is pulled across a face it was not painted for.
4. Collision is the same volume, not a box around the bounding rectangle.

If a part is painted flat and must be a volume (a gun, a hangar mouth), do not invent a new shape. Cut the painted shape out of the plate, give that crop its own views, build the volume from those silhouettes, and cover it with Imagine pixels of the same ship.

---

## The hull

Four matched stills. Nose to the right on the side, top, and belly.

| File | Face |
|---|---|
| `stills/ship-flank.jpg` | Both sides. Also the source of the silhouette. |
| `stills/ship-top.jpg` | Deck. Also the planform (how wide the ship is at each station). |
| `stills/ship-belly.jpg` | Underside. |
| `stills/ship-stern.jpg` | The aft cap, engines. A fifth still, `ship-flank`, closes the bow by the side image seen edge-on. |

World size in the prototype: length **520**, height **102**, beam **120**. Grid `NX = 160` along the length, `NY = 28` up the side, `NZ = 36` across the deck.

Per column `i`:

- Side image: walk the column, luminance above the field. Topmost hit and bottommost hit are `s0` and `s1`. Those become `hullTop` and `hullBot`.
- Top image: the bright span across the beam becomes `hullHalf`. Dark panels inside the span stay inside. The outside is only what the flood from the border can reach.
- A vertex is `(x, y, z)` with `x` along the length, `y` between bot and top, `z = ±hullHalf` plus a small luma bump so panels are not perfectly flat.
- Quads that fall inside the hangar opening are **not** emitted. That is the hole. It is not a transparent texture.

The stern and the bow are caps: a grid in YZ at the first and last column, textured by `ship-stern.jpg` (aft) and by a slice of the flank (bow). The shell is closed. You cannot fly through a dark panel.

UVs are the plate's own pixels. A side vertex at image `(ix, iy)` samples `ship-flank` at that pixel. The photo is not scaled to a unit square and then stretched; the mesh already has the photo's proportions.

Shader is WebGL1 on purpose. Sample the texture. No `clamp(vec2, float, float)`. No luma `discard` on the hull (that ate the dark armor; see 57). No lighting multiply. `DoubleSide` is off; each face is wound toward its outside.

---

## Why one plate is not enough up close

`ship-flank.jpg` is about 1800 pixels wide and covers all 520 units. A hangar wall plate is the same width and covers only the back wall of the bay. Up close the wall looks sharp and the hull looks soft. Same renderer. The hull was a long shot.

Fix, without stretching and without inventing a new ship:

1. Cut the real plate into four length sections (aft, mid-aft, mid-forward, bow). Full height of that plate. Files `flank-0.jpg` … `flank-3.jpg` in the cook, then replaced by the close-ups.
2. Image-to-image each crop. The prompt says: this exact section, same silhouette, same gold, same cyan, black field, do not show the rest of the ship, render it as if the camera moved closer.
3. The new image is one section at full frame, so the texel density goes up about four times.
4. The side mesh is four strips. Strip `s` owns image columns `[s*W/4, (s+1)*W/4]`. Its UVs run 0–1 across **that** close-up's content box, not across the original long shot.
5. The same cut is done for the deck (`top-0` … `top-3`) and the belly (`belly-0` … `belly-3`).

The silhouette, the hole, and the collision stay on the **original** long plates. The close-ups are skin only. If a close-up is asked to invent a different ship, throw it out. The crop is the reference, not a style prompt.

Seams can show where two sections meet. That is the cost of not stretching. A section boundary is a real cut in the mesh, so the two textures do not have to share a UV space.

---

## The hangar

The painted bay on the flank is a picture of a hole. A picture of a hole is still a wall.

1. On `ship-flank.jpg` the opening is a known rectangle in pixels: `x 1085–1475`, `y 500–615` (nose to the right, image y down).
2. Per column, convert those image rows into `t` along the silhouette (`bayFloorT`, `bayCeilT`). The cut follows the painted opening, not a constant band of `t`.
3. Skip every side quad whose four corners are inside that opening. Both flanks.
4. Behind the hole, four plates close a room you can enter:

| File | Face |
|---|---|
| `stills/hangar-floor.jpg` | Deck you land on. |
| `stills/hangar-ceiling.jpg` | Ceiling. |
| `stills/hangar-back.jpg` | Far wall, with the small craft painted on it. |
| `stills/hangar-wall.jpg` | Both end walls. |

Those four were generated as interiors of **this** bay, edge to edge, no black margin, orthographic. They are not crops of the flank. The flank only says where the mouth is.

Depth of the room is `hullHalf` at the bay's middle column, minus a lip, clamped around 22–40 units. The floor and ceiling sit on `bayFloorT` / `bayCeilT`, so the room lines up with the cut.

Collision: inside the bay's x range, below the ceiling and above the floor, the outer hull does not push you out. A separate landing state sticks you to the bay floor. Outside the bay, the hull wall still stops you. There is no invisible ceiling over the whole ship.

What failed here, and is not the method: a black box, gold lips from a color shader, and little ships made of boxes. That is scenery invented in code. The small craft, if they are visible, are pixels of `hangar-back.jpg`.

---

## The cannons

The flank paints guns as flat barrels low on the hull. A cylinder with a gold-ring shader is a different object. It does not count.

1. Four locked views of **that** barrel, one cannon, black field, orthographic:

| File | View |
|---|---|
| `stills/cannon-side.jpg` | Profile. Length and height of the tube. |
| `stills/cannon-top.jpg` | From above. Width of the tube along its length. |
| `stills/cannon-bottom.jpg` | From below. Kept so the underside is not a guess. |
| `stills/cannon-muzzle.jpg` | The mouth, head-on. |

2. `spanAt` walks each column of the side plate and the top plate. That is the silhouette. `CN = 26` stations, length **68** world units. Side span becomes the tube's height. Top span becomes `halfW`.
3. The volume is a closed prism: two sides, a top, a bottom, a muzzle disc, a breech disc. Not a `CylinderGeometry` with a tint.
4. The skin is **not** the cannon plate stretched as a decal that fights the hull. The UVs sample a patch of the real hull armor (`ship-flank.jpg` around `x 500–1040`, `y 348–470`, and the deck plate for the top and bottom). The tube then reads as part of the ship. The cannon plates decide the **shape**. The ship plates decide the **color**.
5. Stations along the length: `-228, -148, -68, 18, 208`, both sides, low (`t ≈ 0.20` up from the belly). A station that crosses the hangar mouth is skipped. Each barrel is a collision block.

Image-to-image on a tight crop of the flank kept returning the whole ship. The views above were text-to-image, with the flank barrel described exactly (dark segmented barrel, gold rings, gold muzzle collar, black field, isolated). If a generated barrel does not match the painted one, do not mount it.

---

## Flight, Bolt, sky

- The ship is one `Group`. It does not drift inside its texture. A hull video is forbidden: the generator moves the ship in frame, then the loop yanks it back (57).
- Bolt is a video, child of the camera, seen from behind. Breath at rest, gallop when moving. `bolt-breath.mp4`, `bolt-gallop.mp4`.
- The void is six video faces around the camera: `sky-n/s/e/w/u/d.mp4`. They move with the player. They are not stuck to the ship.
- No HUD, no buttons, no text. Pointer drag and WASD / Q E / Space / C / Shift. Phone gestures only.
- Spawn is outside the hull, in front of the flank, so the first frame is the ship and not the inside of a wall.

---

## Order, if this is redone

1. One locked side still. Black field. Nose to the right. Ship does not move.
2. Matching top, belly, stern. Same ship, same light, orthographic.
3. Build the closed shell from those four. Confirm it on a phone before any gun or bay. WebGL1 shader only.
4. Mark the painted hangar in pixels. Cut quads there. Generate floor, ceiling, back, walls as interiors of that opening. Land inside.
5. Generate the four cannon views from the painted barrel. Build the prism from the side and top silhouettes. Skin it with hull pixels. Skip the bay.
6. When a face is soft up close, cut **that** plate into length sections and re-render each section from its own crop. Do not repaint the ship from scratch. Do not stretch the long shot.
7. Move the group. Do not play a video on the hull.

## FAIL

- Stacking copies of one plate to fake thickness.
- A shader that draws the gun or the bay from colors instead of plates.
- A luma key on dark armor.
- `clamp` of a vector, or any GLSL ES 3.00-only call, on the ship shader.
- One 1800px plate for the whole 520-unit hull, once the camera can land on it.
- A close-up that does not match the crop it came from.
- Spawning inside the beam.
- Treating this page as permission to extrude a lane plate. The lane stays law 44.

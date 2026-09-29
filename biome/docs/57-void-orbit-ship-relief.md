# 57 — Void Orbit ship relief (experiment log, 2026-09-29)

**Not a hang law.** This page records one free-flight prototype: Bolt in a black void, one warship, phone play. It does **not** replace [44](44-imagine-volume-stack.md), [49](49-two-plane-tree.md), or [50](50-heightfield-posture.md). Those still own the lane, the grove, and the ground film.

Kitchen only. Do not read this to the player.

Playable source of that prototype: [`../void-orbit/void-biome.ts`](../void-orbit/void-biome.ts). Depth baker: [`../void-orbit/bake-hull-depth.py`](../void-orbit/bake-hull-depth.py). Stills: [`../void-orbit/stills/`](../void-orbit/stills/).

---

## What was asked

A 360° black void. Bolt flies with free mobility. Graphics stay Imagine plates. Three.js is only the camera, the flight, and the wall you cannot cross. The ship must:

- read as a volume, not a sticker
- not show stars through the dark hull
- not be a fan of copies when you fly along it
- not snap backward because a video loop restarts
- stay catchable, and stop the body on contact
- actually appear on a phone

---

## What failed, and why

### 1. Stacked copies of the same plate

Seven planes of the same ship image, offset a few units in Z. From the front it looked thick. The moment the camera left the normal, each copy slid on screen. Stars showed in every gap. That is the cheap fan. Law 44 already says one clip is not a volume. This test confirmed it on a long hull.

### 2. A video as the skin

A cruise clip was played on the plate so the engines would burn. The generator does not hold the ship still. The hull drifts in the frame, then the loop jumps back to the first frame. The ship flies forward and is yanked home. Movement has to be the **group** in space, not pixels inside the picture.

### 3. Luma key on dark metal

Black space and dark armor were the same test (`max(rgb) < threshold`). The hull became a hole. Stars showed through the carapace. Filling only the bright pixels is not a silhouette.

### 4. A rectangle box

An AABB the size of the bounding box stops you, including in the empty corners, and lets you through the gaps that the picture says are open (between wings) if the box is tighter than the art. A box has no panel relief.

### 5. Distance transform on a brightness mask

Thresholding the photo, then a chamfer distance, left the dark panels as exterior. The center of the fuselage was a hole. Collision at `(0,0)` returned thickness 0 and the player flew through. The mask has to be the **enclosed** silhouette, not the bright pixels.

### 6. Triplanar shader with `clamp(vec2, float, float)`

Flank, top, and nose were blended by the normal. On WebGL2 (desktop, SwiftShader) `clamp(uv, 0.0, 1.0)` compiles, because GLSL ES 3.00 has `clamp(vec, float, float)`. On the phone's WebGL1 it does not. The program fails. Bolt and the sky still draw, because they use other shaders. The ship is invisible. The player records sixteen seconds of stars and says there is no ship.

### 7. Spawn inside the beam

`BEAM = 36` on a hull whose center sat at `z = -14` put the front face at `z = +22`. The player spawned at `z = 24`, inside or against the volume. The solver pushed them down the thickness gradient, under the hull. The camera then looked at stars. A ship you are already inside does not read as a ship.

---

## What held

### Still plates, not a ship video

Three Imagine stills, same design, black background, ship frozen:

| File | View |
|---|---|
| `stills/ship-flank.jpg` | side, nose to the right. This is the skin. |
| `stills/ship-top.jpg` | from above, nose to the right. Cooked, not on the final phone shader. |
| `stills/ship-nose.jpg` | from the front. Cooked, not on the final phone shader. |

`ship-flank.jpg` is the kept side frame (`ship-last`). Top and nose were image-to-image from that frame so the design matches. The flight is `shipRoot` translating on −Z at a capped speed. The picture does not move inside itself. Engines do not get a second video. A drifting video ruins the relief.

Bolt stays a video. He is parented to the camera, gallop mixed over breath by speed. He is not baked into the ship plate.

### Solid silhouette

`bake-hull-depth.py`:

1. Downsample the flank to 192×108. A cell is inside if any source pixel is above 8.
2. Dilate once.
3. Flood-fill **outside** from the image border through empty cells. Everything not reached is hull, including dark panels and the gaps between them.
4. Chamfer distance to the nearest outside pixel. Two passes, diagonal cost 1.414.
5. Divide by the 88th percentile of interior distances. Cap at 1. That is the form: fat in the fuselage, thin at a wing tip.
6. High-pass the luminance (image minus a gaussian blur), clamped to about ±0.1, added as panel relief.
7. Light blur. Write `ship-depth.png`: R = thickness 0–255, G = 255 inside the mask.

Center pixel of that PNG is solid. The old brightness mask was not.

### The grid

Not a box. A sheet of points, one per depth cell that is inside.

- `u = i / (W-1)`, `v = j / (H-1)`, with `j = 0` at the **bottom** of the image (the PNG is top-down, so the sample row is `H-1-j`).
- Position: `x = (u-0.5) * shipW`, `y = (v-0.5) * shipH`.
- Two vertices per cell: `z = +half` and `z = -half`, `half = (R/255) * BEAM`.
- A quad is emitted only when all four corners are inside. Front winding faces +Z. Back winding faces −Z.
- An edge with both ends inside and no full quad on either side is the rim. It is stitched front-to-back so the shell is closed.
- `computeVertexNormals()` after the index buffer.

`BEAM` is the max half-thickness in world units. Hung in the prototype at **12**, with `shipW = 300`, `shipH = 170`. Larger beams swallowed the spawn.

From the side you see the photo. From a quarter you see the nose and the wings actually in front of the tail, because those vertices are at different Z. There is one shell, not seven cards. A hole in the photo cannot show stars: the triangle is opaque. Near-black texels are `discard`ed only below `0.035`, which is the background, not the armor.

### Phone shader

The material that ships is intentionally dumb, so WebGL1 can link it:

```glsl
precision mediump float;
uniform sampler2D flank;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(flank, vUv).rgb;
  float m = max(c.r, max(c.g, c.b));
  if (m < 0.035) discard;
  gl_FragColor = vec4(c, 1.0);
}
```

No `clamp` on a vector. No triplanar. No lighting multiply that can crush the hull to black. Top and nose stay on disk for a later pass that samples them with `clamp(uv, vec2(0.0), vec2(1.0))` only.

A flat card of the same material is added **immediately**, at local `z = 1`, so the ship is on screen before the PNG is read. When the shell mesh is built, the card is hidden. If the depth image fails, the card remains. That is why a reload shows the ship even when the relief is still loading.

### Collision is the same grid

`hullThick[]` is the half-thickness in world units, same indexing as the mesh. Each step, the player position is converted to `(u, v)` and sampled bilinear.

If `|localZ| < thickness`:

- penetration on Z versus penetration toward the silhouette edge (step opposite the thickness gradient)
- the smaller one wins
- a Z hit sets `vel.z = -shipSpeed` so you stick to the moving hull instead of tunneling out the back
- an XY hit walks you out of the mask

Landing: per column, store the max Y that still has thickness. If the player is just above that ridge, `|z|` inside the beam, and they are not rising, they stand on `deckY + 1.3` and inherit `vel.z = -shipSpeed`. Rise (two fingers up, or Space) leaves.

This is a sculpted cookie of the side silhouette, extruded by the distance field. Wings are thinner than the body. It is not a CAD mesh. The other flank is the mirror. A top-view intersection (true wing thickness in Z independent of the side photo) was not shipped.

### Where it sits so you can see it

```
SHIP  = (0, 4, -52)
player start = (0, 12, 28)
```

Front of the beam is about `z = -40`. The player is in open space, looking −Z, at the painted flank. The ship holds still for 4 seconds, then cruises. If the player is more than 80 units behind, cruise drops so Bolt can catch it.

Portrait phones crop a 300-unit hull. The fuselage fills the center. That is intentional. A ship small enough to fit the width was missed entirely in earlier recordings.

### Controls

No on-screen buttons. Left drag is thrust. Right drag is look. WASD, Space, C, Shift still work on a keyboard. Bolt banks with yaw rate. The sky is six video faces parented to the player so the void stays around the camera.

---

## Order of work, if this is redone

1. One locked side still. Black field. Ship does not move in the frame.
2. Bake the enclosed mask and the distance PNG. Check the center pixel is solid.
3. Draw **one** card with the WebGL1 shader above. Confirm it on a phone before any mesh.
4. Build the shell from the PNG. Hide the card only after the mesh is in the scene.
5. Place the group far enough ahead that the spawn is outside `BEAM`.
6. Sample the same PNG for the wall and the deck.
7. Move the group. Do not play a video on the hull.

## FAIL for this prototype

- Copying the plate in Z to fake thickness.
- A ship video whose framing drifts or loops.
- A luma test that deletes dark armor.
- `clamp(vec2, float, float)` or any other GLSL ES 3.00-only call on the ship shader.
- Spawning inside the beam.
- Hiding the card before the shell exists.
- Treating this file as permission to extrude lane plates or to replace law 44.

World of the lane stays Imagine video cards plus capsules. This page is only the void-flight hull.

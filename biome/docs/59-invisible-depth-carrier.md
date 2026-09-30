# Law 59 — INVISIBLE DEPTH CARRIER exception

**HARD / EXCEPTION ONLY — owner-approved 2026-09-29.** This is the sole approved exception to the no-mesh law. It is an invisible carrier for Imagine pixels, not a new renderer or world.

## ALLOWED

- Display an Imagine Video plate on an invisible dense grid displaced by per-pixel monocular depth from that same frame (for example, Depth Anything V2 Small, near = white), plus a light high-pass of that frame so craters / hull plates do not become one smooth mound. Grid: about **200×100**. Displacement: gentle. Depth: smoothed.
- Purpose is real parallax when Bolt turns. Each plate covers about **±20°**; cook one locked-off Imagine plate per **~40° heading**. No push-in, zoom, or dolly. Crossfade neighboring plates over **~15–25°**; clamp at plate edges. Heading 0 shows the center of its plate so the turn stays inside cooked pixels.
- The carrier **NEVER draws its own pixels**: no own color, texture, lighting, shading, or procedural detail. Every visible pixel is an Imagine Video pixel.

## Still Imagine image for static decor

- The relief texture for static solid decor (rocks, hulls, wrecks, ground) may be a still Imagine IMAGE, or one locked frame of an Imagine plate. This is preferred: depth is computed on that exact frame (perfect match), with no loop snap and sharper detail.
- Living elements (stars twinkle, dust, vapor, lights) stay separate keyed Imagine VIDEO layers that loop seamlessly: first frame = last frame, or ping-pong. **Never** hard-restart them.
- **FAIL** a plate video with baked object drift / rotation that snaps back on loop, or depth computed on one frame while the pixels drift. Bolt stays `lock/bolt-gallop-cycle.mp4`.
- **APPROACH:** moving toward an object never zooms a plate beyond **~1.3×**. Crossfade to a plate cooked closer on the same axis (far / mid / near). Otherwise keep the object as distant decor.

## BOLT LOCK

- **NEVER apply this carrier to Bolt.** Bolt stays the keyed `lock/bolt-gallop-cycle.mp4` layer with the camera locked behind. No extrusion, no Blender, no `.glb`, no four-photo shell. All are **FAIL, Velum-class**.

## NOT LICENSED

- This is not permission for Three.js / procedural / mesh worlds, terrain generators, or modeled objects. Simplex stays placement only.

## FAIL

- Melt / stretch / rubber-sheet at edges.
- Halos or holes around silhouettes.
- Shimmering detail.
- Visible plate border.
- Hard pop between plates.
- Turning beyond cooked pixels.

## KEEP

Reference: **“space void relief sandbox test passed owner QC (KEEP) 2026-09-29”** — parallax near > mid > far, crisp at ±20°, no halo, stable detail, Bolt clean.

## Method writeup

Step-by-step numbers (plate frame 12, depth, 138° outpaint, Bolt key, controls): [`60-imagine-relief-panorama-method.md`](60-imagine-relief-panorama-method.md). Review only. Not a hang. Test 2c panorama is KEEP. Test 2d 360° relief ring is KEEP (values in [doc 60](60-imagine-relief-panorama-method.md), merged via PR #124).


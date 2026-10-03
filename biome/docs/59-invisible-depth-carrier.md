# Law 59 — INVISIBLE DEPTH CARRIER exception

> **Amended 2026-10-03 to match [`docs/METHOD.md`](../../docs/METHOD.md)** (newer owner decisions win): relief height, rocks and approach zoom below. Hard-object (lofted hull) amendment 2026-10-03 21:36 at the end of this page (frigate validated by SmiR on the phone).

**HARD / EXCEPTION ONLY — owner-approved 2026-09-29.** This is the sole approved exception to the no-mesh law. It is an invisible carrier for Imagine pixels, not a new renderer or world.

## ALLOWED

- Display an Imagine Video plate on an invisible dense grid displaced by per-pixel monocular depth from that same frame (for example, Depth Anything V2 Small, near = white), plus a light high-pass of that frame so craters / hull plates do not become one smooth mound. Grid: about **200×100**. Displacement: gentle. Depth: smoothed.
- Purpose is real parallax when Bolt turns. Each plate covers about **±20°**; cook one locked-off Imagine plate per **~40° heading**. No push-in, zoom, or dolly. Crossfade neighboring plates over **~15–25°**; clamp at plate edges. Heading 0 shows the center of its plate so the turn stays inside cooked pixels.
- The carrier **NEVER draws its own pixels**: no own color, texture, lighting, shading, or procedural detail. Every visible pixel is an Imagine Video pixel.

## Still Imagine image for static decor

- The relief texture for static solid decor (rocks, hulls, wrecks, ground) may be a still Imagine IMAGE, or one locked frame of an Imagine plate. This is preferred: depth is computed on that exact frame (perfect match), with no loop snap and sharper detail.
- Living elements (stars twinkle, dust, vapor, lights) stay separate keyed Imagine VIDEO layers that loop seamlessly: first frame = last frame, or ping-pong. **Never** hard-restart them.
- **FAIL** a plate video with baked object drift / rotation that snaps back on loop, or depth computed on one frame while the pixels drift. Bolt stays a keyed video (Bolt lock below).
- **APPROACH (amended 2026-10-03):** moving toward an object never pushes **magnification above 1.0** (law 65, 720×1600). Crossfade to a plate cooked closer on the same axis (far / mid / near) before the displayed magnification would exceed 1.0. Otherwise keep the object as distant decor. (Was: zoom up to ~1.3×.)

## BOLT LOCK

- **NEVER apply this carrier to Bolt.** Bolt stays a keyed video, camera locked behind: `lock/bolt-gallop-cycle.mp4` while he moves, `lock/bolt-idle-breath.mp4` when he has stopped ([doc 61](61-free-clearing-walk.md)). Same wolf, same key. The gallop file does not change. No extrusion, no Blender, no `.glb`, no four-photo shell, no walk-around hull. All are **FAIL, Velum-class**.

## NOT LICENSED

- This is not permission for Three.js / procedural / mesh worlds, terrain generators, or modeled objects. Simplex stays placement only. The lofted measured-section hulls of the 2026-10-03 amendment below are the only hard-object carrier.

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

Step-by-step numbers (plate frame 12, depth, 138° outpaint, Bolt key, controls): [`60-imagine-relief-panorama-method.md`](60-imagine-relief-panorama-method.md). Review only. Not a hang. Test 2c panorama is KEEP. Test 2d 360° relief ring is KEEP (values in [doc 60](60-imagine-relief-panorama-method.md), merged via PR #124). Free-360 clearing walk (Rocky Clearing take 3 KEEP) and Bolt idle breath: [`61-free-clearing-walk.md`](61-free-clearing-walk.md).

## Extension 2026-10-01: invisible procedural terrain shape

**Owner-approved (SmiR) 2026-10-01.** Official exception. Extends this law; everything above stays. The Odyssey world is still **Imagine pixels only**. The existing FAIL rules stay: no procedural / Three.js / noise-drawn floor, and simplex is placement only. This extension licenses invisible shape, never visible pixels.

### ALLOWED — invisible shape computed in code

- Code **MAY** compute the invisible **SHAPE** of walkable ground:
  - the ground plane;
  - height relief (amended 2026-10-03, owner/Director 2026-10-02): natural terrain relief **up to 3 m over ≥ 20 m wavelength**, walkable slopes **≤ 15°**; taller cliffs and canyon walls are objects standing on it, never relief;
  - per-pixel depth micro-relief of each top-down Imagine tile (monocular depth, e.g. Depth Anything, + light high-pass), so painted cracks, plates and crystals get real micro-volume (owner 2026-10-03). Tiles stay continuous across their edges on the terrain;
  - tile layout;
  - collision;
  - placement.

### REQUIRED — every visible pixel is Imagine

- **Walkable ground** = seamless **top-down Imagine still tiles** (**≥ 4 variants**) laid at **true world scale** on that invisible relief, in **several distinct Imagine materials** distributed by the relief with soft transitions and large-scale variation (never one plain dirt texture), plus the anti-carpet rules of METHOD.md (relief silhouettes, raised lips, small standing Imagine ground cutouts, grazing textures, fog).
- **Rocks and boulders** (amended 2026-10-03) = **8-view Imagine silhouette carving** (8 views every 45°) → `tools/objsheet` → `tools/walkaround/build.py` (PR #127). Natural irregular shapes, never balls. Simplex places them (placement only). Small upright Imagine cutouts remain only for small ground details.
- Code **never** draws, paints, shades, normal-maps or colours pixels. Lighting stays **baked** in the Imagine pixels.

### Quality lock (still applies)

- Magnification **≤ 1.0** on portrait **720×1600**. Size the tiles so the bottom screen edge stays **≤ 1.0**. Watch slope stretching.
- Lossless PNG. No blur.
- Watch for visible tile repetition.

### Backdrop

- The 360° ring of Imagine stills stays the **FAR** backdrop (sky + ridges). It does **not** move when Bolt walks.

### Why

- **Rocky Clearing walk test 2026-10-01, attempt 1, FAILED:** a single ring / relief still upscales after **~4 cm** of camera travel, so the ground froze (the HUD distance changed, the image did not). Freezing that still to the camera left magnification **0.406** on the HUD against a claimed **0.990**. Walkable ground therefore uses top-down tiles; the ring is backdrop only. Recorded in [doc 60](60-imagine-relief-panorama-method.md#walkable-ground-2026-10-01). **Take 3 KEEP** (phone QC, HUD and phone both **0.979**) and the idle-breath KEEP are [doc 61](61-free-clearing-walk.md). The clearing edge in that doc is still **IN PROGRESS**.

## Amendment 2026-10-03: lofted measured-section hulls

**Owner SmiR validated the frigate on the phone 2026-10-03 21:36 (Paris), after PR #161.** Recipe: [`docs/METHOD/hard-objects.md`](../../docs/METHOD/hard-objects.md).

- **ALLOWED:** hard objects (ships, gates, wrecks) may use an invisible hull **lofted from cross-sections measured on Imagine images** (side, top, sections). Volume parts are measured once on the Imagine image where they are painted and built once. This is an approved invisible carrier, like the depth relief and walk-around hulls above.
- **REQUIRED:** every visible pixel stays **unlit Imagine** (one Imagine skin per part, no lighting, shading, tint or procedural detail from code). Magnification ≤ 1.0 (law 65). No offset shell, no other hull generator, no TripoSR-style mesh.
- **Bolt lock** still applies. This is not permission for mesh worlds.

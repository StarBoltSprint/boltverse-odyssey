**Best practical pipeline for matching a single key image (like your key-city3) while staying playable and fast on Adreno 650 WebGL2 (S20 FE target).**

Monocular depth on stylized sci-fi Imagine images is imperfect (models are trained mostly on real/photo data), so treat the depth as a strong prior, then post-process, scale, and optimize. Depth Anything V2 (especially the relative Large or metric outdoor) is the most robust starting point for fine dune detail; MoGe / MoGe-2 is excellent for full geometry + FOV estimation; Metric3D is strong when you can supply reasonable intrinsics but can drift outdoors. Prefer relative depth + manual/metric anchors over pure metric on this style of image.

### 1. Rebuild the playable heightfield from the key

1. **Camera & scale setup** (rough numbers): Assume or estimate FOV 60–75° (typical for such key renders). Detect horizon (Hough or simple gradient). Player scale: ~1.7 m tall, preferred run corridor 8–15 m wide, dunes rising 15–40 m on the sides relative to the avenue floor, key visible depth ~200–500 m. Lock these as targets.
2. Run **Depth Anything V2 Large** (relative for detail) and/or **MoGe-2** (point map + normals + FOV). Also try the metric outdoor DA-V2 if you want meters out of the box (max ~80 m trained).
3. **Separate ground from objects**: Use SAM2 (or GroundingDINO + SAM) with prompts for “sand dunes”, “broken slabs”, “debris”, “wreck”, “towers”, “arch”, “sky”. Mask sky and tall objects.
4. **Ground heightfield**:
   - Fit a base plane (or low-order polynomial) from lower-image / near-horizon ground points and the sunken avenue.
   - Subtract to get relative height. Convert the inverse-depth or point map to a heightmap in the corridor coordinate system (X forward, Y height, Z lateral).
   - Smooth lightly (bilateral or small Gaussian) while preserving dune crests and the avenue depression. Manually or automatically enforce the central avenue as a lower trough (carve 8–15 m wide, gentle side slopes ≤15–20° for running).
   - Scale and shift so dune amplitudes and avenue depth match the key silhouette and your playable targets (e.g., side dunes 20–30 m relative height, avenue floor near 0).
5. Output a high-res heightmap (e.g., 1024–2048² covering the key region at ~0.5–1 m/pixel near the player) plus a coarser version for distance.

This gets you a base that already looks closer than a flat plane.

### 2. Extend endlessly with the same dune character

- Analyze the key heightmap: dominant wavelengths (autocorrelation or FFT — dunes often 50–200 m), amplitude statistics, preferred orientation/wind direction (from the image and ripple direction), and trough/crest sharpness.
- Procedural continuation: multi-octave anisotropic noise (simplex or domain-warped Perlin) aligned to the key wind direction. Layer large dunes (wavelengths matching the key) + medium ridges + small wind ripples. Amplitude falloff or modulation with distance; occasional larger mounds.
- Seamless blending: overlap the procedural field with the key heightmap (or a few “seed” patches extracted from it) using a distance-based weight or simple erosion/diffusion step that respects the key statistics. Avoid obvious tiling by varying phases and adding low-frequency modulation.
- Keep the runner corridor relatively consistent (mild undulation or forced lower path) so it stays playable for kilometers.

### 3. Keep the runner corridor playable

- Explicitly carve or clamp the central 8–15 m avenue in the heightmap (broken slabs as low visual debris or minor height bumps, not steep walls).
- Collision: heightfield collider (or a simplified physics mesh) with max slope and a “runnable” mask. Soften or flatten any >20–25° slopes inside the corridor.
- Visual vs. gameplay: the rendered dunes can be steeper and more dramatic outside the corridor; the physics height can be a smoothed/clamped version.
- Mag-rail / debris: place as separate meshes or height details that the player can interact with or dodge.

### 4. Texture with Imagine pixels only

- Primary: project the key image (and any additional Imagine close-ups of sand, debris, rock) onto the heightfield from the key camera (or a small set of generated views). Use the depth/height for correct projection.
- Shader blends: height + slope + curvature masks (cheap, precomputed or analytic) to mix:
   - Flat troughs / avenue → sand albedo from key.
   - Crests and steep slopes → warmer/rockier or debris tones sampled from key.
   - Macro plates or large features via triplanar or projected large-scale Imagine textures.
- For the procedural extension: sample a small set of Imagine sand/rock tiles and blend them the same way (slope/height), plus a low-frequency color variation matching the key’s warm orange palette. Keep the fragment shader extremely cheap (1–2 texture samples, no expensive procedural noise in the fragment stage).

### 5. Mobile performance (Adreno 650 WebGL2, ground shader was ~94 % of frame)

- **Preferred LOD**: Geometry clipmaps (or CDLOD with morphing). Nested regular grids (5–7 levels), base patch 64×64 or 128×128 vertices, centered on the camera and snapped to the grid. Vertex shader samples a heightmap texture (R16 or packed) for displacement. Morphing between levels eliminates pop. One or very few draw calls.
- Alternatives: quadtree chunks with skirts or morphing, or a baked high-res mesh for the near corridor + low-poly clipmap far away. Avoid pure GPU displacement of a huge static mesh.
- Targets: keep terrain triangles well under 50 k (ideally 10–30 k visible), draw calls minimal, heightmap textures compressed (ASTC).
- Shader: the fragment was the bottleneck — strip it down (simple normal from height derivatives or a pre-baked normal map, 1–2 albedo samples, cheap slope blend, no heavy noise or multi-layer materials). Use early-Z, minimize overdraw, and consider lower resolution or simpler shading at distance. Test on device; Adreno likes tile-friendly, low-bandwidth workloads.

### 6. Automatic verification + correction loop

- Match the key camera (intrinsics from horizon + estimated FOV, extrinsics from the image).
- Render the terrain (+ placed objects) from that camera. Compute:
   - Horizon / dune silhouette IoU (mask sky and large objects, compare edge maps or binary masks).
   - Depth-order checks (towers left/right, wreck on right, arch, etc.).
   - Feature checklist via a vision model (Grok vision or similar): “sunken central avenue with broken slabs”, “large side dunes”, “sand mound on right”, “matching tower placement”, etc.
- Auto-correct: optimize a small set of parameters (global scale/offset, dune amplitude, corridor depth, a few control points, or object positions) to maximize IoU + checklist score. 5–15 iterations of gradient-free or simple gradient updates usually suffice. Re-run after object placement.

### 7. Auto-place towers, mesas, wreck, arch

- Segment or detect them in the key (SAM2 / detection + manual cleanup of masks).
- Lift to 3D using the monocular depth/point map + estimated camera. Estimate base contact points on the ground plane/heightfield and typical sizes from image proportions (towers tens to hundreds of meters tall).
- Snap bases to the reconstructed terrain height.
- Verify projection matches the key camera, then check a few runner-path views (side, front, looking back) for no clipping, good silhouettes, and depth order.
- Optimize positions/scales/rotations in the same verification loop so both the key view and the in-game path stay good. Prefer a small number of key objects with accurate placement over dense automatic clutter.

**Suggested order of work**: (1) depth + ground separation + scale on the key region → (2) enforce playable corridor → (3) texture projection → (4) place major objects and verify → (5) procedural extension → (6) clipmap LOD + shader slim-down → (7) closed-loop verification/optimization. Iterate on the key view first until the sheet (before/after/key) is close, then extend.

This gives you a heightfield that starts from the key pixels, stays endless and dune-like, remains runnable, uses only Imagine textures, and fits the mobile budget. The verification loop is what turns a “roughly right” reconstruction into a close visual match.

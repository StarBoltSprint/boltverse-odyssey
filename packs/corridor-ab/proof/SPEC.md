# Step — corridor look, sky, and props

Goal: on a phone-sized view, Bolt can turn 360° on the hung corridor, the sky covers every heading and tilt, and existing zone A solids stand along a longer straight run. No new Imagine file. No mid-run WFC.

## Rails

- Look reuses the zone A stick and the opposite-side swipe. Yaw turns freely. A vertical swipe tilts, then eases back. The numbers are the zone A look spring.
- Sky is the zone A dome: horizon, upper, and high slices, the zenith cap, and the stars, dust, and nebula loops. Sky is the only backdrop.
- Props are already-cooked solids. Rock hulls (boulder, stone). The Roman arch, the Eclipse Gate loft, and the wreck, placed by a load-time seed. No card, no billboard, no new mesh.
- Colliders for the arch, the gate, and the wreck are the faces those meshes already draw. The openings stay walkable. A rock blocks only its hull footprint.
- The corridor stays one straight doc-62 link. Length is between 60 m and 120 m. Placement is computed once at load for the whole run.
- Phone: 720×1600, draw calls ≤ 12, texture memory ≤ 260 MB, at most four videos decoding, stills mipmapped, video linear, DPR ≤ 2.

## Done when

1. The stick turns Bolt through a full yaw, and a swipe tilts then eases back to level.
2. The sky dome fills the frame at headings 0°, 90°, 180°, 270° and on a tilt-up. No black band above the sky.
3. Boulder and stone hulls, the arch, the Eclipse Gate, and the wreck are on the corridor. A second seed moves the scatter.
4. Bolt can pass the arch opening. A pier blocks. Rock contact is the hull footprint.
5. Corridor length is between 60 m and 120 m and the link is still one straight run.
6. `hang_selftest.py`, `place.test.mjs`, and `scatter.test.mjs` exit 0.
7. Proof frames for the four headings and the tilt sit under `packs/corridor-ab/proof/`.
8. No new Imagine file is added. WFC does not run during play.

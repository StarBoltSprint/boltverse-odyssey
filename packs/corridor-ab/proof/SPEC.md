# Step — hang the WFC corridor

Goal: copy a load-time WFC `path-layout.json` into a world a player can walk. Bolt moves from the zone A gate, along the placed corridor, to the zone B gate. No new Imagine file. No mid-run solve.

## Rails

- WFC stays placement. `when` is `load`. `draws_pixels` is false.
- `world.json` `corridors` is a copy of `world_corridors`. Waypoints stay in `path-layout.json`.
- The from-gate `leads_to` is the corridor id.
- Tile assets and the corridor `ground` are files already under `packs/zone-a/src/ground/`.
- No corridor video exists. The floor is those stills, one file per solved cell, at the zone A tile step of 1.45 m.
- Zone B has no pack. The arrival plate reuses one zone A ground still and is labelled as that stand-in.
- The Eclipse Gate loft stays in `packs/zone-a`. This strip does not build a second gate mesh.
- Level chase. Horizon at 0.50 of 720×1600. No typed colour. No Three.js mesh. No new pixels.
- Phone: one Bolt video, stills with mipmaps, draw calls under 12.

## Done when

1. `hang.py` writes `world.json` corridors equal to `path-layout.json` `world_corridors`.
2. Waypoints stay in `path-layout.json`. `draws_pixels` is false. `when` is `load`.
3. The zone A gate `leads_to` is `path-ab`.
4. `ground` and every tile asset are existing files under `packs/zone-a/src/ground/`.
5. `layout.py check --world` prints `PASS  transition` for both zone stubs.
6. The play page places those files on the solved cells and walks Bolt with zone-flow.
7. No new Imagine file is added. The solve does not run during play.
8. `hang_selftest.py` and `place.test.mjs` exit 0.

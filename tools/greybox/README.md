# tools/greybox — Zone D terrace greybox from spine.json

    python3 tools/greybox/build.py spine.json --out DIR      # writes DIR/greybox.glb, colliders.json, spine.json, build.json
    python3 tools/gatesuite/run.py DIR                       # gate it
    python3 tools/greybox/selftest.py

- `greybox-spec.json` was written here because none existed. It is derived from kit-art, kit-engine, playtest-walk and layout-stage, and a copy is in learn/proposals.
- spine.json (≥ 1.3.1) is the only source for placement:
  - the terrace sits at s = 450 m of the terrace-climb beat, using the spine ground there
  - it is pushed left of travel until it is ≥ 6 m clear of the spine
- Shape: 3 tiers of 2.5 m (7.5 m total) with 2.5 m treads, 20 m wide. A cornice sits on tier 1 with a 0.6 m overhang, a 1 m seat and corbels every 2 m.
- 14 world colliders, inset 2 cm.
- 13 sockets as named empties: tier corners, cornice ends, door jambs.
- `marker_1.8m` stands on the lane.
- Expected gatesuite result:
  - spine, layout, walk, pack and depthmeasure PASS
  - budget FAILs on texel density, because the greybox has no textures
  - playgate FAILs because the greybox has no served page
  - kitjudge FAILs because there are no judge render or views

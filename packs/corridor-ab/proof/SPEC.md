# Step — corridor chase, sprint, and streaming props

Goal: on a 720×1600 view, the chase sits higher behind Bolt and looks down a little, the stick turns the way it points, his paws sit on the ground, the run is wide enough to steer, and already-cooked solids stream in ahead as he sprints. No new Imagine file.

## Rails

- The camera stays a chase behind Bolt. The eye is higher than the old 1.22 m shoulder and looks down toward him and the path. The stick sign matches zone A once the view is no longer mirrored: stick right turns toward camera-right. A swipe up looks up, then the same spring eases back to level.
- Paw contact uses the zone A baseline: the lowest opaque row of the Bolt clip sits on the ground (y = 0).
- The doc-62 link stays one straight corridor. The runnable ground around it is the same zone A stills, extended so he can leave the centre line. Nothing clamps him with an invisible wall. A rock or a loft blocks only where that mesh is.
- Sprint speed rises while the stick is held and eases back on release. It does not snap to the max.
- Placement of boulder and stone hulls, the arch, the Eclipse Gate, and the wreck streams ahead of Bolt during the run. The pool recycles what falls behind. Density follows speed. A new slot starts beyond the near radius and rises into place. The same seed and the same speed history rebuild the same slots. The WFC tile solve stays load-time. No card, no new mesh, no new pixel.
- Phone: 720×1600, draw calls ≤ 12, texture memory ≤ 260 MB, at most four videos decoding.

## Done when

1. Chase eye is above 2.6 m, behind Bolt, pitched down. Stick-right increases heading toward camera-right.
2. The paw line of the Bolt quad sits on y = 0.
3. Sprint speed ramps up under a held stick and eases down on release.
4. A second replay of the same seed and speed history streams the same slots. A faster pace streams more. A new slot is not inside the near radius.
5. The arch opening stays walkable when that loft is seated. Rock contact is the hull footprint. No position clamp.
6. `hang_selftest.py`, the play tests, and `renderlint` exit 0.
7. Proofs: a walk-speed shot, a max-sprint shot, and a short emerge clip, under `packs/corridor-ab/proof/`.
8. No new Imagine file. The corridor WFC solve does not run during play.

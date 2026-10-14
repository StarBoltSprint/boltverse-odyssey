# Ember Mesa — Anchor is a walkable solid

Goal: the Anchor tower is a real loft at its world position. The sand continues to its base. Magnification stays at most 1 along the walk.

Rails: Imagine pixels only. Measured loft, one unlit skin, no offset shell. No new Imagine image. Do not touch the planet card. No camera shake. No invisible wall. drawCalls at most 12. Texture bytes at most 260 MiB. Videos at most 4, including Bolt. Debug HUD only with debug=1.

Done when:

1. Approach stills show continuous ground to the arch feet, and the tower is larger in the near still than in the far still.
2. Under the arch, both legs are in frame. A tilt up shows the tower. The center walk is open.
3. Presented magnification along that walk is at most 1. The monument stays 60 m.
4. North backdrop cards sit behind the tower, inside the ground fade.
5. Drone and rib stops are the visible hull, or an invisible box is cut back to that hull.
6. drawCalls, texture bytes, and video count stay inside the rails. The planet path is unchanged.
7. Root tests, playcheck unit tests, and the zone walk gate pass.
8. Proof stills and proof.json land in the out folder for this step.

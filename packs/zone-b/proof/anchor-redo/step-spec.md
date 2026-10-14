# Ember Mesa — redo the Anchor arch and tower

Goal: replace the tiled rectangular Anchor with a natural sandstone rock arch and a 60 m open rusted lattice tower. Bolt walks under the opening on continuous sand. The sky stays visible through the lattice when the view tilts up.

Rails: Imagine pixels only. Measured loft, one unlit skin per part, no offset shell, no repeated wallpaper crop, no stretched UV. No new camera shake. No invisible wall. Do not touch the planet card, the rock pass, or terrain outside the Anchor. drawCalls at most 12. Texture bytes at most 260 MiB. Videos at most 4, including Bolt. Imagine images at most 10. Debug HUD only with debug=1.

Done when:

1. Approach, under, under-tiltup, and side stills show a rock arch and an open lattice, not a flat tiled slab.
2. The center path is open. Sand continues to the feet. Bolt's walk is not blocked under the opening.
3. A tilt up under the arch shows sky between the beams.
4. Presented magnification along the walk stays at most 1. The tower stays 60 m.
5. drawCalls, texture bytes, and the video count stay inside the rails. The planet path is unchanged.
6. Root tests, playcheck unit tests, and the zone walk gate pass.
7. Proof stills and proof.json land in the out folder for this step.
8. The step report records the measured rows.

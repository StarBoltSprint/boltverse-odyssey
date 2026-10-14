# Ember Mesa canyon solids

Goal: the hoodoos, mesas, and canyon walls are measured-section lofts. A face-on card is rejected, near and far. Only the sky stays a backdrop.

Rails: Imagine pixels only. Frigate loft (sections from the existing face stills, one skin per face, no second shell). Magnification at most 1. No camera shake. No collider without a rock. drawCalls at most 12. Texture at most 260 MiB. Videos at most 4, including Bolt. Debug HUD only with `?debug=1`. Imagine budget at most 16. Do not edit the planet or the Anchor.

Done when:

1. The chase `place(0, 0, 180)` shows the same planet framing, and every tall solid is turned so two faces read.
2. Two walk frames past one pillar differ by about 90 degrees, and the foot of every solid is at or under the ground.
3. Each collider is that solid's own walk section.
4. Presented magnification stays at most 1, draw calls at most 12, texture at most 260 MiB, videos at most 4.
5. Proof images and `proof.json` are in `/workspace/grokcli/out/zoneB/rocks3d/`.
6. Root `npm test` and `tools/playcheck` `npm test` pass.

# Zone C step 1 — Cascade Verdance ground + sky + first relief

## Goal

A playable Cascade Verdance clearing: invisible highland relief, Imagine ground tiles, a nearly empty Imagine base sky, and two looping Imagine video layers. Bolt uses the zone A controller (joystick and camera-tilt swipe). Archives and the pause menu use the shared hall module.

## Rails

- Every visible pixel is an Imagine image or video. Code places the relief, the tiles, and the fog colour sampled from the sky.
- Magnification ≤ 1.0 on 720×1600, including slope stretch. No camera shake. No invisible walls. No circles or rings.
- Sky: nearly empty base, then each animated element as its own looping video. A video must move (frame diff) and loop without a pop.
- Phone: drawCalls ≤ 12, texMB ≤ 260, active videos ≤ 4 including Bolt. HUD only with ?debug=1.
- Imagine budget: ≤ 14 images and ≤ 2 videos.
- Do not place a flat card past the ground edge. Do not ship a video that does not move.

## Done when

1. `packs/zone-c/play/index.html` boots with Bolt on the relief.
2. At least four distinct Imagine ground materials sit on the relief, with a mask and standing cutouts when the budget allows.
3. The base sky is Imagine. Two video layers play, and a measured frame diff shows motion.
4. Four heading captures and per-layer captures land in `/workspace/grokcli/out/zoneC/step1/` with `proof.json` (drawCalls, texMB, mag max).
5. Root tests and playcheck unit tests pass. A live playcheck is recorded.
6. The step is committed on `zone-c-step1-ground-sky`.

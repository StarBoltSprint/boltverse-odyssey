# Boltverse layer, step 1: World Graph (zone file) + loader + key-camera check

Read q28-answer.md and q28-followup-answer.md (Grok chat advice), GROK.md, docs/METHOD and the Zone B preview (/workspace/zb-preview-1008: main.mjs, biome.json, objects.mjs, mesas, sky1).
Goal: a thin layer ON TOP of three.js (no new engine) where one zone is described by a single file, and the game builds itself from it.
1. A versioned JSON Schema `zone.v1` (World Graph). For each object: asset (GLB + LODs), its Imagine source images, the camera pose(s) that produced them, the world-space transform, fidelity thresholds, and a `wake` block (placeholder for now). Zone level: keyImage, keyCamera, biome (ground and sky), lighting (sun, fog, halo; values from the lighting module, pixels from Imagine only), gameplay, qualityGates.
2. A tool that exports the current Zone B into zone-b.zone.json from what exists today, with nothing invented. Missing data goes in a "todo" list.
3. A runtime loader (runtime/zone-loader.mjs) that builds the scene from the zone file. The rule: the render must be pixel-identical to the current Zone B (pixel diff mean of 1/255 or less from the hero, street and 8 m cameras).
4. A verify command: render the keyCamera, compute SSIM/LPIPS against the key image, and check draw calls and triangles. It writes a JSON report.
5. Docs in docs/METHOD/world-graph.md plus a selftest. Local commits only; don't push.
Don't change the live preview or index.html. Don't touch the fusion or unreal worktrees. Generate no Imagine images.
Deliver: zone-b.zone.json, the diff numbers, the verify report, and a short REPORT.md.

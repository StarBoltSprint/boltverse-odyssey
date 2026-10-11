# [tool-feedback] relief row passes when one axis is under 0.3 m

- Tool: tools/object-gate (other)
- Tool version / commit: cfe98447 (parent of this step). The measure is `steps/multiview-tower-1011/gate/report.md`.
- Take / branch: cursor/i23d-vision-stage-36f5, step multiview-tower-1011. The game mesh under test is `kc-staging/zb-tower3/objects1/vision/tower.glb` sha256 `5f4c25dab480…`.
- Defect seen on screen: the lit ortho and the phone play frame are near black. The albedo capture shows a grazing concrete pier. The solid's foot is a point, so the body sits about 2.45 m off the probe.
- Metric the tool reported vs what was measured: the row `facade relief >= 0.3 m` printed PASS with `+x 0.517 -x 0.443 +z 0.163 -z 0.32`. The building spec asks for ≥ 0.3 m on features. +z is 0.163 m. `minReliefFaces: 2` in `tools/object-gate/specs/zone-b/tower-hero-vision.yaml` is what lets the row pass. The proportions hint says to scale the solid in Blender. This step's spec forbids fixing d/w by stretching.
- How to reproduce: `node tools/object-gate/cli.mjs --scene tools/object-gate/specs/zone-b/tower-hero-vision-scene.yaml --out steps/multiview-tower-1011/gate` against the fusion page on port 8996. Exit 1, 11 FAIL / 21, relief row PASS.
- Still: `steps/multiview-tower-1011/gate/tower-hero/capture-sheet.jpg` and `steps/multiview-tower-1011/sheet-phone.jpg`.
- Short video: none.
- Proposed fix: count an axis under 0.3 m as a fail when the spec names that target, including a zero on an unpainted axis that the checklist still requires. Keep the scale hint from offering a texture stretch.
- Confirmation: no secrets, API keys, tokens, or private style prompts.

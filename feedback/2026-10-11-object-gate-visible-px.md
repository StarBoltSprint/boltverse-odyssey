# [tool-feedback] visible px/m printed 0 when the tower had detail

- Tool: tools/object-gate
- Tool version / commit: branch cursor/i23d-vision-stage-36f5, before the tower-sides-fix-1011 commit (hires gate is commit 5ac1d217)
- Take / branch + commit: tower-sides-fix-1011 on cursor/i23d-vision-stage-36f5
- Defect seen on screen: the 8 m phone capture of the tower was a beige wall with real stone and glass, and the gate row said visible px/m was 0
- Tool metric vs measured: hires row `steps/hires-tower-1011/gate/report.md` says visible px/m 0 vs 154.6, flat, 20 tiles. The same capture's mean L* was 48.92, so the frame was not empty. After the fix, `steps/tower-sides-fix-1011/gate/tower-hero/visible.json` reports an upper bound of 18.9 px/m (`coarserThanEstimator`, screen 309.3, 20 inside tiles, 0 tiles past kmax) and per-face detail +z 50.8, −z 57.0, +x 53.8, −x 46.5 at screen 85.8. The 154.6 bar was not changed. 18.9 and ~50 are both under 154.6
- Reproduce: `node tools/object-gate/cli.mjs --scene tools/object-gate/specs/zone-b/tower-hero-vision-scene.yaml --out steps/hires-tower-1011/gate` on the hires install printed 0. The same command with `--out steps/tower-sides-fix-1011/gate` on the sides install prints the 18.9 upper bound. `faceCaptures` must be one Playwright argument; two arguments throw and the per-face line is missing
- Still / screenshot: `steps/tower-sides-fix-1011/gate/tower-hero/cap-visible-8m.png` and `steps/hires-tower-1011/gate/tower-hero/cap-visible-8m.png`
- Short video: none
- Proposed fix: when inside tiles exist and none pass the energy test, report `S/kmax` and `coarserThanEstimator`, not 0. Call `faceCaptures` with one array argument. Keep `needPxPerM` 154.6
- No secrets, API keys, tokens, or private style prompts: yes

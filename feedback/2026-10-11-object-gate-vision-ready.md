# [tool-feedback] object gate selects the vision hero before the GLB is in the scene

- Tool: tools/object-gate (adapter zb-preview-1008)
- Tool version / commit: 0bf57677 (readyExpr change is in this step, not that commit)
- Take / branch: cursor/i23d-vision-stage-36f5, fusion-fix5-1011
- Defect seen on screen: the staging play view had no measured hero. The gate returned in about 70 s with one fail.
- Metric the tool reported vs what was actually measured: select reported `selector {"names":"tower-hero"} matched no object`. The GLB (132344 verts) was still loading. A second run that waited for `window.__visionTower` selected 1 copy and measured 264684 tris.
- How to reproduce: `PATH=/tmp/pyof:$PATH node tools/object-gate/cli.mjs --scene tools/object-gate/specs/zone-b/tower-hero-vision-scene.yaml --out steps/fusion-fix5-1011/gate --fast` with `readyExpr` that does not wait for the vision mesh.
- Still / screenshot: `steps/fusion-fix5-1011/gate/ready-540x1200.png` (the later run, after the wait).
- Proposed fix: on `visionKey=1`, `readyExpr` also requires `window.__visionTower`. That line is now in `tools/object-gate/adapters/zb-preview-1008.mjs`.
- Confirmation: no secrets, API keys, tokens, or private style prompts.

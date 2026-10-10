# [tool-feedback] object-gate stretch and repeat rows disagree with the picture

- Tool: tools/object-gate
- Tool version / commit: 25de1eb (the gate code was not changed in this step)
- Take / branch + commit: cursor/tower-hybrid-1010-36f5, game commit 47810f3
- Defect seen on screen: The 8 m hero cell is a blurry magnification of the key crop. It does not show a quilt. The side cell shows one tan flank, not a tiled panel grid.
- Tool metric vs measured: Row `UV stretch <= 1.3` printed -x 3.058, +x 3.046, -z 3.031, +z 3.03. The builder's per-triangle UV jacobian max is 1.012 / 1.064 / 1.069 / 1.016. Unique px/m on the front is about 3.05, the same magnitude as the printed stretch. Row `repetition (visible): identical plate pixels` printed "plate tiles every 0.6 m (x5593)". Row `repetition (capture autocorrelation)` passed (face z peak 0.5217). The flank shader divides `uv.y` by depth before sampling, so the attribute is in metres. A reader cannot tell a UV-anisotropy fail from a small atlas covering a tall face once.
- Reproduce: `OG_PLAYWRIGHT=/workspace/playtest/node_modules/playwright/index.mjs node tools/object-gate/cli.mjs --scene tools/object-gate/specs/zone-b/tower-hero-scene.yaml --only tower-hero --fast --out /tmp/og-tower-hero`
- Still / screenshot: `/workspace/zb-tower-hybrid-1010/sheet.jpg` (8 m and side columns). Gate sheet `/tmp/og-tower-hero/tower-hero/capture-sheet.jpg`.
- Short video:
- Proposed fix: Print the UV jacobian condition and the unique px/m as two numbers. Score a face whose shader maps the attribute through one 0..1 window as one plate, including when the attribute is stored in metres.
- No secrets, API keys, tokens, or private style prompts: yes

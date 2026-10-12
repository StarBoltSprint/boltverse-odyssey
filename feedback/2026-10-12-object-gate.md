# [tool-feedback] oblique sheet path and a relief check that passed a flat plate

- Tool: tools/object-gate (oblique-profile, facade relief, shadow probe) and tools/imagine-to-3d facade volumes
- Tool version / commit: `61e56a9a`
- Take / branch + commit: tower-volumes-1012 on `cursor/i23d-vision-stage-36f5`, `61e56a9a`
- Defect seen on screen: Phone capture 09:43 showed flat facades with the Imagine plate pasted on. Cables, chrome, and recesses read as paint. The completed gate's oblique sheet is a 240×480 contact sheet of real ledges; the shadow probe still shows no ground darkening.
- Tool metric vs measured: Old relief row PASS at +x 2.851 / −x 2.848 / +z 0.496 / −z 0.496 (AABB, bar 0.3 m) while the phone read flat. New row PASS at bar 0.521 m with plane gaps +x 3, −x 3, +z 1.05, −z 2.95, and oblique ranges 0.60–4.50 m. Shadow gate metric s1.n = 0. A separate probe saw the shadow map bound and the caster drawn, and the colour mean unchanged. Crispness FAIL at planes 10 / 10 / 1 / 6 against a 2–8 window; fix4 had printed PASS with −z planes 14.
- Reproduce: `node tools/object-gate/cli.mjs --scene tools/object-gate/specs/zone-b/tower-hero-vision-scene.yaml --out steps/tower-volumes-1012/gate` and `python3 tools/object-gate/lib/oblique.py selftest`
- Still / screenshot: `steps/tower-volumes-1012/sheet-phone.jpg`, `steps/tower-volumes-1012/oblique-sheet.jpg`, `steps/tower-volumes-1012/gate/tower-hero/shadow.json`
- Short video:
- Proposed fix: The sheet copy now walks up to the directory named `gate` and copies `oblique-*.png` there plus `oblique-sheet.jpg` beside it. Relief and oblique already use plane distance. Shadow sampling and the 2–8 plane window are still open.
- No secrets, API keys, tokens, or private style prompts: yes

Open upstream when this branch is the one you want reviewed: https://github.com/StarBoltSprint/boltverse-odyssey/issues/new?template=tool-feedback.yml

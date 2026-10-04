# [tool-feedback] playcheck missed a floating foot, a black face, and a stair crown

- Tool: tools/playcheck
- Tool version / commit: 1dbd768 (main before this branch). The rows added on tools-learn-20261004 are 969e23e and 86e9365.
- Take / branch + commit: tools-learn-20261004, zone A play at 1dbd768
- Defect seen on screen: a ruin foot floated about 1.37 m above the downhill relief. Enlarged wreck faces read as pure black. Close hull and monolith faces sat above magnification 1, and a monolith crown was stair-stepped.
- Tool metric vs measured: `black_regions` stayed quiet on a jagged or flat face. No row read the framebuffer gap. `fix_hint` stayed PASS and named only the worst hit. `info().seats` reported gate footGap 1.371 m with 106 skirts, which is the skirt drop. `03-gate-base.jpg` now passes `foot_contact`. `04-gate-top.jpg` fails `untextured` (flat area 0.073) and `stair_crown` (4 runs, jump 5 px). Hangar proof distance 0.987 m is mag 25.954 on the 70.03 texels/m wreck skin.
- Reproduce: `python3 tools/frames/check.py --list` the zone A proof set in `docs/reports/tools-learn-20261004/zone-a-frames.md`. Live rows: `cd tools/playcheck && node --test src/frames.test.mjs`.
- Still / screenshot: `packs/zone-a/proof/step4c/03-gate-base.jpg`, `04-gate-top.jpg`, `02-hangar-inside.jpg`
- Short video: none
- Proposed fix: shipped in this branch. `foot_contact`, `untextured`, `mag_hotspots`, and `stair_crown` fail the walk. `black_regions` and `fix_hint` stay as they were. Do not enlarge the current texture.
- No secrets, API keys, tokens, or private style prompts: yes

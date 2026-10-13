# [tool-feedback] volume stepFrac cannot see a 4.5 cm groove

- Tool: tools/gate volume
- Tool version / commit: 9b5067d7
- Take / branch and commit of the game being tested: zd/02-rune-pillar, build 9b5067d705ad1fd94e8e64b5c23981ce4d4a947b
- Defect seen on screen: The slimmed rune pillar reads as an octagonal shaft with carved amber runes in `steps/zone-d/02-rune-pillar/object-gate-v1/oblique45.jpg` and `grazing.jpg`. The volume row still FAILs.
- Metric the tool reported vs what was actually measured: `python3 -m tools.gate volume` wrote stepFrac 0.0217 (oblique) and 0.001 (grazing), both under 0.03, and normSpread 0.604 and 0.5667, both over 0.15. `JUMP_M` in `tools/gate/volume.py` is 0.25 m. The carved grooves measure 0.045 m. A 4.5 cm groove cannot produce a 0.25 m depth jump, so stepFrac stays under the bar on a shaft that is not flat.
- How to reproduce: `python3 -m tools.gate volume steps/zone-d/02-rune-pillar/object-gate-v1` on `oblique45-pass.npz` and `grazing-pass.npz` (those arrays were deleted after the run; the numbers are in `volume.json`).
- Still / screenshot: `steps/zone-d/02-rune-pillar/object-gate-v1/oblique45.jpg` and `grazing.jpg`
- Short video: none
- Proposed fix: Keep normSpread as the flat-face row. Report stepFrac against a jump on the order of the relief (a few centimetres), or split “large step” from “not a flat face” so a 3–6 cm groove is not an automatic FAIL.
- Confirmation: no secrets, API keys, tokens, or private style prompts: yes

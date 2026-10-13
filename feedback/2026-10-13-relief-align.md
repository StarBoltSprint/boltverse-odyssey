# [tool-feedback] relief alignment recall is swamped by albedo edges

- Tool: tools/common/align score, called by tools/object-gate/lib/analyze.py relief_align
- Tool version / commit: 9b5067d7
- Take / branch and commit of the game being tested: zd/02-rune-pillar, build 9b5067d705ad1fd94e8e64b5c23981ce4d4a947b
- Defect seen on screen: Amber rune strokes sit in 4.5 cm grooves on the front face (`front-8m.jpg`). The alignment row still FAILs.
- Metric the tool reported vs what was actually measured: Beauty pair overlap 0.0629 (ok false, bar 0.70). precisionRelief 0.6684, precisionTexture 0.0629, 8301 groove edges against 90415 albedo edges. Amber-mask pair overlap 0.0838, 8301 against 39765. The same mesh has 223/256 grooved vertices (0.871) whose stored UV samples the amber mask, depth 0.045 m. `alignment` is `min(edge precision, edge recall)` at 2 px, so the extra Canny edges in the photo force recall under the bar.
- How to reproduce: `python3 tools/object-gate/lib/analyze.py relief_align '{"relief":"steps/zone-d/02-rune-pillar/object-gate-v1/front-8m-relief.jpg","albedo":"steps/zone-d/02-rune-pillar/object-gate-v1/front-8m.jpg"}'`
- Still / screenshot: `steps/zone-d/02-rune-pillar/object-gate-v1/front-8m.jpg` and `front-8m-relief.jpg`
- Short video: none
- Proposed fix: Score groove edges against the amber mask inside the subject, and keep the 0.70 bar. Do not compare a groove mask to every edge in the stone photo.
- Confirmation: no secrets, API keys, tokens, or private style prompts: yes

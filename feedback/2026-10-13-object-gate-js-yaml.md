# [tool-feedback] visible-shot cannot import js-yaml

- Tool: tools/object-gate visible-shot.mjs (imports tools/object-gate/gate.mjs)
- Tool version / commit: 9b5067d7
- Take / branch and commit of the game being tested: zd/02-rune-pillar, build 9b5067d705ad1fd94e8e64b5c23981ce4d4a947b
- Defect seen on screen: The 8 m front frame is a real pillar (`front-8m.jpg`). The official node sharpness command does not start.
- Metric the tool reported vs what was actually measured: `node tools/object-gate/visible-shot.mjs` exits with `ERR_MODULE_NOT_FOUND: Cannot find package 'js-yaml' imported from tools/object-gate/gate.mjs`. `NODE_PATH=/usr/share/nodejs` did not resolve it. The python estimator on the same frame returned visiblePxPerM 190.8 against need 154.6 (screenPxPerM 270.7, 286 tiles, kMedian 1.419).
- How to reproduce: `node tools/object-gate/visible-shot.mjs` from this worktree. The working substitute is `python3 tools/object-gate/lib/analyze.py visible_px '{"img":"steps/zone-d/02-rune-pillar/object-gate-v1/front-8m.jpg","screenPxPerM":270.7}'`.
- Still / screenshot: `steps/zone-d/02-rune-pillar/object-gate-v1/front-8m.jpg`
- Short video: none
- Proposed fix: Stop importing `js-yaml` from the visible-shot path, or declare the dependency so Node can resolve it. The python `visible_px` function already measures the frame.
- Confirmation: no secrets, API keys, tokens, or private style prompts: yes

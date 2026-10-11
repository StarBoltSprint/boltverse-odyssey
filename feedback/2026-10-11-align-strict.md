# [tool-feedback] alignment 0.70 passed a striped tower

- Tool: other — tools/common/align/metrics.py
- Tool version / commit: b909c46e
- Take / branch + commit: scene-strict-1011, parent b909c46e
- Defect seen on screen: The week-2 phone sheet shows the Grok tower as horizontal stripes and the MoGe-2 tower in pieces. Neither looks like the key tower.
- Tool metric vs measured: `score()` alignment was 0.704–0.743 (bar 0.70, would pass). `strict_score` on the same jpgs is 0.0421, 0.3073, 0.000, 0.000, 0.2501. The sheet crops are strict 0.0.
- Reproduce: `python3 tools/common/align/selftest.py` (striped and fragmented cases must fail). Numbers in `steps/scene-strict-1011/strict-before.json`.
- Still / screenshot: `steps/week2-1011/sheet-phone.jpg` (copied to `steps/scene-strict-1011/sheet-phone.jpg`)
- Short video:
- Proposed fix: Keep `alignment` for the gate overlap row. Block on `strict` (stripe FFT, outline continuity, edge orientation, one vision yes/no). Done in this step. Do not lower the 0.22 stripe divisor.
- No secrets, API keys, tokens, or private style prompts: yes

# [tool-feedback] placement loss walked the camera up the dune

- Tool: other — tools/common/align/apply_scene.py
- Tool version / commit: b909c46e
- Take / branch + commit: scene-strict-1011, parent b909c46e
- Defect seen on screen: The search’s best frame (`r0-2`) looks into the dune wall. The seed frame had more sky and a higher mask IoU.
- Tool metric vs measured: Loss 2.7021 beat the seed loss 3.016. IoU fell from 0.3182 to 0.2909. Sky top fell from 0.437 to 0.3676 (key 0.5741). Inversions fell from 18 to 14, and that term dominates the loss.
- Reproduce: `SCENE_ROUNDS=3 python3 tools/common/align/apply_scene.py`. Log `steps/scene-strict-1011/frame-log.jsonl`. Best row in `placement-numbers.json`.
- Still / screenshot: `steps/scene-strict-1011/best-wide.png`
- Short video:
- Proposed fix: Stop a trial when sky leaves the 0.1 band instead of trading it for fewer inversions. Not changed this step. The 3-round cap was kept and the bars were not loosened.
- No secrets, API keys, tokens, or private style prompts: yes

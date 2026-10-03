# [tool-feedback] walkaround hole gate counts opaque dark rock as a hole

- Tool: tools/walkaround (foreground_mask / interior hole fraction)
- Tool version / commit: db4f6c5 (walkaround was not edited this step)
- Take / branch + commit: zone-a-step3-rocks, parent db4f6c5
- Defect seen on screen: none. The stone plates are opaque. The gate refused the hull before play.
- Tool metric vs measured: hole fraction 0.024–0.074 on all eight horizontal views. Alpha holes on the same plates were 0. Every flagged pixel had max RGB channel ≤ 10.
- Reproduce: carve a keyed dark subject with the default bgThreshold 0.04. `python3 tools/walkaround/build.py` then read `qc/report.json` interior holes. The rock config that passes sets `bgThreshold` to -1.
- Still / screenshot: no hole-mask frame was kept. The passing stone hull is `packs/zone-a/src/rocks/stone/`.
- Short video: none
- Proposed fix: when alpha is already keyed, count a hole only where alpha is low. Do not treat a dark opaque texel as background. Add a selftest subject that is opaque black on a transparent ground.
- No secrets, API keys, tokens, or private style prompts: yes

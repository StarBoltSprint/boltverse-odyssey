# [tool-feedback] backdrop seam missed cloned sky columns and dark green edges

- Tool: tools/assetcheck
- Tool version / commit: db693e5
- Take / branch + commit: take 10d, local cli/take10d, final 0bb54c1 (not on this remote)
- Defect seen on screen: Installed sky slices ended in cloned or mirrored trailing columns, and the chain did not close. Keyed ship views kept a dark green edge band. A later living sky of one short loop would repeat a flash on a fixed period.
- Tool metric vs measured: Kind `backdrop` reported seam and magnification and did not report a trailing clone. Join content MAE reached 40.94 against a limit of 4. One slice swung column luma by 62 against a limit of 6. The key row reported 0 bright-green pixels. A 3 px edge band was 35–98% green (G > max(R, B) + 6). No row reported a repeat period.
- Reproduce: `python3 tools/assetcheck/check.py` kind `backdrop` on the take sky, and kind `cutout` on the take ship views. Those stills are not stored in this repo. The red cases now live in `python3 tools/sky/selftest.py` and `python3 tools/assetcheck/selftest.py` (`edge_green_despill`).
- Still / screenshot: not stored
- Short video:
- Proposed fix: Shipped on this branch. `tools/sky/check.py` gates clone, mirror, join, swing, close, combined repeat, offsets, and perceived repetition. `check_alpha` fails the dark edge band. `despill.py` clamps G and erodes alpha 1 px.
- No secrets, API keys, tokens, or private style prompts: yes

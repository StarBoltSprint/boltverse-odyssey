# [tool-feedback] playcheck named mag_max and not the object to move

- Tool: tools/playcheck
- Tool version / commit: db693e5
- Take / branch + commit: take 10d attempt 3, local cli/take10d 0bb54c1 (not on this remote)
- Defect seen on screen: At a stop the ship filled the frame. The hero crop was a small part of the subject.
- Tool metric vs measured: `mag_max` failed at 3.668. `hero_visible` was 0.31. The row did not name the object, the stop, or a distance that would bring magnification back to 1.
- Reproduce: `node tools/playcheck/run` on that take. The framebuffer is not stored in this repo. `cd tools/playcheck && npm test` covers `fix_hint` with object `ship-hero`, stop `stop-gate`, mag 3.668, dist 4.2, heroVisible 0.31.
- Still / screenshot: not stored
- Short video:
- Proposed fix: Shipped on this branch. Row `fix_hint` is report-only. It names the object and stop and a farther camera or a smaller scale. It does not change PASS or FAIL.
- No secrets, API keys, tokens, or private style prompts: yes

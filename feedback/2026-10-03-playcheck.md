# [tool-feedback] play canvas screenshot hangs

- Tool: tools/playcheck
- Tool version / commit: 2458b89 (playcheck was not edited in this step)
- Take / branch + commit: zone-a-step1-ground, 6afb2a2
- Defect seen on screen: the play view was up and drawing. `page.screenshot` never returned a PNG.
- Tool metric vs measured: the call was given 30 s, then 60 s, and both timed out after "fonts loaded". `canvas.toDataURL("image/png")` returned a 720×1600 PNG in the same page. Console errors: none.
- Reproduce: serve the repo with `python3 -m http.server` on 127.0.0.1, open `packs/zone-a/play/index.html?debug=1` in headless Chrome with the flags in `tools/playcheck/src/browser.mjs` (`--use-gl=angle --use-angle=swiftshader`), viewport 360×800 deviceScaleFactor 2, then `page.screenshot`. The same hang is what `tools/playcheck/src/walk.mjs` calls.
- Still / screenshot: `packs/zone-a/proof/step1/02-wide.png` (captured with `toDataURL`, not `page.screenshot`)
- Short video: none
- Proposed fix: if `page.screenshot` rejects or exceeds its timeout, read the play canvas with `toDataURL` and write that PNG. Keep the screenshot path for pages that are not a WebGL canvas.
- No secrets, API keys, tokens, or private style prompts: yes

# [tool-feedback] renderlint flags a depth attachment and one-time STATIC_DRAW

- Tool: tools/playcheck (renderlint) and tools/perf
- Tool version / commit: playcheck sources unchanged on this step. Checkout `archives-shards` at the zone A perf commit (the play files changed; `tools/playcheck/src/renderlint.mjs` did not).
- Take / branch + commit: `archives-shards`, zone A performance pass, 2026-10-04
- Defect seen on screen: none from these findings. The phone picture is the same depth test and the same static meshes. Spawn stays mag 0.998, 12 draws, 254.370 MiB.
- Tool metric vs measured: `render_source` FAIL, findings=5. Measured: `terrain.js` lines 599–600 set `NEAREST` on a `DEPTH_COMPONENT24` texture attached as `DEPTH_ATTACHMENT`. Lines 256 and 512, and `rocks.js` line 231, call `bufferData` once at load with `STATIC_DRAW`. Law 65 forbids `NEAREST` on a world colour texture and a new typed array inside `bufferData` every frame. The depth attachment is not a world colour. The three uploads are not per frame.
- Reproduce: `node tools/playcheck/src/renderlint.mjs packs/zone-a/play/terrain.js packs/zone-a/play/rocks.js` after `npm install` in `tools/playcheck`. Live row: `tools/playcheck/run --url http://127.0.0.1:8766/packs/zone-a/play/index.html?intro=0 --layout packs/zone-a/clearing.json --no-video --source` each play `.js`.
- Still / screenshot: `/workspace/grokcli/out/zoneA-perf/spawn-chase.png` (720×1600 spawn chase). The findings are in source, not in that picture.
- Short video: none (`--no-video`).
- Proposed fix: skip `nearest_world` when the same texture is created with `DEPTH_COMPONENT` or attached as `DEPTH_ATTACHMENT`. Skip `buffer_rebuild` when the typed array is created once and uploaded with `STATIC_DRAW` outside the frame function. Keep the fail for `NEAREST` on ground, sky, props, hull views, and video, and for a new typed array inside the frame.
- No secrets, API keys, tokens, or private style prompts: yes

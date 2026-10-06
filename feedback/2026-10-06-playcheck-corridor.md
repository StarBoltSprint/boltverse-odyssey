# [tool-feedback] playcheck cannot script the corridor pack

- Tool: tools/playcheck
- Tool version / commit: main `4857447` (the tool is unchanged on this branch)
- Take / branch + commit: `cursor/corridor-smooth-mag-36f5`, corridor magnification and chase
- Defect seen on screen: none from the tool. The corridor page draws. The tool never reached it.
- Tool metric vs measured: playcheck requires `window.__play` and a clearing layout. `packs/corridor-ab/play` sets `window.__corridor` and walks waypoints. The historical rows 2.09 and 1.42 were a zone A ground reading. On this chase, headings 82° and 127° at the sprint start measure ≤ 1 (`packs/corridor-ab/proof/smooth/after.json`). A first in-repo sweep also reported ruin magnification in the hundreds at 0.05 m; that was an AABB floor in the sweep, fixed in `packs/corridor-ab/play/mag.js`, not a playcheck row.
- Reproduce: `tools/playcheck/run --url http://127.0.0.1:8765/packs/corridor-ab/play/index.html --layout packs/zone-a/clearing.json` has no `__play` hook to drive. Unit tests: `node --test tools/playcheck/src/*.test.mjs` — 49 pass, `ruinwalk.test.mjs` fails with `Cannot find module 'playwright-core'`.
- Still / screenshot: `packs/corridor-ab/proof/smooth/sprint-start.jpg`
- Short video: `packs/corridor-ab/proof/smooth/sprint.mp4`
- Proposed fix: a linear-path mode that reads `window.__corridor` (along, heading, boom) and does not invent a clearing. Until that exists, the corridor mag table is `node packs/corridor-ab/play/measure-mag.mjs`.
- No secrets, API keys, tokens, or private style prompts: yes

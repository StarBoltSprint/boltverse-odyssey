# Take note — glacier horizon — 2026-11-17

Engine gate, not a cook. `tools/quota/quota.py` was not run. No KEEP.

## This step

- Step: close the glacier horizon line, the right-shoulder ditch, and the near flat snow sheets.
- Accepted because: `node engine/webgpu/glacier/horizon-gate.mjs` PASS. horizon_closed 0.9986 / 1 / 1. Shoulder drop 0.104 m. Sheets 0. Caps 0. CPU tris 199266. Page tris 199898. Texel PASS.
- Recipe appended: none. The gate is `engine/webgpu/glacier/horizon-gate.mjs`.
- Failure appended: `learn/failures.md` heading `2026-11-17 — Glacier horizon line is a dithered far face plus a vertical snow crest`.

## Biggest waste

The first berm was tall enough to hide the one-pixel crest and then failed grey_bright at 0.161. Shortening it brought the crest back as the top edge. The kept height is 34 m at z=-340. The tonemap gate still misses three checks by a few thousandths. Limits were not moved.

## Reuse next time

- Do not bury a vertical sheet's foot and expect the crest to move.
- A material inside the LOD dither cannot close the eye-level row past 180 m.
- Page tris can sit ~600 above the Node count because `Math.sin` changes the ground step loop. Budget against the page number.

## Added this take

- New recipes: none.
- New failure entries: the horizon crest entry above.

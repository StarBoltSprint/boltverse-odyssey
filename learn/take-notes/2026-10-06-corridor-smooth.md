# Take note — corridor smooth — 2026-10-06

## Quota and turns

No Imagine session ndjson. `python3 tools/quota/quota.py` was not run. Image generations 0. Video generations 0. The sprint clip is a screen recording of the existing play page.

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| corridor mag sweep and chase trace | other | one sweep before, one after | 0 generations | accepted |
| gate plate switch, rock cone, hull gradients | other | one | 0 generations | accepted |
| arch, wreck, gate inside 10 m, four boulder headings | other | listed | 0 generations | left for Imagine |

## This step

- Step: corridor magnification and chase smoothness (`packs/corridor-ab/proof/smooth/`).
- Accepted because (command, row, numbers): `node --test packs/corridor-ab/play/*.test.mjs` pass. Headings 82° and 127° at the sprint start stay ≤ 1. Gate row at 16.6 m ≤ 1. Camera trace spikes 0, max step 0.599 m, max work 4.07 ms, straight-run boom ≥ 5.742 m. Phone line on the stills: drawCalls 7, texMB 184.5, activeVideos 4.
- Recipe appended (path, or `none`): none. No Imagine prompt was sent.
- Failure appended (heading in `learn/failures.md`, or `none`): 2026-10-06 ruin magnification floored at 5 cm; gate elevation stayed up until magnification 3; world-space chase ease collapsed the boom; sky draw referenced a hidden yaw.

## Biggest waste

The first chase ease treated Bolt’s turn as an error to smooth, so the boom collapsed and the trace still reported zero spikes. The allow bound was the full orbit, which hid the miss. The rigid-parent split is the row that catches it.

## Reuse next time

- Recipes to copy: none new. Chase constants stay `CHASE_BOOM` 6.1, `CHASE_EYE` 3.5, `CHASE_SLIDE` 0.9. Boom cap 7.45 m is the lower-third line.
- Library ids to place (`tools/library`), instead of recooking: the sealed gate plate, arch, wreck, and 512² rock views. Do not enlarge them in code.
- Failures that would have caught this take earlier: the 5 cm AABB floor, and a boom floor on the scripted turn.

## Added this take

- New recipes: none.
- New failure entries: the four headings dated 2026-10-06 in `learn/failures.md`.
- Tool note: `feedback/2026-10-06-playcheck-corridor.md`. Playcheck cannot script this pack. The mag table is the node sweep.
- Preview: freeze after the commit, zone-a play tree, because the ruin shader and the hull sampler changed. `previews/` stays gitignored.

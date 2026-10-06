# Take note — phone frame — 2026-10-06

## Quota and turns

No ndjson for this step. Image generations: 0. Video generations: 0. `tools/quota/quota.py` was not run. No quota row was invented.

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| phone frame, far spawn, sprint density | other | code and headless captures | 0 image gens | accepted |

## This step

- Step: portrait chase, rock bases under the plane, far-only spawn, density with sprint duration, French HUD.
- Accepted because: `node --test tools/adventure/adventure.test.mjs packs/corridor-ab/play/*.test.mjs packs/common/archives/codex.test.mjs` — 64 pass, 0 fail. `packs/corridor-ab/proof/phone-frame/REPORT.md` Verdict: PASS. Body screen 0.500, 0.761. Rock base hi −0.35, lo −0.682. Draws 7, 184.5 MB, videos ≤ 4. Long-sprint rocks 17 → 45 while charge 0 → 0.75.
- Recipe appended: none. No Imagine prompt was sent.
- Failure appended: "the chase slide parked Bolt inside the joystick" and "rocks were born in the near field and rose into view" in `learn/failures.md`.

## Biggest waste

The headless page died on `Failed to fetch` for `wreck.ruin` while Chrome’s bundled Docs offline extension sat on the network. The same page loaded once that extension was disabled. The capture script is not in the repo.

## Reuse next time

- Recipes to copy: none new. Far spawn and the 24 s charge ramp are in `packs/corridor-ab/play/stream.js` and `look.js`.
- Library ids to place: none. Existing hulls and ruins.
- Failures that would have caught this take earlier: the two rows appended today.

## Added this take

- New recipes: none.
- New failure entries: the slide row and the near-birth row, 2026-10-06.

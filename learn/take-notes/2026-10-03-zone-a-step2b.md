# Take note — zone A step 2b — 2026-10-03

Status of the sky look: IN TEST. Owner phone QC is still open. This note records the cook that the gates measured. It is not an owner KEEP.

## Quota and turns

`python3 tools/quota/quota.py` was not run. No session ndjson was in the cook log for this headless run. The numbers are not invented.

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| Howling Eclipse sky ring | sky | horizon diptychs stopped after one crop each; upper slice 3 mirror left listed | not measured | IN TEST |

## This step

- Step: zone A step 2b, living sky, branch `zone-a-step2-sky`, commit `25dd00d`.
- Accepted because (command, row, numbers): `python3 tools/sky/check.py --manifest packs/zone-a/src/sky/sky.json` PASS, failures 0. Horizon mag 0.9822, upper 0.9326, high 0.9822, cap 0.9009, stars/dust/nebula 0.7921. Combined repeat 62959 s. Play snapshot mag_max 0.982, activeVideos 4, drawCalls 7, texMB 219.9, console errors 0. Loop-restart sky MAE about 1.0. `tools/sky/selftest.py` PASS. Root `npm test` PASS. `tools/playcheck` `npm test` 43 pass, 0 fail.
- Recipe appended (path, or `none`): `learn/recipes/zone-a-sky-ring.md`.
- Failure appended (heading in `learn/failures.md`, or `none`): `2026-10-03 — a centre splice and a heavy tile mix both passed the old sky edge gate`.

## Biggest waste

The first join cut the middle of each pair, so the file gate read a clean edge while the picture had a hard splice. Recooking the whole ring was the wrong next move. Cropping the outer edges and dropping the tile gain fixed the lattice. Heading 0 is still two cloud banks meeting.

## Reuse next time

- Recipes to copy: `learn/recipes/zone-a-sky-ring.md` and `docs/METHOD/sky.md`.
- Library ids to place (`tools/library`), instead of recooking: none for this sky.
- Failures that would have caught this take earlier: the centre-splice entry above. The edge stamp still hides a content mismatch at heading 0. That hole is `feedback/2026-10-03-sky.md`.

## Added this take

- New recipes: `learn/recipes/zone-a-sky-ring.md`.
- New failure entries: centre splice and heavy tile mix, 2026-10-03.
- Preview freeze: not run. `tools/preview/freeze.py` requires `Verdict: PASS` in REPORT. This step stays IN TEST because heading 0, the zenith, and upper slice 3 are still visible defects.

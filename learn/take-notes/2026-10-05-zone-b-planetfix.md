# Take note — zone B planet fix — 2026-10-05

## Quota and turns

The quota tool row is copied below. Its zeros are the matcher miss in `learn/failures.md` (2026-10-04, quota.py ignores tool_started). This step spent 3 image calls and 2 video calls. One image slot was left unused.

| Date | Step | Commit | Turns | Tool calls | Image gens | Video gens | Tokens in | Tokens out | Wall s | Log |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-05 | zone-b-planetfix | 857ac3c | 0 | 0 | 0 | 0 | n/a | n/a | 2534.9 | events.jsonl |

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| Ringed planet video and two moons | cutout | 3 images, 2 videos | session log above; real count 3 and 2 | accepted |
| Second still, asked to turn the clouds | cutout | 1 edit | counted in the 3 | rejected, slot left unused after it |
| First video, ends only | cutout | 1 video | counted in the 2 | rejected |

## This step

- Step: zone B planet fix. Cook commit `857ac3c`.
- Accepted because: phone pair dt 3.830 s (1.415 → 5.246), videos 4, scale 0.5625, aspect 1.7777778 / 1.7777778, projected 752.14×423.08, presented mag 0.9818, pitch −3.81°. Root npm test exit 0. playcheck npm test 43 pass. Report `packs/zone-b/proof/planetfix/REPORT.md` says Verdict: PASS. The pack stays IN TEST until the owner looks at the phone.
- Recipe appended: `learn/recipes/zone-b-planet-card.md`.
- Failure appended: still planet card, loop-wrap proof pair, hard key and world-up card.

## Biggest waste

The first video held still because only the ends were pinned, and one edit did not turn the clouds. That miss is `learn/failures.md` 2026-10-05, a planet card stays a still. The proof then lost a pair when the 6 s loop wrapped.

## Reuse next time

- Recipes to copy: `learn/recipes/zone-b-planet-card.md`. Pin a mid keyframe. Face the card to the camera. Key from green excess. Proof captures omit `debug=1`.
- Library ids to place: none. This card is the zone B sky.
- Failures that would have caught this take earlier: the 2026-10-05 still-card entry, and the 2026-10-04 neighbour-key entry.

## Added this take

- New recipes: `learn/recipes/zone-b-planet-card.md`.
- New failure entries: three, dated 2026-10-05, at the bottom of `learn/failures.md`.
- Geometry: no change. Horizon and plate measures were not recooked. Elevation 13° is the chase fit for this card, recorded in `docs/METHOD/sky.md`.
- Owner taste: four FAIL rows, 2026-10-04 23:16 through 23:24, in `learn/taste.md`.
- Preview: `python3 tools/preview/freeze.py --zone zone-b --commit 857ac3c` exited 0. Page `previews/zone-b/index.html`. Loopback only. `publicUrl` stays null.

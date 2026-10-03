# Zone A step 2c — steady camera and sky retouch

Director visual QC 2026-10-03 (412×915 CSS): **FAIL, not merged.** Camera PASS: a 4 s gallop over relief keeps Bolt fixed in frame, and eye-height jerk dropped from 0.25 to 0.02 m per tick. Lighter PASS: download about 70 → 33 MB, ready at 10 Mbps 54 → 28 s, texMB 220 → 203. Blockers: the failed slices are unchanged, with seams and repeats at 0, 90, 180 and 330. Living sky is still not visible: same-view sky difference is about 1.3/255 over 12 s with the videos playing. The keyed corona tile draws a second, large, dark eclipse disk in the sky above the painted one at 285 (it also shows behind Bolt on the crest). There is a hard band line looking up 45° at heading 0, and the dark well at the zenith remains.

Camera chase no longer snaps between boom candidates. The failed horizon and upper slices were not replaced: two horizon outpaints of the same continuation were rejected, then stopped. A keyed corona loop is the visible sky motion. Opaque slices are lossy-encoded. Status stays IN TEST.

Checked: `python3 tools/sky/check.py` FAIL — 13 motif rows on the unreplaced step-2b slices (horizon 0–4 and 7 repeat; upper 2, 3, 4 mirror; upper 4 and 7 copy). Horizon 5 and 6, upper 0, 1 and 5, and all eight high slices pass that gate. Upper 6 is the known miss (soft gap, score under the threshold). Display mag: horizon 0.982, upper 0.987, high 0.982, cap 0.989, video tiles 0.792. Combined repeat 71643 s. Layers pass the loop row. `python3 tools/sky/selftest.py` PASS. Root `npm test` PASS. `tools/playcheck` `npm test` 43 pass, 0 fail. Play at 412×915 CSS, DPR 2: mag_max 0.989, activeVideos 4, drawCalls 7, texMB 202.7 (was 219.9), `packs/zone-a/src` 42.7 MB (was 79.3 MB), first sky frame about 1.7 s, console errors 0. Camera proof from the earlier commit: 6.0 s, relief 1.945 m, eye step max 0.148 m, pitch step max 0.200 deg/frame, jerk max 0.028 m/frame³, spikes 0. Corona frame pair sky MAE 1.04, peak 217, loop-restart pair MAE 0.81. `git diff a3a5bb3 -- lock/` empty.

Known issues: headings 0, 90, 180 and 330 still show the step-2b repeated clouds and seams. Stars and dust motion stays faint. No shooting-star layer (a short loop would fail the 60 s row, and a fourth sky decoder is over the phone cap). Straight up, the cap painting's dark centre remains. The corona is one tile, not a full-dome veil.

Screenshots (canvas phone view, JPEG):

- `packs/zone-a/proof/step2/hdg-0.jpg` — heading 0
- `packs/zone-a/proof/step2/hdg-90.jpg` — heading 90
- `packs/zone-a/proof/step2/hdg-180.jpg` — heading 180
- `packs/zone-a/proof/step2/hdg-285.jpg` — eclipse azimuth
- `packs/zone-a/proof/step2/up-45-285.jpg` — look up 45°
- `packs/zone-a/proof/step2/zenith.jpg` — straight up
- `packs/zone-a/proof/step2/crest-285.jpg` — high ground, heading 285
- `packs/zone-a/proof/step2/ring-contact.jpg` — slice contact sheet
- `packs/zone-a/proof/step2/corona-a.jpg` and `corona-b.jpg` — same view about 1.2 s apart
- `packs/zone-a/proof/step2/motion-diff.jpg` — frame difference of that pair
- `packs/zone-a/proof/step2/loop-a.jpg` and `loop-b.jpg` — corona loop ends

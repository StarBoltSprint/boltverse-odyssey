# Zone A performance pass

Goal: bring zone A play under the phone caps without quality loss (law 65).

Done when:

1. Spawn chase at 720×1600 reports drawCalls ≤ 12 and texMB ≤ 256 (texture_mem PASS), activeVideos ≤ 4.
2. The same caps hold on a frame that shows the gate film.
3. Magnification stays ≤ 1. Visible layers, Imagine files, and loop frame rates stay.
4. Root `npm test` and `tools/playcheck` `npm test` pass.
5. Stills: spawn chase and one menu open.

# tools/04-playcheck-log

Verdict: PASS

Playcheck places library collision boxes from local coordinates through the zone pose (scale, yaw, translation, ground snap) and writes an approach-run log. A circle clearing with no `parts` array does not grow those rows.

No Imagine. No push. No merge.

## Measured

| # | Check | Result | Numbers |
| --- | --- | --- | --- |
| 1 | Good fixture `fixture/approach/good.json` | PASS | 21 samples, every collision `miss`, facing 90, foot at the arch distance 1.2 m, camera `near`, fps 30, jamb min y 0 after snap from y 0.4. Yaw 90 scale 2 box lands at x 8–12, y 0–4, z 2–6. |
| 2 | Bad collision | FAIL | `world_boxes` that are not the transformed library boxes set `bad_collision`. A box with min above max does the same. `ground_anchor`, `hanging_clearance`, and `approach_log` stay PASS on the shifted-box case. |
| 3 | Float (`ground_anchor` miss) | FAIL | Anchor left at y 1.5 with snap off. A library part with the anchor removed also fails. The other three rows stay PASS on the float. |
| 4 | Missing clearance | FAIL | `hanging: true` with no hanging box. A path that omits `min_clearance_m` while a lintel crosses the run also fails `hanging_clearance`. |
| 5 | Clearance too tight | FAIL | Lintel underside 1.0 m, required 2.0 m. The body records a hit. `part_colliders` stays PASS (the lintel is visual). |
| 6 | Invisible wall | FAIL | `keepout` box in the opening. `part_colliders` FAIL, `invisibleHits` > 0, ground and clearance stay PASS. |
| 7 | Approach-log schema | FAIL on a bad line | Dropped `fps`, `cameraLayer` `hud`, `collision` `blocked`, and `fps` -1 all fail `approach-run/1`. The good log parses, 21 records. |
| 8 | Package tests | PASS | `cd tools/playcheck && npm test` exit 0. 66 pass, 0 fail, about 205 s. Ruin walk included (sweeps `invisible` 0). |

## What a placed run writes

`approach.jsonl` next to the report when the layout schema is `zone-placement/1` or the file has `parts`. Each line is `approach-run/1`: timestamp, position, facing, nearestPartId, distance, collision (`hit` or `miss`), cameraLayer (`near` under 24 m, `mid` under 64 m, `far` from 64 m), fps.

Rows added only for that layout: `part_colliders`, `ground_anchor`, `hanging_clearance`, `approach_log`.

## Left

Phone preview was not frozen. This step has no zone play tree. `tools/preview/freeze.py` needs a play directory and a commit, and copying `packs/zone-a/play` would label an unrelated page as this step.

No commit was made.

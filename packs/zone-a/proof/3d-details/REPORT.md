# Zone A — Echo Shards and small details as hard objects

Verdict: PASS

The six Echo Shards and the six busiest small-detail types are lofted solids. Pickup and Archives still work. Phone rows on the live walk stay inside the cap.

## Done when

| Row | Result |
| --- | --- |
| Six shards, one solid, pickup and Archives | PASS. `solid: true`, placed 6, colliders `[]`. Standing on pulse-birth marks it found. Archives opens `1 of 6`. The card still uses `crystal.png`. |
| Six detail types as solids | PASS. cluster, crest, pile, slab, micro shard, tuft. Cards left: ridge 106, pebble 46. Detail draws stay 2. |
| Two angles about 90° | PASS. gate-memory at 30° and 120°, 4.5 m. Cluster at 0° and 270°, 4.2 m. Both pairs presented mag 0.998. |
| Root tests and playcheck | Root `npm test` exit 0. `tools/playcheck` `npm test` 56 pass, including ruinwalk (gallop blocked 0, invisible walls 0). Live `tools/playcheck/run` exit 1. See below. |
| Budget | drawCalls 12, texMB 254.370, textureBytes 266726474, activeVideos 4. texture_mem PASS (max 268435456). |

## Live circle walk

`tools/playcheck/run --url http://127.0.0.1:8766/packs/zone-a/play/index.html --layout packs/zone-a/clearing.json --no-video` exits 1. 25 pass, 10 fail.

Rows this step owns, all PASS: `texture_mem`, `draw_calls`, `active_videos`, `video_decoders`, `solids_world_locked`, `single_bolt`, `single_hero`, `foot_contact`, `black_regions`, `mag_hotspots`, `idle_gallop_switch`, `fps_avg`, `fps_1low`, `frame_ms`.

`mag_max` is 1.644 at `04-stop-270`. The split at heading 127 is wreck 1.356, detail 0.646, archives 0. Spawn detail mag is 0.331 and archives mag is 0.131. The same 1.644 at `04-stop-270` is already in `packs/zone-a/proof/perf/REPORT.md`. Clearing schema `clearing/1` has no gate ring and no fog band, so `gate`, `fog_band`, `ring_closed`, `stops_visible`, and `collider_eq_visual` fail the same way that report recorded.

`stair_crown` and `untextured` are heuristic hits on the faceted silhouettes (the gate monolith and the new lofts). Sharp corners stay. No recook. `render_source` was not scanned because the walk used an http URL. `node --test tools/playcheck/src/renderlint.test.mjs` passed.

## Proof

Captures: `/workspace/grokcli/out/zoneA/3d-details/shard-a.png`, `shard-b.png`, `detail-a.png`, `detail-b.png`, and `proof.json`.

## Known issues

- Ridge, pebble, rock pebbles, ground families c0–c2, and far flecks stay cards.
- Crest depth comes from the plan. The front plate matches the side.
- The pile is one rectangle at 0.4 times its width. The top plate touches the frame.
- The cluster is a rectangle. Its top plate was unusable.
- The micro shard is a thin rectangle. Its front plate was rotated 90°.
- Tuft depth is 0.4 times the side width. Front and top were not orthographic.
- Caps sample the side plate. The top plate is not on the GPU. Opposite faces mirror one plate.
- The crystal skin was scaled to 686×761 so the mip chain stays inside the old `crystal.png` budget.
- Imagine budget used 15 images. Two 429s were retried once. No 16th image.

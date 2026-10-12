# tools/03-library-intake

`add` refuses a part unless all six intake guards hold. Visual KEEP alone is not enough. The numbers are the ones on the intake JSON. The command does not open PNGs or meshes. No Imagine. No push, merge, or reset --hard.

Decree brief: `steps/tools/03-library-intake/decree-brief.md`. The local decrees file is absent. Matches 0. No decree was invented.

| # | Done when | Result |
| --- | --- | --- |
| 1 | Art Director KEEP recorded | PASS. Stub `art_director: "KEEP"` is stored. A gate report with `art_director: KEEP` and `verdict: FAIL` is refused (`run verdict is not PASS`). `REVIEW`, or a report with `verdict: PASS` and no KEEP flag, is refused (`art director KEEP is missing`). |
| 2 | Run PASS, not visual KEEP alone | PASS. `run.tool` `object-gate` or `tools/gate` with `verdict: PASS` is stored. `verdict: FAIL` and `tool: visual` with `verdict: PASS` are refused (`run verdict is not PASS`). |
| 3 | Local collision boxes, `ground_anchor`, `min_clearance_m` | PASS. A box with `space: "world"`, a missing box list, a missing `ground_anchor`, and a missing `min_clearance_m` each exit 1. The accepted box is `space: local`, anchor `[0, 0, 0]`, clearance `0.5`. |
| 4 | Camera layer `key` or `approach` | PASS. Missing layer and `gallop` are refused (`missing camera layer`). `approach` and `{id: 05-fixture-solid, kind: key}` are accepted. |
| 5 | lod0/1/2, 0 px outline diff at 15 m and 40 m, triangle counts | PASS. Outline diff 4 px at 15 m and 2 px at 40 m are refused. Missing lod1 `triangles` is refused (`missing per-LOD triangle counts (lod1)`). The accepted chain is 1200 / 400 / 80 triangles and `{15: 0, 40: 0}`. |
| 6 | Textures ≥ 1024 with mipmaps | PASS. `nativePx` 512 and a 2048×512 texture are refused (`texture native pixels 512 < 1024`). `mipmaps: false` and a missing mipmaps flag are refused (`texture has no mipmaps`). 1024 with mipmaps is stored. |
| 7 | Self-tests exit 0 | PASS. `python3 tools/library/selftest_intake.py` exit 0. `python3 tools/library/selftest.py` exit 0 (intake cases, FAIL report still refused, lock WARN still allowed, `fixture-solid` round-trip, path-string layout unchanged). `python3 tools/layout/selftest.py` exit 0. |
| 8 | No push / merge | PASS. Nothing was pushed or merged. HEAD stays `a0676f9f`. The step commit is not made. |

`biome/library/fixture-solid/manifest.json` was regenerated from `build_manifest` so the round-trip matches. The new fields on that fixture are stubs. They are not measurements of the synthetic rock.

## Quota

`python3 tools/quota/quota.py --log <this session events.jsonl> --step tools-03-library-intake --date 2026-10-12`

`| 2026-10-12 | tools-03-library-intake | n/a | 0 | 0 | 0 | 0 | n/a | n/a | 838.9 | events.jsonl |`

The log did not carry turn, tool, or token counts. Image gens 0. Video gens 0.

## Phone preview

`tools/preview/freeze.py` needs a play directory. This step has none. Freeze was not run. Nothing was published.

Verdict: PASS

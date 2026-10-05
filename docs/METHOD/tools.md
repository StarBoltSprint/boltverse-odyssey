# Tools and scripts — what each does, when to use it

Back to [METHOD.md](../METHOD.md). Every tool **measures**; none draws, regrades or replaces a game pixel. Exit 0 = PASS,
1 = FAIL (stop the cook), 2 = cannot run. A hand-written PASS is not a PASS: paste the tool's `report.md` / `report.json`.

## Open-zone tools (`tools/`) — the current game

Order per object (doc 62): `assetcheck` → `objsheet` (+ `preflight`) → `walkaround/build.py` → `layout generate` + `check`
→ `playcheck/run` → `reportview`.

| Tool | What it does | Use it when |
|---|---|---|
| [`tools/decrees`](../../tools/decrees/README.md) | Searches SmiR's local X decrees, writes a cited brief (post id, date, quote) into the step folder. | **Step start**, every step. |
| [`tools/kits`](../../tools/kits/README.md) | Checks a biome kit (`biome/kits/*.json`) against the schema + geometry lock; `show --id` prints it. | Before cooking for a biome; after editing a kit. |
| [`tools/assetcheck`](../../tools/assetcheck/README.md) | Gates every Imagine file before it enters the game: kinds `tile` (seams, exposure, mag), `cutout` (alpha, halo, green edge band), `backdrop`, `loop` (seam MAE, flow), `turntable`. `despill.py` writes a despilled copy. | Every new Imagine still / video. |
| [`tools/sky`](../../tools/sky/README.md) | Sky chain gate: trailing clone/mirror, join MAE ≤ 4, luma swing ≤ 6 per 60°, closed loop, living-layer combined repeat ≥ 600 s. `runtime.js` samples layers. | Every sky slice set and living sky layer. |
| [`tools/objsheet`](../../tools/objsheet/README.md) | One object, one view set: adjacent/opposite consistency, hull keep, edge crop, interior holes. `preflight.py` grades luma, hue, IoU, elevation proxy vs the hero still. | Before any hull build (8-view objects). |
| [`tools/walkaround`](../../tools/walkaround/README.md) | Turns 8 (+top / 3/4) views of one object into a closed invisible hull; sub-objects for thin parts; LOD/impostor options; `qc/report.json`. | Organic objects (rocks, trees), boundary pieces, POIs. Never Bolt. |
| [`tools/mesh3d`](../../tools/mesh3d/README.md) | Real-3D proof on the crashed ship: invisible visual hull + projected Imagine views, coverage / ghost / mag report. Play stills use `LINEAR_MIPMAP_LINEAR`. | Measurement of the hull. TripoSR is not `auto`; `--experiment triposr` cannot feed a play build (see [rejected](rejected.md)). |
| [`tools/hard-objects`](../../tools/hard-objects/README.md) | Howl frigate loft. `python3 tools/hard-objects/rebuild.py` measures the locked plates and writes a hull OBJ. Recipe: [`hard-objects.md`](hard-objects.md). | VALIDATED 2026-10-03 (SmiR, phone). Does not draw, does not skin, does not touch the flight. |
| [`tools/layout`](../../tools/layout/README.md) | Writes and checks `clearing.json`: organic footprint, sub-areas, passages, relief, scatter, cells, `no_ring`, colliders = visuals, mag incl. slope. | Every zone layout. Never hand-type coordinates. |
| [`tools/wfc-path`](../../tools/wfc-path/README.md) | Load-time WFC placement of a straight corridor between two gates. Writes `path-layout.json` (tile ids, waypoints). `world_corridors` maps onto `world.json`. Law: [doc 68](../../biome/docs/68-wfc-path-placement.md). | After the gates exist. Placement only. No mid-run rewrite. No drawn pixels. |
| [`tools/library`](../../tools/library/README.md) | Registers a validated object so another zone places it by id instead of recooking. | After an object passes all gates. |
| [`tools/playcheck`](../../tools/playcheck/README.md) | Rendered-pixel test in headless Chrome: scripted walk, framebuffer rows (mag, hero, gates, no_pop, handedness, WebGL errors, foot gap, untextured faces, mag hotspots, stair crown), `walk.mp4`. `src/renderlint.mjs` = static NEAREST / quality lint. `node tools/playcheck/src/premerge.mjs` audits walk passages and runs the unit tests before a details branch lands. | Every play build (≈ 40 min: start it early). Before merging details onto a gate. |
| [`tools/frames`](../../tools/frames/README.md) | Proof-shot gates for any biome: foot contact, black or untextured faces, sky seams and zenith bands, hard ground lines and voids, stair crowns, brief heroes, magnification hotspots. `--resume` rewrites the report after each image. | After a proof still, before a person looks. |
| [`tools/perf`](../../tools/perf/README.md) | `?perf=1` overlay + the `Perf:` numbers (drawCalls, texMB, activeVideos, jsMs). | Every perf report. |
| [`tools/zoneflow`](../../tools/zoneflow/README.md) | Selftest fixture of clearing → corridor → clearing (preload, crossfade, speed-tied rate). Runtime: `biome/scripts/zone-flow`. | Paths between zones. |
| [`tools/relief`](../../tools/relief/README.md) | Redo of the relief panorama (plate 0, depth, 138° outpaint, 360° ring). Review only. | Depth-relief plates / far backdrop reference. |
| [`tools/judge`](../../tools/judge/README.md) | Local Grok vision judge of a candidate vs 1–3 refs + taste log; pass = score ≥ 7, keep, matches refs. | Before showing a still / hull / plate to the owner. Never replaces the owner. |
| [`tools/reportview`](../../tools/reportview/README.md) | One static phone page gathering a take's reports in pipeline order. | End of every step. |
| [`tools/preview`](../../tools/preview/README.md) | Freezes the zone play page at a commit on 127.0.0.1 (no tunnel, no deploy). | After an accepted step, for phone QC. |
| [`tools/quota`](../../tools/quota/README.md) | Reads a Grok CLI ndjson log, appends a row to `learn/quota-log.md`. | **Step end**, every accepted step. |
| [`tools/loops`](../../tools/loops/README.md) + [`stock/loops/`](../../stock/loops/README.md) | Registry + checker for reusable living Imagine loops. | When a loop is cooked or reused. |

## Lane-runner / compositor scripts (`biome/scripts/`) — earlier endless-lane game

Still hung for the lane biomes; not the open-zone method unless a row above points at them.

| Script | What it does |
|---|---|
| `biome-cook` | Ordered 17-step entry that wraps the hung lane QC scripts. |
| `bolt-key-gl` | GPU compositor for the keyed Bolt (law 15/17/22). |
| `bolt-scale` | `computeScale` / `assertScale`: Bolt size from the road, never by eye (13d). |
| `gallop-clock` | Syncs the 534-frame / 96 fps gallop to plate time (14c). |
| `chroma-despill` | Measured-axis green despill (13c). |
| `curvature-sample` | Adaptive curvature resampling for lane ribbons (12/12b). |
| `path-beat` | Lane target reveal ~3 s ahead (law 37). |
| `lena-lod` | Procedural placement / LOD on Rail B (law 36). |
| `gpu-light`, `gpu-openable` | Light-only keyed layers; openable objects (law 38). |
| `howl-live` | Howl aim + cut + shatter swap (law 34). |
| `jade-billboard`, `jade-lod` | Card tick and volume-stack LOD (law 44; superseded for open zones). |
| `plate-geo-qc` | Lane geometry judge (law 23) + rail 12 reports (`--report horizon/sky/turn/sun/texel/scale`). Not for ground tiles. |
| `plate-hazard-qc`, `plate-mae-qc` | Hazard-on-cone judge (25); plate seam MAE judge (33). |
| `zone-flow` | Open-zone runtime: clearing ↔ corridor handoff, speed-tied path video. **Current.** |
| `eclipse-look`, `imagine-live`, `open-ground`, `shoulder-panorama` | Experiment helpers for laws 39–43 / 41–42. |

## Citadel hall scripts (`scripts/`) — boot / hall recipe

`npm test` runs the hall selftests (`still-reasons`, `imagine-hooks`, `cold-start`, `kitchen-fail`, `install-lock-ata --dry-run`).
`cook-room.mjs` (hall cook, films first+last), `imagine-hooks.mjs` / `imagine-mid.mjs` (optional CLI Imagine Video),
`smoke-pack.mjs` (smoke gate), `validate-pack.mjs/.py` (pack box check), `still-pair.mjs`, `phash.mjs`, `dom-swap.mjs`,
`video-hold.mjs`, `kitchen-fail.mjs` (FAIL plates → `.kitchen/fail/`), `install-lock-ata.mjs` (seal install), `plate-speed.py`.

## Local Director harness (on the box, not in this repo)

| File | What it does |
|---|---|
| `/workspace/grokcli/kit/run-step.sh` | Starts one fresh headless Grok Build step (`<worktree> <spec> <prompt>`), logs ndjson; guard hooks block push/merge/reset. |
| `/workspace/grokcli/kit/AGENTS.md`, `IMAGINE.md` | Kit rules for every CLI step; exact Imagine tool syntax and limits. |
| `/workspace/grokcli/next/hard-laws.inc` | Hard laws pasted into every round prompt. |
| `/workspace/grokcli/next/spec.md`, `step-NN.md`, `tool-step-template.md` | Iteration spec and per-step prompts. |
| `/workspace/grokcli/next/tool-loop.md`, `tool-rNN.md` | Tool-improvement loop spec + one prompt per round. |
| `/workspace/grokcli/next/selftest-tools.sh` | Runs the 9 tool selftests; `ALL rc=0` = green. |
| `/workspace/grokcli/next/gate-round.sh` | Director gate for a tool round: exit, auth/quota, Imagine-call count, diff scope, selftests, red check on base. |
| `/workspace/grokcli/next/take10d-mon.py`, `a3poll.sh` | Short status of a running CLI step from its ndjson. |
| `/workspace/grokcli/next/extract-prompts.py` | Extracts the prompts used from a session log (recipes). |
| `/workspace/grokcli/next/METHOD.md` | Local copy of this sheet for the harness. |

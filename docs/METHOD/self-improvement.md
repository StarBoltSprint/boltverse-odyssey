# Self-improvement and auto-learning loops

Back to [METHOD.md](../METHOD.md). These loops exist so an approved method is never forgotten and a paid-for failure is
never paid twice.

## 1. Per step (every Grok run)

| When | Do | Where |
|---|---|---|
| Before any step | Read this sheet, [`learn/failures.md`](../../learn/failures.md), [`learn/recipes/INDEX.md`](../../learn/recipes/INDEX.md), [`learn/taste.md`](../../learn/taste.md) (Golden rule first), [`learn/geometry.md`](../../learn/geometry.md) before any still / slice / orbit / tile. Reuse a recipe that passed; never repeat a logged failure. | `AGENTS.md`, `GROK.md` |
| Step start | Decree brief: `python3 tools/decrees/brief.py --spec <spec> --step <dir> [--kit <id>]`. | [`tools/decrees`](../../tools/decrees/README.md) |
| During | One goal, ≤ 8 done-when rows, `REPORT.md` written as each row is measured; start the ~40 min playcheck early. | [`spec.md`](../../spec.md) "One step" |
| Stop rule | **Stop after 2** failures of the same defect: list the Imagine-born miss, accept it, move on. (Hall smoke: 1 fresh + 1 enlarge.) | `spec.md` "Stop after 2", `AGENTS.md` |
| Step end | Screenshots + 3-line report; quota row (`tools/quota`); phone preview (`tools/preview/freeze.py`); reportview page. | METHOD §2 |
| Retro | Append owner reaction to `learn/taste.md` (KEEP / FAIL / LOVE, owner's words, lesson); new recipe in `learn/recipes/` + index row; new failure in `learn/failures.md`; take note from `learn/take-notes/_template.md`; **one concrete prompt or tool improvement** ("ALWAYS IMPROVE"). Skill: [`take-retro`](../../.grok/skills/take-retro/SKILL.md). | `learn/` |
| New owner method | Add the dated line to METHOD.md + [decisions log](decisions-log.md) in the same PR. | METHOD §3 |

## 2. QC gates (machine first, owner last)

1. **Asset gate** — `tools/assetcheck` on every Imagine file (tile seams/exposure/mag, cutout alpha/halo/green band,
   loop seam/flow, backdrop width/mag).
2. **Anti-sky-copy / anti-seam** — `tools/sky/check.py`: trailing cloned or mirrored columns FAIL, join MAE ≤ 4,
   column-luma swing ≤ 6 per 60°, closed loop, living layers combined repeat ≥ 600 s with per-slice offsets.
3. **Object consistency** — `tools/objsheet` (+ `preflight.py`): same object in all 8 views, no crop, no holes, hull keep.
4. **Layout** — `tools/layout check`: organic shape, `no_ring`, colliders = visible pieces, mag incl. slope stretch.
5. **Rendered pixels** — `tools/playcheck`: judges the framebuffer, never the data (take 8 lesson); renderlint for NEAREST.
6. **Visual judge** — `tools/judge/judge.py` with refs from `tools/judge/references.json` and the taste log; score ≥ 7.
   Skill: [`visual-judge`](../../.grok/skills/visual-judge/SKILL.md). Never overrides a hard law or the owner.
7. **Owner phone QC** — the only final KEEP. Every reaction goes into `learn/taste.md`.

Skills for the repeated moves: [`.grok/skills/`](../../.grok/skills/) — `ground-tiles`, `keyed-cutout`, `orbit-views`,
`sky-panorama`, `visual-judge`, `take-retro`.

## 3. Tool feedback routine (law 66)

A session that finds a tool let a defect through, gave a wrong number, or was hard to use: finish the take, write
`feedback/<date>-<tool>.md` (fields of [`.github/ISSUE_TEMPLATE/tool-feedback.yml`](../../.github/ISSUE_TEMPLATE/tool-feedback.yml):
tool, version, take, defect, reported vs measured number, repro, still), and open it upstream as an issue (or tell the
human to). Law: [`66-tool-feedback-loop.md`](../../biome/docs/66-tool-feedback-loop.md). Nothing auto-merges.

## 4. Tool-improvement loop (Director, parallel to zone steps)

Runbook: `/workspace/grokcli/next/tool-loop.md` (local). A second headless Grok session fixes measuring tools, one
defect per round, from a queue fed by Director QC and `feedback/`.

- Tools only measure; **no Imagine calls**; diff limited to `tools/<tool>/**` + one `feedback/` file.
- **Red first:** a selftest that fails on the base for the defect's reason, then the minimal fix. Never delete or weaken a
  case; never loosen a threshold; a new threshold cites its law or is reported with "threshold needs owner decision".
- Director green check (`gate-round.sh`, `selftest-tools.sh`): all 9 selftests green, red-on-base / green-on-round,
  scope clean, zero Imagine calls, renderlint unchanged → merge (standing permission).
- 2 rounds with an identical failure → defect BLOCKED, next item (stop rule = 2). Zone loop has quota priority.
- Done so far: rounds r01–r06 (organic layout L0a/L0b, yaw band L1, organic walk P8, decree #457 preload, DR1) → PR #145;
  take 10d tool gates (sky clone, green edge band, orbit preflight, living-loop period) → PR #148.

## 5. Records

| File | What |
|---|---|
| [`learn/taste.md`](../../learn/taste.md) | Golden rule, style rules, owner reaction log (append-only). |
| [`learn/failures.md`](../../learn/failures.md) | Defect → root cause → fix → guard (append-only). |
| [`learn/recipes/`](../../learn/recipes/INDEX.md) | Validated cooks with exact prompt and QC numbers. |
| [`learn/take-notes/`](../../learn/take-notes/) | One retro per accepted step. |
| [`learn/quota-log.md`](../../learn/quota-log.md) | Turns / quota per step. |
| [`learn/prompts-audit.md`](../../learn/prompts-audit.md) | Audit of prompts against the geometry lock. |
| [`feedback/`](../../feedback/README.md) | Tool defect reports (law 66). |

## 6. Recipe progression (versions, score, lock)

Asked by SmiR once the sky and the ground were validated (2026-10-03 21:56). Every recipe keeps getting better and never
slides back.

- **Versions.** Each recipe (ground, sky, rocks, hard objects, and every new one) has numbered versions: `<recipe> v1`,
  `v2`, … A version names its PR / commit, its recipe page and its gate command.
- **Score.** A version's score = the **automatic gates** (the recipe's gate plus root `npm test`, `tools/playcheck`, mag ≤ 1,
  each row PASS / FAIL with its measured number) **plus SmiR's phone verdict** (VALIDATED / APPROVED, IN TEST, or FAIL, with
  his words in [`learn/taste.md`](../../learn/taste.md)). The phone verdict outranks any number.
- **Lock.** The best version is **locked**: it is what every new zone builds with, and its accepted known issues stay
  declared next to it.
- **Replace only when better.** A new attempt replaces the locked version only when it scores better **and** regresses
  nothing: every gate row the locked version passed still passes, no accepted known issue gets worse, and SmiR's phone
  verdict is at least as good. Otherwise the attempt is logged (failure or rejected row) and the lock stays.
- **Record.** A new lock is a row in the table below and a dated row in the [decisions log](decisions-log.md), in the same PR.
  Stop rule = 2 applies to attempts at the same defect.

| Recipe | Locked version | Source | Status | Score / notes |
|---|---|---|---|---|
| Sky | **v1** — zone A sky, 13 unstretched slices per band, shader neighbour crossfade (d74f367), instanced video layers with per-tile time offsets, closed dome, parallax | PR #159, [`sky.md`](sky.md) | **VALIDATED** SmiR 2026-10-03 21:56 (phone) | Gates: `tools/sky/check.py` PASS (13 slices, 0 failures), `tools/sky/selftest.py` PASS, `npm test` PASS. Known issues in `sky.md` Part 2. |
| Hard objects | **v1** — Howl frigate, measured-section loft, one unlit Imagine skin per part | PRs #161 / #163, [`hard-objects.md`](hard-objects.md) | **VALIDATED** SmiR 2026-10-03 21:36 (phone) | Gate `python3 tools/hard-objects/rebuild.py`. Known issues in METHOD.md. |
| Rocks | **v1** — kit-driven TerrainFeatureGenerator, zone A kit `howling-eclipse` | PR #162, [`rocks.md`](rocks.md) | IN TEST (merged, phone QC open) | `tools/rocks/selftest.py` PASS. Known issues: skins mag 1.15–1.32 up close, one shape per type, crest hull not carved. |
| Ground | **v1** — current zone A relief ground with Imagine materials and image-depth micro relief | PR #156, [`ground.md`](ground.md) | Look APPROVED 2026-10-03; not VALIDATED | Pending: the slope fix (≤ 3 m / ≥ 20 m, ≤ 15°) as v2, validated on the phone. |
| Ground | zone B candidate — Ember Mesa, 6,500 m² canyon, relief-picked materials, image-depth maps, 22 cutouts, skirt rise 3.5 m, fog mix 0.18, post fog cap 0.08, canyon walls and a skyline seated on the loft | `packs/zone-b/` | IN TEST (does not replace v1) | Step 1g. Length 143.73 m, width 40.5–47.5 m. Boot maxSlope 0.2366 rad. Presented mag 0.982. The wide view still shows the tile lattice. The loft base still meets the ground as a straight cut. No phone review. |
| Sky | zone B candidate — 9×40° emptier horizon (−10.493°–10.493°) plus one upper gradient repeated ×9 (7.893°–28.88°), one haze loop on four cards, ringed planet as its own keyed video, mag 0.5 | `packs/zone-b/src/sky/sky.json` | IN TEST (does not replace v1) | Step 1g. `check.py` was not re-run; step 1f still stands at 84 failures. Play mag 0.982. Planet heading 180°, elevation 15°, 380 m. Haze gain 0.28, four cards, mag 0.75. Hole above 28.88°. Active videos 3. A thin key fringe remains on one moon. |
| Sky | zone B planet card — one 1280×720 video, heading 180°, elevation 13°, 560 m, mag 0.5625, soft key, camera-facing | `packs/zone-b/src/sky/planet.json` | IN TEST (does not replace v1) | 2026-10-05. Phone pair dt 3.830 s, videos 4, geometric screen 720×405, projected 752×423, scale 0.5625, presented mag 0.982. Owner phone review still open. |

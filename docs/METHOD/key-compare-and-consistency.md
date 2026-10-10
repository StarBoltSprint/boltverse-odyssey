# Key-compare, locked palette and image consistency (SmiR 2026-10-10)

SmiR noticed we only reported the outline IoU of the mesas and never showed the key next to the game for anything
else. Three rules follow. They are **automatic and mandatory**.

## 1. Key-compare (`tools/object-gate/key-compare.mjs`)

`tools/object-gate/key-compare.mjs` renders the game from the **key camera** (`--solve` searches it: position × yaw,
then yaw/pitch/eye, position nudge, field of view; score = sky / dark structure / rest class agreement with the key at
256×144) and compares every **element of the key** (towers, facades, avenue, sand, mesas, arch, spire, sky, rings,
moon, sun, haze, wreck, debris…), described in `specs/<zone>/key-compare.yaml` (rect + mask rule, same rect on both
sides because the camera is matched).

| Metric | What | Gate (FAIL) / target |
|---|---|---|
| `iou` | outline IoU of the element masks in frame coordinates (position + shape); shape-only IoU reported beside | per type, `profiles/<type>.yaml` `keyCompare` |
| `deLit`, `deShadow` | CIEDE2000 of the mean colour of the lit / shadow half of the element (each image split on its own median L) | idem; colour limits derive from `biome.json` `qc` |
| `structure` | SSIM of luminance after ECC alignment of the game crop on the key crop; LPIPS (alex) as info | idem |

- Runs in `cli.mjs`, `gateSceneKC()` and `gateAndFix()` whenever the scene yaml has `keyCompare:` (Zone B: `specs/zone-b/scene.yaml`), as stage
  `keycompare` of `imagine-to-3d/auto.py`, and in `fixloop.py keyloop`. Every run writes `sheet.jpg` (1080 px wide,
  phone readable: key, game, then one key | game crop pair per element with its numbers) and `sheet-small.jpg`.
- `gate` limits FAIL the run. `target` limits are where the fix loop drives every element (IoU ≥ 0.95, ΔE lit ≤ 3,
  ΔE shadow ≤ 4, structure ≥ 0.9 by default); a miss is a reported gap, not a FAIL.
- Honest ceiling: a 3D object seen from one angle can't reach 100 % against a 2D painting. Each element row carries a
  `ceiling` (the key crop against itself after unavoidable render losses: 1 px misregistration, 0.75× render
  resolution, AA blur). A target above the ceiling is reported as unreachable, never chased.
- Elements absent from the game are `MISSING` (FAIL unless `reportOnly`); elements outside the key frame by design
  (`notInKey`, e.g. the planet at azimuth 270) are `N/A`.

## 2. Correction loop (`imagine-to-3d/fixloop.py keyloop spec.yaml`)

On any FAIL or below-target score: shape → shape-seed search toward the key, then silhouette warp (per-column skyline
delta written for the generator); colour → grade-match, an accumulated render-measured CIELAB offset (key − game, lit
and shadow separately) applied to the element's Imagine plates by `palette.py shift`; detail → plate re-pick (existing
plates ranked by style score vs the key crop), relief strength sweep, detail-layer sweep. Re-render, re-score; stop
when every target is met, after `stallRounds` rounds without improvement, or at `maxRounds`. The report
(`KEYLOOP.md`) lists per element and metric: first, best (round), last, target, gap, ceiling, reachable.
Commands come from the object spec `keyCompare.apply`; an action without a command is reported `NOT_WIRED`.
**No Imagine image is ever generated**: a missing element or a detail stall writes `imagine-requests.json`
(`NEEDS_APPROVAL`).

## 3. Locked palette + image consistency (stage `consistency`, before anything is built)

- `palette.py sample` writes `tools/imagine-to-3d/palettes/<biome>.json` once per biome: biome.json `anchor.sampled`
  plus lit / shadow CIELAB mean and std for light, shadow, sky, haze and every key material, taken with the same masks
  as key-compare.
- Every new Imagine image is graded toward its material at import (`palette.py grade`): a smooth CIELAB transfer of
  the Imagine pixels (mean shift + bounded contrast, lit and shadow separately), no painting, size unchanged;
  before / after ΔE logged in `palette-log.jsonl`.
- `consistency.py check`: palette ΔE + style score vs the key crop → ACCEPT / FLAG (regenerate) / REJECT.
  `consistency.py views`: views of one object registered on their overlap (ORB + RANSAC homography):
  SSIM ≥ 0.92 and ΔE < 3.5 (Grok q17). REJECT fails the stage; FLAG = `NEEDS_IMAGINE` with requests written, not run.

## First Zone B run (2026-10-10, live v58)

The solved key camera scored only 0.47 (sky IoU 0.54, dark-structure IoU 0.21): the v58 layout does not reproduce the
key composition, so most IoU rows fail on layout before they fail on models. Result: 0 MATCH, 1 CLOSE (debris),
13 FAIL, 2 MISSING (moon, sun), planet N/A. Mesas: silhouette in place (IoU 0.79 from the mask render) but 84 %
hidden behind a tower from this camera (`visible` rule), lit side too pale (ΔE 11.8). Report:
`/workspace/zb-bible-1008/compare/report.md`.
Known metric limits: the `rock` colour rule also catches sand (arch IoU inflated); the key's ring arcs are fainter than
`lumAbove: 175` (key mask empty), so the rings row needs its own rule.

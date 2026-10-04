# Biome transitions — fog / grade blend along a path (IN TEST)

Back to [METHOD.md](../METHOD.md). **Status: IN TEST (2026-10-04, branch `zone-a-polish`).** Scaffold only: zone B
(*Ember Mesa*) has no pack yet, so the zone A path is an empty placeholder and the blend stays at 0 in play.

## Rule

Between two biomes only the law 67 post changes: light distance fog, one light grade per biome, subtle capped bloom.
No new pixel is drawn, nothing is tinted by a typed colour. The plates themselves (corridor ground video, next clearing)
are handed over by [`biome/scripts/zone-flow`](../../biome/scripts/zone-flow/README.md); this blend is the post half.

| Piece | Where | What |
|---|---|---|
| Post numbers per biome | `biome/kits/<id>.json` → `post` | `fogDensity`, `fogCap`, `gradeMix`, `saturation`, `bloomGain`, `bloomThreshold`. Numbers only. Template: `biome/kits/_template/kit.json`. |
| Light limits | `packs/zone-a/play/biomeblend.js` `POST_LIMITS` | fog density ≤ 0.03, fog cap ≤ 0.65, grade mix ≤ 0.4, saturation 0.9–1.15, bloom gain ≤ 0.15, threshold 0.7–0.95. A kit cannot push past them. |
| Fog colour | each biome's own Imagine sky | Mean of that biome's horizon band (`sampleHorizon`, same as zone A). **Never typed**; kit palettes stay prompt guidance. Unknown (no sky yet) → the current biome's sampled colour is kept. |
| Weight | `createBiomeBlend` | `t = smoothstep(startM, endM, s) × lateral`, `s` = distance travelled along the path polyline, lateral falloff from 0.6·`widthM` to `widthM` off the path (never a wall: post only). |
| Path + target | `packs/<zone>/clearing.json` → `transition` | `{ "to": "<kit id>", "toClearing": "<next clearing.json or null>", "path": [[x, z], …], "startM", "endM", "widthM" }`. |
| Hooks | `play.js` | `onApproach` (t first > 0, walked distance only) → `prefetchNextZone(toClearing)`: loads the next clearing, samples its sky horizon, retargets the blend. `onArrive` (t = 1) → hand-off flag. A QC override never fires them. |
| Shader | `terrain.js` post + Bolt card | The old constants are uniforms; same passes, same maths at t = 0. Bolt takes the grade (mix, saturation) only: no fog, no bloom, never glows. |

Zone A values (= the approved step 1 post): 0.015 / 0.58 / 0.26 / 1.05 / 0.11 / 0.78. Ember Mesa placeholder: 0.019 / 0.62 /
0.32 / 1.10 / 0.12 / 0.76 (golden-hour haze: a little denser fog, a little more grade). Cascade Verdance placeholder:
0.012 / 0.50 / 0.22 / 1.08 / 0.10 / 0.80. B and C numbers are IN TEST until their skies exist and SmiR sees them on the phone.

## To finish when zone B exists

1. Build `packs/zone-b/` (its own sky slices → its fog colour comes for free).
2. Fill zone A `transition.path` with the real exit path (gate mouth → corridor end; the gate is another step's work),
   set `toClearing` to `packs/zone-b/clearing.json`, tune `startM` / `endM` so the blend completes at the path end.
3. Mirror the block in zone B toward A (or C).

## QC

- `node --test packs/zone-a/play/biomeblend.test.mjs` (6 tests: defaults, clamp, path projection, monotonic smooth blend,
  no typed fog colour, override never fires hooks).
- In the page: `__play.setBlend(t)` forces a weight (null = walked distance), `__play.blendInfo()`, `snapshot().blend`.
- Proof frames 2026-10-04 (t = 0 / 0.5 / 1 from `place(-2, 2, 24)`): `/workspace/grokcli/out/zoneA-polish/blend/`.
  drawCalls 10, texMB 236.4 at every t.

## Known limits

- Until zone B has its Imagine sky, only the numbers blend; the golden-hour colour shift (fog colour) cannot appear
  (by law it is never typed). The t = 1 frame is therefore only slightly hazier and more graded than t = 0.
- The sky dome itself does not blend (that is a plate crossfade for zone-flow, not a post job).

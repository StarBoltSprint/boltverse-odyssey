# object-gate — mandatory quality gate for every 3D object and biome

Law: [`docs/METHOD/object-quality-gate.md`](../../docs/METHOD/object-quality-gate.md). Nothing is shown to SmiR, merged,
published or exported before this gate says PASS for the build that will be shown. Exit 0 = PASS, 1 = FAIL, 2 = bad
invocation. Every FAIL row carries fix hints.

```bash
node tools/object-gate/cli.mjs --scene tools/object-gate/specs/zone-b/scene.yaml            # full gate
node tools/object-gate/cli.mjs --scene ... --only tower-m2,mesa --fast                         # iterate (no morph)
node tools/object-gate/selftest.mjs                                                            # offline self-test
```

Setup: `cd tools/object-gate && npm ci` (js-yaml; Playwright is optional: `npm i playwright && npx playwright install chromium`,
or point `OG_PLAYWRIGHT=/path/to/playwright/index.mjs` at an existing install). Python 3 with numpy + Pillow. Renders with SwiftShader (headless, deterministic, no GPU needed).

## Layout

| Path | What |
|---|---|
| `gate.mjs` | API v1.3: `gateScene(scene, opts)`, `gateObject(spec, opts)`, `loadScene(yaml)`, `resolveObject`, `loadProfile`, `listProfiles`, `checkId`, `toMarkdown`, `screenPxPerM`, `scoreVisible`. **Stable contract: [`API.md`](API.md)** (used by the Imagine-to-3D modules) |
| `cli.mjs` | CLI |
| `rescore.mjs` | re-score a finished run under the current texel policy, no re-render (`--run out/<time> --scene ... [--render <dir>]`) |
| `visible-shot.mjs` | render-based visible px/m of any screenshot (A/B sheets): `--img shot.png --dist 8 --fov 27 [--mask m.png]`; same estimator as the gate row |
| `lib/visible.mjs` | texel policy `visible`: phone screen px/m at a distance, visible-repetition rows |
| `lib/inject.js` | init script: tags every decoded image with its URL (fetch → Blob → ImageBitmap, `<img>`) so GPU textures map to files. Read-only. |
| `lib/probe.js` | in-page measurements on the THREE scene: textures (material props, uniforms and `renderer.properties` uniforms from `onBeforeCompile`), texel density, masks, shadow probe, grounding rays, geometry, effects |
| `lib/probe-view.js` | (1.3) in-page raycast `surfaceHit` + optical `zoom` for the 8 m render capture; extends `window.__og` |
| `lib/analyze.py` | numpy/Pillow: render-based visible px/m (`visible_px`), repetition autocorrelation, dHash, CIELAB ΔE, capture sheet, mask PNG, image size |
| `profiles/*.yaml` | per-type thresholds + checklist templates: `building rock vehicle prop vegetation ice creature effect terrain` (all extend `_base`) |
| `adapters/*.mjs` | how to reach one game page (scene, camera, renderer, THREE, player pose, ground height, player path). `zb-preview-1008.mjs` = Zone B preview. |
| `specs/<zone>/` | scene.yaml + one yaml per object + `records/<id>.verified.yaml` (checklist passes) |
| `key-compare.mjs` | **key image vs the key-camera render, per key element**: outline IoU, lit / shadow ΔE2000, structure SSIM, per-type `keyCompare` thresholds, sheet on every run; `--solve` finds the key camera. Spec: `specs/<zone>/key-compare.yaml` |
| `lib/keycompare.py` | masks, metrics, measurement ceiling, sheet (`sheet.jpg` 1080 px + `sheet-small.jpg`), camera-solver score |
| `hooks/imagine-to-3d.mjs` | Imagine-to-3D final stage: `gateAndFix()` / CLI: gate → fix plan → fix → re-gate → export on PASS |

## Checks

1. **Visible px/m** (policy `visible`, SmiR 2026-10-09 20:19), measured on the **final render** since 1.3 (8 m capture,
   optical zoom to 2 × the need, detail measured in the pixels; works for unique plates and layered materials):
   visible px/m ≥ the phone screen's px/m when the surface is viewed from 8 m (1080 × 2400 phone at the game's render pixel ratio and fov;
   Zone B: 155 px/m). Closer views are exempt, no camera distance limit. Imagine plates are 1024² native, so one plate
   covers at most ~6.6 m. Plus: served file ≥ Imagine original, GPU = file, mipmaps + trilinear,
   anisotropy = max, UV stretch ≤ 1.3, the scene's own px/m claim cross-checked against the measurement.
2. **Repetition**: one shared plate set per object type is allowed, but identical plate pixels never within 30 m
   (tiling period or pool cell period with ortho correlation) and neighbouring copies (< 7 m) never share; autocorrelation on fronto-parallel face views (front + side, lit, object only) and the close / low-portrait captures, including the correlation at the plate's own tile period.
3. **Approach morph** 300 → 10 m on the nearest copies with the game's own LOD logic: silhouette IoU jumps.
4. **Shadows**: cast, world-fixed (mask IoU after moving the player 80 m), neutral colour (not violet).
5. **Grounding**: rays from below under the lower 20 % of each copy vs ground height.
6. **Geometry**: welded non-manifold / open edges, facade relief, proportions vs spec.
7. **Key checklist**: captures (close, low phone portrait, far) → `capture-sheet.jpg` beside the key crop; FAIL unless
   every item has a recorded pass on a current capture (dHash ≤ 12) in `records/<id>.verified.yaml`. ΔE vs key crop.
8. **Runtime**: console/page errors, shader compile, HUD/title text, portrait viewports, budgets (report only), and
   **live preview untouched** during the run (adapter `liveDir`; only files the live page loads count, staging files beside them are listed; never edit live files in place: stage, gate, swap after PASS).
9. **Effects**: every effect mesh samples an Imagine texture (allow-listed folders).
10. **Key-compare (2026-10-10, mandatory when the scene has `keyCompare:`; `cli.mjs` / `gateAndFix` / `gateSceneKC`)**: the game rendered from the key camera next to
   the key; per element of the key (towers, facades, avenue, sand, mesas, arch, spire, sky, rings, moon, sun, haze,
   wreck, debris...): outline IoU (frame), CIEDE2000 of the lit and the shadow half, SSIM structure after alignment.
   FAIL beyond the type's `keyCompare.gate`; gaps to `keyCompare.target` drive `imagine-to-3d/fixloop.py keyloop`.
   Missing elements FAIL. Writes `key-compare/sheet.jpg` on every run. Method: `docs/METHOD/key-compare-and-consistency.md`.
   Mask rules (lib/keycompare.py): `rocktex` = rock without smooth sand (texture split; `rock` alone counted the dunes),
   `skycore` + `{tophat: dL, k}` = thin bright lines (ring arcs) by local contrast, `thin: px` tolerance band for 1-2 px
   structures. `lib/kc_diff.py before.json after.json` = before / after table of two runs.

```bash
node tools/object-gate/key-compare.mjs --spec tools/object-gate/specs/zone-b/key-compare.yaml --solve --out out/kc   # find the key camera
node tools/object-gate/key-compare.mjs --spec tools/object-gate/specs/zone-b/key-compare.yaml --camera out/kc/camera.json --out out/kc
```

## Recording checklist passes

The gate writes `out/<run>/<id>/checklist-todo.yaml` with the current capture hashes. The verifier (Grok vision or
the owner) looks at `capture-sheet.jpg` next to the key crop and copies the items into
`specs/<zone>/records/<id>.verified.yaml`:

```yaml
object: tower-m2
items:
  relief: {pass: true, by: "grok-vision 2026-10-09", note: "fins + bays read at 20 m", captures: {close: 9f3c..., low-portrait: 1a2b...}}
```

A capture that changes (new build) invalidates the pass automatically.

## Writing an adapter

Export `{ name, defaultUrl, captureQuery, readyExpr, fxNames, setupInPage(page), selfReport?(page), sources?() }`.
`setupInPage` must publish `window.__ogHost = { THREE, scene, camera, renderer, groundHeight(x,z),
setPose({x,z,look:[x,y,z]}), path: [[x,z],...], freeze?() }`. The Zone B adapter grabs the scene by watching one
`renderer.render` call and imports the page's own `three.module.js` (same module instance).

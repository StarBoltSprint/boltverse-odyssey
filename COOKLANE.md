# COOKLANE — the sprint minute, not a tiny citadel

Hall cook = [COOKROOM.md](COOKROOM.md) → `node scripts/cook-room.mjs moss`  
Lane cook = **this page** → `node scripts/cook-biome.mjs forest`  
Palette = [palettes/forest-palette.json](palettes/forest-palette.json). Chart = [CUES.md](CUES.md).  
`L` = [scripts/cue-readability.mjs](scripts/cue-readability.mjs). Runner = [scripts/sprint-transition.mjs](scripts/sprint-transition.mjs).

```
cook-room moss      → 3 stills hall + 5 films graphe
cook-biome forest   → 10 bobines d’os, 0 atA, cues []
```

Cues stay `[]` until scrub. Then sidecar `films/<id>.cues.json` + `node scripts/validate-cues.mjs` + `smokeL`. Inventing the JSON before the mp4 = orphan chart.

`--dry-run` first. Live = `imagine-hooks.mjs`. FAIL decay ×2 → kit `coming`, no door `kind: sprint`.

Encode **H264 `-an`**. Do not cook walk-A as the sprint.

## Count — 10 cooked, ~6 played

calm ×3 · lean ×4 · peak ×2 · decay ×1. Grok **reads** the ids.

| Palier | N | Durée | ρ | min `on→on` |
|---|---|---|---|---|
| calm | 1 | 10–15 s | **0.07–0.10** | n/a |
| lean | 1–2 | 8–12 s | **0.12–0.22** | **≥ 1.2 s** |
| peak | 2–3 | 8–10 s | **0.22–0.35** | **≥ 0.8 s** |
| decay | 0–1 | 8–12 s | **0–0.10** | — |

Law 0: calm/decay first = last. Lean/peak first → last hold. `L` 3/3. Gray ≠ recook.

## One line

**`cook-biome` writes mute films. The chart is a JSON written after the scrub.** Empty until the film exists.

# COOKLANE — the sprint minute, not a tiny citadel

Hall cook = `node scripts/cook-room.mjs moss`  
Lane cook = `node scripts/cook-biome.mjs forest`  
Smoke Lane = `node scripts/smoke-biome.mjs forest` — **not** smoke-pack.

Palette = [palettes/forest-palette.json](palettes/forest-palette.json). Chart = [CUES.md](CUES.md).  
`L` = [scripts/cue-readability.mjs](scripts/cue-readability.mjs).

```
cook-biome   → mute films, cues []
scrub        → films/<id>.cues.json
validate-cues + smoke-biome + smokeL
then coming: false
```

`smoke-biome` : metal (720×1280 H264 `-an`) → cues → `L` → 3 frames identity C. FAIL decay → kit `coming`, no door.

Encode **H264 `-an`**. Do not cook walk-A as the sprint.

## Count — 10 cooked, ~6 played

calm ×3 · lean ×4 · peak ×2 · decay ×1.

| Palier | N | Durée | ρ |
|---|---|---|---|
| calm | 1 | 10–15 s | 0.07–0.10 |
| lean | 1–2 | 8–12 s | 0.12–0.22 |
| peak | 2–3 | 8–10 s | 0.22–0.35 |
| decay | 0–1 | 8–12 s | 0–0.10 |

Law 0: calm/decay first = last. Lean/peak first → last hold. `L` 3/3. Gray ≠ recook.

## One line

**Hall smoke-pack never grades a Lane plate.** `smoke-biome` is the gate. Empty cues until the scrub.

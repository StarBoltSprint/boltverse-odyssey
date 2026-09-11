# CUES — one sheet per plate

A plate = one mp4 + **one sheet**. Not cues in chat. Not in hall `room.json`.

```
films/forest-calm-2.mp4
films/forest-calm-2.cues.json
```

Same schema as the `cues` block in [palettes/forest-palette.json](palettes/forest-palette.json) **after** stamp. Year-0 palette stays `cues: []` until the sheet exists. `cook-biome` **leaves** `[]`.

Validate: `node scripts/validate-cues.mjs films/forest-calm-2.cues.json`

## Schema

```json
{
  "plateId": "forest-calm-2",
  "file": "films/forest-calm-2.mp4",
  "duration": 12.0,
  "railsVersion": "lockoff-back-v1",
  "cues": [
    { "id": "c0", "kind": "pose", "side": "A", "on": 3.12, "off": 3.48 }
  ]
}
```

`duration` = ffprobe of the **hung** mp4, not the wish. Cues sorted by `on`, **disjoint**. 0 cue = legal (decay / quiet calm) → `L.na`.

| Cue | Values |
|---|---|
| `id` | `c0`, `c1`… (Keep / logs) |
| `kind` | `pose` \| `lean` \| `fork` \| `seuil` (Smoke/Grok; `seuil` = floor 3) |
| `side` | `A` \| `B` \| `pose` (hitbox 40/20/40) |
| `on` / `off` | seconds, 3 decimals, `off > on` |

Not in the year-0 sheet: coyote (0.22), Early (0.08), `m`, `L` samples. Grade reads **`side` + time**. `kind` is not the grade.

## Machine (`validate-cues`)

```
0 ≤ on < off ≤ duration
off − on ∈ [0.22, 0.55]
on[i+1] − on[i] ≥ 0.80   (hard min 0.60)
no overlap  ·  N ≤ 3  ·  ρ_glow ≤ 0.45
```

FAIL → do not Hang. `coming` stays, or drop the plate from the playable palette.

## When to write

```
mp4 PASS metal + identity
scrub → on/off/side/kind
validate-cues
3 samples L
L PASS or gray nudged
then the json is no longer []
```

Inventing the JSON **before** the clip = orphan chart.

Player: `makeSheet(json.cues)` → `resolveFrame` ([cue-coyote.mjs](scripts/cue-coyote.mjs)).

## Refuse

`tap` in frames · « TAP LEFT » · audio · `s_i` (Keep, other file) · a wall clock.

## One line

**One JSON per plate: `on`, `off`, `side`, `kind`, real duration.** Empty until the film exists. Full only after the scrub. That is the chart.

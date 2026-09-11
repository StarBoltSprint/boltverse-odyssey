# CUES — one sheet per plate

A plate = one mp4 + **one sheet**. Not cues in chat. Not in hall `room.json`.

```
films/forest-lean-L1.mp4
films/forest-lean-L1.cues.json
```

`cook-biome` leaves `cues: []`. After scrub: sidecar + `validate-cues` + `smoke-biome` + [PLAYTEST.md](PLAYTEST.md) (5 blind taps).

Year-0 hung is **not** empty. 1 cue / plate. Glow in the encode = when. No TAP bar.

## Schema

```json
{
  "plateId": "forest-lean-L1",
  "file": "films/forest-lean-L1.mp4",
  "duration": 10.04,
  "railsVersion": "lockoff-back-v1",
  "cues": [
    { "id": "c0", "kind": "swipe", "side": "L", "on": 1.45, "off": 2.00 }
  ]
}
```

`duration` = ffprobe of the hung mp4. 0 cue = legal on decay / calms → `L.na`. Grade reads **`side` + time**.

## Year-0 hung

| plate | k | glow `[on, off]` | swipe | miss → |
|---|---|---|---|---|
| L1 | 0 | 1.45 – 2.00 | L | decay |
| L2 | 1 | 2.10 – 2.65 | L | decay |
| decay | — | none | — | hall |

Hit L1 → L2 (`r` 1.00 → 1.20). Hit L2 → hall (clean). Miss either → decay, **not** a free next lean.

Judge coyote (`win` 0.90) is wider than the glow. Glow is the telegraph. Early taps before `at − win` are ignored, not farmed.

Pop after the window: HIT / LATE / MISS. Never TAP / NOW. Never a fill-bar.

## Machine

```
0 ≤ on < off ≤ duration
off − on ∈ [0.22, 0.55]
on[i+1] − on[i] ≥ 0.80   (hard min 0.60)
N ≤ 3  ·  ρ_glow ≤ 0.45  ·  no overlap
```

FAIL → do not Hang. Identity C = `.smoke/<id>/`. Human gate = 5 taps.

## One line

**The chart is a JSON after the scrub.** Glow = when. Hit = next plate faster. Miss = decay. The thumb is the gate.

# CUES — one sheet per plate

A plate = one mp4 + **one sheet**. Not cues in chat. Not in hall `room.json`.

```
films/forest-calm-2.mp4
films/forest-calm-2.cues.json
```

`cook-biome` leaves `cues: []`. After scrub: sidecar + `node scripts/validate-cues.mjs` + `node scripts/smoke-biome.mjs forest`.

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

`duration` = ffprobe of the hung mp4. 0 cue = legal → `L.na`. Grade reads **`side` + time**. `kind` is Smoke/Grok only.

## Machine

```
0 ≤ on < off ≤ duration
off − on ∈ [0.22, 0.55]
on[i+1] − on[i] ≥ 0.80   (hard min 0.60)
N ≤ 3  ·  ρ_glow ≤ 0.45  ·  no overlap
```

FAIL → do not Hang. Identity C = the 3 jpgs `smoke-biome` writes under `.smoke/<id>/`.

## One line

**The chart is a JSON written after the scrub.** `smoke-biome` grades the mp4. `smoke-pack` never does.

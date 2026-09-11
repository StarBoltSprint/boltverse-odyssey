# CUES — one sheet per plate

A plate = one mp4 + **one sheet**. Not cues in chat. Not in hall `room.json`.

```
films/forest-run.mp4
films/forest-run.cues.json
```

`cook-biome` leaves `cues: []`. After scrub: sidecar + `validate-cues` + `smoke-biome` + [PLAYTEST.md](PLAYTEST.md) (5 blind taps).

Year-0 hung is **not** empty. 1 cue / plate. Glow in the encode = when. No TAP bar. No drawbox rectangle.

## Schema

```json
{
  "plateId": "forest-run",
  "file": "films/forest-run.mp4",
  "duration": 6.04,
  "railsVersion": "lockoff-back-v1",
  "cues": [
    { "id": "c0", "kind": "tap", "side": "L", "on": 0.40, "off": 5.20 }
  ]
}
```

`duration` = ffprobe of the hung mp4. 0 cue = legal on decay / calms → `L.na`. Grade reads **`side` + time**.

## Year-0 hung

| plate | k | glow `[on, off]` | kind | miss → |
|---|---|---|---|---|
| forest-run | 0 | 0.40 – 5.20 | **tap** | hall |
| L2 (only if hung) | 1 | reward, no 2nd cue | — | hall |
| decay | — | fridge (sat) | — | hall |

Hit → next faster plate, or hall if this is the only hung. Miss → hall (decay fridge until it walks 4 paws without sit).

**Tap counts.** Swipe-only with a player who taps = every run is F. `kind: tap`: any contact in the window is HIT. Swipe left also HIT. Early before `at − win` = ignore, not miss.

Judge coyote (`win` 2.4 on year-0) is the run, not a 0.5 s guitar-hero. Glow in the picture is the telegraph. No chrome.

Pop after the window: HIT / LATE / MISS. Never TAP / NOW. Never a fill-bar. Never a cyan `drawbox`.

## Arm the clock

Do not judge until **this** plate's `currentTime < 1.2`. Enter-B leftover time firing MISS at 0 s is `judge.stale`. Early tap = ignore. Auto-miss only after `at + win` (full window), not `win * 0.7`.

## Machine

```
0 ≤ on < off ≤ duration
year-0: off − on may be the run (wide)
N ≤ 3  ·  no overlap
```

FAIL → do not Hang. Identity C = `.smoke/<id>/` every 0.5 s accurate seek. Human gate = 5 taps.

## One line

**The chart is a JSON after the scrub.** Glow = when. Tap in the window = HIT. Miss = hall. The thumb is the gate. No rectangle.

# 26b — Frost sprint plan (10 plates)

**Sealed 2026-09-21.** Worked example of [26](26-biome-sprint-plan.md). Hang ≠ wipe. `road-frost.mp4` = P0 KEEP. Never overwrite.

## Spine

Bolt runs the frozen nationale while the glacier-sky **wakes**. First the lanterns of the ice-dead remember light. Then a star falls. The aurora answers. The mountains start to shed. The storm becomes a character. He never leaves the 1-point cone. Each success, the world recalls one more still. Each miss, it forgets the last.

Camera every plate: lock-off chase, dashes straight, VP fixed. Spectacle = the **event**, not a new angle.

---

## Table

| # | file | m | +1 still | hazard | expect | beat |
|---|---|---|---|---|---|---|
| **P0** | `road-frost.mp4` | 0 | — | none (teacher) | 0 | Empty nationale. Aurora. The cone. |
| **P1** | `road-frost-d1.mp4` | 1 | ice lanterns + crystal flora on the **sides** | cyan star **speck** at the VP, center ray | 1 | Lanterns wake. A star appears far ahead. |
| **P2** | `road-frost-d2.mp4` | 2 | (keep lanterns) | ice **meteor** grows in **center** lane only; L/R open | 1 | The star becomes a meteor. Dodge the middle. |
| **P3** | `road-frost-d3.mp4` | 3 | aurora ribbons denser / more alive | meteor remnant or second streak, still 1-lane | 1 | Sky answers the impact. Same road. |
| **P4** | `road-frost-d4.mp4` | 4 | — | **right mountain calves** — icefall into **right** lane only | 1 | The cliff sheds. Run left or center. |
| **P5** | `road-frost-d5.mp4` | 5 | wind / ice motes (weather) | icefall stays 1-lane | 1 | The air fills. The mountain still throws. |
| **P6** | `road-frost-d6.mp4` | 6 | rune-crystals in the **left** wall | icefall or a small center comet | 1 | The glacier writes on the stone. |
| **P7** | `road-frost-d7.mp4` | 7 | — | **two** events: center meteor **and** right icefall → **left** is the corridor | 2 | Twin threat. One lane free. |
| **P8** | `road-frost-d8.mp4` | 8 | aurora storm peak (sky only) | same twin or a single fat center comet (`expect 1`) | 1 or 2 | The sky goes feral. Cone does not move. |
| **P9** | `road-frost-d9.mp4` | 9 | distant ice shrine on a cliff | last **comet**, center; mountains tremble on the **sides** (décor, not a wall) | 1 | Last dash. Then Lena. |

P1 hung today is flora/lanterns **without** the speck — recook to match this row when touching d1. P2 hung meteor is **FAIL** law 25 (3-lane wall) — recook to this P2 (1-lane meteor, lanterns kept).

---

## Refs snowball

```
P0  KEEP
P1  KEEP + lanterns
P2  KEEP + lanterns + meteor-still
P3  … + aurora-ribbons
P4  … + (icefall is the hazard, not a still if it's I2V-on-KEEP)
…
≤12
```

Hazard may be composited on the KEEP still (tiny, far) rather than a separate décor ref. Décor stills never cover L/C/R.

## Cook gate

Each densify: `camera-1point.txt` + `hazard-1lane.txt` (name the event in the row) → law 23 PASS → law 25 `--expect` from the row → hang ADD.

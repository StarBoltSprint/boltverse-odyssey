# PLAYTEST — five blind fingers, then `L`

One page. Phone, 9:16, sound off first. Not a lore session.

`coming` stays true until this proto is PASS. Tester must **not** have set `on/off` (or they tap memory).

Cook: [COOKLANE.md](COOKLANE.md). Chart: [CUES.md](CUES.md). `L`: [scripts/cue-readability.mjs](scripts/cue-readability.mjs).

## 5 taps (per cued plate)

The tester gets **5 fingers** on this plate, not 50. Film rate = 1. `m` bar on or off: both runs if you can.

| # | Say | Note |
|---|---|---|
| 1 | « tap when you think you must » — **no** left/right | side + Early/Hit/Late/Miss |
| 2–5 | same / « again » | |

Do not say « the glow is on the left » between 1 and 5. Tap 1 Miss: write it, do not coach.

**Plate PASS playtest** if ≥3/5 Hit **and** majority side = cue `side`.  
≤2/5 Hit → window or gesture, not « they suck ».

Several cues: 5 taps on the **first** cue (hardest to teach). Later cues: 3 taps enough.

## `L` vs finger (FN / FP)

After the 5, you (or Grok) score 3 samples.

| | `L` readable | `L` not |
|---|---|---|
| Finger ≥3/5 | OK | **FN** — nudge `on`/`off` or noisy samples, **not** an immediate recook |
| Finger ≤2/5 | **FP** — `L` lied, recook glow/gesture, **never** Hang | OK recook |

FN = chart is there, the judge is harsh.  
FP = honesty would have hung a mute film.

A FP plate **never** `coming=false`.  
Two FN in a row on **edges only** → nudge 2 frames, re-5 taps.

## One line per plate

```
id | 5 grades | side ok? | L 3/3? | proto | action
forest-lean-L1 | H H L M H | yes | 2/3 | gray | off-3f, retest
```

No novel. Action ∈ `hang | recale | recuit | drop`.

## Keeper sequence

```
1. Metal (720, mute, first/last)
2. Identity first/mid/last (back, gait gray)
3. Stamp cues
4. L 3 samples
5. 5 blind taps
6. FN/FP
7. ρ / farm glow
8. Hang only if 5+6+7 PASS
```

Skip 5 because `L=1` = you Hang for Grok, not for a human.

## Whole minute (after plates)

One clean run ~6 plates. Quiet still calm (<8 s)? Peak only after 45 s **and** Hits? Decay on Miss?

Does **not** replace 5 taps **per** plate. A pretty minute with 2 FP plates = fragile kit.

## During proto, do not

- say « now »
- use the `m` bar as a metronome
- tap 20 times « for the average »
- grow coyote `C` to save the score

## One line

**Five blind fingers, then `L`. If they disagree, believe the finger and look at the window vs the film.** Hang only when the eye *and* the thumb say yes.

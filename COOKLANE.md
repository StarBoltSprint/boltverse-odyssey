# COOKLANE — the sprint minute, not a tiny citadel

Hall cook = `node scripts/cook-room.mjs moss`  
Lane cook = `node scripts/cook-biome.mjs forest`  
Smoke Lane = `node scripts/smoke-biome.mjs forest` — **not** smoke-pack.

Palette = [palettes/forest-palette.json](palettes/forest-palette.json). Chart = [CUES.md](CUES.md).  
`L` = [scripts/cue-readability.mjs](scripts/cue-readability.mjs). Proto = [PLAYTEST.md](PLAYTEST.md).

```
cook-biome   → mute films, cues []
scrub        → films/<id>.cues.json
validate-cues + smoke-biome + smokeL
5 blind taps (PLAYTEST)
then coming: false
```

Skip the 5 because `L=1` = Hang for Grok, not a human. FP plate never `coming=false`.

Encode **H264 `-an`**. Do not cook walk-A as the sprint.

## Count — hung year-0 is 1 plate until L2 QC-passes

calm ×3 · lean ×4 · peak ×2 · decay ×1 — **fridge** until they pass sit/gait.

Year-0 hung file: `forest-run.mp4` (one gallop, k=0). Do not hang L1+L2 if either sits.

Law 0: calm/decay first = last. Lean/peak first → **running** last, never a standing hold. `L` 3/3. Gray ≠ recook.

---

## Chain — one path, not 4 photos

Ban: cook 4 leans **in parallel** from `lock/bolt-back`.  
That is 4 restarts of the same forest. Cut 0 ms → **teleport**.

```
still_0          (four paws, already running — never sit)
  → clip 1   first=still_0   NO standing last_frame
still_1 = last FRAME of clip 1                copy, not a new Imagine
  → clip 2   first=still_1   NO standing last_frame
```

Law: `last(n) === first(n+1)` **as files**. Same dog, **same crystals**.  
The world **advances**: a crystal he passed in clip 1 is **gone** in clip 2.  
If the vanishing point resets, it still reads as 10 s + 10 s even when the pose matches.

After the mp4 exists, **overwrite** `stillEnd` with the extracted last frame. Next `first` is that file. Imagine's hoped still is not the joint.

Plate 2+ is animated **from that last frame** (morph). A standing restart at the join is a speed dump.

`cook-biome` / `cook-hung` does this in **order**. It does not `imagineStill` from bolt-back for plate 2+.

Smoke: `lane.joint` if last(n) is not first(n+1). Do not Hang.

## Gallop — NEVER a standing last_frame

This is why Bolt braked at the join and sat mid-plate.

`last_frame` of a **standing** still (station-L, hold, sit) **forces** Imagine to slow to a stand. Illegal on lean/peak.

Lean/peak cook:

- `kind` is **not** `walk` with a hold still
- I2V from the running first only
- T = **6 s** (10 s sits)
- Last frame of the mp4 must still be a **gallop** (four paws, spine level). If it sits, **do not hang**. Trim to the last running second or recook (cap 2).

Decay is the only plate allowed to walk/slow. Decay that sits/sniffs = fridge, miss → hall.

## Pace — the actual formula

`playbackRate` = **1**. Nothing in the player multiplies speed.  
`r` is relative stride vs plate 0. Cooked into the film. Not 2/3/4 labels.

```
r(k, t) = min( r_max,  r0 · q^k · (1 + γ · t/T) )
```

| symbol | value | meaning |
|---|---|---|
| `k` | 0, 1, 2, … | hung index on a **clean** run |
| `t` | 0 → T | time inside the plate |
| `T` | **6 s** year-0 (10 s sits) | plate length |
| `r0` | **1.00** | L1 / forest-run = the reference |
| `q` | **1.20** | each next plate starts 20 % faster |
| `γ` | **0.10** | +10 % inside a plate |
| `r_max` | **1.80** | cap — no smear |

Join without a dump needs `q ≥ 1+γ`. 1.20 > 1.10, so the cut **steps up**, never down.

Year-0 hung (what door B plays):

| plate | k | t=0 | t=T | gait |
|---|---|---|---|---|
| forest-run | 0 | **1.00** | **1.10** | gallop every frame |
| L2 (only if 0 sits) | 1 | **1.20** | **1.32** | longer stride |
| peak (later) | 2 | **1.44** | **1.58** | stretch |

L1 → L2 cut: **1.10 → 1.20**. Morph, already running, slightly faster. Never 1.10 → 0 (stand).

Fail `lane.slow` if:
- first frame of k+1 is a stand (`r ≈ 0`)
- stride of k+1 at t=0 is shorter than last frame of k
- a later hung plate is slower while the player is still on the clean path

Fail `lane.sit` if **any** 0.5 s sample is sit / poop / profile / howl. First-and-last QC is not enough.

Decay is the only legal slow-down, and only after misses. Not on a clean run. Sitting decay = do not hang.

Old plates were not cooked against this. Recook from a **running** first, in order, or the files stay random Imagine jogs.

## Fork — one plate, one act

Illegal wobble (prompt crime: keep running straight):

```
center → 30 cm left → center
```

Nothing to tap. Glow lies. `lane.wobble` FAIL.

Legal lean, **without** profile (muzzle still banned):

```
the ice FORKS
he TAKES one vein (L or R)
he STAYS          cx 0.50 → 0.35 and HOLDS
glow on THAT vein
back, two ears, yaw < 40 degrees
```

One plate = **one act**. Return to center = **another** plate, another tap.

Peak = the hard cut (L to R or a fallen crystal). Same chain law. Same back. Faster than the leans (`k=2`).

## Stations

C = center path. L = left vein. R = right vein.

Every plate has `from` to `to`.  
`pickNext` may only pick a plate whose `from` = current `to`.  
Hung year-0 is a **path of stations**, not a drawer shuffle (`L1` then `R1` from C = illegal).

Example hung: `forest-run` (already on the left vein, gallop). Next legal is `lean-L2 L to L` only if QC 0 sits and faster.

Smoke: `lane.station` if hung[n+1].from != hung[n].to.

## QC — accurate seek or you hang a sit

`ffmpeg -ss T -i file` lands on a **keyframe**. Gallop keyframes hide sits. Playtest then looks like shit.

```
ffmpeg -i plate.mp4 -ss T -frames:v 1   # -i THEN -ss
```

Sample **every 0.5 s**. Sit / profile / howl anywhere = `lane.sit`. Do not Hang.

## Cache — phones ignore `?uXX` on mp4

Same path after recook = the sitting ghost. **Rename** the hung file (`forest-run.mp4`) **and** bump PACK. [HANG.md](HANG.md)

## Opening calms

Three standing calms at the start = 35 s of nothing. Fridge, not the hung file.  
Year-0 hung = gallop. Calm-1 is optional **one** breath, standing 4 paws — never sit / howl / profile.  
Handoff still kisses first hung still ([HANDOFF.md](HANDOFF.md)).

## One line

**`smoke-biome` grades the file. Five fingers grade the chart.** Hang only when both say yes.  
A lean is a **fork he keeps**. A join is a **copied last running frame**. No standing `last_frame`. `r` only goes up on a clean run. QC every 0.5 s with accurate seek. Never 4 forests from one lock still.

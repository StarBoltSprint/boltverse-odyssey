# Layer C — Grok vision (one rule, no sermon)

**Walk last 2 seconds = ONE dog.** A second Bolt at spawn/center = `FAIL clone.two_dogs @ t=last`.

**Walk is one trip.** Mid-clip snap back to spawn = `FAIL graph.walk_return`.

**Coat:** FULL white. Zero black. [CHAR.md](../CHAR.md).

Look at the 3 frames Smoke extracted:

```
.smoke/<clip>/first.jpg
.smoke/<clip>/mid.jpg
.smoke/<clip>/last.jpg
```

Hall refs: stills + `lock/bolt-back.jpg`. Lane refs: **same thumb** (pose, not freeze-paws). Return **one line**: `PASS` or `FAIL <rule> @ t=0|t=mid|t=last`.

## Hall stills (hard — do not Hang)

Spawn / at-A / at-B / first+last of a hall film: **STANDING**, back, two ears, four paws on the floor.

| if you see | rule |
|---|---|
| sitting, haunches down, poop | `FAIL identity.sit` (machine `gate.sit` even if bboxH/H is 0.35–0.40) |
| face, snout toward camera | `FAIL identity.face` (machine: dark muzzle in the upper-center) |
| 3/4 or profile | `FAIL identity.three_quarter` / `identity.profile` (machine `gate.yaw` &gt; 28° on stills) |
| oval / blob / wood leaf instead of RECT teal/gold rifts | `FAIL identity.door_morph` / `identity.door_wood` |
| at-A / at-B still is mid-hall / spawn (center + both doors + fork) | `FAIL gate.place` (machine: atA cx ≤ 0.38, atB cx ≥ 0.62; spawn-cx 0.42–0.58 dies) |

A cute sit is still FAIL. Soft KEEP of a sitting at-A is illegal.

## FAIL rules (hall + Lane)

| rule | if you see |
|---|---|
| `identity.face` / `muzzle` / `look` / `profile` / `three_quarter` | face, snout, 3/4, profile |
| `clone.two_dogs` / `clone.ghost` | second body |
| `identity.coat` / `saddle` / `black_silhouette` / `cape` | not full white |
| `identity.text` | TAP, UI, watermark |
| `identity.orbit` | dolly / tilt |
| `gait.muzzle` | sprint mid but head turned |
| `gait.paws_first` / `gait.paws_last` | first or last with only 2 pegs |
| `gait.float` | belly, 0 paws, melting into the path |

## Lane gait (not a second identity)

Thumb = **back, 4 paws on the floor**. Sprint = **he runs**. A stride *hides* paws. Demand 4 crisp hooves on every frame = you cannot cook a Lane. Let everything through = 3/4 and melt pass too.

**Never moves (even peak):** back / withers to camera · 4 limbs (not 3, not a werewolf) · white, size stable, lock-off. Thumb is the **pose** ref, not « freeze paws the whole plate ».

Honest occlusion — a few frames, still reads as a quadruped from behind:

| OK | Not OK |
|---|---|
| Rear passing behind the other (trot / gallop) | Paw melted into the path |
| Foreleg up, pad off floor 2–4 frames | Both fores gone a long time (sit / heroic rear) |
| Tail / flank hiding a hock | Belly + 0 paw = float |
| Snow / glow eating a foot 1–2 frames | Glow replacing the dog |

Count paws on **first / mid / last**, not every lift frame. Reuse the 3 `L` samples:

```
first  : paws >= 3  AND back
mid    : paws >= 2  AND back  AND not profile
last   : paws >= 3  AND back
no sample in muzzle / 3/4
```

Calm / decay ≈ still — 4 paws most of the time. Lean / peak: gray is **mid**. First/last at 2 paws = FAIL (monster at the join).

Mid profile even with 4 paws = `identity.profile` (yaw), not a gait issue.

Do **not**: allow 3/4 « to sell speed » · ffmpeg-loop a 1-paw mid to save `L` · a second thumb `bolt-run.jpg`. Profile = other `railsVersion`, recook the **whole** kit. Year-0: no.

If he turns anyway → recook, do not loosen Hamming.

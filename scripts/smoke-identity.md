# Layer C — Grok vision (one rule, no sermon)

**Walk last 2 seconds = ONE dog.** A second Bolt at spawn/center = `FAIL clone.two_dogs @ t=last`.

**Walk is one trip.** Mid-clip snap back to spawn = `FAIL graph.walk_return`.

**Coat:** white base forever (FULL white German Shepherd). That base never changes to grey / silver / black. Décor-matching **SKINS ON TOP** of the white base (ember glow/ash, ice) are OK — stylish adaptation, not a different dog. [CHAR.md](../CHAR.md).

Look at the 3 frames Smoke extracted:

```
.smoke/<clip>/first.jpg
.smoke/<clip>/mid.jpg
.smoke/<clip>/last.jpg
```

Hall refs: stills + `lock/bolt-back.jpg`. Return **one line**: `PASS` or `FAIL <rule> @ t=0|t=mid|t=last`.

## Hall stills (hard — do not Hang)

Spawn / at-A / at-B / first+last of a hall film: **STANDING**, back, two ears, four paws on the floor.

| if you see | rule |
|---|---|
| sitting, haunches down, poop | `FAIL identity.sit` (machine `gate.sit` even if bboxH/H is 0.35–0.40) |
| face, snout toward camera | `FAIL identity.face` (machine: dark muzzle in the upper-center) |
| 3/4 or profile | `FAIL identity.three_quarter` / `identity.profile` (machine `gate.yaw` &gt; 28° on stills) |
| wood leaf / ajar timber | `FAIL identity.door_wood` |
| chrome UI rectangle / orb overlay as the door | `FAIL identity.door_chrome` |
| morphing blob / spinning puddle (unstable fill) | `FAIL identity.door_morph` |
| oval **or** RECT teal/gold energy with jambs + sill | **PASS** — do **not** FAIL oval shape alone |
| at-A / at-B still is mid-hall / spawn (center + both doors + fork) | `FAIL gate.place` (machine: atA cx ≤ 0.38, atB cx ≥ 0.62; spawn-cx 0.42–0.58 dies) |

A cute sit is still FAIL. Soft KEEP of a sitting at-A is illegal.

## FAIL rules (hall)

| rule | if you see |
|---|---|
| `identity.face` / `muzzle` / `look` / `profile` / `three_quarter` | face, snout, 3/4, profile |
| `clone.two_dogs` / `clone.ghost` | second body |
| `identity.coat` / `saddle` / `black_silhouette` / `cape` | grey/silver/black **base** (not a white GSD). Ember/ice skin ON TOP of white ≠ this FAIL |
| `identity.text` | TAP, UI, watermark |
| `identity.orbit` | dolly / tilt |

If he turns anyway → recook, do not loosen Hamming.

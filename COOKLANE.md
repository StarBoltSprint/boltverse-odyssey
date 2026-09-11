# COOKLANE — floor 1 of the sprint disc

Hall cook = [COOKROOM.md](COOKROOM.md) / `cook-room.mjs`.  
This page fills a **BiomeRow** ([BIOMES.md](BIOMES.md)). Not a catalog paint. Not `cookRoom`.

Law 0 is the same ([COOK.md](COOK.md)). Plus two duties: the body **runs** as the disc says, and the **glow is in the mp4**.

Prompt = `worldLine` + `pathLine` + [CHAR.md](CHAR.md). No Hall′ in a walk. No free-text jungle.

## Law 0 clips

Same API, same anchors. Invert them → Imagine invents the trip and clones the dog.

| kind | Call | `image` | `last_frame` |
|---|---|---|---|
| breath | `image` + `last_frame` | still of **this** pose | **the same** still |
| walk | `image` + `last_frame` | start still | arrive still, **distinct** |
| enter (later) | same | at-sill | fill / veil — **never** spawn′ |

Breath without `last_frame`: yaw, a step, ice-PCA — first ≠ last, seal dead.  
Walk on one still: fantasy interpolate, last ≠ official at.

Duration: Lane walk ~**10 s** (whole gait, arrive ~8 s, hold). Breath **6 s**, loopable. Played QTE plate: 6–15 s ([PLAY.md](PLAY.md)).

Chat `reference_to_video` is illegal. Hooks: [scripts/imagine-hooks.mjs](scripts/imagine-hooks.mjs).

## Sprint gait

The hall **walks** (a few steps, back).  
The Lane **sprints** on run plates — not however it wants.

- Feet on the floor. No levitation, no morph.
- Camera **lock-off** (`railsVersion`). Yaw 40° / ice-PCA “profile” = FAIL identity + lock. Recook. Do not gel to save a ¾.
- No dolly that sells the door.
- **Even gait** the whole clip. Arrive and hold. No last-second rush that shifts the cues.
- Lane breath: idle / vapor, **feet glued**. A step = `graph.breath_drift` (same as the hall).

**Sprint is the disc, not an excuse to break CHAR.** Identity thumb stays the back.  
If the row is still `lockoff-back-v1`, a ¾ clip is off-rails. Bump `railsVersion` only if you **change the law** and recook the whole stock.

## Glow in the encode

On a **played** plate (walk / bone plate — not every breath):

The cue is not JSON floating. It is a light **in** the picture during `[on, off]`: path in front of the paws, living oval, fork that lights.

Smoke PLAY = *cue honesty*: a human sees **when** to act from the film only. If you need “TAP”, the plate FAIL. [DONT.md](DONT.md) §7. [PLAY.md](PLAY.md).

Cook:

- glow is **generated** with Imagine (prompt: luminous path, no UI text), **or** composited after — always **in** the hung file, never an engine overlay
- write `[on, off]` **after** the clip, on the real glow — not “we’ll add glow later”

Breath / decay: often **no** cue (Idle). Do not force a glow on a glued-feet loop.

Tap = Bolt’s gesture in that frame. Straight run → no L/R cue.

## Cap 2 + gel

Same airlock as `cookRoom`.

```
FAIL n < 2  → same anchors, recook
FAIL n = 2
  breath → ffmpeg loop of the still
           only if that still already PASS size / identity
           then smoke the loop
  walk   → drop that edge; both walks FAIL → kit = coming
  spawn still rotten → no gel that “saves” the biome
```

**Gel ≠ PASS.** Loop FAIL / punch-in / face still → stay `coming`. Do not hang “so they can see”.

Gel of a breath that only had a micro-step: OK net, the player idles.  
Never: lower Hamming, crop a muzzle, Hang for playtest.

Lane: glow missing after 2 tries ≠ a hall walk you can still ship. Without honesty the row stays `coming` **for play**. You may keep the clips for the pose graph. You do **not** wire cues. You do **not** hang a hall door.

## File (min stock)

```
spawn + identity (i2i lock)
smoke stills
breath-spawn (image + last_frame identical)
walks (first ≠ last, 10s, glow in encode)
breaths at (6s, pose pinned — never complete spawn)
decay (calm i2v of spawn, or freeze)
smoke each
write cues on walked / tapped plates, on the real glow
drop coming only if honesty OK
```

No Enter in this file. No A↔B until the 7+2 PASS.

Not `node scripts/cook-room.mjs forest` — that is a citadel paint.

## One line

**Same anchors as the hall, a body that runs without turning its head, light in the file, two tries then a net — the net does not forgive a rotten still.**  
Law 0 kills the clone. The glow kills the HUD. The cap kills infinite cook.

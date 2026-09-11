# FAIL — silent. The dog never leaves the picture.

Not “hide the bug.”  
**The dog stays on screen. The tap stays live. The kitchen does not show.**

Empty domain = decay / stock. Never a spinner on Bolt. FAIL does not Hang. Smoke is the gate ([CLIP.md](CLIP.md) [SMOKE.md](SMOKE.md) [HOLD.md](HOLD.md)).

## The one law

Picture-time stops only if the player hits Pause.  
Cook, tab, Imagine, 404, Smoke FAIL: **not** play time — and **not** an error screen.

The player may see:

- stock (floor 0), or
- last good still / last PASS pack, or
- one line **after**: `atA : face` — **not** while Bolt spins in a void

The player may **not** see: Forge, % bar, black plate, “generating…” on the wolf.

## Matrix

| Where it breaks | Player | Kitchen (log) |
|---|---|---|
| Unknown id / missing pack | `/` → **stock** | `pack.missing` |
| Cook in flight | stock (or previous pack) | job running |
| Spawn still FAIL ×2 | stock, no `/r/mousse` | `spawn identity.face` |
| atA FAIL, spawn PASS | no films; stock link + reason | recook atA abandoned |
| Walk-A FAIL, stills PASS | hall playable **without** that edge: tap A from spawn = **stay** | `walk-spawn-A graph.last_not_official` |
| Breath-A FAIL | ffmpeg **loop of still** atA (freeze) | `breath freeze-fallback` |
| Enter FAIL / not hung | 2nd tap = **stay** (floor 1) | no edge |
| `play()` iOS / autoplay | still under the video, taps live | `play.rejected` — walkingRef = false |
| Swap too early (black frame) | do not paint; still stays | [ENGINE.md](ENGINE.md) |
| Veil / double rAF miss | does not exist on floors 0–1 | floor 3 only |
| Hash last frame black (mp4 tail) | do not Hang that clip | `probe.last_black` → re-extract −40 ms |
| Lane `last(n) ≠ first(n+1)` | do not Hang that kit | `lane.joint` — recook as a chain |
| Lane wobble (center→side→center) | do not Hang that plate | `lane.wobble` — one act, stay |
| Hung `from` ≠ previous `to` | do not Hang | `lane.station` |
| Lane plate n+1 slower than n on a clean run | do not Hang | `lane.slow` — standing start / shorter stride |

None of this opens a modal.

## Three fallbacks, in this order

1. **Previous PASS plate** of *this* pack (last good atA if the walk failed)
2. **Freeze the still** (breath that walked → jpeg loop). Better than an invented step
3. **Stock** (golden). Always there

Never “step down” into black. The still underlayer *is* the player’s visual fallback. Silent fail on the job is the same reflex: always a legal photo under the eyes.

## Quiet vs one sentence

**Quiet (during play)**  
Recook, encode, PACK, Smoke vision, missing clip, Enter not ready, tap ignored during a walk.

**One sentence, after, off-plate**  
Only if the *promised* product does not exist: they asked moss, they got stock. Then: `moss : atA face — original hall`.  
Not a #704 sermon. A code + the link that still works.

Keeper / debug: the full log. Player: nothing, or that line. [START.md](START.md)

## Incomplete graph is not an error

`room.json` with walk-A-B `required: false` and no file: `edgeFor` + hung probe → **stay**.  
That is a valid floor-1 hall. Not a crash.

Same for Enter: `ENTER[moss].A = null` → stay. The player does not fetch the mp4.

The noisy fail is: try the clip, 404, flash black. So: **test the edge before kick**. No file = no kick.

A Lane kit whose hung path teleports (`lane.joint`), wobbles (`lane.wobble`), or decelerates on a clean run (`lane.slow`) is the same: **coming**, no `kind:sprint` door. Stay in the hall. [COOKLANE.md](COOKLANE.md)

## Recook: silent for the player, capped for the forge

Max 2 per plate. Counter in the job, not on screen.

After 2: stop spending Imagine. Pick a fallback (freeze / drop edge / stock).  
A cook that recooks without a cap is no longer silent: it is just slow, and someone will “check how it’s going” = Forge.

## Player already (do not break)

[ENGINE.md](ENGINE.md):

- still opacity 1 except during enter
- paint only if `paused === false`
- play() fail → walking false, still, taps on
- two videos, never a single `src=` that empties the screen

Product silent-fail **leans** on that. The job must not serve a pack the player cannot fall back from (audio that kills autoplay, wrong size, empty first frame).

## Traps (fail that thinks it is silent)

- “Subtle” spinner at the bottom: still chrome on the clock. No
- Breath freeze **mid-tap** without a still: hole. Always the jpeg under the videos
- “generating…” inside the Imagine plate. Smoke / cook **outside** the 9:16
- Video 404 with empty poster. Preload + missing edge = stay
- Half-cooked Hall′: better no edge than curtain + clone. Silent = **no Enter**, not “almost Enter”
- Four parallel leans from bolt-back: looks done, plays as 4 teleports. Silent = **coming**, not “hang the wobble”
- playbackRate 1.1 to “fix” a slow plate: fakes the film. Recook faster. Silent = `lane.slow`

## Test

Cut the network mid-walk.  
Expected: last still of that pose, taps work, or cached breath.  
Not: wheel, not: “retry”.

Ask `dusk` while atB is FAIL.  
Expected: you play stock (or a PASS remix). One line somewhere off-film.  
Not: a broken preview with 2 stills of 3.

## One line

If it fails, the graph shrinks or we serve the original hall. The dog does not leave the picture. The error is a log. Play is still a breathing photo.

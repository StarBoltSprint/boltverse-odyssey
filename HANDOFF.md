# HANDOFF — one joint, not a third engine

Hall just finished **Enter** (`kind: sprint`). Lane starts a **calm** minute. Between them: curtain + clock reset. Same 40/20/40.

Hall Enter cook: [ENTER.md](ENTER.md). Lane play: [PLAY.md](PLAY.md). Link: [LINKS.md](LINKS.md).

## Must be true first

```
ENTER[from].A = { kind: "sprint", to: "forest", clip: films/enter-a.mp4 }
to ∈ biomes.ids
row forest coming === false
enter PASS (first = at-sill hall, last = fill/veil — NEVER Lane spawn)
palette forest.calm-1 on disk
```

Else 2nd tap = **stay**. No live Imagine. No « loading sprint ».

## Clocks at `ended(enter)`

| | |
|---|---|
| `m` | **0.12** — new minute, do **not** carry hall `m` |
| `t_run` | **0** — starts only when hid `paused === false` |
| `peakBan` | false |
| `lastT` | null |
| `tier` | calm |
| `sheet` | cues of `forest-calm-1` |
| `kind` | `sprint` |

Tapping doors well ≠ start in lean. Quiet still wins.

## Picture

Same curtain as Hall′:

1. last frame enter still visible
2. empty veil of **that** door, opacity 1, double rAF
3. still = **first of calm-1** already under the veil (same railsVersion)
4. hide enter 0 ms
5. `kick` hid = `forest-calm-1.mp4`, loop false, rate 1, `-an`
6. veil 500 ms → 0
7. `onLaneTime` may tick only once hid is playing

Last(enter) **kisses** first(calm): same lock, same dog size. Ideal: last = hold on the ice path, first calm = that hold starts to run. Not a citadel spawn in the center if calm is already in stride.

Mismatch → short dissolve **under** the veil. No spinner.

## Five states (that is the machine)

```
hall-breath
hall-walk
hall-enter      ← 2nd tap armed only
handoff         ← ended(enter) … hid sprint playing
lane-running
```

```
hall-enter + ended     → handoff     HOLD swap, veil, m=0.12, t_run=0
handoff + hid playing  → lane-running
handoff + play-fail    → still last-enter or forest decay, stay, no cook
lane-running + exit    → hall-breath dest   (other edge, return)
```

During `handoff`: taps ignored (HOLD). A queued finger is dropped. First calm cue opens only in `lane-running`.

## Refuse

- walk hall → calm with no enter
- keep hall `t_run` / `m`
- start lean because they tapped well
- auto-enter from peak
- WASD · `playbackRate` 1.1 « to launch the race »

## Audio

Join: bus 1 → `lit-calm` (or mute year-0). Bus 2 silence. HOLD handoff = mute. Enter mp4 `-an` too.

## Return

Lane → hall = **another** edge + ticket if you want. `m` and `t_run` **die**. Dest = hall breath-spawn. Do not glue the last peak plate as a citadel still.

## One line

**Enter poses the dog; calm-1 makes him run; `m` and `t_run` are born at zero when hid plays.** Five states. One curtain. One calm reel. The hall stops at the sill.

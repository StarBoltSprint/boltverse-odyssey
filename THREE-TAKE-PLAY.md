# THREE-TAKE-PLAY — 3.50s player contract (SmiR)

**Cold-start.** Hall / citadel is a **different job**: [COOK.md](COOK.md). Do not apply this page there.

Cook / stack law: [FILM-STACK.md](FILM-STACK.md) + [COOK-BIOME-25D.md](COOK-BIOME-25D.md). This page is the **play clock** that those files do **not** yet hold.

This repo is the **recipe**. Play lives in bolt-hybrid `play/`. Do not scaffold a player. Do not publish a new grok.me.

**Test 3.50 s:** at that instant on mid, a swipe to L must show L **already at 3.50 s**, same paws, no poster, no pan.

`play/` already has vis/hid swap for *plates* (`dom-swap`). That is **NOT** L/M/R. Do **not** extend `kick()` for this — `kick` resets `currentTime = 0`. 3-take = **three living players**, one clock.

---

## 0. Files per plate

```
films/plate-N-L.mp4
films/plate-N-M.mp4   ← master
films/plate-N-R.mp4
```

Same target duration, 720×1280, **no audio**, same encode, ideal same GOP.

ffmpeg recipe (same spirit as [COOK-BIOME-25D.md](COOK-BIOME-25D.md), plus a short GOP):

```
ffmpeg -i in.mp4 -map 0:v:0 \
  -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" \
  -c:v libx264 -pix_fmt yuv420p -g 15 -keyint_min 15 -sc_threshold 0 \
  -an -movflags +faststart out.mp4
```

`-g 15` ≈ keyframe every 0.5s at 30fps. Without it, `currentTime = 3.50` often snaps to 3.00.

Smoke cook **before** swipe:

- `|duration(L)-duration(M)| < 80ms` (same R)
- first/last frame: same road, Bolt only lane-offset
- if L FAIL → mid + cutout, do **not** ship a broken 3-take

Without three KEEP takes, frame-perfect swipe does not exist — ship mid-only.

---

## 1. Three `<video>`, not carousel

Stacked same 9:16 rect. Visible opacity 1, others opacity 0 **but stay in DOM** (hot decode). `poster` banned on L/R. `display:none` banned.

Boot: load all three, play all then pause L/R (or keep running opacity 0), M plays, lane=M.

---

## 2. One clock

- `clock() = videos.M.currentTime` always (mid master)
- `seekReady(v,t)`: if drift > 1 frame, set currentTime, await `seeked` (cap ~180ms)
- `slideChange(to)`: no L↔R skip; sync incoming to clock; match playbackRate; seekReady; play; opacity 1; hide/pause outgoing (or keep decode)
- Swipe threshold ~40px; edge bump CSS no 4th take
- Tick ≥10Hz: rate from mid curve; apply to all; re-snap L/R to mid if drift >1 frame; **never** snap mid onto L
- Player pause: pause all three at same t
- onEnded: only if mid ended and not paused → plate N+1, all three to 0 together

---

## 3. Automated 3.50 test

1. play mid
2. at rVFC when `M.currentTime ∈ [3.48, 3.52]`
3. `slideChange("L")`
4. next visible L frame: `|L.currentTime-3.50|<1/30`, L not paused, opacity L=1 M=0
5. canvas frames L vs M at same t → Bolt lane-shifted, road did not pan

Also test **7.20**.

Fail table:

| Symptom | Cause |
|---|---|
| L at 0.00 | reused `kick()` |
| L frozen | `play()` missing / poster |
| L at 3.00 | GOP too long / no `seeked` |
| road slides | mid+`translateX` |
| paws jump | cook duration/tempo mismatch |
| black flash | opacity before `seeked` |

---

## 4. Ship order

1. one biome one plate three KEEP takes
2. minimal page three videos + swipe + log `t_mid`/`t_in`
3. pass 3.50 **AND** 7.20
4. then `rate(t)`, plate 2, howl/pause
5. cutout only if L or R smoke-FAIL

Ban: mix gallop-card + 3-take; 280ms dissolve (cut must be 0ms); pan mid while waiting for L.

---

## 5. Harness without real L/R

Ship harness on three **identical** mid copies named L/R. 3.50 swipe must pass (same image, same t) to validate clock. Then replace with real takes.

---

## Which job

| Human says | Job | Page |
|---|---|---|
| citadel / salle / hall | Bolt **in** the stills | [COOK.md](COOK.md) |
| biome / sprint / lane **living-film** | Bolt **baked into** the reel | [COOKLANE.md](COOKLANE.md) |
| **2.5D** / empty plate / film-stack / gallop layer | empty reel + Imagine video layers | [FILM-STACK.md](FILM-STACK.md) + [COOK-BIOME-25D.md](COOK-BIOME-25D.md) |
| **3-take** / swipe lane / L M R **play clock** / 3.50 | three living players, one mid clock | **this page** |

Hall `dom-swap` / `kick()` stitches **plates**. It does not become L/M/R.

---

## One line

**At 3.50 s on mid, swipe L → L is already at 3.50 s, same paws, no poster, no pan. Three `<video>`s. One mid clock. Never `kick()`.**

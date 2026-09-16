# PLAY — B-stack Sprint (road + Bolt cutout)

**Cold-start.** Hall / citadel is a **different job**: [../COOK.md](../COOK.md). Do not apply hall portals or `cook-room` slots here.

This page is the **Engine lock** for Biome / Sprint. Cook: [GROK.md](GROK.md). Player reference: [reference/LanePlayer.tsx](reference/LanePlayer.tsx). Console: [CONSOLE.md](CONSOLE.md).

This repo is the **recipe**. Do **not** scaffold a player. Do **not** publish a new grok.me. Open Sprint on the native Grok Build game console (in-app).

---

## Which stack (read this first)

**B stack is the default runner.** Road empty-plate + Bolt cutout. Two living videos. One clock.

| Stack | When | Road | Bolt |
|---|---|---|---|
| **B stack (DEFAULT)** | this runner | empty plate mp4 — **ZERO Bolt** | Imagine **cutout / gallop video** on top |
| 3-take L / M / R | **not default** — do not cook unless SmiR reseals it | path + Bolt painted into each take | not a cutout |
| C-light | **cancelled** — do not invent | — | — |

Do not mix stacks in one play. Do not slide a whole mid clip sideways and call that a lane change.

---

## B stack

```
[ road  <video>  — empty plate, full 9:16, ZERO Bolt ]     MASTER CLOCK
[ bolt  <video>  — cutout / gallop, planted lower-third ]
```

| Lock | Law |
|---|---|
| Road | Full-frame empty plate. **ZERO** dog. **ZERO** luminous follow-path. Rails / curbs OK. Lock-off camera. Travel **baked in** the clip. |
| Bolt | Separate Imagine **gallop / cutout** video. Full-white German Shepherd, back to camera, teal collar. Décor-matching skin ON TOP OK. Soft black / alpha key. Preserve paw dust. |
| Dual dogs | Plate + layer both showing a dog = **FAIL**. Recook the plate empty. |
| Plant | Pivot at paws / `groundY`. Skating (cutout floats) is a plant bug, not “Imagine bad paws.” |
| Clock | **Road is master.** `clock() = road.currentTime`. |
| seek-sync | r19wide: if `\|bolt.currentTime − clock % bolt.duration\| > 0.08`, seek the cutout. **Never** snap the road onto the cutout. |
| Key | Bolt uses the `#bolt-luma` SVG hard-key (`is-luma`). Soft `mix-blend-mode: screen` is not the Live stack. |
| VER | Cache-bust `/master/road.mp4?v=r19wide` + `/master/bolt.mp4?v=r19wide`. |
| Loop | **loop forever** while the session is open: `muted playsInline autoPlay loop` + watchdog re-`play()` on `pause` / `ended`. |
| Audio | Films stay **`-an`**. No wallet. No API keys in the client. |
| Chrome | No TAP / NOW. No fill-bar. No cyan drawbox. No HUD. Hits are on the 9:16 picture. |
| Swipe | [docs/03-decoupe-swipe.md](docs/03-decoupe-swipe.md) — découpe / plant the **cutout** on the same road. Road keeps scrolling. |

`kick()` that resets `currentTime = 0` is **banned** for lane change (that is hall plate-stitch).

---

## One clock (seek-sync)

r19wide stack (`VER = r19wide` in [reference/LanePlayer.tsx](reference/LanePlayer.tsx)):

```
clock     = road.currentTime
target    = finite(bolt.duration) ? clock % bolt.duration : clock
seekReady = if |bolt.currentTime − target| > 0.08 → bolt.currentTime = target
tick ~400ms (+ after swipe / visibility):
  keep both playing (muted playsInline autoPlay loop)
  seekReady(bolt, clock)
  never seek the road onto the cutout
```

Player pause → pause **both** at the same `t`.  
`ended` on the road (and not paused) → loop watchdog, or advance to the next hung road plate **with the cutout seeked to the same t** (usually 0 together).

Encode so seeks land: H264, `yuv420p`, `-an`, `+faststart`. Short GOP (`-g 15`) if swipe tests snap to the previous keyframe.

---

## Loop forever

Same product law as the citadel teasers:

```
muted playsInline autoPlay loop
+ watchdog re-play() on pause / ended
```

Chat mp4s are **teasers**, not hitboxes. Play videos loop while the session is open.

---

## Identity

Bolt is **ALWAYS** a full-white German Shepherd (white coat forever). That base never changes to grey / silver / black. Décor-matching skin ON TOP OK. Not a different dog. Back only on the cutout. [../CHAR.md](../CHAR.md).

---

## Banned

| Symptom | Cause |
|---|---|
| Two Bolts | dog baked into the road plate |
| Cutout at 0.00 on swipe | reused hall `kick()` |
| Road seeks to follow the dog | inverted clock |
| Picture stops | paused the road; or `display:none` the master |
| Wallet / Connect / client key | not this product |
| 3-take L/M/R shipped as default | cancelled as default — B stack only |
| C-light bus as a required lock | cancelled — do not invent |
| New grok.me | recipe only |

---

## One line

**Road scrolls. Cutout is the dog. One clock. Seek-sync. Loop forever.**

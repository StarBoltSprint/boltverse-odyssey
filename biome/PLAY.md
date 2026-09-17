# PLAY — B-stack Sprint (road + Bolt cutout)

**Cold-start.** Hall / citadel is a **different job**: [../COOK.md](../COOK.md). Do not apply hall portals or `cook-room` slots here.

This page is the **Engine lock** for Biome / Sprint. Cookbook (what worked r38): [docs/06-techniques.md](docs/06-techniques.md). Key: [docs/05-key.md](docs/05-key.md). Player: [reference/LanePlayer.tsx](reference/LanePlayer.tsx). Cook how-to: [GROK.md](GROK.md). Console: [CONSOLE.md](CONSOLE.md).

This repo is the **recipe**. Do **not** scaffold a player. Do **not** publish a new grok.me. Open Sprint on the native Grok Build game console (in-app).

---

## Which stack (read this first)

**B stack is the default runner.** Road empty-plate + Bolt cutout. Two living videos. One canvas.

| Stack | When | Road | Bolt |
|---|---|---|---|
| **B stack (DEFAULT)** | this runner | empty plate mp4 — **ZERO Bolt** | Imagine **cutout / gallop video** on top |
| 3-take L / M / R | **not default** — do not cook unless SmiR reseals it | path + Bolt painted into each take | not a cutout |
| C-light | **cancelled** — do not invent | — | — |

Do not mix stacks in one play. Do not slide a whole mid clip sideways and call that a lane change.

---

## B stack

```
[ road  dual <video>  — empty plate, full 9:16, ZERO Bolt ]   MASTER CLOCK
[ bolt  <video>       — green-screen gallop, keyed on canvas ]
[ canvas              — the picture. Decoders are hidden.   ]
```

| Lock | Law |
|---|---|
| Road | Full-frame empty plate. **ZERO** dog. **ZERO** luminous follow-path. Rails / curbs OK. Lock-off camera. Travel **baked in** the clip. Dual decoders + hold — no black flash at the loop. |
| Bolt | Separate Imagine **gallop / cutout** video. Full-white German Shepherd, back to camera, teal collar. Green packaging OK — canvas keys it. |
| Dual dogs | Plate + layer both showing a dog = **FAIL**. Recook the plate empty. |
| Plant | Pivot at paws. Skating (cutout floats) is a plant bug. Shadow = paws ellipse `source-over`. |
| Clock | **Road is master.** Cutout runs on its own loop; do not `kick()` to 0 on swipe. |
| Key | Canvas: Vlahos `greenness = G − max(R,B)` + despill + 1px feather + **crown sat kill** (pipe). `#bolt-luma` SVG is **retired**. [docs/05-key.md](docs/05-key.md). |
| VER | Cache-bust `/master/road.mp4?v=r38` + `/master/bolt.mp4?v=r38`. |
| Masters | In-repo under [master/](master/README.md) — r38 KEEP `road.mp4` + `bolt.mp4` + `road.jpg`. Do **not** substitute [`stock/biome/`](../stock/biome/README.md) teasers. |
| Loop | Dual road + watchdog re-`play()`. Never `clearRect` the plate. |
| Audio | Films stay **`-an`**. No wallet. No API keys in the client. |
| Chrome | No TAP / NOW. No fill-bar. No cyan drawbox. No HUD. Hits are on the 9:16 picture. |
| Swipe | [docs/03-decoupe-swipe.md](docs/03-decoupe-swipe.md) — plant the **cutout** on X only (`SHIFT = 30`). Road keeps scrolling. |

`kick()` that resets `currentTime = 0` is **banned** for lane change (that is hall plate-stitch).

---

## Loop forever

```
muted playsInline autoPlay
+ dual road swap near end
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
| Black flash | `clearRect` / single decoder loop |
| Swiss-cheese dog | RGB color-line matting on the body |
| Potato skull | Fourier / shape matte |
| Gold rectangle on the head | missed crown sat kill (`v < 230`) |
| Wallet / Connect / client key | not this product |
| 3-take L/M/R shipped as default | cancelled as default — B stack only |
| New grok.me | recipe only |

---

## One line

**Road scrolls. Canvas keys the dog. X plant. No redraw of the silhouette.**

# 06 — techniques that actually worked (r38)

Kitchen cookbook. Phone recordings of the Live, one bug at a time.  
**Code:** [../reference/LanePlayer.tsx](../reference/LanePlayer.tsx). Law: [05-key.md](05-key.md) · [03-decoupe-swipe.md](03-decoupe-swipe.md).

One picture. Two films. Canvas does the rest. **Do not redraw the dog.**

---

## Floor (do not reopen)

| Piece | What |
|---|---|
| Road | One empty-plate mp4. **ZERO dog.** Dual `<video>` + hold canvas. |
| Bolt | One green-screen gallop mp4. White GSD, **strict rear**, teal fabric collar, `#00FF00`. Law: [10-bolt-cutout-law.md](10-bolt-cutout-law.md). |
| Picture | One `<canvas>`. Decoders hidden (0×0, opacity 0). |
| Plant | `drawImage(boltHold, dx, 0)`. `dx = (SHIFT/100)*width`. `SHIFT = 30`. **X only.** |
| VER | `/master/road.mp4?v=r38` + `/master/bolt.mp4?v=r38`. |

Not three films. Not a luma SVG. Not a pan of the road.

---

## Keep — in paint order

### 1. Dual road + hold (kills the black flash)

Two decoders on the same `road.mp4`. Near the loop, swap to the other which is already primed. Stamp the last good frame into `roadHold`. **Never** `clearRect` the plate. A single decoder seeking to 0 paints black for one frame — that is the flash.

### 2. Vlahos chroma (kills the green packaging)

```
greenness = G − max(R, B)
greenness > 16 and G > 40  →  α = 0
greenness 4…16             →  ramp α + despill G ← max(R,B)
leftover G > max(R,B)      →  clamp G
```

Color **difference**, not brightness. Cream fur, wet road, gold pipe are all bright — luma cannot tell them apart.

### 3. 1 px alpha feather (kills the sticker)

Opaque pixel with a transparent 4-neighbour → drop α by neighbour count. Hard matte reads as a cutout sticker on a phone.

### 4. Crown sat × band (kills the gold pipe, keeps the skull)

The pipe is glued on the head (~80 px, sat ~0.55). Fur sat ~0.28.

1. Find the **true silhouette top** (first row with α > 40). Not “white fur top”.
2. Band = that row **+ 100 px**.
3. Kill only `sat > 0.44` **and** `R > B+16` **and** `R ≥ G`.
4. **No luma cap.** `v < 230` lets sunlit gold survive.

Sunset on the crown is gold *and* bright. If you cut “everything above white fur”, the back becomes the top and the skull is sliced.

### 5. Paw blob + ellipse shadow (kills the float)

Scan α>40 stride-2 → centroid + paw span. Two `source-over` ellipses at the paws. **No** `multiply`, **no** `filter` — Samsung skips both and the dog hovers.

### 6. Pure X plant (kills rotate/skew)

`SHIFT = 30` (% of frame). Tween 220 ms ease-out. Edge **bumps**. Road never pans. `kick()` to `currentTime = 0` is hall stitch — **banned** on swipe.

### 7. Watchdog

`muted playsInline autoPlay`. Re-`play()` on `pause` / `ended` / `visibilitychange`. Bolt loops on its own clock. Road is master for the picture, not a seek-sync of the dog.

### 8. Dual road as **dealer** (cousin plates)

Empty is the clock. Bar / meteor are cousin mp4s with the **same** first/last stills. Two decoders, pre-arm next, swap in the last 0.28 s. `last(cousin)` must be `first(empty)`.

### 9. Jump + solid box (not a flash)

Swipe up clears low hazards. Collision = occupied **lane** × time window (`t0`–`t1` of that plate). While overlapping: **pause** road + gallop until sidestep. Meteor `t0` is late (~0.80) — freeze ON the rock, not 20 m early. Full cook: [09-recette-biome.md](09-recette-biome.md).


---

## Tried and killed

| Technique | Fail on phone |
|---|---|
| RGB color-line matting (fur / dark legs) | shadows fall off-line → Swiss-cheese dog |
| Fourier / shape matte | ears are high-freq → potato skull |
| Luma mask / SVG `#bolt-luma` | green, fur, pipe all bright |
| `v < 230` on the pipe | sunlit gold (~80 px, sat 0.55) survives |
| Cut everything above “white fur top” | sunset sat on the crown → head sliced |
| Color-line on the **body** after chroma | holes in the coat |
| 3-take L / M / R | cannot sync three films; not this runner |
| CSS `translate3d` + luma-filtered `<video>` | sticker edge, no crown kill |
| `multiply` / CSS `filter` shadow | skipped on Samsung |
| One decoder, seek to 0 | black flash |
| Recook as the fix for a key bug | you are painting around a compositor bug |
| “Explosion/crater” prompt for a 1-lane hazard | Imagine fills all three lanes |
| First-frame close-up of the hazard | pops on Bolt at dealer swap |
| `--match` SAD on a blooming plate | false-fast px/s → plate is slowed |
| Hit window t0 ≈ 0.5 on a distant meteor | freeze meters before contact |
| Stun / lock lanes on hit | player cannot sidestep the box |

---

## One line

**Chroma for the screen. Saturation × crown band for the glued gold. Dual hold for the loop. X plant. Do not redraw the dog.**

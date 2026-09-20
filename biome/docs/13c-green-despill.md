# 13c — Green key + despill (cutout factory)

HARD LOCK companion to `13-make-bolt-lane.md` + `13b-anti-sticker-contact.md`.  
**Green is only for making the cutout.** It is not the world. The world stays an empty-road plate. Bolt stays a keyed layer on the ribbon.

Companion: `10-bolt-cutout-law.md` (B → green → key), `12` / `invertRibbon`, cook tool optional `biome/scripts/chroma-despill/` when hung.

## What the green shot is for

One (or a few) gallop loops of the dog on green → clean alpha → park that loop on \(P(s,\lambda)\) and grade to the plate.

Do **not** put a green-screen Bolt into Imagine and hope the plate eats him. That is a sticker with a green fringe.

| Backing | Use |
|---|---|
| Green / chartreuse | Filmed dog, cheap key |
| Renderer straight alpha | Prefer; skip green |
| Black | Only if fur is never black-tipped |
| Imagine empty road | **Never** as the key plate — that is layer A (world) |

## Shoot / render green

**Render (best for a Lane)**  
- Isolated dog, no ground in the beauty  
- Studio light you will **throw away** in the grade  
- Premultiplied PNG/WebM with real alpha if possible (green then optional)  
- If green only: even cyc, no shadow on the cyc, paws not clipped  

**Film**  
- Even green, not sun-dappled  
- Nothing near key-green on the dog  
- Locked cam, behind-shoulder height  
- Treadmill or short pass; time-warp to plate time  
- Optional dirt-paw reference pass — not the beauty  

## Key without a green halo

1. Key the green (despill toward plate ambient, not magenta)  
2. **Premultiply** by alpha  
3. ~1 px Gaussian on the **coverage** ring, not RGB alone  
4. Hold out lowest ~5% of legs so plate grain shows at the paws  
5. Never unsharp the outline after the key  

If green remains in the coat → despill (below). Do not only raise the key threshold (eats fur).

## Two jobs people mix

| Job | Tool |
|---|---|
| Coverage (where is the dog) | Key / alpha |
| Color (no cyc in the coat) | Despill on RGB, masked by alpha |

Do not use despill to invent alpha. Do not use a harder key to invent despill.

---

## Classic despill (fast)

Spill = additive green in RGB, worst on half-covered edges and pale fur.

**Channel clamp:** screen channel \(S=G\), \(C=\max(R,B)\):

\[
G' = G - k\cdot\max(0,\,G-C)
\]

\(k\in[0.7,1]\). On white fur, \(k=1\) can go magenta — put a little of the removed green back as luminance into R/B, or use vector despill.

**Edge lerp to plate wrap:** on the 1–2 px ring, lerp RGB toward a blurred plate sample at the shoulders. Film owns the fringe.

**White coat:** start \(k\approx 0.6\)–0.8. Ember: leave warmth. Frost: go harder. Mask with alpha — never despill the whole plate.

---

## Vector despill (measured axis)

Treat spill as a **direction**, not “G is too big.” Subtract only excess along the cyc axis; replace toward coat (core) or plate (edge).

### Measure once per shot

1. \(\mathbf{s}\) — empty cyc (median patch), or leftover green holes  
2. \(\mathbf{n}\) / coat floor — clean fur patch (cyc off or flagged) → \(u_{\mathrm{coat}}\)  
3. \(\mathbf{t}_{\mathrm{edge}}\) — plate wrap (shoulder L/R samples)  
4. \(\mathbf{t}_{\mathrm{core}}\) — clean coat target  

Do not assume \((0,1,0)\).

### Per pixel

Screen coordinate of \(\mathbf{c}\) on \(\mathbf{n}\to\mathbf{s}\):

\[
u=\frac{(\mathbf{c}-\mathbf{n})\cdot(\mathbf{s}-\mathbf{n})}{\|\mathbf{s}-\mathbf{n}\|^2}
\]

\[
\beta = k\max(0,\,u-u_{\mathrm{coat}})
\]

Subtract \(\beta\) along screen axis; add \(\beta\) toward \(\mathrm{lerp}(\mathbf{t}_{\mathrm{core}},\mathbf{t}_{\mathrm{edge}},\mathrm{edge})\).  
Optional weak magenta-axis suppress (\(k_m\sim 0.2\)–0.4) so \(G\)-pull does not go pink.  
Work linear / plate working space. Premul buffers: unpremultiply → despill → premultiply.

### Cook-tool API (when hung)

```js
const { buildModel, despillPixel, despillSample } = require('./vectorDespill');

const model = buildModel(cycSamples, coatSamples, plateSamples);
const rgb = despillPixel([r, g, b], model, 0.75, edge);
// edge: 0 = core (coat), 1 = fringe (plate wrap)

const out = despillSample({ rgb, a, premul: true, edge }, model, {
  k: 0.75,
  kMagenta: 0.25,
});
```

Path when present: `biome/scripts/chroma-despill/vectorDespill.js`.

### What “advanced” does not mean

- A network that “removes green” from the Imagine **road** plate  
- Despill as a substitute for a bad key  
- One global matrix for every biome  

---

## Order that does not fringe

```text
1. Key           → alpha
2. Despill       → RGB  (alpha-limited)
3. Premultiply
4. ~1 px Gaussian on premul coverage
5. Grade to plate (lift / rim / sat)     // see 13b
6. Composite: plate * contact(P(s,λ)) + Bolt
7. Shared grain
```

Despill **before** premultiply. Premultiply **before** edge blur. Grade **after** despill (do not grade lime).

Green lives only in the pipeline that produces cutout **B**. If you still see green in the Lane, the key/despill leaked — do not “fix” by baking him into empty road **A**.

```text
A  empty road mp4 + path.json
B  keyed gallop loop (green or straight alpha) ← green ends here
C  compositor: plate + contact + Bolt@P(s,λ) + holdouts + grain
```

## FAIL

- Green Bolt cooked into Imagine world plate  
- Despill without alpha mask (greys the moss)  
- Same despill target on ember and frost  
- Harder key instead of despill (eats white coat)  
- Premultiply before despill on straight RGB  
- Skipping contact / paw anchor after a perfect key (still a sticker — see 13b)

Sealed 2026-09-20 — green factory + despill for Lane cutouts.

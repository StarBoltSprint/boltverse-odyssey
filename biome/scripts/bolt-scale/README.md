# bolt-scale — auto size Bolt to the road

Cook/play helper. **Grok must not pick Bolt size by eye.**

## Idea

1. Measure cutout bbox (width at stance, withers height) from keyed cycle.
2. Measure lane width at paw plant from `path.json` (`w(s)`) or plate mask.
3. `computeScale` → one `scale` that puts Bolt at ~40% of lane width and withers in **0.22–0.32** of frame height.
4. Play: `scaleAtS(base, w(s), wRef)` follows perspective.

## API

```js
const { computeScale, scaleAtS, assertScale, laneWidthAt } = require('./boltScale');

const laneWidthPx = laneWidthAt(pathTable, sSpawn, frameW);
const r = computeScale({
  boltWidthPx,
  boltWithersPx,
  laneWidthPx,
  frameH,
});
assertScale(r); // throws on FAIL
// composite: draw cutout at r.scale, paws on P(s,λ)
```

## Gate

Smoke **FAIL** if `laneFrac > 0.55` (dog≈truck) or withers outside band.  
PRIORITY 0 with REUSE cycle + composite light/contact.

## Demo

```bash
node demo.js
```

# bolt-scale — auto size Bolt to the road

Cook/play helper. **Grok must not pick Bolt size by eye.**

## Idea

1. Measure cutout bbox from keyed cycle: stance width, **withers at the shoulders** (not ear tips).
2. Measure lane width at paw plant from `path.json` (`w(s)`) or plate mask.
3. `computeScale` → one `scale`. **HARD:** `laneFrac` in **0.30–0.55** (k ≈ 0.40). **Soft:** `withersMin` unless `hardWithersMin`.
4. Play: `scaleAtS(base, w(s), wRef)` follows perspective.

## API

```js
const { computeScale, scaleAtS, assertScale, laneWidthAt } = require('./boltScale');

const laneWidthPx = laneWidthAt(pathTable, sSpawn, frameW);
const r = computeScale({
  boltWidthPx,
  boltWithersPx, // shoulders, not ears
  laneWidthPx,
  frameH,
});
assertScale(r); // throws on laneFrac FAIL (dog≈truck)
// composite: draw cutout at r.scale, paws on P(s,λ)
```

## Gate

Smoke **FAIL** if `laneFrac > 0.55` (dog≈truck).  
`withersMin` is soft unless `hardWithersMin`.  
PRIORITY 0 with REUSE cycle + composite light/contact.

## Demo

```bash
node demo.js
```

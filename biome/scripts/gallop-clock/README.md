# gallop-clock — sync sealed Bolt cycle to plate time

Stops Grok from playing `lock/bolt-gallop-cycle.mp4` as stop-motion.

## HARD rules

1. Play the sealed cycle at **native fps (96)** — never step 1-of-N.
2. Master clock = **`plate_time`** (picture time while playing), not `Date.now`.
3. `strideHz ≈ 4` — road `ds` must match (anti-skate).
4. Smoke **FAIL** if dog effective fps ≪ plate fps.

## API

```js
const { frameAtPlateTime, dsPerFrame, assertGallopClock } = require('./gallopClock');

const { frame, phase } = frameAtPlateTime(plateTime);
const ds = dsPerFrame(strideLengthPx, plateFps);
assertGallopClock({ dogFramesShown, windowSec, plateFps });
```

## Demo

```bash
node demo.js
```

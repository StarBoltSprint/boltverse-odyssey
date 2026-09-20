# gallop-clock — sync sealed Bolt cycle to plate time

Stops Grok from playing `lock/bolt-gallop-cycle.mp4` as stop-motion.

**Canon:** `CYCLE_FPS=96`, `CYCLE_FRAMES=534`, `STRIDES_PER_CYCLE=22` (~5.56 s). Play: `loop=true`, rate 1×. Never seek every frame. Never harvest 534 canvases. Old 0.93 s / 89-frame lock = archive — `assertCanonCycle` **FAIL**. Law: [15-gpu-compositor](../../docs/15-gpu-compositor.md).

## HARD rules

1. Play the sealed **6 s / 534-frame** cycle at **native fps (96)** — never step 1-of-N.
2. Master clock = **`plate_time`** (picture time while playing), not `Date.now`.
3. `strideHz ≈ 4` — road `ds` must match (anti-skate).
4. Smoke **FAIL** if dog effective fps ≪ plate fps.
5. **FAIL** if the play cycle is `lock/bolt-gallop-cycle-0.93s-prev.mp4` (89-frame archive).

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

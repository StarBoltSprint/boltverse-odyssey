# 03 — découpe / swipe

B-stack swipe is **not** three baked takes. The **road keeps scrolling**. The finger **découpes** (cuts / plants) the Bolt cutout on that road.

## Law

| Lock | Law |
|---|---|
| One road | The empty-plate `<video>` never pans to fake a lane. Camera stays locked. |
| Cutout moves | Swipe left / right **plants** the cutout in L / M / R **X** on the same picture. |
| Lunge | Short lean / lunge, then the cutout **already stands** on the new plant. Not a carousel of posters. |
| Clock | After the plant, **seek-sync** still owns `currentTime`. Do not `kick()` to 0. |
| Edge | Edge **bumps** — no fourth plant. |
| Threshold | ~40 px horizontal, horizontal must win vs vertical. |
| Picture | Never stops. Do not `display:none` the road. Opacity 0 on a helper layer is OK; the master stays in DOM. |

## Not this

- 3-take L / M / R as the default (cancelled as default)
- One-clip **pan / slide** of the whole road as a “lane change”
- Frozen stills sold as side lanes
- Hall `dom-swap` `kick()` (resets time)

Reference plant + pointer: [../reference/LanePlayer.tsx](../reference/LanePlayer.tsx).

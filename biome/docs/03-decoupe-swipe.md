# 03 — découpe / swipe

B-stack swipe is **not** three baked takes. The **road keeps scrolling**. The finger **découpes** (cuts / plants) the Bolt cutout on that road.

## Law

| Lock | Law |
|---|---|
| One road | The empty-plate never pans to fake a lane. Camera stays locked. Dual decoders + hold so the loop never flashes black. |
| Cutout moves | Swipe left / right **plants** the cutout in L / M / R **X** on the same picture. Canvas `drawImage(bolt, dx, 0)`. |
| Plane | Bolt stays in the same plane. **No rotate, no skew, no diagonal lean.** |
| Amplitude | r38: **30 %** of frame width per lane (`SHIFT = 30`). Edge **bumps** — no fourth plant. |
| Clock | After the plant, both films keep running. Do not `kick()` to 0. |
| Threshold | **12 px** horizontal; vertical must not win (`|dy| > |dx| * 2.2` is ignored). Edge tap = left 38% / right 38%. |
| Picture | Never stops. Decoders stay in the DOM, zero-size, opacity 0. The **canvas** is the picture. |

## Not this

- 3-take L / M / R as the default (cancelled as default)
- One-clip **pan / slide** of the whole road as a “lane change”
- Frozen stills sold as side lanes
- Hall `dom-swap` `kick()` (resets time)
- CSS `translate3d` on a luma-filtered `<video>` (retired). Plant is canvas X.

Key / crown: [05-key.md](05-key.md). Reference: [../reference/LanePlayer.tsx](../reference/LanePlayer.tsx).  
Living-film Lane (ribbon + arc-length, not SprintCore): [12-lane-path-ribbon.md](12-lane-path-ribbon.md).

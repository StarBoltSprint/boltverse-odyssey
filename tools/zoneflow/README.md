# tools/zoneflow

Fixture for the clearing → corridor → clearing handoff. The plates in `fixture/` are synthetic and labelled **TEST FIXTURE - not Imagine**. They are not a cook and not a KEEP.

Runtime: [`biome/scripts/zone-flow`](../../biome/scripts/zone-flow/README.md).

The tile grid for a straight corridor is [`tools/wfc-path`](../wfc-path/README.md) ([doc 68](../../biome/docs/68-wfc-path-placement.md)). Its `world_corridors` records use the same keys as `fixture/world.json`. That command does not edit this fixture.

```bash
node tools/zoneflow/selftest.mjs
```

`fixture/index.html` plays the same walk in a browser: preload, crossfade, speed-tied corridor rate, idle at speed 0, then the next clearing. The previous plate's `src` is cleared after the fade. Bolt's element is pointed at `lock/bolt-gallop-cycle.mp4` or `lock/bolt-idle-breath.mp4`. This page does not cook either file.

## What is checked

| Check | Where | FAIL when |
| --- | --- | --- |
| `transition` | `layout.py check --world world.json` | The corridor is missing, `bakedGroundSpeed` is not above 0, the ground file is missing, or a gate named by the corridor is not in that zone's `clearing.json`. Omitted when `--world` is absent. |
| `transition_black` | `tools/playcheck` | `snapshot().transition` is present and a frame is black (luma under 12 on at least 92% of sampled pixels), or `black` was not measured. Omitted when no transition sample was captured. |
| `transition_hitch` | `tools/playcheck` | The largest `hitchMs` in those samples is over 100. Omitted when no transition sample was captured. |

## Honest limits

- The fixture clearings have no edge ring. `layout.py check` on them fails the zone rows. Only the `transition` row is the claim, and the selftest checks that row on this world and on the layout sample.
- Black frames and hitches are not measured inside `tools/layout`. Layout does not read a framebuffer.
- `lock/bolt-idle-breath.mp4` may be missing. The fixture names that path and does not invent a clip.
- The ground file is a short synthetic encode so the page has a video to rate. It is not an Imagine corridor.

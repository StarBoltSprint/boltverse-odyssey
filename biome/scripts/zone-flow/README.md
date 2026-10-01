# zone-flow

Handoff for a world of free-walk clearings linked by a straight corridor.

Clearing A → corridor → clearing B. The corridor is a fixed path. Its Imagine ground video plays at `boltSpeed / bakedGroundSpeed`. Under `0.05` m/s the rate is `0` and Bolt uses `lock/bolt-idle-breath.mp4`. At or above that speed Bolt uses `lock/bolt-gallop-cycle.mp4`. Those two files are named, not cooked.

Code computes when to show which already-cooked plate, the playback rate, and the crossfade weights. It does not draw, shade, or colour a world pixel. A 360° ring stays the far backdrop of a clearing. It is not the corridor floor.

## Runtime

`createFlow(world, { zones })` reads gate triggers from each zone's `clearing.json` (`gates[].id`, `heading_deg`, `width_m`, `leads_to`). Heading `0` is `+z`, `90` is `+x`. The mouth sits on the ring at that heading.

- Within `preloadM` of a mouth (default 8 m) the next corridor video and the next clearing are loaded.
- Within `triggerM` (default 1.5 m), facing the gate, the crossfade starts (`fadeMs`, default 400).
- If the next plate is not ready, the current plate stays at full weight. The handoff waits. That is the hold that avoids an empty frame.
- Weights sum to 1. For `0 < u < 1` both weights are above 0. The previous zone's source is cleared only after the fade finishes.

`judgeTransition(samples)` is the playcheck half: any black frame fails, and a hitch above 100 ms fails. A black frame is luma under 12 on at least 92% of the sampled pixels. No samples means the caller omits the rows.

## Honest limits

- This module does not decode video and does not measure a GPU hitch by itself. The page passes `hitchMs` and either `black` or `rgba`.
- `lock/bolt-idle-breath.mp4` may be absent from a checkout. The path is still the idle clip. Do not cook a replacement.
- Opacity on two cooked plates is a composite of those pixels. It is not a new picture.

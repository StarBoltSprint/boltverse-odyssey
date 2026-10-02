# COLD — sprint camera (paste into Imagine + before hang)

**Tool feedback (law 65):** if a repo tool let a defect through, reported a wrong number, or was hard to use, finish the take, write `feedback/<date>-<tool>.md`, and open it upstream. [`65-tool-feedback-loop.md`](65-tool-feedback-loop.md).

Read `biome/docs/24-camera-1point.md`.

Sprint Video A = **conical 1-point lock-off**. Not 2-point. Not 3-point.

1. `@ref` the empty KEEP still (geometry is in the pixels).
2. Paste `biome/prompts/camera-1point.txt` into every empty / densify Imagine call. Do **not** add φ / 0.618 / UV tables.
3. Composite hazards onto that still (1–2 lanes). Do not let I2V rebuild the road.
4. `python3 biome/scripts/plate-geo-qc/plate-geo-qc.py <plate.mp4>` must PASS (law 23). FAIL = recook.

2-point = look aside (turn / ¾ / door). 3-point = plongée ciné, not a minimap (minimap = ortho).

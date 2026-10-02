# COLD — sprint camera (paste into Imagine + before hang)

**Tool feedback (law 66):** if a repo tool let a defect through, reported a wrong number, or was hard to use, finish the take, write `feedback/<date>-<tool>.md`, and open it upstream. [`66-tool-feedback-loop.md`](66-tool-feedback-loop.md).

Read `biome/docs/24-camera-1point.md`.

Sprint Video A = **conical 1-point lock-off**. Not 2-point. Not 3-point.

A **level** plate puts the horizon at **0.50** (720×1600 → row 800). Verticals stay parallel. The Frost KEEP diamond at **0.38** is a pitched cone. Use it only when the pitch in degrees is written in the spec and in the prompt. Do not mix 0.38 into a level plate. Law 23 still walks dashes toward 0.38; do not retarget it. Long form: [`learn/geometry.md`](../../learn/geometry.md).

1. `@ref` the empty KEEP still (geometry is in the pixels).
2. Paste `biome/prompts/camera-1point.txt` into every empty / densify Imagine call. Do **not** add φ / 0.618 / UV tables.
3. Composite hazards onto that still (1–2 lanes). Do not let I2V rebuild the road.
4. `python3 biome/scripts/plate-geo-qc/plate-geo-qc.py <plate.mp4>` must PASS (law 23). FAIL = recook.

2-point = look aside (turn / ¾ / door). 3-point = plongée ciné, not a minimap (minimap = ortho).

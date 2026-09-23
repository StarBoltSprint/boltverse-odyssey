# COLD START — Imagine live light (law 39)

Read [39-imagine-live-light.md](39-imagine-live-light.md) before cooking a GPU prop.

1. Name the plate's three colors. Do not invent a new light.
2. Imagine **one** video: object alone, pure black, contact on the bottom edge (or one ring with black margin), slow loop, 720p, 6 s. No camera move. No ground plane.
3. Measure the contact line in the frame. That is the base UV.
4. Hidden looping `<video>`. Upload every frame. Draw with `uClean` and **return**. Threshold `smoothstep(0.04, 0.18, luma)`. Premultiply. Never the bib grade.
5. Plant with `howlPose`. Spawn in the howlable band (`z` about `0.32–0.42`), drift `0.055`, cap 2, one per lane.
6. Tap on the quad fires the howl at that prop and shatters it on `hit`.

Fail if the prop is a still, if the shader tints it toward the road, or if it pops in the sky.

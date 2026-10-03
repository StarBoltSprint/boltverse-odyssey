# Ship turnaround pack

> **Superseded by [`docs/METHOD.md`](../docs/METHOD.md)** for hard objects (ships, gates, wrecks): real 3D, measured-section method VALIDATED 2026-10-03. Kept for history; not deleted.

Owner-approved **2026-10-02**. Practice. Not an xAI seal. Store only. Do not cook from this page.

Visible pixels stay Imagine stills. Code may place the ship, collide with it, and apply the law 67 fog, grade, and bloom. A mesh is invisible volume. It is never the skin.

The calibrated turnaround stays rail 12 and [`learn/geometry.md`](geometry.md): **8** views at **45°** or **4** views at **90°**, elevation **+15°**, one distance, one focal length (about **24°** horizontal field), at most **5** sources. `--report turn` reads that row. This pack does not replace it. A 120° arc still does not pass that row.

## 1. Least drift

Reference-image chaining. One front plate. Every later angle is an edit with the front as source 1 and the previous angle as source 2. The same camera sentence every time. At most **5** sources per edit.

No character sheet. It drifts inside itself. No video orbit for volume. It drifts in time. Pinned first and last is 720p interpolation, not a metric orbit.

## 2. Clip frames are sprites

**24–36** frames taken from a **15 s** orbit clip are sprites only. They are never a calibrated volume. Yaw steps in that clip are unequal.

The prompt for that clip:

> locked level camera, constant distance, ship centered, slow yaw only, no redesign, no zoom, no elevation change, gray studio, no ground contact shadow.

## 3. Volume

A visual hull with tolerance beats monocular depth fusion on **4–8** inconsistent views. IoU **0.47–0.60** is the expected band, not a bug.

Thin parts (antennas, fins) are invisible code primitives, or they are dropped.

## 4. Phone views

DRAFT — rejected as default by owner 2026-10-02: owner wants real 3D objects (invisible volume + projected Imagine views)

Sprite-swap by yaw is not the phone default. The crashed ship stays half-buried. **3–4** Imagine views (front, 3/4, side, optional back) can be projected. The exact picture method is not chosen. Invisible volume is for placement and collision.

Those named views are not the equal-step 8×45° / 4×90° set. `tools/objsheet/preflight.py --kind hero-ship` checks the 3–4 count. It does not choose the picture method.

## 5. Optional invisible mesh

A small image-to-3D mesh is allowed when the pixels stay Imagine. Volume only, never the skin.

| Tool | Size | Use |
| --- | --- | --- |
| TripoSR | about 6 GB | CPU works. Minutes per mesh. |
| Stable Fast 3D | about 6–7 GB | Allowed. |
| InstantMesh-large | about 24 GB | Skip. |

## 6. Wrap

Project each Imagine view from its known camera. Blend weight is `cos(yaw delta)`. The weight is zero past **45°**.

Magnification stays **≤ 1**. On-screen ship height in pixels is at most the source texture height. Never upscale a 720p plate onto **720×1600**.

## 7. Stable shapes

Thick symmetric silhouette. Few thin parts. No text. No asymmetric greebles.

The prompt rule on every later angle:

> do not redesign, only yaw changes, keep silhouette and proportions of source 1.

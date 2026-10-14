# Zone A — final 3D pass

Goal: loft faces stay at magnification ≤ 1, and every visible thing except the sky is a real solid. Far hills, ridges, and the remaining flat scenery become cheap LOD solids with parallax. The sky ring keeps only the sky.

Rails:

- Every visible pixel is an Imagine image or video already in the zone. No new Imagine cook unless a skin cannot be reused. Budget for this step: at most 12 images.
- The solid is the frigate method: an invisible loft, an unlit Imagine skin. Far objects use fewer sections and a skin already in an atlas.
- Magnification ≤ 1 on 720×1600, including a side face and the ground under a chase parked on the outer lip. No camera shake. No invisible wall.
- Phone: drawCalls ≤ 12, texMB ≤ 260, videos ≤ 4 including Bolt. Debug HUD only with `?debug=1`.
- Bolt stays the sealed gallop video. Do not recook a cycle.

Done when:

1. The 2026-10-05 08:14 rule is in `docs/METHOD.md` and `docs/METHOD/decisions-log.md`: everything visible is real 3D; only the sky is a backdrop.
2. No loft face stretch exceeds 1. The parked chase at the outer lip reports magnification ≤ 1 (the old bootMag 1.28).
3. Far hills, ridges, pebbles, and ground flecks are solids. The horizon ring shows no painted land. Two views about 90° apart show the hills moving against the sky.
4. Proof images and `proof.json` (drawCalls, texMB, max mag) are in `/workspace/grokcli/out/zoneA/3d-final/`. Root tests and playcheck pass.
5. The step is committed on `zone-a-3d-details`.

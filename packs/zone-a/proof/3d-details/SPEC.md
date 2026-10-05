# Zone A — Echo Shards and small details as hard objects

Goal: the Echo Shards and the most visible small details in zone A are real 3D solids. A walk around one shows a different Imagine side. Flat cards that face the camera are not the draw.

Rails:

- Every visible pixel is an Imagine image. Code builds the invisible loft, the placement, and the collider only.
- The solid is the frigate method: orthographic Imagine views measured and lofted, unlit skins from those same views.
- Magnification stays at or under 1. No camera shake. No invisible wall.
- Echo Shards stay pickups with no collider. Small details at or under Bolt height may stay non-colliding. A feature that already blocks uses the solid's own footprint.
- Phone: drawCalls at or under 12, texMB at or under 256 (playcheck texture_mem), active videos at or under 4.
- Debug HUD only with ?debug=1.
- Imagine images for this step: at most 16. A small Imagine mismatch is listed and left.

Done when:

1. All six zone A Echo Shards draw as one shared solid, and pickup plus Archives still work.
2. The six most visible small-detail types draw as solids. Tinier types are listed as known issues.
3. Two angles about 90 degrees apart change the shard and one detail. Captures and proof.json are saved.
4. Root tests and playcheck pass. drawCalls and texMB are inside the caps.
5. The step is committed on zone-a-3d-details with the known issues named.

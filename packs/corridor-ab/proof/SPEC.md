# Step — corridor horizon and one ground

Goal: on a 720×1600 view, the chase stays high behind Bolt and looks toward the horizon, and the floor reads as one continuous ground. Stick, paws, width, sprint, and seeded streaming stay as they are. No new Imagine file.

## Rails

- Eye height stays about 3.5 m. The pitch rises so the sky band is the top 30–35% of the portrait. Bolt's body stays in the lower third. A swipe up still looks up, then the same spring eases back to level.
- The arch (7.4 m) is fully inside the frame when it is 20–30 m ahead of Bolt. The phone field of view stays 22.7°.
- The floor uses one zone A ground still, the best wrap of the corridor set, at its native pixels. Every square samples that still. No second still, no resized copy, no drawn pattern.
- Sprint, the stream, the stick sign, and the paw line stay.

## Done when

1. Horizon sits between 30% and 35% from the top. Chase eye is 3.5 m and still behind Bolt. Stick-right still turns toward camera-right.
2. Bolt's body (about 1 m up) is below the lower-third line. The paw line stays on y = 0.
3. The arch top is inside the frame at 20 m and at 30 m ahead of Bolt.
4. The play page uploads one ground still, native size, and every floor quad uses that layer.
5. Sprint still climbs, and the same seed still streams more rocks at a faster pace.
6. `hang_selftest.py`, the play tests, and `renderlint` exit 0.
7. Proofs: walk and sprint stills at 720×1600, and a sprint clip at 24 fps under 15 MB.
8. No new Imagine file. The corridor WFC solve does not run during play.

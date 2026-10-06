# Step — corridor horizon break, seated rocks, whole monolith

Goal: on the existing corridor play page, the ground no longer ends in a ruler-straight line, every streamed rock sits in the ground through its rise, and the 28 m monolith stays whole when Bolt is close. Placement of already-cooked assets only. No new Imagine file.

## Rails

- The rest chase stays high behind Bolt (eye 3.5 m, pitch toward the horizon, sky band about 30–35%). A swipe still looks up and springs back. The camera never pitches further down at the ground.
- The hard horizon is broken by existing boulder and stone hulls scaled along the horizon, inside the forward view and clear of the run, plus light distance fog on the ground whose colour is sampled from the zone A sky. Fog stays inside the law 67 limits. If the sky sample fails, fog stays off. No typed colour. No extra sky texture upload. No flat cards.
- Every rock base stays at least 0.18 m below the ground plane for the whole emerge, including the rise. The rise starts from below the plane.
- The 28 m gate sits about 16 m off the run line, alternating sides, so the run clears its footprint and the monolith stays inside the 22.7° view while the top still fits. When it is in view, the pitch may rise by at most about 12° above the rest pitch. The rest pitch is unchanged when the gate is far or outside the view. The camera never pitches further down. The arch stays on the path.
- Phone budgets stay: 720×1600, draw calls ≤ 12, textures ≤ 260 MB, videos ≤ 4. Code does not draw pixels or meshes.

## Done when

1. Horizon silhouettes are existing boulder or stone hulls, at least 8 m tall, inside the 22.7° forward view, clear of the run by more than their footprint, and they share the hull draws already in the page.
2. Ground fog colour comes from a sky-slice average. Density and cap stay inside the law 67 limits. Bolt's own draw is not fogged.
3. A settled rock bottom is −0.18 m, and a rising rock bottom is lower than that.
4. The gate's lateral offset is about 16 m. While it is in the forward view, the pitch-up keeps the 28 m top inside the frame, stays within about 12° of the rest pitch, and never goes below the rest pitch. Far away, the pitch equals the rest pitch.
5. Walk still shows fewer rocks than sprint. The arch stays on the path. The WFC solve does not run during play.
6. `hang_selftest.py`, the play tests, and `renderlint` exit 0.
7. Proofs: walk and sprint stills, a 24 fps clip passing the monolith, and a close-up of grounded rocks. Phone draw calls, texture MB, and jsMs stay inside the budget.
8. No new Imagine file.

# Owner taste

## Golden rule

The game's unique identity is a living painted film. Every visible pixel comes from Imagine images and videos (no classic 3D models, no computed lights). The hero Bolt is an Imagine video of the wolf gallop. The universe comes from the owner's 800+ public X decrees. Every new idea must reinforce this look and never drift toward a classic 3D game.

## Style rules

Short summary of the log below. When a new reaction changes a rule, add a sentence here and keep the old row.

- Sharp edges and a distinctive silhouette. A safe rounded shape chosen to pass a check is a FAIL.
- No circles. Large organic biomes stay.
- A mark on a hull is etched into the surface: angular, dark violet, weathered. A round emblem pasted on like a sticker is a FAIL.
- The black angular ship with purple lightning cracks is LOVE.
- The rounded egg-pod ship is FAIL.
- Spherical or blob rocks, and identical capsule views, read as a demo. FAIL.
- A speed-tied scrolling ground video is KEEP.
- A ruin base that floats above the drawn relief is a FAIL. A black unpainted hull face is a FAIL.
- Orbit views that show two different ships are a FAIL.
- A menu hall is a high-tech citadel: dark metal, glass, holographic light, a window to space. A gothic stone hall and a stone door plate are a FAIL.
- Anything the player can walk up to, other than the sky, is a real solid. Far LOD is a cheaper solid. A card, a billboard, or a sprite for that object is a FAIL.
- A sky video laid on an already-full still is a FAIL. A planet that is drawn, small in the frame, or not actually rotating is a FAIL.
- A collision that is not the drawn face is a FAIL. A near rock replaced by a stepped box is a FAIL.
- View drift and specks stay. Another cook spent on them is a FAIL.

## How to append

Append a row at the bottom. Do not rewrite an old row. Verdict is KEEP, FAIL, or LOVE. Record the owner's words. Do not embellish. Leave the words cell empty when none were given.

| Date | Thing judged | Verdict | Owner's words | Design lesson |
| --- | --- | --- | --- | --- |
| | | KEEP / FAIL / LOVE | | |

## Log

| Date | Thing judged | Verdict | Owner's words | Design lesson |
| --- | --- | --- | --- | --- |
| 2026-10-01/02 | Black angular ship with purple lightning cracks | LOVE | "so cool" | Keep the black angular ship with purple lightning cracks. |
| 2026-10-01/02 | Round paw-anchor emblem | FAIL | looked pasted on like a sticker | The emblem must be etched into the hull, angular, dark violet, and weathered. |
| 2026-10-01/02 | Earlier rounded egg-pod ship | FAIL | ugly | Do not cook a rounded egg-pod ship. |
| 2026-10-01/02 | Spherical and blob rocks, and identical capsule views | FAIL | "demo" | Spherical or blob rocks, and identical capsule views, read as a demo. |
| 2026-10-01/02 | Safe rounded shapes chosen to pass checks | FAIL | wants real style, sharp edges and distinctive silhouettes | Real style. Sharp edges and distinctive silhouettes. Do not round a shape so a check will pass. |
| 2026-10-01/02 | Speed-tied scrolling ground video | KEEP | liked it | Keep the scrolling ground video tied to speed. |
| 2026-10-01/02 | Circles | FAIL | no circles | No circles. |
| 2026-10-01/02 | Large organic biomes | KEEP | large organic biomes | Large organic biomes stay. |
| 2026-10-01/02 | Inconsistent orbit views (two different ships) | FAIL | inconsistent orbit views (two different ships) are a FAIL | Two different ships in one orbit set are a FAIL. |
| 2026-10-03 | Camera shake while Bolt gallops | FAIL | no camera shake, ever | The chase must not snap the eye from frame to frame. |
| 2026-10-03 | Sky living layers that do not read | FAIL | there are no videos, it's just images | A living layer has to move where the player looks, without covering the paintings in rectangles. |
| 2026-10-04 | Monolith gate base above the relief | FAIL | | Seat every ruin foot on the drawn ground. One contact height leaves a gap on the downhill side. |
| 2026-10-04 | Wreck hangar interior and the slab beside the opening | FAIL | | An unpainted hull face reads black. Retile it from the same Imagine plate. Do not leave the opening wall empty. |
| 2026-10-04 | Paw button on the menus | KEEP | scintiller, pulser | The paw shimmers and pulses. An Imagine glow layer changes opacity. The print is not scaled. |
| 2026-10-04 | Pause menu stone door plate and Living Archives gothic hall | FAIL | look old and "moche" | Menus leave the stone plate and the gothic hall. The hall is a high-tech citadel: dark metal, glass, holographic cyan and violet, a window to space. |
| 2026-10-04/05 | Flat cards, billboards, or sprites for canyon walls, mesas, rocks, shards, and details | FAIL | | Those objects are frigate solids. Far LOD is a cheaper solid. Only the sky is a backdrop. |
| 2026-10-04/05 | One video over an already-full still sky | FAIL | | Start from a nearly empty sky. Each animated element is its own looping video. |
| 2026-10-04/05 | Planet video cooked small, drawn, or unchecked | FAIL | | Highest resolution, planet fills the frame, photorealistic. Confirm the rotation frame by frame. |
| 2026-10-04/05 | Invisible walls in front of the Gate arch or the wreck hangar | FAIL | | Collisions follow the drawn faces. Walk under the arch. Enter the hangar. |
| 2026-10-04/05 | A crude stepped box in place of a good near or mid rock | FAIL | | Near and mid stay the frigate loft. Cheaper solids are far only. |
| 2026-10-04/05 | Another cook aimed at view drift or specks | FAIL | | Accept those Imagine defects. Do not spend the quota again. |
| 2026-10-06 | Corridor chase on PR #178 at `5f35ef9` | FAIL | Camera looks too much at the ground. Keep it high behind Bolt but pitch it up toward the horizon so the sky is in the top of the portrait and the arch is seen whole. Bolt stays in the lower third. | The eye can stay near 3.5 m. The aim has to sit near the horizon, not on the paws. |
| 2026-10-06 | Corridor floor on PR #178 at `5f35ef9` | FAIL | Ground looks like a checkerboard. Squares of different ground stills alternate. The floor should read as one continuous ground. No visible repetition grid. | One even still, one quad, sampler repeat. A dark rim on a per-tile quad redraws the square. |
| 2026-10-06 | Corridor horizon on PR #178 at `6c62a80` | FAIL | Horizon line too straight. Break the hard edge where the ground meets the sky with existing far rocks and light distance fog sampled from the sky. | A flat quad is a ruler. Existing hulls at least 8 m tall have to cross that line inside the view. Fog colour comes from the sky slices. |
| 2026-10-06 | Streamed rocks on PR #178 at `6c62a80` | FAIL | Rocks look like they float. Every rock sits on the ground, base sunk slightly, including during the rise. | The base stays under the plane for the whole emerge. The rise starts below the ground. |
| 2026-10-06 | 28 m monolith on PR #178 at `6c62a80` | FAIL | The monolith gets cut at the top when Bolt is close. Keep the high chase, and keep the whole monolith visible. Do not pitch back down at the ground. | Offset it enough to clear the footprint and stay inside the 22.7° lens. Pitch may rise, capped, and never looks further down. |
| 2026-10-06 | Pass clip on PR #178 at `d01a1c1` | FAIL | In the first ~2/3 of monolith-pass.mp4 the ground near Bolt (bottom half, from about the 40% line down) renders pure BLACK, and the textured ground only fills in toward the camera. Walk-speed.png is fine. The ground must be fully textured from frame 0 at every pace and position, with no black areas. | The carpet has to cover the pass camera, not only the walk spawn. Fog and the crossfade were already on the fragments that drew. |
| 2026-10-06 | Corridor chase on main `700d47d` | FAIL | Bolt is too low on screen (y 0.761 is too low). Frame him exactly like zone A. | Copy zone A’s boom, eye, aim, and screen row. Centre him. Keep him clear of the joystick. |
| 2026-10-06 | Corridor continuity on main `700d47d` | FAIL | After a few seconds Bolt is suddenly teleported and all decor disappears. | The run stays continuous. Decor does not vanish at the corridor end. |
| 2026-10-06 | Corridor sprint speed on main `700d47d` | FAIL | The sprint is too slow and boring. | A held sprint accelerates and reaches about 2–2.5× the old 8.6 m/s top over 20–30 s. The camera stays smooth. Far births stay far. |
| 2026-10-07 | Sprint stream on main `c9b8d07` | FAIL | It works, but only rocks stream in. He wants the arches (Roman arch + dark slate monolith gate) and the ship/wreck to stream in too, far ahead, repeatedly during the sprint. | Existing monument meshes, placement only, recycled copies, inside 12 draws, 260 MB, and 4 videos. |
| 2026-10-07 | Sprint spawn width on main `c9b8d07` | FAIL | Spawns only appear far away along one straight line (the 11 m wide field). They must appear far away across the whole zone, a wide arc near the fog covering the full visible width, including when he turns. Never in the near or mid range. Never popping near Bolt. All grounded. Density keeps rising with sprint time. | The far band is the portrait width at the birth distance. Seats stay world-locked. New births stay outside the near frustum. |

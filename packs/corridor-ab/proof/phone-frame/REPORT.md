# Phone frame, far spawn, and sprint density

Verdict: PASS

Date: 2026-10-06. Pack `packs/corridor-ab`. No new Imagine pixels. Sky videos stayed at their stored resolution. The plain play URL does not start a quest. Quest phases are unchanged. The zone HUD sentence is translated at display time.

## How it was measured

Headless Chrome, portrait and landscape, canvas `toDataURL`. Numbers are `window.__corridor` in `capture.json`.

Tests, 64 pass, 0 fail:

`node --test tools/adventure/adventure.test.mjs packs/corridor-ab/play/*.test.mjs packs/common/archives/codex.test.mjs`

Phone line on every still and every film sample: drawCalls 7, texMB 184.5, activeVideos 2–4. Caps are 12 draws, 260 MB, and 4 videos. One instanced draw per hull. Pool 48 plus 8 horizon seats is 56, under the instance cap of 64. Objects behind Bolt are blanked and the slot is reused.

## Framing

`CHASE_SLIDE` is 0. `CHASE_BOOM` stays 6.1, `CHASE_EYE` stays 3.5, aim height stays 2.52. Clearance walks the boom along the rest ray only. The 0.2 m grid settled at boom 6.0 m on these stills. Body screen Y at that boom is 0.761 (lower third starts at 0.667).

| Still | View | Body x, y | Stick rect | Clear |
| --- | --- | --- | --- | --- |
| portrait-720.jpg | 720×1600 | 0.500, 0.761 | left 18, top 1462, 110×110 | body is 0.32 right of the stick and 0.15 above it |
| portrait-1080.jpg | 1080×2400 | 0.500, 0.761 | left 18, top 2262, 110×110 | same fractions |
| landscape-1600.jpg | 1600×720 | 0.500, 0.761 | left 18, top 582, 110×110 | stick is the left corner; body is centred |

During `long-sprint.mp4` a near gate raised the pitch and the body dipped to screen y 0.679, still inside the lower third, then returned to 0.761. x stayed 0.500. The stick on a 720×1600 portrait starts at y 0.914.

The adventure mid still pitches up for the gate, so the chest point projects at y 1.04. That still is the French HUD proof, not the chase proof.

## Rock bases

53 copies on the sprint still. Highest base −0.35 m. Lowest base −0.682 m. The plane is 0.

Pool rocks use one sink, −0.35 m, at every distance. Horizon copies use `seatSink`, at least that deep, and the nearest of them is 120 m ahead. No rise and no scale-up. Emerge is 1 at birth.

## Far spawn and density

After the opening frame, a new slot is born only at or beyond 92 m and outside the near portrait frustum. A turn uses the same rule. Despawn is behind Bolt (22 m), and a full pool steals the furthest slot behind him.

Charge climbs over 24 s of held gallop. `densityOf` goes from 0.34 to 1. `halfWidth` goes from 10 m to 44 m. The live count stops at the pool.

`sprint.mp4` (720×1600, 12 fps, 6.0 s) while speed climbs:

| Sample | Rocks | Charge | Speed |
| --- | --- | --- | --- |
| start | 17 | 0.02 | 0.89 |
| mid | 29 | 0.11 | 4.19 |
| later | 40 | 0.15 | 5.84 |
| end | 45 | 0.23 | 8.6 |

`long-sprint.mp4` (720×1600, 12 fps, 4.0 s) after an 18 s warmup. The warmup itself:

| Sim time | Rocks | Charge | Speed | Draws |
| --- | --- | --- | --- | --- |
| 0 s | 17 | 0 | 0.07 | 7 |
| 2 s | 20 | 0.08 | 3.3 | 7 |
| 8 s | 45 | 0.33 | 8.6 | 7 |
| 18 s | 45 | 0.75 | 8.6 | 7 |

The clip then runs charge 0.75 → 0.88 at 45 rocks, 7 draws, 184.5 MB. New births in the unit test stay at or beyond 92 m and outside the near frustum. The test is "a long sprint holds more rocks than a short one, still born far".

## Page and French HUD

Title is `Boltverse Odyssey`, not the debug JSON.

`hud-720.jpg` line, adventure mid, seed default, timer unclipped:

`Ramasse les Éclats d'écho, puis atteins la Porte de l'Éclipse.`

`Éclats d'écho 0 sur 5` and `55s`. The card sentence in `offline.js` stays the ASCII English source. `hudObjective` maps it when the HUD is drawn.

Archives labels the player reads: Reprendre, Archives vivantes, Codex vivant, bientôt, Réglages, Citadelle.

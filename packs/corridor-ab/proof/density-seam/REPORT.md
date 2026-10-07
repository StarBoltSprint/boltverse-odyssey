# Corridor sprint — frame, continuity, speed, density, seam

Date: 2026-10-06
Verdict: PASS

Portrait 720×1600. Zone A chest screen y 0.487. Corridor chest screen y 0.485. Delta 0.0026. Boom 6 m, eye 1.35 m, slide 0. The 60 s film keeps that row: screen y stays between 0.485 and 0.487.

A held sprint leaves 1.65 m/s at 1 s, 12.18 m/s at 8 s, 15.77 m/s at 16 s, and 19.35 m/s at 24 s (2.25× the old 8.6 cap). It holds 19.35 m/s through 60 s. x at 60 s is 1008.4 m. Heading stays 90. The largest frame step is 0.81 m, inside speed × dt × 1.5.

Live decor: minimum 40 after the opening, largest one-frame drop 2, never 0. Draws 8. Textures 184.5 MB.

Visible rocks per area, half-width held at 11 m: 8 s count 22 density 0.0139, 16 s count 42 density 0.0265, 24 s count 47 density 0.0297.

The ground quad rides with Bolt. Far ground fogs out before the horizon hulls. The lower half of the 60 s clip is not empty at 0 s, 8 s, 24 s, 35 s, or 59.5 s.

The plain play URL does not start a quest.

| t (s) | x (m) | speed (m/s) | live | charge | screen y |
| --- | --- | --- | --- | --- | --- |
| 1 | 7.6 | 1.65 | 34 | 0.04 | 0.485 |
| 8 | 59.3 | 12.18 | 67 | 0.33 | 0.485 |
| 16 | 171.2 | 15.77 | 96 | 0.67 | 0.485 |
| 24 | 311.8 | 19.35 | 96 | 1 | 0.486 |
| 60 | 1008.4 | 19.35 | 96 | 1 | 0.485 |

Proof: `side-by-side-720.jpg`, `sprint-60s.mp4` (720×1600, 60 s, 120 frames), `capture.json`.

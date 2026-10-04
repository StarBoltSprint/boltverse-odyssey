# Zone title at game start (IN TEST)

Back to [METHOD.md](../METHOD.md). **Status: IN TEST (2026-10-04, branch `zone-a-polish`).**

A short English title fades in over the live game when the zone is ready, then fades out. It is a **UI text overlay**
(DOM above the canvas), not a game pixel: the WebGL view, Bolt, the sky and the ground are untouched.

| Rule | Value |
|---|---|
| Text | Kicker `Boltverse Odyssey` + the biome kit `name` (zone A: **The Howling Eclipse**). Never an invented name (AGENTS.md bans invented cassette names); the kit is the source, so B / C reuse it. |
| Never blocks play | No tap, no Start button, no controls lecture (AGENTS.md: BAN intro/landing splash requiring Start). Bolt is live under it; `pointer-events: none`. |
| Timing | Opacity only (no movement): 0.35 s delay, 1.4 s ease-in, 2.6 s hold, 1.8 s ease-out = 6.15 s, then the node is removed. |
| Phone | Title `clamp(26px, 8.2vw, 40px)` (29.5 CSS px = 59 device px on 360×800), kicker 11 px caps; upper third (`top: 19vh`) in the sky, clear of Bolt, the HUD and the stick; soft dark text-shadow for contrast. |
| Switch | `?intro=0` turns it off (QC captures). `clearing.json` `title` overrides the kit name. |

Code: `packs/zone-a/play/intro.js`, CSS in `packs/zone-a/play/index.html`, call in `play.js` after boot.
Frames 2026-10-04 (t = 0.2 / 0.9 / 1.75 / 3.2 / 5.2 / 6.0 s): `/workspace/grokcli/out/zoneA-polish/intro/`.

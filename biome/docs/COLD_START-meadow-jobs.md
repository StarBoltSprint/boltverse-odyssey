# COLD START — meadow jobs (heading, run, sky)

**Tool feedback (law 65):** if a repo tool let a defect through, reported a wrong number, or was hard to use, finish the take, write `feedback/<date>-<tool>.md`, and open it upstream. [`65-tool-feedback-loop.md`](65-tool-feedback-loop.md).

Kitchen only. Do not read this to the player. Paste this when the paint is a meadow, a 360 field, or any open ground where the player can turn. It is **not** a biome law number.

Law [56](56-cutout-native-scale.md) is the cutout scale (never `scale > 1`). Law [43](43-open-ground.md) still owns four skies and the tiling ground. Law [48](48-jade-plate-cook.md) still owns empty plates and **zero yaw inside the clip**. Law [24](24-camera-1point.md) still owns the sprint-road camera. This paste does not replace them. Do not invent a second law 43 or a law numbered from Engine decrees.

Hung split (do not wipe): [`../../pyre/MEADOW.md`](../../pyre/MEADOW.md) — herbe and ciel are two plates, one sun. The lessons below are how the next cook stays Pack-compatible.

The world is still Imagine Video. Simplex only places already-cooked assets. Bolt is the sealed gallop on GitHub (`lock/bolt-gallop-cycle.mp4`). Three.js is not the world. Ground and sky sheets stay empty of Bolt.

---

## Two jobs

Running scroll and yaw / orbit are **two jobs**. They are not one Imagine video. A clip that turns bakes the turn rate. You cannot change it later.

- **Run** — the film of the ground moving under the paws. Lock-off. Yaw stays 0 inside that plate.
- **Orbit** — which heading is on screen. Code (or a second plate) picks the heading. The video does not yaw.

---

## Sol ≠ ciel

- Sky + sun live on their own black / empty plate.
- Grass / sol is a separate plate.
- **One sun.** A sun copied into every heading is FAIL (it returns too early).
- Same horizon on both plates. A second sun, or a sky plate that already contains the ground, is FAIL.

---

## Heading, then run

A race-POV video is a bad 360 ground. Perspective plus a wall of grass morphs. Do not cook the meadow as a chase cam.

- **Heading** = one full-frame official image (the still you trust).
- **Run** = the film **between** headings. It starts on one heading and ends on the next. It does not invent a new camera.

**Engine grammar notes ~697–706** (not biome law numbers): yaw 0. No free camera orbit inside one plate. Do not file these notes as law 57 or as a second law 48.

A horizon grass "wall" is often a **bad segment** of the run video (about the first 1–5 s). Cut or skip that segment. Do not treat it as world geometry, a collider, or a hill.

---

## Do not fake the picture

- Do not set `playbackRate` × N on a ground or sky plate to fake sharpness or speed.
- Do not swap in a 24 fps under-res plate to fake quality.
- Bolt stays play rate **1×** (law [14c](14c-gallop-clock.md)). Howl's fire rate (law [34](34-howl-live-aim.md)) is aim timing on an already-cooked clip. It is not this ban.

---

## FAIL

- One Imagine video that both runs and orbits.
- Race POV used as the 360 ground.
- Two suns, or the sun baked into every heading.
- Sky and grass in the same plate.
- Bolt, a near trunk, or a path baked into sol or ciel.
- The opening grass wall kept as terrain.
- `playbackRate` × N, or a 24 fps under-res swap, used as a quality pass.
- A cutout enlarged to fill the heading (`scale > 1`, law 56).

World stays Imagine Video assets. The player stays the sealed Bolt. No wallet. No player API keys. Hang URL stays `https://boltverse-odysseyyyy.grok.me`.

# Report — Living Codex truths

Verdict: PASS

| # | Done when | Result |
| --- | --- | --- |
| 1 | One truth per adventure, including several in one zone. An older `<zoneId>/truth` row is still read. | `codex[]` in `boltverse.archives.v1`. Same zone + different seed both stay. `adv-<seed>` legacy row merges with that seed. The old key stays in `found`. |
| 2 | Each row keeps question, insight, kind, title, seed, zone, date, and order. | Order is the gather time. Vérité #1 is the earliest. |
| 3 | Archives lists the truths and opens one. Echo Shards stay. The count is not a final end. | Paw **Codex vivant** and **Archives**. List: `3 vérités réunies` and `Le Cœur Stellaire reste loin. Comprendre l'univers n'a pas de fin.` Seed 351 still showed `7 of 7` Echo Shards with their lore. |
| 4 | A pass inscribes the truth, then Continuer / Retour à la Citadelle. | Ending card, 2.5 s, then the existing choice. |
| 5 | Tests | `node --test tools/adventure/adventure.test.mjs packs/corridor-ab/play/*.test.mjs packs/common/archives/codex.test.mjs` — 51 pass, 0 fail. That is the previous 45, plus the inscription row, plus 5 storage / migration / order rows. |
| 6 | Seeds 1024, 68, 351 in that order, then a reload. | Pass. Saved titles `1 The Lost xAI Ship`, `2 The Echoing Fracture`, `3 The Shard Symphony`. After reload the same three lines, same order. |
| 7 | Proof stills, 720×1600. | `inscribed.png` (Vérité #3, The Shard Symphony). `list.png` (shards plus the three truths). `truth.png` (Vérité #2, time is a spiral). |
| 8 | No new Imagine file. No new draw. No new video. | DOM text on the existing hall. `play.js` render path is unchanged. `?collect=1` only eases the proof runner’s feet. Walk and sprint do not mount this UI. |

## How the three seeds were finished

`?adventure=1&shot=adventure&collect=1&seed=` on the corridor page, localStorage cleared first.

| Seed | Title | Shards | Truth |
| --- | --- | --- | --- |
| 1024 | The Lost xAI Ship | 1 of 3, not required | The Star Core reveals: Understanding the universe is not a destination. It is an endless becoming. Vérité #1. Orbe de vérité. |
| 68 | The Echoing Fracture | 5 of 5 | The Star Core reveals: time is a spiral. Vérité #2. Orbe de vérité. |
| 351 | The Shard Symphony | 7 of 7 | The Star Core reveals: AI was always part of the plan. Vérité #3. Éclat d'écho. |

`collect=1` is only for that proof runner. It sidesteps toward the next Echo Shard when it is within 6 m, then returns to the path. Aiming at a monument seat walks into the hull and never reaches the radius. A player on `?adventure=1&seed=` steers with the stick. The stick path is unchanged.

Phone line was not recaptured. This step adds no draw and no video. The walk and sprint shots still do not mount the paw.

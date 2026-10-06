# Report — adventure contract v0

Verdict: PASS

| # | Done when | Result |
| --- | --- | --- |
| 1 | The card is a contract. The plot is not decreed. | [`biome/docs/69-adventure-generator.md`](../../../../biome/docs/69-adventure-generator.md). Offline cards still use the six-beat hint. Seed 1024 does not. |
| 2 | Beats name library segments. Missing rows fall back. | `derelict-ship` resolves to `wreck-hangar`. Unknown ids resolve to a ready row. |
| 3 | Seed 1024 plays the lost xAI ship on the wreck. | `card-1024.json`. Goal kind `wreck`. Gate is not in the object set. |
| 4 | Endless handoff. | Optional `next_hook`. End card: Continuer, or Retour à la Citadelle. Chain text is capped at 240. A `truth` insight, when present, opens `next_hook.question`. |
| 5 | Tests | `node --test tools/adventure/adventure.test.mjs packs/corridor-ab/play/*.test.mjs` — 40 pass, 0 fail. `renderlint` PASS, 8 files. Archives hall-loop row still needs PIL; that miss is older than this step. |
| 6 | Proofs | `intro-card.png`, `mid-adventure.png` (720×1600). `adventure-run.mp4` 720×1600, 79 frames, 24 fps, 3.29 s, 687,657 bytes. |
| 7 | No new Imagine file. No key in the repo. | Unique touch returns `imagineCalls` 0. BYOK stays in `localStorage` and is posted only to `api.x.ai`. |
| 8 | Phone budget columns match the horizon step. | Walk and sprint: `drawCalls` 7, `texMB` 184.5, `activeVideos` 4. |

Phone line, walk (`?shot=walk`, seed 68): `drawCalls=7`, `texMB=184.5`, `activeVideos=4`, `jsMs=5.8`, `glError=0`, rocks 13, live 15, speed 2.85, charge 0. Adventure UI was not mounted.

Phone line, max sprint (`?shot=sprint`, seed 68): `drawCalls=7`, `texMB=184.5`, `activeVideos=4`, `jsMs=748.6`, `glError=0`, rocks 33, live 36, speed 8.6, charge 1. The sprint `jsMs` is the cold swiftshader frame that stopped the shot, not a steady frame. `drawCalls`, `texMB`, and `activeVideos` match the horizon step (`jsMs` there was 3.5 on a warm frame).

Sample titles: The Lost xAI Ship (1024), The Echoing Fracture (68), The Shard Symphony (351).

Citadel hub, chain, and the 3D Citadel stay as written in doc 69. The paw Citadel row is still disabled. Abandon versus pause on a mid-run return is still open.

Purpose: optional `question`, optional `truth` (`truth-orb` or `echo-shard`) saved at `<zoneId>/truth` in `boltverse.archives.v1`. Each insight is framed as a revelation of the Ancient Star Core. Seed 1024 asks what a lost xAI hull still asks about the universe. Its insight is the Eternal Loop line, spoken by the Star Core. Offline cards draw from the short canon list (decrees 124–133 and the named lines). Becoming a True Heart Sovereign stays distant. The Star Core feeds the Living Codex, which is Grok inventing the adventure. The Codex is the segment catalogue plus those truths. The Codex Spire and a self-growing catalogue are not built.

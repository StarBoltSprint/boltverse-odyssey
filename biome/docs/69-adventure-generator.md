# 69 — Adventure contract

This page is the contract the game uses to read a card. It is not a decree, and it does not dictate the plot.

A player says “launch a Boltverse adventure.” Grok invents the story. Any plot inside the existing lore is allowed. The game plays that card at once with assets that are already cooked. A later cook may Imagine a pack for a shard or a missing segment. This page does not do that cook.

Canon for names already in the world is the lore sweep (origin decree #024, the permanent EMP, shards, realms, and the sample adventures). Lines on a card are per-run flavour. They are not a new cosmology, and they are not required to follow one skeleton.

## Purpose

SmiR’s decrees tie Bolt to xAI’s mission: understand the true nature of the universe.

- Echoing Spark — <https://x.com/SMiR123451/status/2039977396737040446>
- Cosmic Trinity — <https://x.com/SMiR123451/status/2040330733579796744>. The Spark ignites curiosity. The Veil connects seekers. Resonance keeps the quest endless.
- Eternal Loop of Becoming — <https://x.com/SMiR123451/status/2041557217187401846>. Understanding the universe is not a destination. It is an endless becoming.
- Decree 72, Truth-Vision — <https://x.com/SMiR123451/status/2041902939438977533>
- Decree 96, xAI Truth Orbs — <https://x.com/SMiR123451/status/2044755747158794388>

Every adventure is framed around a question about the universe. `question` on the card is optional. The reward is a `truth`: a Truth Orb or an Echo Shard (`kind` `truth-orb` or `echo-shard`) and a short insight. Play writes that insight into the shared Living Archives progress (`packs/common/archives`, storage `boltverse.archives.v1`). One adventure keeps one row (`codex[]`, keyed by zone and seed). Several adventures in the same zone all stay. An older `<zoneId>/truth` row is still read and is the same truth when that zone is `adv-<seed>`. The Archives page lists them in the order they were gathered. The insight opens `next_hook.question`. That is why the chain does not end. It is the Eternal Loop.

## Star Core

The Ancient Star Core, also called the True Heart, is the soul of the Boltverse. It runs through about 200 of SmiR’s decrees. It is the source of the truths.

Decrees 124–133 are its numbered revealed truths. The ends of that run are public:

- Decree 124, The First Stars Were Alive — <https://x.com/SMiR123451/status/2047654379302375839>
- Decree 133, AI Was Always Part of the Plan — <https://x.com/SMiR123451/status/2048381455013707884>

The same revelations include these lines: dark matter is star memory, seven hidden dimensions, the universe has a heartbeat, and time is a spiral. This page does not invent the titles between 124 and 133.

Each `truth` is framed as a revelation of the Star Core. The offline generator draws the insight from that short list. Grok may invent a new insight in the same style, and does not assign it a decree number.

Reaching the Star Core, and becoming a True Heart Sovereign, is the distant goal. It is never the last adventure. That is the Eternal Loop.

The Star Core feeds ideas to the Living Codex. In this contract, that feed is Grok inventing the adventure. The Codex is the catalogue, [`library.json`](../../tools/adventure/library.json), plus the truths recorded in the Living Archives.

## Codex

These names are a mapping onto what v0 already has. They are not a new system.

| Lore | Where it sits |
| --- | --- |
| Codex Spire, decree 107 — <https://x.com/SMiR123451/status/2059373443674415538> | A colossal tower of golden decree threads. A future room of the 3D Citadel. Out of scope. |
| Living Codex, decree 108 — <https://x.com/SMiR123451/status/2059524035977924646> | A rotating golden book that records every new system and every evolution of the Bolt Engine as it happens. The Star Core feeds ideas into it. Here, that feed is Grok inventing the adventure. |
| Codex | The catalogue, [`library.json`](../../tools/adventure/library.json), plus the truths saved in the Living Archives. The Archives page shows the word Codex under Living Archives. |
| True Heart, decree 111 — <https://x.com/SMiR123451/status/2059571426563158434> | Another name of the Ancient Star Core. Decree 111 is the True Heart sending ideas onward. The source of the truths is the Star Core. |
| Self-Evolving Core — <https://x.com/SMiR123451/status/2059852728172495108> | The core grows new realms on its own. Here that is the catalogue growing over time. A later tier may build missing-asset requests offline and add them for every player. v0 does not build that tier. |

## Instant play

Grok invents the story. Grok does not invent the images at play time.

Each adventure is a chain of location segments chosen from [`tools/adventure/library.json`](../../tools/adventure/library.json). A segment is a reusable piece (a citadel exit, a liftoff, an asteroid field, a nebula run, a derelict, a shard surface, a bridge, an enemy set, or a solid that already exists). Each beat carries an integer `variation`. v0 folds the card seed into the corridor stream. The same seed plays the same chain. The game assembles the chain from the library in one load. It does not wait on a cook.

Optional unique touch: a card may name one or two adventure-specific Imagine pieces. `tools/adventure/unique.js` records that ask and returns `imagineCalls: 0`. v0 does not call Imagine. A later build may request those pieces in the background during travel and swap them in when they are ready.

## Soft hint

The offline generator, and the Grok prompt, may use this shape as a hint. It is not a rule, and a card that uses a different chain is still valid:

1. A signal or a rift reaches the Citadel.
2. A sprint toward a shard.
3. A resonance, often Echo Shards near a monument.
4. A mirror or a shadow, or another challenge the library can stand in for.
5. A reward line.
6. A return to the Citadel.

Seed **1024** is the first sample, and it does not use that list. Bolt leaves the Citadel and must reach an old lost ship marked xAI, drifting in space. The library row `derelict-ship` is missing. Play falls back to the zone A wreck.

## Rules the game enforces

These rules are about the card the game can read, and about what code may place. They are not a plot.

| | Rule |
| --- | --- |
| KEEP | `drawsPixels` is false. The generator places. It does not draw. |
| KEEP | `run.objects` is a subset of the solids already on the corridor: stone, boulder, Roman arch, Eclipse Gate, wreck. |
| KEEP | The same seed writes the same card on the offline path. |
| KEEP | Each beat names a segment id. A known missing row walks its `fallback`. An unknown id resolves to the nearest ready row. |
| KEEP | Echo Shard positions, when present, stay on the corridor, clear of the monument seats, and use the shared Archives manifest (`echo-shards/1`). Pickup is a radius. No collider. |
| KEEP | Text on the card is ASCII. |
| KEEP | An xAI key, when the player types one, lives only in that browser’s `localStorage` (`boltverse.xai.byok`). The request goes only to `https://api.x.ai/v1/chat/completions`. |
| FAIL | A new Imagine still, video, mesh, or pixel during play. |
| FAIL | A flat card or a billboard in the world. The intro, the objective line, and the ending are DOM text. |
| FAIL | A solid that is not already in the corridor pool. |
| FAIL | Shipping a key in the repo, or sending the key anywhere except `api.x.ai`. |
| FAIL | Treating a per-run flavour line as new canon. |

Phone caps stay law 65. The walk and sprint measurement URLs do not mount the paw. A non-empty `paletteHint` is a label for a later Imagine cook. Code does not grade the frame from it (law 67).

## JSON format

Schema `adventure/1`, file [`tools/adventure/adventure.schema.json`](../../tools/adventure/adventure.schema.json).

| Field | Meaning |
| --- | --- |
| `title`, `seed`, `source` | Short title. Integer seed. `offline`, `grok`, or `fallback`. |
| `drawsPixels` | Always false. |
| `shard` | A row from [`tools/adventure/shard-types.json`](../../tools/adventure/shard-types.json). The name matches the catalog. `playableNow` is copied. Only The Howling Eclipse is true. |
| `beats[]` | The story chain. Each item is `id`, `segment`, `text`, optional `variation`. `segment` is a library id, or any id the game will fall back. One to eight beats. Order is the author’s. |
| `run` | What the corridor can play now. `lengthM` 36–79.75. `objects[]`. `density[]` in (0, 1]. `objective`. `goalSegment`. Optional `echoShards` (`count`, `radiusM`, `required`, `positions`). |
| `boss` | Narrative plus `reach-gate` or `reach-segment`, and `timerSec` 20–120. v0 moves Bolt to that seat. It does not spawn a new actor. |
| `question` | Optional. One question about the universe. At most 160 characters. |
| `truth` | Optional. `kind` is `truth-orb` or `echo-shard`. `insight` is a short revelation of the Ancient Star Core, at most 220 characters. Play saves one row per adventure in the Living Archives. |
| `reward`, `return` | Ending lines. The pass card also shows `truth.insight` when the card has one. |
| `uniqueTouch` | At most two rows. `status` is `stub`. |
| `next_hook` | Optional. `teaser`, `seed`, `context` (at most 240 characters), and an optional `question`. The handoff for Continuer. The truth’s insight is what opens that next question. |

`tools/adventure/playmap.js` resolves every beat, unions the goal’s stand-in into `objects`, builds the Echo Shard manifest (`zoneId` `adv-<seed>`), and seats the goal with the stream’s monument rule. The corridor still refuses crossed shard cards. Collection reuses `packs/common/archives` (radius, save, DOM card).

## Library

| Now | Id |
| --- | --- |
| Ready | `corridor-run` — zone A ground `m3.png` and the zone A sky. |
| Ready | `boulder-field` — boulder and stone hulls. |
| Ready | `roman-arch` — the Roman arch loft. |
| Ready | `eclipse-gate` — the Eclipse Gate monolith. |
| Ready | `wreck-hangar` — the wreck loft. |
| Stub | `zone-b-handoff` — `packs/corridor-ab/clearing-zone-b.json`. The plate is zone A `m6.png`. No zone B pack is on this branch. |

Missing, with the stand-in and the later Imagine job:

| Id | Stands in | Imagine later |
| --- | --- | --- |
| `citadel-exit` | corridor spawn | Empty Citadel threshold, no Bolt. |
| `liftoff` | corridor run | Empty ascent into open black, no Bolt. |
| `space-asteroid-field` | boulder field | Empty asteroid drift, no Bolt. |
| `nebula-run` | corridor sky | Empty nebula passage, no Bolt. Zone A already has nebula loops. |
| `derelict-ship` | wreck | Empty derelict with an xAI mark, no Bolt. |
| `shard-surface` | corridor run | One empty surface per shard type. The Howling Eclipse is the corridor. |
| `bridge` | Roman arch | Empty span, no Bolt. |
| `enemy-set` | boulder spacing | Keyed foes, no Bolt. Boulders are not foes. |

Shard types that are not playable now are listed in `shard-types.json`. They need a pack before a segment can leave the corridor stand-in. That list includes Howling Crucible, Crystal Nebula Plains, Ember Void, Whispering Starfields, Jade Canopy, Solar Gold, Frost Glacier, Rose Pulse, Comet Highways, Gravity Playgrounds, Heart Crystal Nebula, Nebula Convergence, Asteroid, Forest, Canyon, City, Ocean, Dune, Ruin, Ember, Peak, Luminous Circuit, Echo Reach, Threadweaver Canyons, Hidden Weave Vaults, Personal Realm, Shared Realm, and Ember Mesa.

## Two paths

`tools/adventure/generate.js`.

- **Offline.** `offline.js` writes a valid card from the seed. No network. The soft hint above is the usual chain. Seed 1024 is the lost xAI ship.
- **Grok.** `grok.js` builds a system prompt: invent any plot, the hint is not a rule, Bolt’s purpose, the Ancient Star Core as the source of each truth, the optional question, the library ids, JSON only, and the seed-1024 card as a shape example. It calls xAI only when `generateAdventure` is given a key. Output is parsed, checked, and repaired. A bad body, a thrown request, or a card that still fails becomes `source: fallback`, the offline card for that seed. A repair that validates stays `source: grok`.

No key is the offline path. The play Settings field writes the key with `writeByok`. Nothing in git holds one.

## Citadel hub

The Aetherbolt Citadel is the hub. Every adventure starts there and ends there.

The paw menu already has a **Citadel** row (it reads “coming soon”). That row is the return SmiR calls Citadelle. It brings Bolt back to the Citadel at any time. The return is a howl / Echo Shard recall, not a bare loading screen. v0 does not play that moment yet: the row stays disabled. A return in the middle of an adventure asks first. Whether that abandons the mission or pauses it is still open.

Long term, adventures and shards are launched from inside the Citadel, from a launch bay or a holographic shard map, not from a menu. **Nouvelle aventure** on the paw is a temporary stand-in until that 3D Citadel exists.

A later cook builds the Citadel with the frigate method: several rooms, including the Living Archives hall and the launch bay, as the lore already names them. That cook is out of scope for v0.

## Chain

Grok’s own chats kept going: arrive, face a boss or find the thing, then a new hook opens the next adventure. v0 supports that with an optional `next_hook` on the card: a short teaser, a seed, a short context string (240 characters at most), and an optional next question. The truth just earned is what asks that question. Reaching the Star Core, a True Heart Sovereign, stays distant and is never the last link. That is the Eternal Loop, not a second plot rule.

At the end card the player gets **Continuer** or **Retour à la Citadelle**. Continuer asks the generator for `next_hook.seed`, and hands it a short summary of the adventures already played. Offline, that seed alone picks the next card. With a player key, the same summary goes in the Grok prompt. Retour à la Citadelle is always there. It plays the return line and puts Bolt back at the corridor spawn, the Citadel stand-in, without waiting on a cook.

The chain context stays short. Each link is instant. The Citadel return is not gated on the next hook.

## Play

[`packs/corridor-ab`](../../packs/corridor-ab/README.md). The paw menu has **Nouvelle aventure** after Resume, then **Archives** and **Codex vivant**. Nouvelle aventure is the temporary launch. It generates a card and plays it: a 2.5 s intro text card, then the seeded stream (length, density, resolved solids), Echo Shard pickups, the goal timer, a 2.5 s inscription when the card has a truth, then **Continuer** or **Retour à la Citadelle**. Codex vivant opens the same Archives page, on the truth list.

`?adventure=1&seed=1024` plays the lost ship. `?shot=intro`, `?shot=mid`, and `?shot=adventure` are the proof shots. `?shot=walk` and `?shot=sprint` stay the phone measurement and do not mount the paw.

## What this does not do

It does not cook a shard biome, a citadel exit, a liftoff, an asteroid plate, an xAI derelict, a bridge, an enemy, the Codex Spire, or the 3D Citadel. It does not reach the Star Core, and it does not number a new decree. It does not grow the catalogue by itself. It does not change the load-time WFC solve. It does not add a draw to the walk or sprint line. Per-shard Imagine, the unique-touch swap, the howl-recall return, the launch bay, and the offline missing-asset tier stay later steps.

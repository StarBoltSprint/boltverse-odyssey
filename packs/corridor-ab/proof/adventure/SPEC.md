# Step — adventure generator v0

Goal: a player asks for a Boltverse adventure and the corridor plays a quest card at once, using only solids, plates, and the shared Echo Shard pickup that already exist. No new Imagine file. No new mesh.

## Rails

- The card follows the lore skeleton: signal or rift, sprint, resonance, mirror or shadow boss, core fragment, return to the Citadel.
- Code places the existing pool only: stone, boulder, Roman arch, Eclipse Gate, wreck. Density and length are numbers. The WFC solve stays at load.
- Colliders stay the loft faces and the rock discs. A shard is a radius, not a wall. The boss is reach the Gate before the timer.
- Phone line on `?shot=walk` and `?shot=sprint` stays drawCalls 7, texMB 184.5, activeVideos 4. Text overlays are DOM. The paw menu is the existing hall backdrop, opened only while the world videos pause.
- A player key, if typed, lives in localStorage and is sent only to api.x.ai. No key is committed. No key means the offline card.

## Done when

1. Doc 69 states the skeleton, the rules, and the JSON format. Shard types are the names in the lore file, with playable-now notes.
2. The schema accepts a card. The same seed writes the same offline card. A different seed writes a different card.
3. Invalid model output repairs or falls back to a valid offline card. The request URL is api.x.ai only.
4. Nouvelle aventure plays the card: 2.5 s intro text, then length, density, the existing solids, Echo Shard pickups, the Gate objective, ending text, and return.
5. Existing play tests and renderlint pass. Walk and sprint phone numbers match the corridor horizon step.
6. Three sample cards, a 720×1600 intro still, a 720×1600 mid still, and a clip at 24 fps under 15 MB.
7. No new Imagine file and no new draw. Echo Shards go through the shared pickup and save, not a second crystal draw.
8. The corridor WFC file is not rewritten during the run.

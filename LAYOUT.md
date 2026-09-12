# LAYOUT — black RIG plates are the hall. Décor is paint.

**Every Grok, every new convo, every player.**  
Ice stills stay (frost play + full example). **Restyle teachers = the three black plates.** Bolt + 2 portals + Y-fork. No décor. A player asks for a room → Grok paints around these, and **does not move anything**.

| pose | RIG (paint on this) | ice example (keep) |
|---|---|---|
| spawn | [`lock/RIG-spawn.jpg`](lock/RIG-spawn.jpg) | [`packs/frost/stills/spawn.jpg`](packs/frost/stills/spawn.jpg) · [`lock/SEAL-spawn.jpg`](lock/SEAL-spawn.jpg) |
| at-A | [`lock/RIG-at-a.jpg`](lock/RIG-at-a.jpg) | [`packs/frost/stills/at-a.jpg`](packs/frost/stills/at-a.jpg) · [`lock/SEAL-at-a.jpg`](lock/SEAL-at-a.jpg) |
| at-B | [`lock/RIG-at-b.jpg`](lock/RIG-at-b.jpg) | [`packs/frost/stills/at-b.jpg`](packs/frost/stills/at-b.jpg) · [`lock/SEAL-at-b.jpg`](lock/SEAL-at-b.jpg) |

Drops: `hall-stills/rig/spawn.jpg` · `at-a.jpg` · `at-b.jpg`.

## Grok Build — what to use (do not invent)

When a player asks for a room (any décor):

1. **Files** (one plate per still, never a finished room as 2nd image):
   - spawn → `lock/RIG-spawn.jpg`
   - at-A → `lock/RIG-at-a.jpg`
   - at-B → `lock/RIG-at-b.jpg`
2. **Tool:** chat `imagine_image_to_image` on that plate. `aspect_ratio` 9:16.
3. **Prompt:** paste [`lock/RIG-PROMPT.txt`](lock/RIG-PROMPT.txt). Replace `{PAINT}` with the player's world (one or two lines). Do not rewrite the lock lines.
4. Show the three stills. Then films = [FILMS.md](FILMS.md) First+Last.

Do **not** attach frost / Mars / ember as a second ref. That dog pose wins and Bolt snaps to spawn.

`{PAINT}` examples:

- `Futuristic Mars sci-fi citadel, Unreal Engine, red canyon, hab-modules, metal floor, ochre sky.`
- `Hot metal, banked embers, soot stone, amber light. Catalog ember.`
- `Pale ice, rime, aurora. Catalog frost.` (only if they want ice back)

## Frozen (never change, any paint)

Depth is **already in the plate** (door size in frame, Bolt size, door gap, Z). Do not zoom. Do not push doors farther/nearer.

- Camera **lock-off**, 9:16, 720×1280
- **Door-to-door spacing** (cyan L ↔ gold R)
- **Bolt-to-door distance** (spawn = center; at-A = teal LEFT sill; at-B = gold RIGHT sill)
- Two doors: energy **cyan-teal LEFT**, **gold-orange RIGHT**
- **Y-fork** — two luminous paths paws → both sills
- Bolt: full-white GSD, BACK, standing, teal collar

## May change

- Hall **décor** in the black void (Mars, moss, ember, dusk, …)
- Door **shape** (oval or RECT) — not wood, not chrome UI
- Skin **on top** of the white coat — not a different dog

## Restyle path (Grok Build chat OK)

`image_to_image` on the **RIG** plate (not on a full ice still):

> Paint the player's world in the black. Do NOT move Bolt. Do NOT move the doors. Do NOT move the light paths. Do NOT zoom. Same depth as this plate. New architecture lines up on THESE portals.

Do **not** attach a finished room (spawn Mars, frost, …) as a second ref — its dog pose wins and Bolt snaps to spawn. One plate per pose. Spawn RIG → spawn still. At-A RIG → at-A still. At-B RIG → at-B still.

Imagine Agent may use the same RIG plates. `imagineStill` still **BANNED for restyle**.

Films after stills: [FILMS.md](FILMS.md) + First/Last pins.

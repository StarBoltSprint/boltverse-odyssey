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

**One hall. Three poses.** Never three separate worlds.

1. **Spawn FIRST** — `imagine_image_to_image` on `lock/RIG-spawn.jpg`, 9:16. Paste the **SPAWN** block of [`lock/RIG-PROMPT.txt`](lock/RIG-PROMPT.txt). Swap `{PAINT}` only. This still is the **hall master**.
2. **at-A** — `imagine_reference_to_image` 9:16:
   - `IMAGE_0` = `lock/RIG-at-a.jpg` (Bolt at teal sill — do not move)
   - `IMAGE_1` = the spawn you just made (décor only — **ignore its dog**)
   - Paste the **AT-A / AT-B** block of RIG-PROMPT.
3. **at-B** — same, `IMAGE_0` = `lock/RIG-at-b.jpg`, `IMAGE_1` = **that same spawn**.

Do **not** run three independent `image_to_image` with the same `{PAINT}` text. Imagine invents a new planet each call. at-A/at-B must copy **pixels** from spawn, not the sentence.

FAIL: Bolt at center on at-A/at-B (spawn dog leaked). FAIL: different canyon/sky/modules than spawn. Recook that plate. Bad stills → no films.

Ice / frost / a random Mars as IMAGE_1 is wrong unless that file **is** the spawn you just painted for this room.

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

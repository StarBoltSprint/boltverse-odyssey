# RIG — how every Grok Build makes stills

**Read this first.** Bad stills = no films. Ice KEEP stays as frost play. These black plates are the teachers.

| pose | plate |
|---|---|
| spawn (center) | [`lock/RIG-spawn.jpg`](lock/RIG-spawn.jpg) |
| at-A (teal LEFT sill) | [`lock/RIG-at-a.jpg`](lock/RIG-at-a.jpg) |
| at-B (gold RIGHT sill) | [`lock/RIG-at-b.jpg`](lock/RIG-at-b.jpg) |

Bolt + 2 energy portals + Y-fork. Black void. Prompt file: [`lock/RIG-PROMPT.txt`](lock/RIG-PROMPT.txt).

## One hall. Three poses.

1. **Spawn FIRST** — `imagine_image_to_image` on `lock/RIG-spawn.jpg`, 9:16. Paste the **SPAWN** block. Swap `{PAINT}` only. This still = **hall master**.
2. **at-A** — `imagine_reference_to_image`, 9:16. `IMAGE_0` = `lock/RIG-at-a.jpg`. `IMAGE_1` = **that spawn**. Paste **AT-A / AT-B** block. Ignore IMAGE_1's dog.
3. **at-B** — same, `IMAGE_0` = `lock/RIG-at-b.jpg`, `IMAGE_1` = **the same spawn**.

Never three separate `image_to_image` with the same `{PAINT}`. That makes three planets.

## Never two Bolts

IMAGE_1's spawn dog **must not** appear on at-A / at-B. Center of those stills is EMPTY. **ONE dog.**

If two dogs → **FAIL**. Recook: `imagine_image_to_image` on the FAIL jpg. DELETE the center/spawn clone. Keep only the sill dog. Same hall. Do not Hang a two-dog still.

## Never move

Do not move Bolt, doors, paths, camera, depth. Door *shape* may adapt (oval|RECT). Décor lives in the black.

## Then films

[FILMS.md](FILMS.md) + `cook-room` first+last. Not before stills PASS.

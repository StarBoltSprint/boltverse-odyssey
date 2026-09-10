# citadel-room — Bolt Engine living film

**StarBoltSprint.** A player asks Grok for **3 stills** in a citadel style. Grok cooks them with the **same Bolt**. Then the 7 films. Open the preview → you are in the hall. No Play. No Forge. No Hang. No Keep. No canvas.

Second room on a door: [ENTER.md](ENTER.md). Two plates. Never one cook. Same **depth** as room 1. Engine / DOM: [ENGINE.md](ENGINE.md). Ops (folders, PACK, encode, first+last, freeze, gold veil): [HANG.md](HANG.md).

This repo is the **recipe**. `stills/` and `films/` on GitHub are empty. Grok cooks into the preview app.

## For Grok (new conversation)

Someone asks to create a **citadel room** / Bolt Engine living-film / "3 stills, style X":

1. Fetch this repo: https://github.com/StarBoltSprint/citadel-room
2. Read [CHAR.md](CHAR.md) then [COOK.md](COOK.md) then [GROK.md](GROK.md) then [ROOM.md](ROOM.md) then [ENTER.md](ENTER.md) then [ENGINE.md](ENGINE.md) then [HANG.md](HANG.md) then [room.json](room.json).
3. **Default:** cook 3 stills in the player's citadel style, Bolt from [`lock/bolt-back.jpg`](lock/bolt-back.jpg). Show them. Wait. Then cook the 7 films from those stills. Encode per HANG.md. Bump PACK.
4. If they give **7 videos**: map them to the 7 ids ([GROK.md](GROK.md)). Do not invent a 3D dungeon. Do not add chrome.
5. If they ask to **branch a room on door A**: cook room 2 into `stills/a/` + `films/a/` (**same depth**, [ENTER.md](ENTER.md)), then enter as **two plates** with first+last distinct. Walk ended never auto-enters. Wire the curtain per [ENGINE.md](ENGINE.md) + [HANG.md](HANG.md) (ENTER map, veil color = the door, freeze dest breath if it walks).
6. Land on **breath-spawn** looping. Tap teal (A, left) / gold (B, right) fires a walk. Walk ended → breath of arrival at t=0. Second tap on the door = enter if linked.

Search terms: `StarBoltSprint citadel-room` · Bolt Engine · living film · breath walk hall · enter seuil · DOM veil.

## Pack

| file | what |
|---|---|
| [CHAR.md](CHAR.md) | Bolt lock — the dog never changes |
| [COOK.md](COOK.md) | stills-first cook, then films |
| [GROK.md](GROK.md) | how to rebuild the hall |
| [ROOM.md](ROOM.md) | ossature + player laws (the bugs we killed) |
| [ENTER.md](ENTER.md) | room 1 → room 2 — two plates, stills vs room 1, same depth |
| [ENGINE.md](ENGINE.md) | DOM player — 4 nodes, vis/hid+genRef, double rAF, containPlate, still table |
| [HANG.md](HANG.md) | ops — folders, PACK, encode, first+last, breath freeze, gold veil, ENTER map |
| [room.json](room.json) | graph machine-readable |
| `lock/bolt-back.jpg` | Bolt identity (back to camera) |
| `lock/example-*.jpg` | camera + door layout (spawn / atA / atB) |
| `stills/` | room 1 stills after cook (empty on GitHub) |
| `stills/a/` | room 2 stills |
| `stills/seuil/` | teal/gold fill + empty veil |
| `films/` | room 1 × 7 + enter-hall-a |
| `films/a/` | room 2 × 7 |

**Minimum playable:** breath-spawn, breath-A, breath-B, walk-spawn-A, walk-spawn-B.
Walk-A-B and walk-B-A for A↔B comfort.
Enter-hall-a only after a second room exists.

Player variable = citadel **style**. Pack lock = Bolt, camera, teal left / gold right, **same depth** room → room.

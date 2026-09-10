# citadel-room — Bolt Engine living film

**StarBoltSprint.** A player asks Grok for **3 stills** in a citadel style. Grok cooks them with the **same Bolt**. Then the 7 films. Open the preview → you are in the hall. No Play. No Forge. No Hang. No Keep. No canvas.

Second room on a door: [ENTER.md](ENTER.md). Two plates. Never one cook. Same **depth** as room 1. Engine / DOM: [ENGINE.md](ENGINE.md). Ops: [HANG.md](HANG.md).

**This repo is the recipe, not the hang.** `stills/` and `films/` on GitHub are empty (`.gitkeep`). The stills and mp4 of *this* citadel live in the preview app. Do not commit them here — a new player would inherit the wrong hall. `lock/` is Bolt + camera only.

## For Grok (new conversation)

Someone asks to create a **citadel room** / Bolt Engine living-film / "3 stills, style X":

1. Fetch this repo: https://github.com/StarBoltSprint/citadel-room
2. Read [CHAR.md](CHAR.md) then [COOK.md](COOK.md) then [GROK.md](GROK.md) then [ROOM.md](ROOM.md) then [ENTER.md](ENTER.md) then [ENGINE.md](ENGINE.md) then [HANG.md](HANG.md) then [room.json](room.json).
3. **Default:** cook 3 stills in the player's citadel style, Bolt from [`lock/bolt-back.jpg`](lock/bolt-back.jpg). Show them. Wait. Then cook the 7 films from those stills. Encode H264 `yuv420p` +faststart, **no audio**. `playsInline` + `muted` before `play()`. Bump PACK.
4. If they give **7 videos**: map them to the 7 ids ([GROK.md](GROK.md)). Do not invent a 3D dungeon. Do not add chrome.
5. If they ask to **branch a room on door A**: cook room 2 into `stills/a/` + `films/a/` (**same depth**, [ENTER.md](ENTER.md)), then enter as **two plates** with first+last distinct. Enter lives in `ENTER{}`, not `room.clips`. `ended` → switch room **then** dest breath. Walk ended never auto-enters. Veil color = the door.
6. Land on **breath-spawn** looping. Tap teal (A, left) / gold (B, right) fires a walk. Walk ended → breath of arrival at t=0. Second tap on the door = enter if linked.

Search terms: `StarBoltSprint citadel-room` · Bolt Engine · living film · breath walk hall · enter seuil · DOM veil.

## Pack

| file | what |
|---|---|
| [CHAR.md](CHAR.md) | Bolt lock — the dog never changes |
| [COOK.md](COOK.md) | stills-first cook, then films |
| [GROK.md](GROK.md) | how to rebuild the hall |
| [ROOM.md](ROOM.md) | ossature — encode flags, playsInline, ENTER map, player bugs |
| [ENTER.md](ENTER.md) | room 1 → room 2 — two plates, stills vs room 1, same depth |
| [ENGINE.md](ENGINE.md) | DOM player — 4 nodes, vis/hid+genRef, double rAF, containPlate |
| [HANG.md](HANG.md) | ops — folders, PACK, encode, first+last, freeze, gold veil |
| [room.json](room.json) | graph machine-readable |
| `lock/bolt-back.jpg` | Bolt identity (back to camera) |
| `lock/example-*.jpg` | camera + door layout (spawn / atA / atB) |
| `stills/` `films/` | **empty on GitHub** — Grok cooks the player's citadel into the preview |
| `stills/a/` `films/a/` | room 2 paths (empty here) |
| `stills/seuil/` | teal/gold fill + empty veil (empty here) |

**Minimum playable:** breath-spawn, breath-A, breath-B, walk-spawn-A, walk-spawn-B.
Walk-A-B and walk-B-A for A↔B comfort.
Enter-hall-a only after a second room exists — **outside the 7**, `ENTER{}`.

Player variable = citadel **style**. Pack lock = Bolt, camera, teal left / gold right, **same depth** room → room.

# citadel-room — Bolt Engine living film

**StarBoltSprint.** A player asks Grok for **3 stills** in a citadel style. Grok cooks them with the **same Bolt**. Then the 7 films. Open the preview → you are in the hall. No Play. No Forge. No Hang. No Keep. No canvas.

Second room on a door: [ENTER.md](ENTER.md). Two plates. Never one cook. Same **depth** as room 1. Engine clock: [ENGINE.md](ENGINE.md).

## For Grok (new conversation)

Someone asks to create a **citadel room** / Bolt Engine living-film / "3 stills, style X":

1. Fetch this repo: https://github.com/StarBoltSprint/citadel-room
2. Read [CHAR.md](CHAR.md) then [COOK.md](COOK.md) then [GROK.md](GROK.md) then [ROOM.md](ROOM.md) then [ENTER.md](ENTER.md) then [ENGINE.md](ENGINE.md) then [room.json](room.json).
3. **Default:** cook 3 stills in the player's citadel style, Bolt from [`lock/bolt-back.jpg`](lock/bolt-back.jpg). Show them. Wait. Then cook the 7 films from those stills.
4. If they give **7 videos**: map them to the 7 ids ([GROK.md](GROK.md)). Do not invent a 3D dungeon. Do not add chrome.
5. If they ask to **branch a room on door A**: cook room 2 as a full pack (**same depth** as room 1, [ENTER.md](ENTER.md)), then enter as **two plates**. Walk ended never auto-enters. Wire the curtain per [ENGINE.md](ENGINE.md).
6. Land on **breath-spawn** looping. Tap teal (A, left) / gold (B, right) fires a walk. Walk ended → breath of arrival at t=0. Second tap on the door = enter if linked.

Search terms: `StarBoltSprint citadel-room` · Bolt Engine · living film · breath walk hall · enter seuil.

## Pack

| file | what |
|---|---|
| [CHAR.md](CHAR.md) | Bolt lock — the dog never changes |
| [COOK.md](COOK.md) | stills-first cook, then films |
| [GROK.md](GROK.md) | how to rebuild the hall |
| [ROOM.md](ROOM.md) | ossature + player laws (the bugs we killed) |
| [ENTER.md](ENTER.md) | room 1 → room 2 — two plates, stills vs room 1, same depth |
| [ENGINE.md](ENGINE.md) | graphic clock — DOM, fades, still, veil, required assets |
| [room.json](room.json) | graph machine-readable |
| `lock/bolt-back.jpg` | Bolt identity (back to camera) |
| `lock/example-*.jpg` | camera + door layout (spawn / atA / atB) |
| `stills/` | the player's 3 stills after cook |
| `stills/seuil/` | teal-fill (last of enter) + teal-empty (veil) |
| `films/` | 7 mp4 after cook + enter-hall-a |

**Minimum playable:** breath-spawn, breath-A, breath-B, walk-spawn-A, walk-spawn-B.
Walk-A-B and walk-B-A for A↔B comfort.
Enter-hall-a only after a second room exists.

Player variable = citadel **style**. Pack lock = Bolt, camera, teal left / gold right, **same depth** room → room.

# citadel-room — Bolt Engine living film

**StarBoltSprint.** A player asks Grok for **3 stills** in a citadel style. Grok cooks them with the **same Bolt**. Then the 7 films. **Give the player URL — do not scaffold a new app.**

**Player:** https://boltverse-odyssey.grok.me  
**How Grok uses it:** [PLAYER.md](PLAYER.md)

Second room on a door: [ENTER.md](ENTER.md). Two plates. Never one cook. Same **depth** as room 1. Engine / DOM: [ENGINE.md](ENGINE.md). Ops: [HANG.md](HANG.md). Box: [VALIDATE.md](VALIDATE.md). Content: [SMOKE.md](SMOKE.md).

**This repo is the recipe, not the hang.** `stills/` and `films/` at root are empty (`.gitkeep`). Hung discs live in `packs/<id>/`. `lock/` is Bolt + camera only.

## For Grok (new conversation)

Someone asks to create a **citadel room** / Bolt Engine living-film / "3 stills, style X":

1. Fetch this repo: https://github.com/StarBoltSprint/citadel-room
2. Read [PLAYER.md](PLAYER.md) first. Then [CHAR.md](CHAR.md) [COOK.md](COOK.md) [GROK.md](GROK.md).
3. **Do not build / publish a new grok.me.**
4. If `packs/<id>` exists → only `https://boltverse-odyssey.grok.me/r/<id>` (`/` = golden `citadel`).
5. Else cook 3 stills (Bolt from [`lock/bolt-back.jpg`](lock/bolt-back.jpg)), wait, cook the 7 films into `packs/<id>/`. Encode H264 `yuv420p` +faststart, **no audio**.
6. `node scripts/validate-pack.mjs packs/<id>` then `node scripts/smoke-pack.mjs packs/<id>`.
7. FAIL a **required** clip → recook **that file only**, cap **2**, smoke again. Then push and give the URL. Optional FAIL = WARN, drop or recook, do not block.
8. Branch a room on a door: [ENTER.md](ENTER.md) inside that pack. Neighbor citadel = another pack id on the **same** player.

Search terms: `StarBoltSprint citadel-room` · Bolt Engine · living film · PLAYER.md · boltverse-odyssey.grok.me

## Pack

| file | what |
|---|---|
| [PLAYER.md](PLAYER.md) | salon URL — do not scaffold |
| [VALIDATE.md](VALIDATE.md) | box check before hang |
| [SMOKE.md](SMOKE.md) | clone / first-last / recook cap 2 |
| [CHAR.md](CHAR.md) | Bolt lock — the dog never changes |
| [COOK.md](COOK.md) | stills-first cook, then films |
| [GROK.md](GROK.md) | how to rebuild the hall |
| [ROOM.md](ROOM.md) | skeleton — encode flags, playsInline, ENTER map, player bugs |
| [ENTER.md](ENTER.md) | room 1 → room 2 — two plates, stills vs room 1, same depth |
| [ENGINE.md](ENGINE.md) | DOM player — 4 nodes, vis/hid+genRef, double rAF, containPlate |
| [HANG.md](HANG.md) | ops — folders, PACK, encode, first/last, freeze, gold veil |
| [room.json](room.json) | graph machine-readable |
| `scripts/validate-pack.mjs` | room.json + 3 stills + 5 films, H264, no audio |
| `scripts/smoke-pack.mjs` | one dog, first≠last on walks, breath loops |
| `lock/bolt-back.jpg` | Bolt identity (back to camera) |
| `lock/example-*.jpg` | camera + door layout (spawn / atA / atB) |
| `packs/<id>/` | hung discs — Grok writes here |
| `stills/` `films/` | **empty on GitHub** — do not hang at root |

**Minimum playable:** breath-spawn, breath-A, breath-B, walk-spawn-A, walk-spawn-B.
Walk-A-B and walk-B-A for A↔B comfort.
Enter-hall-a only after a second room exists — **outside the 7**, `ENTER{}`.

Player variable = citadel **style**. Pack lock = Bolt, camera, teal left / gold right, **same depth** room → room.

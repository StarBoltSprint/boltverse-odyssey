# PACK — the only object that travels

Cook, share, play: **the same folder**. Whoever emits it — Grok, a friend, a script — the one player reads it. Nobody forks ENGINE for “their” hall.

Auth off, DB off: already in `room.json`. Do not turn them on to scale.

```
a folder  +  room.json  +  named files
        ↓
   validate-pack
        ↓
   PASS → the player eats it
   FAIL → stock / no URL
```

No user API. No Postgres table. No second “richer” reader.

## Folder (floor 1)

```
<id>/
  room.json
  stills/spawn.jpg
  stills/at-a.jpg
  stills/at-b.jpg
  films/breath-spawn.mp4
  films/walk-spawn-a.mp4
  films/walk-spawn-b.mp4
  films/breath-a.mp4
  films/breath-b.mp4
```

Optional (floor 2): `films/walk-a-b.mp4` `films/walk-b-a.mp4`

Floor 3 is **not** required for a valid pack. If it exists: `stills/a/` `films/a/` `films/enter-hall-a.mp4` `stills/seuil/`.

All paths relative to the pack root. No absolute URL required in `room.json` (the player prefixes `/packs/<id>/` + `?PACK`).

## Frozen `room.json` (what the player reads)

Floor 1 minimum:

- `id`, `open: "breath-spawn"`
- `format: 1`
- `plate: "720x1280"`, `aspect: "9:16"`, `camera: "lock-off"`
- `chrome: "none"`, `auth: false`, `database: false`
- `PACK` or `pack` (int / `uN`) — cache-bust
- `stills.spawn | atA | atB`
- `clips` — the 5 required ids + `stillStart` / `stillEnd` / `act` / `loop` / `file`
- `edges` spawn→A, spawn→B, same-door stay
- `hits` 40/20/40
- `player.dualVideo`, `stillUnderlayer`

The player **ignores** unknown fields (lore, style).  
It **refuses** contradictions: `chrome != none`, `auth: true`, 16:9, 3rd door.

`worldLine` / `style` = catalog string. Cosmetic + adjacency. Not play logic.

## Only I/O

| Role | I/O |
|---|---|
| Cook | **writes** a folder in this shape |
| validate-pack | **reads** the folder, exits 0 or 1 |
| Player | **reads** the same folder |
| Human | sends the folder / a zip / an id |

Not: event JSON, websocket, login, “room record in Neon”.  
Hang = copy the folder to `packs/<id>/` + bump PACK + **`smoke.json` from `node scripts/smoke-pack.mjs`** (`ok: true`). No smoke.json → not a pack. The player loads stock. Do not write this file by hand.

Two different cooks (Grok vs script) are compatible as soon as the **filenames** match. Crowding = **fork the pack, not the engine**.

## `validate-pack` (box, not eye)

Not a visual linter. That is Smoke **before**. Here: is this folder a pack?

```
1. room.json parse + required fields
2. plate == 720x1280, auth == false, open == breath-spawn, format 1
3. stills + 5 films exist
4. clips[].file points inside the folder (no file://, no required external http)
5. edges spawn A/B exist
6. walk-A-B: if required true → file there; else OK absent
7. ENTER: if present, to ∈ catalog and clip exists; else ignore
8. PACK present
```

Exit `0` → player may mount `/r/<id>`.  
Exit `1` → do not publish; stock.

Does **not** redo pHash / face. Mix Smoke into validate → the script is no longer 20 lines and nobody else ships.

True order: Imagine → Smoke → write files → **validate-pack** → publish.

## One player

One app. One ENGINE.md.

```
GET /r/:id
  pack = packs/:id
  fast validate (files + json)
  else → stock
  else → load room.json, preload required clips, breath-spawn
```

New maker: does not clone the player repo. Drops a zip that passes validate.  
If the hall needs a 3rd `<video>` or WASD, it is **not** a citadel pack. Other product. Do not “enrich ENGINE for them.”

## Format version

`format: 1` in `room.json`.  
Breaking change (rename `breath-A` → `idle-left`) = `format: 2` **and** player v1 still reads v1.  
Until crowding starts, do not break current ids (`breath-spawn`, `walk-spawn-A`, …). They are already in the repo.

## What does not live in the pack

- secrets, accounts
- player code
- decrees
- `lock/bolt-back` (recipe GitHub; the pack already has cooked stills)
- an artifact DB

The pack is **dead and playable**. Zip it, mail it, drop it.

## Crowding test

A friend who has not read ENTER.md:

1. copy `packs/stock`
2. replace the 3 stills + 5 films (Smoke on their side, or not)
3. `node scripts/validate-pack.mjs ./their-folder`
4. drop into `packs/their-id`

If the tap works, the format holds.  
If they had to patch the player, the format failed — you reopened the engine.

## One line

The world is a folder that looks like this. The game is one reader. Whoever writes the folder does not touch the reader. Whoever touches the reader broke the contract.

Golden disc (floor 1 zip): [citadel-stock-v1](https://github.com/StarBoltSprint/boltverse-odyssey/releases/tag/citadel-stock-v1). Not in `main`. Unzip → `packs/citadel/`.

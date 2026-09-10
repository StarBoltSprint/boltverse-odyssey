# PLAYER — one salon, many packs

**Player (always on):** https://boltverse-odyssey.grok.me
**Recipe + packs:** this repo.

Do **not** scaffold a new Vite / a new grok.me when someone asks for a citadel.
Give the player URL. Cook writes into `packs/<id>/` here.

## Law 0 — Imagine first + last (automatic)

Every new conversation. Do not wait to be asked. Details: [COOK.md](COOK.md).

| kind | Imagine call | first | last |
|---|---|---|---|
| **walks** | first AND last frame (`reference_to_video` / `image` + `last_frame`) | start still | arrive still — **distinct** |
| **enter** | same | at-still | fill veil — **never** dest spawn |
| **breath** | `image_to_video` on **one** still | pose still | **same** still |

Never `image_to_video` a walk or enter on a single still. That invents the journey and clones the dog. Breath is the only legal `first = last`.

**Law 1 — floors.** Default cook = one room, 5 films, no Enter. [FLOORS.md](FLOORS.md). `/` is stock (floor 0). `/r/citadel` is the 3-room demo (floor 3), not the default.

```
Player (any conversation): "citadel moss"
        ↓
Grok: packs/moss exists?
  yes → https://boltverse-odyssey.grok.me/r/moss
  no  → cook into packs/moss/ (Law 0 on every film) → validate + smoke → same URL
```

Their chat is the ticket office. This grok.me is the hall.
Never copy the player into their sandbox.

## URLs

| URL | Pack |
|---|---|
| https://boltverse-odyssey.grok.me | **stock** — room 1 only, Enter off. Default landing. |
| https://boltverse-odyssey.grok.me/r/citadel | the 3-room hall (room 1 + 2 + 3, Enter on). Not stock. |
| https://boltverse-odyssey.grok.me/r/<id> | catalog pack `packs/<id>/`. Unknown / FAIL → stock. |

## What a pack is

```
packs/<id>/
  room.json
  stills/spawn.jpg  at-a.jpg  at-b.jpg
  films/breath-spawn.mp4 … (the 7)
```

GitHub = discs. grok.me = one DVD player. Same ENGINE.md.
Room 2 **inside** a pack still uses `stills/a/` + `films/a/` + ENTER.md.
A **neighbor citadel** is another pack id, not a new site.

After cook, before URL:

```
node scripts/validate-pack.mjs packs/<id>
node scripts/smoke-pack.mjs packs/<id>
```

FAIL → recook that clip (cap 2). Do not push. Do not give `/r/<id>`. See [VALIDATE.md](VALIDATE.md) [SMOKE.md](SMOKE.md).

## WorldLines (catalog, not Mars)

citadel · moss · ember · dusk · asteroid · frost · ivy · ash · tide · ember-deep

Paints: [CATALOG.md](CATALOG.md). Off-list → nearest or one question. Do not invent a free-text temple. New slot = a PR, not chat.

## Grok in a new conversation

1. Read this file then [GROK.md](GROK.md). **Law 0 first.**
2. **Do not build an app.**
3. If they want a style already in `packs/` → only the URL.
4. If they want a new WorldLine → cook pack into `packs/<id>/` (CHAR, COOK, Law 0 on every film), validate + smoke, then the URL.
5. Enter to another citadel = `ENTER` dest pack id, player stays on boltverse-odyssey.grok.me.

After the player code changes (this Grok Build), the keeper **republishes** grok.me once.
After a **pack** is pushed here, no republish — the player fetches `packs/<id>`.

`stills/` and `films/` at repo root stay empty. Packs live under `packs/`.

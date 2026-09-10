# PLAYER — one salon, many packs

**Player (always on):** https://boltverse-odyssey.grok.me
**Recipe + packs:** this repo.

Do **not** scaffold a new Vite / a new grok.me when someone asks for a citadel.
Give the player URL. Cook writes into `packs/<id>/` here.

```
Joueur (n’importe quelle convo) : « citadel mousse »
        ↓
Grok : packs/moss exists?
  yes → https://boltverse-odyssey.grok.me/r/moss
  no  → cook into packs/moss/ → same URL
```

Their chat is the ticket office. This grok.me is the hall.
Never copy the player into their sandbox.

## URLs

| URL | Pack |
|---|---|
| https://boltverse-odyssey.grok.me | golden hall (`citadel`) — default |
| https://boltverse-odyssey.grok.me/r/\<id\> | catalog pack `packs/<id>/` |

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

## WorldLines (catalog, not Mars)

citadel · moss · ember · dusk · asteroid · frost · ivy · ash · tide · ember-deep

Off-list → map to nearest or refuse. Do not invent a free-text temple.

## Grok in a new conversation

1. Read this file then [GROK.md](GROK.md).
2. **Do not build an app.**
3. If they want a style already in `packs/` → only the URL.
4. If they want a new WorldLine → cook pack into `packs/<id>/` (CHAR, COOK, encode HANG), then the URL.
5. Enter to another citadel = `ENTER` dest pack id, player stays on boltverse-odyssey.grok.me.

After the player code changes (this Grok Build), the keeper **republishes** grok.me once.
After a **pack** is pushed here, no republish — the player fetches `packs/<id>`.

`stills/` and `films/` at repo root stay empty. Packs live under `packs/`.

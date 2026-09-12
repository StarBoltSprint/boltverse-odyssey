# PLAYER — one salon, many packs

**Player:** https://boltverse-odyssey.grok.me  
**Recipe:** this repo.

Do **not** scaffold a new Vite / a new grok.me. Give the player URL. Cook writes `packs/<id>/` here.

## New conversation — stop here

Read **[GROK.md](GROK.md) — stop.** This page is the salon map, not the job.

```
Job = node scripts/cook-room.mjs <slot>
Floor 1 = 3 stills + 5 films. No Enter. No wait.
No chat Imagine — not stills, not walks, not enter. Hook only.
PASS → /r/<id>
Off-list / FAIL ×2 → /
```

CHAR + COOK after GROK.md.  
ENTER only if they asked for a neighbor.  
ENGINE only if the tap is broken.

## URLs

| URL | Pack |
|---|---|
| https://boltverse-odyssey.grok.me | **stock** — floor 0, Enter off. Fail / off-list land here. |
| https://boltverse-odyssey.grok.me/r/<id> | catalog pack `packs/<id>/`. Unknown / FAIL → stock. |
| https://boltverse-odyssey.grok.me/r/citadel | 3-room **demo** (floor 3). Not the default cook. |

Their chat is the ticket office. This grok.me is the hall. Never copy the player into their sandbox.

## What a pack is (floor 1)

```
packs/<id>/
  room.json
  stills/spawn.jpg  at-a.jpg  at-b.jpg
  films/breath-spawn.mp4
  films/breath-a.mp4  breath-b.mp4
  films/walk-spawn-a.mp4  walk-spawn-b.mp4
```

**Minimum playable = 5.** A↔B and Enter are **not** in the default file. [PACK.md](PACK.md).

After cook, before URL:

```
node scripts/validate-pack.mjs packs/<id>
node scripts/smoke-pack.mjs packs/<id>
```

FAIL → recook that clip (cap 2). Do not push. Do not give `/r/<id>`.

## WorldLines

citadel · moss · ember · dusk · asteroid · frost · ivy · ash · tide · ember-deep

[CATALOG.md](CATALOG.md). Off-list → nearest or one question. Never a free-text temple.

After **player** code changes: republish grok.me once.  
After a **pack** push: no republish — the player fetches `packs/<id>`.

One reader. Whoever writes the folder does not touch the reader.

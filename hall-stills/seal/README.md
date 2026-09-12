# COOK / LOCK — Imagine Agent ice-hall KEEP seals

This folder is the **drop slot** for SmiR’s ice-cathedral KEEP stills. It is not a pack. It is not hung.

Imagine Agent produced these three KEEP seals. Frozen **pose + décor** for this ice hall until SmiR reseals. Agent remains the STYLE stills path for future styles (never video). Walks / breaths = hooks first+last.

**Expected files:**

| drop | pose |
|---|---|
| `hall-stills/seal/spawn-ice.jpg` | mid-hall, dead-center BEHIND white GSD, back/withers only; cyan L / gold R ahead (SPAWN / breath-spawn) |
| `hall-stills/seal/at-a-ice.jpg` | white GSD BACK at CYAN LEFT portal sill (at-A) |
| `hall-stills/seal/at-b-ice.jpg` | white GSD BACK at GOLD RIGHT portal sill (at-B) |

Same ice décor. Cyan L / gold R energy portals (oval|RECT). Portals dwarf the dog. Standing. No chrome. No wood.

Then:

```
node scripts/install-lock-ata.mjs --dry-run
node scripts/install-lock-ata.mjs
```

That writes `lock/SEAL-spawn.jpg` + `lock/SEAL-at-a.jpg` + `lock/SEAL-at-b.jpg` (720×1280). Spawn seal does **not** overwrite `lock/example-spawn.jpg`. Live install of at-A / at-B also writes the lock examples.

`cook-room` **SKIPS** `imagineStill` for spawn, at-A, and at-B when those SEAL files exist (`SEAL=1` / `SEAL_SPAWN=1` / `SEAL_ATA=1` / `SEAL_ATB=1` also freeze). Hung PASS packs are not overwritten. **Smoke still gates.** Soft KEEP banned.

Do **not** invent a new dog. Do **not** drop `lock/example-at-*-tiny.jpg` here.

No new grok.me. No chat Imagine.

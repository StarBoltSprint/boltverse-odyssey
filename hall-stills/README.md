# COOK / LOCK — SmiR at-A teacher drop

This folder is the **drop slot** for SmiR’s hand still. It is not a pack. It is not hung.

**Expected file:** `hall-stills/smir-ata-teacher.jpeg`

Teacher must show Bolt **standing BACK toward the teal LEFT** energy rift, **gold still visible**. Oval energy is OK (PR #6). RECT energy is OK. Never wood. Never chrome UI.

Then:

```
node scripts/install-lock-ata.mjs --dry-run
node scripts/install-lock-ata.mjs
```

That writes `lock/example-at-a.jpg` (720×1280) **and** `lock/SEAL-at-a.jpg` (owner freeze).

**Packs may copy** `lock/example-at-a.jpg` (or `lock/SEAL-at-a.jpg`) **to** `packs/<slot>/stills/at-a.jpg` when:

- Smoke **place** is acceptable, **OR**
- the owner seals (`SEAL_ATA=1` or `lock/SEAL-at-a.jpg` present)

**sealed at-A = frozen; do not Imagine new at-A pose.** `cook-room` copies the seal after spawn PASS and **SKIPS** `imagineStill` for at-A. Restyle the hall via spawn cook. Keep the sealed still when it is the same hall.

Unsealed cooks still prefer this lock example as the at-A side ref (not hung moss décor):

> copy PLACE+POSE from example; FORCE taille 0.35–0.40; FORCE STANDING; never shrink to 0.18; hall materials from spawn/catalog only — ignore example décor.

Do **not** drop `lock/example-at-a-tiny.jpg` here as a non-owner path. The install script refuses that hash unless the file is the owner drop at `hall-stills/`.

This checkout has the drop. `node scripts/install-lock-ata.mjs` writes the lock example + the SEAL file. No new grok.me. No chat Imagine.

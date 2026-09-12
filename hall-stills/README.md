# COOK / LOCK — SmiR KEEP / at-A teacher drop

This folder is the **drop slot** for SmiR’s KEEP stills. It is not a pack. It is not hung.

**Ice-hall KEEP (Imagine Agent, frozen until SmiR reseals):**

- `hall-stills/seal/spawn-ice.jpg` — mid-hall, dead-center BEHIND white GSD, back/withers only
- `hall-stills/seal/at-a-ice.jpg` — standing BACK at cyan LEFT sill
- `hall-stills/seal/at-b-ice.jpg` — standing BACK at gold RIGHT sill

See [`hall-stills/seal/README.md`](seal/README.md). Agent remains the primary cook path for future styles. These three are frozen pose+décor for this ice hall.

**Legacy at-A teacher:** `hall-stills/smir-ata-teacher.jpeg`

Teacher / KEEP must show Bolt **standing BACK** at the teal LEFT or gold RIGHT energy rift. Oval energy is OK (PR #6). RECT energy is OK. Never wood. Never chrome UI.

Then:

```
node scripts/install-lock-ata.mjs --dry-run
node scripts/install-lock-ata.mjs
```

That writes `lock/example-at-a.jpg` (720×1280) **and** `lock/SEAL-spawn.jpg` / `lock/SEAL-at-a.jpg` / `lock/SEAL-at-b.jpg` when the ice drops are present. Spawn seal does not overwrite `lock/example-spawn.jpg`.

**Packs may copy** the SEAL files to `packs/<slot>/stills/spawn.jpg` / `at-a.jpg` / `at-b.jpg` when the pack still is missing. Hung PASS is kept. `cook-room` **SKIPS** `imagineStill` for spawn / at-A / at-B when seals exist. **Smoke still gates.** Soft KEEP banned.

Unsealed first-seal CLI still prefers the lock example as the at-A side ref (not hung moss décor):

> copy PLACE+POSE from example; FORCE taille 0.35–0.40; FORCE STANDING; never shrink to 0.18; hall materials from spawn/catalog only — ignore example décor.

Do **not** drop `lock/example-at-a-tiny.jpg` here as a non-owner path. The install script refuses that hash unless the file is an owner drop.

No new grok.me. No chat Imagine.

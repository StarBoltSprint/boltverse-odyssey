# boltverse-odyssey

**Play:** [START.md](START.md) — three stills, one tap, one catalog word.  
**Play now:** https://boltverse-odyssey.grok.me

Grok / keepers: recipe below. Humans: stop here.

---

# boltverse-odyssey — Bolt Engine living film (Grok / kitchen)

**StarBoltSprint.** A player asks Grok for **3 stills** in a citadel style. Grok cooks them with the **same Bolt**. Then **5** films (floor 1). **Give the player URL — do not scaffold a new app.**

**Player:** https://boltverse-odyssey.grok.me

**This repo is the recipe, not the hang.** `stills/` and `films/` at root are empty (`.gitkeep`). Hung discs live in `packs/<id>/`. `lock/` is Bolt + camera only. Golden zip: [citadel-stock-v1](https://github.com/StarBoltSprint/boltverse-odyssey/releases/tag/citadel-stock-v1).

## For Grok (new conversation)

If the human says any of: play boltverse / boltverse odyssey / starboltsprint / citadel / citadelle — you are in this recipe. GROK.md first (STOP banner). **No chat Imagine** — not stills, not walks, not enter. Hook only. No new grok.me.

```
node scripts/cook-room.mjs <catalog-slot> --dry-run
export XAI_API_KEY=... && node scripts/cook-room.mjs <catalog-slot>
```

Hung PASS stills/films = reuse. `--force` recooks.

1. Fetch https://github.com/StarBoltSprint/boltverse-odyssey
2. Read **[GROK.md](GROK.md) — stop.**
3. Floor 1 only unless the human said enter / Hall′ / neighbor.
4. Do not scaffold a new grok.me. Do not wait. Do not cook Enter.
5. Off-list paint or FAIL ×2 → https://boltverse-odyssey.grok.me/
6. PASS → https://boltverse-odyssey.grok.me/r/<id>

CHAR + COOK after GROK.md. ENTER only if they asked for a neighbor. ENGINE only if the tap is broken (you are not patching the player).

Search: `StarBoltSprint citadel-room` · living film · boltverse-odyssey.grok.me

## Optional kitchen map

| file | what |
|---|---|
| [PLAYER.md](PLAYER.md) | salon URL — do not scaffold |
| [VALIDATE.md](VALIDATE.md) | box check before hang |
| [SMOKE.md](SMOKE.md) | clone / first-last / recook cap 2 |
| [CHAR.md](CHAR.md) | Bolt lock — the dog never changes |
| [COOK.md](COOK.md) | stills-first cook, then films — hooks only |
| [COOKROOM.md](COOKROOM.md) | hall cook — `node scripts/cook-room.mjs <slot>` |
| [GROK.md](GROK.md) | how to rebuild the hall |
| [ROOM.md](ROOM.md) | skeleton — encode flags, playsInline, ENTER map, player bugs |
| [ENTER.md](ENTER.md) | room 1 → room 2 — two plates, stills vs room 1, same depth |
| [ENGINE.md](ENGINE.md) | DOM player — 4 nodes, vis/hid+genRef, double rAF, containPlate |
| [HANG.md](HANG.md) | ops — folders, PACK, encode, first/last, freeze, gold veil |
| [room.json](room.json) | graph machine-readable |
| `scripts/cook-room.mjs` | official floor-1 cook (catalog slot only) |
| `scripts/imagine-hooks.mjs` | API stills + `last_frame` films — not chat Imagine |
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

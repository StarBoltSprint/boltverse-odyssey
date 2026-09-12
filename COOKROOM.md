# COOKROOM — the corridor (floor 1)

```
node scripts/cook-room.mjs <catalog-slot> --dry-run
export XAI_API_KEY=... && node scripts/cook-room.mjs <catalog-slot>
node scripts/cook-room.mjs <catalog-slot> --force
```

`--dry-run` first (no key, prints skip vs cook). Live needs `XAI_API_KEY` only for plates it Imagines.  
`slot` ∈ [CATALOG.md](CATALOG.md). Off-list → stock URL, exit 1.

Hung pack with PASS stills/films = **reuse**. Only missing / smoke-FAIL plates go through Imagine. `--force` / `COOK_FORCE=1` recooks. Never wipe a hung `room.json` or a PASS still. **Sealed skip stays.**

That script is the hall cook for **first-seal** stills and for **all films**. Films go through [scripts/imagine-hooks.mjs](scripts/imagine-hooks.mjs) (`imagineClip` + `last_frame`). First-seal stills go through `imagineStill`. No `XAI_API_KEY` when a plate must Imagine → refuse (stock). No Chat Imagine UI without Agent for walks.

**Cross-style at-A / at-B:** do **not** invent a new dog via `imagineStill`. Start from a **SEALED** sill still (dog already AT the teal or gold threshold). Then **[Imagine Agent](https://grok.com/imagine/agent)** — keep the exact same dog pose / size / place and the same cyan/gold portals; change hall materials only (ice / ember / catalog). Imagine Agent is the **hall-restyle** tool for sealed stills.

Validate and Smoke judge a **full** folder. This file **fills** it.

Need `XAI_API_KEY` for a live cook.  
No key or `--dry-run` → print the queue, no forge.  
Grok does not paste Imagine prompts in chat when the script can run.

Tap never cooks. [DONT.md](DONT.md).

Lane / biome cook is **not** this page. That is [COOKLANE.md](COOKLANE.md). `citadel moss` → here. `biome forest` → there.

## Command

```
node scripts/cook-room.mjs moss --dry-run
COOK_DEBUG=1 node scripts/cook-room.mjs dusk
export XAI_API_KEY=... && node scripts/cook-room.mjs moss
node scripts/cook-room.mjs moss --force
```

`--dry-run` = skip vs cook (smokes existing files, no Imagine). Live = key only if a plate will cook. `--force` recooks PASS plates too. No Chat Imagine UI without Agent for walks (no `last_frame`). Sealed cross-style stills = **Imagine Agent**.

## Order (do not wait)

0. Each dest still/film: exists + smoke PASS → **skip Imagine** (reuse). `--force` ignores this. **Sealed skip stays.**
1. `packs/<id>/` + skeleton `room.json` **only if missing** (never overwrite a hung graph)
2. spawn still = lock + example-spawn + `catalog/<slot>.md` — skip if hung PASS. First seal only.
3. smoke still-spawn — FAIL ×2 → **stop**, print stock
4. **First seal** atA / atB = `imagineStill` **edits that spawn** (bolt-back = coat, IGNORE ~0.53; atA side ref = `lock/example-at-a.jpg` SmiR lock teacher; atB side ref = hung moss PASS / swapped `lock/example-at-b`) — skip each if hung PASS. atA: copy PLACE+POSE from example; **FORCE taille 0.35–0.40; FORCE STANDING; never shrink to 0.18**; hall materials from spawn/catalog only — ignore example décor. IGNORE tiny ~0.18 crop like bolt-back 0.53. Never `example-at-*-tiny`. Drop missing? [`hall-stills/README.md`](hall-stills/README.md) + `node scripts/install-lock-ata.mjs`.
4b. **Cross-style** at-A / at-B from a **SEALED** sill (dog already AT the threshold): **Imagine Agent** (`https://grok.com/imagine/agent`) — keep exact same dog pose / size / place and same cyan/gold portals; change hall materials only. Do **not** invent a new dog via `imagineStill`. Then smoke the restyle. Sealed skip stays.
5. smoke those stills — FAIL ×2 on one at → stop (no films)
6. 5 films, **one by one**, smoke after each (skip each hung PASS film)  
   breath FAIL ×2 → **do not** write ffmpeg gel into `films/`. Optional decay jpeg-loop may land in `packs/<id>/.kitchen/` for the keeper. Gel ≠ PASS. **HANG BLOCKED** + stock. Do not hang “so they can see”.  
   walk FAIL → delete that mp4 from `films/`, print `KEEP REFUSED` + the smoke rule, stock. Soft KEEP of a FAIL walk is illegal.
7. encode 720×1280, mute, faststart
8. `validate-pack` then `smoke-pack`
9. PASS → `https://boltverse-odyssey.grok.me/r/<id>`
10. FAIL → stock URL + `rule`

No A↔B. No Enter. No “show me the 3 stills” unless `COOK_DEBUG=1`.

## Wait

**Off.** Stills → smoke → films.  
Wait only if `COOK_DEBUG=1`.

## Output (one line for the player)

```
PASS https://boltverse-odyssey.grok.me/r/dusk
FAIL atA identity.face
HANG BLOCKED
     https://boltverse-odyssey.grok.me/
KEEP REFUSED  films/walk-spawn-a.mp4  FAIL  walk-spawn-a.mp4 graph.last_not_official
```

The rest in `packs/<id>/smoke.log`.

## What this is not

Not the player. Not Smoke (it *calls* smoke). Not Forge UI. Not Chat Imagine UI without Agent. Not live Imagine on tap. Not a biome / Lane kit ([COOKLANE.md](COOKLANE.md)). Sealed still restyle is **Imagine Agent**, not this script inventing a new dog.

## One line

**Hung PASS = reuse (sealed skip stays). First seal = `imagineStill`. Cross-style sealed stills = Imagine Agent. `--force` recooks.**  
Smoke tastes. cookRoom runs the first-seal recipe + films. Grok does not invent the list of pans.

Hooks: [scripts/imagine-hooks.mjs](scripts/imagine-hooks.mjs). `export XAI_API_KEY` then `node scripts/cook-room.mjs moss`. First-seal spawn = `/v1/images/edits` (bolt-back + example-spawn). First-seal atA = **edit the spawn** (bolt-back = coat only, IGNORE ~0.53; side ref = `lock/example-at-a.jpg` — copy PLACE+POSE from example; FORCE taille 0.35–0.40; FORCE STANDING; never shrink to 0.18; hall materials from spawn/catalog only — ignore example décor). atB side ref = hung moss PASS / swapped `lock/example-at-b`. IGNORE a tiny ~0.18 crop the same way. Never send `lock/example-at-*-tiny`. **Sealed** at-A/at-B restyle = **Imagine Agent** (freeze dog + cyan/gold portals; change hall materials only). Walks = video `image` + `last_frame`. Breath = same still twice (`image` + `last_frame` = that pose). Chat Imagine UI without Agent is still **banned for walks**. No key if every plate is hung PASS. `--dry-run` prints skip vs cook + COOK/LOCK.

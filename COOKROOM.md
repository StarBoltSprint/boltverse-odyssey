# COOKROOM — the corridor (floor 1)

```
node scripts/cook-room.mjs <catalog-slot> --dry-run
export XAI_API_KEY=... && node scripts/cook-room.mjs <catalog-slot>
```

`--dry-run` first (no key, prints the queue). Live needs `XAI_API_KEY`.  
`slot` ∈ [CATALOG.md](CATALOG.md). Off-list → stock URL, exit 1.

That script is the **only** hall cook. Stills + films go through [scripts/imagine-hooks.mjs](scripts/imagine-hooks.mjs) (`imagineStill` / `imagineClip`). Never chat Grok Imagine UI.

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
```

`--dry-run` = queue only. Live = key. No throw « until wired ». No chat Imagine stills or films.

## Order (do not skip, do not wait)

1. `packs/<id>/` + skeleton `room.json` (auth off, open breath-spawn, edges spawn A/B, ENTER empty)
2. spawn still = lock + example-spawn + `catalog/<slot>.md`
3. smoke still-spawn — FAIL ×2 → **stop**, print stock
4. atA / atB = `imagineStill` **from that spawn**
5. smoke those stills — FAIL ×2 on one at → stop (no films)
6. 5 films, **one by one**, smoke after each  
   breath FAIL ×2 → ffmpeg **gel** of the still **only if that still already PASS size**, then smoke the loop. Gel ≠ PASS. Loop FAIL / punch-in → **stock**, do not hang “so they can see”.  
   both walks FAIL → stock
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
     https://boltverse-odyssey.grok.me/
```

The rest in `packs/<id>/smoke.log`.

## What this is not

Not the player. Not Smoke (it *calls* smoke). Not Forge UI. Not chat Imagine UI. Not live Imagine on tap. Not a biome / Lane kit ([COOKLANE.md](COOKLANE.md)).

## One line

**dry-run = no key. Live = key. Plus de throw « until wired ».**  
Smoke tastes. cookRoom runs the recipe. Grok does not invent the list of pans.

Hooks: [scripts/imagine-hooks.mjs](scripts/imagine-hooks.mjs). `export XAI_API_KEY` then `node scripts/cook-room.mjs moss`. Stills = `/v1/images/edits` (bolt-back + example). Walks = video `image` + `last_frame`. Breath = same still twice (`image` + `last_frame` = that pose). No key → throw / `--dry-run`.

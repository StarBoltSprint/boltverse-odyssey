# COOKROOM — the corridor (floor 1)

Validate and Smoke judge a **full** folder. This file **fills** it.  
Grok in chat is the runner until Imagine is a script.

Tap never cooks. [DONT.md](DONT.md).

## Command

```
node scripts/cook-room.mjs moss --dry-run
COOK_DEBUG=1 node scripts/cook-room.mjs dusk
node scripts/cook-room.mjs moss          # once Imagine hooks are wired
```

`imagineStill` / `imagineClip` throw until wired. Until then: **--dry-run** only.

`slot` ∈ [CATALOG.md](CATALOG.md). Off-list → print stock URL, exit 1. No Imagine.

## Order (do not skip, do not wait)

1. `packs/<id>/` + skeleton `room.json` (auth off, open breath-spawn, edges spawn A/B, ENTER empty)
2. spawn still = lock + example-spawn + `catalog/<slot>.md`
3. smoke still-spawn — FAIL ×2 → **stop**, print stock
4. atA / atB = image-to-image **from that spawn**
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

Not the player. Not Smoke (it *calls* smoke). Not Forge UI. Not live Imagine on tap.

## One line

Smoke tastes. cookRoom runs the recipe. Grok does not invent the list of pans.

Hooks: [scripts/imagine-hooks.mjs](scripts/imagine-hooks.mjs). `export XAI_API_KEY` then `node scripts/cook-room.mjs moss`. Stills = `/v1/images/edits` (bolt-back + example). Walks = video `image` + `last_frame`. Breath = `image` only. No key → throw / --dry-run.

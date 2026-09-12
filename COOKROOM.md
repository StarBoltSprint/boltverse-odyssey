# COOKROOM — the corridor (floor 1)

**STOP — EVERY cook (new Grok Build conversation, restyle, Walk A, Walk B, breath, any still) MUST go through Imagine Agent. Obligatoire. Systematically. Never Chat Imagine without Agent. Not optional. Not invent outside Agent.**

**Identity base:** Bolt is ALWAYS a full-white German Shepherd (white coat forever). That base never changes to grey / silver / black. **SKINS:** décor-matching skin ON TOP of the white base OK (ember / ice). Not a different dog. **Restyle:** completely new hall décor OK. **Doors may adapt.** Cyan L + gold R energy portals may adapt. Bolt may be selected, repositioned, resized to sill for a nickel plate. Bolt reposition OK.

```
node scripts/cook-room.mjs <catalog-slot> --dry-run
export XAI_API_KEY=... && node scripts/cook-room.mjs <catalog-slot>
node scripts/cook-room.mjs <catalog-slot> --force
```

`--dry-run` first (no key, prints skip vs cook). Live needs `XAI_API_KEY` only for plates it Imagines.  
`slot` ∈ [CATALOG.md](CATALOG.md). Off-list → stock URL, exit 1.

Hung pack with PASS stills/films = **reuse**. Only missing / smoke-FAIL plates go through Imagine. `--force` / `COOK_FORCE=1` recooks. Never wipe a hung `room.json` or a PASS still. **Sealed skip stays.** Imagine Agent produced the ice-hall **KEEP seals** (`lock/SEAL-spawn.jpg` + `lock/SEAL-at-a.jpg` + `lock/SEAL-at-b.jpg`, drop `hall-stills/seal/*-ice.jpg`). Frozen pose+décor until SmiR reseals. Agent remains primary for future styles. `cook-room` **SKIPS** `imagineStill` for spawn / at-A / at-B when those seals exist. **Smoke still gates.** Soft KEEP banned.

**This script is secondary / CLI only — not the human happy path.** [Grok Imagine Agent](https://grok.com/imagine/agent) is the PRIMARY cook path for BOTH stills AND walk/breath films (first+last frames). **HARD:** ALL hall stills + walks + breaths go through Imagine Agent. Walks: user stills as exact first frame AND last frame, then interpolate video. Breaths: same still twice. Director or human drives Agent in the browser until Build has an Agent tool/hook. Default: seal stills, restyle halls, cook walks with start+end stills, breaths same still twice. **Smoke still gates.** Soft KEEP banned. Instruct to open Imagine Agent with the plate refs.

CLI films go through [scripts/imagine-hooks.mjs](scripts/imagine-hooks.mjs) (`imagineClip` + `last_frame`). CLI first-seal stills go through `imagineStill`. No `XAI_API_KEY` when a CLI plate must Imagine → refuse (stock). Chat Imagine UI **without** Agent is **banned**.

**Imagine Agent is MANDATORY for cross-style hall stills (not optional).** Agent is **REQUIRED** for décor variants. Imagine Agent is the **hall-restyle** tool for sealed stills **and** the primary film cook. One **SEALED** sill still (dog already AT the teal or gold threshold) → Agent restyles: completely new hall décor OK; cyan L + gold R energy portals may adapt shape / scale to décor; Bolt may be selected, repositioned, resized to sill for a nickel plate (white coat forever; décor-matching skin ON TOP OK). `cook-room` `imagineStill` = first seal secondary CLI. **BANNED for restyle.** Do **not** invent a new dog.

**Grok Build chat Imagine tools are NOT the same as Imagine Agent.** Cross-style sealed stills = Imagine Agent at `https://grok.com/imagine/agent`. Build must not use chat `imagine_*` without Agent. Instruct to open Imagine Agent with the plate refs. Build must not rely on chat `imagine_*` tools for hall restyle identity lock.

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

`--dry-run` = skip vs cook (smokes existing files, no Imagine). Live = key only if a CLI plate will cook. `--force` recooks PASS plates too. Chat Imagine UI without Agent is banned for walks (no `last_frame`). Décor variants = **Imagine Agent REQUIRED**. `imagineStill` **BANNED for restyle**. This script is secondary CLI.

## Order (do not wait)

0. Each dest still/film: exists + smoke PASS → **skip Imagine** (reuse). `--force` ignores this. **Sealed skip stays.**
1. `packs/<id>/` + skeleton `room.json` **only if missing** (never overwrite a hung graph)
2. spawn still = lock + example-spawn + `catalog/<slot>.md` — skip if hung PASS **or** `lock/SEAL-spawn.jpg` (copy seal, no imagineStill). First seal only when unsealed.
3. smoke still-spawn — FAIL ×2 → **stop**, print stock
4. **First seal** atA / atB = `imagineStill` **edits that spawn** (bolt-back = coat, IGNORE ~0.53; atA side ref = `lock/example-at-a.jpg` SmiR lock teacher; atB side ref = hung moss PASS / swapped `lock/example-at-b`) — skip each if hung PASS. atA: copy PLACE+POSE from example; **FORCE taille 0.35–0.40; FORCE STANDING; never shrink to 0.18**; hall materials from spawn/catalog only — ignore example décor. IGNORE tiny ~0.18 crop like bolt-back 0.53. Never `example-at-*-tiny`. Drop missing? [`hall-stills/README.md`](hall-stills/README.md) + `node scripts/install-lock-ata.mjs`.
4b. **Cross-style** at-A / at-B from a **SEALED** sill (dog already AT the threshold): **Imagine Agent REQUIRED** (`https://grok.com/imagine/agent`) — one sealed sill still → Agent restyles: completely new hall décor OK; cyan L + gold R energy portals may adapt shape / scale to décor; Bolt may be selected, repositioned, resized to sill for a nickel plate; white coat forever; décor-matching skin ON TOP OK. `imagineStill` **BANNED for restyle.** Then smoke the restyle. Sealed skip stays.
5. smoke those stills. FAIL → `FAIL SAVE` into `packs/<id>/.kitchen/fail/<kind>-<n>` and **drop** the hung dest (never leave FAIL in `stills/`). Under-size sill (~0.16–0.21, even if sit): second step is **enlarge-only** (`image` = FAIL jpg, grow to 0.35–0.40, same camera). Cap 1 fresh + 1 enlarge (or 2 enlarge). `gate.place` / mid-hall = fresh. FAIL ×2 on one at → stop (no films). Never Hang FAIL.
6. 5 films, **one by one**, smoke after each (skip each hung PASS film)  
   breath FAIL ×2 → **do not** write ffmpeg gel into `films/`. FAIL mp4 → `.kitchen/fail/`. Optional decay jpeg-loop may land in `packs/<id>/.kitchen/` for the keeper. Gel ≠ PASS. **HANG BLOCKED** + stock. Do not hang “so they can see”.  
   walk FAIL → copy to `.kitchen/fail/`, delete that mp4 from `films/`, print `KEEP REFUSED` + the smoke rule, stock. Soft KEEP of a FAIL walk is illegal.
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

Not the player. Not Smoke (it *calls* smoke). Not Forge UI. Not Chat Imagine UI without Agent. Not live Imagine on tap. Not a biome / Lane kit ([COOKLANE.md](COOKLANE.md)). Not the human happy path — that is **Imagine Agent PRIMARY** for stills AND films. Décor variants = **Imagine Agent REQUIRED**. `imagineStill` **BANNED for restyle**.

## One line

**Imagine Agent is PRIMARY for stills AND films. This script = secondary CLI. Hung PASS = reuse (sealed skip stays). First seal = Imagine Agent (CLI `imagineStill` if Agent down). Décor variants = Imagine Agent REQUIRED. `imagineStill` BANNED for restyle. `--force` recooks.**  
Smoke still gates. cookRoom is batch / Agent-unavailable. Grok does not invent the list of pans.

PRIMARY = Imagine Agent (stills AND films). Secondary hooks: [scripts/imagine-hooks.mjs](scripts/imagine-hooks.mjs). `export XAI_API_KEY` then `node scripts/cook-room.mjs moss` when Agent is unavailable. CLI first-seal spawn = `/v1/images/edits` (bolt-back + example-spawn). CLI first-seal atA = **edit the spawn** (bolt-back = coat only, IGNORE ~0.53; side ref = `lock/example-at-a.jpg` — copy PLACE+POSE from example; FORCE taille 0.35–0.40; FORCE STANDING; never shrink to 0.18; hall materials from spawn/catalog only — ignore example décor). atB side ref = hung moss PASS / swapped `lock/example-at-b`. IGNORE a tiny ~0.18 crop the same way. Never send `lock/example-at-*-tiny`. **Sealed** at-A/at-B restyle = **Imagine Agent REQUIRED** (new décor OK; cyan L + gold R portals may adapt; Bolt may be selected / repositioned / resized to sill; white coat forever; décor-matching skin ON TOP OK). `imagineStill` **BANNED for restyle**. Walks PRIMARY = Agent start+end stills. CLI walks = video `image` + `last_frame`. Breath PRIMARY = same still twice. Chat Imagine UI without Agent is **banned** for walks. No key if every plate is hung PASS. `--dry-run` prints skip vs cook + COOK/LOCK.

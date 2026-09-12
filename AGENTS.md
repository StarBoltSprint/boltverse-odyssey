# AGENTS — cold-start hall cook

This repo is a **recipe**, not an app. Do not scaffold a player. Do not publish a new grok.me.

**Owner:** SmiR / StarBoltSprint  
**Player (already hung):** https://boltverse-odyssey.grok.me  
**Clone:** https://github.com/StarBoltSprint/boltverse-odyssey

Read **[GROK.md](GROK.md)** next (STOP banner). Same law as this file.

## One happy path (brand-new Grok / Grok Build convo)

1. Clone this repo. Read this file + GROK.md. Stop.
2. `node scripts/cook-room.mjs <slot> --dry-run`  
   or `npm run dry-run` (moss).
3. Dry-run prints skip vs cook. Hung PASS stills/films = reuse. `--force` recooks.
4. If any plate will cook: `export XAI_API_KEY=... && node scripts/cook-room.mjs <slot>`  
   (`npm run cook` = moss live). That script is the **only** hall cook.
5. Script prints `PASS https://boltverse-odyssey.grok.me/r/<slot>` or `FAIL <rule>` + `HANG BLOCKED` + stock `/`. That line is the answer.

Catalog slots only: moss · ember · dusk · asteroid · frost · ivy · ash · tide · ember-deep · gold.

Lane / biome is **another job**: `node scripts/cook-biome.mjs <id>`. Not cook-room.

## Hard refuse (no chat fallback)

If you **cannot** run `node` + (when a plate will Imagine) `XAI_API_KEY`:

**REFUSE the cook.** Say you need Node and `XAI_API_KEY`. Do **not** cook in chat.

These Chat Imagine UI tools are **banned** for hall stills, walks, breaths, and enter:

- `imagine_image_to_video`
- `imagine_reference_to_video`
- `imagine_image_to_image`

They have **no `last_frame`**. Chat refs are not frames. Chat stills skip the edits lock. A chat film has no smoke → do not Hang it. Do not attach a Smoke-FAIL walk as a “preview KEEP”.

Official path: `scripts/cook-room.mjs` → `scripts/imagine-hooks.mjs`

- stills → `POST /v1/images/edits`
- walks → video `image` + **`last_frame`** (start still ≠ arrive still)
- breaths → same still twice (`image` + `last_frame`)

## Hang law

- Smoke PASS (A+B script, then layer C on `.smoke/` frames) = Hang.
- `KEEP REFUSED` / `HANG BLOCKED` = stock URL. Not a soft KEEP.
- ffmpeg gel-breath is decay in `packs/<id>/.kitchen/` — **not** Hang-ready. Do not copy it into `films/`.
- FAIL walk is deleted from `films/`. Tap = stay. Do not ship it as a preview.
- Sit / face / 3/4 / RECT→oval / punch-sill (dog climbing the rift) cannot PASS. Recook that plate, cap 2, then stock.

## Do not

- New grok.me / Vite / Connect Wallet / API keys in a client
- Rewrite `packs/moss` media unless smoke on that plate FAILs
- Invent a fourth still or a mid-hall plate (tighten spawn↔sill Δh/H instead)
- Paste Imagine prompts into chat
- Treat Customize-paste as optional after clone — this file + GROK.md are enough

# AGENTS — cold-start hall cook

This repo is a **recipe**, not an app. Do not scaffold a player. Do not publish a new grok.me.

**Owner:** SmiR / StarBoltSprint  
**Player (already hung):** https://boltverse-odyssey.grok.me  
**Clone:** https://github.com/StarBoltSprint/boltverse-odyssey

**sill ≠ spawn.** at-A = already AT the teal LEFT sill (seuil / threshold). at-B = already AT the gold RIGHT sill. Spawn = CENTER only (both doors + fork). Mid-hall at-A/at-B = **FAIL**. Soft KEEP banned.

Read **[GROK.md](GROK.md)** next (STOP banner). Same law as this file.

## One happy path (brand-new Grok / Grok Build convo)

1. Clone this repo. Read this file + GROK.md. Stop.
2. `node scripts/cook-room.mjs <slot> --dry-run`  
   or `npm run dry-run` (moss).
3. Dry-run prints skip vs cook. Hung PASS stills/films = reuse. `--force` recooks.
4. If any plate will cook: `export XAI_API_KEY=... && node scripts/cook-room.mjs <slot>`  
   (`npm run cook` = moss live). That script is the hall cook for **first-seal** stills and **all films**. Cross-style sealed at-A/at-B = **Imagine Agent** (below).
5. Script prints `PASS https://boltverse-odyssey.grok.me/r/<slot>` or `FAIL <rule>` + `HANG BLOCKED` + stock `/`. That line is the answer.

Catalog slots only: moss · ember · dusk · asteroid · frost · ivy · ash · tide · ember-deep · gold.

Lane / biome is **another job**: `node scripts/cook-biome.mjs <id>`. Not cook-room.

## Cross-style sill stills — Imagine Agent (hall-restyle)

Do **not** invent a new dog via `cook-room` `imagineStill` each style.

Preferred path: start from a **SEALED** at-A / at-B (dog already AT the teal or gold sill). Then **[Grok Imagine Agent](https://grok.com/imagine/agent)** — keep the exact same dog pose / size / place and the same cyan/gold portals; change hall materials only (ice / ember / catalog slot).

- Imagine Agent = the **hall-restyle** tool for sealed stills.
- `cook-room` `imagineStill` from scratch = **first seal** only.
- Hung PASS / sealed skip stays. `--force` recooks.
- Films stay on hooks (`imagineClip` + `last_frame`). Chat Imagine UI **without** Agent is still **banned for walks** (no `last_frame`).

## Hard refuse (no chat fallback)

If you **cannot** run `node` + (when a plate will Imagine) `XAI_API_KEY`:

**REFUSE the cook.** Say you need Node and `XAI_API_KEY`. Do **not** cook walks in chat.

These Chat Imagine UI tools (**without** Agent) are **banned** for walks, breaths, and enter:

- `imagine_image_to_video`
- `imagine_reference_to_video`
- `imagine_image_to_image`

They have **no `last_frame`**. Chat refs are not frames. A chat film has no smoke → do not Hang it. Do not attach a Smoke-FAIL walk as a “preview KEEP”.

Official film path: `scripts/cook-room.mjs` → `scripts/imagine-hooks.mjs`

- first-seal stills → `POST /v1/images/edits` (`imagineStill`)
- sealed cross-style stills → **Imagine Agent** (freeze dog + portals; restyle hall only)
- walks → video `image` + **`last_frame`** (start still ≠ arrive still)
- breaths → same still twice (`image` + `last_frame`)

## Hang law

- Smoke PASS (A+B script, then layer C on `.smoke/` frames) = Hang.
- `KEEP REFUSED` / `HANG BLOCKED` = stock URL. Not a soft KEEP.
- ffmpeg gel-breath is decay in `packs/<id>/.kitchen/` — **not** Hang-ready. Do not copy it into `films/`.
- FAIL walk is deleted from `films/`. Tap = stay. Do not ship it as a preview.
- Sit / face / 3/4 / punch-sill (dog climbing the rift) / mid-hall spawn-cx sold as at-A or at-B cannot PASS. Recook that plate, cap 2, then stock.
- Oval|RECT energy portals OK (oval preferred-ok). Do not FAIL oval shape alone. Never wood. Never chrome UI rectangles.

## Do not

- New grok.me / Vite / Connect Wallet / API keys in a client
- Rewrite `packs/moss` media unless smoke on that plate FAILs
- Invent a fourth still or a mid-hall plate (tighten spawn↔sill Δh/H instead)
- Invent a new dog via `cook-room` `imagineStill` when a **SEALED** at-A/at-B exists — restyle with **Imagine Agent**
- Paste walk prompts into Chat Imagine UI without Agent (no `last_frame`)
- Treat Customize-paste as optional after clone — this file + GROK.md are enough

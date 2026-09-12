# AGENTS — cold-start hall cook

**STOP — EVERY cook (new Grok Build conversation, restyle, Walk A, Walk B, breath, any still) MUST go through Imagine Agent. Obligatoire. Systematically. Never Chat Imagine without Agent. Not optional. Not invent outside Agent.**

This repo is a **recipe**, not an app. Do not scaffold a player. Do not publish a new grok.me.

**Owner:** SmiR / StarBoltSprint  
**Player (already hung):** https://boltverse-odyssey.grok.me  
**Clone:** https://github.com/StarBoltSprint/boltverse-odyssey

**sill ≠ spawn.** at-A = already AT the teal LEFT sill (seuil / threshold). at-B = already AT the gold RIGHT sill. Spawn = CENTER only (both doors + fork). Mid-hall at-A/at-B = **FAIL**. Soft KEEP banned.

**Identity base:** Bolt is ALWAYS a full-white German Shepherd (white coat forever). That base never changes to grey / silver / black.

**SKINS:** Imagine Agent MAY apply a décor-matching skin ON TOP of the white base — ember skin (embers / glow / ash accents), ice skin, etc. Stylish adaptation. Not a different dog.

**Restyle:** completely new hall décor OK. Cyan L + gold R energy portals may adapt shape / scale to décor. Bolt may be selected, repositioned, resized to sill for a nickel plate.

Read **[GROK.md](GROK.md)** next (STOP banner). Same law as this file.

## One happy path (brand-new Grok / Grok Build convo)

**[Grok Imagine Agent](https://grok.com/imagine/agent) is the PRIMARY cook path for BOTH stills AND walk/breath films.** Not a stills-only restyle footnote. Not optional.

**HARD:** ALL hall stills + Walk A + Walk B + breaths go through Imagine Agent. Walks: user stills as exact first frame AND last frame, then interpolate video. Breaths: same still twice. Director or human drives Agent in the browser until Build has an Agent tool/hook. Grok Build must not use chat `imagine_*` without Agent — instruct to open Imagine Agent with the plate refs. `cook-room` / hooks = **secondary CLI only**.

1. Clone this repo. Read this file + GROK.md. Stop.
2. Default cook = Imagine Agent at `https://grok.com/imagine/agent`:
   - **seal stills** (spawn / at-A / at-B)
   - **restyle halls** from a SEALED sill (completely new hall décor OK; cyan L + gold R energy portals may adapt shape / scale to décor; Bolt may be selected, repositioned, resized to sill for a nickel plate; white coat forever; décor-matching skin ON TOP OK)
   - **walks** = start still + end still (user stills as exact first frame AND last frame, then interpolate)
   - **breaths** = same still twice
3. Drop plates into `packs/<slot>/`. **Smoke still gates.** Soft KEEP banned.
4. Script prints `PASS https://boltverse-odyssey.grok.me/r/<slot>` or `FAIL <rule>` + `HANG BLOCKED` + stock `/`. That line is the answer.

Catalog slots only: moss · ember · dusk · asteroid · frost · ivy · ash · tide · ember-deep · gold.

Lane / biome is **another job**: `node scripts/cook-biome.mjs <id>`. Not cook-room.

`scripts/cook-room.mjs` + `scripts/imagine-hooks.mjs` = **secondary / CLI only** (Agent unavailable / automated batch) — **not** the human happy path.

## Imagine Agent — PRIMARY (stills AND films)

**Imagine Agent is the PRIMARY cook path for BOTH stills AND walk/breath films (first+last frames).**

- ALL hall stills + walks + breaths go through Imagine Agent. Director or human drives Agent in the browser until Build has an Agent tool/hook.
- Walks: user stills as exact first frame AND last frame, then interpolate video. Breaths: same still twice.
- Imagine Agent is the **hall-restyle** tool for sealed stills **and** the primary film cook.
- **Imagine Agent is MANDATORY for cross-style hall stills (not optional).** Agent is **REQUIRED** for décor variants. One **SEALED** sill still → Agent restyles: completely new hall décor OK. Cyan L + gold R energy portals may adapt. Bolt may be selected, repositioned, resized to sill. White coat forever. Décor-matching skin ON TOP of the white base OK (ember / ice). Not a different dog.
- `cook-room` `imagineStill` is **BANNED for restyle** (invents a new dog). CLI first-seal / batch only.
- Hung PASS / sealed skip stays. `--force` recooks.
- **Grok Build chat Imagine tools are NOT the same as Imagine Agent.** Chat Imagine UI without Agent is banned for walks, breaths, stills, enter (no `last_frame`). Build must not use chat `imagine_*` without Agent. Instruct to open Imagine Agent with the plate refs. Build must not rely on chat `imagine_*` tools for hall restyle identity lock.

## Hard refuse (no chat fallback)

Chat Imagine UI **without** Agent is **banned** — stills, walks, breaths, enter:

- `imagine_image_to_video`
- `imagine_reference_to_video`
- `imagine_image_to_image`

They have **no `last_frame`**. Chat refs are not frames. A chat film has no smoke → do not Hang it. Do not attach a Smoke-FAIL walk as a “preview KEEP”. Soft KEEP banned.

If Agent is unavailable: secondary CLI `node scripts/cook-room.mjs <slot> --dry-run` then `export XAI_API_KEY=... && node scripts/cook-room.mjs <slot>`. If you cannot run `node` + `XAI_API_KEY` either: **REFUSE**. Stock URL. Do **not** fall back to chat `imagine_*`.

Secondary CLI (not the human happy path): `scripts/cook-room.mjs` → `scripts/imagine-hooks.mjs`

- stills → `POST /v1/images/edits` (`imagineStill`) — first seal / batch only. **BANNED for restyle.**
- walks → video `image` + **`last_frame`** (start still ≠ arrive still)
- breaths → same still twice (`image` + `last_frame`)

## Hang law

- Smoke PASS (A+B script, then layer C on `.smoke/` frames) = Hang. **Smoke still gates.**
- `KEEP REFUSED` / `HANG BLOCKED` = stock URL. Not a soft KEEP.
- Smoke FAIL still/film → copy to `packs/<id>/.kitchen/fail/<kind>-<n>` then delete from `stills/`/`films/`. Never Hang FAIL.
- at-A/at-B under-size (~0.16–0.21): second cook is **enlarge-only** (FAIL jpg as `image`, grow to 0.35–0.40 standing at sill). Sit does not block enlarge. Mid-hall / `gate.place` = fresh. Cap 1 fresh + 1 enlarge (or 2 enlarge).
- ffmpeg gel-breath is decay in `packs/<id>/.kitchen/` — **not** Hang-ready. Do not copy it into `films/`.
- FAIL walk is deleted from `films/`. Tap = stay. Do not ship it as a preview.
- Sit / face / 3/4 / punch-sill (dog climbing the rift) / mid-hall spawn-cx sold as at-A or at-B cannot PASS. Recook that plate, cap 2, then stock.
- Oval|RECT energy portals OK (oval preferred-ok). Do not FAIL oval shape alone. Never wood. Never chrome UI rectangles. Portals may adapt shape / scale to décor.

## Do not

- New grok.me / Vite / Connect Wallet / API keys in a client
- Rewrite `packs/moss` media unless smoke on that plate FAILs
- Invent a fourth still or a mid-hall plate (tighten spawn↔sill Δh/H instead)
- Treat Imagine Agent as stills-only restyle. Agent is PRIMARY for stills AND films.
- Invent a new dog via `cook-room` `imagineStill` when a **SEALED** at-A/at-B exists — `imagineStill` is **BANNED for restyle**; Agent is **REQUIRED** for décor variants
- Change Bolt’s white-coat base to grey / silver / black (décor-matching skin ON TOP is OK)
- Treat Grok Build chat `imagine_*` tools as Imagine Agent (they are **not**; no identity lock)
- Treat `cook-room` / hooks as the human happy path (`cook-room` / hooks = secondary / CLI only)
- Use chat `imagine_*` in Build — instruct to open Imagine Agent with the plate refs instead
- Treat Customize-paste as optional after clone — this file + GROK.md are enough

# AGENTS — cold-start hall cook

**STOP — HARD SPLIT (SmiR 2026-09-12, supersedes PR #11).** Imagine Agent is obligatoire / MUST / systematically for STYLE stills when restyling. NEVER for Walk A, Walk B, breath, or any video. Walks / breaths / films = imagine-hooks / cook-room first-frame + last-frame. Chat Imagine UI without real first+last is banned. Soft KEEP banned. Smoke still gates.

This repo is a **recipe**, not an app. Do not scaffold a player. Do not publish a new grok.me.

**Owner:** SmiR / StarBoltSprint  
**Player (already hung):** https://boltverse-odyssey.grok.me  
**Clone:** https://github.com/StarBoltSprint/boltverse-odyssey

**sill ≠ spawn.** at-A = already AT the teal LEFT sill (seuil / threshold). at-B = already AT the gold RIGHT sill. Spawn = CENTER only (both doors + fork). Mid-hall at-A/at-B = **FAIL**. Soft KEEP banned.

**Identity base:** Bolt is ALWAYS a full-white German Shepherd (white coat forever). That base never changes to grey / silver / black.

**SKINS:** Imagine Agent MAY apply a décor-matching skin ON TOP of the white base — ember skin (embers / glow / ash accents), ice skin, etc. Stylish adaptation. Not a different dog.

**Restyle:** completely new hall décor OK. **Doors may adapt** (shape / scale to décor). Cyan L + gold R energy portals may adapt shape / scale to décor (oval|RECT energy; never wood; never chrome UI). Bolt may be selected, repositioned, resized to sill for a nickel plate. Bolt reposition OK.

Read **[GROK.md](GROK.md)** next (STOP banner). Same law as this file.

## One happy path (brand-new Grok / Grok Build convo)

**HARD SPLIT.** [Grok Imagine Agent](https://grok.com/imagine/agent) = ONLY hall STYLES / stills / décor restyles (freeze dog+portals, swap décor, skins on white coat). **NEVER** walks, breaths, or any video.

Walks / breaths / films = Imagine first-frame + last-frame via `scripts/imagine-hooks.mjs` / `scripts/cook-room.mjs` (the API path Grok Build already uses). Chat Imagine UI without real first+last remains **banned** for videos. Agent is **not** required or recommended for video cook. Do **not** instruct Build to open Imagine Agent for Walk A, Walk B, or breath.

1. Clone this repo. Read this file + GROK.md. Stop.
2. STYLE stills = Imagine Agent at `https://grok.com/imagine/agent` when restyling:
   - **seal stills** (spawn / at-A / at-B)
   - **restyle halls** from a SEALED sill (completely new hall décor OK; cyan L + gold R energy portals may adapt shape / scale to décor; Bolt may be selected, repositioned, resized to sill for a nickel plate; white coat forever; décor-matching skin ON TOP OK)
3. Walks / breaths = `cook-room` → `imagineClip` (`image` + `last_frame`). **walks** = start still + end still. **breaths** = same still twice. Never Agent video.
4. Drop plates into `packs/<slot>/`. **Smoke still gates.** Soft KEEP banned.
5. Script prints `PASS https://boltverse-odyssey.grok.me/r/<slot>` or `FAIL <rule>` + `HANG BLOCKED` + stock `/`. That line is the answer.

Catalog slots only: moss · ember · dusk · asteroid · frost · ivy · ash · tide · ember-deep · gold.

Lane / biome is **another job**: `node scripts/cook-biome.mjs <id>`. Not cook-room.

`scripts/cook-room.mjs` + `scripts/imagine-hooks.mjs` = **video cook** (walks / breaths / films) and CLI first-seal / batch stills. Agent is **not** the film path.

## Imagine Agent — STYLE stills ONLY (never video)

**Imagine Agent is obligatoire for STYLE stills when restyling.** Never for films.

- Imagine Agent is the **hall-restyle** tool for sealed stills. Freeze dog+portals, swap décor, skins on white coat.
- **Imagine Agent is MANDATORY for cross-style hall stills (not optional).** Agent is **REQUIRED** for décor variants. One **SEALED** sill still → Agent restyles: completely new hall décor OK. Cyan L + gold R energy portals may adapt. Bolt may be selected, repositioned, resized to sill. White coat forever. Décor-matching skin ON TOP of the white base OK (ember / ice). Not a different dog.
- First seal stills = Imagine Agent. `cook-room` `imagineStill` is **BANNED for restyle** (invents a new dog). CLI first-seal / batch only.
- Hung PASS / sealed skip stays. `--force` recooks. Imagine Agent produced the ice-hall **KEEP seals** (`lock/SEAL-spawn.jpg` + `lock/SEAL-at-a.jpg` + `lock/SEAL-at-b.jpg`, drop `hall-stills/seal/spawn-ice.jpg` + `at-a-ice.jpg` + `at-b-ice.jpg`). Frozen pose+décor for this ice hall until SmiR reseals. Agent remains the STYLE stills path for future styles (never video). `cook-room` **SKIPS** `imagineStill` for spawn / at-A / at-B when those seals exist. **Smoke still gates.** Soft KEEP banned.
- **Grok Build chat Imagine tools are NOT the same as Imagine Agent.** Chat Imagine UI without real first+last is banned for walks, breaths, enter (no `last_frame`). For STYLE restyle: instruct to open Imagine Agent with the plate refs. Do **not** instruct Agent for walks/breaths. Build must not rely on chat `imagine_*` tools for hall restyle identity lock.

## Films — hooks first+last (never Agent)

Walks / breaths / films = `imagineClip` via `scripts/imagine-hooks.mjs` / `scripts/cook-room.mjs`:

- walks → video `image` + **`last_frame`** (start still ≠ arrive still)
- breaths → same still twice (`image` + `last_frame`)

Chat Imagine UI without real first+last is **banned**. Agent must **not** cook video. If you cannot run `node` + `XAI_API_KEY`: **REFUSE**. Stock URL. Do **not** fall back to chat `imagine_*` or Imagine Agent video.

## Hard refuse (no chat fallback)

Chat Imagine UI **without real first+last** is **banned** — walks, breaths, enter (and chat stills for restyle):

- `imagine_image_to_video`
- `imagine_reference_to_video`
- `imagine_image_to_image`

They have **no `last_frame`**. Chat refs are not frames. A chat film has no smoke → do not Hang it. Do not attach a Smoke-FAIL walk as a “preview KEEP”. Soft KEEP banned.

Video cook: `node scripts/cook-room.mjs <slot> --dry-run` then `export XAI_API_KEY=... && node scripts/cook-room.mjs <slot>`. If you cannot run `node` + `XAI_API_KEY`: **REFUSE**. Stock URL. Do **not** fall back to chat `imagine_*` or Agent video.

FAIL stills/films → `packs/<slot>/.kitchen/fail/` (debug). Never Hang FAIL. at-A/at-B under-size (~0.16–0.21): **enlarge**-only second step (FAIL jpg = image). Cap 1 fresh + 1 enlarge.

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
- Treat Imagine Agent as a film cook. Agent = STYLE stills only. Video = hooks first+last.
- Instruct Build to use Imagine Agent for Walk A, Walk B, breath, or any video
- Invent a new dog via `cook-room` `imagineStill` when a **SEALED** at-A/at-B exists — `imagineStill` is **BANNED for restyle**; Agent is **REQUIRED** for décor variants
- Change Bolt’s white-coat base to grey / silver / black (décor-matching skin ON TOP is OK)
- Treat Grok Build chat `imagine_*` tools as Imagine Agent (they are **not**; no identity lock)
- Use chat `imagine_*` without real first+last for videos
- Treat Customize-paste as optional after clone — this file + GROK.md are enough

# GROK — two default jobs (hall vs Lane)

Repo: `https://github.com/StarBoltSprint/boltverse-odyssey`  
Player: https://boltverse-odyssey.grok.me

## STOP — Imagine Agent is obligatoire / MUST / systematically

**EVERY cook (new Grok Build conversation, restyle, Walk A, Walk B, breath, any still) MUST go through Imagine Agent. Obligatoire. Systematically. Never Chat Imagine without Agent. Not optional. Not invent outside Agent.**

**sill ≠ spawn.** at-A = already AT the teal LEFT sill (seuil / threshold). at-B = already AT the gold RIGHT sill. Spawn = CENTER only (both doors + fork). Mid-hall at-A/at-B = **FAIL**. Soft KEEP banned.

**Identity base:** Bolt is ALWAYS a full-white German Shepherd (white coat forever). That base never changes to grey / silver / black.

**SKINS:** Imagine Agent MAY apply a décor-matching skin ON TOP of the white base — ember skin (embers / glow / ash accents), ice skin, etc. Stylish adaptation. Not a different dog.

**Restyle:** completely new hall décor OK. Cyan L + gold R energy portals may adapt shape / scale to décor. Bolt may be selected, repositioned, resized to sill for a nickel plate. Still AT the teal / gold threshold — mid-hall = FAIL.

**[Grok Imagine Agent](https://grok.com/imagine/agent) is the PRIMARY cook path for BOTH stills AND walk/breath films (first+last frames).** Not a stills-only restyle footnote. **HARD:** ALL hall stills + Walk A + Walk B + breaths go through Imagine Agent. Walks: user stills as exact first frame AND last frame, then interpolate video. Breaths: same still twice. Director or human drives Agent in the browser until Build has an Agent tool/hook. Default: seal stills, restyle halls, cook walks with start+end stills, breaths same still twice. **Smoke still gates.** Soft KEEP banned.

Chat Imagine UI **without Agent** is **banned** — stills, walks, breaths, enter. If `imagine_image_to_video` / `imagine_reference_to_video` / `imagine_image_to_image` are in your tool list: **do not call them**. Chat Imagine UI without Agent has **no `last_frame`**. Chat refs are not frames. A film cooked in chat has no smoke → do not Hang it. A Smoke-FAIL walk attached as KEEP is **illegal**.

**Imagine Agent is MANDATORY for cross-style hall stills (not optional).** Agent is **REQUIRED** for décor variants. Imagine Agent is the **hall-restyle** tool for sealed stills **and** the primary film cook. One **SEALED** sill still (dog already AT the teal or gold threshold) → Agent restyles: completely new hall décor OK; cyan L + gold R energy portals may adapt; Bolt may be selected / repositioned / resized to sill (white coat forever; décor-matching skin ON TOP OK). `cook-room` `imagineStill` = secondary CLI. **BANNED for restyle.** First seal stills = Imagine Agent (CLI `imagineStill` only if Agent unavailable). Do **not** invent a new dog. Sealed skip stays.

**Grok Build chat Imagine tools are NOT the same as Imagine Agent.** Cross-style sealed stills = Imagine Agent at `https://grok.com/imagine/agent`. Build must not use chat `imagine_*` without Agent. Instruct to open Imagine Agent with the plate refs. Build must not rely on chat `imagine_*` tools for hall restyle identity lock.

`scripts/cook-room.mjs` + `scripts/imagine-hooks.mjs` = **secondary / CLI only** — **not** the human happy path. If Agent is down and you cannot run Node + `XAI_API_KEY`: **REFUSE**. Stock URL. Do **not** fall back to chat `imagine_*`.

Also read [AGENTS.md](AGENTS.md) (same refuse). Customize below is paste-once for *before* clone. After clone, this file + AGENTS.md are enough — a new convo that “ignores Customize” still follows this STOP.

**Legal cook, every new conversation, automatic:**

```
https://grok.com/imagine/agent
  stills: seal / restyle
  walks: start still + end still
  breaths: same still twice
then node scripts/smoke-pack.mjs packs/<slot>
```

Secondary CLI (not the human happy path): `node scripts/cook-room.mjs <slot> --dry-run` then `export XAI_API_KEY=... && node scripts/cook-room.mjs <slot>`. `npm run dry-run` / `npm run cook` = moss batch. Hung PASS stills/films = reuse. `--force` / `COOK_FORCE=1` recooks.

Gel-breath (ffmpeg still-loop) and FAIL walks are **HANG BLOCKED** — decay in `.kitchen/` or deleted, never a preview KEEP.

Smoke FAIL stills/films → `packs/<id>/.kitchen/fail/<kind>-<n>.jpg|mp4` (debug). **Never** copy FAIL into `stills/` or `films/`. **Never Hang FAIL.** Soft KEEP banned.

at-A/at-B under-size (sill-band ~0.16–0.21): **1 fresh + 1 enlarge-only** (or **2 enlarge** if the disk plate is already that FAIL). Second `imagineStill` takes the FAIL jpg as `image` and ONLY grows the dog to 0.35–0.40 standing at the sill (same camera/hall). Sit does not block enlarge. Mid-hall / `gate.place` = fresh, not enlarge. Ember FAIL×2 after the PR #7 teacher was 0.19+sit+face / 0.16+sit — teacher alone still shrinks.

Primary = Imagine Agent. Secondary CLI calls `scripts/imagine-hooks.mjs`:

- stills → `imagineStill()` → `POST /v1/images/edits` (batch / Agent unavailable). **BANNED for restyle.**
- walks → `imagineClip()` → `image` + **`last_frame`** (start still ≠ arrive still)
- breaths → `imagineClip()` → same still twice (`image` + `last_frame`)

Then `smoke-pack.mjs`. PASS → `packs/<id>/`. FAIL ×2 → stock. Never a chat mp4 in `films/`. **Smoke still gates.**

Lane: `node scripts/cook-biome.mjs <id>` (same hooks, other job). Not `cook-room`.

One-shot walk if the room already exists and Agent is unavailable (secondary CLI):

```
node --input-type=module -e 'import { imagineClip } from "./scripts/imagine-hooks.mjs"; await imagineClip({ root: process.cwd(), slot: "moss", kind: "walk", first: "packs/moss/stills/spawn.jpg", last: "packs/moss/stills/at-a.jpg", dest: "packs/moss/.kitchen/walk.mp4", seconds: 10 })'
```

Then `node scripts/smoke-pack.mjs <file> --kind walk`. FAIL = do not Hang.

### Custom instructions (paste once in Grok → Customize)

This is the only text that loads in a **brand-new** convo **before** the repo is cloned. Paste it. A convo that never got this paste must still **clone then read GROK.md + AGENTS.md** — same refuse. Without clone, Chat Imagine UI without Agent is **banned** (no `last_frame`). Human happy path = Imagine Agent. cook-room / hooks = secondary CLI.

```
Boltverse / StarBoltSprint / citadel / salle mousse:
STOP: EVERY cook (new Grok Build conversation, restyle, Walk A, Walk B, breath, any still) MUST go through Imagine Agent. Obligatoire. Systematically. Never Chat Imagine without Agent. Not optional. Not invent outside Agent.
1. Clone https://github.com/StarBoltSprint/boltverse-odyssey
2. Read AGENTS.md then GROK.md (STOP). Do not cook before that.
3. NEVER call imagine_image_to_video, imagine_reference_to_video, or imagine_image_to_image. Chat Imagine UI without Agent has no last_frame. Chat Imagine UI without Agent is banned.
4. Happy path = Imagine Agent (grok.com/imagine/agent) PRIMARY for BOTH stills AND walk/breath films.
   Seal stills. Restyle halls. ALL hall stills + Walk A + Walk B + breaths go through Imagine Agent. Walks: user stills as exact first frame AND last frame, then interpolate video. Breaths: same still twice.
   Walks = start still + end still. Breaths = same still twice. Smoke still gates. Soft KEEP banned.
   Director or human drives Agent in the browser until Build has an Agent tool/hook.
   Identity base: Bolt is ALWAYS a full-white German Shepherd (white coat forever). That base never changes to grey/silver/black.
   SKINS: Imagine Agent MAY apply a décor-matching skin ON TOP of the white base — ember skin (embers/glow/ash accents), ice skin, etc. Stylish adaptation. Not a different dog.
   Restyle: completely new hall décor OK. Cyan L + gold R energy portals may adapt shape/scale to décor. Bolt may be selected, repositioned, resized to sill for a nickel plate.
   Imagine Agent is MANDATORY for cross-style hall stills (not optional). Agent REQUIRED for décor variants. One sealed sill still → Agent restyles (new décor OK; portals may adapt; Bolt may move/resize at sill).
   First seal stills = Imagine Agent. cook-room imagineStill = secondary CLI only / BANNED for restyle.
   Grok Build chat Imagine tools are NOT the same as Imagine Agent. Build must not use chat imagine_* without Agent. Instruct to open Imagine Agent with the plate refs. Build must not rely on chat imagine_* tools for hall restyle identity lock.
   cook-room + imagine-hooks = secondary / CLI only — not the human happy path.
5. If Agent is down and you cannot run node + XAI_API_KEY: REFUSE. Give stock https://boltverse-odyssey.grok.me/
6. Gel-breath / FAIL walk = HANG BLOCKED, not a preview KEEP. Soft KEEP banned. Sit / face / 3/4 cannot PASS. Oval|RECT energy portals OK (never wood, never chrome UI).
7. sill ≠ spawn. at-A = already AT the teal LEFT sill (seuil). at-B = already AT the gold RIGHT sill. Spawn = CENTER only. Mid-hall at-A/at-B = FAIL.
8. FAIL plate → packs/<slot>/.kitchen/fail/ (debug). Never stills/films/Hang. at-A/at-B under-size (~0.16–0.21): enlarge-only second step (FAIL jpg = image, grow to 0.35–0.40). Cap 1 fresh + 1 enlarge (or 2 enlarge).
9. Lane = node scripts/cook-biome.mjs <id>. No new grok.me.
```

---

**First word picks the disc.** Same player. Not the same recipe.  
The **verb** chooses (`salle` vs `sprint`). The noun `moss` does not.

```
HALL JOB =
  STOP: EVERY cook MUST go through Imagine Agent. Obligatoire. Systematically.
  PRIMARY = Imagine Agent (grok.com/imagine/agent)
    stills AND walk/breath films (first+last frames)
    seal stills · restyle halls · walks start+end · breaths same still twice
  Identity base: full-white German Shepherd (white coat forever)
  SKINS: décor-matching skin ON TOP of the white base OK (ember/ice). Not a different dog.
  Restyle: completely new hall décor OK
  Cyan L + gold R energy portals may adapt shape/scale to décor
  Bolt may be selected, repositioned, resized to sill for a nickel plate
  Smoke still gates. Soft KEEP banned.
  hung PASS stills/films = reuse
  3 stills + 5 films + smoke-pack
  URL /r/<slot>  or stock on FAIL×2
  Imagine Agent is MANDATORY for cross-style hall stills (not optional)
  Agent REQUIRED for décor variants. imagineStill BANNED for restyle
  one sealed sill still → Agent restyles (new décor OK; portals may adapt)
  Grok Build chat Imagine tools are NOT the same as Imagine Agent
  Chat Imagine UI without Agent is banned
  Build must not rely on chat imagine_* tools for hall restyle identity lock
  ALL hall stills + walks + breaths go through Imagine Agent
  Walks: user stills as exact first frame AND last frame, then interpolate
  Breaths: same still twice
  Director or human drives Agent in the browser until Build has an Agent tool/hook
  Instruct to open Imagine Agent with the plate refs
  cook-room + imagine-hooks = secondary / CLI only
    not the human happy path
  NO walk-A-B · NO ENTER unless they asked
  NO new grok.me

LANE JOB =
  first word biome | sprint | lane | course | colle <id> sur la porte
  → [BIOMES.md] → palettes/<id>-palette.json
  → node scripts/cook-biome.mjs <id>
  10 plates, cues [] until scrub
  m + t_run · pose / L / R / fork only
  coming until L + [PLAYTEST.md](PLAYTEST.md) 5 taps PASS
  smoke = smoke-biome.mjs   NOT smoke-pack
  NOT cook-room
  NOT spawn / atA / walk-spawn-A
  NOT peak-as-door
  handoff = ENTER.kind sprint  ([HANDOFF.md](HANDOFF.md))
```

If `cook-biome.mjs` cannot run: `--dry-run` + palette. Do **not** invent walk-A.

**“citadel moss” ≠ “biome moss”.** They share a word, not a recipe.

## Cold conv (if the first answer lists `walk-spawn-A` after « biome forest », the fork lost)

| Phrase | Job |
|---|---|
| `citadel moss` | `cook-room moss` |
| `biome forest` / `sprint forest` | `cook-biome forest` |
| `colle forest sur la porte A` | hall already there + [LINKS.md](LINKS.md) `kind: sprint` — **do not** recook moss |
| `moss` alone | **one question**: paint or Lane? Verb run/sprint/1 min → Lane |
| `starboltsprint` alone | [START.md](START.md) / player URL — **no** cook |

Sprint law: `m` = follow the dog. `t_run` = age of the storm. Peak = both. Quiet [0, 8s] = calm even if `m` is high. Year-0 verbs: **pose, left, right, fork**. The tap exists only if that gesture is **already in the shot**. [COOKLANE.md](COOKLANE.md) [PLAY.md](PLAY.md).

Chat Imagine UI without Agent cannot send `last_frame` — **banned**. Hall films PRIMARY = Imagine Agent (start+end stills / same still twice). `imagine-hooks` = secondary CLI. Décor variants: **Imagine Agent REQUIRED**. `imagineStill` **BANNED for restyle**. First seal stills = Imagine Agent. Lane plates: same hooks, **other** job (`cook-biome`). Films cooked in chat have no smoke → player loads **stock**. **Smoke still gates.**

---

Trigger hall (any language): *citadel*, *citadelle*, *salle mousse*, *fais-moi une citadelle* — **and not** biome/sprint/lane. Then HALL JOB.

Trigger Lane: *biome*, *sprint*, *lane*, *course*, *colle forest*. Then **stop.** LANE JOB. Do not run cook-room.

*`starboltsprint` / `boltverse` alone* → player URL, not a cook. Both words in one sentence (`starboltsprint forest sprint`) → **Lane wins** (the verb `sprint` / `forest` as biome). Do not take the first hall trigger on the page.

You are wiring a **living-film**. Auth OFF. Database OFF. No 3D, no canvas, no WebGL. **Do not scaffold a new app. Do not publish a new grok.me.**

## Law 0 — Imagine first + last (automatic)

The stills **are** the frames. [COOK.md](COOK.md).

| kind | Imagine call | first | last |
|---|---|---|---|
| **hall walk** | Imagine Agent PRIMARY: start+end stills. Secondary CLI: API `image` + `last_frame` | start still | arrive still — **distinct** |
| **hall breath** | Imagine Agent PRIMARY: same still twice. Secondary CLI: one still twice | pose | **same** |
| **Lane calm** | one still twice | plate still | **same** |
| **Lane lean/peak** | I2V from a **running** first. **NO standing last_frame** | gallop still | extracted last **gallop** frame |
| **Lane decay** | I2V slower walk, 4 paws | running or walk | walk — never sit |
| **enter / return** | first AND last | at-sill / Lane last | fill veil — **never** dest spawn |

Never `image_to_video` a **hall walk or enter** on a single still. Breath / calm = the only legal `first = last`.

A standing `last_frame` on a lean **brakes** him. Sit / poop. Cap 2 recooks. QC every 0.5 s with `ffmpeg -i` THEN `-ss`. Sit anywhere = do not Hang. Year-0 hung = one gallop file (`forest-run`). Tap counts. [COOKLANE.md](COOKLANE.md) [CUES.md](CUES.md)

Lane lean/peak is a **chain**, not 4 photos from `lock/bolt-back`. `last(n)` file **is** `first(n+1)` and that file is still running. Never 4 independent leans. Wobble (center → side → center) = FAIL. Hung path: next `from` = current `to`. Opening calms = fridge.

## Law 1 — floors

Hall default = floor 1: 3 stills + 5 films, no Enter. Lane default = hung gallop until L2 QC-passes, cues after scrub. Visitor = stock `/`.

## Fridge

Cook **one plate**, smoke **that plate**, then write.  
Hall: `node scripts/smoke-pack.mjs packs/<id>`  
Lane: `node scripts/smoke-biome.mjs <id>`  
**Never write `PASS` yourself.** Identity C: [scripts/smoke-identity.md](scripts/smoke-identity.md) (gait gray on Lane mid).

## If they ask for stills / a citadel style

Only if the first word was **not** biome/sprint/lane. Else LANE JOB.

1. Paint from [CATALOG.md](CATALOG.md). Off-list → nearest or one question.
2. Pack exists → URL `/r/<id>`. Stop.
3. Else HALL JOB. PRIMARY = **Imagine Agent** — seal stills, restyle halls, cook walks with start+end stills, breaths same still twice. Then smoke. **Cross-style / décor variants** from a SEALED sill → **Imagine Agent REQUIRED** (new décor OK; cyan L + gold R portals may adapt; Bolt may be selected / repositioned / resized to sill; white coat forever; décor-matching skin ON TOP OK). `imagineStill` **BANNED for restyle.** Secondary CLI = `cook-room` when Agent unavailable. Wait only if `COOK_DEBUG=1`. Law 0. smoke-pack. URL.

Never `text_to_image` a new dog. Never invent a new dog via `imagineStill` when a sealed sill exists. Agent is MANDATORY for décor variants. Agent is PRIMARY for films too.

## If they ask for a biome / sprint / « colle forest »

LANE JOB. [BIOMES.md](BIOMES.md) [COOKLANE.md](COOKLANE.md) [CUES.md](CUES.md) [HANDOFF.md](HANDOFF.md).  
Do not list `walk-spawn-A`. Do not recook the hall because they named `moss`.

## If they ask to branch a door

[ENTER.md](ENTER.md) [LINKS.md](LINKS.md). Hall `to` = paint. Sprint `to` = biome. Same player. Never auto-enter. Return = 2nd tap + hung clip, or stay in the forest.

## Product

The player URL IS the hall. Opening it plays **breath-spawn**. No Play / Forge / Hang chrome. Lane after `kind: sprint` + hid playing ([HANDOFF.md](HANDOFF.md)).

Humans see [START.md](START.md) only. Recook or stock. Give a URL.

Gift: [TICKET.md](TICKET.md). False help: [DONT.md](DONT.md). Corridor hall: [COOKROOM.md](COOKROOM.md). Lane: [COOKLANE.md](COOKLANE.md).

## One line

**GROK.md Lane = a twin DEFAULT JOB, not a footnote.** `moss` does not pick the disc. `salle` vs `sprint` does.

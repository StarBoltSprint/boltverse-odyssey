# GROK — two default jobs (hall vs Lane)

Repo: `https://github.com/StarBoltSprint/boltverse-odyssey`  
Player: https://boltverse-odyssey.grok.me

## STOP 0 — STYLES FIRST (SmiR 2026-09-12). Miss this = the room is dead.

**Black RIG plates + [`lock/RIG-PROMPT.txt`](lock/RIG-PROMPT.txt) before anything else.**

`imagine_image_to_image` on `lock/RIG-spawn.jpg` FIRST. Then at-A/at-B = `imagine_reference_to_image` IMAGE_0 = RIG pose, IMAGE_1 = **that spawn** (ignore its dog). Same hall, millimeter. Never three separate i2i. Paste RIG-PROMPT. `{PAINT}` on spawn only. Never move Bolt / doors / paths / depth. Bad stills → STOP. Do not cook films. Ice stills stay as frost play. Law: [`LAYOUT.md`](LAYOUT.md).

## STOP 1 — HARD SPLIT

**NEVER Agent / chat Imagine for Walk A, Walk B, breath, or any video.** Walks / breaths / films = imagine-hooks / cook-room first-frame + last-frame. Chat Imagine UI without real first+last is banned for **video**. Soft KEEP banned. Smoke still gates.

**sill ≠ spawn.** at-A = already AT the teal LEFT sill (seuil / threshold). at-B = already AT the gold RIGHT sill. Spawn = CENTER only (both doors + fork). Mid-hall at-A/at-B = **FAIL**. Soft KEEP banned.

**Identity base:** Bolt is ALWAYS a full-white German Shepherd (white coat forever). That base never changes to grey / silver / black.

**SKINS:** Imagine Agent MAY apply a décor-matching skin ON TOP of the white base — ember skin (embers / glow / ash accents), ice skin, etc. Stylish adaptation. Not a different dog.

**Restyle:** paint into the black RIG void. Door **shape** may adapt (oval|RECT). Never spacing. Never depth. **Never move Bolt.**

Walks / breaths / films = Imagine first-frame + last-frame via `scripts/imagine-hooks.mjs` / `scripts/cook-room.mjs`. **Prompts = [FILMS.md](FILMS.md)** — every Grok, every player, every décor. Adapt hall paint only. Walks: start still ≠ arrive still. Breaths: same still twice. Agent is **not** required or recommended for video cook. Do **not** instruct Build to open Imagine Agent for Walk A, Walk B, or breath.

Chat Imagine UI **without real first+last** is **banned for walks**, breaths, enter. If `imagine_image_to_video` / `imagine_reference_to_video` are in your tool list: **do not call them** for films. `imagine_image_to_image` is **ALLOWED only on `lock/RIG-*.jpg`** (styles). A film cooked in chat has no smoke → do not Hang it.

**KEEP seals (this ice hall):** Imagine Agent produced `lock/SEAL-spawn.jpg` + `lock/SEAL-at-a.jpg` + `lock/SEAL-at-b.jpg` (drops `hall-stills/seal/spawn-ice.jpg` + `at-a-ice.jpg` + `at-b-ice.jpg`). Frozen pose+décor until SmiR reseals. Agent remains the STYLE stills path for future styles (never video). `cook-room` **SKIPS** `imagineStill` for spawn / at-A / at-B when those seals exist. Smoke still gates. Soft KEEP banned.

**Grok Build styles = RIG plates**, not Agent. `imagine_image_to_image` on `lock/RIG-*.jpg` + RIG-PROMPT. Agent may paint the same plates. Do **not** instruct Agent for walks/breaths.

`scripts/cook-room.mjs` + `scripts/imagine-hooks.mjs` = **video cook** (walks / breaths / films) and CLI first-seal / batch stills. Agent is **not** the film path. If hooks cannot run (`node` + `XAI_API_KEY`): **REFUSE**. Stock URL. Do **not** fall back to chat `imagine_*` or Agent video.

Also read [AGENTS.md](AGENTS.md) (same refuse). Customize below is paste-once for *before* clone. After clone, this file + AGENTS.md are enough — a new convo that “ignores Customize” still follows this STOP.

**Legal cook, every new conversation, automatic:**

```
STOP 0: read LAYOUT.md + lock/RIG-PROMPT.txt
  spawn FIRST = image_to_image on lock/RIG-spawn.jpg ({PAINT})
  at-A/at-B = reference_to_image IMAGE_0=RIG pose, IMAGE_1=that spawn (ignore dog)
  same hall millimeter — never three separate i2i
  bad stills → STOP (no films)
then read FILMS.md
then node scripts/cook-room.mjs <slot>   # walks + breaths = image + last_frame
then node scripts/smoke-pack.mjs packs/<slot>
```

Video cook: `node scripts/cook-room.mjs <slot> --dry-run` then `export XAI_API_KEY=... && node scripts/cook-room.mjs <slot>`. `npm run dry-run` / `npm run cook` = moss batch. Hung PASS stills/films = reuse. `--force` / `COOK_FORCE=1` recooks.

Gel-breath (ffmpeg still-loop) and FAIL walks are **HANG BLOCKED** — decay in `.kitchen/` or deleted, never a preview KEEP.

Smoke FAIL stills/films → `packs/<id>/.kitchen/fail/<kind>-<n>.jpg|mp4` (debug). **Never** copy FAIL into `stills/` or `films/`. **Never Hang FAIL.** Soft KEEP banned.

at-A/at-B under-size (sill-band ~0.16–0.21): **1 fresh + 1 enlarge-only** (or **2 enlarge** if the disk plate is already that FAIL). Second `imagineStill` takes the FAIL jpg as `image` and ONLY grows the dog to 0.35–0.40 standing at the sill (same camera/hall). Sit does not block enlarge. Mid-hall / `gate.place` = fresh, not enlarge. Ember FAIL×2 after the PR #7 teacher was 0.19+sit+face / 0.16+sit — teacher alone still shrinks.

STYLE stills = Imagine Agent. Video = `scripts/imagine-hooks.mjs`:

- stills → `imagineStill()` → `POST /v1/images/edits` (CLI first-seal / batch). **BANNED for restyle.**
- walks → `imagineClip()` → `image` + **`last_frame`** (start still ≠ arrive still)
- breaths → `imagineClip()` → same still twice (`image` + `last_frame`)

Then `smoke-pack.mjs`. PASS → `packs/<id>/`. FAIL ×2 → stock. Never a chat mp4 in `films/`. **Smoke still gates.**

Lane: `node scripts/cook-biome.mjs <id>` (same hooks, other job). Not `cook-room`.

One-shot walk (hooks first+last — never Agent):

```
node --input-type=module -e 'import { imagineClip } from "./scripts/imagine-hooks.mjs"; await imagineClip({ root: process.cwd(), slot: "moss", kind: "walk", first: "packs/moss/stills/spawn.jpg", last: "packs/moss/stills/at-a.jpg", dest: "packs/moss/.kitchen/walk.mp4", seconds: 10 })'
```

Then `node scripts/smoke-pack.mjs <file> --kind walk`. FAIL = do not Hang.

### Custom instructions (paste once in Grok → Customize)

This is the only text that loads in a **brand-new** convo **before** the repo is cloned. Paste it. A convo that never got this paste must still **clone then read GROK.md + AGENTS.md** — same refuse. Without clone, Chat Imagine UI without real first+last is **banned** (no `last_frame`). STYLE stills = Imagine Agent. Video cook = hooks first+last.

```
Boltverse / StarBoltSprint / citadel / salle mousse:
STOP — HARD SPLIT (SmiR 2026-09-12). Imagine Agent is obligatoire / MUST / systematically for STYLE stills when restyling. NEVER for Walk A, Walk B, breath, or any video. Walks / breaths / films = imagine-hooks / cook-room first-frame + last-frame. Chat Imagine UI without real first+last is banned. Soft KEEP banned. Smoke still gates.
1. Clone https://github.com/StarBoltSprint/boltverse-odyssey
2. Read AGENTS.md then GROK.md (STOP). Do not cook before that.
3. NEVER call imagine_image_to_video, imagine_reference_to_video, or imagine_image_to_image. Chat Imagine UI without real first+last has no last_frame. Chat Imagine UI without real first+last is banned for walks.
4. HARD SPLIT. Imagine Agent (grok.com/imagine/agent) = ONLY hall STYLES / stills / décor restyles.
   Seal stills. Restyle halls. NEVER walks, breaths, or any video through Agent.
   Walks / breaths = cook-room / imagine-hooks image + last_frame. Walks = start still + end still. Breaths = same still twice. Smoke still gates. Soft KEEP banned.
   Agent is not required or recommended for video cook. Do not instruct Agent for Walk A, Walk B, or breath.
   Identity base: Bolt is ALWAYS a full-white German Shepherd (white coat forever). That base never changes to grey/silver/black.
   SKINS: Imagine Agent MAY apply a décor-matching skin ON TOP of the white base — ember skin (embers/glow/ash accents), ice skin, etc. Stylish adaptation. Not a different dog.
   Restyle: completely new hall décor OK. Doors may adapt (shape/scale to décor). Cyan L + gold R energy portals may adapt shape/scale to décor (oval|RECT energy; never wood; never chrome UI). Bolt may be selected, repositioned, resized to sill for a nickel plate. Bolt reposition OK.
   Imagine Agent is MANDATORY for cross-style hall stills (not optional). Agent REQUIRED for décor variants. One sealed sill still → Agent restyles (new décor OK; portals may adapt; Bolt may move/resize at sill). SEALED skip stays.
   First seal stills = Imagine Agent. cook-room imagineStill = CLI first-seal / BANNED for restyle.
   Imagine Agent produced the ice-hall KEEP seals (lock/SEAL-spawn.jpg + lock/SEAL-at-a.jpg + lock/SEAL-at-b.jpg). Frozen pose+décor until SmiR reseals. Agent remains the STYLE stills path for future styles. Sealed skip = no imagineStill. Smoke still gates. Soft KEEP banned.
   Grok Build chat Imagine tools are NOT the same as Imagine Agent. For STYLE restyle: instruct to open Imagine Agent with the plate refs. Do not instruct Agent for walks/breaths. Build must not rely on chat imagine_* tools for hall restyle identity lock.
   Imagine Agent is the hall-restyle tool. Sealed skip stays.
   cook-room + imagine-hooks = video cook (first+last) and CLI first-seal / batch stills.
5. If hooks cannot run (node + XAI_API_KEY): REFUSE. Give stock https://boltverse-odyssey.grok.me/
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
  STOP: HARD SPLIT. Imagine Agent obligatoire / MUST / systematically
    for STYLE stills when restyling. NEVER for Walk A / Walk B / breath / video
  STYLE stills = Imagine Agent (grok.com/imagine/agent)
    seal stills · restyle halls (freeze dog+portals, swap décor)
  Walks / breaths / films = imagine-hooks / cook-room first+last
    walks start+end · breaths same still twice
    Agent is not required or recommended for video
  Identity base: full-white German Shepherd (white coat forever)
  SKINS: décor-matching skin ON TOP of the white base OK (ember/ice). Not a different dog.
  Restyle: completely new hall décor OK
  Doors may adapt (shape/scale to décor)
  Cyan L + gold R energy portals may adapt shape/scale to décor
  Bolt may be selected, repositioned, resized to sill for a nickel plate
  Bolt reposition OK
  Smoke still gates. Soft KEEP banned.
  hung PASS stills/films = reuse
  3 stills + 5 films + smoke-pack
  URL /r/<slot>  or stock on FAIL×2
  Imagine Agent is MANDATORY for cross-style hall stills (not optional)
  Agent REQUIRED for décor variants. imagineStill BANNED for restyle
  one sealed sill still → Agent restyles (new décor OK; portals may adapt)
  Grok Build chat Imagine tools are NOT the same as Imagine Agent
  Chat Imagine UI without real first+last is banned
  Build must not rely on chat imagine_* tools for hall restyle identity lock
  For STYLE restyle: instruct to open Imagine Agent with the plate refs
  Do not instruct Agent for walks/breaths
  cook-room + imagine-hooks = video cook (first+last)
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

Chat Imagine UI without real first+last cannot send `last_frame` — **banned**. Hall films = hooks `image` + `last_frame` (start+end stills / same still twice). Never Imagine Agent video. Décor variants: **Imagine Agent REQUIRED**. `imagineStill` **BANNED for restyle**. First seal stills = Imagine Agent. Lane plates: same hooks, **other** job (`cook-biome`). Films cooked in chat have no smoke → player loads **stock**. **Smoke still gates.**

---

Trigger hall (any language): *citadel*, *citadelle*, *salle mousse*, *fais-moi une citadelle* — **and not** biome/sprint/lane. Then HALL JOB.

Trigger Lane: *biome*, *sprint*, *lane*, *course*, *colle forest*. Then **stop.** LANE JOB. Do not run cook-room.

*`starboltsprint` / `boltverse` alone* → player URL, not a cook. Both words in one sentence (`starboltsprint forest sprint`) → **Lane wins** (the verb `sprint` / `forest` as biome). Do not take the first hall trigger on the page.

You are wiring a **living-film**. Auth OFF. Database OFF. No 3D, no canvas, no WebGL. **Do not scaffold a new app. Do not publish a new grok.me.**

## Law 0 — Imagine first + last (automatic)

The stills **are** the frames. [COOK.md](COOK.md).

| kind | Imagine call | first | last |
|---|---|---|---|
| **hall walk** | hooks / cook-room API `image` + `last_frame`. Never Imagine Agent. | start still | arrive still — **distinct** |
| **hall breath** | hooks / cook-room: one still twice. Never Imagine Agent. | pose | **same** |
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
3. Else HALL JOB. STYLE stills = **Imagine Agent** — seal stills, restyle halls. Then films via hooks first+last (`cook-room` `imagineClip`). Then smoke. **Cross-style / décor variants** from a SEALED sill → **Imagine Agent REQUIRED** (new décor OK; cyan L + gold R portals may adapt; Bolt may be selected / repositioned / resized to sill; white coat forever; décor-matching skin ON TOP OK). `imagineStill` **BANNED for restyle.** Wait only if `COOK_DEBUG=1`. Law 0. smoke-pack. URL.

Never `text_to_image` a new dog. Never invent a new dog via `imagineStill` when a sealed sill exists. Agent is MANDATORY for décor variants. Agent is NEVER the film path.

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

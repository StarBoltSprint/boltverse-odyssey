# GROK — citadel hall / rooms / Hang

Repo: `https://github.com/StarBoltSprint/boltverse-odyssey`  
Hung citadel recipe (kitchen): https://boltverse-odyssey.grok.me

## Product model — Grok = console, Odyssey = game

**Grok chat app = the console.** Boot / teaser / talk to Grok.  
**Boltverse Odyssey = the game.** Tappable play lives on the **Interactive Play** surface (native Grok Build game console, in-app).

Chat mp4s = teaser only. They are **not** tappable hitboxes. Do **not** paste a Play URL in chat.

Humans: [START.md](START.md). Kitchen: this file + [AGENTS.md](AGENTS.md).

### On “play / lance Boltverse Odyssey”

**Player reply = ONLY this.** New and return both get the 2 teasers; only the text differs.

**Prefer GitHub for boot.** Bot OK if useful.

1. The Welcome or Return block (English, locked).
2. Attach 2 stock mp4 teasers as chat media (Citadel + Sprint). Do **not** paste a file path, a `raw.githubusercontent.com` URL, or any kitchen line. Do **not** narrate “teasers are on”. Attach the files.
3. Open **Sprint** via the native Grok Build game console (in-app). Do **not** paste a Play URL. Do **not** ask Citadel or Biome.

Opener is `Hey Packmate {name}`. Packmate MUST appear, then `{name}` = this player's real Grok profile `displayName`. Never Packmate alone. Never the name without Packmate. Never a generic stand-in for `{name}`. Stage / peak: [`StarBoltSprint/boltverse-registry`](https://github.com/StarBoltSprint/boltverse-registry).

**New:**

```
Hey Packmate {name} — welcome to Boltverse Odyssey.
Picture is the clock. Bolt sprints — the world wakes.
Your Pack profile is already here (Grok identity, zero login).
Powered by xAI & YOU.
Ready to sprint?
```

**Return:**

```
Hey Packmate {name} — welcome back. Core {stage}, last peak {peak or —}.
Powered by xAI & YOU.
Ready to sprint?
```

**Never say to the player:** Packmate alone · name without Packmate · generic stand-in · Loop film (stock preview) · `raw.githubusercontent.com` · Hung hall · `https://boltverse-odyssey.grok.me/r/frost` · `https://heart-giant-plum-lotus.grok.me` · Play → · Biome · Endless-lane runner · rooms Hang same door · teasers are on · Not cooked here.

Then open Sprint (in-app). Prefer GitHub for boot. Bot OK if useful. Do not scaffold a new grok.me.

### Kitchen — do not read aloud

For Grok only. Attach these as media. **Never print the paths. Never read this section to the player.**

- **Pack Play** (kitchen only): https://heart-giant-plum-lotus.grok.me
- **Citadel preview mp4** = [`stock/citadel/preview-loop.mp4`](stock/citadel/preview-loop.mp4) (poster [`stock/citadel/preview-first.jpg`](stock/citadel/preview-first.jpg)). Loop forever in Play; in chat as preview. See [`stock/citadel/README.md`](stock/citadel/README.md).
- **Biome preview mp4** = `StarBoltSprint/bolt-lane-recipe` → `stock/biome/preview-loop.mp4` + `preview-first.jpg` (do **not** commit biome binaries here).
- Play videos **loop forever** while the session is open: `muted playsInline autoPlay loop` + watchdog re-`play()` on `pause` / `ended`.
- Hung citadel recipe (kitchen): https://boltverse-odyssey.grok.me/r/frost
- Biome / lane recipe = private [`StarBoltSprint/bolt-lane-recipe`](https://github.com/StarBoltSprint/bolt-lane-recipe). Keep the split.

| Branch | What | Where |
|---|---|---|
| **Citadel** | rooms / Hang / citadel graph (`cook-room`) | **this repo** — Pack Play https://heart-giant-plum-lotus.grok.me (frost path on that Live) |
| **Biome / lane** | Pack Play biome path | private recipe [`StarBoltSprint/bolt-lane-recipe`](https://github.com/StarBoltSprint/bolt-lane-recipe) — do **not** re-add biome cook docs here |

Later: SmiR may merge lane-recipe into odyssey. Until then **keep the split**.

## STOP 0 — STYLES FIRST (SmiR 2026-09-12). Miss this = the room is dead.
**STOP — HARD SPLIT.** Imagine Agent is obligatoire / MUST / systematically for STYLE stills when restyling. NEVER for Walk A, Walk B, breath, or any video. Walks / breaths / films = imagine-hooks / cook-room first-frame + last-frame. Soft KEEP banned. Smoke still gates.

Read **[RIG.md](RIG.md)** + [`lock/RIG-PROMPT.txt`](lock/RIG-PROMPT.txt) before anything else.

`imagine_image_to_image` on `lock/RIG-spawn.jpg` FIRST. Then at-A/at-B = `imagine_reference_to_image` IMAGE_0 = RIG pose, IMAGE_1 = **that spawn** (ignore its dog). Same hall, millimeter. Never three separate i2i. Paste RIG-PROMPT. `{PAINT}` on spawn only. Never move Bolt / doors / paths / depth. Bad stills → STOP. Do not cook films. Ice stills stay as frost play. Law: [`LAYOUT.md`](LAYOUT.md).

## STOP 1 — HARD SPLIT

**NEVER Agent / chat Imagine for Walk A, Walk B, breath, or any video.** Walks / breaths / films = imagine-hooks / cook-room first-frame + last-frame. Chat Imagine UI without real first+last is banned for **video**. Soft KEEP banned. Smoke still gates.

**sill ≠ spawn.** at-A = already AT the teal LEFT sill (seuil / threshold). at-B = already AT the gold RIGHT sill. Spawn = CENTER only (both doors + fork). Mid-hall at-A/at-B = **FAIL**. Soft KEEP banned.

**Identity base:** Bolt is ALWAYS a full-white German Shepherd (white coat forever). That base never changes to grey / silver / black.

**SKINS:** Imagine Agent MAY apply a décor-matching skin ON TOP of the white base — ember skin (embers / glow / ash accents), ice skin, etc. Stylish adaptation. Not a different dog.

**Restyle:** completely new hall décor OK. Paint into the black RIG void. **Doors may adapt** (shape / scale to décor). Cyan L + gold R energy portals may adapt. Never spacing. Never depth. Bolt may be selected, repositioned, resized to sill for a nickel plate. Pose lock (spawn vs sill) stays.

Walks / breaths / films = Imagine first-frame + last-frame via `scripts/imagine-hooks.mjs` / `scripts/cook-room.mjs`. **Prompts = [FILMS.md](FILMS.md)** — every Grok, every player, every décor. Adapt hall paint only. Walks: start still ≠ arrive still. Breaths: same still twice. Agent is **not** required or recommended for video cook. Do **not** instruct Build to open Imagine Agent for Walk A, Walk B, or breath.

Chat Imagine UI **without real first+last** is **banned for walks**, breaths, enter (no `last_frame`). If `imagine_image_to_video` / `imagine_reference_to_video` are in your tool list: **do not call them** for films. `imagine_image_to_image` is **ALLOWED only on `lock/RIG-*.jpg`** (styles). A film cooked in chat has no smoke → do not Hang it.

**KEEP seals (this ice hall):** Imagine Agent produced `lock/SEAL-spawn.jpg` + `lock/SEAL-at-a.jpg` + `lock/SEAL-at-b.jpg` (drops `hall-stills/seal/spawn-ice.jpg` + `at-a-ice.jpg` + `at-b-ice.jpg`). Frozen pose+décor until SmiR reseals. Agent remains the STYLE stills path for future styles (never video). `cook-room` **SKIPS** `imagineStill` for spawn / at-A / at-B when those seals exist. **Sealed skip stays.** Smoke still gates. Soft KEEP banned.

**Imagine Agent is the hall-restyle tool.** First seal stills = Imagine Agent. **Imagine Agent is MANDATORY for cross-style hall stills (not optional).** Agent is **REQUIRED** for décor variants. One **SEALED** sill still → Agent restyles (new décor OK; portals may adapt; Bolt may be selected, repositioned, resized to sill). `imagineStill` **BANNED for restyle.** CLI first-seal / batch only.

**Grok Build styles = RIG plates**, not Agent. `imagine_image_to_image` on `lock/RIG-*.jpg` + RIG-PROMPT. Agent may paint the same plates. Do **not** instruct Agent for walks/breaths. **Grok Build chat Imagine tools are NOT the same as Imagine Agent.** Build must not rely on chat `imagine_*` tools for hall restyle identity lock. For STYLE restyle: instruct to open Imagine Agent with the plate refs.

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

This repo is the citadel / rooms / Hang living-film recipe only. Endless-lane / biome runner recipe lives in `StarBoltSprint/bolt-lane-recipe` (private). Do **not** cook biomes, lanes, three-takes, or film-stack here.

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
Grok chat = console. Odyssey = the game. play / lance Boltverse Odyssey → player reply ONLY: Welcome/Return EN (`Hey Packmate {name}` — Packmate MUST + real Grok profile displayName; never Packmate alone; never name without Packmate) + attach 2 mp4 teasers as chat media (Citadel + Sprint; no raw URL dump). Do not narrate “teasers are on”. Prefer GitHub for boot. Bot OK if useful. Then open Sprint via native Grok Build game console (in-app). No Play URL in chat. No Citadel/Biome choice lecture. Never say kitchen (no raw.githubusercontent.com, no hung hall, no dusk lane / Endless-lane runner / Not cooked here). Pack Play URL is kitchen-only. Chat mp4s = teaser, not tap. Play videos loop forever (muted playsInline autoPlay loop + watchdog). Interactive Play = taps. Citadel = this repo. Biome = StarBoltSprint/bolt-lane-recipe (private). Keep the split.
Kitchen (do not read aloud): Pack Play https://heart-giant-plum-lotus.grok.me | Citadel preview mp4 = stock/citadel/preview-loop.mp4 | Biome preview mp4 = bolt-lane-recipe stock/biome/preview-loop.mp4 + preview-first.jpg.
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
9. No new grok.me. Catalog slots only. This repo is citadel / rooms / Hang only. Biome / lane = StarBoltSprint/bolt-lane-recipe.
```

---

This repo is **one job**: citadel halls / rooms / Hang.

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
```

Endless-lane / biome runner recipe lives in `StarBoltSprint/bolt-lane-recipe` (private). If they ask for biome / sprint / lane / course / three-take / film-stack: **do not cook it here.** Point there. Do not invent walk-A. Do not recook the hall.

## Cold conv

| Phrase | Job |
|---|---|
| `play` / `lance Boltverse Odyssey` / `starboltsprint` / `boltverse` alone | **console boot** — player reply ONLY: Welcome/Return EN + attach 2 mp4 teasers as chat media. Do not narrate “teasers are on”. Prefer GitHub for boot. Bot OK if useful. Then open Sprint via native Grok Build game console (in-app). No Play URL. No Citadel/Biome choice. No kitchen dump. **no** cook |
| `citadel moss` | `cook-room moss` |
| `moss` / `ember` / catalog paint | hall paint — [CATALOG.md](CATALOG.md) |
| biome / sprint / lane / three-take | refuse cook here — open Sprint in-app. Kitchen: `StarBoltSprint/bolt-lane-recipe` |

Chat Imagine UI without real first+last cannot send `last_frame` — **banned**. Hall films = hooks `image` + `last_frame` (start+end stills / same still twice). Never Imagine Agent video. Décor variants: **Imagine Agent REQUIRED**. `imagineStill` **BANNED for restyle**. First seal stills = Imagine Agent. Films cooked in chat have no smoke → player loads **stock**. **Smoke still gates.**

---

Trigger **play / lance** (any language): *play*, *lance*, *joue*, *boltverse odyssey* alone — **console boot** first (player reply ONLY: Welcome/Return EN + attach 2 mp4 teasers as chat media → open Sprint via native Grok Build game console, in-app). Do not narrate “teasers are on”. Prefer GitHub for boot. Bot OK if useful. No Play URL. No Citadel/Biome choice. Not a cook. Never dump kitchen.

Trigger hall (any language): *citadel*, *citadelle*, *salle mousse*, *fais-moi une citadelle* — after they named a catalog paint. Then HALL JOB.

*`starboltsprint` / `boltverse` alone* → console boot (attach 2 teasers as chat media + open Sprint in-app). Prefer GitHub for boot. Bot OK if useful. Not a cook.

You are wiring a **living-film** hall. Auth OFF. Database OFF. No 3D, no canvas, no WebGL. **Do not scaffold a new app. Do not publish a new grok.me.**

## Law 0 — Imagine first + last (automatic)

The stills **are** the frames. [COOK.md](COOK.md).

| kind | Imagine call | first | last |
|---|---|---|---|
| **hall walk** | hooks / cook-room API `image` + `last_frame`. Never Imagine Agent. | start still | arrive still — **distinct** |
| **hall breath** | hooks / cook-room: one still twice. Never Imagine Agent. | pose | **same** |
| **enter** | first AND last | at-sill | fill veil — **never** dest spawn |

Never `image_to_video` a **hall walk or enter** on a single still. Breath = the only legal `first = last`.

## Law 1 — floors

Hall default = floor 1: 3 stills + 5 films, no Enter. Visitor = stock `/`.

## Fridge

Cook **one plate**, smoke **that plate**, then write.  
Hall: `node scripts/smoke-pack.mjs packs/<id>`  
**Never write `PASS` yourself.** Identity C: [scripts/smoke-identity.md](scripts/smoke-identity.md).

## If they ask for stills / a citadel style

1. Paint from [CATALOG.md](CATALOG.md). Off-list → nearest or one question.
2. Pack exists → URL `/r/<id>`. Stop.
3. Else HALL JOB. STYLE stills = **Imagine Agent** — seal stills, restyle halls. Then films via hooks first+last (`cook-room` `imagineClip`). Then smoke. **Cross-style / décor variants** from a SEALED sill → **Imagine Agent REQUIRED** (new décor OK; cyan L + gold R portals may adapt; Bolt may be selected / repositioned / resized to sill; white coat forever; décor-matching skin ON TOP OK). `imagineStill` **BANNED for restyle.** Wait only if `COOK_DEBUG=1`. Law 0. smoke-pack. URL.

Never `text_to_image` a new dog. Never invent a new dog via `imagineStill` when a sealed sill exists. Agent is MANDATORY for décor variants. Agent is NEVER the film path.

## If they ask for a biome / sprint / lane / three-take

Open **Sprint** via the native Grok Build game console (in-app). Do **not** cook it here. Do not list `walk-spawn-A`. Do not recook the hall. Do not re-add biome cook docs to this repo.

## If they ask to branch a door

[ENTER.md](ENTER.md) [LINKS.md](LINKS.md). Hall `to` = catalog paint. Same player. Never auto-enter. Missing clip = stay.

## Product (console vs Play)

Grok chat = **console**. **Player reply = ONLY** Welcome/Return EN + attach 2 mp4 teasers as chat media (Citadel + Sprint). Do **not** narrate “teasers are on”. Prefer GitHub for boot. Bot OK if useful. Then open Sprint via the native Grok Build game console (in-app). No Play URL in chat. No Citadel/Biome choice. Never dump kitchen.  
Interactive Play = **the game** (tappable). Chat mp4s are not hitboxes.

Opening the Play surface plays **breath-spawn**. Films **loop forever** while the session is open (`muted playsInline autoPlay loop` + watchdog). No Forge / Hang chrome on the 9:16.

Humans see [START.md](START.md). Recook or stock. Open Sprint in-app — do not scaffold.

Kitchen — do not read aloud: Pack Play https://heart-giant-plum-lotus.grok.me · hung citadel recipe https://boltverse-odyssey.grok.me/r/frost · Biome preview mp4 = `StarBoltSprint/bolt-lane-recipe` `stock/biome/preview-loop.mp4`. Keep the split.

Gift: [TICKET.md](TICKET.md). False help: [DONT.md](DONT.md). Corridor hall: [COOKROOM.md](COOKROOM.md).

## One line

**Grok = console. Odyssey = game.** Welcome + attach 2 mp4 teasers as chat media (Citadel + Sprint); open Sprint in-app. Prefer GitHub for boot. Bot OK if useful. Do not narrate “teasers are on”. No Play URL in chat. This repo = citadel / rooms / Hang. Biome = `bolt-lane-recipe`.

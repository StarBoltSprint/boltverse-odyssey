# GROK — two default jobs (hall vs Lane)

Repo: `https://github.com/StarBoltSprint/boltverse-odyssey`  
Player: https://boltverse-odyssey.grok.me

## STOP — films = hook, never chat Imagine

If `imagine_image_to_video` / `imagine_reference_to_video` / `imagine_image_to_image` are in your tool list: **do not call them** for this recipe. Not for stills. Not for walks. Not for breaths. Not as a “preview”.

Those tools have **no `last_frame`**. Chat refs are not frames. Chat stills skip the edits lock. A film cooked in chat has no smoke → do not Hang it. A Smoke-FAIL walk attached as KEEP is **illegal**.

**If you cannot run Node, or a plate will Imagine and you have no `XAI_API_KEY`: REFUSE the cook.** Say what is missing. Do **not** fall back to chat Imagine. Stock URL is the honest answer.

Also read [AGENTS.md](AGENTS.md) (same refuse). Customize below is paste-once for *before* clone. After clone, this file + AGENTS.md are enough — a new convo that “ignores Customize” still follows this STOP.

**Legal cook, every new conversation, automatic:**

```
node scripts/cook-room.mjs <slot> --dry-run
export XAI_API_KEY=... && node scripts/cook-room.mjs <slot>
```

`npm run dry-run` / `npm run cook` = moss. Hung PASS stills/films = reuse. Only missing / smoke-FAIL plates Imagine. `--force` / `COOK_FORCE=1` recooks.

Gel-breath (ffmpeg still-loop) and FAIL walks are **HANG BLOCKED** — decay in `.kitchen/` or deleted, never a preview KEEP.

That script is the only hall cook. It calls `scripts/imagine-hooks.mjs`:

- stills → `imagineStill()` → `POST /v1/images/edits`
- walks → `imagineClip()` → `image` + **`last_frame`** (start still ≠ arrive still)
- breaths → `imagineClip()` → same still twice (`image` + `last_frame`)

Then `smoke-pack.mjs`. PASS → `packs/<id>/`. FAIL ×2 → stock. Never a chat mp4 in `films/`.

Lane: `node scripts/cook-biome.mjs <id>` (same hooks, other job). Not `cook-room`.

One-shot walk if the room already exists:

```
node --input-type=module -e 'import { imagineClip } from "./scripts/imagine-hooks.mjs"; await imagineClip({ root: process.cwd(), slot: "moss", kind: "walk", first: "packs/moss/stills/spawn.jpg", last: "packs/moss/stills/at-a.jpg", dest: "packs/moss/.kitchen/walk.mp4", seconds: 10 })'
```

Then `node scripts/smoke-pack.mjs <file> --kind walk`. FAIL = do not Hang.

### Custom instructions (paste once in Grok → Customize)

This is the only text that loads in a **brand-new** convo **before** the repo is cloned. Paste it. A convo that never got this paste must still **clone then read GROK.md + AGENTS.md** — same refuse. Without clone, Grok only has chat Imagine, which is **not** a hall cook.

```
Boltverse / StarBoltSprint / citadel / salle mousse:
1. Clone https://github.com/StarBoltSprint/boltverse-odyssey
2. Read AGENTS.md then GROK.md (STOP). Do not cook before that.
3. NEVER call imagine_image_to_video, imagine_reference_to_video, or imagine_image_to_image for hall stills, walks, breaths, or enter. They have no last_frame.
4. Happy path: node scripts/cook-room.mjs <slot> --dry-run
   then export XAI_API_KEY=... && node scripts/cook-room.mjs <slot>
   (npm run dry-run / npm run cook = moss). Hung PASS = reuse. --force recooks.
5. If you cannot run node, or a plate will cook and XAI_API_KEY is missing: REFUSE. Do not chat-Imagine. Give stock https://boltverse-odyssey.grok.me/
6. Gel-breath / FAIL walk = HANG BLOCKED, not a preview KEEP. Sit / face / 3/4 / oval doors cannot PASS.
7. Lane = node scripts/cook-biome.mjs <id>. No new grok.me.
```

---

**First word picks the disc.** Same player. Not the same recipe.  
The **verb** chooses (`salle` vs `sprint`). The noun `moss` does not.

```
HALL JOB =
  node scripts/cook-room.mjs <slot> --dry-run
  export XAI_API_KEY=... && node scripts/cook-room.mjs <slot>
  hung PASS stills/films = reuse; --force recooks
  3 stills + 5 films + smoke-pack
  URL /r/<slot>  or stock on FAIL×2
  NO chat Imagine — not for stills, not for walks, not for enter
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

Chat Imagine cannot send `last_frame`. Hall stills + films: `imagine-hooks` only. Lane plates: same hooks, **other** job (`cook-biome`). Films cooked in chat have no smoke → player loads **stock**.

---

Trigger hall (any language): *citadel*, *citadelle*, *salle mousse*, *fais-moi une citadelle* — **and not** biome/sprint/lane. Then HALL JOB.

Trigger Lane: *biome*, *sprint*, *lane*, *course*, *colle forest*. Then **stop.** LANE JOB. Do not run cook-room.

*`starboltsprint` / `boltverse` alone* → player URL, not a cook. Both words in one sentence (`starboltsprint forest sprint`) → **Lane wins** (the verb `sprint` / `forest` as biome). Do not take the first hall trigger on the page.

You are wiring a **living-film**. Auth OFF. Database OFF. No 3D, no canvas, no WebGL. **Do not scaffold a new app. Do not publish a new grok.me.**

## Law 0 — Imagine first + last (automatic)

The stills **are** the frames. [COOK.md](COOK.md).

| kind | Imagine call | first | last |
|---|---|---|---|
| **hall walk** | API `image` + `last_frame` | start still | arrive still — **distinct** |
| **hall breath** | one still twice | pose | **same** |
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
3. Else HALL JOB (`cook-room.mjs`). Stills → smoke → films. Wait only if `COOK_DEBUG=1`. Law 0. smoke-pack. URL.

Never `text_to_image` a new dog.

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

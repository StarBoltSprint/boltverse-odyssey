# COOK — player asks for 3 stills, Grok cooks Bolt into their citadel

This is the product. The player does **not** pick films first. They ask Grok for **3 stills** in a citadel style. Grok supplies them with the **same Bolt** ([CHAR.md](CHAR.md)). **Do not wait.** Stills → smoke → films. Order: [COOKROOM.md](COOKROOM.md). Wait only if COOK_DEBUG=1.

**STOP — HARD SPLIT (SmiR 2026-09-12, supersedes PR #11).** Imagine Agent is obligatoire / MUST / systematically for STYLE stills when restyling. NEVER for Walk A, Walk B, breath, or any video. Walks / breaths / films = imagine-hooks / cook-room first-frame + last-frame. Chat Imagine UI without real first+last is banned. Soft KEEP banned. Smoke still gates.

**Identity base:** Bolt is ALWAYS a full-white German Shepherd (white coat forever). That base never changes to grey / silver / black.

**SKINS:** Imagine Agent MAY apply a décor-matching skin ON TOP of the white base — ember skin (embers / glow / ash accents), ice skin, etc. Stylish adaptation. Not a different dog.

**Restyle:** completely new hall décor OK. **Doors may adapt** (shape / scale to décor). Cyan L + gold R energy portals may adapt shape / scale to décor (oval|RECT energy; never wood; never chrome UI). Bolt may be selected, repositioned, resized to sill for a nickel plate. Bolt reposition OK.

**[Grok Imagine Agent](https://grok.com/imagine/agent) = ONLY hall STYLES / stills / décor restyles** (freeze dog+portals, swap décor, skins on white coat). **NEVER** walks, breaths, or any video.

Walks / breaths / films = Imagine first-frame + last-frame via [scripts/imagine-hooks.mjs](scripts/imagine-hooks.mjs) / [scripts/cook-room.mjs](scripts/cook-room.mjs). Walks: start still ≠ arrive still. Breaths: same still twice. Agent is **not** required or recommended for video cook. Do **not** instruct Build to open Imagine Agent for Walk A, Walk B, or breath. **Smoke still gates.** Soft KEEP banned.

Chat Imagine UI **without real first+last** is **banned** (no `last_frame`) — walks, breaths, enter. Do not cook films there. For STYLE restyle: instruct to open Imagine Agent with the plate refs.

`scripts/cook-room.mjs` + [scripts/imagine-hooks.mjs](scripts/imagine-hooks.mjs) = **video cook** (walks / breaths / films) and CLI first-seal / batch stills. Agent is **not** the film path.

```
# secondary CLI / batch only
node scripts/cook-room.mjs <catalog-slot> --dry-run
export XAI_API_KEY=... && node scripts/cook-room.mjs <catalog-slot>
```

`--dry-run` first (no key, prints skip vs cook). Live needs `XAI_API_KEY` only for plates the CLI Imagines.  
`slot` ∈ [CATALOG.md](CATALOG.md). Off-list → stock, exit 1.

Hung pack with PASS stills/films = **reuse**. CLI only Imagines missing or smoke-FAIL plates. `--force` / `COOK_FORCE=1` overwrites and recooks. Never silently wipe `packs/moss` or any hung PASS still. **Sealed skip stays.** Imagine Agent produced the ice-hall **KEEP seals** (`lock/SEAL-spawn.jpg` + `lock/SEAL-at-a.jpg` + `lock/SEAL-at-b.jpg`). Frozen pose+décor for this ice hall until SmiR reseals. Agent remains the STYLE stills path for future styles (never video). When those SEAL files exist, `cook-room` **SKIPS** `imagineStill` for spawn / at-A / at-B (copy the seal if the pack still is missing). **Smoke still gates.** Soft KEEP banned.

**Imagine Agent is MANDATORY for cross-style hall stills (not optional).** Agent is **REQUIRED** for décor variants. Imagine Agent is the **hall-restyle** tool for sealed stills. One **SEALED** sill still (dog already AT the teal or gold threshold) → Agent restyles: completely new hall décor OK; cyan L + gold R energy portals may adapt shape / scale to décor; Bolt may be selected, repositioned, resized to sill for a nickel plate (white coat forever; décor-matching skin ON TOP OK). First seal stills = Imagine Agent. `cook-room` `imagineStill` = CLI first-seal / batch. **BANNED for restyle.** Do **not** invent a new dog each style.

**Grok Build chat Imagine tools are NOT the same as Imagine Agent.** Cross-style sealed stills = Imagine Agent at `https://grok.com/imagine/agent`. For STYLE restyle: instruct to open Imagine Agent with the plate refs. Do **not** instruct Agent for walks/breaths. Build must not rely on chat `imagine_*` tools for hall restyle identity lock.

Smoke FAIL stills/films are copied to `packs/<id>/.kitchen/fail/<kind>-<n>.jpg|mp4` for debug, then **deleted** from `stills/` and `films/`. **Never Hang FAIL.** Soft KEEP banned. `--dry-run` prints `fail-save` + `enlarge`.

Films go through [scripts/imagine-hooks.mjs](scripts/imagine-hooks.mjs) (`imagineClip`) **via** [scripts/cook-room.mjs](scripts/cook-room.mjs). CLI first-seal stills use `imagineStill`. Chat Grok Imagine UI does not honor first/last — do not cook hall films there. Never Imagine Agent video.

Repo: `https://github.com/StarBoltSprint/boltverse-odyssey`
Ops / folders / encode / PACK: [HANG.md](HANG.md).

## Clip queue

Stills PASS, then **one** film at a time through [CLIP.md](CLIP.md). Never five Imagines in parallel. Never a FAIL in `films/`.

## Law 0 — Imagine first + last (automatic)

Every new conversation. Do not wait to be asked.

| kind | Imagine call | first | last |
|---|---|---|
| **walks** | hooks / cook-room API `image` + **`last_frame`**. Never Imagine Agent. | start still | arrive still — **distinct** |
| **enter** | same (first AND last distinct) | at-still | fill veil — **never** dest spawn |
| **breath** | hooks / cook-room: `last_frame` = the same still. Never Imagine Agent. | pose still | **same** still (spawn/spawn, atA/atA, atB/atB) |

**`last_frame` is an aim, not a paste.** The API sends the arrive still. Imagine *steers*. If spawn is 0.19 and at-A is 0.45, the jump is too far — it keeps the start. Last picture = spawn. `graph.last_not_official`. Not an unplugged cable.

Keep the size step small: spawn **0.22–0.32**, sill **0.35–0.40**, **Δh/H < 0.12**. Then 10s. If last still = spawn after cap 2 → stock, tap stays.

**`reference_to_video` is not first/last.** The images are *references*, not frames. Imagine *inspires* a walk. It does **not** paste the gold still as the last picture. Walk-B then overshoots into the rift → size pop. **Illegal for walks and enter.**

Chat Imagine UI without real first+last has no `last_frame` tool — **banned** for walks, breaths. Walks / breaths = `scripts/imagine-hooks.mjs` / `cook-room.mjs` (`image` + `last_frame`). Never Imagine Agent video. Décor variants = **Imagine Agent REQUIRED**. `imagineStill` **BANNED for restyle**. First seal stills = Imagine Agent. For STYLE restyle: instruct to open Imagine Agent with the plate refs. Do **not** instruct Agent for walks/breaths.

Never `image_to_video` a walk or enter on a single still. That invents the journey / clones the dog. Breath is the only legal `first = last`.

After the clip: extract last.jpg. If last ≠ arrive still (`gate.size` / `graph.last_not_official`) → recook the walk, cap 2. **Do not** replace a small official still with a fat last frame to “fix” the splice. If last PASSES size, you may copy last → still so the player swap is hash 0. If last FAILS size, recook.

## Law 1 — floors ([FLOORS.md](FLOORS.md))

Default = **floor 1**. 3 stills + **5** films. One room. No Enter. No walk-A-B unless they ask.


After **each** plate: `smoke(file, kind, refs)` ([SMOKE.md](SMOKE.md)). PASS writes `films/`. FAIL recooks **this** plate, cap 2.

## What the player may change

**A catalog paint only.** One id from [CATALOG.md](CATALOG.md): moss · ember · dusk · asteroid · frost · ivy · ash · tide · ember-deep · gold.
Off-list → nearest, or ask "did you mean ember?". Never "describe any temple". `cook-room` reads the two lines from `catalog/<id>.md`. Do not paste them into Chat Imagine UI without real first+last. Imagine Agent restyle of a **SEALED** sill: completely new hall décor OK; cyan L + gold R energy portals may adapt shape / scale to décor; Bolt may be selected, repositioned, resized to sill; white coat forever; décor-matching skin ON TOP of the white base OK. Do not invent a different dog.

## What is locked (pack)

| lock | value |
|---|---|
| Bolt | [CHAR.md](CHAR.md) — **full white, ZERO black, no saddle** · [`lock/bolt-back.jpg`](lock/bolt-back.jpg) |
| Camera | lock-off, 9:16, plate 720×1280 — **same depth as ice seals. NEVER a new lens.** |
| Doors | **energy rifts** — A left cyan-teal, B right gold-orange. Shape oval\|RECT may adapt. **Spacing = ice.** Never wood, never chrome UI. [DOORS.md](DOORS.md) [LAYOUT.md](LAYOUT.md) |
| Spawn | both doors in frame, Bolt center, back to camera. **Y-fork** (two luminous paths paws → both sills) every style |
| atA | Bolt at teal LEFT **sill** (`cx` ≤ 0.38); gold still visible. Same Bolt↔door distance as ice. Mid-hall / spawn-cx = FAIL |
| atB | Bolt at gold RIGHT **sill** (`cx` ≥ 0.62); teal still visible. Same Bolt↔door distance as ice. Mid-hall / spawn-cx = FAIL |

Composition examples (how Imagine learns seuil):

- [`lock/example-spawn.jpg`](lock/example-spawn.jpg) — camera + two-door lock (scale OK). Ice SPAWN KEEP = [`lock/SEAL-spawn.jpg`](lock/SEAL-spawn.jpg) (drop [`hall-stills/seal/spawn-ice.jpg`](hall-stills/seal/spawn-ice.jpg)) — mid-hall, dead-center BEHIND white GSD, back/withers only, cyan L / gold R ahead.
- **spawn / at-A / at-B KEEP seals** — [`lock/SEAL-spawn.jpg`](lock/SEAL-spawn.jpg) / [`lock/SEAL-at-a.jpg`](lock/SEAL-at-a.jpg) / [`lock/SEAL-at-b.jpg`](lock/SEAL-at-b.jpg). Imagine Agent ice-cathedral KEEP (drops [`hall-stills/seal/spawn-ice.jpg`](hall-stills/seal/spawn-ice.jpg) + [`at-a-ice.jpg`](hall-stills/seal/at-a-ice.jpg) + [`at-b-ice.jpg`](hall-stills/seal/at-b-ice.jpg)). Frozen pose+décor until SmiR reseals. Agent remains the STYLE stills path for future styles (never video). `cook-room` **SKIPS** `imagineStill` when these exist. Smoke still gates. Soft KEEP banned.
- **at-A lock teacher** — [`lock/example-at-a.jpg`](lock/example-at-a.jpg) (or the SEAL file if present). SmiR / Imagine Agent: standing **BACK toward teal L**, gold visible. Oval|RECT energy OK (PR #6). Unsealed `imagineStill` atA **prefers this lock example** as the side ref (not hung moss). **copy PLACE+POSE from example; FORCE taille 0.35–0.40; FORCE STANDING; never shrink to 0.18; hall materials from spawn/catalog only — ignore example décor.** Live ember at-A FAIL×2 was sill-band 0.19+sit+face and 0.16+sit — teacher alone is not enough.
- **at-B teacher** — [`lock/example-at-b.jpg`](lock/example-at-b.jpg) / [`lock/sill-at-b.jpg`](lock/sill-at-b.jpg) / SEAL-at-b, else hung moss PASS.
- **IGNORE a tiny ~0.18 crop** the same way Imagine **IGNORE**s bolt-back ~0.53. Live after #4: at-A FAIL×2 sill-band 0.19/0.21; at-B FAIL×2 0.20/0.21+sit. Archived anti-teachers: [`lock/example-at-a-tiny.jpg`](lock/example-at-a-tiny.jpg) / [`example-at-b-tiny.jpg`](lock/example-at-b-tiny.jpg) — **never send**.

### COOK / LOCK — drop SmiR at-A if the binary is missing

SmiR’s teacher is installed:

1. Source: [`hall-stills/smir-ata-teacher.jpeg`](hall-stills/smir-ata-teacher.jpeg) (standing BACK toward teal L, gold visible).
2. `node scripts/install-lock-ata.mjs` wrote [`lock/example-at-a.jpg`](lock/example-at-a.jpg) (720×1280).
3. Direct `lock/example-at-a-tiny.jpg` is still refused. An owner drop at `hall-stills/` is allowed even if the pixels match that archive — prompts **FORCE taille 0.35–0.40 + STANDING** and **never shrink to 0.18**.

Live ember at-A FAIL×2 (0.19+sit+face / 0.16+sit) means teacher pixels alone are not enough. After #4: at-A 0.19/0.21; at-B 0.20/0.21+sit. **Two-step sill:** if at-A/at-B FAILs under-size (sill-band ~0.16–0.21) and place is usable — **or even if sit** — the second cook is enlarge-only: `imagineStill({ enlargeFrom: FAIL jpg })`. `image` = that FAIL. ONLY grow the dog to 0.35–0.40 STANDING at the same sill (same camera/hall). Do not send the teacher (teacher is the shrink). Cap: **1 fresh + 1 enlarge** (or **2 enlarge** if the disk plate is already that FAIL). Mid-hall / `gate.place` = fresh, not enlarge. FAIL jpg stays in `.kitchen/fail/` — never `stills/`. Cross-style from a **SEALED** sill = **Imagine Agent REQUIRED** (new décor OK; portals may adapt; Bolt may be selected / repositioned / resized to sill). `imagineStill` **BANNED for restyle.** First seal stills = Imagine Agent (CLI `imagineStill` only if Agent unavailable). Chat Imagine UI without real first+last is **banned**. No new grok.me.

## Player phrases (treat as this flow)

- "citadelle mousse" / "citadel moss" → floor 1, `cookRoom("moss")`
- "braise" / "ember" → `ember`
- off-list ("temple martien") → ask nearest paint, do not cook
- "branche room 2 sur la porte A" → floor 3, `kind: hall` ([LINKS.md](LINKS.md))
- "colle le sprint forest sur la porte B" → `kind: sprint`, biome Lane, Bolt exits ([LINKS.md](LINKS.md))

If they give **no** paint, do not cook — send `/` (stock). If they give **7 videos**, skip still-cook — map and hang ([GROK.md](GROK.md)).

## Stills — Imagine Agent (first seal + restyle; never films)

Do **not** roll 3 separate text-to-image in chat. Chat Imagine UI **without real first+last** is **banned**.

Human first seal = **Imagine Agent**. `cook-room` `imagineStill()` (`POST /v1/images/edits`) = CLI first-seal / batch. **BANNED for restyle.** One spawn. Two moves from that spawn. Hung PASS = skip.

**Already SEALED at-A / at-B** (dog at the sill, smoke PASS): do **not** invent a new dog. **Imagine Agent is MANDATORY** (not optional). Agent is **REQUIRED** for décor variants. One sealed sill still → **[Imagine Agent](https://grok.com/imagine/agent)** restyles: completely new hall décor OK; cyan L + gold R energy portals may adapt shape / scale to décor; Bolt may be selected, repositioned, resized to sill for a nickel plate; white coat forever; décor-matching skin ON TOP OK. `imagineStill` is **BANNED for restyle.** Then drop the restyle into `packs/<id>/stills/` and smoke. Sealed skip stays. **Smoke still gates.**

Room 1 → `packs/<id>/stills/spawn.jpg` `at-a.jpg` `at-b.jpg`.
Room 2 → `stills/a/spawn.jpg` `stills/a/at-a.jpg` `stills/a/at-b.jpg`. **Do not overwrite room 1.**
Without `stills/a/` Grok writes over hall and the citadel dies.

Wait only if `COOK_DEBUG=1`. Default: stills → smoke → films. No “show the 3, wait.”

### 1. spawn — `imagineStill({ pose: "spawn" })`

Refs: `lock/bolt-back.jpg` + `lock/example-spawn.jpg` · aspect `9:16`

Hooks send:

> Same dog as the first image — FULL-white German Shepherd, ZERO black on the coat, no saddle, no mask, no black ears, teal collar, back to camera, STANDING four paws (never sit / 3/4 / face). Same camera and door layout as the second image: cyan-teal energy rift left, gold-orange energy rift right, both oval OR RECT holes with jambs and sills (oval preferred-ok), lock-off. Never wood. Never chrome UI rectangles. A luminous teal-gold fork from his paws to BOTH sills (glow in the stone, not chrome). He is small — bboxH/H **0.22–0.32** (aim 0.24–0.28). Hall restyled with ONLY these materials (from catalog/<id>.md): **{two lines}**. Photoreal 9:16. No UI. No extra door.

Save → `stills/spawn.jpg` (or `stills/a/spawn.jpg`). Scale 720×1280.

### 2. atA — from spawn, not from text

`imagineStill({ pose: "atA", spawnPath })` · **`image` = spawn** (not bolt-back). bolt-back = coat only (IGNORE ~0.53). Side ref = **`lock/example-at-a.jpg`** (SmiR lock teacher; not hung moss). IGNORE tiny ~0.18 crop like bolt-back 0.53. Never `example-at-a-tiny`.

> Same camera / light / energy rifts as spawn (oval or RECT). **copy PLACE+POSE from example; FORCE taille 0.35–0.40; FORCE STANDING; never shrink to 0.18; hall materials from spawn/catalog only — ignore example décor.** He is ALREADY at the teal LEFT **sill** (paws on that lip, body in the LEFT third) — NEVER mid-hall / spawn / center / fork. STANDING, BACK, crown to camera. Feet on the **stone floor in front of** the sill — never inside the rift, never climbing the teal (punch-sill if dog top < 0.46). Gold stays in frame. Never sit / face / 3/4. bboxH/H **FORCE 0.35–0.40**. Do not shrink him to the teacher (~0.18 / 0.16 / 0.19 = FAIL). Δh/H < 0.12. Do not grow him in place at center. IGNORE bolt-back crop (~0.53). IGNORE a tiny ~0.18 crop the same way.

Save → `stills/at-a.jpg` (or `stills/a/at-a.jpg`).

### 3. atB — from the same spawn

`imagineStill({ pose: "atB", spawnPath })` · **`image` = spawn** (not atA, not bolt-back). bolt-back = coat only (IGNORE ~0.53). Side ref = hung moss PASS `at-b.jpg` (else swapped `lock/example-at-b.jpg` / `lock/sill-at-b.jpg`). IGNORE tiny ~0.18 crop like bolt-back 0.53. Never `example-at-b-tiny`.

> Same hall, same camera, same energy rifts as spawn (oval or RECT). He is ALREADY at the gold RIGHT **sill** (paws on that lip, body in the RIGHT third) — NEVER mid-hall / spawn / center / fork. STANDING, BACK, crown to camera. Feet on the **stone floor in front of** the sill — never inside the rift, never climbing the gold (punch-sill if dog top < 0.46). Teal stays in frame. Never sit / face / 3/4. bboxH/H **0.35–0.40**. Δh/H < 0.12. Do not grow him in place. IGNORE bolt-back crop (~0.53). IGNORE a tiny ~0.18 crop the same way.

Save → `stills/at-b.jpg` (or `stills/a/at-b.jpg`).

If any FAIL below, recook from spawn **unless** it is an under-size sill (see two-step enlarge). Do not invent a fourth still. Do not cook films until stills PASS. FAIL plates land in `.kitchen/fail/` only.

### Two-step sill (enlarge-only)

Fresh `imagineStill` from spawn still shrinks to the teacher (~0.18). Ember evidence (PR #7 lock teacher, live after #4):

| try | at-A | at-B |
|---|---|---|
| 1 | sill-band **0.19** + sit + face | **0.20** + sit |
| 2 | sill-band **0.16** + sit | **0.21** + sit |

Place can be at the door. Size is illegal. Sit does **not** block the second step.

1. Fresh edit from spawn (teacher = PLACE+POSE only).
2. If Smoke FAILs `gate.size sill-band` ~0.16–0.21 (hard < 0.28) and not `gate.place` / punch-sill: save FAIL → `.kitchen/fail/still-atA-1.jpg`, drop `stills/at-a.jpg`, then `imagineStill({ enlargeFrom })` — FAIL jpg is `image`. Prompt = **ENLARGE ONLY**. Aim 0.35–0.40 standing. Same camera/hall. No teacher.
3. Cap **1 fresh + 1 enlarge**, or **2 enlarge** when the plate on disk is already an under-size FAIL.
4. Mid-hall / `gate.place` = another fresh (cap 2). Never enlarge a center dog.
5. Either step FAIL → stay in `.kitchen/fail/`. Never Hang.

## Stills FAIL (recook)

- Cooked in Chat Imagine UI without real first+last (not first-seal `imagineStill`, not **Imagine Agent** restyle of a SEALED sill)
- Décor variant cooked via `cook-room` `imagineStill` (`imagineStill` **BANNED for restyle**; Agent **REQUIRED**)
- Bolt face / 3/4 / profile / sit / lie / different dog
- Dog climbing the rift / punch-sill (top < 0.46) / bboxH/H > 0.45 / bolt-back close-up scale
- Mid-hall / spawn-cx dog sold as at-A or at-B (`gate.place` — atA cx ≤ 0.38, atB cx ≥ 0.62)
- grey / silver coat, black saddle, black mask, black ears (`identity.coat` / `identity.saddle`)
- Doors swapped or missing (spawn must show **both**)
- Wood leaves / ajar timber / flat teal paint / third door / chrome UI rectangles / morphing blob ([DOORS.md](DOORS.md)). Oval energy is OK — do not FAIL oval shape alone.
- Camera moved / zoomed / tilted
- Hall architecture morphs between spawn and atA/atB
- Plate not 9:16
- UI, text, watermark, chrome

## Films — only after stills PASS (`imagineClip` first+last; never Agent)

Stills **are** first and last frames. Do not re-imagine a new hall. **Law 0.**

Films = `cook-room` → `imagineClip()` with API `image` + `last_frame`. Walks: start still ≠ arrive still. Breaths: same still twice. Never Imagine Agent video. Never chat `reference_to_video`. Never `image_to_video` on one still for a walk. Chat Imagine UI without real first+last is banned for walks (no `last_frame`).

**Walks and enter: first AND last must be distinct images.** Breath is the only legal `first = last` loop. Enter is **not** `image_to_video` on one still — `last = first` invents a journey / clone. See [HANG.md](HANG.md).

Floor 1 films → `films/` (the 5). Floor 2 = walk-A-B / B-A if asked. Floor 3 = `films/a/` + enter, only if asked. [FLOORS.md](FLOORS.md).

| clip | tool | first | last | dur | law |
|---|---|---|---|---|---|
| breath-spawn | image + last_frame = spawn | spawn | spawn | **6s** | loop, feet glued, ONE dog center |
| breath-A | image + last_frame = atA | atA | atA | **6s** | loop, ONE dog at teal, never a center dog |
| breath-B | image + last_frame = atB | atB | atB | **6s** | loop, ONE dog at gold, never a center dog |
| walk-spawn-A | API last_frame spawn→atA | spawn | atA | **10s** | arrive ~8s then HOLD. No round trip |
| walk-spawn-B | API last_frame spawn→atB | spawn | atB | **10s** | idem |
| walk-A-B | API last_frame atA→atB | atA | atB | **10s** | **floor 2** — only if asked |
| walk-B-A | API last_frame atB→atA | atB | atA | **10s** | **floor 2** — only if asked |

Walk prompt (hooks send this via `imagineClip`; do not paste into chat Imagine):

> Lock-off. Camera NEVER moves. He STARTS walking on frame 1 and walks at a STEADY pace all the way to last_frame (~9s). NO morph. ONE dog only — never two. No leftover hold (leftover seconds = round trip = FAIL). FULL-white GSD, teal collar, back the whole clip. No 3/4.

### Breath — first AND last are the **same** still

| clip | first | last |
|---|---|---|
| breath-spawn | `stills/spawn.jpg` | `stills/spawn.jpg` |
| breath-A | `stills/at-a.jpg` | `stills/at-a.jpg` |
| breath-B | `stills/at-b.jpg` | `stills/at-b.jpg` |

Hooks **must** send `last_frame` = that still (same file twice). Image-only breath walks / turns / gels. Walk is the opposite: last **≠** first. Pass `pose` so `breathLine` pins the sill. **No spawn still in a door-breath call.**

### Breath clone — LAW vs pose

LAW says two portals + lower-third (**spawn** grammar). Door still = dog at the sill. Imagine **completes** the hall → two dogs at t=0. FAIL `clone.two_dogs`. Hash A+B often PASS. Layer C required. [CLIP.md](CLIP.md).

Prompt (`scripts/imagine-hooks.mjs` `breathLine`):

> 6s loop. Same still first AND last (API pins — not prompt refs). Completely stationary: NEVER walks or shifts. Gentle breath (chest/flanks) + light tail sway. Portals/lights may pulse. NO morph. Camera lock-off. ONE dog only — never two.

Cap 2 → **do not Hang**. ffmpeg loop of the at-still may be written to `.kitchen/` (decay, **not** a living PASS, **not** `films/`). Stock URL. Soft KEEP of a gel or FAIL walk is illegal.

### Breath — two laws

**In-room** (the 5 of the hall you are already in). Breath + small head/tail OK. Walk / position change = FAIL:

> Lock-off. Same still. 6s. Completely stationary. Gentle breath + tail. Portals may pulse. NO morph. ONE dog. Already at THIS pose. NEVER a second dog. NEVER anything else on screen. No walk. No new place.

**Dest after enter** (`films/a/breath-spawn.mp4`). Must be **posed**. If `image_to_video` walks / turns / leaves spawn → **do not hang it**. Freeze the still:

```
ffmpeg -loop 1 -i stills/a/spawn.jpg -t 6 \
  -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" \
  -c:v libx264 -pix_fmt yuv420p -r 24 -an -movflags +faststart \
  films/a/breath-spawn.mp4
```

Better a freeze than a second walk across Hall' after the curtain. QC dest: feet glued the whole 6s or replace with the loop.

### Encode (every mp4)

```
ffmpeg -i in.mp4 -map 0:v:0 \
  -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" \
  -c:v libx264 -pix_fmt yuv420p -an -movflags +faststart out.mp4
```

No audio. `yuv420p` + `faststart`. A 784×1168 clip gets center-crop 9:16 then scale — otherwise lock-off dies.
Then bump `PACK` (`?uN`). No bump = browser replays the old mp4.

Hang: [GROK.md](GROK.md) + [ENGINE.md](ENGINE.md). Open = breath-spawn. No chrome.

## Linger then warp (the dash)

He parks mid-hall, then `last_frame` yanks him to at-A. Last picture can be correct. The **path** is illegal.

Cook: leave spawn in **1s**, even gait, arrive ~8s of 10s, hold. Spawn→sill **Δh/H < 0.12**.
Smoke: `graph.walk_linger` (still at spawn ~3s), `graph.walk_plant` (frozen **mid-hall**, not spawn — linger misses this), or `graph.walk_sprint` (warp). last_frame can PASS (last = at-A) while the path FAILs. Cap 2 → drop the walk, tap = stay. Do not hang the dash.

## Walk FAIL (recook that clip, don't hang it)

- 3/4, profile, fashion-walk, face
- Bolt morph (coat, collar, extra limb)
- grey / saddle / black ears (`identity.coat` / `identity.saddle`)
- Hall morph, door color swap
- First frame ≠ start still / last frame ≠ arrive still (dissolve will not fix this)
- Cooked as `image_to_video` on one still (violates Law 0)
- Cooked as chat `reference_to_video` (not last_frame)
- 10s walk that arrives then returns to spawn (`graph.walk_return`) — recook **10s**, do not hang a trim of the loop

## Enter — second room on a door (after both packs exist)

Do **not** cook enter until:

1. Room 1 stills + 7 films hang and play.
2. Room 2 stills + 7 films exist in `stills/a/` + `films/a/` (this file, other style, **same depth**).
3. Player asks to **branch** door A (or B) onto room 2.

Then read [ENTER.md](ENTER.md) and [HANG.md](HANG.md). Short version:

- **Two plates.** `imagineClip` first+last **distinct** (Law 0): atA → teal-fill (dog **stays left**). Never chat Imagine. Never `image_to_video` on one still. Never `last = Hall' spawn`.
- Engine: 500ms empty veil of **that door** → spawn of room 2. Door A = teal-empty. Door B = **gold-empty**. Do not hardcode teal on a gold enter.
- Dest breath = freeze if i2v walks.
- Enter is **outside the 7** (`ENTER{}` map). `ended` → switch room **then** dest breath-spawn.
- Wire: walk to the door first, **stay**. Second tap = enter. Walk ended **never** auto-enters.
- Bump `PACK` after hanging the new mp4.

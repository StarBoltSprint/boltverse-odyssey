# COOK — player asks for 3 stills, Grok cooks Bolt into their citadel

This is the product. The player does **not** pick films first. They ask Grok for **3 stills** in a citadel style. Grok supplies them with the **same Bolt** ([CHAR.md](CHAR.md)). **Do not wait.** Stills → smoke → films. Order: [COOKROOM.md](COOKROOM.md). Wait only if COOK_DEBUG=1.

```
node scripts/cook-room.mjs <catalog-slot> --dry-run
export XAI_API_KEY=... && node scripts/cook-room.mjs <catalog-slot>
```

`--dry-run` first (no key, prints skip vs cook). Live needs `XAI_API_KEY` only for plates it Imagines.  
`slot` ∈ [CATALOG.md](CATALOG.md). Off-list → stock, exit 1.

Hung pack with PASS stills/films = **reuse**. `cook-room` only Imagines missing or smoke-FAIL plates. `--force` / `COOK_FORCE=1` overwrites and recooks. Never silently wipe `packs/moss` or any hung PASS still.

**Stills and films go only through** [scripts/imagine-hooks.mjs](scripts/imagine-hooks.mjs) (`imagineStill` / `imagineClip`) **via** [scripts/cook-room.mjs](scripts/cook-room.mjs). Chat Grok Imagine UI does not honor first/last — do not cook hall stills or films there.

Repo: `https://github.com/StarBoltSprint/boltverse-odyssey`
Ops / folders / encode / PACK: [HANG.md](HANG.md).

## Clip queue

Stills PASS, then **one** film at a time through [CLIP.md](CLIP.md). Never five Imagines in parallel. Never a FAIL in `films/`.

## Law 0 — Imagine first + last (automatic)

Every new conversation. Do not wait to be asked.

| kind | Imagine call | first | last |
|---|---|---|
| **walks** | API `image` + **`last_frame`** (hooks / `videos/generations`) | start still | arrive still — **distinct** |
| **enter** | same | at-still | fill veil — **never** dest spawn |
| **breath** | API `image` + **`last_frame` = the same still** | pose still | **same** still (spawn/spawn, atA/atA, atB/atB) |

**`last_frame` is an aim, not a paste.** The API sends the arrive still. Imagine *steers*. If spawn is 0.19 and at-A is 0.45, the jump is too far — it keeps the start. Last picture = spawn. `graph.last_not_official`. Not an unplugged cable.

Keep the size step small: spawn **0.22–0.32**, sill **0.35–0.40**, **Δh/H < 0.12**. Then 10s. If last still = spawn after cap 2 → stock, tap stays.

**`reference_to_video` is not first/last.** The images are *references*, not frames. Imagine *inspires* a walk. It does **not** paste the gold still as the last picture. Walk-B then overshoots into the rift → size pop. **Illegal for walks and enter.**

Chat Grok has no `last_frame` tool. Stills and walks go through `scripts/imagine-hooks.mjs` / `cook-room.mjs`, not chat Imagine.

Never `image_to_video` a walk or enter on a single still. That invents the journey / clones the dog. Breath is the only legal `first = last`.

After the clip: extract last.jpg. If last ≠ arrive still (`gate.size` / `graph.last_not_official`) → recook the walk, cap 2. **Do not** replace a small official still with a fat last frame to “fix” the splice. If last PASSES size, you may copy last → still so the player swap is hash 0. If last FAILS size, recook.

## Law 1 — floors ([FLOORS.md](FLOORS.md))

Default = **floor 1**. 3 stills + **5** films. One room. No Enter. No walk-A-B unless they ask.


After **each** plate: `smoke(file, kind, refs)` ([SMOKE.md](SMOKE.md)). PASS writes `films/`. FAIL recooks **this** plate, cap 2.

## What the player may change

**A catalog paint only.** One id from [CATALOG.md](CATALOG.md): moss · ember · dusk · asteroid · frost · ivy · ash · tide · ember-deep · gold.
Off-list → nearest, or ask "did you mean ember?". Never "describe any temple". `cook-room` reads the two lines from `catalog/<id>.md`. Do not paste them into chat Imagine. Do not dream an architecture.

## What is locked (pack)

| lock | value |
|---|---|
| Bolt | [CHAR.md](CHAR.md) — **full white, ZERO black, no saddle** · [`lock/bolt-back.jpg`](lock/bolt-back.jpg) |
| Camera | lock-off, 9:16, plate 720×1280 |
| Doors | **energy rifts** — A left cyan-teal, B right gold-orange. Jambs+sill+gap, RECT fill, never wood. [DOORS.md](DOORS.md) |
| Spawn | both doors in frame, Bolt center, back to camera |
| atA | Bolt at teal LEFT **sill** (`cx` ≤ 0.38); gold still visible. Mid-hall / spawn-cx = FAIL |
| atB | Bolt at gold RIGHT **sill** (`cx` ≥ 0.62); teal still visible. Mid-hall / spawn-cx = FAIL |

Composition examples (camera + door layout, not the player's hall):

- [`lock/example-spawn.jpg`](lock/example-spawn.jpg) — camera + two-door lock (scale OK)
- [`lock/example-at-a.jpg`](lock/example-at-a.jpg) / [`lock/example-at-b.jpg`](lock/example-at-b.jpg) — **which SIDE** only. Oval + tiny (~0.18). Do **not** copy scale or door shape. RECT + 0.35–0.40 come from the prompt + the spawn still.

## Player phrases (treat as this flow)

- "citadelle mousse" / "citadel moss" → floor 1, `cookRoom("moss")`
- "braise" / "ember" → `ember`
- off-list ("temple martien") → ask nearest paint, do not cook
- "branche room 2 sur la porte A" → floor 3, `kind: hall` ([LINKS.md](LINKS.md))
- "colle le sprint forest sur la porte B" → `kind: sprint`, biome Lane, Bolt exits ([LINKS.md](LINKS.md))

If they give **no** paint, do not cook — send `/` (stock). If they give **7 videos**, skip still-cook — map and hang ([GROK.md](GROK.md)).

## Stills — order is law (hooks, not chat)

Do **not** roll 3 separate text-to-image in chat. Do **not** paste these prompts into Grok Imagine UI.

`cook-room` calls `imagineStill()` (`POST /v1/images/edits`). One spawn. Two moves from that spawn.

Room 1 → `packs/<id>/stills/spawn.jpg` `at-a.jpg` `at-b.jpg`.
Room 2 → `stills/a/spawn.jpg` `stills/a/at-a.jpg` `stills/a/at-b.jpg`. **Do not overwrite room 1.**
Without `stills/a/` Grok writes over hall and the citadel dies.

Wait only if `COOK_DEBUG=1`. Default: stills → smoke → films. No “show the 3, wait.”

### 1. spawn — `imagineStill({ pose: "spawn" })`

Refs: `lock/bolt-back.jpg` + `lock/example-spawn.jpg` · aspect `9:16`

Hooks send:

> Same dog as the first image — FULL-white German Shepherd, ZERO black on the coat, no saddle, no mask, no black ears, teal collar, back to camera, STANDING four paws (never sit / 3/4 / face). Same camera and door layout as the second image: cyan-teal energy rift left, gold-orange energy rift right, both full RECT holes with jambs and sills, lock-off. Never oval. Never wood. A luminous teal-gold fork from his paws to BOTH sills (glow in the stone, not chrome). He is small — bboxH/H **0.22–0.32** (aim 0.24–0.28). Hall restyled with ONLY these materials (from catalog/<id>.md): **{two lines}**. Photoreal 9:16. No UI. No extra door.

Save → `stills/spawn.jpg` (or `stills/a/spawn.jpg`). Scale 720×1280.

### 2. atA — from spawn, not from text

`imagineStill({ pose: "atA", spawnPath })` · **`image` = spawn** (not bolt-back). bolt-back = coat only. `example-at-a` = LEFT side only (ignore oval / 0.18).

> Same hall, same camera, same RECT rifts as spawn. He is ALREADY at the teal LEFT **sill** (paws on that lip, body in the LEFT third) — NEVER mid-hall / spawn / center / fork. STANDING, BACK, crown to camera. Feet on the **stone floor in front of** the sill — never inside the rift, never climbing the teal (punch-sill if dog top < 0.46). Gold stays in frame. Never sit / face / 3/4. bboxH/H **0.35–0.40**. Δh/H < 0.12. Do not grow him in place. Do not copy bolt-back crop (~0.53).

Save → `stills/at-a.jpg` (or `stills/a/at-a.jpg`).

### 3. atB — from the same spawn

`imagineStill({ pose: "atB", spawnPath })` · **`image` = spawn** (not atA, not bolt-back). bolt-back = coat only. `example-at-b` = RIGHT side only (ignore oval / 0.18).

> Same hall, same camera, same RECT rifts as spawn. He is ALREADY at the gold RIGHT **sill** (paws on that lip, body in the RIGHT third) — NEVER mid-hall / spawn / center / fork. STANDING, BACK, crown to camera. Feet on the **stone floor in front of** the sill — never inside the rift, never climbing the gold (punch-sill if dog top < 0.46). Teal stays in frame. Never sit / face / 3/4. bboxH/H **0.35–0.40**. Δh/H < 0.12. Do not grow him in place. Do not copy bolt-back crop (~0.53).

Save → `stills/at-b.jpg` (or `stills/a/at-b.jpg`).

If any FAIL below, recook from spawn. Do not invent a fourth still. Do not cook films until stills PASS.

## Stills FAIL (recook)

- Cooked in chat Imagine UI (not `imagineStill` via `cook-room`)
- Bolt face / 3/4 / profile / sit / lie / different dog
- Dog climbing the rift / punch-sill (top < 0.46) / bboxH/H > 0.45 / bolt-back close-up scale
- Mid-hall / spawn-cx dog sold as at-A or at-B (`gate.place` — atA cx ≤ 0.38, atB cx ≥ 0.62)
- grey / silver coat, black saddle, black mask, black ears (`identity.coat` / `identity.saddle`)
- Doors swapped or missing (spawn must show **both**)
- Wood leaves / ajar timber / flat teal paint / third door / RECT morphing to a circle ([DOORS.md](DOORS.md))
- Camera moved / zoomed / tilted
- Hall architecture morphs between spawn and atA/atB
- Plate not 9:16
- UI, text, watermark, chrome

## Films — only after stills PASS (`imagineClip`, not chat)

Stills **are** first and last frames. Do not re-imagine a new hall. **Law 0.**

`cook-room` calls `imagineClip()` with API `image` + `last_frame`. Never chat `reference_to_video`. Never `image_to_video` on one still for a walk.

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

> Lock-off. 10 seconds. He walks to the door (~5s) and HOLDS (~3s). Do not walk back to spawn. last_frame locks the last picture, not the path — leftover seconds = round trip = FAIL. FULL-white GSD, teal collar, back the whole clip. No 3/4, no morph.

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

> ONE dog. Already at THIS sill. NEVER a dog at center. Do not complete the hall toward spawn. 6s. Feet glued.

Cap 2 → **do not Hang**. ffmpeg loop of the at-still may be written to `.kitchen/` (decay, **not** a living PASS, **not** `films/`). Stock URL. Soft KEEP of a gel or FAIL walk is illegal.

### Breath — two laws

**In-room** (the 5 of the hall you are already in). Micro head is allowed:

> Lock-off. Same still. ONE dog. Already at THIS pose. NEVER a second dog at center or the other door. Do not complete the hall. The dog breathes, feet glued. Hall frozen. Seamless loop. 6s. No walk, no turn, no face.

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

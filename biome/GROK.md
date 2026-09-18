# GROK — biome / Sprint cook (kitchen)

Repo: `https://github.com/StarBoltSprint/boltverse-odyssey`  
**This folder** = Biome / Sprint lane recipe. Citadel halls = repo root.

Hung / Live (kitchen only): https://boltverse-odysseyyyy.grok.me  
Do **not** paste that URL in a player reply. Never open old three-y `boltverse-odysseyyy.grok.me` as Beat 3 Sprint (superseded — do not open it for boot).

**STOP — HARD SPLIT.** Imagine Agent is obligatoire for STYLE stills when restyling. **NEVER** for Sprint films, empty-plate travel, cutout gallop, or any video. Films = imagine-hooks first-frame + last-frame. Soft KEEP banned.

**MUST read before cooking** (biome / Sprint cook / lane / B-stack / green-screen / chroma):
1. **[PLAY.md](PLAY.md)** — engine lock
2. **[docs/06-techniques.md](docs/06-techniques.md)** — what worked r38 (Sprint cook bible)
3. **[docs/09-recette-biome.md](docs/09-recette-biome.md)** — empty → cousin → speed → dealer → box
4. **[docs/10-bolt-cutout-law.md](docs/10-bolt-cutout-law.md)** — HARD Bolt cutout (strict rear, `#00FF00`, in-place gallop)
5. **[docs/11-plate-order.md](docs/11-plate-order.md)** — HARD LOCK dealer playlist (canyon → cars → duel → night → war)
6. **[docs/05-key.md](docs/05-key.md)** — chroma + crown, not luma
7. **[reference/LanePlayer.tsx](reference/LanePlayer.tsx)** — r38 compositor

**HARD LOCK — Hang ≠ wipe.** New biome = ADD `road-<biome>*.mp4` + plates-index / dealer entries. KEEP hung canyon→cars→duel→night→war. NEVER `rm` masters. Recook Bolt = `bolt.mp4` only. Law: [docs/09-recette-biome.md](docs/09-recette-biome.md).

**HARD — Bolt style teacher (make / add a biome).** Use [`lock/bolt-back.jpg`](../lock/bolt-back.jpg) as the Bolt style ref for the cutout layer (coat + silhouette + strict rear). @ref / Imagine reference that file for every Bolt still/clip. Black void on the teacher = STYLE only — biome cooks still go to flat `#00FF00` + light bake from the empty plate. Hang ≠ wipe still holds. Never dump this on Welcome.

**HARD LOCK — Chat biome catalog (on ask).** **what biomes** / **which runs** / **what can I play** → English Pack voice, hung chapters only (never invent). How to pick: `play canyon` / `play Tide` / `only Tide`. Never on Welcome. No chrome picker. Hang grows the list; wipe shrinks it = FAIL.

Pack Live: **[docs/07-pack-live.md](docs/07-pack-live.md)**. Never dump this to the player.

## Product

Grok chat = **console** ([CONSOLE.md](CONSOLE.md)). Odyssey = **the game**.  
*play / lance* alone → **exactly** the locked Welcome/Return block from [../START.md](../START.md) / [../GROK.md](../GROK.md) (COLD_START) + **1** teaser (`stock/citadel/preview-loop.mp4` only) + Beat 3: open/attach Sprint via Build (in-chat playable preview preferred; else silently open the native Grok Build game console, in-app). Chat Imagine / Chat file chip alone = FAIL. **Not a cook.**

**HARD BAN — no improvised boot prose.** Do not invent Sprint tutorials. Ban: control tutorials (swipe / tap / A/D / W) · « world is rolling » · « plant a lane » · « already on the road » · « He stays in place » · film-keeps-moving essays. This cook file is kitchen — never dump it.

They asked to **cook** a biome / lane / sprint plate → this file. Do not run `scripts/cook-room.mjs`. Do not invent hall `walk-spawn-A`.

[`StarBoltSprint/bolt-lane-recipe`](https://github.com/StarBoltSprint/bolt-lane-recipe) may remain as archive. **Cook here.**

## What to cook (B stack)

Two Imagine jobs. Never one mp4 with Bolt painted into the road.

| Layer | Stills | Film |
|---|---|---|
| **Road** (master) | empty-plate first + last — **ZERO dog** | `imagineBiomeClip` `image` + `last_frame` (distinct) |
| **Bolt cutout** | Bolt mid still — **strict rear**, already sprinting, flat `#00FF00` — style ref [`lock/bolt-back.jpg`](../lock/bolt-back.jpg) ([docs/10-bolt-cutout-law.md](docs/10-bolt-cutout-law.md)) | `imagineBoltClip` gallop: first + last = **the same still** (in place, 6 s) |

Prompts: [prompts/](prompts/). Law: [docs/01-images.md](docs/01-images.md) · [docs/02-videos.md](docs/02-videos.md) · [docs/10-bolt-cutout-law.md](docs/10-bolt-cutout-law.md).

```
# dry thought-queue only — no new grok.me
# live cook needs XAI_API_KEY + imagineBiomeClip (road) / imagineBoltClip (cutout) / imagineClip (hall)
# drop PASS masters into biome/master/ (see master/README.md)
```

Cannot run `node` + `XAI_API_KEY` → **REFUSE**. Open stock Sprint in-app. Do **not** use chat `imagine_image_to_video` / `imagine_reference_to_video` (no `last_frame`). Do **not** use Imagine Agent for video.

## Law 0 — first + last

Same contract as the hall films, **different paint**:

| kind | first | last |
|---|---|---|
| empty-plate travel | start of this road | end of this road — **distinct**, world advanced |
| next road plate | **extracted last frame** of the previous road | new end still |
| cutout gallop | running Bolt (strict rear, already sprinting) | **same still** (`imagineBoltClip`) |

```
ffmpeg -y -sseof -0.12 -i road-N.mp4 -frames:v 1 \
  -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" \
  road-N-last.jpg
```

`last(n)` **file IS** `first(n+1)` for the road chain.

Cousin / hazard plate (bar, arch, puddle):

**THREE lanes. Occupies 1 or 2. NEVER all three.** One free corridor to dodge. Full-width bar = FAIL.

**SPAWN:** first frame FAR AHEAD (small). Approaches, exits the bottom. Never a pop-in.

**OBJECT:** jersey / rock / crate. Not “explosion/crater” — Imagine will fill three lanes. Composite a distant speck onto `last(empty)` if needed. Full order: [docs/09-recette-biome.md](docs/09-recette-biome.md).


| swap | first | last |
|---|---|---|
| empty → cousin | last(empty) **or** lock still + hazard | — |
| cousin → empty | — | **first(empty)** so the cut is the same picture |

Chat Imagine has no `last_frame`. Use `imagineBiomeClip` in [../scripts/imagine-hooks.mjs](../scripts/imagine-hooks.mjs).

## SPEED REF (road — do not soften)

```
RECOOK one plate ONLY. 10 seconds. VERY FAST. CONSTANT rush. Replace current empty plate.

HARD:
- 9:16, **10s**, lock-off
- Sprint travelling baked in cook — world rushes HARD (crawl FAIL)
- Speed ULTRA CONSTANT first→last. NEVER slow down. NEVER accelerate. NEVER ease-in/out. NEVER a ramp. NEVER slow for a crash / impact / obstacle — the world keeps rushing HARD.
- ZERO path/lightning on ground
- ZERO dog/Bolt
- Canyon/Mars OK, CLEAR center
- playbackRate ~1.0–1.2 only
```

`{PAINT}` = décor only. Do not rewrite motion.

This SPEED REF is **one hung plate recook**. It is **not** a license to wipe the `/master` library for a new biome. New biome = new dest (`road-<biome>*.mp4`). Hang ≠ wipe.

## Encode

```
ffmpeg -i in.mp4 -map 0:v:0 \
  -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" \
  -c:v libx264 -pix_fmt yuv420p -g 15 -keyint_min 15 -sc_threshold 0 \
  -an -movflags +faststart out.mp4
```

No audio. Short GOP so seek-sync does not snap to the previous keyframe.

## Plate speed (travel, not FPS)

FPS = smoothness. Travel = how hard the asphalt rushes. After a cook, measure vs the hung empty plate and time-warp if needed:

```
python3 scripts/plate-speed.py biome/master/road.mp4
python3 scripts/plate-speed.py --ref biome/master/road.mp4 biome/master/road-bar.mp4
python3 scripts/plate-speed.py --match --ref biome/master/road.mp4 biome/master/road-bar.mp4 -o biome/master/road-bar.mp4
```

`--match` speeds a slow plate up (duration shrinks). It does **not** replace first+last. See [docs/08-plate-speed.md](docs/08-plate-speed.md).

## Hang

**HARD LOCK — Hang ≠ wipe.** Drop PASS **new** files into [master/](master/README.md) **alongside** hung plates. ADD `road-<biome>*.mp4`. KEEP `road.mp4` / war / night. NEVER `rm` the stack. NEVER set playlist to new-biome-only unless the player explicitly asks to replace the default Beat. Recook Bolt may replace `bolt.mp4` only.

Drop PASS files into [master/](master/README.md). Optional biome preview (archive — **not attached at boot**): [../stock/biome/](../stock/biome/README.md). Boot teaser: [../stock/citadel/](../stock/citadel/README.md).

FAIL → keep debug next to the cook (do not Hang). Dual dogs, sit, face, baked path, crawl = FAIL.

A **key** bug (holes, gold pipe, sliced skull, black flash, sticker edge) is a compositor bug — fix [docs/06-techniques.md](docs/06-techniques.md), do **not** recook the dog.

## Pack floor

Every Live drops [../client/pack.js](../client/pack.js) with `BOLTVERSE_PACK_ORIGIN` = `https://boltverse-pack.vercel.app` (TEMPORARY — Lives freeze; not the forever home. Long-term: Pack stays inside the Grok sandbox). **HARD BAN:** odysseyyyy is the game play URL, not the Pack API. Naked Live without Pack = FAIL. Never ask the player to install Pack / wire. Fail soft if Pack is down. [docs/07-pack-live.md](docs/07-pack-live.md). No wallet. No player API keys.

## Do not

- New grok.me / Vite / wallet / client keys
- 3-take L / M / R as the default cook
- Invent C-light as a required lock
- Recook citadel `packs/<slot>` because someone said sprint
- Chat Imagine without real first+last
- Imagine Agent video
- Recook to hide a key bug
- Full-width hazard on LEFT+CENTER+RIGHT (nowhere to dodge)
- Wipe hung `biome/master` / `public/master` to “make room” for a new biome (Hang ≠ wipe — Tide cook FAIL)
- Playlist = new-biome-only unless SmiR / player explicitly says replace the default Beat
- Dump the chat biome catalog on Welcome, or invent unhung biome names (on ask; hung chapters only)

# GROK — citadel hall / rooms / Hang

**PRIORITY 0 — start ≠ Build.** Even if the user is on the Build tab, on start/play/lance boltverse odyssey: Grok MUST NOT Build anything. Reply in chat only: Welcome EN + citadel teaser + paste `https://boltverse-odysseyyyy.grok.me`. URL in the same turn as the video. No yes-gate before showing the URL. Zero Build / scaffold / Built-with-Grok.

**Build tab is not a license to implement.** MUST NOT: implement LanePlayer, copy masters, configure build, merge styles, SSR guards, brand-pass, « Implementing Sprint in this preview », preview scaffold, Built-with-Grok card, any file edits for boot. LanePlayer at boot = FAIL. Copying game assets = FAIL. Configuring the build = FAIL. Prefer switching attention to Chat for boot. **Build work for start = FAIL.** After Welcome+video+URL, STOP. Idle. No follow-up Build agent.

Repo: `https://github.com/StarBoltSprint/boltverse-odyssey`  
Hung citadel recipe (kitchen): https://boltverse-odyssey.grok.me

## Product model — Grok = console, Odyssey = game

**Grok chat app = the console.** Boot / teaser / talk to Grok.  
**Boltverse Odyssey = the game.** Tappable play lives on the **Interactive Play** surface (native Grok Build game console, in-app).

Chat mp4s = teaser only. They are **not** tappable hitboxes. First chat reply PASTE written URL `https://boltverse-odysseyyyy.grok.me` in chat (same turn as the video). Supercedes « never paste grok.me » for the first reply. Prefer open in Grok app.

Humans: [START.md](START.md). Kitchen: this file + [AGENTS.md](AGENTS.md).

### On “play / lance Boltverse Odyssey”

**start ≠ Build.** Success = start ≠ Build; first reply = Welcome EN + citadel teaser + paste odysseyyyy. No yes-gate.

**First chat reply:** Welcome EN + citadel teaser + paste URL. Locked Welcome/Return EN only + attach citadel teaser video only. No yes-gate. PASTE written URL in the same turn as the video. Zero Build / scaffold / Built-with-Grok. Even if the user is on the Build tab: reply in chat only. **BAN Build/rebuild/Live attach/controls/improv.** Do **not** Build on « start boltverse odyssey game ». On start, Grok MUST NOT Build anything. **Build work for start = FAIL.** After Welcome+video+URL, STOP. Idle. No follow-up Build agent.

**Player reply = ONLY this.** New and return both get the **1** teaser; only the text differs.

**HARD BAN — no improvised boot prose.** Speak the locked Welcome/Return block below **verbatim** (swap `{name}` / `{playerCount}` / `{stage}` / `{peak}` only). Nothing else. Ban: control tutorials (swipe / tap / A/D / W) · « world is rolling » · « plant a lane » · « already on the road » · « He stays in place » · film-keeps-moving essays. Kitchen (LanePlayer, PLAY, plate order) is **not** spoken.

**Prefer GitHub for boot.** Bot OK if useful. **Never rebuild from GitHub.**

1. The Welcome or Return block (English, locked).
2. Attach **1** stock mp4 as chat media (`stock/citadel/preview-loop.mp4` only). Do **not** paste a file path, a `raw.githubusercontent.com` URL, or any kitchen line. Do **not** narrate “teasers are on”. Attach the file. The Chat file chip is the teaser only — it is **not** Beat 3.
3. PASTE written URL `https://boltverse-odysseyyyy.grok.me` in the same turn as the video (player taps). Prefer open in Grok app. No yes-gate. Do **not** Build. Do **not** rebuild. Do **not** Live attach. Do **not** lecture controls. Do **not** improv. Do **not** ask Citadel or Biome.
4. Then STOP. Idle. No follow-up Build agent. Prefer switching attention to Chat for boot. **Build work for start = FAIL.**

Opener is `Hey Packmate {name}`. Packmate MUST appear. `{name}` = this player's real Grok profile `displayName` first, then registry, then gate/app, else `runner` ONLY if none. Never Packmate alone. Never the name without Packmate. Never a generic stand-in for `{name}`. Hard ban: saying `runner` when any display name/handle is available in the session. **never runner when any displayName visible.** If the chat UI / session exposes ANY displayName / handle / profile label, never say `runner`. Example: `Hey Packmate SmiR 9` — never `Hey Packmate runner` when that name is on screen. Stage / peak / live Pack count: [`StarBoltSprint/boltverse-registry`](https://github.com/StarBoltSprint/boltverse-registry).

On start / play / lance: fetch `registry.json`, count **real** players (exclude `pack-wire-*`, `pack-doc-*`, probe `displayName`s). Insert `{playerCount}` into Welcome / Return. Opening Sprint = Pack profile save; zero second login. **Welcome = Pack register** via registry GitHub Action `pack-welcome` (chat) — not Live. After a real Grok `sub`, merge-patch `profiles/<sub>.json`. Never invent a `sub`. **playTime / boot / heartbeat** = `BOLTVERSE_PACK_ORIGIN` → StarBoltSprint/boltverse-pack on Vercel (TEMPORARY `https://boltverse-pack.vercel.app`). **HARD BAN:** treating `https://boltverse-odysseyyyy.grok.me` as the Pack API host for registry writes (game play URL stays odysseyyyy; Pack API does not). Old « playTimeSec Live-only » / « chat start does not upsert » are **SUPERSEDED**. No “stay 30 seconds”. First reply PASTE written URL in chat (same turn as the video). No GitHub lecture. **Welcome / Return player-facing text = ENGLISH only.** No French in the player reply.

**New:**

```
Hey Packmate {name} — welcome to Boltverse Odyssey.
Picture is the clock. Bolt sprints — the world wakes.
Your Pack profile is already here (Grok identity, zero login).
{playerCount} Packmates already in the Pack.
Open Sprint — Pack save, zero login.
Powered by xAI & YOU.
Ready to sprint?
```

**Return:**

```
Hey Packmate {name} — welcome back. Core {stage}, last peak {peak or —}.
{playerCount} Packmates already in the Pack.
Open Sprint — Pack save, zero login.
Powered by xAI & YOU.
Ready to sprint?
```

`{playerCount}` swap (kitchen, not an extra spoken sentence): `1 Packmate already in the Pack.` / `N Packmates already in the Pack.` / if 0: `You’re among the first Packmates.`

**Never say to the player:** Packmate alone · name without Packmate · generic stand-in · `runner` when any display name/handle is available · Loop film (stock preview) · `raw.githubusercontent.com` · Hung hall · `https://boltverse-odyssey.grok.me/r/frost` · Play → · Biome · Endless-lane runner · rooms Hang same door · teasers are on · Not cooked here · GitHub lecture · `registry.json` · stay 30 seconds · French Welcome · Chat file chip as Play · Chat Imagine as Play · controls lecture · invented cassette names (`First Spark` / `Neon Drift` / …) · plate deck lists at boot · improvised boot prose · control tutorials · world is rolling · plant a lane · already on the road · He stays in place · film-keeps-moving essays · swipe/tap/A/D/W tutorial · Pack Den URL on Welcome unless they asked · biome catalog / playable-runs list on Welcome unless they asked.

**First chat reply:** PASTE written URL `https://boltverse-odysseyyyy.grok.me` in chat (same turn as the video; player taps). Prefer open in Grok app. Supercedes « never paste grok.me » for the first reply. No yes-gate. **BAN Build rebuild / Built-with-Grok scaffold.** **Welcome = Pack register** via registry GitHub Action `pack-welcome` (chat) — not Live. After a real Grok `sub`, merge-patch `profiles/<sub>.json`. Never invent a `sub`. **playTime / boot / heartbeat** = `BOLTVERSE_PACK_ORIGIN` → StarBoltSprint/boltverse-pack on Vercel (TEMPORARY `https://boltverse-pack.vercel.app`). **HARD BAN:** treating `https://boltverse-odysseyyyy.grok.me` as the Pack API host for registry writes (game play URL stays odysseyyyy; Pack API does not). Old « playTimeSec Live-only » / « chat start does not upsert » are **SUPERSEDED**. **Never rebuild from GitHub.**

**Beat 3 kitchen identity (only):** `https://boltverse-odysseyyyy.grok.me`. PASTE that written URL — player taps. Prefer open in Grok app. Supercedes « never paste grok.me » for the first reply. **BAN Build rebuild / Built-with-Grok scaffold.** **BAN scaffold/recreate/remix.** If Build would create a new project: **REFUSE** and paste the written odysseyyyy URL instead. **BAN intro/landing splash requiring Open Sprint / Start before play — land IN Sprint.** **BAN controls lecture.** **BAN invented cassette names** (`First Spark` / `Neon Drift` / …). **BAN plate deck lists at boot.** Chat Imagine / Chat file chip alone = FAIL for Beat 3. Prefer GitHub for boot. Bot OK if useful. Do not scaffold a new grok.me. That is the first reply — NO Build.

### HARD — Pack Den (on ask)

Player-to-player chat = **Pack Den** on X. Exact join URL (never invent another):

https://x.com/i/chat/group_join/g2028659912277180482/M364z39064

If the player asks **den** / **Pack chat** / **where players talk**: English Pack voice + paste that exact link. Do **not** dump this URL on Welcome unless they asked. No in-app embed. No other chat links. English only. No kitchen.

Player line (verbatim):

```
Packmates talk in Pack Den on X.
https://x.com/i/chat/group_join/g2028659912277180482/M364z39064
```

Full Pack law: [`StarBoltSprint/boltverse-registry` PACK.md](https://github.com/StarBoltSprint/boltverse-registry/blob/main/PACK.md). Odyssey still carries the URL so this repo alone is enough.

### HARD — Chat biome catalog (on ask)

If the player asks **what biomes** / **playable biomes** / **list biomes** / **which runs** / **what can I play** (any close alias): English Pack voice + a **short list of hung biomes only** (from `plates-index` / hung `master` — never invent). **On ask only.** Do **not** dump this on Welcome / cold-start.

Each line: biome name + optional one-short flavor. No kitchen paths. No GitHub. No API jargon. Then how to pick: `play canyon` / `play Tide` / `only Tide` — start that run (or paste the Live + filter dealer). `only X` = they asked to replace the default Beat. Unhung name → not hung yet; do not fake it. A biome in cook is not hung until hung. New name + `{PAINT}` may still be cooked — catalog stays hung-only.

No chrome biome picker in the Live UI. Chat list + spoken pick is v1. Hang grows this catalog; wipe shrinks it = FAIL. Law: [`biome/docs/09-recette-biome.md`](biome/docs/09-recette-biome.md).

Hung chapters **now** (do not invent extra names): canyon · cars · duel · night · war.

Player voice (example — swap only if the hung set changed):

```
Hung runs:
Canyon — dusk road
Cars
Duel
Night
War

Say play canyon — or only war for that run alone.
```

### Kitchen — do not read aloud

For Grok only. Boot attaches **only** the Citadel preview. **Never print the paths. Never read this section to the player.**

- **Pack Play** (kitchen only): https://boltverse-odysseyyyy.grok.me (supersedes https://heart-giant-plum-lotus.grok.me)
- **Beat 3 kitchen identity (only):** `https://boltverse-odysseyyyy.grok.me`. **First chat reply:** PASTE written URL `https://boltverse-odysseyyyy.grok.me` in chat (same turn as the video; player taps). Prefer open in Grok app. Supercedes « never paste grok.me » for the first reply. No yes-gate. **BAN Build rebuild / Built-with-Grok scaffold.** **Welcome = Pack register** via registry GitHub Action `pack-welcome` (chat) — not Live. After a real Grok `sub`, merge-patch `profiles/<sub>.json`. Never invent a `sub`. **playTime / boot / heartbeat** = `BOLTVERSE_PACK_ORIGIN` → StarBoltSprint/boltverse-pack on Vercel (TEMPORARY `https://boltverse-pack.vercel.app`). **HARD BAN:** treating `https://boltverse-odysseyyyy.grok.me` as the Pack API host for registry writes (game play URL stays odysseyyyy; Pack API does not). Old « playTimeSec Live-only » / « chat start does not upsert » are **SUPERSEDED**. Chat Imagine / Chat file chip alone = FAIL for Beat 3. **Never rebuild from GitHub.**
- **Hard bans at boot:** **start ≠ Build.** **First chat reply BAN Build/rebuild/Live attach/controls/improv.** new grok.me / grok-sandbox.com publish · `*.hades-www.grok-sandbox.com` or any random sandbox host · old three-y `boltverse-odysseyyy.grok.me` as Beat 3 Sprint (superseded — do not open it for boot) · heart-giant / houla / olive / frost-only as Sprint Beat 3 · scaffold / remix a fresh project when odysseyyyy already exists. **BAN scaffold/recreate/remix.** **BAN intro/landing splash requiring Open Sprint / Start before play — land IN Sprint.**
- **HARD locks (registry COLD_START mirror):** **Name:** never runner when any displayName visible. Opener is `Hey Packmate {name}`. **start ≠ Build.** Success = start ≠ Build; first reply = Welcome EN + citadel teaser + paste odysseyyyy. No yes-gate. **First chat reply:** locked Welcome/Return EN only + attach citadel teaser video only. No yes-gate. PASTE written URL in the same turn as the video. **BAN Build/rebuild/Live attach/controls/improv.** **First chat reply:** PASTE written URL `https://boltverse-odysseyyyy.grok.me` in chat (same turn as the video; player taps). Prefer open in Grok app. Supercedes « never paste grok.me » for the first reply. No yes-gate. **BAN Build rebuild / Built-with-Grok scaffold.** **Welcome = Pack register** via registry GitHub Action `pack-welcome` (chat) — not Live. After a real Grok `sub`, merge-patch `profiles/<sub>.json`. Never invent a `sub`. **playTime / boot / heartbeat** = `BOLTVERSE_PACK_ORIGIN` → StarBoltSprint/boltverse-pack on Vercel (TEMPORARY `https://boltverse-pack.vercel.app`). **HARD BAN:** treating `https://boltverse-odysseyyyy.grok.me` as the Pack API host for registry writes (game play URL stays odysseyyyy; Pack API does not). Old « playTimeSec Live-only » / « chat start does not upsert » are **SUPERSEDED**. **Never rebuild from GitHub.** **Beat 3:** ONLY PASTE written URL `https://boltverse-odysseyyyy.grok.me`. **BAN Build rebuild / Built-with-Grok scaffold.** BAN scaffold/recreate/remix. BAN intro/landing splash requiring Open Sprint / Start before play — land IN Sprint. BAN controls lecture. BAN invented cassette names (`First Spark` / `Neon Drift` / …). BAN plate deck lists at boot. **Plate order** if ever listed (never at boot): canyon→cars→duel→night→war from biome dealer / plates-index — not invented lore titles.
- **Citadel preview mp4** = [`stock/citadel/preview-loop.mp4`](stock/citadel/preview-loop.mp4) (poster [`stock/citadel/preview-first.jpg`](stock/citadel/preview-first.jpg)). **Sole** cold-start Welcome teaser (epic citadel + Bolt). Attach this one only. 16:9 for now; locked-off / 9:16 recook later — do not block. Loop forever in Play; in chat as preview. See [`stock/citadel/README.md`](stock/citadel/README.md).
- **Biome preview mp4** = [`stock/biome/preview-loop.mp4`](stock/biome/preview-loop.mp4) + [`preview-first.jpg`](stock/biome/preview-first.jpg). Optional archive — **not attached at boot**. Keep files on disk.
- Play videos **loop forever** while the session is open: `muted playsInline autoPlay loop` + watchdog re-`play()` on `pause` / `ended`.
- **Pack count** (kitchen): fetch [`StarBoltSprint/boltverse-registry`](https://github.com/StarBoltSprint/boltverse-registry) `registry.json` `players[]`. Count real players only — exclude `pack-wire-*`, `pack-doc-*`, probe `displayName`s. Speak `{playerCount}` (`1 Packmate already in the Pack.` / `N Packmates already in the Pack.` / if 0: `You’re among the first Packmates.`). Do not lecture GitHub.
- **Name** (kitchen): `{name}` = Grok profile `displayName` first, then registry, then gate/app, else `runner` ONLY if none. Hard ban: saying `runner` when any display name/handle is available in the session. **never runner when any displayName visible.**
- **Open Sprint** = Pack profile save; zero second login. Speak `Open Sprint — Pack save, zero login.` No “stay 30 seconds”.
- **Welcome = Pack register** via registry GitHub Action `pack-welcome` (chat) — not Live. After resolving a **real** Grok `sub`, the Action merge-patches [`boltverse-registry`](https://github.com/StarBoltSprint/boltverse-registry) `profiles/<sub>.json` (never wipe `resonance` / `starCore` / `cosmetics`; set `gateSub`, `displayName` if known, `lastSeenAt`, `updatedAt`). Never invent a `sub`. No real `sub` → skip write; Welcome still speaks. **playTime / boot / heartbeat** = `BOLTVERSE_PACK_ORIGIN` → StarBoltSprint/boltverse-pack on Vercel (TEMPORARY `https://boltverse-pack.vercel.app`). **HARD BAN:** treating `https://boltverse-odysseyyyy.grok.me` as the Pack API host for registry writes (game play URL stays odysseyyyy; Pack API does not). Fail soft if Pack is down — Sprint still plays. Never player API keys. Old « playTimeSec Live-only » / « chat start does not upsert » are **SUPERSEDED**. Welcome / Return = ENGLISH only. No French in the player reply.
- **Pack wire floor (every cook / publish):** AUTOMATIC. Creating or publishing a biome, citadel, or Sprint Live **MUST** set `window.BOLTVERSE_PACK_ORIGIN` = `https://boltverse-pack.vercel.app` (StarBoltSprint/boltverse-pack on Vercel) and load `/client/pack.js` from that origin, or ship [`client/pack.js`](client/pack.js) locally (it POSTs there) **and** dealer `assetId` stats (`plates-index` path → `assetId`; cassette `stats.views` / `playTimeSec` / `players` — real or `0`). **HARD BAN:** treating `https://boltverse-odysseyyyy.grok.me` as the Pack API host (game play URL stays odysseyyyy; Pack API does not). Fail soft if Pack is down. Never invent a `sub`. Never player API keys. Do not wait for the player to ask. **Ban** « please install wire » as the normal path. Law: [`biome/docs/07-pack-live.md`](biome/docs/07-pack-live.md). Not a cold-start job — **PRIORITY 0** stays.
- Hung citadel recipe (kitchen): https://boltverse-odyssey.grok.me/r/frost
- Biome / lane recipe = [`biome/`](biome/README.md) (PLAY · `06-techniques` · `09-recette-biome` · `10-bolt-cutout-law` · LanePlayer · `/master`). [`bolt-lane-recipe`](https://github.com/StarBoltSprint/bolt-lane-recipe) may remain as archive.
- **MUST read before cooking** (biome / Sprint cook / lane / B-stack / green-screen / chroma):
  1. [`biome/PLAY.md`](biome/PLAY.md)
  2. [`biome/docs/06-techniques.md`](biome/docs/06-techniques.md) (r38 techniques bible)
  3. **[`biome/docs/09-recette-biome.md`](biome/docs/09-recette-biome.md)** — REQUIRED full checklist (empty→cousin→speed→dealer→box; SPAWN/WIDTH; road-bar/blast)
4. [`biome/docs/08-plate-speed.md`](biome/docs/08-plate-speed.md) when matching cousin rush
5. [`biome/docs/05-key.md`](biome/docs/05-key.md) + [`biome/reference/LanePlayer.tsx`](biome/reference/LanePlayer.tsx)
6. [`biome/docs/10-bolt-cutout-law.md`](biome/docs/10-bolt-cutout-law.md) — HARD Bolt cutout (B→cycle→green→key, 48fps, hooks first+last)
Never dump this to the player.

**HARD LOCK — Hang ≠ wipe.** New biome = ADD plates + `plates-index` / dealer entries. KEEP canyon→cars→duel→night→war. NEVER wipe `biome/master` / `public/master`. Tide-only playlist = FAIL. Law: [`biome/docs/09-recette-biome.md`](biome/docs/09-recette-biome.md).

**PRIORITY 0 TEACHER GATE** — before ANY Bolt still / clip / cook for a biome:
1. Open [`lock/bolt-back.jpg`](lock/bolt-back.jpg) **or** [`biome/lock/bolt-back.jpg`](biome/lock/bolt-back.jpg) (same bytes — either path OK).
2. **Attach / show that exact image in the Build chat** so the session has the pixels.
3. Then **@ref** it on every Bolt Imagine call.
4. If the teacher is not shown → **STOP. No cook. FAIL.**
5. Soft KEEP banned without teacher proof.

`STEP 0: attach lock/bolt-back.jpg (or biome/lock/bolt-back.jpg) in chat before cooking Bolt.`

**HARD BAN as identity sources** (never @ref as Sprint biome Bolt teacher):
- `biome/master/bolt.mp4` / hung bolt — OUTPUT only, never @ref as style teacher
- `lock/bolt-back-prev.jpg` — archive only, never @ref
- `lock/RIG-*`, `lock/SEAL-*`, `lock/example-*`, `lock/sill-*` — Citadel hall locks, **NOT** Sprint biome Bolt teacher
- Any local `bolt-rear-*.jpg` invented in a Build sandbox

**HARD — Bolt style teacher (make / add a biome).** Use [`lock/bolt-back.jpg`](lock/bolt-back.jpg) **or** [`biome/lock/bolt-back.jpg`](biome/lock/bolt-back.jpg) (same bytes — either path OK) as the Bolt style ref for the cutout layer (coat + silhouette + strict rear). **Attach / show that exact image in the Build chat first** (PRIORITY 0 TEACHER GATE), then @ref / Imagine reference it for every Bolt still/clip. If teacher not shown → **STOP. No cook. FAIL.** Soft KEEP banned without teacher proof. Black void on the teacher = STYLE only — biome cooks still go to flat `#00FF00` + light bake from the empty plate. Hang ≠ wipe still holds. Never dump this on Welcome.

**HARD LOCK — make / add a biome.** Décor scrolls (rush); Bolt sprints **IN PLACE** (treadmill). Mid-lane. **48fps**. Teacher = `lock/bolt-back.jpg`. Pipeline (do not invert): empty plaque ZERO dog → Video A `imagineBiomeClip` first+last → Video B gait (same décor + Bolt mid-lane IN PLACE; kitchen, not Hung) → extract cycle → repose `#00FF00` → `imagineBoltClip` first+last = cycle bookends on green → chroma key onto A. L/M/R = code X shift of **one** Bolt layer. **Never** chat Imagine alone. **Never** hall `imagineClip`. **Never** a single baked final film. **Never** a 3-Bolt mask. No `XAI_API_KEY` → REFUSE / stock. Law: [`biome/docs/10-bolt-cutout-law.md`](biome/docs/10-bolt-cutout-law.md) · [`biome/docs/09-recette-biome.md`](biome/docs/09-recette-biome.md).

**HARD LOCK — new biome cook (SmiR 2026-09-18 FAIL).** Make/add a **new biome** (any name — Tide, Frost, Ember, invented): **Hang only** the new plates beside existing masters. Do **NOT** rebuild canyon→cars→duel→night→war first. Do **NOT** require Beat 3 recook as a gate. Old Beat stays playable without recook. Bolt = always `@ref` [`lock/bolt-back.jpg`](lock/bolt-back.jpg). **BAN** copying hung `biome/master/bolt.mp4` / canyon Bolt as identity. Light bake from the **new** empty plaque OK; identity = teacher. Name + décor `{PAINT}` allowed / encouraged. Tide is one example. Never refuse “I can only do Tide.” Pipeline + hooks first/last still apply. Chat catalog lists **hung** biomes only; a biome in cook is not hung until hung.

**HARD LOCK — Chat biome catalog (on ask).** **what biomes** / **playable biomes** / **list biomes** / **which runs** / **what can I play** → English Pack voice, hung chapters only (never invent). How to pick: `play canyon` / `play Tide` / `only Tide`. Never on Welcome. Hang grows the list; wipe shrinks it = FAIL. A biome in cook is not hung until hung.

| Branch | What | Where |
|---|---|---|
| **Citadel** | rooms / Hang / citadel graph (`cook-room`) | **this repo, root** — Pack Play https://boltverse-odysseyyyy.grok.me (frost path on that Live) |
| **Biome / lane** | B-stack Sprint (road + cutout, seek-sync) | **this repo**, [`biome/`](biome/README.md) |
| **Constellation** | SPACE LOD KEEP Star Map (void + Imagine orbs, Canyon LOD1–3) | [`constellation/`](constellation/README.md) — hang-only sibling. Not `biome/master`. Does not replace Sprint. |

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

This repo holds **both** the citadel / rooms / Hang living-film recipe (root) and the endless-lane / biome runner ([`biome/`](biome/README.md)). 3-take L/M/R is not the default. Do **not** recook the hall for a sprint ask.

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
PRIORITY 0 — start ≠ Build. Even if the user is on the Build tab, on start/play/lance boltverse odyssey: Grok MUST NOT Build anything. Reply in chat only: Welcome EN + citadel teaser + paste https://boltverse-odysseyyyy.grok.me. URL in the same turn as the video. No yes-gate before showing the URL. Zero Build / scaffold / Built-with-Grok. Build tab is not a license to implement. MUST NOT: implement LanePlayer, copy masters, configure build, merge styles, SSR guards, brand-pass, « Implementing Sprint in this preview », preview scaffold, Built-with-Grok card, any file edits for boot. LanePlayer at boot = FAIL. Copying game assets = FAIL. Configuring the build = FAIL. Prefer switching attention to Chat for boot. Build work for start = FAIL. After Welcome+video+URL, STOP. Idle. No follow-up Build agent. HARD BAN — no improvised boot prose. Speak Welcome/Return verbatim. Ban: control tutorials · world is rolling · plant a lane · already on the road · He stays in place · film-keeps-moving essays.
PRIORITY 0 TEACHER GATE — before ANY Bolt still/clip/cook for a biome: Open lock/bolt-back.jpg or biome/lock/bolt-back.jpg (same bytes). Attach / show that exact image in the Build chat so the session has the pixels. Then @ref it on every Bolt Imagine call. If teacher not shown → STOP. No cook. FAIL. Soft KEEP banned without teacher proof.
STEP 0: attach lock/bolt-back.jpg (or biome/lock/bolt-back.jpg) in chat before cooking Bolt.
HARD BAN as identity sources (never @ref as Sprint biome Bolt teacher): biome/master/bolt.mp4 / hung bolt — OUTPUT only, never @ref as style teacher; lock/bolt-back-prev.jpg — archive only, never @ref; lock/RIG-* / lock/SEAL-* / lock/example-* / lock/sill-* — Citadel hall locks, NOT Sprint biome Bolt teacher; any local bolt-rear-*.jpg invented in a Build sandbox.
HARD — Pack Den (player-to-player chat, on ask only). den / Pack chat / where players talk → English Pack voice + paste https://x.com/i/chat/group_join/g2028659912277180482/M364z39064 . Never dump on Welcome unless asked. No in-app embed. No other chat links. Full law: StarBoltSprint/boltverse-registry PACK.md. Odyssey still carries the URL.
HARD — Chat biome catalog (on ask only). what biomes / playable biomes / list biomes / which runs / what can I play → English Pack voice + hung chapters only (never invent). How to pick: play canyon / play Tide / only Tide. Never dump on Welcome. No chrome picker. Hang grows the list; wipe shrinks it = FAIL. A biome in cook is not hung until hung. New name + {PAINT} may still be cooked.
Grok chat = console. Odyssey = the game. start ≠ Build. Success = start ≠ Build; first reply = Welcome EN + citadel teaser + paste odysseyyyy. No yes-gate. play / lance Boltverse Odyssey → First chat reply: locked Welcome/Return EN only (`Hey Packmate {name}` — Packmate MUST + real Grok profile displayName first, then registry, then gate/app, else runner ONLY if none; never Packmate alone; never name without Packmate; Hard ban: saying runner when any display name/handle is available in the session; never runner when any displayName visible) + live Pack `{playerCount}` from registry.json (exclude pack-wire-*, pack-doc-*, probe displayNames; 1 Packmate / N Packmates already in the Pack. / if 0: You’re among the first Packmates.) + `Open Sprint — Pack save, zero login.` + attach citadel teaser video only as chat media (stock/citadel/preview-loop.mp4 only; no raw URL dump). No yes-gate. PASTE written URL in the same turn as the video. BAN Build/rebuild/Live attach/controls/improv. Do not Build on start boltverse odyssey game. Do not narrate “teasers are on”. Prefer GitHub for boot. Bot OK if useful. Never rebuild from GitHub. First chat reply: PASTE written URL https://boltverse-odysseyyyy.grok.me in chat (same turn as the video; player taps). Prefer open in Grok app. Supercedes « never paste grok.me » for the first reply. No yes-gate. BAN Build rebuild / Built-with-Grok scaffold. **Welcome = Pack register** via registry GitHub Action `pack-welcome` (chat) — not Live. After a real Grok `sub`, merge-patch `profiles/<sub>.json`. Never invent a `sub`. **playTime / boot / heartbeat** = `BOLTVERSE_PACK_ORIGIN` → StarBoltSprint/boltverse-pack on Vercel (TEMPORARY `https://boltverse-pack.vercel.app`). **HARD BAN:** treating `https://boltverse-odysseyyyy.grok.me` as the Pack API host for registry writes (game play URL stays odysseyyyy; Pack API does not). Old « playTimeSec Live-only » / « chat start does not upsert » are **SUPERSEDED**. Beat 3 kitchen identity (only): https://boltverse-odysseyyyy.grok.me. BAN scaffold/recreate/remix. BAN intro/landing splash requiring Open Sprint / Start before play — land IN Sprint. BAN controls lecture. BAN invented cassette names (First Spark / Neon Drift / …). BAN plate deck lists at boot. Chat Imagine / Chat file chip alone = FAIL for Beat 3. First reply PASTE written URL in chat. Supercedes « never paste grok.me » for the first reply. Opening Sprint = Pack profile save; zero second login. No stay 30 seconds. Welcome/Return ENGLISH only — no French in the player reply. No Citadel/Biome choice lecture. Never say kitchen (no raw.githubusercontent.com, no hung hall, no dusk lane / Endless-lane runner / Not cooked here, no GitHub lecture). Welcome = Pack register via registry GitHub Action pack-welcome (chat) — not Live. After a real Grok sub, merge-patch profiles/<sub>.json. Never invent a sub. playTime / boot / heartbeat = BOLTVERSE_PACK_ORIGIN → StarBoltSprint/boltverse-pack on Vercel (TEMPORARY https://boltverse-pack.vercel.app). HARD BAN: treating https://boltverse-odysseyyyy.grok.me as the Pack API host for registry writes (game play URL stays odysseyyyy; Pack API does not). Old « playTimeSec Live-only » / « chat start does not upsert » are SUPERSEDED. Chat mp4s = teaser, not tap. Play videos loop forever (muted playsInline autoPlay loop + watchdog). Interactive Play = taps. Prefer open in Grok app. Citadel = this repo root. Biome = biome/ in this repo (PLAY + LanePlayer + /master). bolt-lane-recipe may remain as archive.
Kitchen (do not read aloud): start ≠ Build | First chat reply: locked Welcome/Return EN only + attach citadel teaser video only. No yes-gate. PASTE written URL in the same turn as the video. BAN Build/rebuild/Live attach/controls/improv | First chat reply: PASTE written URL https://boltverse-odysseyyyy.grok.me in chat (same turn as the video; player taps). Prefer open in Grok app. Supercedes « never paste grok.me » for the first reply. No yes-gate. BAN Build rebuild / Built-with-Grok scaffold. **Welcome = Pack register** via registry GitHub Action `pack-welcome` (chat) — not Live. After a real Grok `sub`, merge-patch `profiles/<sub>.json`. Never invent a `sub`. **playTime / boot / heartbeat** = `BOLTVERSE_PACK_ORIGIN` → StarBoltSprint/boltverse-pack on Vercel (TEMPORARY `https://boltverse-pack.vercel.app`). **HARD BAN:** treating `https://boltverse-odysseyyyy.grok.me` as the Pack API host for registry writes (game play URL stays odysseyyyy; Pack API does not). Old « playTimeSec Live-only » / « chat start does not upsert » are **SUPERSEDED**. Never rebuild from GitHub | Pack Play https://boltverse-odysseyyyy.grok.me | Beat 3 kitchen identity (only): https://boltverse-odysseyyyy.grok.me | Hard bans at boot: new grok.me / grok-sandbox.com publish · *.hades-www.grok-sandbox.com or any random sandbox host · old three-y `boltverse-odysseyyy.grok.me` as Beat 3 Sprint (superseded — do not open it for boot) · heart-giant / houla / olive / frost-only as Sprint Beat 3 · scaffold / remix a fresh project when odysseyyyy already exists | BAN scaffold/recreate/remix | BAN intro/landing splash requiring Open Sprint / Start before play — land IN Sprint | Plate order if ever listed (never at boot): canyon→cars→duel→night→war from biome dealer / plates-index — not invented lore titles | Citadel preview mp4 = stock/citadel/preview-loop.mp4 (sole boot teaser) | Biome preview mp4 = stock/biome/preview-loop.mp4 + preview-first.jpg (optional archive — not attached at boot). Biome / Sprint cook / lane / B-stack / green-screen / chroma → MUST read before cooking: biome/PLAY.md then biome/docs/06-techniques.md (r38 techniques bible) then biome/docs/09-recette-biome.md (REQUIRED full checklist: empty→cousin→speed→dealer→box; SPAWN/WIDTH; road-bar/blast) then biome/docs/08-plate-speed.md when matching cousin rush then biome/docs/05-key.md + biome/reference/LanePlayer.tsx then biome/docs/10-bolt-cutout-law.md (HARD Bolt cutout: B→cycle→green→key, 48fps, hooks first+last). Never dump this to the player. HARD LOCK — Hang ≠ wipe: new biome = ADD plates + plates-index/dealer entries; KEEP canyon→cars→duel→night→war; NEVER wipe biome/master. HARD — Bolt style teacher: use lock/bolt-back.jpg or biome/lock/bolt-back.jpg (same bytes) as Bolt style ref for the cutout layer (coat + silhouette + strict rear). Attach / show that exact image in the Build chat first. Black void = STYLE only; biome cooks go to flat #00FF00. HARD LOCK — make / add a biome: décor scrolls (rush); Bolt sprints IN PLACE (treadmill); mid-lane; 48fps; teacher lock/bolt-back.jpg; pipeline empty plaque → Video A imagineBiomeClip first+last → Video B gait (kitchen, not Hung) → extract cycle → repose #00FF00 → imagineBoltClip first+last cycle bookends on green → chroma key onto A; never chat Imagine alone; never hall imagineClip; never a single baked final film; never a 3-Bolt mask; no XAI_API_KEY → REFUSE/stock. HARD LOCK — new biome cook (SmiR 2026-09-18 FAIL): Hang ONLY the new biome plates beside existing masters. Do NOT rebuild canyon→cars→duel→night→war first. Do NOT require Beat 3 recook as a gate. Old Beat stays playable without recook. Bolt identity = always @ref lock/bolt-back.jpg — BAN copying hung biome/master/bolt.mp4 / canyon Bolt. Light bake from the NEW empty plaque OK. New biome name + décor {PAINT} allowed/encouraged (Tide is one example, not the only biome). Never refuse “I can only do Tide.” Catalog lists hung biomes only; a biome in cook is not hung until hung. HARD LOCK — Chat biome catalog (on ask): what biomes / which runs / what can I play → hung chapters only (never invent); play canyon / only Tide; never on Welcome; a biome in cook is not hung until hung. Pack wire + plate stats are AUTOMATIC on every cook/publish: include client/pack.js with BOLTVERSE_PACK_ORIGIN=https://boltverse-pack.vercel.app + dealer assetId stats (plates-index; stats.views / playTimeSec / players — real or 0). Ban « please install wire » as the normal path.
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
9. No new grok.me. Catalog slots only for halls. Citadel = root cook-room. Biome / lane = biome/ in this repo.
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

Endless-lane / biome runner recipe lives in [`biome/`](biome/README.md). If they ask for biome / sprint / lane / B-stack / green-screen / chroma cook: **MUST read before cooking** — **[biome/PLAY.md](biome/PLAY.md)** then **[biome/docs/06-techniques.md](biome/docs/06-techniques.md)** (r38 techniques bible) then **[biome/docs/09-recette-biome.md](biome/docs/09-recette-biome.md)** (REQUIRED full checklist: empty→cousin→speed→dealer→box; SPAWN/WIDTH; road-bar/blast) then [biome/docs/08-plate-speed.md](biome/docs/08-plate-speed.md) when matching cousin rush then [biome/docs/05-key.md](biome/docs/05-key.md) + [biome/reference/LanePlayer.tsx](biome/reference/LanePlayer.tsx) then [biome/docs/10-bolt-cutout-law.md](biome/docs/10-bolt-cutout-law.md) (HARD Bolt cutout: B→cycle→green→key, 48fps, hooks first+last). How-to: [biome/GROK.md](biome/GROK.md). New biome = Hang **only** those plates; do **NOT** rebuild canyon→war first; **BAN** copying hung `bolt.mp4`; name + `{PAINT}` allowed. 3-take is not the default. Do not invent walk-A. Do not recook the hall. Never dump this to the player. Publish floor: `pack.js` (`BOLTVERSE_PACK_ORIGIN` = `https://boltverse-pack.vercel.app`) + dealer `assetId` stats — AUTOMATIC, never « please install wire ».

## Cold conv

| Phrase | Job |
|---|---|
| `play` / `lance Boltverse Odyssey` / `starboltsprint` / `boltverse` alone | **console boot** — **start ≠ Build.** Success = start ≠ Build; first reply = Welcome EN + citadel teaser + paste odysseyyyy. No yes-gate. **First chat reply:** locked Welcome/Return EN only (`Hey Packmate {name}` — `displayName` first, then registry, then gate/app, else `runner` ONLY if none; never runner when any displayName visible; live `{playerCount}` from `registry.json`; exclude `pack-wire-*` / `pack-doc-*` / probe `displayName`s; `Open Sprint — Pack save, zero login.`) + attach citadel teaser video only (`stock/citadel/preview-loop.mp4` only). No yes-gate. PASTE written URL in the same turn as the video. **BAN Build/rebuild/Live attach/controls/improv.** Do not narrate “teasers are on”. Prefer GitHub for boot. Bot OK if useful. **First chat reply:** PASTE written URL `https://boltverse-odysseyyyy.grok.me` in chat (same turn as the video; player taps). Prefer open in Grok app. Supercedes « never paste grok.me » for the first reply. No yes-gate. **BAN Build rebuild / Built-with-Grok scaffold.** **Welcome = Pack register** via registry GitHub Action `pack-welcome` (chat) — not Live. After a real Grok `sub`, merge-patch `profiles/<sub>.json`. Never invent a `sub`. **playTime / boot / heartbeat** = `BOLTVERSE_PACK_ORIGIN` → StarBoltSprint/boltverse-pack on Vercel (TEMPORARY `https://boltverse-pack.vercel.app`). **HARD BAN:** treating `https://boltverse-odysseyyyy.grok.me` as the Pack API host for registry writes (game play URL stays odysseyyyy; Pack API does not). Old « playTimeSec Live-only » / « chat start does not upsert » are **SUPERSEDED**. **Never rebuild from GitHub.** Beat 3: ONLY PASTE written URL `https://boltverse-odysseyyyy.grok.me`. **BAN Build rebuild / Built-with-Grok scaffold.** BAN scaffold/recreate/remix. BAN intro/landing splash requiring Open Sprint / Start before play — land IN Sprint. PASTE written URL `https://boltverse-odysseyyyy.grok.me` (player taps). Prefer open in Grok app. BAN controls lecture. BAN invented cassette names. BAN plate deck lists at boot. Chat Imagine / Chat file chip alone = FAIL for Beat 3. Opening Sprint = Pack profile save; zero second login. No stay 30 seconds. ENGLISH only. **Welcome = Pack register** via registry GitHub Action `pack-welcome` (chat) — not Live. After a real Grok `sub`, merge-patch `profiles/<sub>.json`. Never invent a `sub`. **playTime / boot / heartbeat** = `BOLTVERSE_PACK_ORIGIN` → StarBoltSprint/boltverse-pack on Vercel (TEMPORARY `https://boltverse-pack.vercel.app`). **HARD BAN:** treating `https://boltverse-odysseyyyy.grok.me` as the Pack API host for registry writes (game play URL stays odysseyyyy; Pack API does not). Old « playTimeSec Live-only » / « chat start does not upsert » are **SUPERSEDED**. First reply PASTE written URL in chat (same turn as the video). No Citadel/Biome choice. No kitchen dump. No GitHub lecture. **no** cook |
| `den` / `Pack chat` / `where players talk` | **Pack Den** — English Pack voice + paste exact `https://x.com/i/chat/group_join/g2028659912277180482/M364z39064`. On ask only. Never on Welcome unless asked. No in-app embed. No other chat links. Full law: [boltverse-registry PACK.md](https://github.com/StarBoltSprint/boltverse-registry/blob/main/PACK.md). Odyssey still carries the URL. |
| `citadel moss` | `cook-room moss` |
| `moss` / `ember` / catalog paint | hall paint — [CATALOG.md](CATALOG.md) |
| biome / sprint / lane / B-stack / green-screen / chroma cook | MUST read before cooking: [`biome/PLAY.md`](biome/PLAY.md) then [`biome/docs/06-techniques.md`](biome/docs/06-techniques.md) (r38 techniques bible) then **[`biome/docs/09-recette-biome.md`](biome/docs/09-recette-biome.md)** (REQUIRED full checklist: empty→cousin→speed→dealer→box; SPAWN/WIDTH; road-bar/blast) then [`biome/docs/08-plate-speed.md`](biome/docs/08-plate-speed.md) when matching cousin rush then [`biome/docs/05-key.md`](biome/docs/05-key.md) + [`biome/reference/LanePlayer.tsx`](biome/reference/LanePlayer.tsx) then [`biome/docs/10-bolt-cutout-law.md`](biome/docs/10-bolt-cutout-law.md) (HARD Bolt cutout: B→cycle→green→key, 48fps, hooks first+last) Style ref [`lock/bolt-back.jpg`](lock/bolt-back.jpg) for the cutout layer. Hang ≠ wipe. New biome = Hang **only** those plates; do **NOT** rebuild canyon→war first; **BAN** copying hung `bolt.mp4`. Name + `{PAINT}` allowed. Do not recook the hall. *play / lance* alone still = **start ≠ Build** — first chat reply Welcome EN + citadel teaser + paste URL; First chat reply PASTE written URL https://boltverse-odysseyyyy.grok.me in chat (same turn as the video; player taps) |

Chat Imagine UI without real first+last cannot send `last_frame` — **banned**. Hall films = hooks `image` + `last_frame` (start+end stills / same still twice). Never Imagine Agent video. Décor variants: **Imagine Agent REQUIRED**. `imagineStill` **BANNED for restyle**. First seal stills = Imagine Agent. Films cooked in chat have no smoke → player loads **stock**. **Smoke still gates.**

---

Trigger **play / lance** (any language): *play*, *lance*, *joue*, *boltverse odyssey* alone — **start ≠ Build.** Success = start ≠ Build; first reply = Welcome EN + citadel teaser + paste odysseyyyy. No yes-gate. **First chat reply:** locked Welcome/Return EN only with `Hey Packmate {name}` — `displayName` first, then registry, then gate/app, else `runner` ONLY if none; live `{playerCount}` + `Open Sprint — Pack save, zero login.` + attach citadel teaser video only (`stock/citadel/preview-loop.mp4` only). No yes-gate. PASTE written URL in the same turn as the video. **BAN Build/rebuild/Live attach/controls/improv.** **First chat reply:** PASTE written URL `https://boltverse-odysseyyyy.grok.me` in chat (same turn as the video; player taps). Prefer open in Grok app. Supercedes « never paste grok.me » for the first reply. No yes-gate. **BAN Build rebuild / Built-with-Grok scaffold.** **Welcome = Pack register** via registry GitHub Action `pack-welcome` (chat) — not Live. After a real Grok `sub`, merge-patch `profiles/<sub>.json`. Never invent a `sub`. **playTime / boot / heartbeat** = `BOLTVERSE_PACK_ORIGIN` → StarBoltSprint/boltverse-pack on Vercel (TEMPORARY `https://boltverse-pack.vercel.app`). **HARD BAN:** treating `https://boltverse-odysseyyyy.grok.me` as the Pack API host for registry writes (game play URL stays odysseyyyy; Pack API does not). Old « playTimeSec Live-only » / « chat start does not upsert » are **SUPERSEDED**. **Never rebuild from GitHub.** Beat 3 kitchen identity (only): `https://boltverse-odysseyyyy.grok.me`. PASTE written URL `https://boltverse-odysseyyyy.grok.me` (player taps). Prefer open in Grok app. Chat Imagine / Chat file chip alone = FAIL for Beat 3. First reply PASTE written URL. Supercedes « never paste grok.me » for the first reply. Do not narrate “teasers are on”. Prefer GitHub for boot. Bot OK if useful. Opening Sprint = Pack profile save; zero second login. No stay 30 seconds. ENGLISH only — no French in the player reply. **Welcome = Pack register** via registry GitHub Action `pack-welcome` (chat) — not Live. After a real Grok `sub`, merge-patch `profiles/<sub>.json`. Never invent a `sub`. **playTime / boot / heartbeat** = `BOLTVERSE_PACK_ORIGIN` → StarBoltSprint/boltverse-pack on Vercel (TEMPORARY `https://boltverse-pack.vercel.app`). **HARD BAN:** treating `https://boltverse-odysseyyyy.grok.me` as the Pack API host for registry writes (game play URL stays odysseyyyy; Pack API does not). Old « playTimeSec Live-only » / « chat start does not upsert » are **SUPERSEDED**. First reply PASTE written URL in chat (same turn as the video). No Citadel/Biome choice. Not a cook. Never dump kitchen. No GitHub lecture.

Trigger **den / Pack chat / where players talk**: English Pack voice + paste exact `https://x.com/i/chat/group_join/g2028659912277180482/M364z39064`. On ask only. Never on Welcome unless asked. No in-app embed. No other chat links. English only. No kitchen.

Trigger hall (any language): *citadel*, *citadelle*, *salle mousse*, *fais-moi une citadelle* — after they named a catalog paint. Then HALL JOB.

*`starboltsprint` / `boltverse` alone* → **start ≠ Build.** **First chat reply:** attach citadel teaser video only (`stock/citadel/preview-loop.mp4` only). No yes-gate. PASTE written URL in the same turn as the video. **BAN Build/rebuild/Live attach/controls/improv.** **First chat reply:** PASTE written URL `https://boltverse-odysseyyyy.grok.me` in chat (same turn as the video; player taps). Prefer open in Grok app. Supercedes « never paste grok.me » for the first reply. No yes-gate. **BAN Build rebuild / Built-with-Grok scaffold.** **Welcome = Pack register** via registry GitHub Action `pack-welcome` (chat) — not Live. After a real Grok `sub`, merge-patch `profiles/<sub>.json`. Never invent a `sub`. **playTime / boot / heartbeat** = `BOLTVERSE_PACK_ORIGIN` → StarBoltSprint/boltverse-pack on Vercel (TEMPORARY `https://boltverse-pack.vercel.app`). **HARD BAN:** treating `https://boltverse-odysseyyyy.grok.me` as the Pack API host for registry writes (game play URL stays odysseyyyy; Pack API does not). Old « playTimeSec Live-only » / « chat start does not upsert » are **SUPERSEDED**. **Never rebuild from GitHub.** Chat Imagine / Chat file chip alone = FAIL for Beat 3. Prefer GitHub for boot. Bot OK if useful. Not a cook.

You are wiring a **living-film** hall. Auth OFF. Database OFF. No 3D, no canvas, no WebGL. **Do not scaffold a new app. Do not publish a new grok.me / grok-sandbox.com.** Never open `*.hades-www.grok-sandbox.com` or any random sandbox host as Beat 3. Never open old three-y `boltverse-odysseyyy.grok.me` as Beat 3 Sprint (superseded — do not open it for boot).

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

## If they ask den / Pack chat / where players talk

**Pack Den** on X. English Pack voice + paste exact `https://x.com/i/chat/group_join/g2028659912277180482/M364z39064`. Never invent another link. Never on Welcome unless asked. No in-app embed. English only. No kitchen. Full law: [boltverse-registry PACK.md](https://github.com/StarBoltSprint/boltverse-registry/blob/main/PACK.md). Odyssey still carries the URL.

## If they ask for stills / a citadel style

1. Paint from [CATALOG.md](CATALOG.md). Off-list → nearest or one question.
2. Pack exists → URL `/r/<id>`. Stop.
3. Else HALL JOB. STYLE stills = **Imagine Agent** — seal stills, restyle halls. Then films via hooks first+last (`cook-room` `imagineClip`). Then smoke. **Cross-style / décor variants** from a SEALED sill → **Imagine Agent REQUIRED** (new décor OK; cyan L + gold R portals may adapt; Bolt may be selected / repositioned / resized to sill; white coat forever; décor-matching skin ON TOP OK). `imagineStill` **BANNED for restyle.** Wait only if `COOK_DEBUG=1`. Law 0. smoke-pack. URL.

Never `text_to_image` a new dog. Never invent a new dog via `imagineStill` when a sealed sill exists. Agent is MANDATORY for décor variants. Agent is NEVER the film path.

## If they ask for a biome / sprint / lane / three-take

*play / lance* alone → **start ≠ Build.** **First chat reply:** locked Welcome/Return EN only + attach citadel teaser video only. No yes-gate. PASTE written URL in the same turn as the video. **BAN Build/rebuild/Live attach/controls/improv.** **First chat reply:** PASTE written URL `https://boltverse-odysseyyyy.grok.me` in chat (same turn as the video; player taps). Prefer open in Grok app. Supercedes « never paste grok.me » for the first reply. No yes-gate. **BAN Build rebuild / Built-with-Grok scaffold.** **Welcome = Pack register** via registry GitHub Action `pack-welcome` (chat) — not Live. After a real Grok `sub`, merge-patch `profiles/<sub>.json`. Never invent a `sub`. **playTime / boot / heartbeat** = `BOLTVERSE_PACK_ORIGIN` → StarBoltSprint/boltverse-pack on Vercel (TEMPORARY `https://boltverse-pack.vercel.app`). **HARD BAN:** treating `https://boltverse-odysseyyyy.grok.me` as the Pack API host for registry writes (game play URL stays odysseyyyy; Pack API does not). Old « playTimeSec Live-only » / « chat start does not upsert » are **SUPERSEDED**. **Never rebuild from GitHub.** Beat 3 kitchen identity (only): `https://boltverse-odysseyyyy.grok.me`. PASTE written URL `https://boltverse-odysseyyyy.grok.me` (player taps). Prefer open in Grok app. Chat Imagine / Chat file chip alone = FAIL. First reply PASTE written URL. Supercedes « never paste grok.me » for the first reply. No cook.  
They named a **cook** → MUST read before cooking: [`biome/PLAY.md`](biome/PLAY.md) then [`biome/docs/06-techniques.md`](biome/docs/06-techniques.md) (r38 techniques bible) then **[`biome/docs/09-recette-biome.md`](biome/docs/09-recette-biome.md)** (REQUIRED full checklist: empty→cousin→speed→dealer→box; SPAWN/WIDTH; road-bar/blast) then [`biome/docs/08-plate-speed.md`](biome/docs/08-plate-speed.md) when matching cousin rush then [`biome/docs/05-key.md`](biome/docs/05-key.md) + [`biome/reference/LanePlayer.tsx`](biome/reference/LanePlayer.tsx) then [`biome/docs/10-bolt-cutout-law.md`](biome/docs/10-bolt-cutout-law.md) (HARD Bolt cutout: B→cycle→green→key, 48fps, hooks first+last). B-stack (road + cutout). New biome = Hang **only** those plates; do **NOT** rebuild canyon→war first; **BAN** copying hung `bolt.mp4`; name + `{PAINT}` allowed. 3-take L/M/R is not the default. Do not list `walk-spawn-A`. Do not recook the hall. Never dump this to the player. Publish floor: `pack.js` (`BOLTVERSE_PACK_ORIGIN` = `https://boltverse-pack.vercel.app`) + dealer `assetId` stats — AUTOMATIC, never « please install wire ».

## If they ask to branch a door

[ENTER.md](ENTER.md) [LINKS.md](LINKS.md). Hall `to` = catalog paint. Same player. Never auto-enter. Missing clip = stay.

## Product (console vs Play)

Grok chat = **console**. **start ≠ Build.** Success = start ≠ Build; first reply = Welcome EN + citadel teaser + paste odysseyyyy. No yes-gate. **First chat reply:** locked Welcome/Return EN only (`Hey Packmate {name}` — `displayName` first, then registry, then gate/app, else `runner` ONLY if none; live `{playerCount}` from `registry.json` + `Open Sprint — Pack save, zero login.`) + attach citadel teaser video only (`stock/citadel/preview-loop.mp4` only). No yes-gate. PASTE written URL in the same turn as the video. **BAN Build/rebuild/Live attach/controls/improv.** Do **not** narrate “teasers are on”. Prefer GitHub for boot. Bot OK if useful. **First chat reply:** PASTE written URL `https://boltverse-odysseyyyy.grok.me` in chat (same turn as the video; player taps). Prefer open in Grok app. Supercedes « never paste grok.me » for the first reply. No yes-gate. **BAN Build rebuild / Built-with-Grok scaffold.** **Welcome = Pack register** via registry GitHub Action `pack-welcome` (chat) — not Live. After a real Grok `sub`, merge-patch `profiles/<sub>.json`. Never invent a `sub`. **playTime / boot / heartbeat** = `BOLTVERSE_PACK_ORIGIN` → StarBoltSprint/boltverse-pack on Vercel (TEMPORARY `https://boltverse-pack.vercel.app`). **HARD BAN:** treating `https://boltverse-odysseyyyy.grok.me` as the Pack API host for registry writes (game play URL stays odysseyyyy; Pack API does not). Old « playTimeSec Live-only » / « chat start does not upsert » are **SUPERSEDED**. **Never rebuild from GitHub.** Beat 3 kitchen identity (only): `https://boltverse-odysseyyyy.grok.me`. PASTE written URL `https://boltverse-odysseyyyy.grok.me` (player taps). Prefer open in Grok app. Chat Imagine / Chat file chip alone = FAIL for Beat 3. Opening Sprint = Pack profile save; zero second login. No stay 30 seconds. ENGLISH only — no French in the player reply. **Welcome = Pack register** via registry GitHub Action `pack-welcome` (chat) — not Live. After a real Grok `sub`, merge-patch `profiles/<sub>.json`. Never invent a `sub`. **playTime / boot / heartbeat** = `BOLTVERSE_PACK_ORIGIN` → StarBoltSprint/boltverse-pack on Vercel (TEMPORARY `https://boltverse-pack.vercel.app`). **HARD BAN:** treating `https://boltverse-odysseyyyy.grok.me` as the Pack API host for registry writes (game play URL stays odysseyyyy; Pack API does not). Old « playTimeSec Live-only » / « chat start does not upsert » are **SUPERSEDED**. First reply PASTE written URL in chat (same turn as the video). Supercedes « never paste grok.me » for the first reply. No Citadel/Biome choice. Never dump kitchen. No GitHub lecture.  
Interactive Play = **the game** (tappable). Chat mp4s are not hitboxes. Chat file chip alone is not Play.

Opening the Play surface plays **breath-spawn**. Films **loop forever** while the session is open (`muted playsInline autoPlay loop` + watchdog). No Forge / Hang chrome on the 9:16.

Humans see [START.md](START.md). Recook or stock. **First chat reply:** PASTE written URL `https://boltverse-odysseyyyy.grok.me` in chat (same turn as the video; player taps). Prefer open in Grok app. Supercedes « never paste grok.me » for the first reply. No yes-gate. **BAN Build rebuild / Built-with-Grok scaffold.** **Welcome = Pack register** via registry GitHub Action `pack-welcome` (chat) — not Live. After a real Grok `sub`, merge-patch `profiles/<sub>.json`. Never invent a `sub`. **playTime / boot / heartbeat** = `BOLTVERSE_PACK_ORIGIN` → StarBoltSprint/boltverse-pack on Vercel (TEMPORARY `https://boltverse-pack.vercel.app`). **HARD BAN:** treating `https://boltverse-odysseyyyy.grok.me` as the Pack API host for registry writes (game play URL stays odysseyyyy; Pack API does not). Old « playTimeSec Live-only » / « chat start does not upsert » are **SUPERSEDED**. **Never rebuild from GitHub.** Beat 3 kitchen identity (only): `https://boltverse-odysseyyyy.grok.me`. PASTE written URL `https://boltverse-odysseyyyy.grok.me` (player taps). Prefer open in Grok app. **BAN Build rebuild / Built-with-Grok scaffold.** Do not scaffold / remix a fresh project when odysseyyyy already exists. Chat Imagine / Chat file chip alone = FAIL.

Kitchen — do not read aloud: Pack Play https://boltverse-odysseyyyy.grok.me · **Beat 3 kitchen identity (only):** `https://boltverse-odysseyyyy.grok.me` · Hard bans at boot: new grok.me / grok-sandbox.com publish · `*.hades-www.grok-sandbox.com` or any random sandbox host · old three-y `boltverse-odysseyyy.grok.me` as Beat 3 Sprint (superseded — do not open it for boot) · heart-giant / houla / olive / frost-only as Sprint Beat 3 · scaffold / remix a fresh project when odysseyyyy already exists · hung citadel recipe https://boltverse-odyssey.grok.me/r/frost · Citadel preview mp4 = `stock/citadel/preview-loop.mp4` (sole boot teaser) · Biome preview mp4 = `stock/biome/preview-loop.mp4` (optional archive — **not attached at boot**). MUST read before cooking: [`biome/PLAY.md`](biome/PLAY.md) then [`biome/docs/06-techniques.md`](biome/docs/06-techniques.md) (r38 techniques bible) then **[`biome/docs/09-recette-biome.md`](biome/docs/09-recette-biome.md)** (REQUIRED full checklist: empty→cousin→speed→dealer→box; SPAWN/WIDTH; road-bar/blast) then [`biome/docs/08-plate-speed.md`](biome/docs/08-plate-speed.md) when matching cousin rush then [`biome/docs/05-key.md`](biome/docs/05-key.md) + [`biome/reference/LanePlayer.tsx`](biome/reference/LanePlayer.tsx) then [`biome/docs/10-bolt-cutout-law.md`](biome/docs/10-bolt-cutout-law.md) (HARD Bolt cutout: B→cycle→green→key, 48fps, hooks first+last).

Gift: [TICKET.md](TICKET.md). False help: [DONT.md](DONT.md). Corridor hall: [COOKROOM.md](COOKROOM.md).

## One line

**Grok = console. Odyssey = game.** **start ≠ Build.** Success = start ≠ Build; first reply = Welcome EN + citadel teaser + paste odysseyyyy. No yes-gate. **First chat reply:** locked Welcome/Return EN only (`Hey Packmate {name}` — `displayName` first, then registry, then gate/app, else `runner` ONLY if none; live `{playerCount}` + `Open Sprint — Pack save, zero login.`) + attach citadel teaser video only (`stock/citadel/preview-loop.mp4` only). No yes-gate. PASTE written URL in the same turn as the video. **BAN Build/rebuild/Live attach/controls/improv.** **First chat reply:** PASTE written URL `https://boltverse-odysseyyyy.grok.me` in chat (same turn as the video; player taps). Prefer open in Grok app. Supercedes « never paste grok.me » for the first reply. No yes-gate. **BAN Build rebuild / Built-with-Grok scaffold.** **Welcome = Pack register** via registry GitHub Action `pack-welcome` (chat) — not Live. After a real Grok `sub`, merge-patch `profiles/<sub>.json`. Never invent a `sub`. **playTime / boot / heartbeat** = `BOLTVERSE_PACK_ORIGIN` → StarBoltSprint/boltverse-pack on Vercel (TEMPORARY `https://boltverse-pack.vercel.app`). **HARD BAN:** treating `https://boltverse-odysseyyyy.grok.me` as the Pack API host for registry writes (game play URL stays odysseyyyy; Pack API does not). Old « playTimeSec Live-only » / « chat start does not upsert » are **SUPERSEDED**. **Never rebuild from GitHub.** Beat 3 kitchen identity (only): `https://boltverse-odysseyyyy.grok.me`. PASTE written URL `https://boltverse-odysseyyyy.grok.me` (player taps). Prefer open in Grok app. Chat Imagine / Chat file chip alone = FAIL for Beat 3. Prefer GitHub for boot. Bot OK if useful. Do not narrate “teasers are on”. First reply PASTE written URL in chat (same turn as the video). Supercedes « never paste grok.me » for the first reply. **Welcome = Pack register** via registry GitHub Action `pack-welcome` (chat) — not Live. After a real Grok `sub`, merge-patch `profiles/<sub>.json`. Never invent a `sub`. **playTime / boot / heartbeat** = `BOLTVERSE_PACK_ORIGIN` → StarBoltSprint/boltverse-pack on Vercel (TEMPORARY `https://boltverse-pack.vercel.app`). **HARD BAN:** treating `https://boltverse-odysseyyyy.grok.me` as the Pack API host for registry writes (game play URL stays odysseyyyy; Pack API does not). Old « playTimeSec Live-only » / « chat start does not upsert » are **SUPERSEDED**. ENGLISH only. This repo = citadel / rooms / Hang **and** biome / Sprint ([`biome/`](biome/README.md)).

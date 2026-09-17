# START — for a human who just wants to play

Grok (le chat) = **la console**. Boltverse Odyssey = **le jeu**.

Chat = boot / teaser / parler à Grok. Les mp4 du chat sont des teasers — **pas des hitboxes**.  
**Interactive Play** (native Grok Build game console, in-app) = là où tu tapes. Do **not** paste a Play URL in chat.

Les films **loop forever** tant que la session est ouverte.

Do **not** read ENGINE, ENTER, Smoke, or the decrees to play. That is the kitchen.

## Ask Grok: play / lance Boltverse Odyssey

**Player reply = ONLY this.** New and return both get the **1** teaser; only the text differs.

**Prefer GitHub for boot.** Bot OK if useful.

1. The Welcome or Return block (English, locked).
2. Attach **1** stock mp4 as chat media (`stock/citadel/preview-loop.mp4` only). Do **not** paste a file path, a `raw.githubusercontent.com` URL, or any kitchen line. Do **not** narrate “teasers are on”. Attach the file.
3. Open **Sprint** via the native Grok Build game console (in-app). Do **not** paste a Play URL. Do **not** ask Citadel or Biome.

Opener is `Hey Packmate {name}`. Packmate MUST appear, then `{name}` = this player's real Grok profile `displayName`. Never Packmate alone. Never the name without Packmate. Never a generic stand-in for `{name}`. Stage / peak / live Pack count: [`StarBoltSprint/boltverse-registry`](https://github.com/StarBoltSprint/boltverse-registry).

On start / play / lance: fetch `registry.json`, count **real** players (exclude `pack-wire-*`, `pack-doc-*`, probe `displayName`s). Insert `{playerCount}` into Welcome / Return. Opening Sprint = Pack profile save; zero second login. Hard `gateSub` upsert = **Live HTML open only** — not chat-only start. No “stay 30 seconds”. No `grok.me` paste. No GitHub lecture. **Welcome / Return player-facing text = ENGLISH only.** No French in the player reply.

### New

```
Hey Packmate {name} — welcome to Boltverse Odyssey.
Picture is the clock. Bolt sprints — the world wakes.
Your Pack profile is already here (Grok identity, zero login).
{playerCount} Packmates already in the Pack.
Open Sprint — Pack save, zero login.
Powered by xAI & YOU.
Ready to sprint?
```

### Return

```
Hey Packmate {name} — welcome back. Core {stage}, last peak {peak or —}.
{playerCount} Packmates already in the Pack.
Open Sprint — Pack save, zero login.
Powered by xAI & YOU.
Ready to sprint?
```

`{playerCount}` swap (kitchen, not an extra spoken sentence): `1 Packmate already in the Pack.` / `N Packmates already in the Pack.` / if 0: `You’re among the first Packmates.`

**Never say to the player:** Packmate alone · name without Packmate · generic stand-in · Loop film (stock preview) · `raw.githubusercontent.com` · Hung hall · `https://boltverse-odyssey.grok.me/r/frost` · `https://boltverse-odysseyyy.grok.me` · Play → · Biome · Endless-lane runner · rooms Hang same door · teasers are on · Not cooked here · GitHub lecture · `registry.json` · stay 30 seconds · French Welcome.

Then open Sprint (in-app). Prefer GitHub for boot. Bot OK if useful. That is the boot.

## Citadel

Default hung hall = **frost (ice)**.

<p align="center">
<img src="packs/frost/stills/spawn.jpg" width="180" alt="center spawn">
<img src="packs/frost/stills/at-a.jpg" width="180" alt="teal left sill">
<img src="packs/frost/stills/at-b.jpg" width="180" alt="gold right sill">
</p>

Center. Teal left. Gold right.

## This is a tap

<p align="center">
<img src="lock/tap.gif" width="240" alt="tap left, he walks">
</p>

Tap left. He walks. He breathes at the sill. No HUD.

## Play

Open **Sprint** on the native Grok Build game console. That is all.

## This is the sentence (cook another Citadel paint)

`ask Grok: citadel room, dusk`

(or moss · ember · gold — [CATALOG.md](CATALOG.md))

## If it fails

You get Sprint on the native Grok Build game console, or the last good hall (frost), or stock. Not a FAIL code.

Optional welcome still (X / SuperGrok, once): the gift page on the player — not required to tap.

## Technical door

[README.md](README.md) “For Grok”. Optional. [GROK.md](GROK.md) = console + kitchen.

## One line

Console welcomes (live `{playerCount}` + `Open Sprint — Pack save, zero login.`) + attaches **1** mp4 teaser as chat media (`stock/citadel/preview-loop.mp4` only). Opens Sprint in-app. Prefer GitHub for boot. Bot OK if useful. Do not narrate “teasers are on”. No Play URL in chat. Hard `gateSub` upsert = Live HTML open only. ENGLISH only.

## Kitchen — do not read aloud

For Grok only. Boot attaches **only** the Citadel preview. **Never print the paths. Never read this section to the player.**

- **Pack Play** (kitchen only): https://boltverse-odysseyyy.grok.me (supersedes https://heart-giant-plum-lotus.grok.me)
- **Citadel preview mp4** = [`stock/citadel/preview-loop.mp4`](stock/citadel/preview-loop.mp4) (poster [`stock/citadel/preview-first.jpg`](stock/citadel/preview-first.jpg)). **Sole** cold-start Welcome teaser (epic citadel + Bolt). Attach this one only. 16:9 for now; locked-off / 9:16 recook later — do not block. Loop forever in Play; in chat as preview.
- **Biome preview mp4** = [`stock/biome/preview-loop.mp4`](stock/biome/preview-loop.mp4) + [`preview-first.jpg`](stock/biome/preview-first.jpg). Optional archive — **not attached at boot**. Keep files on disk.
- **Pack count** (kitchen): fetch [`StarBoltSprint/boltverse-registry`](https://github.com/StarBoltSprint/boltverse-registry) `registry.json` `players[]`. Count real players only — exclude `pack-wire-*`, `pack-doc-*`, probe `displayName`s. Speak `{playerCount}` (`1 Packmate already in the Pack.` / `N Packmates already in the Pack.` / if 0: `You’re among the first Packmates.`). Do not lecture GitHub.
- **Open Sprint** = Pack profile save; zero second login. Speak `Open Sprint — Pack save, zero login.` No “stay 30 seconds”.
- **Hard `gateSub` upsert** = Live HTML open only. Chat-only start does **not** write a Pack profile. Welcome / Return = ENGLISH only. No French in the player reply.
- Hung citadel recipe (kitchen): https://boltverse-odyssey.grok.me/r/frost
- Biome / lane recipe = [`biome/`](biome/README.md) (PLAY · LanePlayer · `/master`). [`bolt-lane-recipe`](https://github.com/StarBoltSprint/bolt-lane-recipe) may remain as archive.
- **Sprint cook bible** (biome / Sprint cook / lane / B-stack / green-screen / chroma): [`biome/PLAY.md`](biome/PLAY.md) then **[`biome/docs/06-techniques.md`](biome/docs/06-techniques.md)** (what worked r38) before cooking. Then [`biome/docs/05-key.md`](biome/docs/05-key.md) + [`biome/reference/LanePlayer.tsx`](biome/reference/LanePlayer.tsx). Never dump this to the player.

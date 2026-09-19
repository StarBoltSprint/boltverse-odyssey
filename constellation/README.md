# Constellation — SPACE LOD KEEP (hung in Odyssey)

Public KEEP of the **Star Map**, hung here so Pack / Grok can find it.

One continuous void. Star Core at the center. Worlds hung in space.

**This is not Sprint. This is not biome/master.** Sibling folder only. Hang ≠ wipe.

Upstream KEEP (source of truth for recooks): **https://github.com/StarBoltSprint/boltverse-constellation**  
Snapshot hung here: `5a3d46b5379381a64a9d26bcf92cce4ca3cd78d2`

## Start here

- **Fresh Grok / new chat:** read [`GROK.md`](GROK.md) first. Product, Law 0 cook, impostor, LOD, Samsung bugs already paid for.
- Law: [`LAW.md`](LAW.md)
- Cook + RIFE + lock_globe + LOD plates: [`METHOD.md`](METHOD.md)

## What it is

- **Zoom in** — Star Core goes cinematic / fullscreen (Imagine loop).
- **Zoom out** — constellation of worlds in the void, with gaps between them.
- **No collage** — no grid, no tiles, no rectangles.
- **Billboard twist OK** — Imagine videos face the camera; twist/parallax crawl is allowed so the plate does not read as a flat card.
- **Canyon rocket zoom** — pinch past the round globe (it **stays round**) → one fade into aerial canyon → later oblique flyover. Imagine plates only. No camera cut.
- **No play gate** — lands straight on the map.

Worlds: **Star Core · Tide · Canyon · Crystal · Hollow · Drift**

## Run

From this folder (`constellation/`):

```bash
npm install
npm run dev
```

App listens on port 8080. Pinch · twist · drag. **Core** flies to the star. **Map** pulls back to the constellation. Lands straight on the map (no play gate).

Does **not** replace default Sprint Live (`https://boltverse-odysseyyyy.grok.me`). Do not publish this as Beat 3.

## Recook a world

```bash
export XAI_API_KEY=...
export RIFE_ROOT=/tmp/Practical-RIFE
node scripts/imagine-planet-hooks.mjs canyon
```

Pipeline: first+last still → Imagine `image` + `last_frame` → lock globe → RIFE 4× → ping-pong.

Do **not** recook `canyon.mp4` / `canyon-lod1.mp4` unless the player asks. Oval / vanish / pinch bugs are draw bugs, not film bugs.

## Imagine loops

Cinematic plates live in [`public/videos/`](public/videos/) (`core`, `tide`, `canyon`, `crystal`, `hollow`, `drift` + posters, plus Canyon `canyon-lod1/2/3`). They are the albedo of each world — radial orbs / sphere impostors, never a tiled collage.

## Pack

If a Constellation Live is ever published, Odyssey Pack wire still applies: `window.BOLTVERSE_PACK_ORIGIN` = `https://boltverse-pack.vercel.app` and [`client/pack.js`](../client/pack.js). Do not treat odysseyyyy as the Pack API host. This hang does not change `client/pack.js`.

## Repo

Hung inside [`StarBoltSprint/boltverse-odyssey`](https://github.com/StarBoltSprint/boltverse-odyssey) as `constellation/`.

Source KEEP: **https://github.com/StarBoltSprint/boltverse-constellation**

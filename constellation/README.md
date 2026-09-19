# Constellation — SPACE LOD KEEP (hung in Odyssey)

Public KEEP of the **Star Map**, hung here so Pack / Grok can find it.

One continuous void. Star Core at the center. Worlds hung in space.

**This is not Sprint. This is not biome/master.** Sibling folder only. Hang ≠ wipe.

Upstream KEEP (source of truth for recooks): **https://github.com/StarBoltSprint/boltverse-constellation**  
Snapshot hung here: `475fa4667a99133ff6561c2d8f7f362889592091`

## What it is

- **Zoom in** — Star Core goes cinematic / fullscreen (Imagine loop).
- **Zoom out** — constellation of worlds in the void, with gaps between them.
- **No collage** — no grid, no tiles, no rectangles.
- **Billboard twist OK** — Imagine videos face the camera; twist/parallax crawl is allowed so the plate does not read as a flat card.

Worlds: **Star Core · Tide · Canyon · Crystal · Hollow · Drift**

Law of this KEEP: [`LAW.md`](LAW.md)

## Run

From this folder (`constellation/`):

```bash
npm install
npm run dev
```

App listens on port 8080. Pinch · twist · drag. **Core** flies to the star. **Map** pulls back to the constellation.

Does **not** replace default Sprint Live (`https://boltverse-odysseyyyy.grok.me`). Do not publish this as Beat 3.

## Imagine loops

Cinematic plates live in [`public/videos/`](public/videos/) (`core`, `tide`, `canyon`, `crystal`, `hollow`, `drift` + posters). They are the albedo of each world — radial orbs / sphere impostors, never a tiled collage.

## Pack

If a Constellation Live is ever published, Odyssey Pack wire still applies: `window.BOLTVERSE_PACK_ORIGIN` = `https://boltverse-pack.vercel.app` and [`client/pack.js`](../client/pack.js). Do not treat odysseyyyy as the Pack API host. This hang does not change `client/pack.js`.

## Repo

Hung inside [`StarBoltSprint/boltverse-odyssey`](https://github.com/StarBoltSprint/boltverse-odyssey) as `constellation/`.

Source KEEP: **https://github.com/StarBoltSprint/boltverse-constellation**

# biome — Sprint / lane recipe (lives under odyssey/biome)

**This folder is the lane-recipe tree, living under odyssey/biome.** Citadel halls stay at the repo root (`cook-room`, `packs/`, `stock/citadel`). **Biome / Sprint lane cook lives here.**

[`StarBoltSprint/bolt-lane-recipe`](https://github.com/StarBoltSprint/bolt-lane-recipe) may remain as a private **mirror / archive**. Odyssey `biome/` is the place to cook biome too.

This folder is a **recipe**, not an app. Do **not** scaffold a new grok.me. Play = native Grok Build game console (in-app). Kitchen Live stays https://boltverse-odysseyyy.grok.me (`VER = r19wide`).

## Engine lock (read PLAY first)

**[PLAY.md](PLAY.md)** is the law:

- **B stack** = road (empty plate) + Bolt **cutout** (gallop video). Two living `<video>`s.
- **seek-sync** — road is the clock; cutout snaps to the same `currentTime`.
- **loop forever** — `muted playsInline autoPlay loop` + watchdog on `pause` / `ended`.
- **No wallet / keys** in the player.
- **No 3-take L / M / R as default.** Do not invent the cancelled C-light lock.
- **r19wide** — [reference/LanePlayer.tsx](reference/LanePlayer.tsx) is the Live compositor (`#bolt-luma`, plant `translate3d`, `?v=r19wide`).

## Map

| path | what |
|---|---|
| [PLAY.md](PLAY.md) | B-stack engine locks |
| [CONSOLE.md](CONSOLE.md) | Grok = console, Sprint = in-app Play |
| [GROK.md](GROK.md) | kitchen — how to cook empty plate + cutout |
| [docs/01-images.md](docs/01-images.md) | stills: empty plate + Bolt mid |
| [docs/02-videos.md](docs/02-videos.md) | films: first+last, never Agent video |
| [docs/03-decoupe-swipe.md](docs/03-decoupe-swipe.md) | swipe = découpe the cutout on the road |
| [docs/04-play.md](docs/04-play.md) | LanePlayer + `/master` stack |
| [prompts/](prompts/) | Imagine paste blocks (swap `{PAINT}` only) |
| [reference/LanePlayer.tsx](reference/LanePlayer.tsx) | r19wide compositor (not a grok.me) |
| [reference/lane-css.css](reference/lane-css.css) | 9:16 B-stack CSS |
| [master/README.md](master/README.md) | hung road + cutout master |
| [stock/biome/](../stock/biome/README.md) | console Sprint teaser (`preview-loop.mp4`) |
| [assets/README.md](assets/README.md) | optional extras |

Citadel cook is unchanged: [../COOKROOM.md](../COOKROOM.md) · [../AGENTS.md](../AGENTS.md).

## Happy path (biome cook)

```
# read biome/PLAY.md then biome/GROK.md
# stills + films = imagine-hooks first+last (never Imagine Agent video)
# drop masters into biome/master/ (or point Play at stock/biome teasers)
```

Cannot run `node` + `XAI_API_KEY` → **REFUSE**. Stock Sprint in-app. Do **not** fall back to chat Imagine.

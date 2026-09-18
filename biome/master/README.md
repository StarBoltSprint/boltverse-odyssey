# master — hung B-stack (road + cutout)

This folder is the Sprint **`/master` stack** the LanePlayer wires.

**Dealer playlist is locked** (table order = play order). Canyon → cars/spectacle → duel → night → war. Never shuffle. Law: [../docs/11-plate-order.md](../docs/11-plate-order.md).

| file | role | chapter |
|---|---|---|
| `road.mp4` | empty dusk road — **master clock** (5.75 s) | canyon |
| `road-bar.mp4` | center jersey | canyon |
| `road-blast.mp4` | center meteor | canyon |
| `road-car.mp4` | left-lane futuristic car | cars |
| `road-gap.mp4` | L+R cars, center free | cars |
| `road-show.mp4` | dusk spectacle (cars + ships) | spectacle |
| `road-duel.mp4` | distant dogfight, wreck L+C | duel |
| `road-gate.mp4` | dusk → night megacity (sky only, no ground box) | night gate |
| `road-night.mp4` | night neon action, L+R | night |
| `road-war1.mp4` | war intro, capital ships vs buildings | war |
| `road-war2.mp4` | war city on fire | war |
| `road-war3.mp4` | war debris, left lane | war |
| `bolt.mp4` | Bolt green-screen gallop | (cutout, not a road plate) |
| `road.jpg` | poster | (poster, not a road plate) |

All cousins hung at **the empty clock** (`--duration-match` → 5.75 s). Cook: [../docs/09-recette-biome.md](../docs/09-recette-biome.md). Bolt cutout: [../docs/10-bolt-cutout-law.md](../docs/10-bolt-cutout-law.md).

Hung binaries above are **present** on `main`. Do not invent extra mp4s. `biome/assets/` is an empty pointer — not this stack. Films stay `-an` (no SFX baked in).

Pack `assetId`s (14 files, format `a_smir9_*`): [ASSETS.md](ASSETS.md) + [plates-index.json](plates-index.json). Law SoT stays on registry. Do not invent local ids.

Encode: 720×1280, H264, `-an`, short GOP, `+faststart`.

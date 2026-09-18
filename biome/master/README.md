# master — hung B-stack (road + cutout)

This folder is the Sprint **`/master` stack** the LanePlayer wires.

| file | role |
|---|---|
| `road.mp4` | empty dusk road — **master clock** (5.75 s) |
| `road-bar.mp4` | center jersey |
| `road-blast.mp4` | center meteor |
| `road-car.mp4` | left-lane futuristic car |
| `road-gap.mp4` | L+R cars, center free |
| `road-show.mp4` | dusk spectacle (cars + ships) |
| `road-duel.mp4` | distant dogfight, wreck L+C |
| `road-gate.mp4` | dusk → night megacity (sky only, no ground box) |
| `road-night.mp4` | night neon action, L+R |
| `road-war1.mp4` | war intro, capital ships vs buildings |
| `road-war2.mp4` | war city on fire |
| `road-war3.mp4` | war debris, left lane |
| `bolt.mp4` | Bolt green-screen gallop |
| `road.jpg` | poster |

All cousins hung at **the empty clock** (`--duration-match` → 5.75 s). Cook: [../docs/09-recette-biome.md](../docs/09-recette-biome.md). Bolt cutout: [../docs/10-bolt-cutout-law.md](../docs/10-bolt-cutout-law.md).

Hung binaries above are **present** on `main`. Do not invent extra mp4s. `biome/assets/` is an empty pointer — not this stack. Films stay `-an` (no SFX baked in).

Encode: 720×1280, H264, `-an`, short GOP, `+faststart`.

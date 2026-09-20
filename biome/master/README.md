# master — hung B-stack (road + cutout)

This folder is the Sprint **`/master` stack** the LanePlayer wires.

**Dealer playlist is locked** (table order = play order). Canyon → cars/spectacle → duel → night → war. Never shuffle. Law: [../docs/11-plate-order.md](../docs/11-plate-order.md).

**HARD LOCK — Hang ≠ wipe.** New biome = ADD `road-<biome>*.mp4` here. KEEP every file in this table. NEVER `rm` canyon / war to “make room”. Recook Bolt may replace `bolt.mp4` only.

**HARD LOCK — Chat biome catalog (on ask).** Player list = hung **chapters** from this table (canyon · cars · duel · night · war). Never invent. Hang grows the list; wipe shrinks it = FAIL.

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
| `bolt.mp4` | Bolt green-screen gallop — **must match** lock 6 s canon (`lock/bolt-gallop-cycle.mp4`, ~5.56 s / 534 / 96 fps). SoT stays [`lock/`](../../lock/README.md). Remux of the lock, not a new sprint. | (cutout, not a road plate) |
| `bolt-prev.mp4` | archive of the previous master bolt (8.5 s / 24 fps). **Not** a play cycle. | (archive only) |
| `road.jpg` | poster | (poster, not a road plate) |

All cousins hung at **the empty clock** (`--duration-match` → 5.75 s). Cook: [../docs/09-recette-biome.md](../docs/09-recette-biome.md). Bolt cutout: [../docs/10-bolt-cutout-law.md](../docs/10-bolt-cutout-law.md). Any-biome Frost-parity: [../docs/00-PRIORITY0-any-biome.md](../docs/00-PRIORITY0-any-biome.md) · FX table [../docs/16-biome-ground-fx.md](../docs/16-biome-ground-fx.md).

**`bolt.mp4` law:** source of truth is [`lock/bolt-gallop-cycle.mp4`](../../lock/bolt-gallop-cycle.mp4). This master file must be the same 6 s / 96 fps / 534-frame bytes (or a remux `-an` +faststart of those bytes). Do **not** invent a new gallop. Old master archived as `bolt-prev.mp4`. Roads stay. Hang ≠ wipe.

Hung binaries above are **present** on `main`. Do not invent extra mp4s. `biome/assets/` is an empty pointer — not this stack. Films stay `-an` (no SFX baked in).

Pack `assetId`s (14 files, format `a_smir9_*`): [ASSETS.md](ASSETS.md) + [plates-index.json](plates-index.json). Law SoT stays on registry. Do not invent local ids.

Encode: 720×1280, H264, `-an`, short GOP, `+faststart`.

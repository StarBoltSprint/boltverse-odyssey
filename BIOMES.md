# BIOMES — engine table (offline kit)

One table. Forge / voice / Hang **index** this row. They do not invent.

Lane cook = `node scripts/cook-biome.mjs <id>` — reads [palettes/forest-palette.json](palettes/forest-palette.json).  
**Not** `cook-room.mjs`. 10 reels, 0 atA. [COOKLANE.md](COOKLANE.md).

This does **not** replace [CATALOG.md](CATALOG.md) paints.

| Layer | Job |
|---|---|
| **Paints** (10) | citadel hall *material* — `cook-room` |
| **BiomeRow** (5) | race palette — `cook-biome` |

Citadel door `kind: sprint` → `to` is a `BiomeId` ([LINKS.md](LINKS.md)). Play = [PLAY.md](PLAY.md).

**The Lane is not a tiny citadel.** Hall poses = **bridge at the door** only.

## Two bags

| Bag | What | For |
|---|---|---|
| **Race** | 10 plates in `*-palette.json` + identity + cues | ~60 s run |
| **Bridge** | 3 breaths + 2 walks + spawn | enter / exit |

Race missing → `coming` for play. Do not hang a hall door.  
`coming: true` until `smokeL` after scrub. Cues are empty out of `cook-biome`.

## Year-0 rows

| id | feel | voice aliases | neighbors |
|---|---|---|---|
| `forest` | crystal-ice | forest, ice, crystal | moss, dusk |
| `moss` | wet green | moss, **jungle** | forest, dusk |
| `dusk` | purple quiet | dusk, night | forest, ember |
| `ember` | bronze warmth | ember, fire, rome, roman, forum | dusk, asteroid |
| `asteroid` | void-stone | asteroid, mars, space, void, cosmos | ember |

**Alias is voice only.** No cook « rome ». Machine source: [biomes.json](biomes.json).

`identity` = `lock/bolt-back.jpg` (shared). `spawn` = this biome, bridge only.

## Fill order

```
1. id + worldLine + pathLine + neighbors
2. identity (lock)
3. node scripts/cook-biome.mjs forest   (—dry-run first)
   palettes/<id>-palette.json — Grok does not invent calm-2
4. scrub cues + smokeL  → coming: false
5. Hang row
6. only then bridge + citadel door kind:sprint
```

Invert 6 and 3 = tap into the void. FAIL decay ×2 → kit stays `coming`.

## Laws

- do not `cook-room` a paint and call it a biome
- aliases do not cook
- decay is not optional
- hall graph is not the minute

## One line

**`cook-room moss` is the hall. `cook-biome forest` is the minute.** Race = 10 reels + decay + identity. Coming = no door.

# BIOMES — engine table (offline kit)

One table. Forge / voice / WFC / Keep / Smoke **index** rows. They do not invent.

This does **not** replace [CATALOG.md](CATALOG.md) paints.

| Layer | Job |
|---|---|
| **Paints** (10) | citadel hall *material* — 2 locked lines, floor-1 cook |
| **BiomeRow** (5) | playable kit — stock clips + spawn + identity + neighbors |

Paints = `worldLine` matter. A row **owns** a paint + stock + who it may touch.  
Citadel door `kind: sprint` → `to` is a `BiomeId` ([LINKS.md](LINKS.md)). Play disc = [PLAY.md](PLAY.md).

## Two layers, one word

- **A — names:** closed `BiomeId` + voice aliases (`rome` → `ember`, not a row)
- **B — kits:** each id has a `BiomeRow` with **min stock**, else `"coming"` (do not Hang)

```ts
type BiomeId = "forest" | "moss" | "dusk" | "ember" | "asteroid"

type BiomeRow = {
  id: BiomeId
  neighbors: BiomeId[]       // legal enter only here
  worldLine: string          // 1–2 locked Imagine sentences
  pathLine: string           // floor / fork
  stills: { spawn: Url; identity?: Url }  // identity = Bolt back, often shared
  stock: {
    "breath-spawn": Clip
    "breath-atA": Clip
    "breath-atB": Clip
    "walk-spawn-A": Clip
    "walk-spawn-B": Clip
    decay: Clip
    "walk-A-B"?: Clip
    "walk-B-A"?: Clip
  }
  railsVersion: string       // e.g. "lockoff-back-v1"
}
```

## Year-0 rows

| id | feel | voice aliases | neighbors |
|---|---|---|---|
| `forest` | crystal-ice | forest, ice, crystal, jungle… | moss, dusk |
| `moss` | wet green | moss, jungle | forest, dusk |
| `dusk` | purple quiet | dusk, night | forest, ember |
| `ember` | bronze warmth | ember, fire, rome, roman, forum | dusk, asteroid |
| `asteroid` | void-stone | asteroid, mars, space, void, cosmos | ember |

Off-alias → picker, no cook. New world = **new row** (stills + stock + neighbors), not a chat sentence.

`moss` the **paint** (citadel ivy) and `moss` the **biome** (wet-green Lane) share a name. Door `kind` disambiguates: hall vs sprint.

## Min stock (play offline)

Required: 3 breaths + 2 walks spawn→A/B + `decay` + spawn still + identity thumb.  
Optional: A↔B (else Recall → spawn → walk-spawn-B).  
**Enter is not** min stock — clip per *edge* (`forest→dusk/enter-A`) only if `to ∈ neighbors`.

Empty stock → this biome’s `decay`, not a mystery cook.

## Laws

- `worldLine` / `pathLine` frozen; voice ≤12 words **after**, never instead
- identity ≠ spawn (do not share spawn stills across biomes)
- identity thumb may be shared (`lock/bolt-back.jpg`)
- bump `railsVersion` if camera / body law changes
- Smoke [SMOKE.md](SMOKE.md) + cue honesty [PLAY.md](PLAY.md) before Hang

## Lookups

```
biome = catalog.get("forest")
clip  = biome.stock["walk-spawn-A"]
legalEnter = catalog.get(from).neighbors.includes(to)
"mars" → ALIAS → "asteroid"
```

Footage: [starboltsprint-forest](https://github.com/StarBoltSprint/starboltsprint-forest) (`asteroid.mp4`, `cook-forest`, `cook-rome`…). Missing files = `"coming"`.

## Table tests

Each id has min stock + spawn + identity · neighbors exist · aliases resolve · no two ids share spawn · `worldLine` has no ban stems (cape, text, orbit…).

## One line

Five complete kits + who they may touch. Rome / Mars are nicknames. Paints stay the short material list.

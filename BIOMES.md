# BIOMES — engine table (offline kit)

One table. Forge / voice / Hang **index** this row. They do not invent.

This does **not** replace [CATALOG.md](CATALOG.md) paints.

| Layer | Job |
|---|---|
| **Paints** (10) | citadel hall *material* — 2 locked lines, floor-1 cook |
| **BiomeRow** (5) | playable kit — **race palette** + decay + identity + neighbors |

Paints = `worldLine` matter. A row **owns** a paint + stock + who it may touch.  
Citadel door `kind: sprint` → `to` is a `BiomeId` ([LINKS.md](LINKS.md)). Play disc = [PLAY.md](PLAY.md). Cook = [COOKLANE.md](COOKLANE.md).

Making a biome is **not** “describe a forest” and **not** “cook walk-A”.

**The Lane is not a tiny citadel.** Center of the minute = plates + `m`. Hall poses (spawn / atA / breath-A) = **bridge at the door** only.

## Two bags of films

| Bag | What | For |
|---|---|---|
| **Race** | palette `calm × n`, `lean × n`, `peak`, `decay` + identity + cues/glow | the ~60 s run |
| **Bridge** | 3 breaths + 2 walks + spawn still (hall names) | enter / exit / same player CHAR |

Race missing → `"coming"` **for play**. Do not hang a hall door.  
Bridge missing → you may still play the minute if the palette exists; you may **not** `kind: sprint` until the enter edge is cooked.

The 5 hall names below are a **pont**, not the design of the minute.

## Two layers, one word

- **A — names:** closed `BiomeId` + voice aliases (`rome` → `ember`, not a row)
- **B — kits:** each id has a `BiomeRow` with **race min**, else `"coming"`

```ts
type BiomeId = "forest" | "moss" | "dusk" | "ember" | "asteroid"

type BiomeRow = {
  id: BiomeId
  neighbors: BiomeId[]
  worldLine: string
  pathLine: string
  stills: { spawn?: Url; identity: Url }
  stock: {
    decay: Clip                    // required — Lane floor
    calm: Clip[]                   // race palette
    lean: Clip[]
    peak?: Clip
    // bridge (door only, optional until hang):
    "breath-spawn"?: Clip
    "breath-atA"?: Clip
    "breath-atB"?: Clip
    "walk-spawn-A"?: Clip
    "walk-spawn-B"?: Clip
  }
  railsVersion: string
}
```

Machine source: [biomes.json](biomes.json). Prose here must match that file.

## Year-0 rows

| id | feel | voice aliases | neighbors |
|---|---|---|---|
| `forest` | crystal-ice | forest, ice, crystal | moss, dusk |
| `moss` | wet green | moss, **jungle** | forest, dusk |
| `dusk` | purple quiet | dusk, night | forest, ember |
| `ember` | bronze warmth | ember, fire, rome, roman, forum | dusk, asteroid |
| `asteroid` | void-stone | asteroid, mars, space, void, cosmos | ember |

**Alias is voice only.** No `packs/rome/`. No cook “rome”. `jungle` → `moss` only.

`moss` paint vs `moss` biome: `kind` disambiguates.

## worldLine / pathLine

Two **frozen** strings. Imagine may see only these + CHAR + the **gesture** of that plate.

Voice ≤ 12 words **after**. Ban stems: cape, text, UI, orbit, dolly, face, 3rd portal, fashion stage, “camera follows”.

**Change a worldLine = recook the whole kit, or do not touch it.**

## neighbors

Closed list. `from === to` forbidden. No auto-mirror. Empty = cul-de-sac OK. Hall [adjacency.json](adjacency.json) does **not** apply.

## railsVersion

Now: `lockoff-back-v1`. Bump only for body/camera. One kit = one version.

## Identity vs spawn

`identity` = Bolt back, often `lock/bolt-back.jpg`, **shared**.  
`spawn` = **this** biome, not shared — bridge / underlayer, not a required race plate.

## Race min (play the minute offline)

Enough plates for ~**60 s** + `decay` + cues/glow + identity.

```
stills/identity.jpg          // or lock/bolt-back.jpg
films/calm-*.mp4             // n
films/lean-*.mp4             // n
films/peak.mp4               // optional until m can rise that far
films/decay.mp4              // required
```

No Enter. No atA in the middle of the minute. [COOKLANE.md](COOKLANE.md).

`m` picks the next plate from this palette. Imagine is not on the tap.

## Bridge (door only)

Same names as hall floor 1 — **pont** for CHAR / handoff:

```
stills/spawn.jpg
films/breath-spawn.mp4
films/breath-atA.mp4
films/breath-atB.mp4
films/walk-spawn-A.mp4
films/walk-spawn-B.mp4
```

Optional until you hang `kind: sprint` on a citadel door. Do not cook these and call the biome done.

### decay — the Lane floor

Required. 404 / `play()` fail / cue unreadable / recook refused → **this** decay, this biome. Not `packs/citadel`.

Safe PASS (mute, one dog), not pretty. Honest gel > invented sprint.

### Encode

720×1280, H264 `yuv420p` `+faststart`, **no audio**.

### `"coming"`

Race incomplete → coming → no Hang, no public Lane, no Imagine “in the meantime”.

## Fill order (kit before hook)

```
1. id + worldLine + pathLine + neighbors + railsVersion
2. identity (lock)
3. race palette — COOKLANE.md (calm / lean / peak / decay). NOT cook-room. NOT walk-A.
4. Smoke plate + cue honesty (gesture in the frame)
5. Hang row (no longer coming)
6. only then bridge films, enter edges, citadel door kind:sprint
```

Invert 6 and 3 = tap into the void or live Imagine ([DONT.md](DONT.md)).

## Laws

- do not `cookRoom` a paint and call it a biome
- aliases do not cook
- decay is not optional; citadel stock is not Lane decay
- hall graph is not the minute ([COOKLANE.md](COOKLANE.md) [PLAY.md](PLAY.md))

## Lookups

```
voix "rome" → alias → ember
ember.worldLine     → Imagine matter
ember.identity      → same Bolt as forest
ember.stock.calm    → m low plates
ember.stock.decay   → Lane floor
ember.neighbors     → Enter legal (after Hang)
```

Footage: [starboltsprint-forest](https://github.com/StarBoltSprint/starboltsprint-forest). Missing race = `"coming"`.

## One line

Race = palette + decay + identity. Bridge = hall names at the door. Coming = no door. The minute is not a little citadel.

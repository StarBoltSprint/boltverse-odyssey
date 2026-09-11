# BIOMES — engine table (offline kit)

One table. Forge / voice / Hang **index** this row. They do not invent.

This does **not** replace [CATALOG.md](CATALOG.md) paints.

| Layer | Job |
|---|---|
| **Paints** (10) | citadel hall *material* — 2 locked lines, floor-1 cook |
| **BiomeRow** (5) | playable kit — stock clips + spawn + identity + neighbors |

Paints = `worldLine` matter. A row **owns** a paint + stock + who it may touch.  
Citadel door `kind: sprint` → `to` is a `BiomeId` ([LINKS.md](LINKS.md)). Play disc = [PLAY.md](PLAY.md).

Making a biome is **not** “describe a forest”. Fill a row until it plays **offline**, then (optional) hang it on a hall door.

Two jobs: the **kit** and the **hook**. Do not invert.

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

Machine source: [biomes.json](biomes.json). Prose here must match that file.

## Year-0 rows

| id | feel | voice aliases | neighbors |
|---|---|---|---|
| `forest` | crystal-ice | forest, ice, crystal | moss, dusk |
| `moss` | wet green | moss, **jungle** | forest, dusk |
| `dusk` | purple quiet | dusk, night | forest, ember |
| `ember` | bronze warmth | ember, fire, rome, roman, forum | dusk, asteroid |
| `asteroid` | void-stone | asteroid, mars, space, void, cosmos | ember |

**Alias is voice only.** No `packs/rome/`. No cook “rome”. The id is the key — folders, clips, `kind: sprint` `to:` always the id.

One alias, **one** target. `jungle` → `moss` (json). Not forest. Off-alias → picker of the 5, no Imagine.

Phantom row = an id in a prompt that is not in `ids[]`. Forbidden. New land = new line (stills + stock + neighbors), PR, bump the table.

`moss` the **paint** (citadel ivy) and `moss` the **biome** (wet-green Lane) share a name. Door `kind` disambiguates.

## worldLine / pathLine

Two **frozen** strings per row. That is all Imagine may see.

- `worldLine` — matter / sky / light (1–2 sentences)
- `pathLine` — floor and fork. Not a 3rd door. Not HUD.

Voice ≤ 12 words **after**, never instead. “a bit more violet” OK. “and a temple under the sea” = new world = refuse.

Ban stems (same as the hall): cape, text, UI, orbit, dolly, face, 3rd portal, fashion stage, “camera follows”. If they sit in `worldLine`, the row is already bad — Smoke does not need an eye.

**Change a worldLine = recook the whole kit, or do not touch it.** Old stock + new line = two biomes wearing one id.

## neighbors

Closed list of ids **that exist**. Means: you *may* cook an Enter edge. Not: the edge is hung.

- `from === to` forbidden (forest→forest is not a neighbor)
- no auto-mirror: `forest.neighbors` contains dusk does **not** imply the reverse — write both sides if you want both
- neighbor outside `ids[]` = broken row
- empty list = cul-de-sac, OK (`asteroid` only has ember)

Hall [adjacency.json](adjacency.json) does **not** apply. Crossing the two tables in one cook = `to: ember` as hall paint vs Lane ember. [LINKS.md](LINKS.md).

## railsVersion

Label of the **body + camera contract**. Now: `lockoff-back-v1`.

Bump when: dog no longer back / FOV changes / door or pathLine grammar changes / dual-video plate breaks.

Do **not** bump for “more moss on the walls” (that is worldLine + recook).

One kit = one version. Forest stock in `v1` mixed with a new clip in `v2` = first/last and lock incoherent. Recook min stock if you bump.

## Identity vs spawn

Two photos, two jobs.

| | `identity` | `spawn` |
|---|---|---|
| What | Bolt back, thumb, often lock | **this** biome’s hall/Lane, dog center / fork |
| Share | **yes** — `lock/bolt-back.jpg` for all 5 | **no** — one spawn per id |
| Serves | CHAR, i2i “same dog” | first/last, underlayer, decay |

Sharing spawn across forest and moss = same pixels, different worldLine → biome invisible or Imagine clones a corridor.

Identity ≠ spawn: using spawn as the thumb nails the décor into CHAR and you lose the dog lock.

## Min stock (play offline)

Required: 3 breaths + 2 walks spawn→A/B + `decay` + spawn still + identity thumb.  
Optional: A↔B (else Recall → spawn → walk-spawn-B).  
**Enter is not** min stock — clip per *edge* only if `to ∈ neighbors`.

Empty stock → this biome’s `decay`, not a mystery cook.
No Hang if stock is incomplete (`"coming"`). No citadel door on a coming row.

The row comes **first**. mp4s come **after** — not before.

## Fill order (kit before hook)

```
1. id + worldLine + pathLine + neighbors + railsVersion
2. spawn still + identity (lock)
3. 3 breaths + 2 walks + decay
4. Smoke hall (dog, first/last, plate)
5. cues + glow → Smoke PLAY (cue honesty). Tap = Bolt's gesture in that frame.
6. Hang row (no longer "coming")
7. only then enter edges / citadel door kind:sprint
```

Invert 7 and 3 = tap into the void or live Imagine ([DONT.md](DONT.md)).

Day 1 does **not** need A↔B, forest→dusk enter, a moss-hall hook, or 60s WFC.

Hall = a graph of photos.  
Biome = the same graph + a chart **in** the film + a decay net.  
No decay and no glow = a painting that runs — not a playable biome.

## Laws

- `worldLine` / `pathLine` frozen; voice ≤12 words **after**, never instead
- identity ≠ spawn (do not share spawn stills across biomes)
- identity thumb may be shared (`lock/bolt-back.jpg`)
- bump `railsVersion` only for camera / body — then recook min stock
- Smoke [SMOKE.md](SMOKE.md) + cue honesty [PLAY.md](PLAY.md) before Hang
- no free-text biome → new `BiomeId` = PR, not chat
- do not `cookRoom` a paint and call it a biome
- aliases do not cook

## Lookups

```
voix "rome" → alias → ember
ember.worldLine     → Imagine matter
ember.spawn         → ember graph only
ember.identity      → same Bolt as forest
ember.neighbors     → dusk, asteroid (Enter legal)
ember.railsVersion  → this stock is v1
ember.stock         → files, after the row
```

Footage: [starboltsprint-forest](https://github.com/StarBoltSprint/starboltsprint-forest). Missing files = `"coming"`.

Citadel hook (after step 6):

```json
"ENTER": {
  "B": { "kind": "sprint", "to": "forest", "clip": "films/enter-b.mp4" }
}
```

`to` ∈ `biomes.ids`, **not** adjacency.json.

## Table tests

Each id has min stock + spawn + identity · neighbors exist · `from !== to` · aliases resolve to **one** id · no two ids share spawn · `worldLine` has no ban stems · json aliases match this page.

## One line

Five keys, nicknames that do not cook, two frozen sentences, neighbors written by hand, one rails version, two photos that are not the same. The kit starts there. The mp4s come after.

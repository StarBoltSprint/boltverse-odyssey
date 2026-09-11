# LINKS — a door holds one neighbor: hall **or** sprint

The player hangs a **target** on a door the same way for both.

```
2nd tap on rift A  →  ENTER[this].A.to
```

`to` is either another **citadel hall** ([CATALOG.md](CATALOG.md)) or a **sprint biome** ([BIOMES.md](BIOMES.md)). He **exits** and runs only on `kind: sprint`.

Not a new site. Same player. Other disc. Same tap.

## Hall vs Lane (do not mix)

Same player, same dog, **two verbs**. Break this and you have a dungeon that loads.

| | Hall | Lane (sprint) |
|---|---|---|
| Word | catalog paint | `BiomeId` |
| `kind` on the door | `hall` | `sprint` |
| Job | `cook-room.mjs` | biome kit + cues (**not** cookRoom) |
| Neighbors | `adjacency.json` | `biomes.json` `neighbors` |
| Body | back, walk, breath | he **runs** ; glow = chart |
| Chrome | none | `m` bar only (never timing) |

`moss` exists on both sides. Without `kind`, an old pack = hall.  
**“citadel moss” ≠ “biome moss”.** [GROK.md](GROK.md) forks on the first word.

Do not put a citadel walk in a Lane. Do not put QTE cues on a hall breath. Both Smokes go blind.

Handoff: the door **changes disc**. Last(enter) → first(Lane) (or 500 ms engine). No new grok.me.

## Two kinds

| `kind` | `to` | What plays |
|---|---|---|
| `hall` | catalog paint (`ember`, `moss`…) | another citadel pack — 3 stills, 5 films, same lock |
| `sprint` | biome id (`forest`, `asteroid`, `ember`, `dusk`, `moss`) | a Lane — Bolt **runs**, picture is the clock |

Same laws as [CATALOG.md](CATALOG.md) adjacency:

- one door, **one** `to`
- no link = stay (breath on that sill)
- not from spawn
- walk is not a link
- return is **another** edge, optional
- one Enter cook per edge
- opt-in floor 3 (or sprint hang)

## Machine

In the **from** pack `room.json`:

```json
"ENTER": {
  "A": { "kind": "sprint", "to": "forest", "clip": "films/enter-a.mp4" },
  "B": { "kind": "hall",   "to": "ember",  "clip": "films/enter-b.mp4" }
}
```

`null` / missing = wall that breathes.

`kind` omitted → `hall` (old packs).

`to` must exist in the closed list for that kind. Off-list → do not cook, ask.

## Sprint disc

Not this repo’s `films/walk-*.mp4`.

Sprint play grammar: [PLAY.md](PLAY.md) (cues, `m`). Hall player does not grow that stack.

Sprint stock lives with the biome table ([starboltsprint-forest](https://github.com/StarBoltSprint/starboltsprint-forest)): Lane clip + identity thumb + decay. Kit **before** hook ([BIOMES.md](BIOMES.md) fill order). Missing = `"coming"` — do not hang the door.

Footage for the sprint cooks on confirm (ticket), not on the walk toward the door.

## Player phrase

- "branche room 2 sur la porte A" → `kind: hall`
- "colle le sprint forest sur la porte B" / "biome asteroid on door A" → `kind: sprint`

Same sentence. Different disc.

## One line

**`kind` picks the disc. The film is the clock. Nothing helps by talking over it.**  
Moss hall and moss Lane may share a word, not a recipe. The tap does not change.

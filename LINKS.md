# LINKS — a door holds one neighbor: hall **or** sprint

The player hangs a **target** on a door the same way for both.

```
2nd tap on rift A  →  ENTER[this].A.to
```

`to` is either another **citadel hall** ([CATALOG.md](CATALOG.md)) or a **sprint biome** ([BIOMES.md](BIOMES.md)) (he still stands) or a **sprint biome** (he **exits** and runs).

Not a new site. Same player. Other disc.

## Two kinds

| `kind` | `to` | What plays |
|---|---|---|
| `hall` | catalog paint (`ember`, `moss`…) | another citadel pack — 3 stills, 5 films, same lock |
| `sprint` | biome id (`forest`, `asteroid`, `ember`, `dusk`, `moss`) | a Lane — ~60s Imagine, Bolt **runs**, picture is the clock |

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

Sprint play grammar: [PLAY.md](PLAY.md) (cues, `m`, bone 60s). Hall player does not grow that stack.

Sprint stock lives with the biome table ([starboltsprint-forest](https://github.com/StarBoltSprint/starboltsprint-forest)): Lane clip + identity thumb + decay. The citadel player **hands off** after the curtain: last frame of enter = first frame of the Lane (or 500ms engine crossfade). Picture-clock continues. No WASD.

Footage for the sprint cooks on confirm (ticket), not on the walk toward the door.

## Player phrase

- "branche room 2 sur la porte A" → `kind: hall`
- "colle le sprint forest sur la porte B" / "biome asteroid on door A" → `kind: sprint`

Same sentence. Different disc.

## One line

**A door is a slot.** You hang a hall or you hang a Lane. The tap does not change.

# LINKS — a door holds one neighbor: hall **or** sprint

Same tap. Same player. Other disc. [HANDOFF.md](HANDOFF.md) is the joint (in and **out**).

```
2nd tap on rift A  →  ENTER[this].A.to
```

`to` = catalog paint (`kind: hall`) or `BiomeId` (`kind: sprint`).

## Machine

Hall pack:

```json
"ENTER": {
  "B": { "kind": "sprint", "to": "forest", "clip": "films/enter-b.mp4" }
}
```

Lane row (return, optional year-0):

```json
"RETURN": { "kind": "hall", "to": "moss", "clip": "films/return-forest-moss.mp4" }
```

Missing RETURN = stay in decay / Recall `/`. Not `adjacency.json`.

## Laws

- one door, **one** `to`
- no link = stay
- not from spawn
- walk is not a link
- return is **another** edge, 2nd tap, peak does not arm
- kit `coming` → do not hang the door

**“citadel moss” ≠ “biome moss”.** Job: `cook-room` vs `cook-biome`.

## One line

**`kind` picks the disc.** In = enter clip + calm-1. Out = return clip + hall spawn under the veil. No clip = you stay where you are.

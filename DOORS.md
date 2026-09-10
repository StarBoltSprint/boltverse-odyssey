# DOORS — two energy rifts in the wall, not furniture, not UI

Architecture (every hall) + energy look (Room1 grammar, Room2 **same rifts** even if the vault is crystal).

The catalog paints the **stone**. It does not redesign the doors. [CATALOG.md](CATALOG.md)

## Architecture (not UI)

Doors live **in the plate**, not chrome rectangles.

Legal:

- a **hole** (jambs + lintel + interior depth)
- **thickness / reveal**
- **sill** on the floor (feet can meet it)
- **gap** of wall/pillar between the two
- upper-mid of the 9:16; **both** readable from spawn

Illegal:

- chrome boxes / orbs / hitbox overlays
- flat panels of “teal paint”
- one door, or a third door
- black void through (energy/lit depth; the floor continues)

## Look — rift, not wood

| Side | Color **in the encode** |
|---|---|
| **A LEFT** | cyan-teal energy fill |
| **B RIGHT** | gold-orange energy fill |

These are **teleport energy portals** filling the opening (stable **RECTs**).

Not:

- open wood doors / wood painted teal-gold
- a cave backdrop behind a swinging leaf
- a morphing blob

Fill = a closed threshold of readable energy, not a spinning puddle.

Room2 may be a crystal vault. **The doors still copy these rifts.** Same RECT, same colors, same sill.

## Path (cue in the world)

A gold-cyan **fork** from the paws to **both** sills.  
Path ~**5–15%** of frame H, clear of foliage.  
Glow = pulse in the fork / on the sill — **not** a chrome orb overlay.

## Smoke

Layer C ([scripts/smoke-identity.md](scripts/smoke-identity.md)):

- `identity.third_door` — a third portal
- `identity.door_wood` — wood leaf / ajar timber
- `identity.door_flat` — painted panel, no jambs/sill
- `identity.door_morph` — RECT → circle mid-walk
- `identity.door_void` — black hole, no energy fill
- `identity.door_chrome` — orb / UI overlay as the door
- `identity.door_cut` — a rift cropped (illegal except last second of enter)

Two rifts RECT, L cyan / R gold, gap, sills. Overlay may only **trace**; color is already in the encode.

Wood ajar = FAIL even if the hall craft looks nice. Keep veto.

## One line

Two **energy rifts** (L cyan / R gold) with jambs + sill + gap — architecture, not UI, **never** open wood.

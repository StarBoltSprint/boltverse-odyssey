# 19 — Luminous path climb (Lena / Decree 456)

**Sealed 2026-09-20 (SmiR).** Hang ≠ wipe.

When the run rises from ground biome toward space (law 18 Lena climb), Bolt does **not** float in empty void. A **luminous path** (chemin lumineux) becomes the road — and Bolt keeps the sealed **6 s treadmill gallop** on it.

## HARD

| | Law |
|---|---|
| Path | Luminous corridor forms **ahead of the paws** (Decree 456 / PathGenerator). Not a pre-painted asphalt forever. |
| Lanes | **Still 3 lanes** L / C / R. Same ribbon `(s, λ)`. A/D + jump stay valid on the climb. |
| Bolt | **REUSE** `lock/bolt-gallop-cycle.mp4`. Same GPU compositor (17). No new “flying gallop” Imagine. |
| Contact | Paws stay planted on the **path** (shadow on path while grounded on it). `shadowK` follows path surface, not old asphalt. |
| Transition | Ground plate → luminous path plate (or crossfade). Path may pitch / rise in the picture toward void / planet. |
| Ban | Bolt levitating with no path under paws · single thin beam (loses L/C/R) · inventing airborne gallop · wiping ground biomes |

## Stack

```
Video A: empty road  →  Video A': luminous 3-lane path (rush, 48fps)
Bolt:    same keyed cycle, Y follows path height in frame
FX:      prints optional on path albedo; ice/ember row from law 16 still applies if path carries that grade
```

## Cook notes

- Cook A' as empty **path** plate: ZERO dog, three readable luminous lanes, vanishing point, SPEED LAW.
- `path.json` / ribbon stays valid — width may glow but laneFrac (13d) still clamps Bolt.
- Climb cue: when `m` / plate role hits lean→peak (or explicit enter-space), swap or dissolve to A'.

## Related

[18-room-starmap-lena.md](18-room-starmap-lena.md) · [12-lane-path-ribbon.md](12-lane-path-ribbon.md) · [00-PRIORITY0-any-biome.md](00-PRIORITY0-any-biome.md) · [17-live-compositor.md](17-live-compositor.md)

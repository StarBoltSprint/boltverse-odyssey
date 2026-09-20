# 18 — Room → Star Map → seal → Door → Lena climb

**Audience:** cold Grok building Citadel + constellation + biome for a random player.  
**Sealed 2026-09-20 (SmiR).** Hang ≠ wipe. Picture is the clock.

This is the **player journey**. Not a Three.js rewrite of Odyssey. Not a chrome menu.

---

## Flow (HARD)

```
Citadel ROOM (2 doors + star map center)
    │
    tap STAR MAP
    ▼
CONSTELLATION (Space LOD — void + planet orbs)
    │
    pick PLANET  →  SEAL choice  →  return ROOM
    │
    tap DOOR A or B
    ▼
BIOME SPRINT (Lane B-stack — ground)
    │
    Dr Lena: Paw-to-Galaxy / progressive awakening
    ▼
SPACE SPRINT (climb / void corridor)
    │
    ▼
ARRIVE on sealed PLANET (orbital / surface plate)
```

| Step | What the player feels | Kitchen |
|---|---|---|
| 1. Room | Nameless picture-menu. Two energy doors (cyan L / gold R). **Star map** tappable in center. Zero chrome words. | Citadel hall grammar — locked camera, Bolt walks in frame |
| 2. Star map tap | Enter **constellation** — one coherent space map (Space LOD). Zoom in = fullscreen world film; zoom out = planet orbs in void. | `constellation/` · [LAW.md](../../constellation/LAW.md) |
| 3. Pick + seal | Choosing a planet **locks** destination. No flip-flop mid-run. Return to room with seal held (state, not a HUD essay). | Store `sealedPlanetId` (session / Pack). Ban reopening map to change mid-door-run unless SmiR reopens |
| 4. Door | Door A or B starts the **sprint run** toward the sealed planet. Door = depart, not planet picker. | Graph edge: door → biome enter |
| 5. Biome sprint | Ground Lane B-stack (empty plate + GPU Bolt). Any biome paint. Frost-parity laws 00 / 15 / 16 / 17. | [00](00-PRIORITY0-any-biome.md) · [17](17-live-compositor.md) |
| 6. Lena climb | Momentum / picture densifies → world rises to space. Not an XP bar. Sprint **earns** the cosmos reveal (Decrees 504/505/508 — Paw-to-Galaxy). | Quiet sparse → denser void; then space corridor plate(s) |
| 7. Arrive | Reach sealed planet — orbital film / surface plate matching constellation node. | Planet asset from constellation cook; hang ≠ wipe |

---

## HARD rules

1. **Star map ≠ door.** Map = choose destination. Door = start the run.
2. **Seal before door.** Entering a door without a sealed planet = FAIL (or default only if SmiR defines one — default = none / prompt back to map).
3. **One seal per run.** Changing planet requires returning to map **between** runs, not mid-sprint.
4. **Constellation = Space LOD.** No collage of unrelated videos. Black void + coherent orbs. See constellation LAW.
5. **Doors stay Citadel grammar.** Energy portals cyan L / gold R. No wood doors. No UI chrome boxes. Locked-off camera in hall clips.
6. **Biome → space is one journey.** Not a separate app. Same engine graph: room node → constellation overlay → biome plates → space plates → planet node.
7. **Bolt REUSE.** Gallop = `lock/bolt-gallop-cycle.mp4` (6 s). GPU compositor (17). Never invent sprint for the climb.
8. **Pack.** Live auto-embeds Pack. Destination seal may mirror into Pack profile later — never block play on Pack down.
9. **Hang ≠ wipe.** New planets / biomes append. Don’t delete hung halls or constellation orbs to “make room”.

---

## State (minimal)

```
sealedPlanetId: null | string   // set in constellation, cleared after arrive (or kept as last)
phase: room | constellation | biome | space | arrive
```

No second wallet. No Connect Wallet. Picture + taps only.

---

## Cook checklist (new Grok)

1. Hall still + breath + any-to-any walks (2 doors + **center star-map** tappable).
2. Wire tap map → constellation Space LOD (existing `constellation/` or Live hang).
3. On planet pick: set `sealedPlanetId`, exit to room.
4. Door enter: start biome for that journey (paint may match planet family — frost planet → frost-ish ground, etc.).
5. After biome momentum threshold / plate cue: transition to space sprint plates.
6. Final plate / enter: arrive planet matching seal.
7. Smoke: map before door · seal sticky · door starts run · Lena climb readable · arrive = sealed planet.

---

## Related

- [constellation/LAW.md](../../constellation/LAW.md) — Space LOD  
- [00-PRIORITY0-any-biome.md](00-PRIORITY0-any-biome.md) — any biome Frost-parity  
- [17-live-compositor.md](17-live-compositor.md) — GPU Bolt  
- Citadel door / hall docs in repo root (`DOORS.md`, `ROOM.md`, `ENTER.md`)  
- Dr Lena — Paw-to-Galaxy / meaningful sprint (lore; picture densifies with flow)

**Not this doc:** implementing a full 3D engine. Constellation stays Imagine-video Space LOD unless SmiR reopens.

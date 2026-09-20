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
| 2. Star map tap | Enter **constellation** — one coherent space map (Space LOD). Zoom in = fullscreen world film; zoom out = planet orbs in void. | Federate URL: same-frame replace to `CONSTELLATION_ORIGIN` (default = SmiR official Live; pointer, not pixels). `constellation/` · [LAW.md](../../constellation/LAW.md) |
| 3. Pick + seal | Choosing a planet **locks** destination. No flip-flop mid-run. Return to room with seal held (state, not a HUD essay). | Set `sealedPlanetId` (query / sessionStorage / Pack) → same-frame replace to `ROOM_ORIGIN`. Ban reopening map to change mid-door-run unless SmiR reopens |
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
6. **Biome → space is one journey.** Not a separate app. Player graph: room → constellation → biome → space → planet. Kitchen: **federate URLs** (room Live ↔ constellation Live), not a constellation rebuild inside the room.
7. **Bolt REUSE.** Gallop = `lock/bolt-gallop-cycle.mp4` (6 s). GPU compositor (17). Never invent sprint for the climb.
8. **Pack.** Live auto-embeds Pack. Destination seal may mirror into Pack profile later — never block play on Pack down.
9. **Hang ≠ wipe.** New planets / biomes append. Don’t delete hung halls or constellation orbs to “make room”.
10. **Federate URL.** Room Live and constellation Live are **different** grok.me / sandbox URLs. Tap map **lands on** the already-built constellation Live. That **is** the federation. See HARD section below.

---

## HARD — Federate URL

SmiR: room Live ≠ constellation Live. Two hosts. One journey. The player must **not** feel they left the game.

Tap star map in the room → **land on the constellation Live URL** (the already-built `boltverse-constellation` hang). That **is** URL federation: in-game enter another Live.

1. **Room stores `CONSTELLATION_ORIGIN`** (or similar) = **absolute URL** of the constellation Live. **Default = SmiR official constellation Live (canon).** Do **not** invent a new grok.me. Do **not** treat the room / Sprint play URL as the constellation host. Tap map → `location.replace` (or same-frame full-screen navigate) to that URL. Prefer same-frame. Ban chrome new-tab lecture. Which map: pointer swap (Forge URL B, or chat `list star maps` / `use map X`) — see below.
2. **Constellation on seal planet** → set `sealedPlanetId` (query and/or `sessionStorage` and/or Pack) → **return to `ROOM_ORIGIN`** (absolute URL of the room Live that sent the player). Same-frame replace. Seal sticky across the hop.
3. **Room reads the seal and arms doors.** No seal → door FAIL (or send back to map). Door starts biome sprint → Lena climb → arrive sealed planet.
4. **Ban:** paste-URL wallet forms · ask the player to type a grok.me · Connect Wallet · rebuild constellation inside every room Live. Hang the pointer via **Grok chat / Forge only**. Pack may carry the seal later — never block play on Pack down.
5. **Endgame same pattern:** door / enter into **other players’** citadels / biomes = federate to **their** Live URL (`CITADEL_ORIGIN` / biome origin). Same-frame. Same seal/state hop. Not a new app. Not a wallet gate.

Kitchen constants (do not invent hosts — use the Lives already built):

```
CONSTELLATION_ORIGIN  // default = SmiR official constellation Live (canon). Pointer, not pixels.
ROOM_ORIGIN           // absolute this-room Live (the hall that opened the map)
sealedPlanetId        // query | sessionStorage | Pack — set on seal, read on return
```

Player feel: still in Odyssey. Kitchen: two Lives, one replace.

### Which star map URL hangs in the room

The star map in the room is a **URL pointer** (`CONSTELLATION_ORIGIN`), **not** baked pixels. Swap the pointer. Do not recook the hall to change maps.

**Default:** `CONSTELLATION_ORIGIN` = **SmiR official constellation Live** (canon — the already-built `boltverse-constellation` hang). Do **not** invent a new grok.me. Do **not** use the room / Sprint play URL as the map.

Player wants **another** map:

1. **Forge / remix** their own constellation Live → that cook yields **URL B** → hang URL B as **their** room `CONSTELLATION_ORIGIN`. Same federate hop. Do not rebuild Space LOD inside the room Live.
2. **Or** pick another Packmate’s **hung** constellation from the **chat catalog** — on ask: `list star maps` / `use map X`. Hung maps only (never invent a name). Same pointer swap. Unhung → not hung yet; do not fake it. Never dump this catalog on Welcome.

**Hang path:** Grok chat / Forge only. Grok writes the pointer.

**Ban:** paste-URL forms · wallet / Connect Wallet · “type the grok.me” chrome · baking constellation pixels into the room plate.

---

## State (minimal)

```
sealedPlanetId: null | string   // set in constellation, cleared after arrive (or kept as last)
phase: room | constellation | biome | space | arrive
CONSTELLATION_ORIGIN: string    // default = SmiR official constellation Live (canon). Pointer, not pixels.
ROOM_ORIGIN: string             // absolute room Live URL (return hop)
```

No second wallet. No Connect Wallet. Picture + taps only. No “paste this URL”.

---

## Cook checklist (new Grok)

1. Hall still + breath + any-to-any walks (2 doors + **center star-map** tappable).
2. Wire tap map → **federate** `location.replace` to `CONSTELLATION_ORIGIN` (default = SmiR official constellation Live). Same-frame. Pointer, not pixels. Do not rebuild Space LOD inside the room. Player pick: Forge URL B, or chat `list star maps` / `use map X` (hung only).
3. On planet pick: set `sealedPlanetId` (query / sessionStorage / Pack) → `location.replace` back to `ROOM_ORIGIN`.
4. Door enter: start biome for that journey (paint may match planet family — frost planet → frost-ish ground, etc.).
5. After biome momentum threshold / plate cue: transition to space sprint plates.
6. Final plate / enter: arrive planet matching seal.
7. Smoke: map before door · default hop = SmiR official constellation Live · pointer swap on `use map X` / Forge URL B · same-frame hop · seal sticky on return · door starts run · Lena climb readable · arrive = sealed planet. Ban new-tab / paste-URL forms / wallet / rebuild-constellation-in-room.

---

## Related

- [constellation/LAW.md](../../constellation/LAW.md) — Space LOD  
- [00-PRIORITY0-any-biome.md](00-PRIORITY0-any-biome.md) — any biome Frost-parity  
- [17-live-compositor.md](17-live-compositor.md) — GPU Bolt  
- Citadel door / hall docs in repo root (`DOORS.md`, `ROOM.md`, `ENTER.md`)  
- Dr Lena — Paw-to-Galaxy / meaningful sprint (lore; picture densifies with flow)

**Not this doc:** implementing a full 3D engine. Constellation stays Imagine-video Space LOD unless SmiR reopens.

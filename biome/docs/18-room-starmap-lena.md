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
    SPACE SPRINT (luminous 3-lane path climb — not float)
    │
    ▼
ARRIVE on sealed PLANET (orbital / surface plate)
```

| Step | What the player feels | Kitchen |
|---|---|---|
| 1. Room | Nameless picture-menu. Two energy doors (cyan L / gold R). **Star map** tappable in center. Zero chrome words. | Citadel hall grammar — locked camera, Bolt walks in frame |
| 2. Star map tap | Enter **constellation** — one coherent space map (Space LOD). Zoom in = fullscreen world film; zoom out = planet orbs in void. | Federate URL: same-frame replace to `CONSTELLATION_ORIGIN`. **HARD LOCK default = SmiR official Star Map KEEP** (not a random player map; no invented grok.me). `constellation/` · [LAW.md](../../constellation/LAW.md) |
| 3. Pick + seal | Choosing a planet **locks** destination. No flip-flop mid-run. Return to room with seal held (state, not a HUD essay). | Set `sealedPlanetId` (query / sessionStorage / Pack) → same-frame replace to `ROOM_ORIGIN`. Ban reopening map to change mid-door-run unless SmiR reopens |
| 4. Door | Door A or B starts the **sprint run** toward the sealed planet. Door = depart, not planet picker. | Graph edge: door → biome enter |
| 5. Biome sprint | Ground Lane B-stack (empty plate + GPU Bolt). Any biome paint. Frost-parity laws 00 / 15 / 16 / 17. | [00](00-PRIORITY0-any-biome.md) · [17](17-live-compositor.md) |
| 6. Lena climb | Momentum / picture densifies → world rises to space. Not an XP bar. Sprint **earns** the cosmos reveal (Decrees 504/505/508 — Paw-to-Galaxy). **Luminous 3-lane path under Bolt** — not float. Same L/C/R dodge. | [19](19-luminous-path-climb.md) · paste [COLD_START-luminous-path.md](COLD_START-luminous-path.md). Path plate A' + REUSE 6s |
| 7. Arrive | Reach sealed planet — orbital film / surface plate matching constellation node. | Planet asset from constellation cook; hang ≠ wipe |

---

## HARD rules

1. **Star map ≠ door.** Map = choose destination. Door = start the run.
2. **Seal before door.** Entering a door without a sealed planet = FAIL (or default only if SmiR defines one — default = none / prompt back to map).
3. **One seal per run.** Changing planet requires returning to map **between** runs, not mid-sprint.
4. **Constellation = Space LOD.** No collage of unrelated videos. Black void + coherent orbs. See constellation LAW.
5. **Doors stay Citadel grammar.** Energy portals cyan L / gold R. No wood doors. No UI chrome boxes. Locked-off camera in hall clips.
6. **Biome → space is one journey.** Not a separate app. Player graph: room → constellation → biome → space → planet. Kitchen: **federate URLs** (room Live ↔ constellation Live), not a constellation rebuild inside the room.
7. **Bolt REUSE.** Gallop = `lock/bolt-gallop-cycle.mp4` (6 s). GPU compositor (17). Never invent sprint for the climb. Lena climb = **luminous 3-lane path** under the paws (law 19) — not a void float. Same ribbon L/C/R.
8. **Pack.** Live auto-embeds Pack. Destination seal may mirror into Pack profile later — never block play on Pack down.
9. **Hang ≠ wipe.** New planets / biomes append. Don’t delete hung halls or constellation orbs to “make room”.
10. **Federate URL.** Room Live and constellation Live are **different** grok.me / sandbox URLs. **HARD LOCK default star map = SmiR’s official Star Map** (KEEP — not a random player map). Tap map **lands on** that origin. That **is** the federation. See HARD section below.

---

## HARD — Federate URL

SmiR: room Live ≠ constellation Live. Two hosts. One journey. The player must **not** feel they left the game.

Tap star map in the room → **land on SmiR’s official Star Map** (default `CONSTELLATION_ORIGIN` = canon Space LOD KEEP). That **is** URL federation: in-game enter another Live.

1. **Room stores `CONSTELLATION_ORIGIN`** (or similar) = **absolute URL** of the constellation Live. **HARD LOCK default = SmiR’s official Star Map** (canon Space LOD KEEP — not a random player map). See default lock below. Do **not** invent a grok.me. Do **not** treat the room / Sprint play URL as the constellation host. Tap map → `location.replace` (or same-frame full-screen navigate) to that URL. Prefer same-frame. Ban chrome new-tab lecture. Owner may later hang a different federated URL — see below.
2. **Constellation on seal planet** → set `sealedPlanetId` (query and/or `sessionStorage` and/or Pack) → **return to `ROOM_ORIGIN`** (absolute URL of the room Live that sent the player). Same-frame replace. Seal sticky across the hop.
3. **Room reads the seal and arms doors.** No seal → door FAIL (or send back to map). Door starts biome sprint → Lena climb → arrive sealed planet.
4. **Ban:** paste-URL wallet forms · ask the player to type a grok.me · invent a fake constellation grok.me · Connect Wallet · rebuild constellation inside every room Live · default a new room to a random Packmate map. Hang the pointer via **Grok chat / Forge only**. Pack may carry the seal later — never block play on Pack down.
5. **Endgame same pattern:** door / enter into **other players’** citadels / biomes = federate to **their** Live URL (`CITADEL_ORIGIN` / biome origin). Same-frame. Same seal/state hop. Not a new app. Not a wallet gate.

Kitchen constants (do not invent hosts — use the Lives already built):

```
CONSTELLATION_ORIGIN  // HARD LOCK default = SmiR official Star Map (KEEP). Pointer, not pixels. No invented grok.me.
ROOM_ORIGIN           // absolute this-room Live (the hall that opened the map)
sealedPlanetId        // query | sessionStorage | Pack — set on seal, read on return
```

Player feel: still in Odyssey. Kitchen: two Lives, one replace.

### HARD LOCK — default star map = SmiR’s official Star Map

**Not a random player map.** Every **new** room points at SmiR’s map unless the **room owner** later hangs a different federated URL.

**Default `CONSTELLATION_ORIGIN` = SmiR canon Space LOD KEEP:**

- GitHub [`StarBoltSprint/boltverse-constellation`](https://github.com/StarBoltSprint/boltverse-constellation)
- Also hung under Odyssey [`constellation/`](../../constellation/README.md) · [`constellation/LAW.md`](../../constellation/LAW.md)

**Published Live URL:** no stable grok.me / Live string for SmiR’s map is hung in these docs. **Do not invent one.** Until SmiR pastes a published constellation Live URL into this law:

- default origin = **SmiR constellation KEEP Live when published**
- until then, a room Live may **embed / serve** Odyssey `constellation/` (the hung KEEP) **or** use the constellation repo play URL **once SmiR pastes it**

Do **not** treat `https://boltverse-odysseyyyy.grok.me` (Sprint play) as the star map host.

### Which star map URL hangs in the room

The star map in the room is a **URL pointer** (`CONSTELLATION_ORIGIN`), **not** baked pixels. Swap the pointer. Do not recook the hall to change maps.

**Default:** SmiR’s official Star Map (KEEP above). Do **not** invent a grok.me. Do **not** use the room / Sprint play URL as the map.

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
CONSTELLATION_ORIGIN: string    // HARD LOCK default = SmiR official Star Map KEEP. No invented grok.me. Pointer, not pixels.
ROOM_ORIGIN: string             // absolute room Live URL (return hop)
```

No second wallet. No Connect Wallet. Picture + taps only. No “paste this URL”.

---

## Cook checklist (new Grok)

1. Hall still + breath + any-to-any walks (2 doors + **center star-map** tappable).
2. Wire tap map → **federate** `location.replace` to `CONSTELLATION_ORIGIN`. **HARD LOCK default = SmiR official Star Map** (`StarBoltSprint/boltverse-constellation` / Odyssey `constellation/`). No invented grok.me. Until SmiR pastes a published Live URL: embed/serve hung `constellation/`. Same-frame. Pointer, not pixels. Owner may later hang URL B or `use map X` (hung only).
3. On planet pick: set `sealedPlanetId` (query / sessionStorage / Pack) → `location.replace` back to `ROOM_ORIGIN`.
4. Door enter: start biome for that journey (paint may match planet family — frost planet → frost-ish ground, etc.).
5. After biome momentum threshold / plate cue: transition to space sprint — **luminous 3-lane path** plate A' (law 19), not empty-void float.
6. Final plate / enter: arrive planet matching seal.
7. Smoke: map before door · **new room default = SmiR official Star Map KEEP** (not a random Packmate map) · no invented grok.me · pointer swap only after owner hang · same-frame hop · seal sticky on return · door starts run · Lena climb readable · arrive = sealed planet. Ban new-tab / paste-URL forms / wallet / rebuild-constellation-in-room.

---

## Related

- [constellation/LAW.md](../../constellation/LAW.md) — SmiR Space LOD KEEP (also [`StarBoltSprint/boltverse-constellation`](https://github.com/StarBoltSprint/boltverse-constellation))  
- [00-PRIORITY0-any-biome.md](00-PRIORITY0-any-biome.md) — any biome Frost-parity  
- [17-live-compositor.md](17-live-compositor.md) — GPU Bolt  
- [19-luminous-path-climb.md](19-luminous-path-climb.md) — Lena climb = luminous 3-lane path (not float). Paste: [COLD_START-luminous-path.md](COLD_START-luminous-path.md)  
- Citadel door / hall docs in repo root (`DOORS.md`, `ROOM.md`, `ENTER.md`)  
- Dr Lena — Paw-to-Galaxy / meaningful sprint (lore; picture densifies with flow)

**Not this doc:** implementing a full 3D engine. Constellation stays Imagine-video Space LOD unless SmiR reopens.

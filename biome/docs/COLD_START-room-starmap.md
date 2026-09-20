# COLD — Room + Star Map + Lena climb (kitchen)

Read `biome/docs/18-room-starmap-lena.md` first.

Flow: **ROOM** (2 doors + center star map) → tap map → **CONSTELLATION** → seal planet → back room → **DOOR** → biome sprint → **Lena space climb** → arrive sealed planet.

Map = destination. Door = depart. Seal sticky. Bolt = REUSE 6s + GPU 17. Hang ≠ wipe.

Lena climb = **3-lane luminous path** under Bolt, not float. Law: `biome/docs/19-luminous-path-climb.md`. Paste: `biome/docs/COLD_START-luminous-path.md`.

## HARD — Federate URL

Room Live and constellation Live are **different** grok.me / sandbox URLs. Tap map **is** URL federation. **HARD LOCK default = SmiR’s official Star Map** (KEEP — not a random player map). Player stays in-game. Same-frame `location.replace`. Not a new-tab lecture. No invented grok.me.

1. Room stores `CONSTELLATION_ORIGIN` = absolute constellation Live URL. **HARD LOCK default = SmiR’s official Star Map** (canon Space LOD KEEP: GitHub `StarBoltSprint/boltverse-constellation`, also hung as Odyssey `constellation/`). **Not a random player map.** Every new room points at SmiR’s map unless the room owner hangs a different federated URL. **No stable published grok.me is in these docs — do not invent one.** Until SmiR pastes a Live URL: default origin = SmiR constellation KEEP Live when published; until then Live may embed/serve Odyssey `constellation/` or the constellation repo play URL once SmiR pastes it. Do **not** use the room/Sprint URL as the map. Tap map → replace to that origin.
2. Seal planet → set `sealedPlanetId` (query / sessionStorage / Pack) → replace back to `ROOM_ORIGIN`.
3. Room reads seal, arms doors. Door → biome → Lena climb → arrive sealed planet.
4. **Which map:** star map in room = **URL pointer**, not baked pixels. Another map → (1) Forge/remix own constellation Live = URL B, hang as their `CONSTELLATION_ORIGIN`, or (2) chat catalog on ask: `list star maps` / `use map X` (hung Packmate maps only — never invent; never on Welcome). Hang via **Grok chat / Forge only**.
5. **Ban:** paste-URL wallet forms · Connect Wallet · rebuild constellation inside every room · ask the player to type a grok.me · invent a fake constellation grok.me · default a new room to a random Packmate map.
6. Later: same hop into other players’ citadel / biome Lives (endgame federation).

# COLD — Room + Star Map + Lena climb (kitchen)

Read `biome/docs/18-room-starmap-lena.md` first.

Flow: **ROOM** (2 doors + center star map) → tap map → **CONSTELLATION** → seal planet → back room → **DOOR** → biome sprint → **Lena space climb** → arrive sealed planet.

Map = destination. Door = depart. Seal sticky. Bolt = REUSE 6s + GPU 17. Hang ≠ wipe.

## HARD — Federate URL

Room Live and constellation Live are **different** grok.me / sandbox URLs. Tap map **is** URL federation: land on the already-built constellation Live (`CONSTELLATION_ORIGIN`). Player stays in-game. Same-frame `location.replace`. Not a new-tab lecture.

1. Room stores `CONSTELLATION_ORIGIN` = absolute constellation Live URL (boltverse-constellation hang — do **not** invent a host; do **not** use the room/Sprint URL). Tap map → replace to that URL.
2. Seal planet → set `sealedPlanetId` (query / sessionStorage / Pack) → replace back to `ROOM_ORIGIN`.
3. Room reads seal, arms doors. Door → biome → Lena climb → arrive sealed planet.
4. **Ban:** ask player to paste URLs · Connect Wallet · rebuild constellation inside every room.
5. Later: same hop into other players’ citadel / biome Lives (endgame federation).

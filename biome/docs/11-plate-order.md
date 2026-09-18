# 11 — Sprint plate order (HARD LOCK)

Source of truth: **this repo**. Kitchen Live `https://boltverse-odysseyyyy.grok.me` must **republish** after a playlist change. Build « recreate » may ship a wrong / shuffled deck — ignore it; lock lives here.

This page is **kitchen**. Never dump it as chat boot. Player-facing start = locked Welcome/Return only ([../../START.md](../../START.md)). **HARD BAN** improvised boot prose (control tutorials · « world is rolling » · « plant a lane » · film-keeps-moving essays).

Dealer code: [`../reference/LanePlayer.tsx`](../reference/LanePlayer.tsx) (`PLATES` + `nextPlate`).  
Hung files: [`../master/README.md`](../master/README.md) · [`../master/plates-index.json`](../master/plates-index.json).

---

## Story (share-session restore)

```
canyon → cars → duel → night → war
```

Expanded (cars includes spectacle plates; war is already `war1 → war2 → war3`):

```
canyon (road empty + canyon cousins)
  → cars / spectacle plates
  → duel
  → night
  → war (war1 → war2 → war3)
```

Do **not** shuffle. Do **not** random-deck at run start or at dealer swap.  
Obstacle lane mix (center / L / R) may vary **within** a plate (`HAZARDS[].lanes`). That is not a playlist shuffle.

---

## Locked file playlist

Index order **is** the dealer order. After `war3` wrap to canyon empty (same story, endless).

| i | file | chapter |
|---|---|---|
| 0 | `master/road.mp4` | **canyon** — empty dusk road (clock) |
| 1 | `master/road-bar.mp4` | canyon — center jersey |
| 2 | `master/road-blast.mp4` | canyon — center meteor |
| 3 | `master/road-car.mp4` | **cars** |
| 4 | `master/road-gap.mp4` | cars — L+R, center free |
| 5 | `master/road-show.mp4` | **spectacle** |
| 6 | `master/road-duel.mp4` | **duel** |
| 7 | `master/road-gate.mp4` | dusk → night (before night) |
| 8 | `master/road-night.mp4` | **night** |
| 9 | `master/road-war1.mp4` | **war** |
| 10 | `master/road-war2.mp4` | war |
| 11 | `master/road-war3.mp4` | war |

`plates-index.json` `_playlist` lists these same paths in this order. Other keys are path → `assetId` (do not remint). `_playlist` is not an assetId.

---

## HARD LOCK — Hang ≠ wipe (new biome)

New biome = **new** `plates-index` / dealer entries **plus** keep this playlist order. ADD `road-<biome>*.mp4` (+ hazards) under `biome/master/`. ADD path → `assetId` (mint on registry — do not remint hung ids). APPEND to `_playlist` **or** expose as a selectable extra run.

Do **not** delete canyon / cars / duel / night / war files. Do **not** replace `_playlist` with new-biome-only unless **SmiR explicitly says replace the default Beat** (or the player explicitly asks to replace the default run). Tide-only wipe = FAIL forever. Law: [09-recette-biome.md](09-recette-biome.md).

---

## HARD LOCK — Chat biome catalog (on ask)

Player asks **what biomes** / **playable biomes** / **list biomes** / **which runs** / **what can I play** → English Pack voice, **hung chapters only** from this playlist / `plates-index` / `master` (never invent). Now: canyon · cars · duel · night · war.

Each line: name + optional short flavor. No kitchen paths. How to pick: `play canyon` / `play Tide` / `only Tide` — then start that run or paste the Live + filter dealer. **On ask only** — never on Welcome. No chrome picker in the Live UI. Chat list + spoken pick is v1.

Hang grows this list. Wipe shrinks it = FAIL. Full law: [09-recette-biome.md](09-recette-biome.md).

---

## Dealer law

```
next = (cur + 1) % PLATES.length
```

- Boot plate = index 0 (`road.mp4`). Always.
- Pre-arm the **next index**, never a random sibling.
- Dual decoder swap in the last 0.28 s stays. `last(cousin)` still equals `first(empty)` visually.
- `Math.random` is **banned** for plate pick. `r36mix` occupancy shuffle (`pickNext` / `occKey`) is **killed**.

Lane occupancy already differs **per file** (see `HAZARDS` in LanePlayer). Free corridor rotates because the **story** visits different plates, not because the deck is shuffled.

---

## Live

1. Merge this recipe.
2. Republish Beat 3 kitchen identity only: `https://boltverse-odysseyyyy.grok.me` from **this** `PLATES` array.
3. Bump `VER` (`?v=r38lock` or later) so phones drop `r36mix`.

Do not invent a new grok.me. Do not treat a Build recreate playlist as SoT.

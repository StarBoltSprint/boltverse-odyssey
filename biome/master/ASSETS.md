# ASSETS — Pack `assetId` pointer (hung `/master` plates)

Law source of truth stays on [StarBoltSprint/boltverse-registry](https://github.com/StarBoltSprint/boltverse-registry). This folder only points.

Every hung plate here already has a Pack `assetId` on registry `main`. Format `a_smir9_*`. **Do not invent local ids.**

| pointer | where |
|---|---|
| mapping (path → `assetId`) | [registry `assets/plates-index.json`](https://github.com/StarBoltSprint/boltverse-registry/blob/main/assets/plates-index.json) |
| mint / format / provenance law | [registry `ASSETS.md`](https://github.com/StarBoltSprint/boltverse-registry/blob/main/ASSETS.md) |
| same-repo Engine copy | [`plates-index.json`](plates-index.json) — path → `assetId` for 14 files (same ids as registry) |
| dealer playlist (file order) | `plates-index.json` `_playlist` + [11-plate-order.md](../docs/11-plate-order.md) — canyon → cars → duel → night → war. `_playlist` is **not** an assetId. Do not shuffle. |

**HARD LOCK — Hang ≠ wipe.** New biome = new path → `assetId` entries + keep this `_playlist` unless SmiR explicitly says replace the default Beat. Never drop hung ids / files to “make room”.

Chests, Hang, forge, and Engine **reference** these ids. They do not remint. Do not touch the hung mp4/jpg binaries for this pointer.

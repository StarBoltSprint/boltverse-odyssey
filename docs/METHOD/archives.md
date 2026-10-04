# Living Archives / Echo Shards — IN TEST (2026-10-04)

One shared module for every zone and every player. A zone does not recook the paw, the card, or the hall. It writes a manifest.

Owner decision 2026-10-04 18:29: decrees #351 and #352 are unparked for this system only. Momentum `m` and the Frontier Shard narrative frame stay PARKED.

Owner-approved UI 2026-10-04 18:36:

- In the zone the shard is an Imagine crystal on the ground. Pickup shows a small card (the Imagine shot and one lore line) for 2–3 seconds, then it fades. The run continues. There is no menu at the moment of pickup.
- The only always-on control is a small paw button in the top-right corner. It opens Resume, Archives, Citadel (disabled, “coming soon”), and Settings. It does not sit on the joystick or on the camera-tilt swipe.
- Archives is a page over an Imagine painting of the Citadel Living Archives hall. Found shards are listed with their picture. Unfound shards use the dim Imagine silhouette. Plain words (titles, lore, counts) are HTML text.

## What a new zone writes

Copy [`packs/zone-a/src/archives/manifest.json`](../../packs/zone-a/src/archives/manifest.json). Set `zoneId`. List each shard:

| Field | Meaning |
|---|---|
| `id` | Stable id, unique inside the zone. The save key is `zoneId/id`. |
| `x`, `z` | Metres on the zone ground, on a path or beside a landmark. Not inside a gate opening. |
| `yaw` | Degrees. The card faces the way a player walks up to it. |
| `image` | Keyed Imagine PNG. Tall enough that the shared scale rule can show it near eye height without enlargement. |
| `title`, `lore` | Short English. Lore is one line. |

Point `ui.paw`, `ui.plate`, `ui.hall`, and `ui.silhouette` at the shared files under `packs/common/archives/art/` unless this zone is recooking those paintings. Every zone shares the same catalogue of pictures. Players do not get different shards.

In that zone’s play boot, call `mountArchives` from `packs/common/archives/mount.js` with the manifest URL, the zone `groundAt`, and the zone focal length. Zone A in `packs/zone-a/play/play.js` is the example. `?archives=0` skips the module. An invalid manifest does not place shards.

## Rules that stay

- Pickup radius only. No collider, no keep-out, no invisible wall.
- One instanced draw, one crystal texture, `LINEAR_MIPMAP_LINEAR`. A card closer than its own pixels allow is not drawn.
- The skirt is buried a fraction of the card so the foot meets the drawn ground.
- Progress is `localStorage` key `boltverse.archives.v1`, schema `archives-progress/1`, per browser, no account. `remote` stays null. A later shared counter, shared shard, or narration fills `remote` without a zone change. `onFound` is the hook. The Archives page reads the catalogue, not `remote`.
- The catalogue (`packs/common/archives/catalogue.js`) is the reusable piece. A future 3D Citadel hub can render the same found and unfound rows without rewriting zones.
- Imagine prompts are not stored in the repo.

Gate: `node --test packs/common/archives/archives.test.mjs`.

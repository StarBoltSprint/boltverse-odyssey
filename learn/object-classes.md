# Object-class pack

DRAFT — rejected as default by owner 2026-10-02: owner wants real 3D objects (invisible volume + projected Imagine views)

This page is not the cook default. Do not copy it into a kit. Do not gate a still count from it. The exact method is not chosen.

The notes below are the rejected draft, kept so the rejection has a target. They are not instructions.

Phone frame 720×1600. Magnification ≤ 1. Every visible pixel is an Imagine still or a short Imagine loop. Code places and collides. It does not draw a shadow, a point light, or a skin.

Chain: the front plate is source 1. The previous angle is source 2. At most 5 sources. A crashed ship stays [`learn/ship-turnaround.md`](ship-turnaround.md). The calibrated 8×45° / 4×90° turnaround stays [`learn/geometry.md`](geometry.md).

| Class | Views | Picture the draft named | Invisible volume |
| --- | --- | --- | --- |
| Rocks, boulders | 1–2 | Billboard. Random yaw flip and scale. | Collision sphere or blob. |
| Slabs, monoliths | 2–4 | Sprite swap. | Collision box. |
| Plants, trees | 1 | Billboard. A short sway loop only for a hero tree. | Trunk cylinder. |
| Grass | 1 | Still billboard. No video. | Trunk cylinder, same class as plants. |
| Crystals | 1–2 | Billboard. A pulse video only for one landmark crystal. | Collision prism. A code point light is forbidden. |
| Ruins, arches | 3–4 | Sprite swap. No 8-view. | Collision boxes. |
| Small props | 1 | Billboard. Crates, relics, Echo Shards. A shard may pulse as a tiny loop. | Pickup radius. |
| Creatures, NPCs | 4 if the player can walk around, else 1 | No 8-view. | Collision capsule. Bolt stays the locked mp4. |
| Large landmarks | 3–4 | Half-buried. Sprite swap. | Placement and collision. |

Organic shapes drift less than machines. Rocks and plants stay at 1–2 views, plus flip, rotation, and scale.

Variety is one master plate, then edits. No batch sheet. The edit line is: same family, same sun, different silhouette, do not copy cracks.

Ground contact: no code shadow. Half-bury the object. Imagine paints the contact shadow and the dust under the same sun. A dust-ring video is only for a hero landing.

Light: every object prompt copies the biome sun line (azimuth, elevation, Kelvin). Reject a plate whose shadow direction disagrees.

Living: stills are the default. Loops only for a few heroes. A first frame pinned to the last frame forces 720p. Keep those loops short.

LOD: on-screen height under 96 px becomes a single billboard. Never upscale. Few unique videos. Many atlased still billboards.

Generic prompt:

> single object, centered, gray or biome ground, orthographic-ish product view, level camera, sun azimuth A elevation E Kelvin K, no text, thick silhouette.

Edit, when a later angle is actually in that class:

> same object as source 1, only yaw +45, do not redesign, keep proportions, same sun.

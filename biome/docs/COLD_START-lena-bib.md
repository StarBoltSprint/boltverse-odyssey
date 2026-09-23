# COLD START — Lena bib (clés en main)

Read `biome/docs/36-gpu-zones-lena-procedural.md`. Runtime: `biome/scripts/lena-lod/lenaLod.js`. Run `node biome/scripts/lena-lod/demo.js`.

Densify Video A (Rail A) stays a **SuperGrok session** Imagine Video with **first + last** pinned. Build does not drive that session. Missing `XAI_API_KEY` is not a stop for Video A.

The **bib** is Rail B. Build may cook these stills and short keyed clips in chat Imagine, or with the optional API when a key is already set. One object. Flat matte key. No road, no dog, no densify crop, no Howl rings, no shatter inside the clip.

## KEEP names

`bibFile(world, noun, variant)` is the path. Hang the file there.

| World (`climbT`) | Cone band | Variant | File |
|---|---|---|---|
| `earth` · `near-space` · `deep-space` | far | `generator` | `biome/fx/lena/<world>/<noun>-generator.mp4` |
| same | mid | `detail` | `biome/fx/lena/<world>/<noun>-detail.mp4` |
| same | near | `rock` | `biome/fx/lena/<world>/<noun>-rock.mp4` |
| same | Howl contact | shatter, separate | `biome/fx/lena/<world>/<noun>-shatter.mp4` |

Howl rings stay `biome/fx/howl/howl-attack.mp4`. Do not recook them.

Key: flat `#00FF00` for a road crystal / rock / ship / mech. Flat `#000000` for a sky or vault billboard. Matte means that flat field only.

## Imagine (one LOD, one noun)

- **generator** — far silhouette of `{NOUN}`. Simple mass, readable at thumbnail size. Flat matte key. Locked camera. No lane.
- **detail** — the same `{NOUN}`, mid read, facets visible, still one object. Same key. Same camera.
- **rock** — the full `{NOUN}`, near read, the plate you would ship as the hero prop. Same key. Same camera. It does not explode.
- **shatter** — fragments of that one `{NOUN}` only. Own file. Law 32.

`{NOUN}` is the sprint-plan word (`quartz`, `prism`, later `ship`). `{WORLD}` is `earth`, `near-space`, or `deep-space`.

## Call

```js
import { lenaState, lenaFrame } from "./lenaLod.js";

let state = lenaState(seed);
const frame = lenaFrame(state, dt, {
  now,            // seconds
  climbT,         // 0 ground → 1 deep space
  cw, ch, pawY, destH0,
  blocked,        // rail-A lanes already taken, -1 | 0 | 1
  plate,          // other rail-B lanes this beat
  nouns: ["quartz"],
  zone: "road",   // or "sky"
});
state = frame.state;
```

For each `frame.spawns[]`:

- Show `bib` on `pose.dest` (GPU quad, law 15 / 17).
- Fetch `warmBib` while `warm` is set. Blend with `warmK` (0 far from the boundary, 1 at the swap).
- `contact === true` only on the near rock: shadow on `pose.ground`. Grade from this densify plate (law 13b). Far and mid get no skateboard blob.
- `howlKeep` is the ring plate. `shatter` swaps in on law 34 contact.
- `frame.tileDensify` is false. Do not cut Video A into tiles.

World pick is `frame.world` (`earth` → `near-space` → `deep-space`). Spawn lane and z come from the seed. The asset does not.

# 30 — Imagine i2i prompt (numbered refs, one delta)

Cook gate for stills. API: `POST /images/edits`. `image` = canvas. `image_urls` = extra refs. A ref **without** a `First / Second / Third image =` role is a leak (dog on the road, wall from a `t99`).

## Three roles (never mix)

| Slot | File | Prompt says |
|---|---|---|
| **1. Canvas** (`image`) | KEEP, or décor `m-1` | Same camera, same cone, same asphalt. ONLY add … |
| **2. Geometry** | KEEP again if canvas is already dense | Geometry only. IGNORE extra décor. |
| **3. Noun** | the +1 still | Copy THIS object, sides/sky only. IGNORE its crop / its road. |

## Four lines

1. **Lock** — Same 1-point, same 3 lanes, same dark asphalt as the first image. Do not recrop. Do not re-light.
2. **Delta** — **one** verb, **one** noun, **one** place.
3. **IGNORE** — crop, dogs, crystal on the road, the teacher’s close-up.
4. **Fail** — If the noun sits in a lane, FAIL. Empty wet asphalt in L/C/R stays empty.

No novel. No twenty NEVERs. The useful NEVER is the **forbidden place**.

## Delta verbs

| Want | Verb | Ban |
|---|---|---|
| +1 décor | **ADD** … on the sides / in the sky | richer / densify / more detail |
| Last closer | **ADVANCE** the same world closer. No new objects. | spectacular / climax / world ADVANCED |
| Event | **PLACE** a glass comet FAR AHEAD, one lane, in the AIR | obstacle / impact / debris field |
| Event gone | **REMOVE** the comet. Keep décor. | aftermath / crater / ruins |
| Miss −1 | canvas = still `m-1`, no Third | recook from a flashed `t99` |

## Order (cap 12)

KEEP always first. Events never snowball. Clip last never `@`. Canvas is a **cooked still**, never a video frame.

Lanterns (next cook):

```
image: stack/KEEP.jpg
First image IS the plate. Same camera, same 3 lanes, same dark obsidian asphalt.
ADD only: identical quartz lantern posts with a small teal flame,
LEFT and RIGHT sides, off the three lanes, not on the asphalt.
Center corridor empty. Dashes unchanged.
ZERO dogs. ZERO crystal piles. ZERO new mesas. ZERO brighter sky.
```

If lanterns eat a lane: tighten **place** (curb only, lamp scale), do not add more NEVER.

## Related

[28](28-stills-two-rails.md) · [31](31-light-lock.md) · [24](24-camera-1point.md) · prompts `paint-*.txt` / `last-frame.txt`

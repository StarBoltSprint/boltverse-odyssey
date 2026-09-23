# 40 — Nebula Lane cycle (four plates, one run)

Cook gate for the Nebula Lane run that follows the crystal method ([39](39-imagine-live-light.md)).

The road is still an Imagine video. The GPU does not build the world. It crossfades two plates and lerps Bolt's light. Hang each plate. Do not wipe the previous one.

## Order

| # | Name | What the player sees | Next plate starts from |
|---|---|---|---|
| 0 | `nebula` | Magenta / teal void, gold lanes, three lanes, one vanishing point | the nebula plate itself |
| 1 | `shore` | Ionized shore. Same lanes. Teal front, gold star, black space | a frame of the nebula lanes, then image-to-video |
| 2 | `disk` | Accretion tunnel. Lanes run into the disk | **last frame** of the previous disk clip, not the first |
| 3 | `eclipse` | The disk has collapsed into one copper ring. One cold point. Black space | **last frame** of the disk continuation |

Then it repeats: eclipse → nebula.

## Clock

| | Value |
|---|---|
| Hold | **30 s** (`BIOME_HOLD`) |
| Crossfade | **3.2 s** (`BIOME_FADE`) |
| Preload next | 3 s before the fade |
| Fade starts | only when the next `<video>` has `readyState >= 2` |

Two road textures. `uMix` goes 0 → 1 with a smoothstep. Bolt's coat lerps the same `uMix` between `uniformsFor(from)` and `uniformsFor(to)`. Nebula / crystal light is magenta rim. Shore and disk go gold. Eclipse stays copper and cold. Do not pop the coat on the frame the plate changes.

## Why a loop snaps backward

A 6 s plate that loops while the player is already deep in the tunnel jumps back to the mouth. That reads as a cut, not a road.

Fix: extract the **last** frame. Image-to-video a continuation (15 s) that keeps the same tunnel, the same lane count, the same vanishing point. Concatenate: `6 s + 15 s`. The loop is still a loop, but it loops a run that has already arrived, not a rewind to the door.

Image-to-video eases in. The first 1–2 s are slow because the start frame is glued down. **Trim that head.** Shore: drop the first second. Eclipse: drop the first 2 s so the loop opens on moving copper light, not a held still.

## Speed

The cousin plate must rush like the nebula plate. Prompt for streaks toward the camera and clouds that move. "Locked camera, lanes stay still" freezes the world. Geometry stays locked (lane count, vanishing point). Motion does not.

## Props on every plate

Law 39. One crystal clip, one globule clip, one howl ring, all filmed in the nebula light (magenta, teal, gold) on pure black. Clean luma key. No bib grade.

| | Value |
|---|---|
| Howl travel | `howlFireSec` returns **0.28** s. Not 2.6. |
| Contact | the ring stops on the crystal. It does not fly past. |
| Shatter | that crystal only, the one that was tapped |
| Dodge | dark globule. **No** grey rectangles. **No** plasma arcs (an arc never matched one lane's width) |
| Tap | hit-test the crystal quad, pad ~36 px, set `aimId`, fire |

## Do not

- Loop a 6 s tunnel once the camera is inside it.
- Crossfade before the next video is ready (black frame).
- Change lane count between plates. The eclipse cook once added lanes. Recook with the lane count locked.
- Bake crystals into the plate. They stay GPU quads.

## Related

[08](08-plate-speed.md) · [11](11-plate-order.md) · [31](31-light-lock.md) · [33](33-plate-mae-qc.md) · [39](39-imagine-live-light.md) · [41](41-eclipse-look.md)

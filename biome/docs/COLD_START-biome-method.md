# COLD START — biome method (paste this first)

Kitchen only. Do not read this to the player.

Paste this as the first message when a new Grok, in a new conversation, cooks a **playable biome composite** for **any** named biome. The name and the paint are free: nebula, shore, forest, gothic, lava, ice, or whatever the player named. `pyre/` is the Diablo gothic worked example. It is not the only biome type. Copy the craft. Recook the pixels in this plate's light.

Law 43 is already [open ground](43-open-ground.md). This paste does not take a new law number. It points at the laws that stay.

## What to open

1. This file.
2. [`pyre/METHOD.md`](../../pyre/METHOD.md) sections 1–7, the gesture section, and both FAIL lists. That is the full worked example. Diablo names in that file are the example paint.
3. When the rail applies, the law — do not delete it:
   - Densify + Imagine Live keyed props: [`COLD_START-imagine-engine.md`](COLD_START-imagine-engine.md) · laws [39](39-imagine-live-light.md) [40](40-nebula-cycle.md) [41](41-eclipse-look.md) [42](42-shoulder-panorama.md)
   - Empty-plate parity, scale, clock, ground FX: [`COLD_START-any-biome.md`](COLD_START-any-biome.md) · [00](00-PRIORITY0-any-biome.md) · [20](20-default-plate-proportions.md)
   - Forest or any ground that is not a 3-lane road: [`pyre/GROVE.md`](../../pyre/GROVE.md) · [`COLD_START-open-ground.md`](COLD_START-open-ground.md) · [43](43-open-ground.md)
   - Room look: [`pyre/ORBIT.md`](../../pyre/ORBIT.md) · journey [`COLD_START-room-starmap.md`](COLD_START-room-starmap.md)
   - Plain / Thunderwolf (optional): METHOD sections 11–13 and [`pyre/PLATE.md`](../../pyre/PLATE.md)

`pyre/PLAIN.md` and `pyre/VISTA.md` do not exist. Do not follow those names. Root `PLAIN.md` is a retired nine-cell grid. Root `VISTA.md` is an older sky note. A new biome starts here.

## Rails

- **Rail A — densify.** One continuous Imagine plate. The picture is the clock. Session Imagine Video, first frame and last frame. Empty of Bolt, foes, howl, beams, and open doors.
- **Rail B — GPU composite.** Keyed layers over that plate: Bolt, optional wings, optional foes, optional howl, Imagine Live props.
- Imagine is the look studio. Densify-first stays the default. An open-world procedural ground is the Grove / law 43 module, used when this biome is not a road.
- Hang the existing play URL only: `https://boltverse-odysseyyyy.grok.me`. Hang ≠ wipe. Add plates beside canyon → cars → duel → night → war. No new grok.me. No Build conversation link as the hang. No Connect Wallet. No player API keys. Pack origin stays `https://boltverse-pack.vercel.app` (kitchen). Crystal is quartz. Crystal is never chrome.

## Paint

`{PAINT}` is free. Swap the color words. Keep the steps below. If the paint already names a road material, use it. Otherwise use law 35 menu A–D ([`COLD_START-lane-materials.md`](COLD_START-lane-materials.md)). Grey concrete is banned as the silent default. Law 20 is the frame for a 3-lane road (width ~0.75–0.82, sky ~45%, plant ~0.80).

Pyre constants (horizon `0.545`, `BOLT_H 0.28`, `BOLT_RATE 4`, lava) belong to that plate. Re-measure on the new plate. Do not paste gothic numbers onto a shore.

## 1. Empty densify (Rail A)

Zero dog. Zero foes. Zero howl. Zero interactive light. Lock-off camera. Law 20 frame unless the player asked another framing.

Loop the way METHOD §7 does: two readers on the same mp4. When the live reader is about 0.35 s from the end, the other starts at 0, then they swap. Wings, if any, take `currentTime` from the reader on screen. Do not seek the wings every frame.

Recook this mp4 in **this** plate's light. `pyre/master/pyre-road.mp4` is the lava example. It is not the road for another biome.

## 2. Bolt, one video (Rail B)

Default motion is the sealed cycle [`lock/bolt-gallop-cycle.mp4`](../../lock/bolt-gallop-cycle.mp4) (about 5.56 s / 534 frames / 96 fps, rear, green). Play `loop` at **1×**. Bolt is a full-white German Shepherd. The coat base stays white. A décor skin on top (ember, ice, ash) is allowed. Show [`lock/bolt-back.jpg`](../../lock/bolt-back.jpg) in the chat before any new Bolt still.

Pyre's armored sprint (`bolt-native.mp4`, aura and armor in the same green clip, `playbackRate = 4`) is a KEEP **example**. Cook a native clip only when this paint cannot key the sealed cycle — on Pyre the aura and the lava are both red, so generating the dog already on the road ate the fire and left a hole. That is not a mandate to invent a new dog for every biome.

If a native clip is required: one image-to-video, camera locked on the back, flat chroma `#00FF00`, no ground, the same dog. Key with `greenness = G - max(R, B)` and discard the pixel as soon as it is green (Pyre threshold `0.02`). Do not despill toward yellow (that left a puddle under the paws). Do not put the aura in a second video. Do not stick armor onto the sealed cycle (the armor does not gallop).

The sealed-cycle path still runs scale, gallop-clock, plate grade, and paw contact ([13](13-make-bolt-lane.md) [13b](13b-anti-sticker-contact.md) [13c](13c-green-despill.md) [13d](13d-auto-scale.md) [14c](14c-gallop-clock.md) [15](15-gpu-compositor.md) [17](17-live-compositor.md)) before KEEP. The road plays at 1×. Speed up only the dog when the paint's own clip was cooked slow.

## 3. Gesture grammar (default controls)

Decided at `pointerdown`. Not after a delay. Reference: `slideTo` and `uGlance` in [`pyre/src/pyre-stage.tsx`](../../pyre/src/pyre-stage.tsx).

| Finger down on | What happens |
|---|---|
| Bolt's quad (pad 0.05) | Continuous lane slide. `lanePos` follows the finger, clamped −1…1. `lanePos = originLane + (clientX - originX) / width / 0.22`. This gesture does not glance. On release, `lanePos` **stays**. No snap to −1 / 0 / 1. |
| A foe, and not on Bolt | Howl at **that** foe. No slide. If several sit under the finger, take the nearest (`z` largest). Pad 0.07. |
| Anywhere else | Glance. `glance` runs −1…1 as `dx / (width * 0.42)`. Bolt does not turn his head. Only the plate shifts. On release, `glanceTarget` returns to 0 (ease 10/s; 14/s while the finger is down). |

Keyboard: A / D or arrows steer at 3.4 per second while no finger is down. Space or Enter starts. There is no howl key.

**Soft lane magnet.** The lane is not three buttons. A value between lanes is legal, and hits use that continuous `lanePos`. On open ground (Grove), a forward drag eases a leftover side offset back into the heading: `catchUp = 1 - exp(-dt * 3.6)`, subtract that fraction from `lanePos`, and fold it into `selfAng`. Do not replace either behavior with a HUD arrow or a path-beat card.

Law [42](42-shoulder-panorama.md) is a different look rail (flick changes lane, a 150 ms hold looks, wings do not scroll). Use it when that panorama is the job. Do not run it in the same frame as this glance. Law [41](41-eclipse-look.md) yaw is eclipse-only and stays off this frame too.

## 4. Optional wings

Two plates, left and right, continued past the edge of the road's first frame. Same exposure and the same color words as this plate (laws [31](31-light-lock.md) and [39](39-imagine-live-light.md)).

Pyre craft (METHOD §3): the wings scroll with the road. `currentTime` locks to the road reader on screen. `playbackRate = 1`. Do not seek them every frame.

Seam: sample the wing **inward** during the blend. Repeating the edge column leaves a torn vertical band. A blur across the whole road makes the front view soft. `cover` keeps the front view on the road until the glance is real. Pyre: `seam` is 0.14 in the sky and 0.32 on the ground; `shift = glance * smoothstep(0.10, 0.48, abs(glance))`. Bolt and foes move by the same `viewShift`. Their collision lane does not change.

Law 42 is the other wing recipe: three videos, the side plates hold still, and only a boarded path scrolls. Pick one recipe.

## 5. Optional foes

Image-to-video. Flat green. The creature alone, running toward the camera. No décor. Same key as Bolt, a little softer (`greenness > 0.05`).

At most two alive. No new spawn while one is still far (`z < 0.55`). Wait about 2.6–4.1 s. `z` is 0 at the horizon and 1 at the strike. The foot is `HORIZON + (PLANT_Y - HORIZON) * z`, already large enough at the horizon. They arrive on the road. They do not drop out of the sky.

Pyre's hooded demon and armored goat are the example kinds. A new foe is one green run clip, one entry, and one death clip. Do not spawn a boss unless the player asks.

Death: image-to-video from a frame of that same foe, green held. The prompt describes a spell: the shape comes apart into embers. Words about gore get the clip refused. Seek to the burst (Pyre uses `currentTime = 0.9`) and fade the alpha at the end.

## 6. Optional howl

No button. No cooldown. The player taps the foe.

The clip is the blast alone: base at the **bottom** of the frame, tip at the **top**, no dog. Draw it as a narrow quad from Bolt's mouth to that foe's chest. A wide quad reads as a vertical pillar that aims at nobody. Pyre width is `0.045 + 0.02 * p`. The shader takes the middle of the texture (`u` about 0.34–0.66) so the green margins are not crushed into the beam. The tip travels 0→1 in roughly 0.2–0.48 s with distance. On impact the quad goes away and the foe is removed. Several howls can fly. Do not restart the video while one is already playing.

If law 39 is the prop rail, film the howl in the plate's colors on pure black and key it clean ([`COLD_START-imagine-live.md`](COLD_START-imagine-live.md)). Do not bake the howl into densify.

## 7. Optional modules (pointers — not required for v1)

- **Room / orbit / star map.** [`pyre/ORBIT.md`](../../pyre/ORBIT.md), METHOD §8–10, [`COLD_START-room-starmap.md`](COLD_START-room-starmap.md). Sixteen JPEGs per side, finger picks the index. Do not scrub an mp4 on a phone (it lands on keyframes and the room cuts). Bolt is drawn on top, always from the back, always at the center. Stay on this biome at the pace gate. Do not hard-cut to a second biome.
- **Plain / Thunderwolf.** METHOD §11–13 and [`pyre/PLATE.md`](../../pyre/PLATE.md). Example only.
- **Forest / open ground.** [`pyre/GROVE.md`](../../pyre/GROVE.md) and [`COLD_START-open-ground.md`](COLD_START-open-ground.md). Four-face trees are the **next step**. They are not required for a v1 KEEP. One shared video per face, not one decoder per tree. The face follows where the player stands (`atan2`), with a wide threshold before the image changes. Rejected: six JPEGs around the trunk, depth-sliced layers, a bark cylinder, a thick photo block, screen stereo, SIFT/ORB meshes.
- **Laws 39–42** stay in force when that rail is on. This paste generalizes the Pyre composite on top of them.

## What you still recook

The grammar copies. The mp4s do not, unless the sealed Bolt cycle is the dog.

Recook in **this** plate's light: the empty densify, wing L/R if you use them, foe run and death if you use them, the howl if you use it, and room/orbit frames if that module is on. Do not drop Pyre lava clips into a shore, a forest, or a nebula. Each new clip starts on the last frame of the clip before it when it is a journey (METHOD §8). Image-to-video. No jump cut.

## FAIL

- Aura in a second video, or a shader outline around the silhouette
- Armor glued onto `lock/bolt-gallop-cycle.mp4`
- A new breed, or a grey / silver / black coat as the base
- Wing blend that repeats the edge column, or a blur on the whole front road
- Seeking the wings every frame (horizontal tears)
- A Howl button, or an automatic howl at the nearest foe
- A wide howl quad
- A death prompt that asks for gore
- A boss spawn nobody asked for
- A hard cut into a second biome at the pace gate
- Painting the previous biome while the phase is still the citadel (the door-open flash)
- Path-beat rectangles, grey cards, or a HUD arrow (laws 37–39)
- Still-LOD / sticker lane props. Lane props that must look like Bolt are Imagine Live video, clean key, no regrade (law 39)
- Bolt, howl, a beam, an open door, or side clutter baked into densify (laws 37–38)
- Densify chopped into spatial GPU tiles (law 36)
- Open-world procedural ground as the default for a road biome
- Four-face grove trees treated as required for v1
- Chrome crystals, Connect Wallet, player API keys, a new grok.me, or a Build share URL as the hang
- Links to `pyre/PLAIN.md` or `pyre/VISTA.md`
- One-still image-to-video for a plate or a walk
- A KEEP claimed while the dog is still baked into the road

## Done when

- [ ] The paint is this biome. "Pyre" only if the player asked for Pyre.
- [ ] Densify is one continuous plate: no dog, no baked howl, no baked beam, no baked open door.
- [ ] Bolt is the sealed cycle, or one native green clip of the same white shepherd because this paint required it.
- [ ] Finger on Bolt slides the lane and the lane stays. Finger elsewhere glances and returns. Finger on a foe howls that foe.
- [ ] Wings, if present, match this plate's light and do not tear at the seam.
- [ ] Foes and howl, if present, are keyed layers over the plate.
- [ ] Laws 39–42 were followed where that rail is on.
- [ ] Four-face grove trees were not required.
- [ ] The hang is `https://boltverse-odysseyyyy.grok.me` only.
- [ ] No wallet. No player keys.

Worked composite, do not fork it into `biome/scripts` for a new paint: [`pyre/src/pyre-stage.tsx`](../../pyre/src/pyre-stage.tsx).

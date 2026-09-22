# COLD — Howl GPU targets (paste before a destroyable)

Read `biome/docs/32-howl-gpu-targets.md`. Law 25 meteors stay **dodge**. They are not Howl targets.

**Rail A** — baked in the road. Dodge. `plate-hazard-qc.py`. Not destroyable.

**Rail B** — Imagine keyed obstacle on `#00FF00`, GPU-placed like Bolt (cone scale, quad dest, plate bounce, contact). Howl destroys **that quad only**.

**Shatter** — a different Imagine plate **per type**. Green key. No black squares. Never inside the Howl file.

**Howl** — Imagine VIDEO only. Paste `biome/prompts/howl-attack.txt`.

- Vertical yellow/blue rings, white core, progressive left → right (Bolt → target).
- Locked camera. Black `#000000`. No dog, no road, no shatter, no laser, no lightning.

Do not invent the rings in a shader. Do not bake Howl or shatter into `road-*.mp4`. Anti-sticker = laws 13b / 15 / 17.

Hall breath (citadel, chest rise, same still twice) is not this plate.

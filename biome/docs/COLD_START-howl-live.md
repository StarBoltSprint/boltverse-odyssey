# COLD — Howl live aim (paste before wiring S / rail B)

Read `biome/docs/34-howl-live-aim.md`. Copy `biome/scripts/howl-live/` (`howlLive.js` + `howlWet.glsl`). Law 32 hung the plates. This paste is the **Live** math.

**Howl KEEP** = `biome/fx/howl/howl-attack.mp4` (SmiR). Do not recook. Do not shader the rings.

On **S**:
- mouth = Bolt head, rock = live rail-B dest
- `fireSec = clamp(0.32, 0.70, 0.3 + dist/canvasH * 0.72)`
- `playbackRate = 3.1 / fireSec`
- trapezoid Bolt→rock, tip **inset** so rings sit **on** the prop (never past)
- KEEP `uv.x` along the beam. The quad does **not** slide A→B.

On **contact** (`howlT >= 1`): **pause Howl now** (even if the mp4 is not finished) → swap obstacle video for **that type’s** shatter plate → splash. Then despawn.

GPU Howl = luma key on black + plate bounce + road mix, two-pass (glow ADD, core premul). Obstacle/shatter = same keyed draw as Bolt (green, bounce, contact shadow).

Rail B noun is biome-variable. Math is not. BAN dogs. BAN a 3-lane wall. BAN a laser.

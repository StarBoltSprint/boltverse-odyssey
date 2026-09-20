# Cold-start paste — GPU + 6 s cycle (PRIORITY 0)

Hang this into new Build convos. Code must also live on GitHub.

**Canon cycle:** `lock/bolt-gallop-cycle.mp4` = 5.56 s · 96 fps · 768×1168 · 534 frames · rear white GSD · `#00FF00`.
`CYCLE_FPS=96`, `CYCLE_FRAMES=534`, `STRIDES_PER_CYCLE=22`. Loop 1×. Never seek every frame. Never cache 534 canvases.
Old 0.93 s / 89-frame lock = archive only — do not play.

**Compositor:** WebGL one-pass from frame 0 (`bolt-key-gl` pattern). Ban `getImageData` hot path. Plate upload on plate-frame change only; Bolt every rAF. Stage Bolt 384×584, road 360×640. Paw scan once (13d).

See `biome/docs/15-gpu-compositor.md`.

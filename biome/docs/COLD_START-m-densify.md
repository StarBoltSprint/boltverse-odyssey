# COLD — `m` = momentum (paste when densifying)

Read `biome/docs/22-m-densify-snowball.md` + [`28-stills-two-rails.md`](28-stills-two-rails.md). Sprint order is the **plan** (`26` / `plans/<biome>-sprint.md`) — do not pick the +1 still in chat.

`m` is **momentum**. Same biome. Empty KEEP fixed.

- **Success** → next plate = **all old décor `@` refs + 1 new décor still** (richer). Cap ≤12. Never drop the stack. At peak, **hold** — do not wrap to empty KEEP.
- **Miss** → next plate loses the last **décor** ref (poorer).
- **Every densify plate (d1+)** has **≥1 spectacular hazard** on the 1-point cone (meteor / side collapse — not a barrier / jersey / t-shirt). Law 25 `--expect 1`.
- **Two rails:** décor snowballs. Event stills **swap** (never `@` last frame / `t99`). i2i = one delta ([30](30-i2i-prompt.md)). Light = KEEP bible ([31](31-light-lock.md)).

Cook with those stills. Harmony = this biome. Never morph the road / Bolt. REUSE 6s + GPU.

Frost: hang ADD `road-frost-dN.mp4`. Never overwrite `road-frost.mp4`. GPU KEEP file is `22-gpu24-frost-keep.md` (same number, different law).

**Before hang densify:**

```
python3 biome/scripts/plate-geo-qc/plate-geo-qc.py <dN.mp4>
python3 biome/scripts/plate-hazard-qc/plate-hazard-qc.py --ref road-frost.mp4 --expect 1 <dN.mp4>
```

Both PASS. FAIL = recook this plate. Paste `biome/prompts/camera-1point.txt` + `biome/prompts/hazard-1lane.txt` on the I2V.

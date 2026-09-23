# 08 — plate speed (travel, not FPS)

FPS = how many pictures per second (smoothness).  
Travel = how hard the **asphalt rushes** toward the camera.

Cook must already be **very fast** and **constant** (BIOME_SPEED_LAW: 10s, never slow, never accelerate). This script only matches **mean** rush between plates. A ramp inside the mp4 is a recook, not `--match`.

## Measure

```
python3 scripts/plate-speed.py biome/master/road.mp4
python3 scripts/plate-speed.py --ref biome/master/road.mp4 biome/master/road-bar.mp4
```

How: gray frames, asphalt patches in the lower road band, how far they slide **down** over a fixed 0.20 s. Number = px/s at 720p.

`factor > 1` → the new plate is slower than the ref. Speed it up.

## Match

```
python3 scripts/plate-speed.py --match --ref biome/master/road.mp4 biome/master/road-bar.mp4 -o biome/master/road-bar.mp4
```

`--match` plays the plate faster (`setpts`). Duration **shrinks**. Same 48 fps, same 720×1280, short GOP.

A hazard (blast, bar bloom) can **fool SAD** — patches jump, px/s looks fast, `--match` then **slows** a plate that actually crawls. Then use duration:

```
python3 scripts/plate-speed.py --duration-match --ref biome/master/road.mp4 biome/master/road-blast.mp4 -o biome/master/road-blast.mp4
python3 scripts/plate-speed.py --factor 1.75 plate.mp4 -o plate.mp4
```


This does **not** replace first+last. A slow cousin that ends under a bar still **cuts** back to empty if `last(cousin) ≠ first(empty)`. Recook with Imagine Video first+last (session, or `imagineBiomeClip` when the key is set) for the chain. Use this script for rush only.

## Order

1. Imagine Video first+last (SuperGrok session, or `imagineBiomeClip` when `XAI_API_KEY` is set)
2. encode (already in the hook)
3. `plate-speed.py --ref empty --match` if px/s is off
4. Hang PASS into `biome/master/` — **ADD** the new file. Never `rm` hung `road.mp4` / war / night to “make room”. Hang ≠ wipe: [09-recette-biome.md](09-recette-biome.md).

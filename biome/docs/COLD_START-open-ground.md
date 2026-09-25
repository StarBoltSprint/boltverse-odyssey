# COLD START — open ground

Read [43-open-ground.md](43-open-ground.md) before touching a forest, a plain of dirt, or any biome that is **not** a 3-lane road.

Copy the lava plain: four locked portrait skies, one tiling ground video, the same `orbit` on both, GPU Bolt (`bolt-native.mp4` at rate 4, `bolt-breath.mp4` idle, `uGrove = 1`).

Set `uFlat = 1` only for that ground. Leave the plain's `sharp * intoSky` alone.

The horizon comb is the depth clamp. `grain` must be 0 while `dyScreen < 0.03`. Do not sample the tile there.

Earth color:

```
python3 biome/scripts/open-ground/earth_color.py <ground.mp4>
```

Use the **lit** line it prints, not the raw mean.

Do not run `plate-geo-qc.py` on this ground. Do not put φ in the Imagine prompt. Do not hang stickers, a canopy, or a zooming loop.

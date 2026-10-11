# tools/look — Unreal-look for every biome

Phone post stack, one flag per feature, colours sampled from the key. No Imagine call.

```bash
python3 tools/look/look.py selftest
python3 tools/look/look.py check
python3 tools/look/look.py build --key KEY.jpg --sky SKY.jpg --light key-light.json --plates DIR --out DIR
python3 tools/look/look.py install --live /workspace/zb-preview-1008 --stage /workspace/zb-preview-1008/unreal-look-1011
```

`install` symlinks the live tree and writes real copies of `index.html` and `main.mjs` only inside the stage. It refuses to write the live directory.

`look.py gate --key KEY --frame FRAME --scene SCENE --pack look.json` is blocking. The frame is a real matched-camera screenshot. A pack whose grade `reference` is `synthetic-pregrade` fails. Mean luma and the 16-bin histogram must sit within ±10% of the key. Sky-shaft brightness must stay above 0.50 and at least 80% of the scene frame. At least two tower feet need a contact shadow. The same gate also blocks when a tower gap has no shaft lift of 0.045, and when sky, horizon, sand, or towers miss their region ΔE limit.

URL flags on the staging page: `?look=0` (all off), `?grade=0`, `?bloom=0`, `?bake=0`, `?env=0`, `?fog=0`, `?shadows=0`, `?sprites=0`. `?bench=1` plays one fixed camera path and records `window.__benchDts`.

Method: [`docs/METHOD/unreal-look.md`](../../docs/METHOD/unreal-look.md).

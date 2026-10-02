# Biome kits

A kit is the paint lock for one biome. The camera geometry is the same for every biome and every later player.

Start from [`_template/`](_template/README.md). Copy `_template/kit.json` to `biome/kits/<id>.json` and fill the name, sun, palette, plates, living loops, preamble, and decree hooks.

Examples, already filled:

| | Id | Name | Time | Paint |
| --- | --- | --- | --- | --- |
| A | `howling-eclipse` | The Howling Eclipse | night | night violet, a black angular ship |
| B | `ember-mesa` | Ember Mesa | golden hour | space-western canyon |
| C | `cascade-verdance` | Cascade Verdance | morning | emerald highlands |

```bash
python3 tools/kits/kit.py check
python3 tools/kits/kit.py show --id howling-eclipse
```

`check` reads every `biome/kits/*.json`. A new file that passes is a kit. The template under `_template/` is the blank copy. It is not a biome.

Geometry on every kit: level horizon 50%, 8 sky slices at 60° HFOV stepped 45°, one sun, ortho ground tiles. Schema: [`_template/schema.json`](_template/schema.json).

Paste the preamble with [`biome/prompts/kit-preamble.txt`](../prompts/kit-preamble.txt). Register cooked loops in [`stock/loops/`](../../stock/loops/README.md).

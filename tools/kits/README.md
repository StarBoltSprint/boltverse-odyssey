# tools/kits

Checks a biome kit against [`biome/kits/_template/schema.json`](../../biome/kits/_template/schema.json).

```bash
python3 tools/kits/kit.py check
python3 tools/kits/kit.py check --file biome/kits/_template/kit.json
python3 tools/kits/kit.py show --id howling-eclipse
```

`check` with no file reads every `biome/kits/*.json`. Exit **0** when each file is complete. Exit **1** when a field is missing or the geometry lock moved. Exit **2** when the command is wrong.

The blank template is supposed to fail `check --file`. It is the copy source, not a biome.

Geometry that every passing kit shares: level horizon 0.5, 8 sky slices, 60° HFOV, 45° yaw step, one sun, ortho ground tiles. A player kit with another id passes the same check. The Howling Eclipse, Ember Mesa, and Cascade Verdance files are examples.

`show` prints `promptPreamble` and nothing else. Paste that string. Law: [`biome/kits/README.md`](../../biome/kits/README.md).

## Self-test

```bash
python3 tools/kits/selftest.py
```

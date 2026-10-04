# Rocks — TerrainFeatureGenerator

One command, any kit that has a numbers file:

```
python3 tools/rocks/build.py --kit howling-eclipse
```

The kit id selects `biome/kits/<id>.json` and `tools/rocks/numbers/<id>.json`.
Imagine views are read from the local inbox (`/workspace/grokcli/out/zoneA-step3/views/<type>/yaw-000.jpg` … `yaw-315.jpg`).
Pebbles are `pebbles/pebble-a.jpg` and `pebble-b.jpg`. The tool keys them, runs
`tools/objsheet` and `tools/walkaround/build.py`, and writes
`packs/<pack>/src/rocks/manifest.json`.

Placement only:

```
node tools/rocks/place.mjs --selftest
python3 tools/rocks/selftest.py
```

Numbers carry counts, metres, and seeds. Prompts stay in the local prompt file.

A non-selftest run loads `packs/<pack>/src/ruins/manifest.json` when that file exists and skips a disc that lands in a gate opening or a hangar mouth. `--selftest` does not load the live manifest, so the kit counts stay put. `node tools/playcheck/src/premerge.mjs --audit` reports discs that already sit in a passage. It does not rewrite the committed rocks manifest. Added 2026-10-04.

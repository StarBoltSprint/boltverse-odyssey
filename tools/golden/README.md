# tools/golden — one key image → playable 3D world, automatic, timed

```
bash tools/golden/run.sh <key-image> <zone-id> [--prompts FILE] [--seed-plates DIR] [--imagine grok|mock|manual] [--imagine-max N]
python3 tools/golden/selftest.py        # offline (mock Imagine + fake grok CLI), 26 checks, bad input FAILS
```
Stages (each timed in `WORK/timing.json`, each gated in `WORK/gates/<stage>.json`, first FAIL stops with `WORK/REPORT.md`):
prompts → imagine (`imagine_auto.py`, Grok Build built-in Imagine, headless `grok -p … --always-approve`, never the xAI API;
resumable) → sky (ring stitch + seam/brightness gate) → ground (tileable layers + key-light gate) → terrain (rim relief from the
key skyline, 0 Imagine) → objects → placement (lane/overlap/inside checks) → gate (frame 600k tris, 300 MB, every verdict)
→ worldgraph (`zone.json`, zone.v1) → play (`index.html`, local URL).

`timing.py summary` prints total vs the 8 min budget, Imagine vs tools time, and the slowest stage.
`tools/biome/run-biome.sh` step 4 now calls `imagine_auto.py` (`--manual` keeps the old exit-10 wait).

Honest limits: objects are relief proxies cut from the plate (full volume = `tools/imagine-to-3d/auto.py` per-object spec, not
chained yet); terrain is a generic skyline rim, not the Zone B `terrain-from-key` solve; no Art Director render check in the chain.

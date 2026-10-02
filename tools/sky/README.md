# Sky chain

Measure a chained Imagine sky before it is hung, and sample living layers at play time. The commands do not paint, clone, or mirror a column. A seam weight is a mix of two Imagine texels. A living layer is a frame from an Imagine video.

```bash
python3 tools/sky/check.py --slices <dir> --out <reports>
python3 tools/sky/check.py --manifest sky.json --out <reports>
```

Exit 0 is PASS. Exit 1 is FAIL. Exit 2 is a broken invocation. Paste `report.md` and `report.json`.

## Slices

At least two stills. The chain must close: the last slice joins the first.

| Check | FAIL |
| --- | --- |
| Clone | A trailing run of columns copies the run before it, and that run is not the middle of the picture (MAE ≤ 1 against the neighbour run, MAE > 6 against a mid-image block). A flat picture (std under 3) is not a clone. |
| Mirror | The trailing run matches the flip of the previous run, or the flip of the left edge, and the picture is not symmetric as a whole. |
| Join | Content-strip MAE between neighbours is above **4**. The strip sits inside any cloned run. |
| Close | The same join from last to first is above **4**. |
| Swing | Column luma moves by more than **6** inside any **60°** window of the chain, including the wrap, or inside one slice. |

The report names the cheapest recook: both ends of a bad join are blamed, a clone or a mirror weighs more, and a tie goes to the later slice. A chain that only fails the close recooks the last slice.

## Living layers

A still slice is the first frame of an Imagine video. Each layer is one seamless loop for the whole yaw, not one video per slice. The page keeps one decoder per layer and samples it at a per-slice start offset.

| Layer | Duration |
| --- | --- |
| Stars | about 13 s |
| Dust | about 17 s |
| Nebula drift | about 29 s |

13, 17, and 29 are pairwise coprime. Their least common multiple is 6409 s. The gate fails a combined repeat under **600 s** (10, 20, and 30 s together repeat at 60 s). The report prints `combinedRepeatSec`.

Adjacent slice offsets must differ by at least **0.75 s**, including the wrap from last to first. Equal offsets make the slices pulse together.

Motion stays slow. Frame-to-frame gray MAE above **8** fails. A distinctive bright speck that comes back on a fixed period under **60 s** fails (a flash, a shooting star baked into the loop). An always-on star field is the texture and passes. A rare event, if one is wanted, is a separate one-shot Imagine clip with a random gap of at least **30 s** (`minGapSec` / `maxGapSec`), not a short loop.

Phone caps, with Bolt keeping one decoder of the game's four: at most **3** sky videos (layers, plus one decoder if any one-shot is playing) and **48 MiB** of sky textures.

`tools/assetcheck` kind `sky-loop` runs the loop seam (MAE, p95, flow, pop) and the same amplitude, repetition, and byte rows on one file. The set-level period, offsets, and cheapest recook stay in this command.

## Play composite

`runtime.js` is a classic script (`BoltSky`). The repo package is `"type": "module"`, so Node reads `globalThis.BoltSky` after import.

`resolveSeamBlend` stays off until the slice gate has passed. An explicit `seamBlend: "off"` stays off after a pass. The crossfade is **2–4%** of the slice width (default 3%) and uses only the two slices' own pixels.

`skyPlan` returns per-slice sample times, the combined period, and the decoder count. It does not allocate a decoder per slice. `bindSkyPerf` notes `sky:<layerId>` on the perf overlay.

A layout with no `sky` key does not call this. The playcheck fixture loads the script and acts only when `layout.sky` is present.

## Self-test

```bash
python3 tools/sky/selftest.py
```

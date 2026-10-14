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
| Swing | Slice-median exposure jumps by more than **24** between neighbours or across the whole chain. A rich nebula is allowed to be contrasty inside one slice. The raw column-luma range is printed as `columnSwing` and does not fail the gate (a window of 6 passed the flat step-2 collage and rejected the nebula the owner asked for). |

The report names the cheapest recook: both ends of a bad join are blamed, a clone or a mirror weighs more, and a tie goes to the later slice. A chain that only fails the close recooks the last slice.

## Living layers

A still slice is the painted sky. Each living layer is one seamless Imagine loop, decoded once. The play page tiles that frame at magnification ≤ 1 (one instanced draw per layer). It does not stretch one frame over the whole yaw. The manifest `display.videoTiles` block is the proof: a missing block, or a tile whose azimuth is 360°, fails. The 48 MiB cap counts those layer textures (`texBytes`), not the slice arrays. The play perf line reports total GPU textures.

| Layer | Duration |
| --- | --- |
| Stars | about 13 s |
| Dust | about 17 s |
| Nebula drift | about 29 s |

13, 17, and 29 are pairwise coprime. Their least common multiple is 6409 s. The gate fails a combined repeat under **600 s** (10, 20, and 30 s together repeat at 60 s). The report prints `combinedRepeatSec`.

Adjacent slice offsets must differ by at least **0.75 s**, including the wrap from last to first. Equal offsets make the slices pulse together.

Motion stays slow. Frame-to-frame gray MAE above **8** fails. A distinctive bright speck that comes back on a fixed period under **60 s** fails (a flash, a shooting star baked into the loop). An always-on star field is the texture and passes. A rare event, if one is wanted, is a separate one-shot Imagine clip with a random gap of at least **30 s** (`minGapSec` / `maxGapSec`), not a short loop.

Phone caps, with Bolt keeping one decoder of the game's four: at most **3** sky videos (layers, plus one decoder if any one-shot is playing) and **48 MiB** of sky-layer textures.

## Magnification

The same command rejects an interior motif: a window that repeats elsewhere in the slice, a left/right mirror, a copied half, or a hard seam in the middle of the frame. Neighbour interiors that match each other also fail. A soft join of two different paintings can still pass; look at the file. `python3 tools/sky/selftest.py` includes that row.

`display` on `sky.json` names every band, the cap, and each video tile: azimuth span, elevation span, and (for the cap) the elevation where it starts. The gate measures source width and height from the files and fails when screen pixels per source pixel exceed **1.0** on the 720×1600 play view. A video tile of 848×480 mapped over 360° fails. A tile of about 21° by 11° passes. Stills and the cap are in the same check. `tools/playcheck` fails `mag_max` when the live snapshot reports any of those sources above 1.

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

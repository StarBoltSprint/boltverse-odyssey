# Zone A sky ring

Status: IN TEST (2026-10-03). Owner phone QC is still open. Prompt text is not in this file. It is in `/workspace/grokcli/out/zoneA-step2b/provenance.json`.

## What shipped

Eight horizon slices, each two chained Imagine outpaints joined by an overlap crossfade, displayed over 45°. An upper band and a high band close the dome up to a square cap. Three existing seamless loops play as instanced tiles, one decoder and one draw per layer, magnification 0.792.

## QC stored

- `python3 tools/sky/check.py` PASS. Horizon 0.982, upper 0.933, high 0.982, cap 0.901, video tiles 0.792.
- Play snapshot mag_max 0.982, activeVideos 4, drawCalls 7.
- Loop-restart sky MAE about 1.0 on each layer.

## Do not repeat

Do not cut the middle of a joined slice to force one width. Do not stretch one video frame over 360°. Do not mix the tiles heavily enough to draw rectangles. Heading 0 can still show two cloud banks after the edge stamp. Straight up still shows the cap's dark centre and lat-long spokes.

Step 2c did not replace those slices. Two horizon continuations failed the same way and were stopped. The motif gate in `tools/sky/check.py` now fails a repeated, mirrored, copied, or hard-seamed interior. A bright living shape is keyed from its own pixels onto one tile. Prompt text for that layer is in `/workspace/grokcli/out/zoneA-step2c/provenance.json`, not here.

# fixture-solid

Test fixture. Not Imagine pixels. Not a hang.

The view set and the walkaround output are `tools/walkaround/testdata/synthetic-rock` (a generated solid). The objsheet report is `tools/objsheet/samples/repo-synthetic-rock`. The walkaround report is that folder's `qc/report.json`.

The assetcheck report is `tools/assetcheck/samples/good-cutout`, a different synthetic cutout that the gate marked PASS. It is here so `check` has a real tool report. It is not a measurement of these eight views. Do not treat this object as a cooked prop.

The intake guards on this manifest are stubs (`art_director: KEEP`, run PASS, one local box, approach layer, lod triangle counts, 0 px outline diff, a 1024 mipmapped texture). They are not measurements of the synthetic rock.

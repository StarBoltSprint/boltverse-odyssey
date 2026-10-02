---
name: take-retro
description: Close an accepted cook step with a take note, any new recipe, and any new failure. Use at the end of every accepted step, and when a tool let a defect through.
---

# Take retro

Do this at the end of every accepted step. Do not wait for the whole biome.

## Read first

- [`learn/failures.md`](../../../learn/failures.md)
- [`learn/recipes/INDEX.md`](../../../learn/recipes/INDEX.md)
- [`learn/take-notes/_template.md`](../../../learn/take-notes/_template.md)

## Write

1. Copy the template to `learn/take-notes/<YYYY-MM-DD>-<take>.md` on the first accepted step. On later steps, update that file. Record quota or turns spent per item, the biggest waste and why, what to reuse, and which recipes and failures were added.
2. If this step produced a cook that passed its QC rows, copy [`learn/recipes/_template.md`](../../../learn/recipes/_template.md) and add a row to the index. The prompt is the string that was sent. `not stored` if it was not saved. Do not reconstruct it.
3. If this step hit a miss that is not already in the failure log, append an entry. Name the test or row that now guards it. If no row guards it, say so.
4. If a repo tool let the defect through, reported a wrong number, or was hard to use, also write `feedback/<date>-<tool>.md` as in [`biome/docs/66-tool-feedback-loop.md`](../../../biome/docs/66-tool-feedback-loop.md). That file is the tool report. The failure log is the cook lesson. Both can exist. Neither auto-merges.

## Reuse instead of recook

A solid that already passed assetcheck, objsheet, and walkaround is registered:

```bash
python3 tools/library/library.py add --intake <intake.json>
python3 tools/library/library.py list
```

The next zone spec names `{ "library": "<id>" }`. Path strings still work.

Phone QC for the take is gathered, not rewritten, by:

```bash
python3 tools/reportview/build.py
```

A missing section on that page is NOT RUN. It is not a PASS.

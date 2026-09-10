# SMOKE — content lint (not a sermon)

After [VALIDATE.md](VALIDATE.md) (the box), before the URL:

```
node scripts/smoke-pack.mjs packs/<id>
```

Exit `0` = SMOKE PASS. Exit `1` = recook **that clip**, cap **2**, then ship the last PASS. Do not hang a FAIL required clip.

This is a machine. It does not explain CHAR.md.

## FAIL table

| Clip | FAIL if |
|---|---|
| walk | first frame ≈ last (aHash ham < 12) — it looped, it did not walk |
| walk | first closer to **end** still than start still |
| walk | last closer to **start** still than end still |
| breath | first far from last (ham > 28) — dest breath walked |
| enter | first ≈ last |
| enter | last ≈ dest Hall' spawn (clone bait: two positions in one cook) |
| any film | a sampled frame has **2+** white-dog blobs (clone / ghost) |

Required: breath-spawn, breath-A, breath-B, walk-spawn-A, walk-spawn-B.
Optional (walk-A-B, walk-B-A, enter): FAIL → recook or **drop**. Do not block the hall. Printed as WARN.

Needs `ffmpeg`. Clone scan = desaturated bright blobs in the lower 70%.

## Recook cap 2

1. FAIL line names the file. Recook **only that file**.
2. Smoke again.
3. Second FAIL → keep the last PASS encode if any; else freeze the pose still for breath, drop optional walks/enter.
4. Never a third Imagine cook. Never a sermon in the player chat.

Box = [VALIDATE.md](VALIDATE.md). Identity / clone / first-last = this file.

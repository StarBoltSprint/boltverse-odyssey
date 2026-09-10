# Layer C — Grok vision (one rule, no sermon)

**Walk last 2 seconds = ONE dog.** A second Bolt at spawn/center (Frost walk-A, 2026-09-10 t=13s) = `FAIL clone.two_dogs @ t=last`. Recook that walk. Do not hang.

**Required** on stills, walks, breaths. Optional on enter.
You are **not** kind to a profile wolf.

Look at the 3 frames (or 1 still) Smoke extracted:

```
.smoke/<clip>/first.jpg
.smoke/<clip>/mid.jpg
.smoke/<clip>/last.jpg
```

Official refs: `stills/spawn.jpg` `stills/at-a.jpg` `stills/at-b.jpg` + `lock/example-*.jpg` + `lock/bolt-back.jpg`.
Rifts: [DOORS.md](../DOORS.md) — L cyan RECT, R gold RECT, jambs+sill, never wood.

Return **exactly one line**:

```
PASS
```

or

```
FAIL <rule> @ <t=0|t=mid|t=last|still> (<note>)
```

`<note>` ≤ 4 words. No paragraph. No "almost".

## FAIL rules (copy, refuse dry)

| rule | if you see |
|---|---|
| `identity.face` | face / eyes to camera |
| `identity.muzzle` | snout toward camera |
| `identity.look` | looking at camera |
| `identity.profile` | head in profile (spawn especially) |
| `identity.three_quarter` | 3/4 body or head |
| `clone.two_dogs` | second dog / ghost |
| `clone.ghost` | transparent second body |
| `identity.black_silhouette` | black dog, unread fur |
| `identity.cape` | cape, armor, size morph |
| `identity.text` | text, UI, watermark |
| `identity.third_door` | a third portal |
| `identity.door_wood` | wood leaf / ajar timber |
| `identity.door_flat` | painted panel, no jambs/sill |
| `identity.door_morph` | RECT rift becomes a circle mid-walk |
| `identity.door_void` | black hole, no energy fill |
| `identity.door_chrome` | orb / UI overlay as the door |
| `identity.door_cut` | gold or teal rift cropped (illegal except last second of **enter**) |
| `identity.orbit` | dolly / tilt: paws sliding down, ceiling falling |
| `lock.lens_mismatch` | atA/atB not the same focal / distance as spawn |
| `encode.fade_black` | last frames go black / empty hall |

Wrong side / face = FAIL. Do not crop to hide it. Do not suggest Hall'.

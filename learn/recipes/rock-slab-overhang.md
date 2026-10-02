# rock — grey slate slab with an overhanging lip (owner-approved)

Status: partly validated. The still and the 8 keyed views passed the cutout and sheet rows below (take 10d attempt 2, ring-b). The set did NOT pass objsheet keep (0.452 / 0.377) or the walkaround silhouette fit (min IoU 0.470). Copy the still and the keying. Recook the orbit with the camera-lock lesson in `learn/failures.md`.

| Field | Value |
| --- | --- |
| Asset kind | `rock` |
| Take | 10d (still: attempt 1; orbit: attempt 2), Grok Build CLI |
| Commit | `c4436f2` on local branch `cli/take10d` (ring-b views) |
| Date | 2026-10-02 |
| Size | 1024×1024 (measured, every slab image) |
| Tries | still: 4 calls (40 → 43 → 47 → 49). Orbit: 8 kept of 40 slab calls in attempt 2 |
| CLI | still: `generate` then `edit`. Orbit: `edit`, aspect_ratio `1:1` |
| Image refs | attempt-1 session `01a0fc14-531c-7972-934a-543c43bfc855`; attempt-2 session `01a0fca2-a06a-7a70-b3cf-f697da89b6ec`. Orbit chain listed below with the `image` list of each call |

## Prompt

Still, image 40 (`generate`, 1:1):

```
One natural boulder photographed at eye level on a flat chroma-key green background. Asymmetric stone: a thick ledge juts to the left, a broken peak rises on the right, and a flat sheared face catches the light. Deep cracks, rough grain, solid rock all the way through. Cool grey stone with violet mineral streaks. Centered and large, with a wide empty green margin on every side. Even studio light, no floor, no cast shadow, no haze, no vignette.
```

Image 43 (`edit`, image = 40):

```
Remove the floor, the fabric, and the contact shadow. The same boulder floats centered on a perfectly flat even chroma-key green background, with a wide empty green margin on every side. Keep the rock's shape, cracks, and size unchanged.
```

Image 47 (`edit`, image = 43):

```
Move the camera closer so this same boulder fills most of the frame, with only a slim even green margin on every side. Keep the same angle, the same rock, and the flat chroma-key green background. No floor and no shadow.
```

Image 49 (`edit`, image = 47), the approved slab:

```
Orbit the camera forty-five degrees to the right around this same boulder so more of the right face shows. Keep the boulder the same size in the frame, with the same slim green margin, on the same flat chroma-key green background. No floor and no shadow.
```

Orbit (attempt 2). yaw-135 = image 5 (`edit`, image = a1/49):

```
The same single grey slate boulder, same overhanging lip, same purple mineral veins and cracks. Place it centered on a flat even chroma-green background with empty green margin on every side, about eight percent of the frame. No floor, no cloth, no cast shadow, no second stone. Keep the rock near sixty percent of the frame height.
```

yaw-180 = image 6 (`edit`, image = a1/49):

```
Orbit the camera ninety degrees so this exact same grey slate boulder is seen from its right side. The overhang reads as a shelf in profile and the purple veins stay in the stone. Centered on a flat even chroma-green background with empty green margin all around. No floor and no shadow sheet. Subject about sixty percent of the frame height.
```

yaw-225 = image 11 (`edit`, image = 4, 5):

```
Same grey slate boulder as both references. This camera sits halfway on the return orbit, so the overhanging lip is swinging from the right side back toward the left and we see a new three-quarter of the block. Keep the rock about sixty-eight percent of the frame height, centered on flat chroma green with empty margin on every side. No floor and no shadow.
```

yaw-270 = image 17 (`edit`, image = 6):

```
Rotate the camera about thirty degrees to the right around this exact boulder. Keep the same overhanging lip, the same purple veins, and the same face mostly in view; the lip shifts slightly toward the center. The rock stays the same height in the frame, centered on a flat even chroma-green background with empty margin on every side. No floor and no shadow.
```

yaw-315 = image 22 (`edit`, image = 20, 14):

```
One photograph of this exact same grey layered boulder, from a camera angle halfway between the two references. Keep the overhang, the purple veins, the broken top, and the same height in the frame. The stone should be a little narrower than the wider reference and a little wider than the narrower reference. Flat even chroma-green background, empty margin on every side, no floor and no shadow.
```

yaw-045 = image 24 (`edit`, image = 22):

```
Same grey layered boulder with purple veins and the left overhang, same height in the frame. Turn a little farther toward the end of the overhang so the stone becomes slightly narrower and the lip a little shorter. Flat even chroma-green background, empty margin on every side, no floor.
```

yaw-000 = image 30 (`edit`, image = 6):

```
Same grey layered boulder and the same long overhang. Swing that overhang so its tip, now at the far left, sits near the middle of the stone, and the big cracked face is seen more edge-on. Keep the same height in the frame. Flat even chroma-green background, empty margin on every side, no floor.
```

yaw-090 = image 34 (`edit`, image = 6, 30):

```
A camera angle halfway between these two pictures of the same grey layered boulder. The long overhang has moved part of the way from the far left toward the middle. Same purple veins, same height in the frame as the first picture. Flat even chroma-green background, empty margin, no floor.
```

Images 4, 14 and 20 are intermediate orbit plates of the same chain. Their prompts are in `/workspace/grokcli/out/take10d/work/a2-prompts.jsonl` on the box.

Key: a pixel is background when G>80 and G>R+30 and G>B+15 and R<90. Keep the largest connected component. Alpha is 0 or 255. RGB is unchanged. No resize.

## QC rows passed

Take 10d REPORT (attempt 2, `/workspace/grokcli/out/take10d/REPORT.md`).

| Command | Row | Numbers |
| --- | --- | --- |
| hull sheet script | ring_b_natural_rock | circularity < 0.85 in 8/8 views (0.464–0.633), wh range 0.256 |
| hull sheet script | hull_bg_transparent_ring_b | opaque outside dilated bbox 0 on all 8 views |
| hull sheet script | hull_views_distinct_ring_b | min adjacent IoU 0.597, min crop MAE 13.09 |
| hull sheet script | hull_fringe_clean_ring_b | specks 0, semi-transparent fringe 0 |
| ring hole script | ring_holes | max enclosed hole 0.004% (yaw-135) |
| NOT passed: `tools/objsheet/sheet.py` | keep | mean 0.452, min 0.377 (limit 0.80 / 0.75) |
| NOT passed: walkaround silhouetteFit | min IoU | 0.470, mean 0.596 (target 0.85) |

## Gotchas

- Ask for "about sixty percent of the frame height" on every call. Free framing drifts in size, and the hull vote carves the disagreement down to a box.
- "Orbit ninety degrees" returns a profile, but in-between angles drift. Halfway edits between two plates ("a camera angle halfway between these two pictures") gave the most usable in-betweens.
- The overhang concavity is filled by the hull's underside cap. That is a tool limit, not a cook defect (`/workspace/grokcli/out/take10d/hullcheck/HULLCHECK.md`).
- Prompt ids and image numbers: map a call to its output in stream order. Tool-call ids repeat after a context compaction.

## Reuse

The still chain (40 → 43 → 47 → 49) and the key copy unchanged. Swap only `Cool grey stone with violet mineral streaks` for `{PAINT}`. Recook the orbit with a fixed camera height and frame height on every call.

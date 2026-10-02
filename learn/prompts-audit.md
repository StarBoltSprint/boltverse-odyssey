# Prompt audit — 2026-10-02

No source file below was rewritten. A prompt that already passed, or that a HARD line says not to rewrite, stays byte for byte. The variants live only on this page. They are not sent until a cook uses them and a recipe stores the string that was actually sent.

Do not invent a kelvin. The sun slot is empty until the scene names one.

## Shared slots

Add these sentences to a **new** prompt. Leave a KEEP string alone.

**Level 1-point plate** (chase or a ground plate that shows a horizon):

```
Level camera. Horizon at 50 percent of the frame height. On 720 by 1600 that row is y=800. One vanishing point straight ahead. Verticals stay parallel. Do not use 0.38, 0.382, 1/3, or phi.
```

**Pitched plate** (only when the spec states the pitch):

```
Camera pitched {PITCH_DEG} degrees. Horizon near 0.38 of the frame height. Verticals converge. This is not a level plate.
```

**2-point orbit:**

```
Two vanishing points, both on a level horizon. Camera elevation +15 degrees. One distance. Horizontal field about 24 degrees (85 mm class). Yaw step 45 degrees for eight views, or 90 degrees for four. Same light on every view. At most five source images.
```

**Sky slice:**

```
One rectilinear sky slice. Horizontal field 60 degrees. This slice is one of eight, stepped 45 degrees, 25 percent overlap. No panorama. Measure the file width. Do not assume 2k.
```

**Nadir tile:**

```
Orthographic, straight down. No vanishing point. No horizon. Edges must tile. Texel density stays constant in pixels per world metre.
```

**Sun** (fill only the numbers the scene already has):

```
One sun. Azimuth {AZIMUTH_DEG} degrees. Elevation {ELEVATION_DEG} degrees. {KELVIN} K. Shadow length equals height divided by tan of the elevation. At 45 degrees the shadow equals the height.
```

**Bolt scale** (cutout, not a chase-plate enlarge):

```
White German Shepherd. Withers about 0.60 m at the shoulders. State the pixel fraction, then measure. Do not enlarge the cutout.
```

**First and last** (video that is not a hall film):

```
First frame and last frame are both pinned. First is the previous last. Last is the same world, closer.
```

**Living painted film** (Golden rule, when the subject is a painted world):

```
Living painted film. Sharp edges. No circles. No egg-pod.
```

**Negatives** (append; a chroma-green key field stays legal):

```
No text. No HUD. No extra animals. No round boulder. No sphere. No egg-pod. No circle emblem. No mirrored edge. No cloned edge. No green fringe on the subject.
```

## Sources left unchanged

| Source | Why it stays |
| --- | --- |
| `biome/prompts/camera-1point.txt` | HARD do not rewrite. “Upper third / lower two thirds” is the pitched sprint paste. |
| `biome/prompts/image-empty-plate.txt`, `video-empty-plate.txt`, `image-bolt-mid.txt`, `video-bolt-mid.txt`, `image-hazard-plate.txt`, `video-hazard-plate.txt`, `last-frame.txt`, `hazard-1lane.txt`, `snowball-refs.txt` | Live lane prompts. Geometry slots go in the variant, not in the file. |
| `biome/prompts/paint-*.txt`, `color-*.txt` | Paint and grade locks. No second biome. |
| `biome/prompts/howl-attack.txt`, `howl-obstacle.txt`, `howl-shatter.txt` | Keyed FX plates. Howl KEEP is the video, not a still. |
| `FILMS.md`, `COOK.md`, `CLIP.md` | Hall motion, camera, one dog, and duration stay. A citadel interior has no outdoor horizon to move to 0.50. |
| `scripts/imagine-hooks.mjs` `LAW`, `breathLine`, `walkClipLine`, `BIOME_*`, `BOLT_*` | Live strings. The CLI must keep sending the owner film text. |
| `lock/RIG-PROMPT.txt` | Style lock. This pass does not touch `lock/`. |
| `learn/recipes/hull-ship-xai-starship-hero.md` | KEEP chain. “Eighteen degrees” stays. A new turnaround uses +15° and is not a rewrite of this file. |
| `learn/recipes/rock-slab-overhang.md` | KEEP still chain (40 → 43 → 47 → 49). The orbit is not a recipe. “Eye level” stays in the KEEP still. |

## Variants (not applied)

### Level empty plate

Before, `biome/prompts/image-empty-plate.txt` (unchanged):

```
Photoreal vertical 9:16, 720x1280. Locked-off camera. Empty sprint corridor still. NEVER pan, tilt, zoom, or dolly. ZERO dogs. ZERO German Shepherds. ZERO animals. ZERO people. Lane surface = {LANE_MATERIAL}. ZERO extra follow-path on top of that surface. ZERO lightning on ground. ZERO Y-fork. ZERO portals. ZERO HUD. ZERO text. CLEAR empty center corridor. Rails/curbs OK. THREE straight lanes, one vanishing point. {PAINT}
```

After, for a **level** plate only. The 720×1280 line stays the law 23 frame. The horizon sentence is the rail 12 row, which on a 1600-tall phone is y=800 and on this 1280-tall plate is y=640:

```
Photoreal vertical 9:16, 720x1280. Level locked-off camera. Horizon at 50 percent of the frame height (row 640 on this frame; row 800 on 720x1600). One vanishing point straight ahead. Verticals stay parallel. Do not use 0.38 or phi. Empty sprint corridor still. NEVER pan, tilt, zoom, or dolly. ZERO dogs. ZERO German Shepherds. ZERO animals. ZERO people. Lane surface = {LANE_MATERIAL}. ZERO extra follow-path on top of that surface. ZERO lightning on ground. ZERO Y-fork. ZERO portals. ZERO HUD. ZERO text. CLEAR empty center corridor. Rails/curbs OK. THREE straight lanes. {PAINT}
```

Why: the live line locks the camera and the single vanishing point, and it does not say whether the horizon is level. The Frost diamond at 0.38 is a pitched cone. A new level plate has to say 0.50 so the two are not mixed.

### Pitched sprint paste

Before: `biome/prompts/camera-1point.txt` stays, including “ONE vanishing point ahead, in the sky just above the road diamond.”

After, only when the spec states the pitch. Do not replace the file:

```
Camera pitched {PITCH_DEG} degrees. Horizon near 0.38 of the frame height, the road diamond of the Frost cone. Verticals converge. This is not a level 0.50 plate. One vanishing point. Do not add phi or 0.618.
```

Why: law 24 now documents 0.38 as a stated pitch. The HARD file still carries the sealed paste.

### 2-point orbit (new turnaround)

Before, rock KEEP still (`learn/recipes/rock-slab-overhang.md`, image 40), unchanged:

```
One natural boulder photographed at eye level on a flat chroma-key green background. ...
```

After, for a new 3/4 set. The KEEP still text stays. “Eye level” is not +15°.

```
One natural boulder, two-point, elevation +15 degrees, horizontal field about 24 degrees, one distance. Flat chroma-key green background. Asymmetric stone: a thick ledge juts to the left, a broken peak rises on the right, and a flat sheared face catches the light. Deep cracks, rough grain, solid rock all the way through. Cool grey stone with violet mineral streaks. Centered, with empty green margin on every side. One sun, azimuth and elevation and kelvin as named by the scene. No floor, no cast shadow, no haze, no vignette. No round boulder. No sphere. No text. Yaw steps of 45 degrees (eight views) or 90 degrees (four). At most five source images. Same light on every view.
```

Why: the KEEP still is eye level and the orbit of that rock is not a passing recipe. A new orbit has to lock elevation, field, and yaw before the first edit.

### Ship hero

Before, step 1 of `learn/recipes/hull-ship-xai-starship-hero.md`, unchanged: “camera boomed up to eighteen degrees above the horizon.”

After, for a **new** hero that is a 3-point shot, or for a new turnaround that is 2-point. Do not send this over the KEEP chain.

```
Re-photograph this exact black faceted starship. Turnaround: elevation +15 degrees, one distance, horizontal field about 24 degrees, yaw step 45 degrees. Same light. At most five source images. The keel stays level and the needle nose still points left. Same ship, same torn wing, same swept fins, same dark weathered exposure, centred on a flat uniform chroma-green screen with empty green margin on every side. No egg-pod. No circle emblem. No second ship. No green fringe on the hull.
```

Why: eighteen degrees is the KEEP camera. The lock’s turnaround elevation is +15°. Rewriting the KEEP prompt would invent a cook that did not happen.

### Sky slice

Before: law 64 section D (generate slice 1 at 21:9 or 5:2, edit the next from the previous). The plate-0 prompt was not stored. This audit does not write one.

After, the camera sentence to put on the next stored slice:

```
One rectilinear sky slice, horizontal field 60 degrees, eight slices, 45 degree step, 25 percent overlap. Living painted film. No panorama. No mirrored edge. No cloned edge. No text. Measure the width.
```

Why: the magnification example at 22.7° is a pixel budget. Closing the circle is the 8×60×45 set. The chain method (edit from the previous slice, hard-paste kept pixels) stays.

### Nadir tile

Before: the ground-tile prompt was not stored (index: no recipe file).

After, when a cook stores one:

```
Orthographic ground, straight down, about 0.90 m across. No vanishing point. No horizon. No Bolt. Edges tile. Grain stays the same density in pixels per metre. No text. No mirrored edge. No cloned edge.
```

Why: a seamless tile is not an Imagine mode. The sentence gives the QC something to measure (`--report texel`) without running the dash judge.

### Bolt cutout

Before, `biome/prompts/image-bolt-mid.txt` stays, including the green field, the rear lock, and `{PAINT}`.

After, append only. Do not drop the teacher or the green field:

```
Withers about 0.60 m at the shoulders. State the pixel fraction from h_px = f_px × H / Z, then measure. Do not enlarge. One sun, azimuth and elevation and kelvin as named by the scene. No green fringe on the coat. The flat #00FF00 field stays.
```

Why: the live line already bans a second dog and a 3/4. It does not state shoulder metres. Law 20’s 0.10 frame fraction is not this sentence.

### Howl

Before: `biome/prompts/howl-attack.txt` stays (black field, vertical rings, no wolf, no road, no letters).

After: none. The plate is a keyed FX card. A horizon sentence would invent a world behind it. Negatives already in the file cover text, wolf, and road.

### Hall films

Before: `FILMS.md` and `scripts/imagine-hooks.mjs` stay.

After: none for motion, camera, dog count, or duration. Décor still swaps from the player stills and `catalog/<slot>.md` only.

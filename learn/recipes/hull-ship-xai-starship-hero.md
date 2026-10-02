# hull/ship — xAI-Starfleet-style starship hero, 18° camera, etched shield emblem

Status: hero still validated (HERO_READY rows below, take 10d ship r3). The 8-view orbit cooked from this hero did NOT pass: 4/8 views passed (see Gotchas and `learn/failures.md` "orbit views drift in camera height and exposure"). Copy the hero chain. Do not copy the orbit prompts as a recipe.

| Field | Value |
| --- | --- |
| Asset kind | `hull/ship` |
| Take | 10d, ship round r3 (Grok Build CLI, worktree `cli/take10d-ship`) |
| Commit | `0bb54c1` on local `cli/take10d` (wreck10 installs the r3 views; the hero is yaw-090). Stills on the box at `/workspace/grokcli/out/take10d/ship-ref/` |
| Date | 2026-10-02 |
| Size | 1280×720 (measured, `raw/hero.jpg`) |
| Tries | 6 hero calls in r3 (kept call 6). r1 and r2 before that: 37 and 27 Imagine calls for the design |
| CLI | `edit` (Grok Build `image_edit`), aspect_ratio `16:9` |
| Image refs | Chain, one `image` each: r2 hero → session image 3 → image 4 → image 6 (kept). Session `01a0fcdb-26ff-7750-bd61-03df0cf99155`. Design refs `ref-63.jpg` and `emblem-closeup.png` were second and third images on tries 1–2 only: they pulled the mark into a sticker, so the kept plate is a single-source chain |

## Prompt

Step 1 (image 3, source = r2 broadside hero):

```
Re-photograph this exact black faceted starship with the camera boomed up to eighteen degrees above the horizon. The keel stays level and the needle nose still points left. A visible ribbon of the top deck now shows between the near hull edge and the far hull edge, and the torn upper wing shows its top skin, while the flank armor still fills most of the view. Same ship, same torn wing, same swept fins, same dark weathered exposure, centred on a flat uniform chroma-green screen with empty green margin on every side.
```

Step 2 (image 4, source = image 3):

```
Keep this exact camera, this exact eighteen-degree elevation, this exact framing, and this exact black starship. Change only the small bright violet bolt-and-dagger sticker on the flank. Replace that sticker with a smaller mark etched into the metal: an angular shield outline in dark scratched violet, about one third the old badge, with a paw made of jagged lightning bolts inside it and a straight blade below the shield. Hull scratches and grime run across the mark. Only the bolt lines carry a faint pulse. Do not brighten the ship. Flat chroma-green screen stays.
```

Step 3 (image 6, kept, source = image 4):

```
Keep this exact camera and this exact black starship on flat chroma green. Leave the angular lightning shield, shrink it to about one third, and seat it on the rear flank panel above the lower fin. Add a straight etched blade directly under that shield. Remove the separate paw-and-dagger so the ship carries exactly one insignia. The shield stays dark, scratched, and flush with the hull, with only a faint pulse on the lightning.
```

## QC rows passed

From `ship-ref/HERO_READY.txt` (r3), measured by the ship run, then checked by eye by the Director.

| Command | Row | Numbers |
| --- | --- | --- |
| ship-run drift script | margins | L 0.0414 T 0.1861 R 0.0422 B 0.1847 (min 0.03) |
| ship-run drift script | luma vs r2 hero | 32.770 vs 32.946, rel −0.0053 |
| ship-run drift script | silhouette same ship | mask IoU vs r2 hero 0.791 after the camera raise, aspect 2.589 vs 2.682 |
| ship-run drift script | elevation | 18°, top fraction 0.0588 |
| visual | emblem | one angular shield outline, dark violet, etched; paw of jagged bolts; straight blade; scratches cross it; faint pulse only; no text or logo; rear flank, about 1/3 of the old badge |
| reported only | hs_corr vs r2 hero | 0.7408 (the new deck in frame moves the hue histogram) |

## Gotchas

- Change one thing per edit: the camera first (step 1), then the mark (steps 2–3). Raising the camera and swapping the mark in one call missed both (tries 1–2).
- A close-up of the emblem as a second image turns the mark into a glowing sticker. Describe the mark in words. Do not pass a picture of it.
- The model adds a second insignia (try 4). Ask for "exactly one insignia" and name the panel ("rear flank panel above the lower fin").
- Keep "Do not brighten the ship". Every edit drifts brighter.
- Yaw-000/180/045/315 orbit views from this hero drifted (plan or steep cameras, +13..+38% luma, keel tilt 22–25°). See the failure entry.

## Reuse

Copy the three-step chain unchanged for the same ship. For another biome, swap only the paint words (`black faceted`, `dark scratched violet`) for `{PAINT}`. Keep "eighteen degrees above the horizon", "keel level", "flat chroma-green screen with empty green margin on every side".

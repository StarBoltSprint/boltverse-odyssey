# 64 — Imagine and Build limits (any cook)

Kitchen only. Not a hang. Dated **2026-10-01**.

**This repo holds no biome palette and no Imagine prompt** (biome names are allowed, SmiR 2026-10-03). Each player chooses the paint. This page is the documented Imagine / Build caps and how a cold session adapts. Nothing below is a look to copy.

Documented rows are from [docs.x.ai](https://docs.x.ai) as of that date. A row marked **reported** or **UNCERTAIN** is not law. Do not promote it.

The hero stays the sealed lock mp4 already in this repo (`lock/bolt-gallop-cycle.mp4`). A decor plate does not draw a wolf or any other hero.

## A — Long Build sessions

**Reported, not official** (stated by @grok, not in docs.x.ai): a long Build session auto-compacts history around **~85%** full, and early instructions drop with no warning.

**Rule (this repo):**

1. Before any long cook, write a short **spec file** in the repo: goal, hard laws, plate list, done-when.
2. Restart from that file. The transcript is not the spec.
3. Write a **handoff file** before the session saturates.
4. One cook = **one plate** or **one extension**.
5. Re-read the spec before QC.

## B — Imagine Video 1.5 (documented)

| | |
| --- | --- |
| Duration | **1–15 s** |
| Default | **480p** |
| **1080p** | Pure text-to-video, or image-to-video from **one** image. No reference images, no `last_frame`, no keyframes. |
| Reference-to-video | Adding any of the three below drops the cap to **720p**. |

What makes it reference-to-video:

| Input | Cap |
| --- | --- |
| `last_frame` | 720p |
| Keyframes | max **4**, strictly **inside** the clip, on a **1/3 s** grid. 720p |
| Reference images | max **7**, named `<IMAGE_0>` … . The pinned first image is `<IMAGE_0>`. 720p |

Pinned first + last (the loop this repo cooks) is reference-to-video, so **720p**. There is **no loop mode**. Pinning the same image on both ends is the closest trick. The seam is not guaranteed.

| Mode | Rule |
| --- | --- |
| Extension | mp4 input **2–15 s**. Adds **2–10 s** from the last frame. **720p** cap. |
| Edit | Keeps the source length. Source **≤ 8.7 s**. **720p** cap. Cannot combine with reference images. |

## C — Imagine Image 2.0 (documented)

| | |
| --- | --- |
| Resolution tokens | **1k** / **2k**. The pixel size is **not published**. Always measure the file. |
| Widest aspects | **21:9** and **5:2** |
| Panorama, outpaint, tile | Not a mode. No output wider than **2k**. |
| Multi-image edit | Up to **5** source images. |
| Transparent / alpha output | **Not documented.** Check the file for an alpha channel. If it has none, key it. |
| 8 consistent views of one object | **Not a documented feature** (max 5 sources). Keep the [`tools/objsheet`](../../tools/objsheet/README.md) consistency checks. |

## D — How this pipeline adapts

**360 sky** (amended 2026-10-03 to match [`docs/METHOD.md`](../../docs/METHOD.md), rail 12 and the biome kits). **8 native Imagine slices**, each **60° HFOV**, stepped **45°** (25% overlap, `8 × 45 = 360`), level horizon 0.50, plus living seamless-looping Imagine layers.

1. Generate slice 1 at the widest aspect (21:9 or 5:2).
2. Measure the real width. Do not assume a pixel size from the 1k / 2k token.
3. The slice count is fixed at **8**. Each slice's measured width must reach the width the play view needs for magnification **≤ 1.0** over its 60°:

   `required_px = play_width / (hfov_deg / 360)` for the full ring, so each 60° slice needs `required_px × 60 / 360`.

   Example: play hfov **22.7°** on a **720 px** wide view → ring `720 / (22.7 / 360) ≈ 11419 px`, so each 60° slice needs **≥ ~1903 px**. A narrower slice fails the magnification gate: recook it wider (21:9 / 5:2); do not add slices or stretch.
4. Each next slice is an Imagine **edit** with the previous slice as the source.
5. QC the joins with [`tools/sky/check.py`](../../tools/sky/README.md) (clone / mirror, join MAE, luma swing, closed ring) and [`tools/assetcheck`](../../tools/assetcheck/README.md) (backdrop wrap, seam, magnification).

**Living plates.** Prefer **1080p image-to-video** for ground and sky plates where sharpness matters (one image, no refs, no last frame, no keyframes). Accept **720p** when the cook needs an identity lock or a pinned first+last loop, and put that 720p size into the magnification budget.

**QC fails closed.** A miss on any row stops the cook. Do not hang it.

| Fail | |
| --- | --- |
| Duration | Outside **1–15 s** |
| Resolution | Illegal for that mode (1080p only on pure text-to-video or single-image image-to-video) |
| Aspect | Mismatch against the plate the cook asked for |
| First frame | Not the pin |
| Last frame | Unstable |
| Morph | Shape pop across the clip |
| Loop | Visible seam |
| Hero | Any wolf or other hero drawn in a decor plate. The hero is the locked mp4. |
| Play | Magnification **> 1.0** |

Prefer a still compare over regenerating a video. Video and image share one weekly usage pool.

`tools/assetcheck` measures the file (magnification, loop seam, morph, backdrop). The mode, the pin, and the duration window are read from the cook record plus that file. A hand-written PASS is not a PASS.

## E — Build sandbox

docs.x.ai does not document a GPU, a depth model, or an image-to-3D model inside the Build sandbox. Do not brief that step as something Build runs.

Invisible shape comes from [`tools/walkaround`](../../tools/walkaround/README.md): **8** views, or the optional `--shape photogrammetry` / `--shape primitive` modes. An open image-to-3D model runs only on an **external GPU host**, and it produces **shape only**.

GitHub **export** is not an auto-push. docs.x.ai does not state when a grok.me URL expires. **GitHub is the source of truth.**

## F — UNCERTAIN (not law)

Do not treat any of these as a cap, a budget, or a cook rule:

- Which model and context grok.com Build uses (**4.7** at 500k vs **grok-build-0.1** at 256k).
- A consumer **30 s** video length.
- **8** parallel Build agents.
- Per-asset cost against the weekly pool.
- Native frames per second.

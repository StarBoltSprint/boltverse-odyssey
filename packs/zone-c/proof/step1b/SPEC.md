# Zone C step 1b — highlands, far solids, morning sky

## Goal

Replace the flat Cascade Verdance pad with a large organic highland the player can walk, far cliffs and ridges as real solids, and a morning sky whose only backdrop is the sky.

## Rails

- Every visible pixel is an Imagine image or video. Code places shape only. Far hills and cliffs are lofted solids with one unlit Imagine skin each. The sky is the only backdrop.
- Magnification ≤ 1.0 on 720×1600. No camera shake. No invisible walls. No circles or rings.
- Phone: drawCalls ≤ 12, texMB ≤ 260, active videos ≤ 4 including Bolt. Bolt and the shared menus stay.
- Imagine budget: ≤ 14 images and ≤ 2 videos.
- Ground materials blend across metres. A family change is not a hard edge.

## Done when

1. The relief is a large highland (rolling hills and a valley), far above the step 1 span of about 4 m on 6500 m².
2. Far cliffs and ridges are 3D solids. A parallax pair shows them shift against a nearer hill.
3. The base sky is a warm morning field with no painted land. Mist and clouds are two looping videos that move. Heading 270 has no vertical slice seam.
4. Proof shots and `proof.json` (drawCalls, texMB, mag max) land in `/workspace/grokcli/out/zoneC/step1b/`: four headings, one under a hill, one far-parallax pair.
5. Root tests pass. The step is committed on `zone-c-step1-ground-sky`.

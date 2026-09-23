# COLD START — shoulder panorama (law 42)

Read this when the player already has a biome and asks to look left and right, to board a path beside the road, or to hide the seam between plates.

Read [42-shoulder-panorama.md](42-shoulder-panorama.md). Do not read law 41 for this. Law 41 is eclipse yaw. This is three videos.

## Do this

1. Keep Bolt. Keep the road plates. Do not recook them.
2. Grab one frame of the live plate. Cook two wing videos from it, same light, same horizon height. Left wing: the road is off the right edge. Right wing: the road is off the left edge. One sentence of this biome fills the frame. No extra lanes. No mirror.
3. Wire `uSideL` and `uSideR`. If either video is not ready, `uGlance = 0`.
4. Paste the seam from [../scripts/shoulder-panorama/shoulderPanorama.js](../scripts/shoulder-panorama/shoulderPanorama.js). Sky seam 0.20. Floor seam 0.48. `cover` kills the wing as soon as the look returns. Sample the wing inward (0.78 / 0.22). No fog veil.
5. Split the gesture. A flick changes lane. A hold of 150 ms and 32 px looks, and eases back at 10/s. From the outer lane, one more flick boards the shoulder. Look locks. Bolt tweens to `x = ±1`.
6. The shoulder scrolls only while boarded. `ridePath` samples the live road into one ribbon. Flow is `dt * 0.72` and only then. Looking without boarding shows the vista and a faint core. It does not scroll.
7. `uYaw` stays 0. `uLook` stays 0. Bolt's X uses the same open curve as the road shift.
8. On a biome fade, drop the board and snap Bolt back to the outer lane.

## Fail

- A stitched still, a V-mirror, or a multi-band bake. The line comes back.
- A mist veil on the seam. The player already rejected it.
- Clamping the road edge and blending that column. Vertical smear.
- Return rate 3.2. The wings stay on the edges for seconds.
- A look threshold of 16 px. It steals the lane flick.
- A white beam instead of the live road sample.
- Yaw and this panorama in the same frame.
- The wing video itself set to scroll.

Numbers: [../scripts/shoulder-panorama/shoulderPanorama.js](../scripts/shoulder-panorama/shoulderPanorama.js).

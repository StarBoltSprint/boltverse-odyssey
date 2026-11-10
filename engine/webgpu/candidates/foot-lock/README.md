# Foot contact candidate

Isolated from the live meadow (`m448aaa2.js`), the meadow biome file, and the tunnel. Nothing here is wired into a public page.

Bolt on the live card is a rear gallop atlas. The stride clock already follows the ground: `phase += distance / strideM`, with `strideM = 7 / 1.95 = 3.5897 m`. What the card does not do is hold a sole still during its stance. The paw stays parented to the chest, so it skates at the body's speed for the whole plant.

`engine/webgpu/engine/footcontact.js` is the reusable brick (`makeFootContact(cfg)`). A biome passes speed, stride rate, card size, camera, and an atlas contact table. `lock: false` is the live behaviour, used as the before measurement. The brick does not draw fog.

This scene uses that brick. Meadow config matches the live card and the live follow camera. Canyon config only retunes the stride clock (8.6 m/s, 2.25 Hz, stride 3.8222 m). There is no canyon gallop sheet in this repo, so canyon still uses the meadow atlas.

Contacts come from `bolt439_atlas.png`. A column is planted only when its lowest opaque pixel is on the card's ground line (within about 1 cm of the root). An id follows that sole until a flight frame. The next touchdown is a new plant. Idle is atlas frame 21, the frame where both hind soles sit on that line. Live idle is frame 0, which has one sole on the line.

## Script

10 s at 1/60 s, already at gallop speed: straight 0–2 s, turn left 2–3.5 s, turn right 3.5–5 s, release, brake, stand. Turn rate and brake match the live handler (75°/s, 5.5 m/s²).

Slide is the world XZ travel of a sole that was already in stance on the previous frame, in cm per frame. The mesh row is the same point as drawn: the barycentric sample of the card at the sole's texture coordinate. Chest vertices above `v = 0.42` are not moved. Card scale stays 1.

| | straight | turn left | turn right | brake | idle |
|---|---:|---:|---:|---:|---|
| Before, cm/frame | 11.676 | 11.652 | 11.691 | 6.294 | 1 sole, lift 0.243 cm, no second sole |
| After, cm/frame | 0 | 0 | 0 | 0 | 2 soles, dy 0, lift 0 |

Chest-band height std is 0 cm before and after. Chest shift is 0. Card scale is 1. Root screen x is 0.5075 before and after (the live lateral offset of −1.2 cm). Phase advance is 0.2786 per metre, which is `1 / 3.5897`. The live shader's upper-body UV bob is 5.175 cm at full gallop; this candidate does not apply it.

Samples: straight 93, turn left 73, turn right 73, brake 48. Every sole triangle stayed fully locked (`lockWMin = 1`).

## Limits

- This is a rear card, not a leg skeleton. At full gallop the chest moves up to **0.852 m** past a planted sole. That offset is along the view, so the chest is not scaled, but the lower card does shear in depth.
- The atlas silhouette still changes height across the cycle (about 482–613 px in a 652 px cell). Frames are not rescaled, so that painted pulse is unchanged.
- Idle is a different atlas frame from the live one, at the same card size, because frame 0 is not a two-paw plant.
- Canyon proves the config object. It does not prove a canyon gallop.
- This machine has no GPU. Headless Chrome opened the page and did not produce a WebGPU image. The 720×1280 film is an in-house raster of the same vertices the scene uploads.

## Run

```
node engine/webgpu/candidates/foot-lock/measure.mjs
python3 engine/webgpu/candidates/foot-lock/raster.py
cd engine/webgpu && python3 -m http.server 8765
```

Open `candidates/foot-lock/index.html`. `?play=1` uses the keyboard. `?biome=canyon` swaps the stride config. `?lock=0` is the skating baseline.

Film: `proof/foot-lock-9x16.mp4`. Stills: `proof/stills/`. Numbers: `proof/metrics.json`.

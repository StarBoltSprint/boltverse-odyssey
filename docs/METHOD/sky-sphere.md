# Sky sphere — one seamless 2:1 sky (zone B onward)

Back to [METHOD.md](../METHOD.md). **Status: IN TEST (2026-10-08)**, owner chose this for zone B (Ember Mesa) after Grok on X advice. The validated zone A slice sky ([sky.md](sky.md)) stays locked until this scores better on the phone.

## Why it replaces the 9-slice ring

The zone B sky was 9 horizon slices around Bolt plus a repeated upper band. Problems seen 2026-10-08:
- visible seams between slices and between the bands;
- 8 of 9 slices identical and sunless, so the light was not coherent;
- a **black hole at the zenith** when the camera looks up (the ring stopped too low).

## Rule

- **One** seamless equirectangular **2:1** Imagine sky on an inside-out sphere. One seam only, left edge == right edge. Sky and zenith are the same image.
- **No planet and no moons in the sky image.** The planet is a real 3D object (below).
- Sun disc in the image matches the zone light sheet (Ember Mesa: low right, 8° up). Its x position fixes the sun azimuth for every other prompt ([lighting-coherence](lighting-coherence.md) §2b).
- Clean sky at the top (no text, no logo). Unlit, `NoToneMapping`. Fog far colour is sampled from this plate's horizon row.

## Magnification check (law 65) — open issue

On 720×1600 portrait with vertical FOV 58°, the screen shows ~27.6 px per degree. A 2:1 sky at magnification ≤ 1 needs about **9,900 × 4,950 px**. Three stitched 1168 px images give ~3,500 px wide, i.e. about **2.8× magnification**. `learn/geometry.md` also notes Imagine has no native panorama. Before shipping, pick one (owner decision):
- build the 2:1 from enough Imagine tiles to reach the target size (GPU-compressed, inside texMB ≤ 260), or
- declare the sky backdrop magnification as an accepted known issue.

## If Imagine cannot output 2:1

1. Generate 2–3 wide images with the same light sheet.
2. Stitch them, outpaint the gaps and the top to 2:1.
3. Make left edge == right edge (outpaint across the wrap).
4. **Wrap test:** paste the right edge against the left edge; no visible seam. Then check the zenith (no pinch, no hole) on the sphere.
5. Remove any Grok watermark (outpaint, never a code-drawn patch).

Grok-on-X images are **colour / light references, not drop-in plates**. Example: its Ember Mesa wrap plate was 1168×784 (≈3:2, not 2:1), the edges did not match (sun haze on one side, mesa and blue sky on the other) and it carried a watermark.

## Planet = real rotating sphere + ring mesh

Replaces the green-screen planet video for zone B (its keying ate the night side into black bands).

```js
const planet = new THREE.Mesh(new THREE.SphereGeometry(80, 48, 32),
  new THREE.MeshBasicMaterial({ map: planetEquirect }));   // Imagine equirect 2:1 planet map
planet.position.set(-40, 50, -180);
const ring = new THREE.Mesh(new THREE.RingGeometry(108, 150, 64),
  new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
planet.add(ring);
// per frame
planet.rotation.y += dt * 0.015;
ring.rotation.z  += dt * 0.04;
```

Planet map: one Imagine 2:1 planet texture (prompt in the untracked `*.local.md`, per the prompt-text rule). Keep the poles low-detail to avoid pinching and wrap-test the map's own seam. See also [aaa-look](aaa-look.md) §2.

## Done when

1. [ ] One 2:1 plate, wrap test clean, no watermark, no planet in it.
2. [ ] Looking straight up shows sky, no hole, no pinch.
3. [ ] Planet sphere + ring rotate; no black bands.
4. [ ] Fog far colour sampled from this plate's horizon.

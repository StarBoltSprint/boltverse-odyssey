# Placement from the key

Reusable lift from one key still onto the Zone B staging page.

```bash
python3 tools/placement-from-key/selftest.py
python3 tools/placement-from-key/place.py all --out steps/placement-key-1011
```

What it does:

1. Grok vision boxes in `vision_boxes.json`, refined by SAM2 (`sam2_hiera_tiny`, CPU).
2. Depth Anything V2 small, scaled with one ground-plane anchor on the key camera. MoGe is not installed.
3. Each instance gets a world position, a height from its silhouette, and a yaw toward the camera. The raw lift is stored. The applied move is a nudge from the current seat: towers stay at least 55 m ahead of the camera and outside lateral 22, the spire 70 m and lateral 36, mesas 90 m and lateral 110. Scale stays within 0.80–1.20 of the original for a tower or the spire, and 0.90–1.10 for a mesa. Wreck and arch have no mesh: they are TODO markers. Rail and slabs are procedural boxes in `objects-t7.mjs`, not assets, so their targets are recorded and the meshes are not moved.
4. The sun ray is the key sun pixel. The gas giant is placed on the opposite heading so it leaves the key frame. Staging `biome.json` and staging `sky1/sky-t7.mjs` only.
5. Two renders. The second is one image-space nudge of at most 8 m, still inside the same clamp. The decision score is the weighted IoU of tower, spire, and mesa. A frame whose sky collapses or whose luma falls under 0.55 of the before frame is rejected. Then stop. A rejected pair restores the layout backup. The raw lifts stay in the zone file.

The live tree `/workspace/zb-preview-1008` is not written. The page is `http://127.0.0.1:8997/index-placement.html`.

Silhouette IoU is the SAM mask against non-sky, non-sand pixels in that mask's box. The blocking target in the step spec is 0.75.

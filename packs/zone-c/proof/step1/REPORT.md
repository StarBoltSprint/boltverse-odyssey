# Zone C step 1 — Cascade Verdance

Date: 2026-10-05

Verdict: PASS

Playable highland relief with four Imagine ground families, a nine-slice Imagine horizon, one repeated upper gradient, and two moving sky videos. Bolt uses the zone A controller (joystick and camera-tilt swipe). Archives and the pause menu use the shared hall module. Imagine spend: 14 stills and 2 videos. Standing cutouts were not cooked. The image budget was closed.

## Done when

| # | Row | Measured |
| --- | --- | --- |
| 1 | Boot with Bolt on the relief | `packs/zone-c/play/index.html` ready. heroPixels 16213. One hero on the live walk. |
| 2 | Four Imagine ground materials, mask, cutouts if the budget allows | Families moss rock, wet gravel, turf, wet slate. Each file is paired so the mask mix cannot invent a fifth material. Mask is the turf still. Cutouts omitted. |
| 3 | Imagine base sky and two videos that move | Horizon mag 0.9937. Upper mag 0.9749. Mist 13.042 s and clouds 11.042 s, both 720×720, both playing. Sky-check display rows pass. |
| 4 | Four headings, per-layer shots, proof.json | `/workspace/grokcli/out/zoneC/step1/`. drawCalls 9, texMB 127.949, mag 0.994. |
| 5 | Root tests, playcheck unit tests, live playcheck recorded | Root `npm test` exit 0. `tools/playcheck` npm test 56 pass / 0 fail. Live walk exit 1, 28 pass / 7 fail, report under that proof folder. |
| 6 | Commit on `zone-c-step1-ground-sky` | This step. |

## Phone

Canvas 720×1600. Spawn (−4, 16), heading 90. Presented mag 0.994. Ground mag 0.788. Bolt mag 0.459. Surface UV worst 0.998 (planar worst 1.025). Mesh n=300, tris 69726, verts 36857, area 6500 m², height −1.98 m to 2.26 m, max slope 0.151. drawCalls 9 (sky, living cards, ground, Bolt, archives, four post quads). texMB 127.949. activeVideos 3 (Bolt idle plus mist plus clouds). WebGL errors 0. HUD only with `?debug=1`.

## Known issues

Accepted with the step. The image and video budgets are closed, so these were not recooked.

- Sky `check.py` status FAIL, 48 rows. Display magnification passes. Motif repeat on the nearly empty slices (h0 ncc 0.9914). Joins MAE 23.15 to 85.87 (limit 4). Close h8 to h0 MAE 39.69. Exposure swing 59.67 (limit 24). Both loops fail the frozen tail (first frame pinned to last). Combined repeat 143 s (limit 600). The video tool caps a clip at 15 s, so the 13 / 17 / 29 s set cannot be made.
- Look-up above about 45° is unpainted. The chase frame top sits inside the painted bands. There is no cap.
- `stair_crown` on the painted horizon: layer-ground 0 runs, layer-sky 6 runs, jump 4 px, heading 90. The live walk reports the same silhouette on several headings (runs 7 to 20). The relief mesh is not the source.
- `untextured` on `04-stop-315`: two flat patches, area 0.0439 and 0.0437. `black_regions` passed.
- Live playcheck on schema `clearing/1` also fails `gate`, `ring_closed`, `stops_visible`, `collider_eq_visual`, and `fog_band`. This step has no gate, no stone ring, and no fog-patch atlas. The eight outward samples were not blocked (gap about 32 m to 36 m). `foot_contact`, `tile_repeat`, `solids_world_locked`, `mag_max`, and `render_source` passed.
- Family changes are a hard vertex step. The 1.45 m tile period can still read in a wide view. `contain()` holds the body on the outline.

## Run

From the repo root:

```
python3 -m http.server 8877 --bind 127.0.0.1
```

Open `http://127.0.0.1:8877/packs/zone-c/play/index.html`.

Live walk: `node tools/playcheck/run --url http://127.0.0.1:8877/packs/zone-c/play/index.html?intro=0 --layout packs/zone-c/clearing.json --source packs/zone-c/play/play.js --no-video --out /workspace/grokcli/out/zoneC/step1/playcheck`.

Prompts stay in `/workspace/grokcli/out/zoneC/step1/provenance.json`.

# Zone A step 1

Date: 2026-10-03

Verdict: PASS

Built an irregular 6500 m2 relief mesh for zone A: ridges, a channel, two basins, a far crest pad, and four Imagine ground families with per-image depth displacement plus low detail cards.

Checked a phone canvas of 720×1600 (360×800 CSS at DPR 2) and a 412×915 CSS viewport. Console errors: none. Walk mag_max 0.912, ground mag_max 0.912. Area 6500 m2. Tris 77310, verts 40829, cards 400. Height −1.74 to 7.66 m. Max slope 0.639. Four headings from the origin stayed unblocked. Post-pass: fps_avg before=916.03 after=1043.48, fps_1low before=500 after=833.33, frame_ms before=1.09 after=0.96, bloom=half. Those times are JS submit on this host, not a phone GPU. Root npm test exit 0. Saved tile opposite-edge seam ratio 0.000 and absolute seam 0.00 on m0–m7 and the mask. Proof cameras presented mag 0.910.

Known issues: a wide view still reads the 1.45 m tile period; family changes are hard placement edges; the placeholder sky shows a slice seam and a dark cap; a few detail cards read as small chunks; materials 6 and 7 are the same still after one image edit returned HTTP 429; the mesh rim is coarse in the overview; 07-wide-412.png is byte-identical to 02-wide.png because the play canvas is locked at 720×1600.

## Run

From the repo root:

```
python3 -m http.server 8933 --bind 127.0.0.1
```

Open `http://127.0.0.1:8933/packs/zone-a/play/index.html`.

## Screenshots

- `packs/zone-a/proof/step1/01-overview.png` — wide overview inside the sky cylinder
- `packs/zone-a/proof/step1/02-wide.png` — chase on a rising ridge
- `packs/zone-a/proof/step1/03-close.png` — close ground, boom 4.2 m, presented mag 0.910
- `packs/zone-a/proof/step1/04-low.png` — eye near Bolt height
- `packs/zone-a/proof/step1/05-basin.png` — hollow beside a raised lip
- `packs/zone-a/proof/step1/06-crest.png` — standing on the far crest pad
- `packs/zone-a/proof/step1/07-wide-412.png` — same pose as 02, CSS viewport 412×915

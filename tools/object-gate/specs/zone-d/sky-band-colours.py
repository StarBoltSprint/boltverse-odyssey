#!/usr/bin/env python3
"""Per-plate mean colour (linear RGB) of the top 12 % band of each sky12 source plate listed in the pack's pack-report.json.
The sky dome continues this colour above the plate top (~19.7 deg) so the upper dome carries Imagine pixels, not a typed colour."""
import json, sys, numpy as np
from PIL import Image
rep = json.load(open(sys.argv[1])); out = []
for p in rep['plates']:
    a = np.asarray(Image.open(p['src']).convert('RGB'), np.float64) / 255.0; band = a[: int(a.shape[0] * 0.12)]
    lin = np.where(band <= 0.04045, band / 12.92, ((band + 0.055) / 1.055) ** 2.4)
    out.append({'id': p['id'], 'src': p['src'].split('/')[-1], 'top_lin': [round(float(v), 5) for v in np.median(lin.reshape(-1, 3), 0)]})
json.dump({'tool': 'sky-band-colours', 'band': 'top 12% median', 'plates': out}, open(sys.argv[2], 'w'), indent=1); print(out)

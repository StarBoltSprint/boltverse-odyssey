#!/usr/bin/env python3
"""Capture play.html views in real headless Chrome (WebGL via SwiftShader) at spine phone size and
assemble a review sheet. usage: capture.py URL_BASE OUTDIR [--chrome PATH]"""
import json, sys
from pathlib import Path
import cv2, numpy as np
from playwright.sync_api import sync_playwright
VIEWS = ["key", "3m", "chase", "45", "grazing", "side", "scale"]
base, out = sys.argv[1].rstrip("/"), Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
chrome = sys.argv[sys.argv.index("--chrome") + 1] if "--chrome" in sys.argv else None
probes, logs = {}, []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=chrome, args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    for v in VIEWS:
        pg = b.new_page(viewport={"width": 412, "height": 915}, device_scale_factor=1.5)
        pg.on("console", lambda m: logs.append(f"{v}: {m.text}"))
        pg.on("pageerror", lambda e: logs.append(f"{v} ERR: {e}"))
        pg.goto(f"{base}/play.html?view={v}&dpr=1.5")
        pg.wait_for_function("window.__ready === true", timeout=180000)
        pg.wait_for_timeout(1500)
        pg.evaluate("window.__ready=false"); pg.evaluate("1")
        pg.screenshot(path=str(out / f"view-{v}.png"))
        probes[v] = pg.evaluate("window.__probe"); pg.close()
    b.close()
(out / "probes.json").write_text(json.dumps({"probes": probes, "logs": logs}, indent=1))
tiles = []
for v in VIEWS:
    im = cv2.resize(cv2.imread(str(out / f"view-{v}.png")), (412, 915), interpolation=cv2.INTER_AREA)
    cv2.rectangle(im, (0, 880), (412, 915), (0, 0, 0), -1)
    cv2.putText(im, v, (8, 905), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
    tiles.append(im)
tiles.append(np.full_like(tiles[0], 40))
sheet = np.vstack([np.hstack(tiles[:4]), np.hstack(tiles[4:8])])
cv2.imwrite(str(out / "review-sheet.jpg"), sheet, [cv2.IMWRITE_JPEG_QUALITY, 88])
print(json.dumps(probes, indent=1)); print("\n".join(logs[:20]))

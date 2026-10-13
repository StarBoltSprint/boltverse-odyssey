#!/usr/bin/env python3
"""Render play.html?view=key (solved key camera, 1024x1024, DPR 1) in headless Chrome. usage: keyshot.py URL_BASE MODEL OUT.png [--chrome PATH]"""
import sys
from playwright.sync_api import sync_playwright
base, model, out = sys.argv[1].rstrip("/"), sys.argv[2], sys.argv[3]
chrome = sys.argv[sys.argv.index("--chrome") + 1] if "--chrome" in sys.argv else None
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=chrome, args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 1024, "height": 1024}, device_scale_factor=1)
    pg.goto(f"{base}/play.html?view=key&dpr=1&hud=0&model={model}" + (sys.argv[sys.argv.index("--q") + 1] if "--q" in sys.argv else ""))
    pg.wait_for_function("window.__ready === true", timeout=180000); pg.wait_for_timeout(1000)
    pg.screenshot(path=out); b.close()

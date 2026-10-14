#!/usr/bin/env python3
"""render tools/scenebuild/view.html headless at 1024x1024. usage: shot.py URL_BASE OUT.png [--q '&k=v']"""
import sys
from playwright.sync_api import sync_playwright
base, out = sys.argv[1].rstrip("/"), sys.argv[2]; q = sys.argv[sys.argv.index("--q") + 1] if "--q" in sys.argv else ""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 1024, "height": 1024}, device_scale_factor=1)
    pg.goto(f"{base}/view.html?{q}"); pg.wait_for_function("window.__ready === true", timeout=180000); pg.wait_for_timeout(300)
    pg.screenshot(path=out); b.close()

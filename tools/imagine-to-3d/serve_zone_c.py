#!/usr/bin/env python3
"""Serve the Zone C solids staging page on 127.0.0.1:8772.

Does not write the live preview. Does not bind the terrain port.
"""

from __future__ import annotations

import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
LIVE_THREE = Path("/workspace/zb-preview-1008/three.module.js")
STAGING = ROOT / "staging" / "zone-c-solids"
DATA = REPO / "steps" / "zone-c" / "05-solids" / "data"
TERRAIN = REPO / "steps" / "zone-c" / "03-terrain" / "data"
PLATES = REPO / "steps" / "zone-c" / "03-terrain" / "plates"
KEY = REPO / "steps" / "zone-c" / "03-terrain" / "key-zc1.jpg"
FIELD = REPO / "tools" / "terrain-from-key" / "keyed-field.mjs"
PLAN = ROOT / "specs" / "zone-c-plate-plan.json"


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        raw = path.split("?", 1)[0].split("#", 1)[0]
        if raw.startswith("/data/"):
            base, rel = DATA, raw[len("/data/") :]
        elif raw.startswith("/terrain-data/"):
            base, rel = TERRAIN, raw[len("/terrain-data/") :]
        elif raw.startswith("/plates/"):
            base, rel = PLATES, raw[len("/plates/") :]
        elif raw in ("/three.module.js", "/three/three.module.js"):
            return str(LIVE_THREE)
        elif raw == "/key-zc1.jpg":
            return str(KEY)
        elif raw == "/lib/keyed-field.mjs":
            return str(FIELD)
        elif raw == "/zone-c-plate-plan.json":
            return str(PLAN)
        else:
            base, rel = STAGING, raw.lstrip("/") or "index.html"
        target = (base / rel).resolve()
        if not str(target).startswith(str(base.resolve())):
            return str(STAGING / "index.html")
        return str(target)

    def log_message(self, fmt, *args):
        return


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--port", type=int, default=8772)
    p.add_argument("--host", default="127.0.0.1")
    args = p.parse_args()
    if args.port != 8772:
        raise SystemExit("Zone C solids staging is port 8772")
    if args.host not in ("127.0.0.1", "localhost"):
        raise SystemExit("bind 127.0.0.1 only")
    httpd = ThreadingHTTPServer(("127.0.0.1", 8772), Handler)
    print("http://127.0.0.1:8772/  zone-c solids staging")
    httpd.serve_forever()


if __name__ == "__main__":
    main()

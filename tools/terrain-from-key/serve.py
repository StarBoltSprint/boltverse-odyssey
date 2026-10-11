#!/usr/bin/env python3
"""Serve the staging page and the live preview side by side.

The live index.html is not written. / is the staging page. /live/ is the
existing preview, read only, so the before shot can load it.
"""

from __future__ import annotations

import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
LIVE = Path("/workspace/zb-preview-1008")
STAGING = ROOT / "staging"
DATA = REPO / "steps" / "terrain-key2-1011" / "data"
THREE = LIVE / "three.module.js"
TILES = REPO / "packs" / "zone-a" / "src" / "ground"


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        raw = path.split("?", 1)[0].split("#", 1)[0]
        if raw.startswith("/live/"):
            rel = raw[len("/live/") :]
            base = LIVE
        elif raw.startswith("/data/"):
            rel = raw[len("/data/") :]
            base = DATA
        elif raw in ("/three.module.js", "/three/three.module.js"):
            return str(THREE)
        elif raw.startswith("/tiles/"):
            rel = raw[len("/tiles/") :]
            base = TILES
        else:
            rel = raw.lstrip("/")
            base = STAGING
        target = (base / rel).resolve()
        if not str(target).startswith(str(base.resolve())):
            return str(base / "index.html")
        return str(target)

    def log_message(self, fmt, *args):
        return


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--port", type=int, default=8767)
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--data", type=Path, default=None)
    p.add_argument("--zone", default="b", choices=("b", "c"))
    args = p.parse_args()
    global DATA, STAGING
    if args.zone == "c":
        DATA = REPO / "steps" / "zone-c" / "03-terrain" / "data"
        STAGING = ROOT / "staging" / "zone-c"
    if args.data is not None:
        DATA = args.data.resolve()
    if args.host not in ("127.0.0.1", "localhost"):
        raise SystemExit("bind 127.0.0.1 only")
    httpd = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"http://127.0.0.1:{args.port}/  staging")
    print(f"http://127.0.0.1:{args.port}/live/index.html  live (read only)")
    httpd.serve_forever()


if __name__ == "__main__":
    main()

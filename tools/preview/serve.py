#!/usr/bin/env python3
"""Serve frozen phone previews on the loopback interface only.

  python3 tools/preview/serve.py --root previews --port 8765

The host is 127.0.0.1. Any other host is refused. There is no tunnel flag
and no deploy flag. Publishing a public URL is a Director step after the
owner's explicit OK, written in tools/preview/README.md.
"""

from __future__ import annotations

import argparse
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

LOOPBACK = {"127.0.0.1", "localhost"}


def resolve_host(host: str) -> str | None:
    if host not in LOOPBACK:
        return None
    return "127.0.0.1"


def serve(root: Path, host: str, port: int) -> int:
    bound = resolve_host(host)
    if bound is None:
        print("FAIL preview serve: host must be 127.0.0.1", file=sys.stderr)
        return 2
    if not root.is_dir():
        print(f"FAIL preview serve: {root} is not a directory", file=sys.stderr)
        return 2
    handler = partial(SimpleHTTPRequestHandler, directory=str(root))
    httpd = ThreadingHTTPServer((bound, port), handler)
    print(f"PASS preview serve http://{bound}:{httpd.server_address[1]}/")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Serve local phone previews on 127.0.0.1")
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args(argv)
    return serve(args.root, args.host, args.port)


if __name__ == "__main__":
    sys.exit(main())

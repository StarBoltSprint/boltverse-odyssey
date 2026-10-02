#!/usr/bin/env python3
"""Frozen play copy, latest pointer, index row, and loopback-only serve.

  python3 tools/preview/selftest.py
"""

from __future__ import annotations

import json
import threading
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PREVIEW = ROOT / "tools" / "preview"

import sys

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.preview.freeze import main as freeze_main  # noqa: E402
from tools.preview.serve import resolve_host, serve  # noqa: E402


def fail(msg: str) -> None:
    raise SystemExit(f"FAIL selftest: {msg}")


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def test_sources_stay_local() -> None:
    blob = (PREVIEW / "freeze.py").read_text(encoding="utf-8") + (PREVIEW / "serve.py").read_text(encoding="utf-8")
    for banned in ("ngrok", "cloudflared", "localtunnel", "vercel"):
        if banned in blob:
            fail(f"preview tool mentions {banned}")


def test_freeze_and_serve(tmp: Path) -> None:
    play = tmp / "play"
    write(play / "index.html", "<!DOCTYPE html><title>fixture play</title><p>FIXTURE PLAY</p>")
    write(play / "play.js", "/* fixture */\n")
    report = tmp / "REPORT.md"
    write(report, "Verdict: PASS\nDate: 2026-10-02\n")
    walk = tmp / "walk.mp4"
    walk.write_bytes(b"fixture-walk")
    out = tmp / "previews"
    code = freeze_main(
        [
            "--zone",
            "zone-a",
            "--commit",
            "abc1234",
            "--report",
            str(report),
            "--play-dir",
            str(play),
            "--walk",
            str(walk),
            "--out",
            str(out),
            "--date",
            "2026-10-02",
        ]
    )
    if code != 0:
        fail("PASS report did not freeze")
    version = out / "zone-a" / "abc1234"
    if not (version / "play" / "index.html").is_file():
        fail("play page was not copied")
    if (version / "walk.mp4").read_bytes() != b"fixture-walk":
        fail("walk.mp4 was not copied")
    meta = json.loads((version / "meta.json").read_text(encoding="utf-8"))
    if meta["verdict"] != "PASS" or meta["publicUrl"] is not None:
        fail(f"meta {meta}")
    latest = out / "zone-a" / "latest"
    if not latest.is_symlink() or latest.resolve() != version.resolve():
        fail("latest pointer is wrong")
    index = (out / "zone-a" / "index.html").read_text(encoding="utf-8")
    for needle in ("abc1234", "2026-10-02", "PASS", "walk.mp4"):
        if needle not in index:
            fail(f"index missing {needle}")

    write(report, "Verdict: FAIL\n")
    code = freeze_main(
        [
            "--zone",
            "zone-a",
            "--commit",
            "def5678",
            "--report",
            str(report),
            "--play-dir",
            str(play),
            "--out",
            str(out),
        ]
    )
    if code == 0 or (out / "zone-a" / "def5678").exists():
        fail("FAIL report was frozen")

    if resolve_host("0.0.0.0") is not None or resolve_host("localhost") != "127.0.0.1":
        fail("host gate")
    code = serve(out, "0.0.0.0", 9)
    if code != 2:
        fail("public host was accepted")

    httpd_box: dict = {}

    def run() -> None:
        from functools import partial
        from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

        handler = partial(SimpleHTTPRequestHandler, directory=str(out))
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        httpd_box["httpd"] = httpd
        httpd.serve_forever()

    thread = threading.Thread(target=run, daemon=True)
    thread.start()
    for _ in range(50):
        if "httpd" in httpd_box:
            break
        time.sleep(0.02)
    if "httpd" not in httpd_box:
        fail("server did not start")
    httpd = httpd_box["httpd"]
    port = httpd.server_address[1]
    if httpd.server_address[0] != "127.0.0.1":
        fail("server did not bind loopback")
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/zone-a/index.html", timeout=5) as resp:
            page = resp.read().decode("utf-8")
            status = resp.status
        if "abc1234" not in page or status != 200:
            fail("local index did not serve")
    finally:
        httpd.shutdown()


def main() -> None:
    import tempfile

    test_sources_stay_local()
    with tempfile.TemporaryDirectory() as tmp:
        test_freeze_and_serve(Path(tmp))
    print("PASS preview selftest")


if __name__ == "__main__":
    main()

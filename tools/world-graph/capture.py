#!/usr/bin/env python3
"""Headless Zone B captures. Prints nothing invented: pixels, SSIM, LPIPS, draws.

Usage: python3 tools/world-graph/capture.py --port N --out report.json
"""
import argparse, base64, json, os, sys, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, "/home/box/.local/lib/python3.13/site-packages")
sys.path.insert(0, str(ROOT / "tools" / "imagine-to-3d"))

from PIL import Image
import numpy as np
from i23d_common import luma, ssim
from compare import lpips_dist


def http_json(url, method="GET"):
    req = urllib.request.Request(url, method=method)
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r)


class Cdp:
    def __init__(self, ws_url):
        from websocket import create_connection
        self.ws = create_connection(ws_url, max_size=64_000_000, timeout=180)
        self.n = 0

    def call(self, method, params=None):
        self.n += 1
        self.ws.send(json.dumps({"id": self.n, "method": method, "params": params or {}}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == self.n:
                if "error" in msg:
                    raise RuntimeError(json.dumps(msg["error"]))
                return msg.get("result", {})


def new_page(port):
    last = None
    for method in ("PUT", "GET"):
        try:
            return http_json(f"http://127.0.0.1:{port}/json/new?about:blank", method)
        except Exception as err:
            last = err
    raise last


def shoot(cdp, url, w, h, png_path, timeout_s=180):
    cdp.call("Emulation.setDeviceMetricsOverride", {
        "width": w, "height": h, "deviceScaleFactor": 1, "mobile": False,
    })
    cdp.call("Network.setCacheDisabled", {"cacheDisabled": True})
    cdp.call("Page.navigate", {"url": url})
    deadline = time.time() + timeout_s
    ready = False
    load_text = ""
    errors = []
    while time.time() < deadline:
        time.sleep(0.4)
        ev = cdp.call("Runtime.evaluate", {
            "expression": "({ready: !!window.__ready, errors: window.__errors || [], load: (document.getElementById('load')||{}).textContent || ''})",
            "returnByValue": True,
        })
        val = (ev.get("result") or {}).get("value")
        if not isinstance(val, dict):
            continue
        load_text = val.get("load") or ""
        errors = val.get("errors") or []
        if val.get("ready"):
            ready = True
            break
    if not ready:
        raise RuntimeError("not ready " + url + " load=" + load_text + " errors=" + json.dumps(errors))
    # Two frozen frames so the first draw has landed before the shot.
    cdp.call("Runtime.evaluate", {
        "expression": "new Promise((res)=>requestAnimationFrame(()=>requestAnimationFrame(()=>res(1))))",
        "awaitPromise": True,
        "returnByValue": True,
    })
    shot = cdp.call("Page.captureScreenshot", {
        "format": "png",
        "fromSurface": True,
        "clip": {"x": 0, "y": 0, "width": w, "height": h, "scale": 1},
    })
    raw = base64.b64decode(shot["data"])
    Path(png_path).write_bytes(raw)
    measured = cdp.call("Runtime.evaluate", {
        "expression": "({errors: window.__errors||[], st: window.__st, passes: window.__measurePasses ? window.__measurePasses() : null})",
        "returnByValue": True,
    })
    info = (measured.get("result") or {}).get("value") or {}
    info["ready"] = True
    info["png"] = str(png_path)
    im = Image.open(png_path).convert("RGB")
    info["size"] = [im.width, im.height]
    return info


def rgb(path):
    return np.asarray(Image.open(path).convert("RGB")).astype(np.float64) / 255.0


def mean_abs(a, b):
    return float(np.mean(np.abs(a - b)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, required=True)
    ap.add_argument("--cdp", type=int, required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--shots", required=True)
    args = ap.parse_args()
    zone = json.loads((ROOT / "zone-b.zone.json").read_text())
    q = zone["runtime"]["capture"]["query"]
    poses = {
        "hero": zone["cameras"]["hero"]["previewPose"],
        "street": zone["cameras"]["street"]["previewPose"],
        "m8": zone["cameras"]["m8"]["previewPose"],
    }
    shots = Path(args.shots)
    shots.mkdir(parents=True, exist_ok=True)
    page = new_page(args.cdp)
    cdp = Cdp(page["webSocketDebuggerUrl"])
    cdp.call("Page.enable")
    cdp.call("Runtime.enable")
    cdp.call("Network.enable")

    def url_for(side, pose):
        eye = pose["eye"] if pose.get("eye") is not None else pose["resolvedEye"]
        return (
            f"http://127.0.0.1:{args.port}/{side}/index.html?{q}"
            f"&x={pose['x']}&z={pose['z']}&yaw={pose['yaw']}&pitch={pose['pitch']}&eye={eye}"
        )

    rows = {}
    for name, pose in poses.items():
        w, h = (480, 900)
        for side in ("ref", "zone"):
            info = shoot(cdp, url_for(side, pose), w, h, shots / f"{name}-{side}.png")
            rows[f"{name}-{side}"] = {
                "passes": info.get("passes"),
                "errors": info.get("errors"),
                "st": info.get("st"),
                "size": info.get("size"),
            }
            print(f"shot {name} {side} errors={info.get('errors')} calls={(info.get('passes') or {}).get('main')}", flush=True)

    key_pose = poses["hero"]
    key_w, key_h = Image.open(zone["keyImage"]).size
    for side in ("ref", "zone"):
        info = shoot(cdp, url_for(side, key_pose), key_w, key_h, shots / f"key-{side}.png")
        rows[f"key-{side}"] = {
            "passes": info.get("passes"),
            "errors": info.get("errors"),
            "st": info.get("st"),
            "size": info.get("size"),
        }
        print(f"shot key {side}", flush=True)

    diffs = {}
    for name in ("hero", "street", "m8"):
        a = rgb(shots / f"{name}-ref.png")
        b = rgb(shots / f"{name}-zone.png")
        diffs[name] = {
            "meanAbs": mean_abs(a, b),
            "meanAbsOver255": mean_abs(a, b),
            "refLuma": float(luma(a).mean()),
            "zoneLuma": float(luma(b).mean()),
            "size": list(a.shape),
        }
        print(f"diff {name} meanAbs={diffs[name]['meanAbs']:.6f} luma={diffs[name]['refLuma']:.4f}", flush=True)

    hero = rgb(shots / "hero-ref.png")
    street = rgb(shots / "street-ref.png")
    key_ref = rgb(shots / "key-ref.png")
    key_img = rgb(zone["keyImage"])
    if key_img.shape != key_ref.shape:
        raise RuntimeError(f"key size {key_img.shape} render {key_ref.shape}")
    ssim_v = float(np.mean(ssim(luma(key_ref), luma(key_img))))
    lpips_v = float(lpips_dist(key_ref.astype(np.float32), key_img.astype(np.float32)))
    passes = rows["key-ref"]["passes"] or {}
    main_pass = passes.get("main") or {}
    report = {
        "pixelDiff": diffs,
        "heroDiffersFromStreet": mean_abs(hero, street) > 0.02,
        "keyImage": zone["keyImage"],
        "keyCamera": {
            "ssim": ssim_v,
            "lpips": lpips_v,
            "drawCalls": main_pass.get("calls"),
            "triangles": main_pass.get("tris"),
            "passes": passes,
            "size": rows["key-ref"]["size"],
        },
        "qualityGates": zone["qualityGates"],
        "shots": rows,
    }
    gates = zone["qualityGates"]
    calls = main_pass.get("calls")
    tris = main_pass.get("tris")
    report["qualityGatesCheck"] = {
        "drawCalls": calls,
        "triangles": tris,
        "maxDrawCalls": gates.get("maxDrawCalls"),
        "maxTrisOnScreen": gates.get("maxTrisOnScreen"),
        "drawCallsOk": calls is not None and calls <= gates["maxDrawCalls"],
        "trisOk": tris is not None and tris <= gates["maxTrisOnScreen"],
    }
    Path(args.out).write_text(json.dumps(report, indent=1) + "\n")
    print("wrote", args.out, flush=True)


if __name__ == "__main__":
    main()

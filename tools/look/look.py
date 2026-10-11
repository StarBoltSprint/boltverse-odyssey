"""Unreal-look entry. One biome directory in, look.json + LUT + bake outputs out.

  python3 tools/look/look.py build --key KEY --out DIR [--sky SKY] [--light JSON] [--game PNG] [--plates DIR]
  python3 tools/look/look.py install --live LIVE --stage STAGE
  python3 tools/look/look.py check
  python3 tools/look/look.py selftest
"""
import argparse, importlib, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import colour_check
import grade
import stage

# Feature modules land one at a time. A missing module is "not built yet", not a failure.
EXTRAS = (
    ("bake", "bake", "build"),
    ("envmap", "env", "build"),
    ("fog", "fog", "build"),
    ("shadows", "shadows", "build"),
    ("sprites", "sprites", "build"),
)


def _load(name):
    try:
        return importlib.import_module(name)
    except ModuleNotFoundError:
        return None


def build(a):
    os.makedirs(a.out, exist_ok=True)
    doc = {
        "schema": "unreal-look/1",
        "key": os.path.abspath(a.key),
        "sky": os.path.abspath(a.sky) if a.sky else None,
        "light": os.path.abspath(a.light) if a.light else None,
        "features": {"grade": grade.build(a.key, a.out, a.game)},
    }
    requests = []
    kw = dict(key_path=a.key, out_dir=a.out, sky=a.sky, light=a.light, plates=a.plates, game=a.game)
    for mod_name, feat_name, fn in EXTRAS:
        mod = _load(mod_name)
        if mod is None or not hasattr(mod, fn):
            continue
        feat = getattr(mod, fn)(**kw)
        doc["features"][feat_name] = feat
        requests.extend(feat.get("requests") or [])
    path = os.path.join(a.out, "look.json")
    json.dump(doc, open(path, "w"), indent=1)
    hits = []
    colour_check.verify_json(path, doc, hits, {})
    if hits:
        raise SystemExit("colour " + hits[0])
    req_path = os.path.join(a.out, "imagine-requests.json")
    json.dump({"status": "NEEDS_APPROVAL", "count": len(requests), "requests": requests}, open(req_path, "w"), indent=1)
    print(json.dumps({"look": path, "curve": doc["features"]["grade"]["curve"], "distance": doc["features"]["grade"]["distance"], "requests": len(requests)}))
    return doc


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build")
    b.add_argument("--key", required=True)
    b.add_argument("--out", required=True)
    b.add_argument("--sky")
    b.add_argument("--light")
    b.add_argument("--game")
    b.add_argument("--plates")
    i = sub.add_parser("install")
    i.add_argument("--live", required=True)
    i.add_argument("--stage", required=True)
    sub.add_parser("check")
    sub.add_parser("selftest")
    a = ap.parse_args()
    if a.cmd == "build":
        build(a)
    elif a.cmd == "install":
        print(json.dumps(stage.install(a.live, a.stage, os.path.join(HERE, "runtime"))))
    elif a.cmd == "check":
        sys.exit(colour_check.main([None, HERE]))
    elif a.cmd == "selftest":
        import selftest
        sys.exit(selftest.main())


if __name__ == "__main__":
    main()

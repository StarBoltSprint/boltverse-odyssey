"""Fail if a new look module or config types a colour instead of sampling an image.

Allow-list: a line that says "not a colour", and neutral black / white (0x000000 / 0xffffff)
on a line that says "neutral". Curve-coefficient files start with "not a colour".
"""
import json, os, re, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
HEX = re.compile(r"(?<![A-Za-z0-9_])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b")
RGBFN = re.compile(r"\b(?:rgba?|hsla?)\s*\(")
OX = re.compile(r"\b0x[0-9a-fA-F]{6}\b")
SCAN_EXT = {".py", ".mjs", ".js", ".json", ".glsl"}


def _skip_line(line):
    low = line.lower()
    return "not a colour" in low or "not a color" in low


def scan_text(path, text):
    hits = []
    lines = text.splitlines()
    file_ok = bool(lines) and ("not a colour" in lines[0].lower() or "not a color" in lines[0].lower())
    for i, line in enumerate(lines, 1):
        if file_ok or _skip_line(line):
            if HEX.search(line) or RGBFN.search(line):
                hits.append(f"{path}:{i}: hex or an rgb function is not covered by the curve allow")
            continue
        if HEX.search(line) or RGBFN.search(line):
            hits.append(f"{path}:{i}: typed colour {line.strip()[:120]}")
        m = OX.search(line)
        if m:
            val = m.group(0).lower()
            if val not in ("0x000000", "0xffffff") or "neutral" not in line.lower():
                hits.append(f"{path}:{i}: hex integer {val} (only neutral 0x000000 / 0xffffff)")
    return hits


def _close(a, b, tol):
    return max(abs(float(x) - float(y)) for x, y in zip(a, b)) <= tol


def verify_json(path, obj, hits, img_cache):
    if isinstance(obj, dict):
        if "rgb" in obj or "linear" in obj:
            src = obj.get("source")
            if not isinstance(src, dict) or "image" not in src:
                hits.append(f"{path}: rgb/linear without a source image")
            else:
                _verify_colour(path, obj, src, hits, img_cache)
        if "value" in obj and isinstance(obj.get("source"), dict) and obj["source"].get("method") == "luma-percentile":
            _verify_luma(path, obj, hits, img_cache)
        if obj.get("source", {}).get("method") == "lab-band" if isinstance(obj.get("source"), dict) else False:
            _verify_band(path, obj, hits, img_cache)
        for v in obj.values():
            verify_json(path, v, hits, img_cache)
    elif isinstance(obj, list):
        for v in obj:
            verify_json(path, v, hits, img_cache)


def _img(cache, image):
    if image not in cache:
        import sample
        cache[image] = sample.load_rgb(image)
    return cache[image]


def _verify_colour(path, obj, src, hits, cache):
    if src.get("method") != "mean-rect":
        return
    if not os.path.exists(src["image"]):
        hits.append(f"{path}: missing source image {src['image']}")
        return
    import sample
    got = sample.mean_rect(_img(cache, src["image"]), src["rect"])
    if "rgb" in obj and not _close(got, obj["rgb"], 2 / 255):
        hits.append(f"{path}: rgb {obj['rgb']} != resample {got}")
    if "linear" in obj:
        lin = [float(v) for v in sample.srgb_to_lin(np.array(got))]
        if not _close(lin, obj["linear"], 2 / 255):
            hits.append(f"{path}: linear {obj['linear']} != resample {lin}")


def _verify_luma(path, obj, hits, cache):
    src = obj["source"]
    if not os.path.exists(src["image"]):
        hits.append(f"{path}: missing source image {src['image']}")
        return
    import sample
    got = sample.luma_percentile(_img(cache, src["image"]), src["p"], src["image"])["value"]
    if abs(got - float(obj["value"])) > 1e-3:
        hits.append(f"{path}: luma percentile {obj['value']} != resample {got}")


def _verify_band(path, obj, hits, cache):
    src = obj["source"]
    if not os.path.exists(src["image"]):
        hits.append(f"{path}: missing source image {src['image']}")
        return
    import sample
    bands = sample.lab_bands(_img(cache, src["image"]), src["image"])
    match = [b for b in bands if b["L0"] == src["L0"] and b["L1"] == src["L1"]]
    if not match:
        hits.append(f"{path}: lab band {src['L0']} missing")
        return
    if abs(match[0]["a"] - obj["a"]) > 0.05 or abs(match[0]["b"] - obj["b"]) > 0.05:
        hits.append(f"{path}: lab band drifted {obj['a'], obj['b']} vs {match[0]['a'], match[0]['b']}")


def scan_tree(root):
    hits = []
    cache = {}
    for dirpath, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d != "__pycache__"]
        for name in files:
            ext = os.path.splitext(name)[1]
            if ext not in SCAN_EXT:
                continue
            path = os.path.join(dirpath, name)
            text = open(path, encoding="utf-8", errors="replace").read()
            hits.extend(scan_text(path, text))
            if ext == ".json":
                try:
                    verify_json(path, json.loads(text), hits, cache)
                except json.JSONDecodeError as e:
                    hits.append(f"{path}: json {e}")
    return hits


def main(argv):
    root = argv[1] if len(argv) > 1 else HERE
    hits = scan_tree(root)
    if hits:
        print("\n".join(hits))
        print(f"FAIL {len(hits)}")
        return 1
    print(f"PASS colour-literal {root}")
    return 0


if __name__ == "__main__":
    sys.path.insert(0, HERE)
    sys.exit(main(sys.argv))

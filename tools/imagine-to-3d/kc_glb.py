"""Grade one embedded image of a GLB (Imagine pixels only) into the KC STAGING mirror (2026-10-10, keyloop colour step
for objects whose albedo lives in a GLB, e.g. the Zone B spire). Live GLB read-only; output = staging
objects1/<name>/<name>.glb (dir marked KC-OVERRIDE so kc_stage.py keeps it).

  python3 kc_glb.py grade --glb /workspace/zb-preview-1008/objects1/spire/spire.glb --stage DIR --image 1 \\
      --gain-from key-compare.json --element spire [--damp 0.8] [--only shadow|lit]

Lit / shadow halves are split on the texel's own luminance (smooth weight across the median, as palette.py); each half
gets a linear-RGB gain = (lin(key) / lin(game)) ** damp from the key-compare Lab means of that element (clamped
0.5-2.0), accumulated in kc-glb-state.json and always re-applied to the LIVE pixels (no re-encoding drift).
"""
import argparse, io, json, os, struct, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
LIVE = os.environ.get("I23D_LIVE_ROOT", "/workspace/zb-preview-1008")


def read_glb(b):
    assert b[:4] == b"glTF"; L = struct.unpack("<I", b[12:16])[0]; J = json.loads(b[20:20 + L])
    o = 20 + L; BL = struct.unpack("<I", b[o:o + 4])[0]; BIN = b[o + 8:o + 8 + BL]
    return J, BIN


def write_glb(J, BIN):
    js = json.dumps(J, separators=(",", ":")).encode(); js += b" " * ((4 - len(js) % 4) % 4)
    BIN += b"\0" * ((4 - len(BIN) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(BIN)
    return b"glTF" + struct.pack("<II", 2, total) + struct.pack("<I", len(js)) + b"JSON" + js + struct.pack("<I", len(BIN)) + b"BIN\0" + BIN


def replace_view(J, BIN, vi, data):
    """replace bufferView vi's bytes, shifting every later view (4-byte aligned)"""
    views = J["bufferViews"]; order = sorted(range(len(views)), key=lambda i: views[i].get("byteOffset", 0))
    out = b""; 
    for i in order:
        v = views[i]; chunk = data if i == vi else BIN[v.get("byteOffset", 0):v.get("byteOffset", 0) + v["byteLength"]]
        out += b"\0" * ((4 - len(out) % 4) % 4); v["byteOffset"] = len(out); v["byteLength"] = len(chunk); out += chunk
    J["buffers"][0]["byteLength"] = len(out)
    return out


def grade(a):
    from kc_mesa import _lin, _srgb, lab_to_lin, _guard
    name = os.path.splitext(os.path.basename(a.glb))[0]
    dst_dir = os.path.join(a.stage, "objects1", name); _guard(dst_dir)
    if os.path.islink(dst_dir): os.remove(dst_dir)
    os.makedirs(dst_dir, exist_ok=True); open(os.path.join(dst_dir, "KC-OVERRIDE"), "w").write(f"graded copy of {a.glb} (kc_glb.py)\n")
    src_dir = os.path.dirname(a.glb)
    for f in os.listdir(src_dir):   # everything else in the dir stays a symlink to live
        t = os.path.join(dst_dir, f)
        if f != os.path.basename(a.glb) and not os.path.lexists(t): os.symlink(os.path.join(src_dir, f), t)
    sp = os.path.join(dst_dir, "kc-glb-state.json")
    S = json.load(open(sp)) if os.path.exists(sp) else dict(gain={"lit": [1, 1, 1], "shadow": [1, 1, 1]}, log=[])
    if a.gain_from:
        e = next(x for x in json.load(open(a.gain_from))["elements"] if x["id"] == a.element)
        for half, kk, gg in (("lit", "labKeyLit", "labGameLit"), ("shadow", "labKeyShadow", "labGameShadow")):
            if a.only and half != a.only: continue
            g = (lab_to_lin(e[kk]) + 1e-4) / (lab_to_lin(e[gg]) + 1e-4)
            S["gain"][half] = [round(float(x * np.clip(gi ** a.damp, a.clip_lo, 2.0)), 4) for x, gi in zip(S["gain"][half], g)]
        S["log"].append(dict(src=os.path.abspath(a.gain_from), element=a.element, only=a.only, gain=json.loads(json.dumps(S["gain"]))))
    J, BIN = read_glb(open(a.glb, "rb").read())
    im = J["images"][a.image]; v = J["bufferViews"][im["bufferView"]]
    pix = np.asarray(Image.open(io.BytesIO(BIN[v.get("byteOffset", 0):v.get("byteOffset", 0) + v["byteLength"]])).convert("RGBA")).astype(np.float32) / 255
    rgb, alpha = pix[..., :3], pix[..., 3:]
    lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]; med = np.median(lum[alpha[..., 0] > 0.5]) if (alpha > 0.5).any() else np.median(lum)
    w = (1 / (1 + np.exp(-(lum - med) / 0.02)))[..., None]
    g = w * np.array(S["gain"]["lit"]) + (1 - w) * np.array(S["gain"]["shadow"])
    out = np.concatenate([_srgb(_lin(rgb) * g), alpha], -1)
    buf = io.BytesIO(); Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA").save(buf, "PNG", optimize=True)
    BIN2 = replace_view(J, BIN, im["bufferView"], buf.getvalue())
    J.setdefault("asset", {})["extras"] = dict(kcGrade=dict(image=a.image, gain=S["gain"], src=os.path.abspath(a.glb)))
    dst = os.path.join(dst_dir, os.path.basename(a.glb))
    if os.path.lexists(dst): os.remove(dst)
    open(dst, "wb").write(write_glb(J, BIN2)); json.dump(S, open(sp, "w"), indent=1)
    rep = dict(step="grade_match", glb=dst, image=a.image, gain=S["gain"], bytes=os.path.getsize(dst)); print(json.dumps(rep)); return rep


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("cmd", choices=["grade"]); ap.add_argument("--glb", required=True)
    ap.add_argument("--stage", default="/workspace/kc-staging/zb"); ap.add_argument("--image", type=int, required=True)
    ap.add_argument("--gain-from"); ap.add_argument("--element", default="spire"); ap.add_argument("--damp", type=float, default=0.8)
    ap.add_argument("--only", choices=["lit", "shadow"]); ap.add_argument("--clip-lo", type=float, default=0.5)
    grade(ap.parse_args())

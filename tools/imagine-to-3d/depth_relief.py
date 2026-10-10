"""Stage 'depth_relief': monocular depth (Depth Anything V2 Small, ONNX on CPU via onnxruntime; MiDaS v2.1 small fallback)
on each Imagine plate at native resolution -> per-plate RELIEF map in metres used ONLY to displace the shell in/out
(cracks, ledges, overhang depth, holes, panel lines). The volume is never rebuilt from depth (Grok q15).
  relief = high-pass(disparity) normalised per plate (robust p99) * amplitude(type), gradient-limited so the plate's
  texture stretch on the displaced surface stays <= 1.3, clamped to +-amplitude.
python3 depth_relief.py <type mesa|tower|rock> <pxPerM> <outdir> <plate.jpg> [...]  -> <outdir>/<name>-relief.npy (+ .png, report json)"""
import sys, os, json, urllib.request, numpy as np
from PIL import Image
from scipy import ndimage as ndi
MODELS = "/workspace/models/depth"
DA_URL = "https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model.onnx?download=true"
MIDAS_URL = "https://github.com/isl-org/MiDaS/releases/download/v2_1/model-small.onnx"
# band-pass (fineM..sigmaM): finer detail stays in the Imagine albedo, coarser shape stays the hull's
PROFILE = {"mesa": dict(amp=1.5, sigmaM=4.0, fineM=0.25, maxGrad=0.7), "tower": dict(amp=0.3, sigmaM=1.0, fineM=0.06, maxGrad=0.5), "rock": dict(amp=0.6, sigmaM=1.5, fineM=0.1, maxGrad=0.83)}

def session():
    import onnxruntime as ort
    os.makedirs(MODELS, exist_ok=True)
    for name, url, kind in (("dav2-small.onnx", DA_URL, "dav2"), ("midas-small.onnx", MIDAS_URL, "midas")):
        p = f"{MODELS}/{name}"
        try:
            if not os.path.exists(p): urllib.request.urlretrieve(url, p)
            return ort.InferenceSession(p, providers=["CPUExecutionProvider"]), kind
        except Exception as e:
            print("depth model failed:", name, e, file=sys.stderr)
    raise SystemExit("no depth model")

def disparity(sess, kind, img):
    a = np.asarray(img.convert("RGB"), np.float32) / 255.0; H, W = a.shape[:2]
    if kind == "dav2":
        h, w = (H // 14) * 14, (W // 14) * 14          # native resolution (multiple of the ViT patch)
    else:
        h, w = 256, 256
    x = np.asarray(img.convert("RGB").resize((w, h), Image.BICUBIC), np.float32) / 255.0 if (h, w) != (H, W) else a
    x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    x = x.transpose(2, 0, 1)[None].astype(np.float32)
    y = sess.run(None, {sess.get_inputs()[0].name: x})[0][0]
    if y.shape != (H, W): y = np.asarray(Image.fromarray(y.astype(np.float32)).resize((W, H), Image.BILINEAR))
    return y.astype(np.float32)        # relative inverse depth: larger = nearer = outward

def relief(disp, pxm, prof):
    sig = prof["sigmaM"] * pxm
    hp = ndi.gaussian_filter(disp, prof["fineM"] * pxm) - ndi.gaussian_filter(disp, sig)   # band-pass; plate tilt/perspective removed: shell = hull
    s = np.percentile(np.abs(hp), 99) + 1e-6
    r = np.clip(hp / s, -1, 1) * prof["amp"]
    # gradient limit (metres per metre) -> displaced-surface texture stretch <= sqrt(1 + g^2) <= 1.3
    for _ in range(150):
        gy, gx = np.gradient(r); g = np.hypot(gx, gy) * pxm
        if np.percentile(g, 99.9) <= prof["maxGrad"]: break
        r = r * 0.97
    gy, gx = np.gradient(r); g = np.hypot(gx, gy) * pxm
    r = r * min(1.0, prof["maxGrad"] / max(g.max(), 1e-6)) ** 0.5   # last spikes
    r = ndi.median_filter(r, 5)                               # isolated spikes (single-pixel depth outliers)
    return np.clip(r, -prof["amp"], prof["amp"]).astype(np.float32)

def check(r, pxm, prof):
    gy, gx = np.gradient(r); g = np.hypot(gx, gy) * pxm
    # spike = a point standing out of its 5x5 neighbourhood median by > 7 % of the amplitude (ledges/creases are not spikes)
    spikes = float((np.abs(r - ndi.median_filter(r, 5)) > 0.07 * prof["amp"]).mean())
    return dict(stdM=round(float(r.std()), 3), p99M=round(float(np.percentile(np.abs(r), 99)), 3), maxGrad=round(float(g.max()), 3),
                p999Grad=round(float(np.percentile(g, 99.9)), 3), spikeFrac=round(spikes, 5),
                ok=bool(r.std() > 0.08 * prof["amp"] and spikes < 0.001 and np.percentile(g, 99.9) <= prof["maxGrad"] * 1.05))

if __name__ == "__main__":
    typ, pxm, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]; plates = sys.argv[4:]
    prof = PROFILE[typ]; os.makedirs(out, exist_ok=True)
    sess, kind = session(); rep = {"model": kind, "type": typ, "profile": prof, "plates": {}}
    for p in plates:
        name = os.path.splitext(os.path.basename(p))[0]
        img = Image.open(p); d = disparity(sess, kind, img)
        r = relief(d, pxm, prof)
        np.save(f"{out}/{name}-relief.npy", r)
        v = ((r / prof["amp"]) * 0.5 + 0.5) * 255
        Image.fromarray(np.clip(v, 0, 255).astype(np.uint8)).save(f"{out}/{name}-relief.png")
        rep["plates"][name] = dict(size=list(img.size), **check(r, pxm, prof)); print(name, rep["plates"][name], flush=True)
    json.dump(rep, open(f"{out}/depth-report.json", "w"), indent=1)

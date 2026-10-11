#!/usr/bin/env python3
"""Shared CPU vision models. One process loads each net once. Depth and masks
are cached on disk by the image bytes hash, so the next caller does not run the net again.

Weights live outside the git repo (default /workspace/models/vision). The module checks
free disk before a download and refuses to fill the volume.

DEFAULT_DEPTH is MoGe-2 (MIT). Depth Anything V2 Large is an explicit internal
comparison (`depth_dav2` / `load_dav2_large`). Do not write that map into a shipped
or posted output. SAM2 small + base live here too.

  python3 tools/common/vision_models.py status
  python3 tools/common/vision_models.py ensure
"""
import hashlib
import json
import os
import shutil
import sys
import time
import urllib.request

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
WEIGHTS = os.environ.get("VISION_MODELS_DIR", "/workspace/models/vision")
SRC = os.path.join(WEIGHTS, "src")
CACHE = os.path.join(WEIGHTS, "cache")
# Leave this much free after a download. The four nets together are about 3 GB.
RESERVE_BYTES = 4 * 1024 ** 3
# Licence 2026-10-11 12:25: MoGe-2 is the default depth. Large is internal only.
DEFAULT_DEPTH = "moge-2"

# Sizes checked against the publishers (2026-10-11). A short file is not a model.
CATALOG = {
    "dav2-large": {
        "file": "depth_anything_v2_vitl.pth",
        "bytes": 1341395338,
        "url": "https://huggingface.co/depth-anything/Depth-Anything-V2-Large/resolve/main/depth_anything_v2_vitl.pth",
        "role": "depth",
    },
    "moge-2": {
        "file": "moge-2-vitl.pt",
        "bytes": 1305030700,
        "url": "https://huggingface.co/Ruicheng/moge-2-vitl/resolve/main/model.pt",
        "role": "depth",
    },
    "sam2-small": {
        "file": "sam2.1_hiera_small.pt",
        "bytes": 184416285,
        "url": "https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_small.pt",
        "role": "mask",
    },
    "sam2-base": {
        "file": "sam2.1_hiera_base_plus.pt",
        "bytes": 323606802,
        "url": "https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_base_plus.pt",
        "role": "mask",
    },
}

_LOADED = {}
_ORT = {}


def disk_free(path):
    probe = path if os.path.isdir(path) else os.path.dirname(path) or "/"
    os.makedirs(probe, exist_ok=True)
    return shutil.disk_usage(probe).free


def assert_space(need_bytes, path=WEIGHTS):
    free = disk_free(path)
    if free < int(need_bytes) + RESERVE_BYTES:
        raise RuntimeError(
            f"disk too low for vision weights: free {free} bytes, need {need_bytes} plus {RESERVE_BYTES} reserve"
        )
    return free


def weight_path(name):
    spec = CATALOG[name]
    return os.path.join(WEIGHTS, spec["file"])


def status():
    rows = []
    for name, spec in CATALOG.items():
        path = weight_path(name)
        size = os.path.getsize(path) if os.path.isfile(path) else 0
        rows.append({
            "name": name,
            "path": path,
            "bytes": size,
            "expected": spec["bytes"],
            "ready": size == spec["bytes"],
            "role": spec["role"],
        })
    return {"dir": WEIGHTS, "free": disk_free(WEIGHTS), "loaded": sorted(_LOADED), "models": rows}


def ensure(name, download=True):
    """Return the weight path. Download only when the file is missing or short, and only if disk allows."""
    spec = CATALOG[name]
    path = weight_path(name)
    os.makedirs(WEIGHTS, exist_ok=True)
    size = os.path.getsize(path) if os.path.isfile(path) else 0
    if size == spec["bytes"]:
        return path
    if not download:
        raise FileNotFoundError(f"{name} missing at {path} ({size} bytes, expected {spec['bytes']})")
    if size and size != spec["bytes"]:
        os.remove(path)
        size = 0
    assert_space(spec["bytes"] - size, WEIGHTS)
    tmp = path + ".partial"
    print(f"download {name} -> {path}", file=sys.stderr)
    urllib.request.urlretrieve(spec["url"], tmp)
    got = os.path.getsize(tmp)
    if got != spec["bytes"]:
        os.remove(tmp)
        raise RuntimeError(f"{name} downloaded {got} bytes, expected {spec['bytes']}")
    os.replace(tmp, path)
    return path


def image_hash(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _cache_file(kind, model, digest, extra):
    tag = hashlib.sha256(f"{kind}|{model}|{extra}".encode()).hexdigest()[:16]
    folder = os.path.join(CACHE, digest[:2], digest)
    os.makedirs(folder, exist_ok=True)
    return os.path.join(folder, f"{kind}-{model}-{tag}.npy")


def cached_array(kind, model, image_path, extra, compute):
    """Load-once cache. compute() runs only on a miss. Returns (array, hit, seconds)."""
    digest = image_hash(image_path)
    path = _cache_file(kind, model, digest, extra)
    t0 = time.perf_counter()
    if os.path.isfile(path):
        arr = np.load(path)
        return arr, True, time.perf_counter() - t0
    arr = np.asarray(compute())
    # np.save appends ".npy" unless the name already ends with it. Write a sibling, then replace.
    tmp = path + ".writing.npy"
    np.save(tmp, arr)
    os.replace(tmp, path)
    return arr, False, time.perf_counter() - t0


def _stub_imports():
    """MoGe and Depth Anything import optional stacks this box does not have. Stub them
    before the first import so CPU load still works. Real torch stays real."""
    import types
    if "cv2" not in sys.modules:
        cv2 = types.ModuleType("cv2")
        cv2.INTER_CUBIC = 2
        cv2.INTER_AREA = 3
        cv2.COLOR_BGR2RGB = 4
        sys.modules["cv2"] = cv2
    if "torchvision" not in sys.modules:
        try:
            import torchvision  # noqa: F401
        except Exception:
            tv = types.ModuleType("torchvision")
            tr = types.ModuleType("torchvision.transforms")

            class _Compose:
                def __init__(self, steps):
                    self.steps = steps

                def __call__(self, x):
                    for step in self.steps:
                        x = step(x)
                    return x

            class _Resize:
                def __init__(self, size, *a, **k):
                    self.size = size

                def __call__(self, x):
                    return x

            class _Normalize:
                def __init__(self, mean, std, inplace=False):
                    self.mean = mean
                    self.std = std

                def __call__(self, x):
                    return x

            class _ToTensor:
                def __call__(self, pic):
                    return pic

            tr.Compose = _Compose
            tr.Resize = _Resize
            tr.Normalize = _Normalize
            tr.ToTensor = _ToTensor
            tv.transforms = tr
            sys.modules["torchvision"] = tv
            sys.modules["torchvision.transforms"] = tr
            sys.modules["torchvision.transforms.functional"] = types.ModuleType("torchvision.transforms.functional")
    if "huggingface_hub" not in sys.modules:
        try:
            import huggingface_hub  # noqa: F401
        except Exception:
            hub = types.ModuleType("huggingface_hub")

            def hf_hub_download(*_a, **_k):
                raise RuntimeError("vision weights are local; hub download is off")

            hub.hf_hub_download = hf_hub_download
            sys.modules["huggingface_hub"] = hub
    if "utils3d" not in sys.modules:
        try:
            import utils3d  # noqa: F401
        except Exception:
            import torch
            u = types.ModuleType("utils3d")
            pt = types.ModuleType("utils3d.pt")
            npmod = types.ModuleType("utils3d.np")

            def intrinsics_from_focal_center(fx, fy, cx, cy):
                b = fx.shape[0]
                k = torch.zeros(b, 3, 3, device=fx.device, dtype=fx.dtype)
                k[:, 0, 0] = fx
                k[:, 1, 1] = fy
                k[:, 0, 2] = cx if cx.ndim else cx
                k[:, 1, 2] = cy if getattr(cy, "ndim", 0) else cy
                k[:, 2, 2] = 1
                return k

            def depth_map_to_point_map(depth, intrinsics=None):
                return depth.unsqueeze(-1).expand(*depth.shape, 3).clone()

            pt.intrinsics_from_focal_center = intrinsics_from_focal_center
            pt.depth_map_to_point_map = depth_map_to_point_map
            u.pt = pt
            u.np = npmod
            sys.modules["utils3d"] = u
            sys.modules["utils3d.pt"] = pt
            sys.modules["utils3d.np"] = npmod
    if "scipy" not in sys.modules or "scipy.optimize" not in sys.modules:
        try:
            import scipy.optimize  # noqa: F401
            import scipy.signal  # noqa: F401
        except Exception:
            for name in list(sys.modules):
                if name == "scipy" or name.startswith("scipy."):
                    del sys.modules[name]
            import site
            user = site.getusersitepackages()
            if user and user not in sys.path and os.path.isdir(user):
                sys.path.append(user)
        try:
            import scipy.optimize  # noqa: F401
            import scipy.signal  # noqa: F401
        except Exception:
            scipy = types.ModuleType("scipy")
            signal = types.ModuleType("scipy.signal")

            def fftconvolve(*_a, **_k):
                raise RuntimeError("scipy is not installed; the CPU depth path does not call fftconvolve")

            signal.fftconvolve = fftconvolve
            scipy.signal = signal
            sys.modules["scipy"] = scipy
            sys.modules["scipy.signal"] = signal


def _torch():
    import torch
    torch.set_grad_enabled(False)
    return torch


def load_dav2_large():
    if "dav2-large" in _LOADED:
        return _LOADED["dav2-large"]
    _stub_imports()
    torch = _torch()
    if SRC not in sys.path:
        sys.path.insert(0, SRC)
    from depth_anything_v2.dpt import DepthAnythingV2
    model = DepthAnythingV2(encoder="vitl", features=256, out_channels=[256, 512, 1024, 1024])
    state = torch.load(ensure("dav2-large"), map_location="cpu", weights_only=True)
    model.load_state_dict(state)
    model.eval()
    _LOADED["dav2-large"] = model
    return model


def _prep_dav2(rgb_u8, size=518):
    """Numpy stand-in for DepthAnythingV2.image2tensor (that path needs cv2 + torchvision)."""
    import torch
    h, w = rgb_u8.shape[:2]
    scale = size / min(h, w)
    nh, nw = int(round(h * scale)), int(round(w * scale))
    nh, nw = max(14, (nh // 14) * 14), max(14, (nw // 14) * 14)
    im = np.asarray(
        __import__("PIL").Image.fromarray(rgb_u8).resize((nw, nh), __import__("PIL").Image.BICUBIC),
        np.float32,
    ) / 255.0
    mean = np.array([0.485, 0.456, 0.406], np.float32)
    std = np.array([0.229, 0.224, 0.225], np.float32)
    x = (im - mean) / std
    t = torch.from_numpy(x.transpose(2, 0, 1)[None].copy())
    return t, (h, w)


def depth_dav2_rgb(rgb_u8, size=518):
    """Relative depth for an RGB uint8 array. Larger is nearer. Cached by the pixel bytes."""
    digest = hashlib.sha256(np.ascontiguousarray(rgb_u8).tobytes()).hexdigest()
    folder = os.path.join(CACHE, digest[:2], digest)
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, f"depth-dav2-large-rgb-s{size}.npy")
    if os.path.isfile(path):
        return np.load(path)
    import torch
    model = load_dav2_large()
    tensor, (h, w) = _prep_dav2(np.asarray(rgb_u8), size)
    with torch.inference_mode():
        pred = model(tensor)
    pred = torch.nn.functional.interpolate(pred[:, None], (h, w), mode="bilinear", align_corners=True)[0, 0]
    arr = pred.cpu().numpy().astype(np.float32)
    tmp = path + ".writing.npy"
    np.save(tmp, arr)
    os.replace(tmp, path)
    return arr


def depth_dav2(image_path, size=518):
    def compute():
        import torch
        from PIL import Image
        model = load_dav2_large()
        rgb = np.asarray(Image.open(image_path).convert("RGB"))
        tensor, (h, w) = _prep_dav2(rgb, size)
        with torch.inference_mode():
            pred = model(tensor)
        pred = torch.nn.functional.interpolate(pred[:, None], (h, w), mode="bilinear", align_corners=True)[0, 0]
        return pred.cpu().numpy().astype(np.float32)

    return cached_array("depth", "dav2-large", image_path, f"s{size}", compute)


def load_moge2():
    if "moge-2" in _LOADED:
        return _LOADED["moge-2"]
    _stub_imports()
    _torch()
    if SRC not in sys.path:
        sys.path.insert(0, SRC)
    from moge.model.v2 import MoGeModel
    model = MoGeModel.from_pretrained(ensure("moge-2"))
    model.eval()
    _LOADED["moge-2"] = model
    return model


def depth_moge(image_path, side=256, fov_x=None, resolution_level=0, full=False):
    """MoGe-2 metric camera-Z in metres. full=True resamples to the source pixel size."""
    def compute():
        import torch
        from PIL import Image
        model = load_moge2()
        im = Image.open(image_path).convert("RGB")
        w0, h0 = im.size
        im.thumbnail((side, side))
        rgb = np.asarray(im, np.float32) / 255.0
        tensor = torch.from_numpy(rgb.transpose(2, 0, 1).copy())
        with torch.inference_mode():
            out = model.infer(
                tensor,
                resolution_level=resolution_level,
                use_fp16=False,
                force_projection=False,
                apply_mask=False,
                fov_x=fov_x,
            )
        depth = out["depth"]
        if depth.ndim == 3:
            depth = depth[0]
        arr = depth.detach().cpu().numpy().astype(np.float32)
        if full and arr.shape != (h0, w0):
            arr = np.asarray(
                Image.fromarray(arr).resize((w0, h0), Image.Resampling.BILINEAR),
                np.float32,
            )
        return arr

    tag = f"side{side}-lv{resolution_level}-fov{fov_x}-full{int(full)}"
    return cached_array("depth", "moge-2", image_path, tag, compute)


def load_default_depth():
    """The depth model relief, fuse, and terrain may ship. MoGe-2 only."""
    if DEFAULT_DEPTH != "moge-2":
        raise RuntimeError(f"default depth must stay moge-2, got {DEFAULT_DEPTH}")
    return load_moge2(), DEFAULT_DEPTH


def depth_default(image_path, side=256):
    """Cached MoGe-2 depth. Larger values are farther (metres)."""
    if DEFAULT_DEPTH != "moge-2":
        raise RuntimeError(f"default depth must stay moge-2, got {DEFAULT_DEPTH}")
    return depth_moge(image_path, side)


def _patch_sam2_transforms():
    """torchvision on this box does not load (nms op missing). Give SAM2 a real resize + normalize."""
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    import sam2.utils.transforms as tr

    class Resize(nn.Module):
        def __init__(self, size, *a, **k):
            super().__init__()
            pair = (size, size) if isinstance(size, int) else tuple(size)
            self.h = int(pair[0])
            self.w = int(pair[1])

        def forward(self, x):
            return F.interpolate(x.unsqueeze(0), size=(self.h, self.w), mode="bilinear", align_corners=False)[0]

    class Normalize(nn.Module):
        def __init__(self, mean, std, inplace=False):
            super().__init__()
            self.register_buffer("mean", torch.tensor(list(mean), dtype=torch.float32).view(-1, 1, 1))
            self.register_buffer("std", torch.tensor(list(std), dtype=torch.float32).view(-1, 1, 1))

        def forward(self, x):
            return (x - self.mean) / self.std

    class ToTensor:
        def __call__(self, pic):
            arr = np.asarray(pic.convert("RGB") if hasattr(pic, "convert") else pic)
            return torch.from_numpy(np.ascontiguousarray(arr.transpose(2, 0, 1))).float().div(255.0)

    def __init__(self, resolution, mask_threshold, max_hole_area=0.0, max_sprinkle_area=0.0):
        nn.Module.__init__(self)
        self.resolution = resolution
        self.mask_threshold = mask_threshold
        self.max_hole_area = max_hole_area
        self.max_sprinkle_area = max_sprinkle_area
        self.mean = [0.485, 0.456, 0.406]
        self.std = [0.229, 0.224, 0.225]
        self.to_tensor = ToTensor()
        self.transforms = nn.Sequential(Resize((resolution, resolution)), Normalize(self.mean, self.std))

    tr.SAM2Transforms.__init__ = __init__


def load_sam2(which):
    key = f"sam2-{which}"
    if key in _LOADED:
        return _LOADED[key]
    _stub_imports()
    from sam2.build_sam import build_sam2
    from sam2.sam2_image_predictor import SAM2ImagePredictor
    _patch_sam2_transforms()
    cfg = {
        "small": "configs/sam2.1/sam2.1_hiera_s.yaml",
        "base": "configs/sam2.1/sam2.1_hiera_b+.yaml",
    }[which]
    model = build_sam2(cfg, ensure(key), device="cpu")
    pred = SAM2ImagePredictor(model)
    _LOADED[key] = pred
    return pred


def mask_sam2(image_path, which="small", box=None):
    """One mask. Default prompt is a box inset 10 % from the frame (the subject, not the border)."""
    extra = f"{which}:{box}"

    def compute():
        from PIL import Image
        pred = load_sam2(which)
        rgb = np.asarray(Image.open(image_path).convert("RGB"))
        h, w = rgb.shape[:2]
        use = box if box is not None else [w * 0.1, h * 0.1, w * 0.9, h * 0.9]
        pred.set_image(rgb)
        masks, _scores, _ = pred.predict(box=np.asarray(use, np.float32), multimask_output=False)
        return masks[0].astype(np.uint8)

    return cached_array("mask", f"sam2-{which}", image_path, extra, compute)


def load_depth_session(kind="dav2-small"):
    """Shared ONNX session for the small relief net. Same object for every caller in the process."""
    if kind in _ORT:
        return _ORT[kind]
    import onnxruntime as ort
    path = os.environ.get("I23D_DAV2", "/workspace/models/depth/dav2-small.onnx")
    if not os.path.isfile(path):
        raise FileNotFoundError(path)
    sess = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
    _ORT[kind] = (sess, "dav2" if "dav2" in kind else kind)
    return _ORT[kind]


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    if cmd == "status":
        print(json.dumps(status()))
        return
    if cmd == "ensure":
        names = sys.argv[2:] or list(CATALOG)
        for name in names:
            ensure(name)
        print(json.dumps(status()))
        return
    if cmd == "demo":
        # Cache demo on one small image. SAM2 small is the fast proof; depth runs when asked.
        image = sys.argv[2]
        which = sys.argv[3] if len(sys.argv) > 3 else "sam2-small"
        if which == "sam2-small":
            a, hit1, t1 = mask_sam2(image, "small")
            b, hit2, t2 = mask_sam2(image, "small")
        elif which == "sam2-base":
            a, hit1, t1 = mask_sam2(image, "base")
            b, hit2, t2 = mask_sam2(image, "base")
        elif which == "dav2-large":
            a, hit1, t1 = depth_dav2(image, 280)
            b, hit2, t2 = depth_dav2(image, 280)
        elif which == "moge-2":
            a, hit1, t1 = depth_moge(image, 192)
            b, hit2, t2 = depth_moge(image, 192)
        else:
            raise SystemExit(f"unknown demo {which}")
        same = bool(np.array_equal(a, b))
        print(json.dumps({
            "model": which, "shape": list(a.shape), "hit1": hit1, "hit2": hit2,
            "seconds1": round(t1, 4), "seconds2": round(t2, 4), "same": same,
            "loaded": sorted(_LOADED),
        }))
        return
    raise SystemExit(f"unknown command {cmd}")


if __name__ == "__main__":
    main()

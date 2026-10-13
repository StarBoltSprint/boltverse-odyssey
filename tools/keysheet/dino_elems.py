#!/usr/bin/env python3
"""Per-element zoomed DINOv2 ViT-S/14 patch cosine (Apache-2.0), CPU, one model load for all elements.
usage (torch venv): dino_elems.py RENDER KEY MASK1.png [MASK2.png ...] -> JSON {mask: {patch_cos, cls_cos}}"""
import json, sys
import numpy as np, torch
from PIL import Image
a, b, masks = sys.argv[1], sys.argv[2], sys.argv[3:]
torch.set_grad_enabled(False)
m = torch.hub.load("facebookresearch/dinov2", "dinov2_vits14", verbose=False).eval()
mean, std = np.array([0.485, 0.456, 0.406]), np.array([0.229, 0.224, 0.225])
S = 224
A = Image.open(a).convert("RGB"); B = Image.open(b).convert("RGB")
out = {}
for mk in masks:
    M = np.asarray(Image.open(mk).convert("L")) > 127
    if not M.any():
        out[mk] = {"patch_cos": 0.0, "cls_cos": 0.0}; continue
    ys, xs = np.nonzero(M); pad = 8
    box = (max(xs.min() - pad, 0), max(ys.min() - pad, 0), min(xs.max() + pad, M.shape[1]), min(ys.max() + pad, M.shape[0]))
    def feats(im):
        im = im.resize(M.shape[::-1]).crop(box).resize((S, S), Image.BICUBIC)
        x = torch.tensor(((np.asarray(im) / 255.0 - mean) / std).transpose(2, 0, 1)[None], dtype=torch.float32)
        o = m.forward_features(x); return o["x_norm_clstoken"][0], o["x_norm_patchtokens"][0]
    ca, pa = feats(A); cb, pb = feats(B)
    mm = np.asarray(Image.fromarray(M[box[1]:box[3], box[0]:box[2]].astype(np.uint8) * 255).resize((S // 14, S // 14))) > 127
    sel = torch.tensor(mm.ravel())
    pc = torch.nn.functional.cosine_similarity(pa[sel], pb[sel], dim=1).mean().item() if sel.any() else 0.0
    out[mk] = {"patch_cos": round(pc, 4), "cls_cos": round(torch.nn.functional.cosine_similarity(ca, cb, dim=0).item(), 4)}
print(json.dumps(out))

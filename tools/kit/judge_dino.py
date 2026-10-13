#!/usr/bin/env python3
"""DINOv2 ViT-S/14 (Apache-2.0, facebookresearch/dinov2) perceptual similarity, CPU.
usage: judge_dino.py A.png B.png MASK.png  -> prints JSON {cls_cos, patch_cos}. Run in a venv with torch."""
import json, sys
import numpy as np, torch
from PIL import Image
a, b, mk = sys.argv[1:4]
torch.set_grad_enabled(False)
m = torch.hub.load("facebookresearch/dinov2", "dinov2_vits14", verbose=False).eval()
mean, std = np.array([0.485, 0.456, 0.406]), np.array([0.229, 0.224, 0.225])
M = np.asarray(Image.open(mk).convert("L")) > 127
ys, xs = np.nonzero(M); pad = 16
box = (max(xs.min() - pad, 0), max(ys.min() - pad, 0), min(xs.max() + pad, M.shape[1]), min(ys.max() + pad, M.shape[0]))
S = 448
def feats(p):
    im = Image.open(p).convert("RGB").resize(M.shape[::-1]).crop(box).resize((S, S), Image.BICUBIC)
    x = torch.tensor(((np.asarray(im) / 255.0 - mean) / std).transpose(2, 0, 1)[None], dtype=torch.float32)
    o = m.forward_features(x)
    return o["x_norm_clstoken"][0], o["x_norm_patchtokens"][0]
ca, pa = feats(a); cb, pb = feats(b)
mm = np.asarray(Image.fromarray(M[box[1]:box[3], box[0]:box[2]].astype(np.uint8) * 255).resize((S // 14, S // 14))) > 127
sel = torch.tensor(mm.ravel())
pc = torch.nn.functional.cosine_similarity(pa[sel], pb[sel], dim=1).mean().item() if sel.any() else 0.0
print(json.dumps({"cls_cos": round(torch.nn.functional.cosine_similarity(ca, cb, dim=0).item(), 4), "patch_cos": round(pc, 4)}))

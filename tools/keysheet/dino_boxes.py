#!/usr/bin/env python3
"""DINOv2 ViT-S/14 patch cosine per box, one model load (torch venv).
usage: dino_boxes.py RENDER KEY BOXES.json -> JSON [{"patch_cos","cls_cos"}...]; BOXES = [[x0,y0,x1,y1,maskpng|null],...] in 1024 frame"""
import json, sys
import numpy as np, torch
from PIL import Image
torch.set_grad_enabled(False)
m = torch.hub.load("facebookresearch/dinov2", "dinov2_vits14", verbose=False).eval()
mean, std = np.array([0.485, 0.456, 0.406]), np.array([0.229, 0.224, 0.225]); S = 224
A = Image.open(sys.argv[1]).convert("RGB").resize((1024, 1024)); B = Image.open(sys.argv[2]).convert("RGB").resize((1024, 1024))
out = []
for x0, y0, x1, y1, mk in json.load(open(sys.argv[3])):
    def f(im):
        x = torch.tensor(((np.asarray(im.crop((x0, y0, x1, y1)).resize((S, S), Image.BICUBIC)) / 255.0 - mean) / std).transpose(2, 0, 1)[None], dtype=torch.float32)
        o = m.forward_features(x); return o["x_norm_clstoken"][0], o["x_norm_patchtokens"][0]
    ca, pa = f(A); cb, pb = f(B)
    sel = torch.ones(pa.shape[0], dtype=torch.bool)
    if mk:
        M = Image.open(mk).convert("L").crop((x0, y0, x1, y1)).resize((S // 14, S // 14))
        sel = torch.tensor(np.asarray(M).ravel() > 127)
    pc = torch.nn.functional.cosine_similarity(pa[sel], pb[sel], dim=1).mean().item() if sel.any() else 0.0
    out.append({"patch_cos": round(pc, 4), "cls_cos": round(torch.nn.functional.cosine_similarity(ca, cb, dim=0).item(), 4)})
print(json.dumps(out))

#!/usr/bin/env python3
"""Venv half of the auto keysheet (SAM2 AMG + MoGe-2 only; venv has torch, no cv2).
usage: /workspace/.venv-sam2/bin/python tools/keysheet/auto_sam.py KEY1024.png OUT.npz [--pps 32]"""
import argparse, sys
from pathlib import Path
import numpy as np
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools")); sys.path.insert(0, str(ROOT / "tools/placement-from-key"))
ap = argparse.ArgumentParser(); ap.add_argument("img"); ap.add_argument("out"); ap.add_argument("--pps", type=int, default=32)
a = ap.parse_args()
import sam2_boxes
sam2_boxes._install_torchvision_stub()
from common.vision_models import load_sam2, depth_moge
from sam2.automatic_mask_generator import SAM2AutomaticMaskGenerator
rgb = np.asarray(Image.open(a.img).convert("RGB"))
gen = SAM2AutomaticMaskGenerator(load_sam2("small").model, points_per_side=a.pps, points_per_batch=64,
                                 pred_iou_thresh=0.72, stability_score_thresh=0.86, min_mask_region_area=40)
ms = gen.generate(rgb)
M = np.stack([m["segmentation"] for m in ms]).astype(bool) if ms else np.zeros((0,) + rgb.shape[:2], bool)
Z = depth_moge(a.img, side=512, full=True)[0]
np.savez_compressed(a.out, masks=np.packbits(M, axis=-1), shape=np.array(M.shape), iou=np.array([m["predicted_iou"] for m in ms]), depth=Z.astype(np.float16))
print("masks", len(ms))

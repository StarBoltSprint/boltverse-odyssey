"""SAM2 box prompts. Run with the SAM2 venv: /workspace/.venv-sam2/bin/python.

torchvision in that venv does not register nms. The stub is only what SAM2 imports.
"""

from __future__ import annotations

import json
import os
import sys
import types

import numpy as np


def _install_torchvision_stub():
    import torch
    import torch.nn as nn
    import torch.nn.functional as F

    if "torchvision.ops.boxes" in sys.modules and "torchvision.transforms" in sys.modules:
        return

    def box_area(boxes):
        return (boxes[:, 2] - boxes[:, 0]).clamp(min=0) * (boxes[:, 3] - boxes[:, 1]).clamp(min=0)

    def batched_nms(boxes, scores, idxs, iou_threshold):
        if boxes.numel() == 0:
            return torch.empty((0,), dtype=torch.long, device=boxes.device)
        keep = []
        for cls in idxs.unique():
            m = idxs == cls
            orig = torch.where(m)[0]
            b = boxes[m]
            s = scores[m]
            order = torch.argsort(s, descending=True)
            b = b[order]
            orig = orig[order]
            suppressed = torch.zeros(b.shape[0], dtype=torch.bool, device=b.device)
            for i in range(b.shape[0]):
                if bool(suppressed[i]):
                    continue
                keep.append(orig[i])
                if i + 1 >= b.shape[0]:
                    break
                xx1 = torch.maximum(b[i, 0], b[i + 1 :, 0])
                yy1 = torch.maximum(b[i, 1], b[i + 1 :, 1])
                xx2 = torch.minimum(b[i, 2], b[i + 1 :, 2])
                yy2 = torch.minimum(b[i, 3], b[i + 1 :, 3])
                wh = (xx2 - xx1).clamp(min=0) * (yy2 - yy1).clamp(min=0)
                area_i = (b[i, 2] - b[i, 0]).clamp(min=0) * (b[i, 3] - b[i, 1]).clamp(min=0)
                area_j = (b[i + 1 :, 2] - b[i + 1 :, 0]).clamp(min=0) * (b[i + 1 :, 3] - b[i + 1 :, 1]).clamp(min=0)
                overlap = wh / (area_i + area_j - wh + 1e-6)
                suppressed[i + 1 :] = suppressed[i + 1 :] | (overlap > iou_threshold)
        if not keep:
            return torch.empty((0,), dtype=torch.long, device=boxes.device)
        return torch.stack(keep)

    class ToTensor:
        def __call__(self, pic):
            arr = np.asarray(pic)
            if arr.ndim == 2:
                arr = np.stack([arr, arr, arr], -1)
            t = torch.from_numpy(np.ascontiguousarray(arr))
            return t.permute(2, 0, 1).contiguous().float().div(255.0)

    class Resize(nn.Module):
        def __init__(self, size):
            super().__init__()
            self.h = int(size[0])
            self.w = int(size[1])

        def forward(self, x):
            return F.interpolate(x.unsqueeze(0), size=(self.h, self.w), mode="bilinear", align_corners=False).squeeze(0)

    class Normalize(nn.Module):
        def __init__(self, mean, std):
            super().__init__()

        def forward(self, x):
            mean = torch.tensor([0.485, 0.456, 0.406], device=x.device, dtype=x.dtype).view(-1, 1, 1)
            std = torch.tensor([0.229, 0.224, 0.225], device=x.device, dtype=x.dtype).view(-1, 1, 1)
            return (x - mean) / std

    boxes = types.ModuleType("torchvision.ops.boxes")
    boxes.box_area = box_area
    boxes.batched_nms = batched_nms
    ops = types.ModuleType("torchvision.ops")
    ops.boxes = boxes
    transforms = types.ModuleType("torchvision.transforms")
    transforms.Normalize = Normalize
    transforms.Resize = Resize
    transforms.ToTensor = ToTensor
    tv = types.ModuleType("torchvision")
    tv.__version__ = "stub"
    tv.ops = ops
    tv.transforms = transforms
    sys.modules["torchvision"] = tv
    sys.modules["torchvision.ops"] = ops
    sys.modules["torchvision.ops.boxes"] = boxes
    sys.modules["torchvision.transforms"] = transforms


def main():
    rgb_path, boxes_path, out_npy, out_json = sys.argv[1:5]
    _install_torchvision_stub()
    from PIL import Image

    rgb = np.asarray(Image.open(rgb_path).convert("RGB"))
    spec = json.load(open(boxes_path))
    boxes = spec["instances"] if isinstance(spec, dict) else spec
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    tools = os.path.join(root, "tools")
    if tools not in sys.path:
        sys.path.insert(0, tools)
    from common.vision_models import load_sam2
    predictor = load_sam2("small")
    predictor.set_image(rgb)
    h, w = rgb.shape[:2]
    labels = np.zeros((h, w), np.int32)
    report = []
    order = sorted(boxes, key=lambda b: -((b["box"][2] - b["box"][0]) * (b["box"][3] - b["box"][1])))
    for i, b in enumerate(order, start=1):
        x0 = int(np.floor(b["box"][0] * w))
        y0 = int(np.floor(b["box"][1] * h))
        x1 = int(np.ceil(b["box"][2] * w))
        y1 = int(np.ceil(b["box"][3] * h))
        x0, y0 = max(0, x0), max(0, y0)
        x1, y1 = min(w - 1, x1), min(h - 1, y1)
        pred, scores, _ = predictor.predict(box=np.array([x0, y0, x1, y1], np.float32), multimask_output=True)
        window = np.zeros((h, w), bool)
        window[y0:y1, x0:x1] = True
        best_i, best_s = 0, -1.0
        for k in range(pred.shape[0]):
            m = pred[k].astype(bool) & window
            # Prefer the mask that fills the box without spilling, scored by SAM and coverage.
            score = float(scores[k]) + 0.15 * (m.sum() / max(1, window.sum()))
            if score > best_s:
                best_s, best_i = score, k
        mask = pred[best_i].astype(bool) & window
        if mask.sum() < 30:
            mask = window
            best_s = 0.0
        labels[mask] = i
        ys, xs = np.nonzero(mask)
        report.append({
            "id": b["id"],
            "kind": b.get("kind"),
            "lift": b.get("lift", True),
            "label": i,
            "box": [x0, y0, x1, y1],
            "boxFrac": b["box"],
            "score": round(best_s, 4),
            "pixels": int(mask.sum()),
            "maskBox": [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1],
        })
    np.save(out_npy, labels)
    json.dump({"width": w, "height": h, "instances": report, "model": "sam2.1_hiera_small"}, open(out_json, "w"), indent=1)
    print(json.dumps({"ok": True, "n": len(report), "out": out_json}))


if __name__ == "__main__":
    main()

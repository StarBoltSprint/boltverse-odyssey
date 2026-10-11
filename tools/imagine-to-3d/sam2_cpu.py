"""SAM2 automatic masks on CPU.

torchvision in this venv does not register torchvision::nms (torch 2.14).
The stub is only the two functions SAM2 imports, plus Resize / Normalize /
ToTensor so the predictor can script its preprocess. Labels are uint16.
"""
import sys, types, json
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F


def _install_torchvision_stub():
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
                xx1 = torch.maximum(b[i, 0], b[i + 1:, 0])
                yy1 = torch.maximum(b[i, 1], b[i + 1:, 1])
                xx2 = torch.minimum(b[i, 2], b[i + 1:, 2])
                yy2 = torch.minimum(b[i, 3], b[i + 1:, 3])
                wh = (xx2 - xx1).clamp(min=0) * (yy2 - yy1).clamp(min=0)
                area_i = (b[i, 2] - b[i, 0]).clamp(min=0) * (b[i, 3] - b[i, 1]).clamp(min=0)
                area_j = (b[i + 1:, 2] - b[i + 1:, 0]).clamp(min=0) * (b[i + 1:, 3] - b[i + 1:, 1]).clamp(min=0)
                iou = wh / (area_i + area_j - wh + 1e-6)
                suppressed[i + 1:] = suppressed[i + 1:] | (iou > iou_threshold)
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
    rgb_path, mask_path, out_npy = sys.argv[1:4]
    _install_torchvision_stub()
    from PIL import Image
    import sam2
    from sam2.build_sam import build_sam2
    from sam2.automatic_mask_generator import SAM2AutomaticMaskGenerator

    rgb = np.asarray(Image.open(rgb_path).convert("RGB"))
    mask = np.asarray(Image.open(mask_path).convert("L")) > 0
    ckpt = "/workspace/.venv-sam2/sam2_hiera_tiny.pt"
    model = build_sam2("configs/sam2/sam2_hiera_t.yaml", ckpt, device="cpu")
    gen = SAM2AutomaticMaskGenerator(
        model,
        points_per_side=8,
        points_per_batch=8,
        pred_iou_thresh=0.72,
        stability_score_thresh=0.85,
        crop_n_layers=0,
        min_mask_region_area=64,
    )
    masks = gen.generate(rgb)
    labels = np.zeros(mask.shape, np.int32)
    facade = int(mask.sum()) or 1
    kept = []
    for m in sorted(masks, key=lambda d: -int(d["area"])):
        seg = m["segmentation"]
        if seg.shape != mask.shape:
            continue
        inside = int((seg & mask).sum())
        if inside < 64 or inside / facade > 0.72:
            continue
        kept.append(seg & mask)
    # Large first, then small, so a window keeps its own id.
    nid = 1
    for seg in kept:
        labels[seg] = nid
        nid += 1
    labels[~mask] = 0
    np.save(out_npy, labels.astype(np.int32))
    print(json.dumps({
        "ok": True,
        "raw": len(masks),
        "kept": int(labels.max()) if labels.size else 0,
        "sam2": getattr(sam2, "__file__", ""),
    }))


if __name__ == "__main__":
    main()

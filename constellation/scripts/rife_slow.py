#!/usr/bin/env python3
"""RIFE 4.26 slow-mo: keep fps, multiply frame count (Law 0 spin → smooth axis)."""
import argparse
import os
import sys
import time

import cv2
import numpy as np
import torch
import torch.nn.functional as F

RIFE_ROOT = os.environ.get("RIFE_ROOT", "/tmp/Practical-RIFE")
sys.path.insert(0, RIFE_ROOT)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
torch.set_grad_enabled(False)
torch.set_num_threads(int(os.environ.get("OMP_NUM_THREADS", "2")))


def load_model(model_dir):
    from train_log.RIFE_HDv3 import Model

    model = Model()
    if not hasattr(model, "version"):
        model.version = 0
    model.load_model(model_dir, -1)
    model.eval()
    model.device()
    return model


def to_tensor(bgr, pad_h, pad_w):
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    t = torch.from_numpy(np.transpose(rgb, (2, 0, 1))).to(device).unsqueeze(0).float() / 255.0
    return F.pad(t, (0, pad_w, 0, pad_h))


def to_bgr(t, h, w):
    rgb = (t[0] * 255.0).byte().cpu().numpy().transpose(1, 2, 0)[:h, :w]
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def interpolate_video(src, dest, multi=4, fps_out=24, model_dir=None):
    model_dir = model_dir or os.path.join(RIFE_ROOT, "train_log")
    model = load_model(model_dir)
    cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        raise SystemExit("cannot open " + src)
    ok, first = cap.read()
    if not ok:
        raise SystemExit("empty video " + src)
    h, w = first.shape[:2]
    tmp = 128
    ph = ((h - 1) // tmp + 1) * tmp
    pw = ((w - 1) // tmp + 1) * tmp
    pad_h, pad_w = ph - h, pw - w

    os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(dest, fourcc, fps_out, (w, h))
    if not writer.isOpened():
        raise SystemExit("cannot write " + dest)

    I1 = to_tensor(first, pad_h, pad_w)
    writer.write(first)
    n_src = 1
    n_out = 1
    t0 = time.time()
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        I0 = I1
        I1 = to_tensor(frame, pad_h, pad_w)
        for i in range(multi - 1):
            t = (i + 1) / multi
            mid = model.inference(I0, I1, t, scale=1.0)
            writer.write(to_bgr(mid, h, w))
            n_out += 1
        writer.write(frame)
        n_src += 1
        n_out += 1
        if n_src % 10 == 0:
            dt = time.time() - t0
            print(f"rife {n_src} src frames → {n_out} out  {dt:.1f}s", flush=True)
    cap.release()
    writer.release()
    print(f"rife done {n_src}→{n_out} in {time.time() - t0:.1f}s  {dest}", flush=True)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--video", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--multi", type=int, default=4)
    p.add_argument("--fps", type=int, default=24)
    p.add_argument("--model", default=os.path.join(RIFE_ROOT, "train_log"))
    args = p.parse_args()
    interpolate_video(args.video, args.output, args.multi, args.fps, args.model)

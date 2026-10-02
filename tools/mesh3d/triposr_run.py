#!/usr/bin/env python3
"""One CPU TripoSR attempt. Writes a colourless mesh or a failure note.

Vertex colours from the network are not read. torchmcubes is not required:
the density grid is meshed with the same surface nets as the visual hull.
"""

from __future__ import annotations

import json
import sys
import types
from pathlib import Path

import numpy as np


def _stub(name: str) -> None:
    if name not in sys.modules:
        sys.modules[name] = types.ModuleType(name)


def main() -> int:
    if len(sys.argv) != 4:
        print("usage: triposr_run.py <image> <out.npz> <resolution>", file=sys.stderr)
        return 2
    image_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])
    resolution = int(sys.argv[3])
    note = {"ok": False, "engine": "triposr", "image": str(image_path), "resolution": resolution}
    try:
        _stub("rembg")
        _stub("trimesh")
        _stub("imageio")
        _stub("torchmcubes")
        sys.modules["torchmcubes"].marching_cubes = lambda *a, **k: (_ for _ in ()).throw(
            RuntimeError("torchmcubes is not used")
        )
        import torch
        from omegaconf import OmegaConf
        from PIL import Image

        here = Path(__file__).resolve().parent
        sys.path.insert(0, str(here))
        from engines import TRIPOSR_CFG, TRIPOSR_CKPT, TRIPOSR_REPO, _surface

        repo = str(TRIPOSR_REPO)
        if repo not in sys.path:
            sys.path.insert(0, repo)
        from tsr.system import TSR
        from tsr.utils import scale_tensor

        torch.set_num_threads(2)
        cfg = OmegaConf.load(str(TRIPOSR_CFG))
        OmegaConf.resolve(cfg)
        model = TSR(cfg)
        ckpt = torch.load(str(TRIPOSR_CKPT), map_location="cpu", weights_only=False)
        model.load_state_dict(ckpt)
        model.renderer.set_chunk_size(4096)
        model.to("cpu")
        model.eval()

        rgba = np.asarray(Image.open(image_path).convert("RGBA")).astype(np.float32) / 255.0
        alpha = rgba[:, :, 3:4]
        # Official TripoSR prep. Grey is the network's backdrop, never a displayed texel.
        rgb = rgba[:, :, :3] * alpha + (1.0 - alpha) * 0.5
        image = Image.fromarray(np.clip(np.rint(rgb * 255.0), 0, 255).astype(np.uint8))

        with torch.no_grad():
            scene = model([image], device="cpu")
        if hasattr(scene, "ndim") and int(scene.ndim) == 5:
            code = scene[0]
        elif isinstance(scene, (list, tuple)):
            code = scene[0]
        else:
            code = scene
        radius = float(model.renderer.cfg.radius)
        res = int(resolution)
        axis = torch.linspace(0.0, 1.0, res)
        x, y, z = torch.meshgrid(axis, axis, axis, indexing="ij")
        grid = torch.stack([x, y, z], dim=-1).reshape(-1, 3)
        query = scale_tensor(grid, (0.0, 1.0), (-radius, radius))
        with torch.no_grad():
            density = model.renderer.query_triplane(model.decoder, query.to("cpu"), code)["density_act"]
        volume = density.reshape(res, res, res).detach().cpu().numpy().astype(np.float32)
        # TripoSR's published iso is 25. Inside is the high-density side.
        surf = _surface()
        step = 1.0 / float(res - 1)
        verts, faces = surf.surface_nets(volume, 25.0, np.zeros(3), np.array([step, step, step]))
        if len(faces) == 0:
            raise RuntimeError(f"empty iso at 25 (density {float(volume.min()):.2f}..{float(volume.max()):.2f})")
        world = verts.astype(np.float64) * (2.0 * radius) - radius
        faces = surf.orient_outward(world.astype(np.float32), faces)
        normals = surf.vertex_normals(world.astype(np.float32), faces)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        np.savez(
            out_path,
            vertices=world.astype(np.float32),
            faces=np.asarray(faces, np.int32),
            normals=np.asarray(normals, np.float32),
        )
        note.update(
            {
                "ok": True,
                "triangles": int(len(faces)),
                "vertices": int(len(world)),
                "densityMin": float(volume.min()),
                "densityMax": float(volume.max()),
                "vertexColors": False,
                "reason": "mesh written, network colours discarded",
            }
        )
        out_path.with_suffix(".json").write_text(json.dumps(note, indent=2) + "\n")
        print(json.dumps(note))
        return 0
    except Exception as exc:
        note["reason"] = f"{type(exc).__name__}: {exc}"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.with_suffix(".json").write_text(json.dumps(note, indent=2) + "\n")
        print(json.dumps(note), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

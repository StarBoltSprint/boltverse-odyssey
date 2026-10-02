"""Write an invisible mesh. No vertex colours, no material texture."""

from __future__ import annotations

import json
import struct
from pathlib import Path

import numpy as np


def write_obj(path: Path, vertices: np.ndarray, normals: np.ndarray, faces: np.ndarray) -> None:
    lines = ["# invisible shape. no vertex colour.", "o mesh3d"]
    for x, y, z in np.asarray(vertices, np.float64):
        lines.append(f"v {x:.6f} {y:.6f} {z:.6f}")
    for x, y, z in np.asarray(normals, np.float64):
        lines.append(f"vn {x:.6f} {y:.6f} {z:.6f}")
    for a, b, c in np.asarray(faces, np.int32):
        aa, bb, cc = int(a) + 1, int(b) + 1, int(c) + 1
        lines.append(f"f {aa}//{aa} {bb}//{bb} {cc}//{cc}")
    path.write_text("\n".join(lines) + "\n")


def write_glb(path: Path, vertices: np.ndarray, normals: np.ndarray, faces: np.ndarray) -> None:
    """glTF 2.0, POSITION + NORMAL + indices. No material colour."""
    pos = np.ascontiguousarray(vertices, np.float32)
    nrm = np.ascontiguousarray(normals, np.float32)
    idx = np.ascontiguousarray(faces.reshape(-1), np.uint32)
    blob = pos.tobytes() + nrm.tobytes() + idx.tobytes()
    pad = (4 - (len(blob) % 4)) % 4
    blob += b"\x00" * pad
    nvert = int(pos.shape[0])
    nidx = int(idx.shape[0])
    pos_bytes = nvert * 12
    nrm_bytes = nvert * 12
    idx_bytes = nidx * 4
    pmin = pos.min(axis=0).tolist() if nvert else [0, 0, 0]
    pmax = pos.max(axis=0).tolist() if nvert else [0, 0, 0]
    gltf = {
        "asset": {"version": "2.0", "generator": "mesh3d"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "extras": {"drawsOwnPixels": False}}],
        "meshes": [
            {
                "primitives": [
                    {
                        "attributes": {"POSITION": 0, "NORMAL": 1},
                        "indices": 2,
                        "mode": 4,
                    }
                ],
                "extras": {"invisibleShape": True},
            }
        ],
        "accessors": [
            {
                "bufferView": 0,
                "componentType": 5126,
                "count": nvert,
                "type": "VEC3",
                "min": pmin,
                "max": pmax,
            },
            {"bufferView": 1, "componentType": 5126, "count": nvert, "type": "VEC3"},
            {"bufferView": 2, "componentType": 5125, "count": nidx, "type": "SCALAR"},
        ],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": pos_bytes, "target": 34962},
            {"buffer": 0, "byteOffset": pos_bytes, "byteLength": nrm_bytes, "target": 34962},
            {"buffer": 0, "byteOffset": pos_bytes + nrm_bytes, "byteLength": idx_bytes, "target": 34963},
        ],
        "buffers": [{"byteLength": len(blob)}],
    }
    js = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    js += b" " * ((4 - (len(js) % 4)) % 4)
    out = bytearray()
    out += struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob))
    out += struct.pack("<I", len(js)) + b"JSON" + js
    out += struct.pack("<I", len(blob)) + b"BIN\x00" + blob
    # Fix total length now that we know it.
    struct.pack_into("<I", out, 8, len(out))
    path.write_bytes(out)

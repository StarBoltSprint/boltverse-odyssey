#!/usr/bin/env python3
# Pack the quilted crust atlases as ASTC 4x4 sRGB mip chains.
# Two 4096 rgba8 chains are 170.7 MiB. ASTC 4x4 is 8 bits per pixel and the
# chain stops at the 4x4 block, which keeps both layers under 48 MiB.
import struct
import subprocess
import time
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
DEST = HERE / "tex" / "crust-atlas"
ASTCENC = Path("/tmp/astcenc/bin/astcenc-avx2")
BLOCK = 4


def srgb_to_lin(u8):
    x = u8.astype(np.float64) / 255.0
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(lin):
    y = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(np.maximum(lin, 0.0), 1.0 / 2.4) - 0.055)
    return np.clip(np.rint(y * 255.0), 0, 255).astype(np.uint8)


def box(img):
    # Same linear box as glacier.js mipCanvases. The base pixels stay native.
    lin = srgb_to_lin(img)
    h, w, _ = lin.shape
    nh, nw = h // 2, w // 2
    acc = lin[: nh * 2, : nw * 2].reshape(nh, 2, nw, 2, 3).mean(axis=(1, 3))
    return lin_to_srgb(acc)


def encode_level(png, astc):
    subprocess.check_call(
        [str(ASTCENC), "-cs", str(png), str(astc), "4x4", "-medium", "-j", "4", "-silent"],
    )
    data = astc.read_bytes()
    if data[:4] != bytes([0x13, 0xAB, 0xA1, 0x5C]):
        raise SystemExit(f"bad astc header {astc}")
    return data[16:]


def pack(seed):
    src = DEST / f"atlas-{seed}.png"
    img = np.asarray(Image.open(src).convert("RGB"))
    if img.shape != (4096, 4096, 3):
        raise SystemExit(f"{src.name} is {img.shape}")
    work = Path(f"/tmp/r20-mips-{seed}")
    work.mkdir(parents=True, exist_ok=True)
    levels = []
    cur = img
    while True:
        png = work / f"mip{cur.shape[0]}.png"
        astc = work / f"mip{cur.shape[0]}.astc"
        Image.fromarray(cur, "RGB").save(png)
        t0 = time.time()
        payload = encode_level(png, astc)
        print(f"seed {seed} {cur.shape[0]} {len(payload)} bytes {time.time() - t0:.1f}s", flush=True)
        levels.append((cur.shape[0], cur.shape[1], payload))
        if cur.shape[0] <= BLOCK:
            break
        cur = box(cur)
    blob = bytearray()
    blob += b"AST4"
    blob += struct.pack("<III", 4096, 4096, len(levels))
    gpu = 0
    for w, h, payload in levels:
        blob += struct.pack("<III", w, h, len(payload))
        blob += payload
        gpu += len(payload)
    out = DEST / f"atlas-{seed}.astcpack"
    out.write_bytes(blob)
    # Base-level error against the native quilt. Mips are the sampler chain.
    back = work / "back.png"
    subprocess.check_call([str(ASTCENC), "-ds", str(work / "mip4096.astc"), str(back), "-silent"])
    dec = np.asarray(Image.open(back).convert("RGB"))
    mae = float(np.abs(dec.astype(np.int16) - img.astype(np.int16)).mean())
    return {"seed": seed, "file": out.name, "fileBytes": out.stat().st_size, "gpuBytes": gpu, "levels": len(levels), "baseMae": round(mae, 3)}


def main():
    rows = [pack(7), pack(19)]
    gpu = sum(r["gpuBytes"] for r in rows)
    report = {
        "format": "astc-4x4-unorm-srgb",
        "block": 4,
        "quality": "astcenc 5.3.0 -medium",
        "atlases": rows,
        "snowGpuBytes": gpu,
        "snowGpuMiB": round(gpu / (1024 * 1024), 2),
        "budgetMiB": 48,
    }
    (DEST / "atlas-memory.json").write_text(__import__("json").dumps(report, indent=2) + "\n")
    print(__import__("json").dumps(report, indent=2))


if __name__ == "__main__":
    main()

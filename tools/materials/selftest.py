#!/usr/bin/env python3
"""CPU selftest for tools/materials. Exit 0 = all rows pass."""
import json, subprocess, sys, tempfile
from pathlib import Path
import cv2, numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import materials as M  # noqa: E402

rows = []
def row(name, ok):
    rows.append(ok); print(("PASS " if ok else "FAIL ") + name)

rng = np.random.default_rng(0)
# tileable noise tile, a "key" with the same palette, and a scene-like tile with a sky gradient
noise = rng.uniform(0, 255, (256, 256, 3)).astype(np.float32)
tile = cv2.GaussianBlur(np.tile(noise, (3, 3, 1)), (0, 0), 3)[256:512, 256:512]  # tileable
tile = ((tile - tile.mean()) * 3 + np.array([110, 80, 60])).clip(0, 255).astype(np.uint8)
key = np.tile(tile, (2, 2, 1))
scene = tile.copy(); scene[:96] = np.linspace(255, 120, 96)[:, None, None].astype(np.uint8)
with tempfile.TemporaryDirectory() as d:
    d = Path(d)
    cv2.imwrite(str(d / "t.png"), tile); cv2.imwrite(str(d / "k.png"), key); cv2.imwrite(str(d / "s.png"), scene)
    lib = d / "lib"
    base = ["--library", str(lib), "add", "--key", str(d / "k.png"), "--crop", "0,0,256,256", "--prompt", "p"]
    row("good tile add + KEEP (tile 0.5 m -> 512 px/m)", M.main(base + ["--id", "good", "--albedo", str(d / "t.png"), "--tile-m", "0.5", "--tags", "stone,x", "--keep"]) == 0)
    meta = json.loads((lib / "good" / "metadata.json").read_text())
    row("metadata has every field", all(k in meta for k in M.REQUIRED) and meta["status"] == "KEEP")
    row("hex repetition peak below plain", meta["repetition_peak"]["hex"] < meta["repetition_peak"]["plain"])
    row("normal + height written", (lib / "good" / "normal.jpg").is_file() and cv2.imread(str(lib / "good" / "height.png"), -1).dtype == np.uint16)
    row("low px/m refused (tile 2 m -> 128 px/m)", M.main(base + ["--id", "blurry", "--albedo", str(d / "t.png"), "--tile-m", "2.0", "--keep"]) == 1)
    warm = tile.copy(); warm[..., 2] = 255
    cv2.imwrite(str(d / "w.png"), warm)
    row("colour drift refused (dE > 5)", M.main(base + ["--id", "warm", "--albedo", str(d / "w.png"), "--tile-m", "0.5"]) == 1)
    row("scene content (sky gradient) refused", M.main(base + ["--id", "scene", "--albedo", str(d / "s.png"), "--tile-m", "0.5"]) == 1)
    row("find by tag", M.main(["--library", str(lib), "find", "--tag", "stone", "--status", "KEEP"]) == 0)
    row("find by colour miss exits 1", M.main(["--library", str(lib), "find", "--colour", "#ff00ff", "--max-de", "5"]) == 1)
    row("check fails while FAIL entries exist", M.main(["--library", str(lib), "check"]) == 1)
    row("check --id good passes", M.main(["--library", str(lib), "check", "--id", "good"]) == 0)
    meta["status"] = "KEEP"; meta["px_per_m"] = 100
    (lib / "good" / "metadata.json").write_text(json.dumps(meta))
    row("tampered KEEP with low px/m fails check", M.main(["--library", str(lib), "check", "--id", "good"]) == 1)
row("seeded repo library passes check", M.main(["check"]) == 0)
print(f"{sum(rows)}/{len(rows)} rows pass")
sys.exit(0 if all(rows) else 1)

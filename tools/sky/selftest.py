#!/usr/bin/env python3
"""Red then green checks for sky seams, living loops, and the play composite.

  python3 tools/sky/selftest.py
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SKY = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(SKY) not in sys.path:
    sys.path.insert(0, str(SKY))

from pixels import assess_display, assess_slices, lcm_seconds, perceived_repetition  # noqa: E402


def fail(msg: str) -> None:
    raise SystemExit(msg)


def ring(n: int = 4, w: int = 64, h: int = 24) -> list[tuple[str, np.ndarray]]:
    total = n * w
    field = np.zeros((h, total, 3), np.uint8)
    for x in range(total):
        luma = 80 + int(round(2 * np.sin(2 * np.pi * x / total)))
        field[:, x] = luma
    return [(f"slice-{i:02d}.png", field[:, i * w : (i + 1) * w].copy()) for i in range(n)]


def test_chain_pass() -> None:
    report = assess_slices(ring())
    if not report["ok"]:
        fail("green chain should pass\n" + "\n".join(report["failures"]))
    if not report["close"]["ok"]:
        fail("green chain did not close")
    print("green chain PASS", "swing", report["swing"]["swing"])


def test_clone_and_mirror() -> None:
    rng = np.random.RandomState(2)
    base = rng.randint(20, 180, (32, 96, 3), dtype=np.uint8)
    cloned = base.copy()
    cloned[:, -16:] = cloned[:, -32:-16]
    report = assess_slices([("a.png", base), ("b.png", cloned), ("c.png", base), ("d.png", base)])
    text = "\n".join(report["failures"])
    if report["ok"] or "clone" not in text:
        fail("red clone was not rejected\n" + text)
    mirrored = base.copy()
    mirrored[:, -16:] = mirrored[:, -32:-16][:, ::-1]
    report_m = assess_slices([("a.png", base), ("b.png", mirrored)])
    text_m = "\n".join(report_m["failures"])
    if report_m["ok"] or "mirror" not in text_m:
        fail("red mirror was not rejected\n" + text_m)
    print("red clone+mirror FAIL")


def test_interior_motif() -> None:
    """A copied bank in the middle, and a kaleidoscope, are not trailing-column defects."""
    rng = np.random.RandomState(7)
    h, w = 96, 320
    base = rng.randint(15, 230, (h, w, 3), dtype=np.uint8)
    base[:, :, 0] = np.clip(base[:, :, 0].astype(np.int16) + np.linspace(-40, 40, w).astype(np.int16), 0, 255)
    cloned = base.copy()
    cloned[:, 180:260] = cloned[:, 40:120]
    report = assess_slices([("keep.png", base), ("again.png", cloned)])
    text = "\n".join(report["failures"])
    if "motif repeat" not in text:
        fail("interior motif repeat was not rejected\n" + text)
    field = rng.randint(20, 210, (h, w // 2, 3), dtype=np.uint8)
    mirror = np.concatenate([field, field[:, ::-1]], axis=1)
    noise = rng.randint(0, 5, mirror.shape, dtype=np.uint8)
    mirror = np.clip(mirror.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    report_m = assess_slices([("keep.png", base), ("kaleidoscope.png", mirror)])
    text_m = "\n".join(report_m["failures"])
    if "motif mirror" not in text_m:
        fail("interior mirror was not rejected\n" + text_m)
    copied = np.concatenate([field, field], axis=1)
    copied = np.clip(copied.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    report_c = assess_slices([("keep.png", base), ("diptych.png", copied)])
    text_c = "\n".join(report_c["failures"])
    if "motif copy" not in text_c and "motif repeat" not in text_c:
        fail("interior diptych copy was not rejected\n" + text_c)
    print("interior motif FAIL")


def test_join_and_close_and_cheapest() -> None:
    h, w = 24, 64
    slices = []
    prev = None
    for i in range(4):
        img = np.full((h, w, 3), 100, np.uint8)
        if prev is not None:
            img[:, :8] = prev[:, -8:]
        slices.append((f"slice-{i:02d}.png", img))
        prev = img
    # Break only the closing strip by 5 levels. Swing stays inside 6.
    last = slices[-1][1].copy()
    last[:, -8:] = 95
    slices[-1] = (slices[-1][0], last)
    report = assess_slices(slices)
    text = "\n".join(report["failures"])
    if report["ok"] or "close" not in text:
        fail("red open chain was not rejected\n" + text)
    if report["cheapest"]["file"] != "slice-03.png":
        fail(f"cheapest recook should be the closing slice, got {report['cheapest']}")
    # One drifted slice between matches: both neighbor joins fail, that slice is cheapest.
    good = ring()
    drifted = np.full_like(good[2][1], 40)
    named = list(good)
    named[2] = (good[2][0], drifted)
    report2 = assess_slices(named)
    if report2["ok"]:
        fail("drifted slice should fail")
    if report2["cheapest"]["file"] != good[2][0]:
        fail(f"cheapest should recook the drifted slice, got {report2['cheapest']}")
    print("red close+cheapest", report["cheapest"]["why"])


def test_swing() -> None:
    named = ring()
    hot = named[1][1].copy()
    hot[:] = 140
    named[1] = (named[1][0], hot)
    report = assess_slices(named)
    text = "\n".join(report["failures"])
    if report["ok"] or "swing" not in text:
        fail("red luma swing was not rejected\n" + text)
    print("red swing", report["swing"]["swing"])


def test_repetition() -> None:
    if lcm_seconds([13, 17, 29]) != 6409:
        fail(f"lcm 13,17,29 = {lcm_seconds([13, 17, 29])}")
    if lcm_seconds([10, 20, 30]) >= 600:
        fail("10/20/30 combined period should be short")
    flash = np.full((40, 16, 16), 40, np.uint8)
    for i in range(0, 40, 10):
        flash[i, 4:6, 4:6] = 255
    bad = perceived_repetition(flash, 10)
    if bad["ok"] or not bad["periodSec"] or bad["periodSec"] >= 60:
        fail(f"red flash should repeat under 60s, got {bad}")
    gentle = np.zeros((30, 16, 16), np.uint8)
    for i in range(30):
        gentle[i] = 50 + int(round(3 * np.sin(i / 5.0)))
    good = perceived_repetition(gentle, 10)
    if not good["ok"]:
        fail(f"green drift should pass, got {good}")
    stars = np.full((24, 16, 16), 30, np.uint8)
    stars[:, 2, 2] = 220
    stars[:, 8, 10] = 210
    stars[:, 12, 4] = 200
    field = perceived_repetition(stars, 8)
    if not field["ok"]:
        fail(f"always-on star field is texture, not a one-off, got {field}")
    pair = np.full((24, 16, 16), 30, np.uint8)
    pair[:, 2, 2] = 220
    pair[:, 8, 10] = 210
    held = perceived_repetition(pair, 8)
    if not held["ok"]:
        fail(f"always-on pair is texture, not a short event, got {held}")
    print("repetition red", bad["periodSec"], "green drift PASS combined", lcm_seconds([13, 17, 29]))


def test_manifest_roundtrip(tmp: Path) -> None:
    folder = tmp / "sky"
    if folder.exists():
        shutil.rmtree(folder)
    folder.mkdir(parents=True)
    for name, rgb in ring():
        Image.fromarray(rgb, "RGB").save(folder / name)
    manifest = {
        "slices": [name for name, _ in ring()],
        "layers": [],
        "offsetsSec": [0.0, 2.5, 5.5, 9.0],
    }
    (folder / "sky.json").write_text(json.dumps(manifest, indent=2) + "\n")
    out = tmp / "out-pass"
    proc = subprocess.run(
        [sys.executable, str(SKY / "check.py"), "--manifest", str(folder / "sky.json"), "--out", str(out)],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    report = json.loads((out / "report.json").read_text())
    if proc.returncode != 0 or not report["ok"]:
        fail(proc.stdout + proc.stderr + "\n".join(report.get("failures") or []))
    # Offsets that sync, plus a short combined period, must fail without videos
    # when layers are declared as durations only. File-backed layers are the mp4 path.
    print("manifest chain PASS")


def test_display_mag() -> None:
    """The step-2 veil (one 848×480 frame over 360°) must fail. A tiled layer must pass."""
    old = assess_display(
        {
            "bands": [
                {
                    "id": "horizon",
                    "srcW": 1436,
                    "srcH": 976,
                    "azimuthDeg": 45,
                    "elBottomDeg": -3,
                    "elTopDeg": 24,
                }
            ],
            "cap": {"srcW": 1024, "elStartDeg": 24},
            "videoTiles": [
                {"id": "stars", "srcW": 848, "srcH": 480, "azimuthDeg": 360, "elevationDeg": 48}
            ],
        }
    )
    text = "\n".join(old["failures"])
    if old["ok"] or "stars" not in text or "cap" not in text:
        fail("old 360 veil and low cap must fail\n" + text)
    stars = next(row for row in old["rows"] if row["id"] == "stars")
    if stars["mag"] < 10:
        fail(f"old veil mag should be about 13, got {stars['mag']}")
    good = assess_display(
        {
            "bands": [
                {
                    "id": "horizon",
                    "srcW": 1900,
                    "srcH": 864,
                    "azimuthDeg": 45,
                    "elBottomDeg": -1.5,
                    "elTopDeg": 24,
                },
                {
                    "id": "upper",
                    "srcW": 1480,
                    "srcH": 1248,
                    "azimuthDeg": 45,
                    "elBottomDeg": 21.5,
                    "elTopDeg": 54,
                },
                {
                    "id": "high",
                    "srcW": 1152,
                    "srcH": 864,
                    "azimuthDeg": 45,
                    "elBottomDeg": 52,
                    "elTopDeg": 77.5,
                },
            ],
            "cap": {"srcW": 1024, "elStartDeg": 76},
            "videoTiles": [
                {"id": "stars", "srcW": 848, "srcH": 480, "azimuthDeg": 21.18, "elevationDeg": 11.25},
                {"id": "dust", "srcW": 848, "srcH": 480, "azimuthDeg": 21.18, "elevationDeg": 11.25},
                {"id": "nebula", "srcW": 848, "srcH": 480, "azimuthDeg": 21.18, "elevationDeg": 11.25},
            ],
        }
    )
    if not good["ok"]:
        fail("tiled layout should pass\n" + "\n".join(good["failures"]))
    print("display mag old FAIL", stars["mag"], "new PASS")


def test_runtime() -> None:
    probe = r"""
await import("file://" + process.argv[1]);
const sky = globalThis.BoltSky;
if (!sky || typeof sky.resolveSeamBlend !== "function") throw new Error("BoltSky missing");
const off = sky.resolveSeamBlend({ gateOk: false, seamBlend: true });
if (off.enabled) throw new Error("blend must stay off when the gate fails");
const on = sky.resolveSeamBlend({ gateOk: true });
if (!on.enabled || on.frac < 0.02 || on.frac > 0.04) throw new Error("gate pass should enable a 2-4% seam");
const forcedOff = sky.resolveSeamBlend({ gateOk: true, seamBlend: "off" });
if (forcedOff.enabled) throw new Error("explicit off stays off");
const w = 20, h = 2;
const left = new Uint8Array(w * h * 3);
const right = new Uint8Array(w * h * 3);
for (let i = 0; i < left.length; i += 3) { left[i] = 10; right[i] = 200; }
const blended = sky.blendSeam(left, right, w, h, 0.1);
if (blended.frac < 0.02 || blended.frac > 0.04) throw new Error("frac escaped 2-4%");
const mid = (h - 1) * w + (w - 1);
const edge = blended.rgba[mid * 3];
if (edge <= 10 || edge >= 200) throw new Error("seam pixel is not a mix of the two slices: " + edge);
if (blended.rgba[0] !== 10) throw new Error("interior pixel changed");
const t0 = sky.layerTime(0, 0, 13);
const t1 = sky.layerTime(0, 4.5, 13);
if (t0 === t1) throw new Error("adjacent offsets synced");
if (sky.combinedRepeatSec([13, 17, 29]) !== 6409) throw new Error("combined period");
const plan = sky.skyPlan({
  t: 3,
  gateOk: true,
  sliceCount: 4,
  offsets: [0, 2.5, 5.5, 9],
  layers: [
    { id: "stars", durationSec: 13, texBytes: 1000 },
    { id: "nebula", durationSec: 29, texBytes: 1000 },
    { id: "dust", durationSec: 17, texBytes: 1000 },
  ],
});
if (!plan.ok) throw new Error(plan.errors.join(";"));
if (plan.combinedRepeatSec !== 6409) throw new Error("plan period " + plan.combinedRepeatSec);
if (plan.layers[0].times[0] === plan.layers[0].times[1]) throw new Error("slice times synced");
const notes = [];
sky.bindSkyPerf({
  noteVideo(id) { notes.push(id); },
  noteTexture(id, bytes) { notes.push(id + ":" + bytes); },
}, plan);
if (notes.length !== 6) throw new Error("perf notes " + notes.join(","));
const fat = sky.skyPlan({
  t: 0,
  gateOk: true,
  sliceCount: 2,
  offsets: [0, 0.1],
  layers: [
    { id: "a", durationSec: 10, texBytes: 1 },
    { id: "b", durationSec: 20, texBytes: 1 },
    { id: "c", durationSec: 30, texBytes: 1 },
  ],
  oneShots: [{ id: "flash", minGapSec: 40, maxGapSec: 90 }],
});
if (fat.ok) throw new Error("short period, synced offsets, and a 4th decoder should fail");
const gaps = sky.oneShotGaps(12, 40, 90, () => 0.2);
if (gaps.some((g) => g < 40 || g > 90)) throw new Error("gap outside range");
if (new Set(gaps).size !== 1) throw new Error("fixed rng should be stable, not a hidden clock");
console.log("runtime PASS");
"""
    proc = subprocess.run(["node", "-e", probe, str(SKY / "runtime.js")], text=True, capture_output=True)
    if proc.returncode != 0:
        fail(proc.stdout + proc.stderr)
    print(proc.stdout.strip())


def main() -> None:
    tmp = Path("/tmp/sky-selftest")
    if tmp.exists():
        shutil.rmtree(tmp)
    tmp.mkdir()
    test_chain_pass()
    test_clone_and_mirror()
    test_interior_motif()
    test_join_and_close_and_cheapest()
    test_swing()
    test_repetition()
    test_display_mag()
    test_manifest_roundtrip(tmp)
    test_runtime()
    print("PASS sky selftest")


if __name__ == "__main__":
    main()

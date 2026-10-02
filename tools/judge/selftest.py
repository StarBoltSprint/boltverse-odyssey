#!/usr/bin/env python3
"""Offline gate for the visual judge. No grok binary and no network.

  python3 tools/judge/selftest.py
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
TOOL = ROOT / "tools" / "judge"
JUDGE = TOOL / "judge.py"
PY = sys.executable

sys.path.insert(0, str(ROOT))
from tools.judge.judge import MAX_IMAGE_BLOCK_BYTES, block_nbytes, grok_argv  # noqa: E402


def fail(msg: str) -> None:
    raise SystemExit(f"FAIL selftest: {msg}")


def run(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run([PY, str(JUDGE), *args], cwd=ROOT, text=True, capture_output=True)


def save_rgb(path: Path, rgb: np.ndarray) -> None:
    Image.fromarray(rgb, "RGB").save(path, "PNG")


def solid(path: Path, color: tuple[int, int, int], size: int = 48) -> None:
    rgb = np.zeros((size, size, 3), np.uint8)
    rgb[:] = color
    save_rgb(path, rgb)


def noise(path: Path, size: int = 1600) -> None:
    rng = np.random.default_rng(2)
    rgb = rng.integers(0, 256, (size, size, 3), dtype=np.uint8)
    save_rgb(path, rgb)


def good_reply() -> str:
    return json.dumps({"score": 8, "keep": True, "defects": [], "matches_refs": True})


def assert_rc(proc: subprocess.CompletedProcess[str], code: int, needle: str) -> None:
    if proc.returncode != code or needle not in proc.stdout:
        fail(f"expected rc {code} and {needle!r}\nrc={proc.returncode}\nstdout={proc.stdout}\nstderr={proc.stderr}")


def image_blocks(prompt: Path) -> list[dict]:
    data = json.loads(prompt.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        fail("prompt JSON is not a list of content blocks")
    return [block for block in data if isinstance(block, dict) and block.get("type") == "image"]


def assert_blocks(prompt: Path, count: int) -> None:
    blocks = json.loads(prompt.read_text(encoding="utf-8"))
    text = "\n".join(block.get("text", "") for block in blocks if block.get("type") == "text")
    if "living painted film" not in text or "classic 3D game" not in text:
        fail("prompt is missing the Golden rule")
    if "purple lightning cracks" not in text:
        fail("prompt is missing the taste log")
    images = image_blocks(prompt)
    if len(images) != count:
        fail(f"expected {count} image blocks, got {len(images)}")
    for block in images:
        if block.get("mimeType") != "image/jpeg":
            fail(f"mimeType {block.get('mimeType')}")
        size = block_nbytes(block)
        if size > MAX_IMAGE_BLOCK_BYTES:
            fail(f"image block {size} exceeds {MAX_IMAGE_BLOCK_BYTES}")
        raw = __import__("base64").b64decode(block["data"])
        decoded = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
        if decoded is None or decoded.size == 0:
            fail("image block is not a jpeg")


def test_dry_run(tmp: Path) -> None:
    candidate = tmp / "candidate.png"
    huge = tmp / "huge.png"
    refs = [tmp / f"ref-{i}.png" for i in range(3)]
    solid(candidate, (20, 20, 20))
    noise(huge)
    for index, ref in enumerate(refs):
        solid(ref, (40 + index * 20, 10, 80))
    prompt = tmp / "prompt.json"
    stamp = tmp / "grok-called"
    fake_bin = tmp / "bin"
    fake_bin.mkdir()
    fake = fake_bin / "grok"
    fake.write_text("#!/bin/sh\ntouch \"$GROK_STAMP\"\nexit 9\n", encoding="utf-8")
    fake.chmod(0o755)
    env = os.environ.copy()
    env["PATH"] = str(fake_bin) + os.pathsep + env.get("PATH", "")
    env["GROK_STAMP"] = str(stamp)
    proc = subprocess.run(
        [
            PY,
            str(JUDGE),
            "--candidate",
            str(huge),
            "--ref",
            str(refs[0]),
            "--ref",
            str(refs[1]),
            "--ref",
            str(refs[2]),
            "--dry-run",
            "--prompt-json",
            str(prompt),
            "--grok",
            str(fake),
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
        env=env,
    )
    assert_rc(proc, 0, "DRY-RUN")
    if stamp.exists():
        fail("dry-run called grok")
    assert_blocks(prompt, 4)
    decoded = cv2.imdecode(
        np.frombuffer(__import__("base64").b64decode(image_blocks(prompt)[3]["data"]), np.uint8),
        cv2.IMREAD_COLOR,
    )
    if decoded.shape[0] >= 1600 or decoded.shape[1] >= 1600:
        fail("oversized image was not downscaled")
    one = tmp / "one.json"
    proc = run(["--candidate", str(candidate), "--ref", str(refs[0]), "--dry-run", "--prompt-json", str(one)])
    assert_rc(proc, 0, "DRY-RUN")
    assert_blocks(one, 2)
    if grok_argv(one) != ["grok", "-p", "--prompt-json", str(one)]:
        fail(f"grok argv {grok_argv(one)}")


def test_refs_and_registry(tmp: Path) -> None:
    candidate = tmp / "candidate.png"
    refs = [tmp / f"r{i}.png" for i in range(4)]
    solid(candidate, (8, 8, 8))
    for ref in refs:
        solid(ref, (200, 40, 40), size=32)
    prompt = tmp / "too-many.json"
    proc = run(
        ["--candidate", str(candidate), "--dry-run", "--prompt-json", str(prompt)]
        + [arg for ref in refs for arg in ("--ref", str(ref))]
    )
    if proc.returncode != 2:
        fail(f"4 refs should be usage rc 2, got {proc.returncode}: {proc.stderr}")
    proc = run(["--candidate", str(candidate), "--dry-run", "--prompt-json", str(prompt)])
    if proc.returncode != 2:
        fail(f"0 refs should be usage rc 2, got {proc.returncode}: {proc.stderr}")
    # Registry paths are repo-relative, so the hashed chip has to live under ROOT
    # for the duration of the check. It is deleted before return.
    held = TOOL / "_selftest_chip.png"
    digest = __import__("hashlib").sha256(refs[0].read_bytes()).hexdigest()
    try:
        held.write_bytes(refs[0].read_bytes())
        rel = held.relative_to(ROOT).as_posix()
        good_reg = tmp / "good-registry.json"
        bad_reg = tmp / "bad-registry.json"
        good_reg.write_text(
            json.dumps({"references": [{"path": rel, "sha256": digest, "for": "angular test chip"}]}) + "\n",
            encoding="utf-8",
        )
        bad_reg.write_text(
            json.dumps({"references": [{"path": rel, "sha256": "0" * 64, "for": "angular test chip"}]}) + "\n",
            encoding="utf-8",
        )
        ok_prompt = tmp / "registered.json"
        proc = run(
            [
                "--candidate",
                str(candidate),
                "--ref",
                str(held),
                "--registry",
                str(good_reg),
                "--dry-run",
                "--prompt-json",
                str(ok_prompt),
            ]
        )
        assert_rc(proc, 0, "DRY-RUN")
        if "Registered for: angular test chip" not in ok_prompt.read_text(encoding="utf-8"):
            fail("registered ref was not named in the prompt")
        proc = run(
            [
                "--candidate",
                str(candidate),
                "--ref",
                str(held),
                "--registry",
                str(bad_reg),
                "--dry-run",
                "--prompt-json",
                str(tmp / "bad.json"),
            ]
        )
        if proc.returncode != 2 or "sha256 mismatch" not in proc.stderr:
            fail(f"bad hash should be rc 2\nrc={proc.returncode}\nstderr={proc.stderr}")
    finally:
        if held.exists():
            held.unlink()


def test_replies(tmp: Path) -> None:
    good = tmp / "good.txt"
    good.write_text(good_reply() + "\n", encoding="utf-8")
    assert_rc(run(["--parse-reply", str(good)]), 0, "PASS score=8")
    low = tmp / "low.txt"
    low.write_text(
        json.dumps({"score": 6, "keep": True, "defects": ["rounded"], "matches_refs": True}) + "\n",
        encoding="utf-8",
    )
    assert_rc(run(["--parse-reply", str(low)]), 1, "FAIL gate:")
    keep_false = tmp / "keep.txt"
    keep_false.write_text(
        json.dumps({"score": 9, "keep": False, "defects": ["sticker"], "matches_refs": True}) + "\n",
        encoding="utf-8",
    )
    assert_rc(run(["--parse-reply", str(keep_false)]), 1, "keep is false")
    refs_false = tmp / "refs.txt"
    refs_false.write_text(
        json.dumps({"score": 9, "keep": True, "defects": ["two ships"], "matches_refs": False}) + "\n",
        encoding="utf-8",
    )
    assert_rc(run(["--parse-reply", str(refs_false)]), 1, "matches_refs is false")
    assert_rc(run(["--parse-reply", str(good), "--threshold", "9"]), 1, "score 8 < 9")
    assert_rc(run(["--parse-reply", str(good), "--threshold", "8"]), 0, "PASS score=8")
    bad_samples = [
        "not json",
        "",
        json.dumps({"score": 11, "keep": True, "defects": [], "matches_refs": True}),
        json.dumps({"score": "8", "keep": True, "defects": [], "matches_refs": True}),
        json.dumps({"score": 8, "keep": True, "defects": [], "matches_refs": True, "extra": 1}),
        json.dumps({"score": 8, "keep": "true", "defects": [], "matches_refs": True}),
        json.dumps({"score": 8, "keep": True, "defects": [1], "matches_refs": True}),
        "```json\n" + good_reply() + "\n```",
    ]
    for index, sample in enumerate(bad_samples):
        path = tmp / f"bad-{index}.txt"
        path.write_text(sample, encoding="utf-8")
        proc = run(["--parse-reply", str(path)])
        assert_rc(proc, 1, "FAIL bad reply:")


def test_source_has_no_client() -> None:
    text = JUDGE.read_text(encoding="utf-8")
    for needle in ("XAI_API_KEY", "api.x.ai", "requests", "urllib", "http://", "https://"):
        if needle in text:
            fail(f"judge.py contains {needle}")


def main() -> None:
    test_source_has_no_client()
    with tempfile.TemporaryDirectory() as raw:
        tmp = Path(raw)
        test_dry_run(tmp)
        test_refs_and_registry(tmp)
        test_replies(tmp)
    print("PASS tools/judge/selftest.py")


if __name__ == "__main__":
    main()

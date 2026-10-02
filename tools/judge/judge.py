#!/usr/bin/env python3
"""Visual judge gate for one candidate still against 1–3 references.

Builds a Grok Build CLI prompt file and, unless --dry-run, runs:

    grok -p --prompt-json <file>

No network client and no API key live in this file. The local grok binary
owns any session it already has.

    python3 tools/judge/judge.py --candidate still.jpg --ref ref.jpg --dry-run --prompt-json /tmp/prompt.json
    python3 tools/judge/judge.py --parse-reply reply.txt
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
TOOL = Path(__file__).resolve().parent
MAX_IMAGE_BLOCK_BYTES = 128 * 1024
DEFAULT_THRESHOLD = 7
REPLY_KEYS = ("score", "keep", "defects", "matches_refs")
GOLDEN_HEADING = "## Golden rule"


class UsageError(Exception):
    pass


class ReplyError(Exception):
    pass


def block_nbytes(block: dict) -> int:
    encoded = json.dumps(block, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    return len(encoded)


def load_bgr(path: Path) -> np.ndarray:
    try:
        with Image.open(path) as img:
            rgb = np.asarray(img.convert("RGB"))
    except Exception as exc:
        raise UsageError(f"cannot open {path}: {exc}") from exc
    if rgb.ndim != 3 or rgb.shape[2] != 3:
        raise UsageError(f"{path} is not an RGB image")
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def fit_image_block(path: Path) -> dict:
    """JPEG-compress and downscale until the image content block is <= 128 KiB."""
    bgr = load_bgr(path)
    height, width = bgr.shape[:2]
    scale = 1.0
    long_side = max(height, width)
    if long_side > 1280:
        scale = 1280 / long_side
    quality = 85
    last_size = None
    for _ in range(48):
        nw = max(8, int(round(width * scale)))
        nh = max(8, int(round(height * scale)))
        if nw == width and nh == height:
            view = bgr
        else:
            view = cv2.resize(bgr, (nw, nh), interpolation=cv2.INTER_AREA)
        ok, buf = cv2.imencode(".jpg", view, [int(cv2.IMWRITE_JPEG_QUALITY), int(quality)])
        if not ok:
            raise UsageError(f"jpeg encode failed for {path}")
        block = {
            "type": "image",
            "mimeType": "image/jpeg",
            "data": base64.b64encode(buf.tobytes()).decode("ascii"),
        }
        size = block_nbytes(block)
        last_size = size
        if size <= MAX_IMAGE_BLOCK_BYTES:
            return block
        if quality > 40:
            quality -= 10
            continue
        scale *= 0.7
        quality = 70
        if min(nw, nh) <= 32:
            break
    raise UsageError(
        f"image block for {path} is {last_size} bytes after compress; cap is {MAX_IMAGE_BLOCK_BYTES}"
    )


def extract_section(markdown: str, heading: str) -> str:
    lines = markdown.splitlines()
    start = None
    for index, line in enumerate(lines):
        if line.strip() == heading:
            start = index + 1
            break
    if start is None:
        raise UsageError(f"{heading} missing from taste log")
    body: list[str] = []
    for line in lines[start:]:
        if line.startswith("## "):
            break
        body.append(line)
    text = "\n".join(body).strip()
    if not text:
        raise UsageError(f"{heading} is empty")
    return text


def load_taste(path: Path) -> str:
    if not path.is_file():
        raise UsageError(f"taste log not found: {path}")
    return path.read_text(encoding="utf-8")


def load_registry(path: Path) -> list[dict]:
    if not path.is_file():
        raise UsageError(f"registry not found: {path}")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise UsageError(f"registry is not JSON: {exc.msg}") from exc
    if not isinstance(data, dict) or not isinstance(data.get("references"), list):
        raise UsageError('registry must be {"references": []}')
    seen: set[str] = set()
    for entry in data["references"]:
        if not isinstance(entry, dict):
            raise UsageError("registry entry is not an object")
        keys = ("path", "sha256", "for")
        if any(not isinstance(entry.get(key), str) or not entry[key].strip() for key in keys):
            raise UsageError("registry entry needs path, sha256, and for")
        digest = entry["sha256"].strip().lower()
        if len(digest) != 64 or any(ch not in "0123456789abcdef" for ch in digest):
            raise UsageError(f"sha256 is not 64 hex characters: {entry['path']}")
        rel = entry["path"].strip()
        if rel.startswith("/") or ".." in Path(rel).parts or "lock" in Path(rel).parts:
            raise UsageError(f"registry path must be repo-relative and not under lock/: {rel}")
        if rel in seen:
            raise UsageError(f"duplicate registry path: {rel}")
        seen.add(rel)
        entry["sha256"] = digest
        entry["path"] = rel
    return data["references"]


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def registry_note(ref: Path, registry: list[dict]) -> str:
    resolved = ref.resolve()
    for entry in registry:
        registered = (ROOT / entry["path"]).resolve()
        if registered != resolved:
            continue
        digest = file_sha256(ref)
        if digest != entry["sha256"]:
            raise UsageError(
                f"sha256 mismatch for {entry['path']}: file {digest} registry {entry['sha256']}"
            )
        return f"Registered for: {entry['for']}"
    return "Not in tools/judge/references.json."


def build_prompt(candidate: Path, refs: list[Path], taste: str, threshold: int, registry: list[dict]) -> list[dict]:
    golden = extract_section(taste, GOLDEN_HEADING)
    instructions = (
        "You are a visual gate before the owner. You are not the owner. "
        "A score never overrides a hard law.\n\n"
        "Golden rule (binding):\n"
        f"{golden}\n\n"
        f"Compare the candidate to the {len(refs)} reference image(s) and to the owner taste log below. "
        "Every new idea must reinforce the Golden rule and must not drift toward a classic 3D game.\n"
        "Reply with one JSON object and nothing else. No markdown fence. Keys only, in this shape: "
        '{"score": 1, "keep": false, "defects": ["short reason"], "matches_refs": false}\n'
        "score is an integer from 1 to 10. "
        f"The harness passes a valid reply only when score >= {threshold}, keep is true, and matches_refs is true. "
        "keep is true only if you would hand this still to the owner. "
        "matches_refs is true only if the candidate is the same design as the references, not a second object. "
        "defects is an array of short strings. Use [] when you have none. Do not raise the score to clear the bar."
    )
    blocks: list[dict] = [
        {"type": "text", "text": instructions},
        {"type": "text", "text": "Owner taste log (learn/taste.md):\n\n" + taste.strip()},
    ]
    for index, ref in enumerate(refs, start=1):
        note = registry_note(ref, registry)
        blocks.append({"type": "text", "text": f"Reference {index} of {len(refs)}. {note}"})
        blocks.append(fit_image_block(ref))
    blocks.append({"type": "text", "text": "Candidate. This is the image to score."})
    blocks.append(fit_image_block(candidate))
    for block in blocks:
        if block.get("type") == "image" and block_nbytes(block) > MAX_IMAGE_BLOCK_BYTES:
            raise UsageError("image content block exceeds 128 KiB")
    return blocks


def parse_reply(text: str) -> dict:
    raw = text.strip()
    if not raw:
        raise ReplyError("empty reply")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ReplyError(f"not JSON ({exc.msg})") from exc
    if not isinstance(data, dict):
        raise ReplyError("reply is not a JSON object")
    missing = [key for key in REPLY_KEYS if key not in data]
    extra = sorted(set(data) - set(REPLY_KEYS))
    if missing or extra:
        raise ReplyError(f"keys must be {list(REPLY_KEYS)}")
    score = data["score"]
    if isinstance(score, bool) or not isinstance(score, int) or not 1 <= score <= 10:
        raise ReplyError("score must be an integer 1-10")
    if not isinstance(data["keep"], bool):
        raise ReplyError("keep must be a bool")
    defects = data["defects"]
    if not isinstance(defects, list) or not all(isinstance(item, str) for item in defects):
        raise ReplyError("defects must be an array of strings")
    if not isinstance(data["matches_refs"], bool):
        raise ReplyError("matches_refs must be a bool")
    return data


def gate_reason(verdict: dict, threshold: int) -> str | None:
    reasons: list[str] = []
    if verdict["score"] < threshold:
        reasons.append(f"score {verdict['score']} < {threshold}")
    if verdict["keep"] is not True:
        reasons.append("keep is false")
    if verdict["matches_refs"] is not True:
        reasons.append("matches_refs is false")
    if not reasons:
        return None
    return "; ".join(reasons)


def grok_argv(prompt_path: Path, grok_bin: str = "grok") -> list[str]:
    return [grok_bin, "-p", "--prompt-json", str(prompt_path)]


def decide(text: str, threshold: int) -> tuple[int, str]:
    try:
        verdict = parse_reply(text)
    except ReplyError as exc:
        return 1, f"FAIL bad reply: {exc}"
    reason = gate_reason(verdict, threshold)
    if reason:
        return 1, f"FAIL gate: {reason}"
    return 0, f"PASS score={verdict['score']} threshold={threshold}"


def require_image(path: Path, label: str) -> Path:
    if not path.is_file():
        raise UsageError(f"{label} is not a file: {path}")
    return path


def check_threshold(threshold: int) -> None:
    if not 1 <= threshold <= 10:
        raise UsageError("threshold must be an integer 1-10")


def write_prompt(path: Path, blocks: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(blocks, indent=2) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Visual judge gate before owner review.")
    parser.add_argument("--candidate", type=Path)
    parser.add_argument("--ref", action="append", default=[], type=Path)
    parser.add_argument("--threshold", type=int, default=DEFAULT_THRESHOLD)
    parser.add_argument("--taste", type=Path, default=ROOT / "learn" / "taste.md")
    parser.add_argument("--registry", type=Path, default=TOOL / "references.json")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--prompt-json", type=Path)
    parser.add_argument("--parse-reply", type=Path)
    parser.add_argument("--grok", default="grok")
    args = parser.parse_args(argv)
    try:
        check_threshold(args.threshold)
        if args.parse_reply is not None:
            if args.candidate or args.ref or args.dry_run:
                raise UsageError("--parse-reply does not take images or --dry-run")
            if not args.parse_reply.is_file():
                raise UsageError(f"reply is not a file: {args.parse_reply}")
            code, line = decide(args.parse_reply.read_text(encoding="utf-8"), args.threshold)
            print(line)
            return code
        if args.candidate is None:
            raise UsageError("--candidate is required")
        if not 1 <= len(args.ref) <= 3:
            raise UsageError("need 1 to 3 --ref images")
        candidate = require_image(args.candidate, "candidate")
        refs = [require_image(ref, "ref") for ref in args.ref]
        taste = load_taste(args.taste)
        registry = load_registry(args.registry)
        blocks = build_prompt(candidate, refs, taste, args.threshold, registry)
        if args.dry_run and args.prompt_json is None:
            raise UsageError("--dry-run requires --prompt-json")
        prompt_path = args.prompt_json
        if prompt_path is None:
            handle = tempfile.NamedTemporaryFile(prefix="judge-prompt-", suffix=".json", delete=False)
            handle.close()
            prompt_path = Path(handle.name)
        write_prompt(prompt_path, blocks)
        sizes = [block_nbytes(block) for block in blocks if block.get("type") == "image"]
        if args.dry_run:
            print(f"DRY-RUN wrote {prompt_path} image_blocks={len(sizes)} max_image_block={max(sizes)}")
            return 0
        proc = subprocess.run(grok_argv(prompt_path, args.grok), text=True, capture_output=True, check=False)
        if proc.returncode != 0:
            detail = (proc.stderr or proc.stdout or "grok failed").strip().splitlines()
            tail = detail[-1] if detail else "grok failed"
            print(f"FAIL grok: {tail}")
            return 1
        code, line = decide(proc.stdout, args.threshold)
        print(line)
        return code
    except UsageError as exc:
        print(f"FAIL usage: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

# Visual judge

A gate **before** owner review. It is not the owner, and it does not replace owner review. A judge score never overrides a hard law (smoke, Hang, silhouette lock, magnification, white coat, or any other FAIL already written down).

The tool asks the local Grok Build CLI to look at one candidate still and 1–3 reference images, with the Golden rule and the rest of [`learn/taste.md`](../../learn/taste.md) in the prompt. It does not open a network connection and it does not read or embed an API key. `grok` uses whatever local session it already has.

```bash
python3 tools/judge/judge.py --candidate still.jpg --ref ref-a.jpg --dry-run --prompt-json /tmp/judge-prompt.json
python3 tools/judge/judge.py --candidate still.jpg --ref ref-a.jpg --ref ref-b.jpg
python3 tools/judge/judge.py --parse-reply reply.txt --threshold 7
```

Needs `pillow` and `opencv-python-headless`. No GPU.

## What it sends

`--dry-run` writes the prompt file and does not run `grok`. A live run writes that same file and executes:

```bash
grok -p --prompt-json <file>
```

The file is a JSON array of content blocks. Text blocks carry the Golden rule (the first section of `learn/taste.md`), the pass bar, and the full taste log. Each image is its own block:

```json
{"type": "image", "mimeType": "image/jpeg", "data": "<base64>"}
```

Each image block is at most **128 KiB** of compact JSON. Larger stills are downscaled (`INTER_AREA`) and JPEG-compressed until the block fits. The source file is not rewritten.

The model is asked for one JSON object and no markdown fence:

```json
{"score": 8, "keep": true, "defects": [], "matches_refs": true}
```

`score` is an integer from 1 to 10. `keep` and `matches_refs` are booleans. `defects` is an array of strings.

## Pass

Exit 0 only when the reply is that object and all of these hold:

- `score` ≥ threshold (default **7**, `--threshold`)
- `keep` is true
- `matches_refs` is true

| Exit | Meaning |
| --- | --- |
| 0 | `PASS score=N threshold=T` |
| 1 | `FAIL bad reply:` (the text is not the object) or `FAIL gate:` (parsed, below the bar) or `FAIL grok:` |
| 2 | Usage: missing files, not 1–3 refs, taste log has no Golden rule, registry hash mismatch |

`--parse-reply` runs the parser on a saved reply and does not build a prompt.

## References

Canonical stills are registered in [`references.json`](references.json) (`path`, `sha256`, `for`). How to add a row: [`references/README.md`](references/README.md). A `--ref` that matches a row must hash-match. A `--ref` that is not registered still runs, and the prompt says so. Paths under `lock/` are rejected. The rows now in the file are ice-hall stills, the relief plate, and the void-orbit ship skins. Howl is a video and is not registered.

## Selftest

```bash
python3 tools/judge/selftest.py
```

Offline. It builds a prompt from generated stills (including one oversized noise image), checks the 128 KiB cap and that the Golden rule is in the prompt, and parses a good reply (exit 0) and bad replies (exit 1). It does not call `grok`.

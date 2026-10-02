# Canonical reference images

`tools/judge/references.json` is the registry. It starts empty:

```json
{
  "references": []
}
```

A canonical reference is an owner-kept still. Register it before the judge treats that file as the reference for a design. An ad-hoc `--ref` path still runs; the prompt says it is not registered.

## Entry

Append one object. Do not delete an old entry. A replaced still is a new path and a new row.

| Field | Meaning |
| --- | --- |
| `path` | Repo-relative path to the image. Not under `lock/`. |
| `sha256` | SHA-256 hex of the file bytes. |
| `for` | What this image is the reference for. One sentence. |

```json
{
  "path": "packs/example/stills/ship-flank.jpg",
  "sha256": "<64 hex characters>",
  "for": "Black angular ship with purple lightning cracks."
}
```

Hash the bytes you are about to commit:

```bash
python3 -c "import hashlib,pathlib; print(hashlib.sha256(pathlib.Path('packs/example/stills/ship-flank.jpg').read_bytes()).hexdigest())"
```

`judge.py` resolves `path` from the repo root and checks `sha256` when a `--ref` matches a row. A mismatch stops the run. The judge does not hash a path that is not in the registry.

One judgment takes 1 to 3 reference images. Do not register a fourth view as a substitute for a silhouette lock. Orbit consistency stays `tools/objsheet`.

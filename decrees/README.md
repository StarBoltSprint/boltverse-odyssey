# Local decrees

`decrees.jsonl` is the owner's X decrees, one JSON object per line. It stays on the machine that has the export. It is not committed. This folder's `.gitignore` ignores `decrees.jsonl`.

```json
{"id": "184201", "date": "2026-09-12", "text": "…"}
```

A step reads it with:

```bash
python3 tools/decrees/brief.py --spec <step-spec.md> --step <step-dir> --kit <kit-id>
```

When the file is absent the brief says so and the step continues. Law and the fields: [`tools/decrees/README.md`](../tools/decrees/README.md).

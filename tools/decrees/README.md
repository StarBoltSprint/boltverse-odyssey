# tools/decrees

Before a step starts, search the owner's local X decrees and write a short brief into the step folder.

```bash
python3 tools/decrees/brief.py --spec <step-spec.md> --step <step-dir>
python3 tools/decrees/brief.py --spec <step-spec.md> --step <step-dir> --kit howling-eclipse --top 5
```

`--decrees` defaults to `decrees/decrees.jsonl`. One JSON object per line:

```json
{"id": "184201", "date": "2026-09-12", "text": "The night violet ship is the eclipse."}
```

`post_id` / `postId` and `posted_at` / `created_at` are accepted. The brief lists the top matches with post id, date, and a short quote. Keywords are words of four letters or more from the spec, plus `decreeHooks` when `--kit` is set.

A missing decrees file writes the brief anyway and exits 0. The brief says the file is absent. No decree is invented. The path is gitignored. See [`decrees/README.md`](../../decrees/README.md).

Exit **0** when `decree-brief.md` is written. Exit **2** when the spec is missing, the kit id is unknown, or `--top` is outside 1..20.

Fixture: [`fixture/`](fixture/). `python3 tools/decrees/selftest.py`.

This is the step START command in [`AGENTS.md`](../../AGENTS.md).

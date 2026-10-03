# Quota log

Append-only. One row per step. `python3 tools/quota/quota.py` adds the row. Do not rewrite an old row. A cell is `n/a` when the log did not carry that number.

| Date | Step | Commit | Turns | Tool calls | Image gens | Video gens | Tokens in | Tokens out | Wall s | Log |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-03 | zone-a-step1 | 6afb2a2 | 0 | 0 | 0 | 0 | n/a | n/a | 2973.3 | events.jsonl |

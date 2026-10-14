# Quota log

Append-only. One row per step. `python3 tools/quota/quota.py` adds the row. Do not rewrite an old row. A cell is `n/a` when the log did not carry that number.

| Date | Step | Commit | Turns | Tool calls | Image gens | Video gens | Tokens in | Tokens out | Wall s | Log |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-03 | zone-a-step1 | 6afb2a2 | 0 | 0 | 0 | 0 | n/a | n/a | 2973.3 | events.jsonl |
| 2026-10-03 | zone-a-step2c | 624f00c | 0 | 0 | 0 | 0 | n/a | n/a | 3639.0 | events.jsonl |
| 2026-10-03 | zone-a-step3-rocks | 5aae7e0 | 0 | 0 | 0 | 0 | n/a | n/a | 4010.6 | events.jsonl |
| 2026-10-04 | step4b | 6e5ddf0 | 0 | 321 | 0 | 0 | 705084 | 198072 | n/a | step04b-gate-20261004-075806.jsonl |
| 2026-10-04 | step4c | 1772cd8 | 0 | 0 | 0 | 0 | n/a | n/a | 3555.9 | events.jsonl |
| 2026-10-04 | archives-shards | a79d5e7 | 0 | 0 | 0 | 0 | n/a | n/a | 2790.1 | events.jsonl |
| 2026-10-04 | archives-polish | a6d14e0 | 0 | 223 | 0 | 0 | 496222 | 115012 | n/a | archives-polish-20261004-2036.jsonl |
| 2026-10-04 | archives-futurist | 2158259 | 0 | 223 | 0 | 0 | 339018 | 101368 | n/a | archives-futurist-20261004-2155.jsonl |
| 2026-10-04 | zone-a-perf | e70c6d3 | 0 | 0 | 0 | 0 | n/a | n/a | 3246.7 | events.jsonl |
| 2026-10-04 | tools-learn-20261004 | ece3195 | 0 | 0 | 0 | 0 | n/a | n/a | 2684.8 | events.jsonl |

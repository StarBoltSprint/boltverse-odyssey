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
| 2026-10-11 | fusion-1011 | fee89850 | 0 | 0 | 0 | 0 | n/a | n/a | 3740.6 | events.jsonl |
| 2026-10-11 | foundation-1011 | 3c066b73 | 0 | 0 | 0 | 0 | n/a | n/a | 1706.0 | events.jsonl |
| 2026-10-11 | fusion-fix3-1011 | n/a | 0 | 0 | 0 | 0 | n/a | n/a | 1431.0 | events.jsonl |
| 2026-10-11 | grok-native-1011 | n/a | 0 | 0 | 0 | 0 | n/a | n/a | 1606.7 | events.jsonl |
| 2026-10-11 | fusion-fix5-1011 | n/a | 0 | 0 | 0 | 0 | n/a | n/a | 3121.1 | events.jsonl |
| 2026-10-11 | placement-key2-1011 | 17b17182 | 0 | 212 | 0 | 0 | 362905 | 72562 | n/a | 20261011-120630-placement-key-1011.ndjson |
| 2026-10-11 | align-solve-1011 | 80bd09ad | 0 | 250 | 0 | 0 | 894168 | 207312 | n/a | 20261011-132508-tower-vision-1010.ndjson |
| 2026-10-11 | week2-1011 | n/a | 0 | 0 | 0 | 0 | n/a | n/a | 2614.7 | events.jsonl |
| 2026-10-11 | terrain-key2-1011 | 45e55fe7 | 0 | 0 | 0 | 0 | n/a | n/a | 2581.2 | events.jsonl |
| 2026-10-11 | scene-strict-1011 | n/a | 0 | 0 | 0 | 0 | n/a | n/a | 3097.5 | events.jsonl |
| 2026-10-11 | multiview-tower-1011 | 1a455361 | 0 | 0 | 0 | 0 | n/a | n/a | 4020.1 | events.jsonl |
| 2026-10-11 | steps/hires-tower-1011 | 5ac1d217 | 0 | 0 | 0 | 0 | n/a | n/a | 4288.7 | events.jsonl |
| 2026-10-11 | tower-sides-fix-1011 | bdc3ee8b89abce83f690cd7c2f86eb325c4b8eca | 0 | 0 | 0 | 0 | n/a | n/a | 3881.7 | events.jsonl |

Vision for tower-sides-fix-1011, commit bdc3ee8b: $0.011484, five calls, one round, cache `steps/tower-sides-fix-1011/vision-cache`, log `steps/tower-sides-fix-1011/vision.ndjson`. The session log did not carry token counts. Wall 3881.7 s is the events.jsonl span.
| 2026-10-12 | tower-fix3-1012 | n/a | 0 | 0 | 0 | 0 | n/a | n/a | 5230.2 | events.jsonl |
| 2026-10-12 | tower-volumes-1012 | n/a | 0 | 0 | 0 | 0 | n/a | n/a | 7749.4 | events.jsonl |

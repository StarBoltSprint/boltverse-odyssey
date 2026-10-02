# tools/quota

Reads one Grok CLI ndjson log and appends a row to [`learn/quota-log.md`](../../learn/quota-log.md).

```bash
python3 tools/quota/quota.py --log <session.ndjson> --step <name> --commit <sha> --date 2026-10-02
```

Counted when the line is JSON:

| Count | Lines |
| --- | --- |
| Turns | `type` / `event` / `kind` of `turn` or `assistant_turn`. If none, assistant `role` messages. |
| Tool calls | `tool_call`, `function_call`, or `tool`. |
| Image gens | type `image`, `image_generation`, `imagine_image`, or a tool name that is an image generation. |
| Video gens | type `video`, `video_generation`, `imagine_video`, or a tool name that is a video generation. |
| Tokens | `input_tokens` / `prompt_tokens` and `output_tokens` / `completion_tokens`, including under `usage`. Summed. `n/a` when absent. |
| Wall s | Last timestamp minus first. `ts`, `timestamp`, or `time`, unix seconds or ISO-8601. `n/a` when absent. |

A line that is not JSON is skipped. The log file is not modified. An existing quota row is not rewritten. Running the command twice appends two rows.

Exit **0** when the row is appended. Exit **2** when the log path is missing.

Fixture: [`fixture/session.ndjson`](fixture/session.ndjson). `python3 tools/quota/selftest.py`.

Run this at the end of an accepted step, after the gates. The step checklist is in [`AGENTS.md`](../../AGENTS.md).

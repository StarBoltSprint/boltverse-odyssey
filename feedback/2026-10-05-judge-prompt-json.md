# [tool-feedback] judge.py passes a file path to grok -p

- Tool: tools/judge
- Tool version / commit: `a1f1268` (`tools/judge/judge.py` unchanged on this branch).
- Take / branch + commit: `zone-a-3d-details` `a1f1268`, Echo Shard and small-detail lofts, 2026-10-05
- Defect seen on screen: none from this tool. The proof still is a faceted cluster. The judge never scored it.
- Tool metric vs measured: `python3 tools/judge/judge.py` exits 1 with `FAIL grok: For more information, try '--help'.` Measured: this `grok` (1.0.48) treats `-p` / `--single` as requiring a prompt string, so `grok -p --prompt-json <file>` consumes `--prompt-json` as that string and leaves the path as a stray argument. `--prompt-json` expects the JSON document, not a path. A direct `grok --prompt-json <json>` accepts 100000 bytes and raises `OSError: [Errno 7] Argument list too long` at 200000 bytes. `--dry-run` still writes the prompt (259369 bytes, 3 image blocks). `getconf ARG_MAX` is 2097152.
- Reproduce: `python3 tools/judge/judge.py --candidate /workspace/grokcli/out/zoneA/3d-details/detail-b.png --ref assets/relief/plate0.png --ref assets/relief/panorama-138.png`
- Still / screenshot: `/workspace/grokcli/out/zoneA/3d-details/detail-b.png`
- Short video: none
- Proposed fix: add a file form for the prompt JSON, or pass the file text without a leading `-p`. Keep each built document under about 100000 bytes so `exec` accepts it on this host. Keep `--dry-run` writing the same file.
- No secrets, API keys, tokens, or private style prompts: yes

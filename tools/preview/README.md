# Phone preview

After a step's gates pass, freeze the zone play page at that commit. The copy is a static folder. Open it on a phone over loopback. The script does not publish it.

```bash
python3 tools/preview/freeze.py \
  --zone zone-a \
  --commit <sha> \
  --report <step>/REPORT.md \
  --play-dir packs/zone-a/play \
  --walk <step>/playcheck/walk.mp4 \
  --out previews \
  --date 2026-10-02

python3 tools/preview/serve.py --root previews --port 8765
```

`REPORT` must say `Verdict: PASS`. `FAIL`, `WARN`, and `INCOMPLETE` do not freeze. `--play-dir` is the play tree to copy (the page at that commit). A path with a `lock/` segment is refused.

The freeze writes:

```text
previews/<zone>/<commit>/play/     the play page, as it was
previews/<zone>/<commit>/walk.mp4  when --walk was passed
previews/<zone>/<commit>/meta.json commit, date, verdict, publicUrl null
previews/<zone>/latest              symlink to <commit>
previews/<zone>/index.html          commit, date, REPORT verdict, walk.mp4 link
```

`serve` binds **127.0.0.1** only. `localhost` is accepted and bound to that same address. Any other host exits 2. There is no tunnel flag and no deploy flag.

`previews/` is gitignored. The folder is for the machine that cooked the step.

Exit **0** when the index is written or the server is listening. Exit **1** when the verdict is not PASS or the play tree is missing. Exit **2** on a bad invocation or a non-loopback host.

## After the owner says OK

The cook stops at the local index. The Director does this only after the owner has written an explicit OK that names this preview (a row in [`learn/taste.md`](../../learn/taste.md), or a sentence that says to publish that commit):

1. Serve the folder: `python3 tools/preview/serve.py --root previews`.
2. The owner opens `http://127.0.0.1:8765/<zone>/` on the phone and watches that commit's play page and `walk.mp4`.
3. The Director copies that version folder to the host the owner named in the OK.
4. The owner's words go in `learn/taste.md`. The OK is not inferred from a passing report.

`publicUrl` in `meta.json` stays null. This script never fills it.

"""Imagine request backend for the upgrade modules.

Our Imagine access is the Grok Build CLI (kit: /workspace/grokcli/kit, IMAGINE.md): `image_edit` (<= 3 sources, fixed
output size per aspect), `image_gen`, `reference_to_video` (480p/720p, 1-15 s), `image_to_video` (6/10 s).
Python cannot call Imagine directly, so every module emits `Request`s; a batch is executed by ONE headless Grok Build
step (run-step.sh, own worktree + tmux window) that calls the tools and copies each output byte-for-byte to `out`.

  python3 imagine.py run   <batch.json> [--worktree DIR] [--wait]   # launch the Grok Build step (needs a worktree)
  python3 imagine.py ingest <batch.json>                            # verify outputs + write provenance (sha256, size)
  python3 imagine.py prompt <batch.json>                            # print the step prompt (dry run)

Mode `plan` (default in selftests) never spends Imagine budget: it only writes the batch.
"""
import json, os, subprocess, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from i23d_common import IMAGINE_NATIVE, IMAGINE_MAX_SOURCES, provenance_record, dump

KIT = os.environ.get("I23D_KIT", "/workspace/grokcli/kit")


class Request(dict):
    """kind: edit | gen | video. refs: absolute paths (edit: 1..3, ordered: <IMAGE_1>, <IMAGE_2>, ...)."""
    def __init__(self, id, kind, prompt, out, refs=(), aspect=None, purpose="", meta=None, **video):
        refs = [os.path.abspath(r) for r in refs]
        if kind == "edit" and not (1 <= len(refs) <= IMAGINE_MAX_SOURCES):
            raise ValueError(f"{id}: image_edit takes 1..{IMAGINE_MAX_SOURCES} sources, got {len(refs)}")
        if aspect and aspect not in IMAGINE_NATIVE and kind != "video":
            raise ValueError(f"{id}: unknown aspect {aspect}")
        super().__init__(id=id, kind=kind, prompt=prompt, out=os.path.abspath(out), refs=refs, aspect=aspect,
                         purpose=purpose, meta=meta or {}, video=video or None)

    def expected_size(self):
        """Native output size. Single-source edits keep the source aspect (IMAGINE.md)."""
        if self.get("aspect"): return IMAGINE_NATIVE[self["aspect"]]
        return None


def write_batch(reqs, path, note=""):
    ids = [r["id"] for r in reqs]
    if len(set(ids)) != len(ids): raise ValueError("duplicate request ids")
    return dump(dict(note=note, created=time.strftime("%Y-%m-%d %H:%M"), requests=list(reqs)), path)


def step_prompt(batch):
    b = json.load(open(batch)) if isinstance(batch, str) else batch
    L = ["You are running an Imagine batch for the imagine-to-3d tool. Do EXACTLY these calls, in order, nothing else.",
         "Rules: never resize, crop, re-encode or post-process an output; copy the produced file byte-for-byte with `cp`",
         "to the `out` path (create the folder). If a call fails, retry it once, then write the error to `<out>.error.txt`.",
         "At the end print one JSON line: {\"done\": [ids], \"failed\": [ids]}.", ""]
    for r in b["requests"]:
        if r["kind"] == "edit":
            L.append(f"- id {r['id']}: image_edit(prompt={json.dumps(r['prompt'])}, image={json.dumps(r['refs'])}"
                     + (f", aspect_ratio=\"{r['aspect']}\"" if r.get("aspect") and len(r["refs"]) > 1 else "") + f") -> cp to {r['out']}")
        elif r["kind"] == "gen":
            L.append(f"- id {r['id']}: image_gen(prompt={json.dumps(r['prompt'])}, aspect_ratio=\"{r.get('aspect') or 'auto'}\") -> cp to {r['out']}")
        elif r["kind"] == "video":
            v = r.get("video") or {}
            L.append(f"- id {r['id']}: reference_to_video(prompt={json.dumps(r['prompt'])}, first_frame={json.dumps(r['refs'][0])}, "
                     f"aspect_ratio=\"{r.get('aspect') or '16:9'}\", duration={v.get('duration', 10)}, resolution_name=\"720p\") -> cp to {r['out']}")
    return "\n".join(L) + "\n"


def run(batch, worktree, wait=False):
    """Launch one Grok Build step (own tmux window, per-worktree lock; never touches other windows)."""
    spec = os.path.join(worktree, "spec.md")
    if not os.path.exists(spec):
        open(spec, "w").write("# Imagine batch step\nOnly run the Imagine calls listed in the prompt; edit nothing else.\n")
    pf = os.path.abspath(batch) + ".prompt.md"; open(pf, "w").write(step_prompt(batch))
    env = dict(os.environ, KIT_WAIT="1" if wait else "0", EFFORT=os.environ.get("EFFORT", "medium"))
    return subprocess.run([os.path.join(KIT, "run-step.sh"), worktree, spec, pf], env=env).returncode


def ingest(batch):
    """Check every output exists; record provenance (sha256 + native size). Returns (ok_ids, missing_ids)."""
    b = json.load(open(batch)); ok, missing = [], []
    for r in b["requests"]:
        if os.path.exists(r["out"]):
            rec = provenance_record(r["out"], request=r["id"]); r["provenance"] = rec
            exp = Request.expected_size(r) if r.get("aspect") else None
            r["nativeOk"] = exp is None or tuple(rec["size"]) == tuple(exp) or r["kind"] == "video"
            ok.append(r["id"])
        else: missing.append(r["id"])
    dump(b, batch)
    return ok, missing


if __name__ == "__main__":
    cmd, batch = sys.argv[1], sys.argv[2]
    if cmd == "prompt": print(step_prompt(batch))
    elif cmd == "ingest": print(json.dumps(dict(zip(("ok", "missing"), ingest(batch)))))
    elif cmd == "run":
        wt = sys.argv[sys.argv.index("--worktree") + 1] if "--worktree" in sys.argv else os.environ.get("I23D_IMAGINE_WT")
        if not wt: sys.exit("need --worktree (a git worktree of its own; run-step.sh refuses a busy one)")
        sys.exit(run(batch, wt, wait="--wait" in sys.argv))

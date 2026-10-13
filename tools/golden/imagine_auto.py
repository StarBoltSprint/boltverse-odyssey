#!/usr/bin/env python3
"""imagine-auto: generate the plates a step needs with NO human hand.

  python3 tools/golden/imagine_auto.py run --prompts prompts.json --out DIR [--backend grok|mock] [--only s1,s2] [--max N]
  python3 tools/golden/imagine_auto.py check --prompts prompts.json --out DIR      # exit 0 only when every slot exists

Backend `grok` drives Grok Build's built-in Imagine tools (image_gen / image_edit) headless:
`grok -p <prompt> --always-approve` (one call per plate, cwd = out dir). It NEVER uses the xAI API or an API key.
Backend `mock` (selftests, offline) draws a tiny image from the prompt hash; GOLDEN_MOCK_FAIL=slot,slot makes those fail.
Resumable: a slot whose <slot>.jpg|png already exists and opens as an image is skipped (status "kept").
prompts.json: {"slots":[{"slot":"sky-S00","prompt":"...","aspect":"16:9","refs":["/abs/key.jpg"]}, ...]}
(the output of tools/biome/prompts.py has this shape). Writes OUT/manifest.json (sha256, size, backend, seconds).
Exit 0 all present, 3 some failed, 2 bad input.
"""
import argparse, hashlib, json, os, re, shutil, subprocess, sys, time
from PIL import Image

EXTS = (".jpg", ".jpeg", ".png", ".webp")
SLOT_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
ASPECTS = {"auto", "1:1", "16:9", "9:16", "3:2", "2:3", "4:3", "3:4", "2:1", "1:2"}


def load_prompts(path):
    try: d = json.load(open(path))
    except Exception as e: raise ValueError(f"prompts file unreadable: {e}")
    slots = d.get("slots") if isinstance(d, dict) else d
    if not isinstance(slots, list) or not slots: raise ValueError("prompts file has no slots")
    seen = set()
    for s in slots:
        n = s.get("slot") if isinstance(s, dict) else None
        if not n or not SLOT_RE.match(n): raise ValueError(f"bad slot name: {n!r}")
        if n in seen: raise ValueError(f"duplicate slot: {n}")
        seen.add(n)
        if not str(s.get("prompt", "")).strip(): raise ValueError(f"{n}: empty prompt")
        if s.get("aspect", "auto") not in ASPECTS: raise ValueError(f"{n}: unknown aspect {s.get('aspect')}")
        for r in s.get("refs", []) or []:
            if not os.path.isfile(r): raise ValueError(f"{n}: missing ref {r}")
        if len(s.get("refs", []) or []) > 3: raise ValueError(f"{n}: image_edit takes at most 3 refs")
    return slots


def existing(out, slot):
    for e in EXTS:
        p = os.path.join(out, slot + e)
        if os.path.isfile(p):
            try:
                with Image.open(p) as im: im.verify()
                return p
            except Exception: pass
    return None


def sha(p): return hashlib.sha256(open(p, "rb").read()).hexdigest()


def gen_mock(s, out):
    if s["slot"] in os.environ.get("GOLDEN_MOCK_FAIL", "").split(","): raise RuntimeError("mock failure")
    # same family (sky-*, ground-*) -> same base colour, so a mock ring stitches cleanly; "mockColor" overrides
    h = bytes(s["mockColor"]) if s.get("mockColor") else hashlib.sha256(s["slot"].rsplit("-", 1)[0].encode()).digest()
    w, hh = {"16:9": (64, 36), "9:16": (36, 64), "2:1": (64, 32)}.get(s.get("aspect", "auto"), (48, 48))
    im = Image.new("RGB", (w, hh), tuple(h[:3]))
    for y in range(hh):  # vertical gradient: brighter at top, like a real sky plate
        for x in range(w): im.putpixel((x, y), tuple(max(0, c - y * 2) for c in h[:3]))
    p = os.path.join(out, s["slot"] + ".png"); im.save(p); return p


def grok_prompt(s, dest):
    refs = s.get("refs") or []
    call = (f"image_edit(prompt={json.dumps(s['prompt'])}, image={json.dumps(refs)}"
            + (f", aspect_ratio=\"{s.get('aspect','auto')}\"" if len(refs) > 1 else "") + ")") if refs else \
           f"image_gen(prompt={json.dumps(s['prompt'])}, aspect_ratio=\"{s.get('aspect','auto')}\")"
    return ("You run ONE Imagine call for an automated pipeline. Do exactly this and nothing else:\n"
            f"1. Call {call}\n"
            f"2. Copy the produced file byte-for-byte with `cp <returned path> {dest}` (keep its real extension: if it is .png use {dest[:-4]}.png).\n"
            "Never resize, crop, re-encode or edit anything else. Then print one line: DONE <path> or FAILED <reason>.\n")


def gen_grok(s, out, timeout):
    dest = os.path.join(out, s["slot"] + ".jpg")
    exe = os.environ.get("GROK_BIN") or shutil.which("grok") or os.path.expanduser("~/.local/bin/grok")
    cmd = [exe, "-p", grok_prompt(s, dest), "--always-approve", "--cwd", out]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    open(os.path.join(out, ".logs", s["slot"] + ".log"), "w").write(r.stdout[-8000:] + "\n--stderr--\n" + r.stderr[-4000:])
    p = existing(out, s["slot"])
    if not p: raise RuntimeError(f"grok exit {r.returncode}, no image written ({r.stdout.strip()[-200:]})")
    return p


def run(a):
    try: slots = load_prompts(a.prompts)
    except ValueError as e: print(f"[imagine-auto] BAD INPUT: {e}", file=sys.stderr); return 2
    if a.only: slots = [s for s in slots if s["slot"] in a.only.split(",")]
    os.makedirs(os.path.join(a.out, ".logs"), exist_ok=True)
    mp = os.path.join(a.out, "manifest.json")
    man = json.load(open(mp)) if os.path.exists(mp) else {"plates": {}}
    made = 0
    for s in slots:
        n = s["slot"]; p = existing(a.out, n)
        if p:
            rec = man["plates"].get(n) or {"backend": "pre-existing"}
            rec.update(status="kept", file=os.path.basename(p), sha256=sha(p)); man["plates"][n] = rec; continue
        if a.max is not None and made >= a.max:
            man["plates"][n] = {"status": "pending"}; continue
        t0 = time.time(); err = None
        for attempt in (1, 2):
            try:
                p = gen_mock(s, a.out) if a.backend == "mock" else gen_grok(s, a.out, a.timeout); err = None; break
            except Exception as e: err = str(e)
        if err: man["plates"][n] = {"status": "failed", "error": err, "backend": a.backend}
        else:
            with Image.open(p) as im: size = im.size
            man["plates"][n] = {"status": "made", "file": os.path.basename(p), "sha256": sha(p), "size": size,
                                "backend": a.backend, "seconds": round(time.time() - t0, 2), "prompt": s["prompt"]}
            made += 1
        print(f"[imagine-auto] {n}: {man['plates'][n]['status']}", flush=True)
        json.dump(man, open(mp, "w"), indent=1)
    names = [s["slot"] for s in slots]
    bad = [n for n in names if man["plates"].get(n, {}).get("status") not in ("made", "kept")]
    man.update(total=len(names), missing=bad, updated=time.strftime("%Y-%m-%d %H:%M:%S"))
    json.dump(man, open(mp, "w"), indent=1)
    print(f"[imagine-auto] {len(names)-len(bad)}/{len(names)} plates present -> {mp}")
    return 0 if not bad else 3


def check(a):
    try: slots = load_prompts(a.prompts)
    except ValueError as e: print(f"BAD INPUT: {e}", file=sys.stderr); return 2
    miss = [s["slot"] for s in slots if not existing(a.out, s["slot"])]
    print(json.dumps({"missing": miss})); return 0 if not miss else 3


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("cmd", choices=["run", "check"])
    ap.add_argument("--prompts", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--backend", default=os.environ.get("GOLDEN_IMAGINE", "grok"), choices=["grok", "mock"])
    ap.add_argument("--only"); ap.add_argument("--max", type=int); ap.add_argument("--timeout", type=int, default=600)
    a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
    sys.exit(run(a) if a.cmd == "run" else check(a))

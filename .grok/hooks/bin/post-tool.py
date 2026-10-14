#!/usr/bin/env python3
"""PostToolUse: (a) records reads of GROK.md / spec for the edit gate,
(b) delivers the pending re-injection reminder via additionalContext (documented to reach the model)."""
import json, os, sys
try:
    ev = json.load(sys.stdin)
except Exception:
    sys.exit(0)
root = os.environ.get("GROK_WORKSPACE_ROOT") or ev.get("workspaceRoot") or ev.get("cwd") or "."
sid = os.environ.get("GROK_SESSION_ID") or ev.get("sessionId") or "nosession"
st = os.path.join(root, ".grok", "kit-state", sid)
os.makedirs(st, exist_ok=True)
tool = ev.get("toolName") or ""
inp = ev.get("toolInput") or {}
spec = ""
try:
    spec = open(os.path.join(root, ".grok", "kit-spec-path")).read().strip()
except Exception:
    pass
def touch(n): open(os.path.join(st, n), "w").close()
if tool in ("read_file", "Read"):
    p = str(inp.get("path") or inp.get("target_file") or inp.get("file_path") or "")
    if p.endswith("GROK.md"):
        touch("read-GROK.md")
    if spec and (os.path.abspath(os.path.join(root, p)) == os.path.abspath(os.path.join(root, spec))):
        touch("read-spec")
    elif not spec and p.endswith("spec.md"):
        touch("read-spec")
pending = os.path.join(st, "reminder-pending")
if os.path.exists(pending):
    os.remove(pending)
    msg = ("Read spec.md and GROK.md before any edit"
           + (f" (spec for this take: {spec})" if spec else "") + ".")
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": msg}}))
sys.exit(0)

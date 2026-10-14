#!/usr/bin/env python3
"""PreToolUse guard for Grok Build CLI take steps.
1) Blocks git push / git merge / gh pr merge / force-push flags / +refspec / git reset --hard
   in any shell-like tool input.
2) Blocks file edits until GROK.md and the spec file were read in this session
   (state written by post-tool.py). Disable with KIT_EDIT_GATE=0.
Denies with stdout {"decision":"deny",...} AND exit 2 (both documented ways)."""
import json, os, re, sys

def deny(reason):
    print(json.dumps({"decision": "deny", "reason": reason}))
    sys.stderr.write(reason + "\n")
    sys.exit(2)

try:
    ev = json.load(sys.stdin)
except Exception:
    deny("guard: could not parse hook input; refusing to be safe")

tool = ev.get("toolName") or ev.get("tool_name") or ""
inp = ev.get("toolInput") or ev.get("tool_input") or {}
cmds = []
if isinstance(inp, dict):
    for k in ("command", "cmd", "script", "commands"):
        v = inp.get(k)
        if isinstance(v, str):
            cmds.append(v)
        elif isinstance(v, list):
            cmds += [x for x in v if isinstance(x, str)]

SEG = r"[^;&|\n]*"   # stay within one shell segment
RULES = [
    (rf"\bgit\b{SEG}\bpush\b", "git push is blocked in take steps (nothing may reach GitHub)"),
    (rf"\bgit\b{SEG}\bmerge\b", "git merge is blocked in take steps"),
    (rf"\bgh\b{SEG}\bpr\b{SEG}\bmerge\b", "gh pr merge is blocked"),
    (rf"\bgh\b{SEG}\bapi\b{SEG}/merge\b", "merging through gh api is blocked"),
    (rf"\bgit\b{SEG}\breset\b{SEG}--hard\b", "git reset --hard is blocked"),
    (rf"\bgit\b{SEG}(--force-with-lease|--force)\b", "git force flags are blocked"),
    (rf"\bgit\b{SEG}\bpush\b{SEG}\s(-[a-zA-Z]*f[a-zA-Z]*|\+\S+)", "force-push (-f / +refspec) is blocked"),
]
def unquote(c):
    # drop quoted strings (commit messages, echo text) so "push"/"merge" inside them do not trigger
    return re.sub(r"'[^']*'|\"(?:\\.|[^\"\\])*\"", "''", c)
for c in cmds:
    variants = [unquote(c)]
    if re.search(r"\b(ba|z|da)?sh\s+-\w*c\b|\beval\b|\bxargs\b|\bssh\b|\bpython3?\s+-c\b|\bnode\s+-e\b", c):
        variants.append(c.replace("'", " ").replace('"', " "))  # nested shell: inspect quoted text too
    for pat, why in RULES:
        if any(re.search(pat, v) for v in variants):
            deny(f"BLOCKED by kit guard: {why}. Command: {c[:200]}")

# ---- edit gate -------------------------------------------------------------
EDIT_TOOLS = {"search_replace", "write", "Edit", "Write", "MultiEdit", "write_file", "edit_file"}
if os.environ.get("KIT_EDIT_GATE", "1") != "0" and tool in EDIT_TOOLS:
    root = os.environ.get("GROK_WORKSPACE_ROOT") or ev.get("workspaceRoot") or ev.get("cwd") or "."
    sid = os.environ.get("GROK_SESSION_ID") or ev.get("sessionId") or "nosession"
    st = os.path.join(root, ".grok", "kit-state", sid)
    need = []
    if not os.path.exists(os.path.join(st, "read-GROK.md")):
        need.append("GROK.md")
    if not os.path.exists(os.path.join(st, "read-spec")):
        sp = ""
        try:
            sp = open(os.path.join(root, ".grok", "kit-spec-path")).read().strip()
        except Exception:
            pass
        need.append(sp or "spec.md")
    if need:
        deny("Read spec.md and GROK.md before any edit. Still unread in this session/after compaction: "
             + ", ".join(need) + " (use read_file).")
print(json.dumps({"decision": "allow"}))

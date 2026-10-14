#!/usr/bin/env bash
# SessionStart + PostCompact: re-arm the "read spec.md and GROK.md" rule.
# - clears the per-session read markers (edit gate closes again after compaction; KIT_REGATE_ON_COMPACT=0 keeps them)
# - sets reminder-pending, delivered by post-tool.py through PostToolUse additionalContext (the mechanism that works)
# - also prints the reminder on stdout (plain + JSON) in case a future CLI honours it
input=$(cat)
root="${GROK_WORKSPACE_ROOT:-$(pwd)}"; sid="${GROK_SESSION_ID:-nosession}"
st="$root/.grok/kit-state/$sid"; mkdir -p "$st"
ev="${GROK_HOOK_EVENT:-}"
if [ "$ev" = "session_start" ] || [ "${KIT_REGATE_ON_COMPACT:-1}" = "1" ]; then rm -f "$st/read-GROK.md" "$st/read-spec"; fi
touch "$st/reminder-pending"
echo "$(date -Is) $ev" >> "$st/events.log"
msg="Read spec.md and GROK.md before any edit."
name=SessionStart; [ "$ev" = "post_compact" ] && name=PostCompact
printf '{"hookSpecificOutput":{"hookEventName":"%s","additionalContext":"%s"}}\n' "$name" "$msg"
exit 0

#!/usr/bin/env bash
# golden run: ONE command, one key image -> playable 3D world, every stage timed, stops on the first gate FAIL.
#
#   bash tools/golden/run.sh <key-image> <zone-id> [--work DIR] [--prompts FILE] [--seed-plates DIR]
#                            [--imagine grok|mock|manual] [--imagine-max N] [--budget SECONDS] [--port N]
#
#   prompts -> imagine (imagine-auto) -> sky -> ground -> terrain (from key, 0 Imagine) -> objects -> placement
#   -> gate (budgets + every stage verdict) -> worldgraph (zone.v1 JSON) -> play (index.html + local URL)
# --seed-plates DIR  reuse existing plates (<slot>.jpg|png) before Imagine: those slots are skipped (resumable).
# --imagine manual   no generation: exits 10 with the missing slot list (old run-biome step-4 behaviour).
# Exit: 0 world ready, 1 gate FAIL (report printed + WORK/REPORT.md), 2 bad input, 3 Imagine failed, 10 manual wait.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
KEY="${1:-}"; ZONE="${2:-}"; [ -n "$KEY" ] && [ -n "$ZONE" ] || { sed -n 2,12p "$0"; exit 2; }; shift 2
WORK=""; PROMPTS=""; SEED=""; IMAGINE="${GOLDEN_IMAGINE:-grok}"; IMAX=""; BUDGET=480; PORT=8790
while [ $# -gt 0 ]; do case "$1" in
  --work) WORK="$2"; shift 2;; --prompts) PROMPTS="$2"; shift 2;; --seed-plates) SEED="$2"; shift 2;;
  --imagine) IMAGINE="$2"; shift 2;; --imagine-max) IMAX="$2"; shift 2;; --budget) BUDGET="$2"; shift 2;; --port) PORT="$2"; shift 2;;
  *) echo "unknown arg $1" >&2; exit 2;; esac; done
[ -f "$KEY" ] || { echo "key image not found: $KEY" >&2; exit 2; }
[[ "$ZONE" =~ ^[a-z0-9][a-z0-9-]{0,40}$ ]] || { echo "bad zone id: $ZONE" >&2; exit 2; }
WORK="${WORK:-$HERE/out/$ZONE}"; mkdir -p "$WORK/plates"; T="$WORK/timing.json"; rm -f "$T"
KEY="$(readlink -f "$KEY")"
S=(python3 "$HERE/stages.py"); A=(--work "$WORK" --key "$KEY" --zone "$ZONE" --port "$PORT")
report() { # $1 = failing stage
  python3 "$HERE/timing.py" summary "$T" --budget "$BUDGET" >/dev/null 2>&1
  python3 - "$WORK" "$1" <<'PY'
import json,os,sys,glob
w,stage=sys.argv[1],sys.argv[2]; L=[f"# Golden run: STOPPED at `{stage}`",""]
for g in sorted(glob.glob(os.path.join(w,"gates","*.json"))):
    d=json.load(open(g)); L.append(f"- {d['stage']}: **{d['verdict']}**")
    L+= [f"  - FAIL {c['name']} = {c['value']} (limit {c['limit']})"+(f" at {c['where']}" if c.get('where') else "") for c in d["checks"] if not c["ok"]]
t=json.load(open(os.path.join(w,"timing.json"))).get("summary",{}); L+=["",f"time so far: {t.get('totalSeconds')} s"]
open(os.path.join(w,"REPORT.md"),"w").write("\n".join(L)+"\n"); print("\n".join(L))
PY
}
stage() { # name [--imagine] -- cmd...
  local n="$1"; shift; local im=""; [ "${1:-}" = "--imagine" ] && { im="--imagine"; shift; }
  printf '\n== %s\n' "$n"; python3 "$HERE/timing.py" start "$T" "$n"
  "$@"; local rc=$?
  python3 "$HERE/timing.py" end "$T" "$n" --status "$([ $rc -eq 0 ] && echo ok || echo fail)" $im
  if [ $rc -ne 0 ]; then report "$n"; exit $([ "$n" = imagine ] && { [ $rc -eq 10 ] && echo 10 || echo 3; } || { [ $rc -eq 2 ] && echo 2 || echo 1; }); fi
}
seed() { [ -n "$SEED" ] || return 0; for f in "$SEED"/*; do b=$(basename "$f"); [ -f "$f" ] && [ ! -e "$WORK/plates/$b" ] && { ln "$f" "$WORK/plates/$b" 2>/dev/null || ln -s "$(readlink -f "$f")" "$WORK/plates/$b"; }; done; return 0; }
imagine() {
  seed
  if [ "$IMAGINE" = manual ]; then python3 "$HERE/imagine_auto.py" check --prompts "$WORK/prompts.json" --out "$WORK/plates" && return 0
    echo "   manual: save <slot>.jpg into $WORK/plates (prompts: $WORK/prompts.json), then rerun"; return 10; fi
  python3 "$HERE/imagine_auto.py" run --prompts "$WORK/prompts.json" --out "$WORK/plates" --backend "$IMAGINE" ${IMAX:+--max "$IMAX"}
}
stage prompts   "${S[@]}" prompts "${A[@]}" ${PROMPTS:+--prompts "$PROMPTS"}
stage imagine --imagine imagine
for st in sky ground terrain objects placement gate worldgraph play; do stage "$st" "${S[@]}" "$st" "${A[@]}"; done
printf '\n== summary\n'; python3 "$HERE/timing.py" summary "$T" --budget "$BUDGET"; RC=$?
echo "zone JSON: $WORK/zone.json"; echo "play: $(cat "$WORK/PLAY_URL.txt")  (serve: python3 -m http.server $PORT -d $WORK)"
exit 0

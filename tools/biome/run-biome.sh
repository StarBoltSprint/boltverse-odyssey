#!/usr/bin/env bash
# run-biome.sh - one biome, one chain: bible -> prompts -> manifest -> [Imagine step] -> qc -> stitch -> bake -> pack.
#
#   bash tools/biome/run-biome.sh <id> [--lore "..."] [--player "..."] [--seed N] [--archetype A]
#                                 [--inbox DIR] [--slots DIR] [--partial] [--no-bake] [--blender PATH]
#
#   1 fill      tools/biome/biomes/<id>.json (+ .local.json) - only when the bible does not exist yet
#   2 prompts   out/<id>/prompts.json + prompts.md (every slot, style block + avoid list, cache keys)
#   3 manifest  hit / miss against the catalogue; --inbox DIR ingests DIR/<slot>.png first
#   4 IMAGINE   manual / external step (this script never calls Imagine or Grok, never spends credit):
#               generate the missing slots from prompts.md - the key still FIRST - save them as <slot>.png in an
#               inbox, rerun with --inbox. Stops here (exit 10) while slots miss, unless --partial.
#   5 qc        anchor sampled from the key still, then every plate: pass | lut (graded copy) | regenerate | fallback
#   6 stitch    sky-H* + sky-Z + sky-N -> 2:1 equirect (+ horizon band); horizon + fog bands written back
#   7 bake      one carved, displaced, LOD'd GLB per object with views (Blender headless, CPU)
#   8 pack      KTX2 (ETC1S; UASTC for the hero) when toktx / basisu exist, else listed and skipped
# --slots DIR skips 3-4 and reads <slot>.<ext> from DIR (selftests, re-runs of existing plates: no credit).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ID="${1:?biome id}"; shift
LORE=""; PLAYER="I want to explore"; SEED=1; ARCH=""; INBOX=""; SLOTS=""; PARTIAL=0; BAKE=1
BLENDER="${BLENDER:-$(command -v blender || echo /home/box/.local/bin/blender)}"
while [ $# -gt 0 ]; do
  case "$1" in
    --lore) LORE="$2"; shift 2;; --player) PLAYER="$2"; shift 2;; --seed) SEED="$2"; shift 2;;
    --archetype) ARCH="--archetype $2"; shift 2;; --inbox) INBOX="$2"; shift 2;; --slots) SLOTS="$2"; shift 2;;
    --partial) PARTIAL=1; shift;; --no-bake) BAKE=0; shift;; --blender) BLENDER="$2"; shift 2;;
    *) echo "unknown arg $1" >&2; exit 2;;
  esac
done
OUT="$HERE/out/$ID"; mkdir -p "$OUT"
say() { printf '\n== %s\n' "$*"; }

say "1 bible"
if [ ! -f "$HERE/biomes/$ID.json" ]; then
  [ -z "$LORE" ] && { echo "no bible for $ID: pass --lore (and --player) to fill it" >&2; exit 2; }
  python3 "$HERE/fill_bible.py" --id "$ID" --lore "$LORE" --player "$PLAYER" --seed "$SEED" $ARCH --split
else
  echo "bible exists: biomes/$ID.json$( [ -f "$HERE/biomes/$ID.local.json" ] && echo ' + local' || echo ' (NO local file: placeholders)')"
fi

say "2 prompts"
python3 "$HERE/prompts.py" --biome "$ID" --md

if [ -z "$SLOTS" ]; then
  say "3 manifest"
  python3 "$HERE/manifest.py" --biome "$ID" ${INBOX:+--ingest "$INBOX"}
  SLOTS="$OUT/slots"
  MISS=$(python3 -c "import json;print(json.load(open('$OUT/manifest.json'))['misses'])")
  KEYMISS=$(python3 -c "import json;m=json.load(open('$OUT/manifest.json'));print(int(any(r['slot']=='key' and r['status']!='hit' for r in m['slots'])))")
  if [ "$MISS" != "0" ]; then
    say "4 IMAGINE STEP (manual / external, $MISS slots) - prompts: $OUT/prompts.md"
    [ "$KEYMISS" = "1" ] && echo "   the key still (slot 'key') comes FIRST: everything else is checked against it."
    [ $PARTIAL -eq 0 ] && { echo "   save <slot>.png into an inbox, then: $0 $ID --inbox <dir>"; exit 10; }
  fi
else
  say "3-4 skipped: using existing plates in $SLOTS"
fi

say "5 qc"
KEY=$(ls "$SLOTS"/key.* 2>/dev/null | head -1 || true)
if [ -n "$KEY" ]; then python3 "$HERE/qc.py" anchor --biome "$ID" --image "$KEY"; else echo "no key still: targets from the bible palette"; fi
python3 "$HERE/qc.py" check --biome "$ID" --slots "$SLOTS" --apply
# final plates = graded copy when qc chose 'lut', else the original (regenerate / fallback stay listed in the report)
FINAL="$OUT/final"; rm -rf "$FINAL"; mkdir -p "$FINAL"
for f in "$SLOTS"/*; do [ -f "$f" ] && ln -f "$(readlink -f "$f")" "$FINAL/$(basename "$f")" 2>/dev/null || cp "$(readlink -f "$f")" "$FINAL/"; done
if [ -d "$OUT/graded" ]; then for g in "$OUT/graded"/*.png; do [ -f "$g" ] || continue; s=$(basename "${g%.png}"); rm -f "$FINAL/$s".*; cp "$g" "$FINAL/"; done; fi

say "6 sky"
if [ "$(ls "$FINAL"/sky-H* 2>/dev/null | wc -l)" -ge 3 ]; then
  python3 "$HERE/stitch_sky.py" --biome "$ID" --slots "$FINAL" --write-back
else echo "fewer than 3 sky-H plates: skipped"; fi

say "7 bake"
if [ $BAKE -eq 1 ]; then
  for oid in $(python3 -c "import sys;sys.path.insert(0,'$HERE');import biome_lib as b;print(' '.join(o['id'] for o in b.load_biome('$ID')[0].get('objects',[])))"); do
    if ls "$FINAL"/obj-$oid-front.* >/dev/null 2>&1; then
      "$BLENDER" --background --factory-startup --python "$HERE/bake_hull.py" -- --biome "$ID" --object "$oid" --slots "$FINAL" --out "$OUT/bake/$oid" 2>&1 | grep -E '^\[bake_hull\] (DONE|.*_s:)' || true
    else echo "obj $oid: no front view yet - skipped"; fi
  done
else echo "--no-bake"; fi

say "8 pack"
[ -d "$OUT/sky" ] && bash "$HERE/pack-ktx2.sh" "$OUT/sky" "$OUT/ktx2/sky" --allow-missing | tail -1
for d in "$OUT"/bake/*/; do [ -d "$d" ] && bash "$HERE/pack-ktx2.sh" "$d" "$OUT/ktx2/$(basename "$d")" --uastc hero_albedo --allow-missing | tail -1; done
say "done: $OUT (qc-report.json, sky/, bake/, ktx2/)"

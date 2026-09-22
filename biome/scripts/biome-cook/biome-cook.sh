#!/usr/bin/env bash
# biome-cook.sh — ordered checklist. Wraps hung QC scripts. No new math.
# Exit code is the real script's exit code when args are given.
# No plate args on geo|hazard|mae → usage + exit 2 (never a fake PASS).

set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIOME="$(cd "$HERE/../.." && pwd)"

GEO="$BIOME/scripts/plate-geo-qc/plate-geo-qc.py"
HAZ="$BIOME/scripts/plate-hazard-qc/plate-hazard-qc.py"
MAE="$BIOME/scripts/plate-mae-qc/plate-mae-qc.py"
SCALE="$BIOME/scripts/bolt-scale"
CLOCK="$BIOME/scripts/gallop-clock"
DESPILL="$BIOME/scripts/chroma-despill"
CURVE="$BIOME/scripts/curvature-sample"
GPU="$BIOME/scripts/bolt-key-gl"
HOWL="$BIOME/scripts/howl-live"
KEEP="$BIOME/fx/howl/howl-attack.mp4"

print_steps() {
  cat <<'EOF'
biome-cook — steps 1→17 (PRIORITY 0 section C + laws through 34)
Hang ≠ wipe. Do not invent QC math. Noun is biome-variable. Math is fixed.
Read biome/scripts/biome-cook/README.md. Paste biome/docs/COLD_START-biome-cook.md.
Play URL hang = Live only, never a Build convo, never grok.com/share, never /c/.
Worked example (play URL only): https://boltboltverse-odyssey.grok.me

 1  Teacher gate. Show lock/bolt-back.jpg + lock/bolt-gallop-cycle.mp4.
    Law: biome/docs/10-bolt-cutout-law.md
 2  10-plate sprint plan BEFORE d1.
    Law: biome/docs/26-biome-sprint-plan.md
 3  Empty still, ZERO dog, law 20 measures. Stills 28–31.
    Law: biome/docs/20-default-plate-proportions.md
         biome/docs/28-stills-two-rails.md
         biome/docs/29-imagine-compiler.md
         biome/docs/30-i2i-prompt.md
         biome/docs/31-light-lock.md
    Prompt: biome/prompts/image-empty-plate.txt
 4  Next plate refs (law 22-m). Success +1 @ ref. Miss drops one.
    Law: biome/docs/22-m-densify-snowball.md
    Prompt: biome/prompts/snowball-refs.txt
 5  Video A empty rush, 48 fps. Frost: no setpts 2.7× warp.
    Law: biome/docs/08-plate-speed.md · biome/docs/02-videos.md
    Prompt: biome/prompts/video-empty-plate.txt
 6  Law 23 geo qc PASS before hang. Camera = law 24.
    Law: biome/docs/23-plate-geo-qc.md · biome/docs/24-camera-1point.md
    Script: biome/scripts/plate-geo-qc/plate-geo-qc.py
    Prompt: biome/prompts/camera-1point.txt
    Run: biome-cook.sh geo <plate.mp4>
 7  REUSE cycle → key + despill (13c). Lane chart = curvature-sample (12).
    Law: biome/docs/13c-green-despill.md · biome/docs/12-lane-path-ribbon.md
    Script: biome/scripts/chroma-despill/ · biome/scripts/curvature-sample/
    Run: biome-cook.sh despill · biome-cook.sh curvature
 8  computeScale / assertScale (13d). Do not grow Bolt on a wide road.
    Law: biome/docs/13d-auto-scale.md
    Script: biome/scripts/bolt-scale/
    Run: biome-cook.sh scale
 9  Wire GPU. Copy bolt-key-gl.ts + wet-fx.ts. GPU_VER 24. FAIL = scissor sketch.
    Law: biome/docs/15-gpu-compositor.md · biome/docs/17-live-compositor.md · biome/docs/22-gpu24-frost-keep.md
    Script: biome/scripts/bolt-key-gl/
    Run: biome-cook.sh gpu
10  gallop-clock (14c). Native 96 fps. Loop 1×.
    Law: biome/docs/14c-gallop-clock.md
    Script: biome/scripts/gallop-clock/
    Run: biome-cook.sh clock
11  Plate IBL + bounce (law 22) + dual-paw contact (13b) + FX row (16).
    Law: biome/docs/22-gpu24-frost-keep.md · biome/docs/13b-anti-sticker-contact.md · biome/docs/16-biome-ground-fx.md
    Script: biome/scripts/bolt-key-gl/wet-fx.ts
12  Hazards. Law 25 PASS. Rail A = dodge.
    Law: biome/docs/25-hazard-cone.md
    Script: biome/scripts/plate-hazard-qc/plate-hazard-qc.py
    Run: biome-cook.sh hazard --ref <empty.mp4> --expect 1 <dN.mp4>
13  Law 32 Howl plates only if the plan names a GPU target. REUSE the KEEP mp4.
    Law: biome/docs/32-howl-gpu-targets.md
    KEEP: biome/fx/howl/howl-attack.mp4
14  LAW 34 HARD — Howl live aim.
    Law: biome/docs/34-howl-live-aim.md
    Copy:
      biome/scripts/howl-live/howlLive.js    howlFireSec, howlFxBeam, howlStep, cut-on-contact, shatter swap
      biome/scripts/howl-live/howlWet.glsl   wet GPU (luma key + plate bounce + road sit)
      biome/scripts/howl-live/demo.js
      biome/fx/howl/howl-attack.mp4          REUSE. Do not recook. Do not shader rings.
    Run: biome-cook.sh howl
    Noun is biome-variable. Math is fixed. BAN laser / homemade rings / dogs.
15  Law 33 seam PASS. Last N vs first N+1. Exit non-zero = recook.
    Law: biome/docs/33-plate-mae-qc.md
    Script: biome/scripts/plate-mae-qc/plate-mae-qc.py
    Run: biome-cook.sh mae <N.mp4> <N+1.mp4>
16  Hang ≠ wipe + Pack auto-embed + bump GPU_VER.
    Law: biome/docs/09-recette-biome.md · biome/docs/07-pack-live.md
    BOLTVERSE_PACK_ORIGIN=https://boltverse-pack.vercel.app
17  Smoke. dogFps near the plate. Hind paws. No vertical bars. No neon through the coat.
    Sharp interior. Shadow on the road. FX on the plant. Old biomes still hung.

Law 27 (biome/docs/27-native-road-slide.md) is optional. Not a default step.
EOF
}

print_usage() {
  cat <<'EOF'

Usage (wrapper — exit code comes from the real script):
  biome-cook.sh                         print steps 1→17
  biome-cook.sh steps
  biome-cook.sh geo <plate.mp4> [...] [--json]
  biome-cook.sh hazard --ref <empty.mp4> --expect 1 <dN.mp4>
  biome-cook.sh mae <N.mp4> <N+1.mp4> [...] [--json]
  biome-cook.sh scale                   node biome/scripts/bolt-scale/demo.js
  biome-cook.sh clock                   node biome/scripts/gallop-clock/demo.js
  biome-cook.sh despill                 node biome/scripts/chroma-despill/demo.js
  biome-cook.sh curvature               node biome/scripts/curvature-sample/demo.js
  biome-cook.sh howl                    node biome/scripts/howl-live/demo.js   (law 34)
  biome-cook.sh gpu                     echo copy paths (law 22 / GPU 24). No cook.

Examples copied from the hung READMEs:
  python3 biome/scripts/plate-geo-qc/plate-geo-qc.py road-frost.mp4
  python3 biome/scripts/plate-hazard-qc/plate-hazard-qc.py --ref road-frost.mp4 --expect 1 d2.mp4
  python3 biome/scripts/plate-mae-qc/plate-mae-qc.py road-N.mp4 road-N1.mp4
  node biome/scripts/bolt-scale/demo.js
  node biome/scripts/gallop-clock/demo.js
  node biome/scripts/chroma-despill/demo.js
  node biome/scripts/curvature-sample/demo.js
  node biome/scripts/howl-live/demo.js
EOF
}

need_args() {
  local name="$1"
  shift
  echo "biome-cook: ${name} needs the real script's arguments. No fake PASS." >&2
  printf '  %s\n' "$@" >&2
  exit 2
}

run_node_demo() {
  local dir="$1"
  shift
  if [[ ! -f "$dir/demo.js" ]]; then
    echo "biome-cook: missing $dir/demo.js" >&2
    exit 2
  fi
  (cd "$dir" && exec node demo.js "$@")
}

cmd="${1:-steps}"
if [[ $# -gt 0 ]]; then
  shift
fi

case "$cmd" in
  steps|help|-h|--help)
    print_steps
    print_usage
    exit 0
    ;;
  geo)
    if [[ $# -lt 1 ]]; then
      need_args geo \
        "python3 biome/scripts/plate-geo-qc/plate-geo-qc.py road-frost.mp4" \
        "python3 biome/scripts/plate-geo-qc/plate-geo-qc.py --json empty.mp4 d1.mp4"
    fi
    exec python3 "$GEO" "$@"
    ;;
  hazard)
    if [[ $# -lt 1 ]]; then
      need_args hazard \
        "python3 biome/scripts/plate-hazard-qc/plate-hazard-qc.py --ref road-frost.mp4 --expect 0 d1.mp4" \
        "python3 biome/scripts/plate-hazard-qc/plate-hazard-qc.py --ref road-frost.mp4 --expect 1 d2.mp4"
    fi
    exec python3 "$HAZ" "$@"
    ;;
  mae)
    if [[ $# -lt 1 ]]; then
      need_args mae \
        "python3 biome/scripts/plate-mae-qc/plate-mae-qc.py road-N.mp4 road-N1.mp4" \
        "python3 biome/scripts/plate-mae-qc/plate-mae-qc.py --json a.mp4 b.mp4 c.mp4"
    fi
    exec python3 "$MAE" "$@"
    ;;
  scale)
    run_node_demo "$SCALE" "$@"
    ;;
  clock)
    run_node_demo "$CLOCK" "$@"
    ;;
  despill)
    run_node_demo "$DESPILL" "$@"
    ;;
  curvature)
    run_node_demo "$CURVE" "$@"
    ;;
  howl)
    echo "law 34 — copy biome/scripts/howl-live/howlLive.js + howlWet.glsl" >&2
    echo "law 34 — REUSE $KEEP (do not recook)" >&2
    run_node_demo "$HOWL" "$@"
    ;;
  gpu)
    cat <<EOF
law 22 / GPU 24 — copy, do not recook:
  $GPU/bolt-key-gl.ts
  $GPU/wet-fx.ts
  $GPU/WIRE.md
FAIL to copy: $GPU/bolt-key-gl-scissor-prev.ts
Law: biome/docs/22-gpu24-frost-keep.md
      biome/docs/17-live-compositor.md
      biome/docs/15-gpu-compositor.md
EOF
    exit 0
    ;;
  *)
    echo "biome-cook: unknown step '$cmd'" >&2
    print_usage >&2
    exit 2
    ;;
esac

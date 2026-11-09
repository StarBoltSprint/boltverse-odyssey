#!/bin/sh
# Remove only the breath page files, and only when each hash still matches.
# Usage: uninstall.sh /workspace/biome-futur/webgpu-ground
set -eu
ROOT=${1:?usage: uninstall.sh /workspace/biome-futur/webgpu-ground}
HERE=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
cd "$HERE"
while read -r sha dest; do
  [ -n "$sha" ] || continue
  case "$sha" in \#*) continue ;; esac
  case "$dest" in
    m448aaa3.html|m448aaa3.js|m448aaa3-diag.html|m448aaa3-diag.js|engine/bricks/frame-diag.js|m448aaa3-pace.html|m448aaa3-pace.js|engine/bricks/sim-pace.js|m448aaa3-prof.html|m448aaa3-prof.js|engine/bricks/pass-timer.js|m448aaa3-cull.html|m448aaa3-cull.js|engine/bricks/grass-offscreen.js|m448aaa3-occl.html|m448aaa3-occl.js|bricks/bolt-idle.js)
      echo "REFUSE $dest" >&2
      exit 3
      ;;
  esac
  out="$ROOT/$dest"
  if [ ! -f "$out" ]; then
    echo "absent $dest"
    continue
  fi
  have=$(sha256sum "$out" | awk '{print $1}')
  if [ "$have" != "$sha" ]; then
    echo "SKIP hash differs, left in place: $dest" >&2
    exit 1
  fi
  rm "$out"
  echo "removed $dest"
done < manifest.sha256
echo "ROLLED BACK"

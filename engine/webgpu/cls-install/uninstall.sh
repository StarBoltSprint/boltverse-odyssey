#!/bin/sh
# Remove only the draw-class page, and only while its hash still matches.
# Usage: uninstall.sh /workspace/biome-futur/webgpu-ground
set -eu
ROOT=${1:?usage: uninstall.sh /workspace/biome-futur/webgpu-ground}
HERE=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
cd "$HERE"
while read -r sha dest; do
  [ -n "$sha" ] || continue
  case "$sha" in \#*) continue ;; esac
  f="$ROOT/$dest"
  if [ ! -f "$f" ]; then
    echo "absent $dest"
    continue
  fi
  have=$(sha256sum "$f" | awk '{print $1}')
  if [ "$have" != "$sha" ]; then
    echo "REFUSE to delete $dest (hash differs)" >&2
    exit 1
  fi
  rm "$f"
  echo "removed $dest"
done < manifest.sha256
echo "REMOVED"

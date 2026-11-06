#!/bin/sh
# Add only the grass-cull preview. Does not replace normal, diag, pace, or prof.
# Usage: install.sh /workspace/biome-futur/webgpu-ground
set -eu
ROOT=${1:?usage: install.sh /workspace/biome-futur/webgpu-ground}
HERE=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
cd "$HERE"

deny() {
  case "$1" in
    m448aaa3.html|m448aaa3.js|m448aaa3-diag.html|m448aaa3-diag.js|engine/bricks/frame-diag.js|m448aaa3-pace.html|m448aaa3-pace.js|engine/bricks/sim-pace.js|m448aaa3-prof.html|m448aaa3-prof.js|engine/bricks/pass-timer.js)
      echo "REFUSE to write $1" >&2
      exit 3
      ;;
  esac
}

echo "check guards (read only)"
while read -r sha dest; do
  [ -n "$sha" ] || continue
  case "$sha" in \#*) continue ;; esac
  f="$ROOT/$dest"
  if [ ! -f "$f" ]; then
    echo "GUARD MISSING $dest" >&2
    exit 2
  fi
  have=$(sha256sum "$f" | awk '{print $1}')
  if [ "$have" != "$sha" ]; then
    echo "GUARD HASH MISMATCH $dest" >&2
    echo "  have $have" >&2
    echo "  want $sha" >&2
    exit 2
  fi
  echo "guard ok $dest"
done < baseline.sha256

echo "preflight new files"
while read -r sha dest; do
  [ -n "$sha" ] || continue
  case "$sha" in \#*) continue ;; esac
  deny "$dest"
  src="$HERE/files/$dest"
  out="$ROOT/$dest"
  if [ ! -f "$src" ]; then
    echo "BUNDLE MISSING $src" >&2
    exit 4
  fi
  got=$(sha256sum "$src" | awk '{print $1}')
  if [ "$got" != "$sha" ]; then
    echo "BUNDLE TAMPER $dest" >&2
    exit 4
  fi
  if [ -f "$out" ]; then
    have=$(sha256sum "$out" | awk '{print $1}')
    if [ "$have" != "$sha" ]; then
      echo "COLLISION $dest" >&2
      echo "  have $have" >&2
      echo "  want $sha" >&2
      exit 1
    fi
  fi
done < manifest.sha256
echo "install new files"
while read -r sha dest; do
  [ -n "$sha" ] || continue
  case "$sha" in \#*) continue ;; esac
  deny "$dest"
  out="$ROOT/$dest"
  if [ -f "$out" ]; then
    echo "same $dest"
  else
    mkdir -p "$(dirname "$out")"
    cp "$HERE/files/$dest" "$out"
    echo "added $dest"
  fi
done < manifest.sha256
echo "INSTALLED"
echo "open /m448aaa3-cull.html"

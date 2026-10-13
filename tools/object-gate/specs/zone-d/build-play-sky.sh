#!/usr/bin/env bash
# Assemble the Zone D terrace play build (spine camera + sky dome + meshopt LODs) into $OUT. Licences: gltfpack/meshoptimizer MIT, three.js MIT.
# usage: build-play-sky.sh <OUT dir> [<play assets dir, default /workspace/zd-play-1012>] [<sky pack dir>]
set -euo pipefail
OUT=$1; SRC=${2:-/workspace/zd-play-1012}; SKY=${3:-/workspace/zd-bible-1012/zd-plates/sky12/ktx2-final5-mip1-star}
HERE=$(cd "$(dirname "$0")" && pwd); TMP=$(mktemp -d); mkdir -p "$OUT/assets" "$OUT/jsm/libs"
( cd "$TMP" && npm init -y >/dev/null && npm i --silent gltfpack@1.3.0 three@0.160.0 )
for i in 0 1 2; do   # images stripped (page maps plates by material name), meshopt + quantization: pos 16 bit, uv 14 bit, keep names/materials/attrs
  python3 "$HERE/strip-glb-images.py" "$SRC/assets/terrace-lod$i.glb" "$TMP/s$i.glb"
  "$TMP/node_modules/.bin/gltfpack" -i "$TMP/s$i.glb" -o "$OUT/assets/terrace-lod$i.glb" -cc -vp 16 -vt 14 -kv -km -kn
done
cp "$TMP/node_modules/three/examples/jsm/libs/meshopt_decoder.module.js" "$OUT/jsm/libs/"
ln -sfn "$SRC/jsm/loaders" "$OUT/jsm/loaders"; ln -sfn "$SRC/jsm/utils" "$OUT/jsm/utils"
ln -sf "$SRC/three.module.js" "$SRC/placement.json" "$OUT/"
for j in plate-front-v35.jpg t1-right-v35.jpg plate-side-v35.jpg top.jpg plate-front.jpg t1-right.jpg plate-side.jpg; do ln -sf "$SRC/assets/$j" "$OUT/assets/$j"; done
ln -sfn "$SKY" "$OUT/sky"   # pack used as-is (mip 0 + mip 1, never regenerated)
ln -sf "$HERE/play-index.html" "$OUT/index.html"
for f in upscale-easu.mjs adaptive-res.mjs sky-dome.mjs spine.v1.2.json bluenoise64.png sky-band-colours.json; do ln -sf "$HERE/$f" "$OUT/$f"; done
rm -rf "$TMP"; echo "built $OUT"

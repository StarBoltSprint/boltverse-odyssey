#!/usr/bin/env bash
# pack-ktx2.sh - GPU-compressed textures for the phone (Grok chat answer 4: KTX2, ETC1S for repeated props / sky /
# ground, UASTC only for the hero (Anchor) and Bolt; mipmaps in the file, sRGB).
#
#   bash tools/biome/pack-ktx2.sh IN_DIR OUT_DIR [--uastc name1,name2] [--allow-missing]
#
# Encoder order: toktx (KTX-Software) > basisu (Basis Universal). Neither is installed on the box by default; with
# --allow-missing the script lists what it would encode and exits 0 (the chain keeps the JPEG/PNG files), otherwise
# it exits 3 with install hints:
#   KTX-Software: https://github.com/KhronosGroup/KTX-Software/releases  (toktx)
#   basisu:       https://github.com/BinomialLLC/basis_universal/releases
# GLB textures: gltf-transform (npm @gltf-transform/cli) `gltf-transform etc1s in.glb out.glb` also needs toktx.
set -euo pipefail
IN="${1:?IN_DIR}"; OUT="${2:?OUT_DIR}"; shift 2
UASTC=""; ALLOW=0
while [ $# -gt 0 ]; do
  case "$1" in
    --uastc) UASTC="$2"; shift 2;;
    --allow-missing) ALLOW=1; shift;;
    *) echo "unknown arg $1" >&2; exit 2;;
  esac
done
mkdir -p "$OUT"
ENC=""
command -v toktx >/dev/null 2>&1 && ENC=toktx
[ -z "$ENC" ] && command -v basisu >/dev/null 2>&1 && ENC=basisu
mapfile -t FILES < <(find "$IN" -maxdepth 1 -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' \) | sort)
[ ${#FILES[@]} -eq 0 ] && { echo "[ktx2] no png/jpg in $IN"; exit 0; }
is_uastc() { local b; b="$(basename "${1%.*}")"; [[ ",$UASTC," == *",$b,"* ]]; }
report="$OUT/ktx2-report.txt"; : > "$report"
if [ -z "$ENC" ]; then
  echo "[ktx2] no encoder (toktx / basisu) on PATH." | tee -a "$report"
  for f in "${FILES[@]}"; do
    mode=etc1s; is_uastc "$f" && mode=uastc
    echo "  would encode $(basename "$f") -> $(basename "${f%.*}").ktx2 ($mode, mipmaps, sRGB)" | tee -a "$report"
  done
  [ $ALLOW -eq 1 ] && { echo "[ktx2] --allow-missing: keeping JPEG/PNG" | tee -a "$report"; exit 0; }
  echo "[ktx2] install KTX-Software (toktx) or basisu, see header" >&2; exit 3
fi
for f in "${FILES[@]}"; do
  o="$OUT/$(basename "${f%.*}").ktx2"
  if [ "$ENC" = toktx ]; then
    if is_uastc "$f"; then toktx --t2 --encode uastc --uastc_quality 2 --zcmp 18 --genmipmap --assign_oetf srgb "$o" "$f"
    else toktx --t2 --encode etc1s --clevel 4 --qlevel 192 --genmipmap --assign_oetf srgb "$o" "$f"; fi
  else
    if is_uastc "$f"; then basisu -ktx2 -uastc -uastc_level 2 -mipmap -output_file "$o" "$f" >/dev/null
    else basisu -ktx2 -q 192 -comp_level 2 -mipmap -output_file "$o" "$f" >/dev/null; fi
  fi
  printf '%s %s -> %s bytes\n' "$ENC" "$(basename "$f")" "$(stat -c %s "$o")" | tee -a "$report"
done

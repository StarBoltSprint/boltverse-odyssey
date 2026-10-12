set -e
for l in 0 1 2; do python3 ../../../tools/imagine-to-3d/terrace_block.py . --lod $l; done
python3 work/clean_streaks.py
python3 ../../../tools/object-gate/py/ghost_streaks.py work/terrace-lod0-bands.json work/terrace-lod0-icicles.json --out work/ghost-gate-v34.json
for l in 0 1 2; do blender -b -P ../../../tools/imagine-to-3d/weld_export.py -- work/terrace-lod$l.obj glb/terrace-lod$l.glb work/weld-lod$l.json 2>&1 | rg WELD; done
cp glb/*.glb /workspace/zd-preview-1012/assets/; cp glb/*.glb /workspace/zd-play-1012/assets/; cp plates/v34/*.jpg /workspace/zd-preview-1012/assets/; cp plates/v34/*.jpg /workspace/zd-play-1012/assets/
cp /workspace/zd-play-1012/index.html ../../../tools/object-gate/specs/zone-d/play-index.html; cp /workspace/zd-preview-1012/index.html ../../../tools/object-gate/specs/zone-d/preview-index.html
bash work/rerun32.sh
G=../../../tools/object-gate/py; for v in switch15m switch40m; do python3 $G/lod_gate.py work/switch-lod0 work/switch-lod1 $v | tail -1; python3 $G/lod_gate.py work/switch-lod1 work/switch-lod2 $v | tail -1; done > work/lod-outline-v34.txt
(cd ../../../tools/object-gate && node cli.mjs --scene specs/zone-d/scene.yaml --out /workspace/grokcli/wt/zd-terrace-1012/steps/zone-d/01-terrace/object-gate-v3.4 > /tmp/og34.log 2>&1 || true)
echo ALLDONE

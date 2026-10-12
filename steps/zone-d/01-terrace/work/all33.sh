set -e
for l in 0 1 2; do python3 ../../../tools/imagine-to-3d/terrace_block.py . --lod $l; blender -b -P ../../../tools/imagine-to-3d/weld_export.py -- work/terrace-lod$l.obj glb/terrace-lod$l.glb work/weld-lod$l.json 2>&1 | rg WELD; done
cp glb/*.glb /workspace/zd-preview-1012/assets/; cp glb/*.glb /workspace/zd-play-1012/assets/
bash work/rerun32.sh
(cd ../../../tools/object-gate && node cli.mjs --scene specs/zone-d/scene.yaml --out /workspace/grokcli/wt/zd-terrace-1012/steps/zone-d/01-terrace/object-gate-v3.3 > /tmp/og33.log 2>&1 || true)
echo ALLDONE

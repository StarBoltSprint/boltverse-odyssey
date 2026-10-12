set -e
RV=../../../tools/object-gate/py/render_views.py
M=front=work/plate-front-mask.png,side=work/plate-side-mask.png,top=work/top-mask.png
B="blender -b -P $RV --"; O=work/terrace-lod0.obj
$B $O renders --masks $M --ground 1 --unlit 0.8 > work/r.log 2>&1
$B $O work/upview --views work/up-view.json --masks $M --ground 1 --unlit 0.8 > work/ru.log 2>&1
cp work/upview/close3m-up.png work/upview/close3m-up-pass.npz renders/
$B $O renders/tr --transparent 1 --unlit 0.8 --raydiv 8 > work/tr.log 2>&1
$B $O work/upview/tr --views work/up-view.json --transparent 1 --unlit 0.8 --raydiv 8 >> work/tr.log 2>&1; cp work/upview/tr/close3m-up.png renders/tr/
$B $O renders/approach --views work/approach-views.json --masks $M --ground 1 --unlit 0.8 > work/approach.log 2>&1
$B $O renders/approach/tr --views work/approach-views.json --transparent 1 --unlit 0.8 --raydiv 8 > work/tra.log 2>&1
for l in 0 1 2; do $B work/terrace-lod$l.obj work/switch-lod$l --views work/switch-views.json --nocolor 1 --raydiv 1 > work/switch-lod$l.log 2>&1; done
rg -c Traceback work/*.log || true
echo DONE

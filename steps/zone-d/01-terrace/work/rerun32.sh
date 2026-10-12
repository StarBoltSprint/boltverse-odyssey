set -e
RV=../../../tools/object-gate/py/render_views.py
M=front=work/plate-front-mask.png,front2=work/t1-right-mask.png,side=work/plate-side-mask.png,top=work/top-mask.png
B="blender -b -P $RV --"; O=work/terrace-lod0.obj
$B $O renders --masks $M --ground 1 --unlit 0.8 > work/r.log 2>&1
$B $O work/upview --views work/up-view.json --masks $M --unlit 0.8 > work/ru.log 2>&1
cp work/upview/close3m-up.png work/upview/close3m-up-pass.npz renders/
python3 -c "
import json;a=json.load(open('renders/views.json'));b=json.load(open('work/upview/views.json'));a['views'].update(b['views']);json.dump(a,open('renders/views.json','w'),indent=1)"
for l in 0 1 2; do $B work/terrace-lod$l.obj work/switch-lod$l --views work/switch-views.json --nocolor 1 --raydiv 1 > work/switch-lod$l.log 2>&1; done
$B $O renders/trg --ground 1 --transparent 1 --unlit 0.8 --raydiv 8 > work/trg.log 2>&1
$B $O work/upview/trg --views work/up-view.json --transparent 1 --unlit 0.8 --raydiv 8 >> work/trg.log 2>&1; cp work/upview/trg/close3m-up.png renders/trg/
$B $O renders/approach --views work/approach-views.json --masks $M --ground 1 --unlit 0.8 > work/approach.log 2>&1
$B $O renders/approach/trg --views work/approach-views.json --ground 1 --transparent 1 --unlit 0.8 --raydiv 8 >> work/trg.log 2>&1
python3 work/sky_composite.py renders renders/approach > /dev/null
rg -c Traceback work/*.log || true
echo DONE

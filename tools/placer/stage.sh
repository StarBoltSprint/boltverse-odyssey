#!/bin/bash
# stage.sh VARIANT PORT : build terrace variant, refresh page assets, capture views, gatesuite (http) + judge
set -e; v=$1; port=$2; D=/workspace/kitrelief-out/terrace-$v; R=/workspace/kitrelief-1013
cd $R && python3 tools/kit/pieces.py terrace --variant $v --spine tools/gatesuite/fixtures/spine-v1.3.1-89d9e684.json --out $D --fit-mask $D/gate/mask.png ${PLACER:+--placer $PLACER --placer-groups $PLACER_GROUPS --placer-scope $D/gate/mask.png} > $D.build.json
cp tools/kit/viewer/play.html tools/kit/shader/hexTriplanar.js $D/; [ -f /workspace/kitrelief-out/matlib/autosheet-zd-snow.jpg ] && cp /workspace/kitrelief-out/matlib/autosheet-zd-snow.jpg $D/tex/lib_snow.jpg
python3 tools/kit/viewer/capture.py http://127.0.0.1:$port $D/sheet --key $D/gate/key.jpg --chrome /usr/bin/google-chrome > $D.cap.log 2>&1
for x in 3m chase 45 grazing side side4m; do cp $D/sheet/view-$x.png $D/gate/; done; cp $D/sheet/view-key.png $D/gate/key-render.png
timeout 700 python3 tools/gatesuite/run.py http://127.0.0.1:$port --out $D/gate-report.json > $D.gate.log 2>&1 || true
python3 - <<PY
import json;r=json.load(open('$D/gate-report.json'));print('$v',r['summary'])
for s,x in r['sections'].items():
  for c in x['checks']:
    if not c['ok']: print(' FAIL',s,c['check'],str(c['value'])[:160])
PY

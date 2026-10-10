#!/bin/bash
# imagine-to-3d auto selftest on the Zone B assets (box paths, read-only inputs; outputs under /workspace/i23d-auto).
# --no-browser: the shaders / morph / gate stages need a staging page and one free headless browser.
set -u; cd "$(dirname "$0")/.."
python3 auto.py run specs/zoneb-tower-sections.yaml --no-browser
python3 auto.py run specs/zoneb-mesa.yaml --no-browser
python3 auto.py run specs/zoneb-mesa-build.yaml --stages inputs,classify,shape,geometry,report
node -e 'import("./runtime/detail-chunk.js").then(m=>require("fs").writeFileSync("/tmp/detail-only.frag","#version 300 es\nprecision highp float;\nprecision highp sampler2DArray;\nin vec3 vW; in vec3 vN; uniform vec3 uEye; out vec4 o;\n"+m.DETAIL_GLSL+"\nvoid main(){ vec3 d=i3dDetail(vW, normalize(vN), distance(vW,uEye), 0.0); o=vec4(d,1.0);}\n"))'
python3 checks/perf_budget.py --type rock --geo /workspace/zb-preview-1008/mesas/strata5 --tex /workspace/zb-preview-1008/objects1/tex/sec6/*.png --frag /tmp/detail-only.frag
python3 checks/morph_iou.py /workspace/mesa-1009/v9/morph4/L-mid

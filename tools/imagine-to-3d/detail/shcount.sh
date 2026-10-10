#!/bin/bash
# static SPIR-V instruction + texture-fetch count of a WebGL2 (GLSL ES 3.00) fragment shader dumped from the page.
# Converted to desktop #version 450 for glslang (-G OpenGL SPIR-V), then spirv-opt -O. Loops are counted ONCE (static).
f=$1; t=$(mktemp --suffix=.frag)
sed -e 's/^#version 300 es/#version 450/' -e 's/^precision .*;//' -e 's/\b\(highp\|mediump\|lowp\) //g' "$f" > $t
glslangValidator -G --aml --amb -S frag -o /tmp/s.spv $t >/tmp/glslang.log 2>&1 || { echo "$f COMPILE-FAIL $(grep ERROR /tmp/glslang.log | head -2)"; exit; }
spirv-opt -O /tmp/s.spv -o /tmp/so.spv 2>/dev/null || cp /tmp/s.spv /tmp/so.spv
spirv-dis /tmp/so.spv > /tmp/so.txt
n=$(grep -c -E '^\s+(%\w+ = )?Op' /tmp/so.txt); s=$(grep -c -E 'OpImage(Sample|Fetch)' /tmp/so.txt); l=$(grep -c OpLoopMerge /tmp/so.txt)
echo "$(basename $f): instr=$n fetch_sites=$s loops=$l"

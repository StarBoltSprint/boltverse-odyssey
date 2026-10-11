# [tool-feedback] grade distance is the synthetic pregrade

- Tool: tools/look/grade.py
- Tool version / commit: f225beaa (curve module and bench). The distance field was written by the Zone B build on 2026-10-11.
- Take / branch + commit: cursor/unreal-look-1011, look pack for Zone B staging
- Defect seen on screen: the key camera with the look on is darker than the look off (mean luma 0.440 to 0.227) and the god rays crush. The city layout is unchanged.
- Tool metric vs measured: look.json features.grade.distance is 3.9932 on the synthetic pregrade. The same CIEDE2000 on the key-camera screenshot is 22.7188 with the look on and 23.6038 with the look off. A center 16:9 crop is 17.5377 on and 22.7719 off.
- Reproduce: python3 tools/look/look.py build --key /workspace/zb-bible-1008/key-city3.jpg --out DIR (no --game). Then compare grade.distance to grade.distance(key, key-camera png).
- Still / screenshot: /workspace/zb-unreal-look-1011/sheet-phone.jpg
- Short video:
- Proposed fix: name the synthetic number separately, and write distance only after a --game framebuffer of the key camera.
- No secrets, API keys, tokens, or private style prompts: yes

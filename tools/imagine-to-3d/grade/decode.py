"""imagine-to-3d grade step 1: decode the section plates (1024² RGBA, never resized) into raw cells.
python3 decode.py '<json list of files>' [texDir] [workDir]   (defaults = Zone B objects1/tex, cwd)"""
import json,sys,os
from PIL import Image
files=json.loads(sys.argv[1])
tex=sys.argv[2] if len(sys.argv)>2 else '/workspace/zb-preview-1008/objects1/tex'
work=sys.argv[3] if len(sys.argv)>3 else '.'
for i,f in enumerate(files):
    im=Image.open(os.path.join(tex,f)).convert('RGBA')
    assert im.size==(1024,1024),f
    open(os.path.join(work,f'raw{i:02d}.rgba'),'wb').write(im.tobytes())
print(len(files))

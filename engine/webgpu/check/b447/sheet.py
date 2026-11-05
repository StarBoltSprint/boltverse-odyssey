import numpy as np, json, sys
from PIL import Image, ImageDraw
A='/workspace/biome-futur/webgpu-ground/assets/meadow/'
L=dict(back=(24,384,896,8,0.50481,1.17789),q3l=(24,384,896,8,0.69269,1.61627),q3r=(24,384,896,8,0.69348,1.61812),prof=(17,768,448,4,1.55054,0.90448))
S=float(sys.argv[2]) if len(sys.argv)>2 else 1
ppm=400; im=Image.new('RGB',(2400,800),(90,140,90)); d=ImageDraw.Draw(im); x0=0
for n,(P,cw,ch,col,wm,hm) in L.items():
  a=Image.open(A+f'bolt447_{n}_c.png').crop((0,0,cw,ch)).resize((int(wm*ppm),int(hm*ppm)))
  im.paste(a,(x0,800-20-a.size[1]),a); d.text((x0+5,5),n,fill=(255,255,255)); x0+=a.size[0]+20
for y in range(0,800,40): d.line((0,780-y,2400,780-y),fill=(70,110,70))
im.save(sys.argv[1])

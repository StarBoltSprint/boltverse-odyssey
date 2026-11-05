import numpy as np, json, sys
from PIL import Image
A='/workspace/biome-futur/webgpu-ground/assets/meadow/'
L=dict(back=(24,384,896,8,0.50481,1.17789),q3l=(24,384,896,8,0.69269,1.61627),q3r=(24,384,896,8,0.69348,1.61812),prof=(17,768,448,4,1.55054,0.90448))
if len(sys.argv)>1: L.update(json.load(open(sys.argv[1])))
out={}
for n,(P,cw,ch,col,wm,hm) in L.items():
  a=np.array(Image.open(A+f'bolt447_{n}_c.png'))[...,3]
  r=[]
  for f in range(int(P)):
    gx,gy=f%int(col),f//int(col); c=a[gy*ch:(gy+1)*ch,gx*cw:(gx+1)*cw]>128
    ys,xs=np.nonzero(c)
    top,bot=ys.min(),ys.max(); h=(bot-top+1)/ch*hm; w=(xs.max()-xs.min()+1)/cw*wm
    base=(ch-1-bot)/ch*hm; cy=(ch-1-ys.mean())/ch*hm; cx=(xs.mean()/cw-0.5)*wm
    r.append((h,w,base,cy,cx))
  m=np.median(np.array(r),0); out[n]=dict(H=m[0],W=m[1],base=m[2],cy=m[3],cx=m[4])
  print(f"{n:5s} H={m[0]:.4f}m W={m[1]:.4f}m base={m[2]:.4f}m cy={m[3]:.4f}m cx={m[4]:+.4f}m")
json.dump(out,open('measure.json','w'),indent=1)

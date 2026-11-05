import numpy as np, json
from PIL import Image
A='/workspace/biome-futur/webgpu-ground/assets/meadow/'
L=dict(back=(24,384,896,8,1.17789),q3l=(24,384,896,8,1.61627),q3r=(24,384,896,8,1.61812),prof=(17,768,448,4,0.90448))
LSC=dict(back=1,q3l=1.2386,q3r=1.2454,prof=1.127)
cur={}
for n,(P,cw,ch,col,hm) in L.items():
  a=np.array(Image.open(A+f'bolt447_{n}_c.png'))[...,3]; h=[];ft=[]
  for f in range(P):
    c=a[(f//col)*ch:(f//col+1)*ch,(f%col)*cw:(f%col+1)*cw]>128; ys,xs=np.nonzero(c)
    h.append((ys.max()-ys.min()+1)/ch*hm*LSC[n]); ft.append((ch-1-ys.max())/ch*hm)
  cur[n]=np.array(h); print(n,np.round(cur[n]/cur[n].mean(),3).tolist())
N=240; g=np.arange(N)/N
def rs(v): P=len(v); x=g*P; i=np.floor(x).astype(int); k=x-i; return v[i%P]*(1-k)+v[(i+1)%P]*k
B=rs(cur['back']); out={}
for n in L:
  C=rs(cur[n]); best=min(range(N),key=lambda s:np.mean((np.roll(C,-s)/C.mean()-B/B.mean())**2))
  out[n]=best/N; bl=0.5*(B+np.roll(C,-best)); bl0=0.5*(B+C)
  print(n,'off',round(best/N,3),'blend range raw %.1f%% aligned %.1f%%'%(100*(bl0.max()-bl0.min())/bl0.mean()/2,100*(bl.max()-bl.min())/bl.mean()/2), 'mean ratio %.3f'%(C.mean()/B.mean()))
json.dump(out,open('gait_offsets.json','w'))
print('--- back as 2 strides')
b=cur['back']; B2=rs(np.concatenate([b[:12],b[:12]]))  # placeholder
x=g*12; i=np.floor(x).astype(int); k=x-i
for half in (0,1):
  v=b[half*12:half*12+12]; v=np.append(v,b[(half*12+12)%24]); Bh=v[i]*(1-k)+v[i+1]*k
  for n in ('q3l','q3r','prof'):
    C=rs(cur[n]); best=min(range(N),key=lambda s:np.mean((np.roll(Bh,-s)/Bh.mean()-C/C.mean())**2))
    bl=0.5*(np.roll(Bh,-best)/Bh.mean()+C/C.mean()); bl0=0.5*(Bh/Bh.mean()+C/C.mean())
    print(half,n,'backoff',round(best/N,3),'blend ±%.1f%% -> ±%.1f%%'%(50*(bl0.max()-bl0.min()),50*(bl.max()-bl.min())))
print('--- ratio metric')
res={}
for n in ('q3l','q3r','prof'):
  C=rs(cur[n]); C=C/C.mean(); r=[]
  for half in (0,1):
    v=np.append(b[half*12:half*12+12],b[(half*12+12)%24]); Bh=v[i]*(1-k)+v[i+1]*k; Bh=Bh/Bh.mean()
    r.append([np.abs(np.roll(Bh,-s)/C-1).max() for s in range(N)])
  r=np.array(r).max(0); best=int(r.argmin()); res[n]=best/N
  print(n,'ratio max dev: off0 %.1f%%  best %.1f%% at backoff %.3f'%(100*r[0],100*r[best],best/N))
json.dump(res,open('gait_offsets.json','w'))

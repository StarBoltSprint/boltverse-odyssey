import json,glob,sys,numpy as np
from PIL import Image
# lean angle (deg) per frame: top-vs-paw x offset change vs lean=0 render at the same t, over silhouette height
def mk(f):
  a=np.asarray(Image.open(f).convert('RGB')).astype(int); return (a[...,0]>150)&(a[...,2]>150)&(a[...,1]<110)
def tilt(f):
  m=mk(f);ys,xs=np.nonzero(m);top,bot=ys.min(),ys.max();h=bot-top
  return xs[ys<top+0.3*h].mean()-xs[ys>bot-0.15*h].mean(),h
A,B=sys.argv[1],sys.argv[2]
LA=json.load(open(A+'_log.json'));LB=json.load(open(B+'_log.json'))
FA=sorted(glob.glob(A+'/f*.jpg'));FB=sorted(glob.glob(B+'/f*.jpg'))
ta={round(e['t'],2):(f,e) for f,e in zip(FA,LA)}
res=[]
for f,e in zip(FB,LB):
  t=round(e['t'],2)
  if t not in ta: continue
  (d1,h),(d0,_)=tilt(ta[t][0]),tilt(f)
  res.append((t,e['roll'],np.degrees(np.arctan((d1-d0)/h))))
for t,r,d in res: print(f"t {t:5.2f} roll {r:+.3f} lean {d:+5.1f} deg")
for nm,lo,hi in (('left',16.5,19.5),('right',27.3,28.7)):
  v=[abs(d) for t,r,d in res if lo<=t<=hi]; print(nm,'turn |lean| median',round(np.median(v),1),'max',round(max(v),1))

import json,glob,numpy as np
from PIL import Image
def mk(f):
  a=np.asarray(Image.open(f).convert('RGB')).astype(int); return (a[...,0]>150)&(a[...,2]>150)&(a[...,1]<110)
for a,b in (('g9c_l0a','g9c_l1a'),('g9c_l0b','g9c_l1b')):
  L=json.load(open(b+'_log.json')); P=np.array([e['bp'] for e in L])
  F0=sorted(glob.glob(a+'/f*.jpg'));F1=sorted(glob.glob(b+'/f*.jpg'));out=[]
  for f0,f1 in zip(F0,F1):
    r=[]
    for f in (f0,f1):
      m=mk(f);ys,xs=np.nonzero(m);top,bot=ys.min(),ys.max();h=bot-top
      r.append(xs[ys<top+0.3*h].mean()-xs[ys>bot-0.15*h].mean())
    out.append(r[1]-r[0])
  # turn direction on screen: heading change projected on camera right
  i=len(L)//2; m=np.array(L[i]['vp']).reshape(4,4).T; d0=P[i]-P[i-2]; d1=P[i+2]-P[i]
  turn=np.dot(d1/np.linalg.norm(d1)-d0/np.linalg.norm(d0),m[0,:3])
  print(b,'ang',round(L[i]['ang'][1],1),'roll',round(L[i]['roll'],2),'| path curves to screen',('right' if turn>0 else 'left'),'| lean moves top',round(np.median(out),1),'px ->',('right' if np.median(out)>0 else 'left'))

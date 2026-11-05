import numpy as np, json, sys, glob
from PIL import Image
d=sys.argv[1]; log=json.load(open(d+'_log.json')); R=[]
for i,e in enumerate(log):
  a=np.array(Image.open(f'{d}/f{i:04d}.jpg')).astype(int)
  m=(a[...,0]>180)&(a[...,2]>180)&(a[...,1]<90); ys,xs=np.nonzero(m)
  if len(ys)<50: continue
  rel,ang,la,lb,k=e['ang']; R.append(dict(t=e['t'],ang=ang,la=la,lb=lb,k=k,top=int(ys.min()),bot=int(ys.max()),h=int(ys.max()-ys.min()+1),w=int(xs.max()-xs.min()+1),cx=float(xs.mean()),area=int(m.sum())))
json.dump(R,open(d+'_bbox.json','w'))
lay=lambda r:('back','q3l','q3r','prof')[int(r['la'] if r['k']<0.5 else r['lb'])]
import collections; g=collections.defaultdict(list)
for r in R: g[lay(r)].append(r)
for n,v in g.items():
  print(f"{n:5s} n={len(v):3d} h={np.median([r['h'] for r in v]):6.1f} w={np.median([r['w'] for r in v]):6.1f} bot={np.median([r['bot'] for r in v]):6.1f} top={np.median([r['top'] for r in v]):6.1f} cx={np.median([r['cx'] for r in v]):6.1f}")

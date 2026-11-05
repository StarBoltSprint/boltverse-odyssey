import json,glob,sys,numpy as np
from PIL import Image
def H(d):
  L=json.load(open(d+'_log.json'));out={}
  for e,f in zip(L,sorted(glob.glob(d+'/f*.jpg'))):
    a=np.asarray(Image.open(f).convert('RGB')).astype(int);m=(a[...,0]>150)&(a[...,2]>150)&(a[...,1]<110)
    ys=np.nonzero(m)[0]; out[round(e['t'],3)]=(ys.max()-ys.min(),e['ang'])
  return out
q,b=H(sys.argv[1]),H(sys.argv[2])
rows=[(t,q[t][0]/b[t][0],q[t][1]) for t in q if t in b]
k=[r for r in rows if r[2][4]>0.98]
rat=np.array([r[1] for r in k]);print('held n',len(k),'height ratio median %+.1f%% p5..p95 %+.1f..%+.1f max %.1f'%(100*np.median(rat)-100,100*np.percentile(rat,5)-100,100*np.percentile(rat,95)-100,100*abs(rat-1).max()))
if len(sys.argv)>3:
  cell=np.array([int(np.floor((r[2][5]%1)*24))%24 for r in k]);g=np.ones(24)
  for c in range(24):
    s=cell==c
    if s.any(): g[c]=1/np.median(rat[s])
  print('HC l1 =',','.join('%.4f'%x for x in g))

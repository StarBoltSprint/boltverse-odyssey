# v447g9 size measure: per frame height (top->ground) and torso length (silhouette width in the 50-80% height band, legs excluded),
# compared with the straight-run ref at the same t. Height vs ref; torso length vs its own median in the held view (view-angle scaled).
import json,glob,sys,numpy as np
from PIL import Image
def m(f):
  a=np.asarray(Image.open(f).convert('RGB')).astype(int); return (a[...,0]>150)&(a[...,2]>150)&(a[...,1]<110)
def meas(d):
  out={}
  L=json.load(open(d+'_log.json'))
  for e,f in zip(L,sorted(glob.glob(d+'/f*.jpg'))):
    k=m(f); ys,xs=np.nonzero(k)
    if len(ys)<50: continue
    top,bot=ys.min(),ys.max(); h=bot-top; band=k[int(bot-0.8*h):int(bot-0.5*h)]
    w=np.percentile([np.ptp(r.nonzero()[0]) if r.any() else 0 for r in band],70)
    a=e['ang']; out[round(e['t'],3)]=dict(h=h,L=w,k=a[4] if isinstance(a,list) else 0)
  return out
v=sys.argv[1]; R={}; [R.update(meas(f'{v}_{b}')) for b in ('back','back2')]
H=[];LL=[];K=[]
for r in ('ta','tb'):
  for t,e in meas(f'{v}_{r}').items():
    if t in R: H.append(e['h']/R[t]['h']); LL.append(e['L']); K.append(e['k'])
H=np.array(H);LL=np.array(LL,float);K=np.array(K)
for n,s in [('blend',(K>0.02)&(K<0.98)),('held q3',K>=0.98)]:
  h=H[s]; l=LL[s]/np.median(LL[s])
  print(f"{v} {n:7s} n={s.sum():3d} height vs straight median {100*np.median(h)-100:+.1f}% p5..p95 {100*np.percentile(h,5)-100:+.1f}..{100*np.percentile(h,95)-100:+.1f}% max {100*np.abs(h-1).max():.1f}% | torso length p5..p95 {100*np.percentile(l,5)-100:+.1f}..{100*np.percentile(l,95)-100:+.1f}% max {100*np.abs(l-1).max():.1f}%")

# g9 checks the size scripts missed. FREEZE: leg-band silhouette change per frame (XOR/leg area), each 0.5 s window vs straight-run median;
# also atlas cell must advance every frame. DUPLICATE: silhouette width/area jump vs +-3 frame neighbours, or >1 connected body blob.
import json,glob,sys,numpy as np
from PIL import Image
from scipy import ndimage
def mk(f):
  a=np.asarray(Image.open(f).convert('RGB')).astype(int); return (a[...,0]>150)&(a[...,2]>150)&(a[...,1]<110)
d=sys.argv[1]; L=json.load(open(d+'_log.json')); F=sorted(glob.glob(d+'/f*.jpg')); M=[mk(f) for f in F]
leg=[];W=[];A=[];NB=[]
for m in M:
  ys,xs=np.nonzero(m); top,bot=ys.min(),ys.max(); h=bot-top
  l=m.copy(); l[:int(bot-0.35*h)]=0; leg.append(l); W.append(np.ptp(xs)); A.append(m.sum())
  lab,n=ndimage.label(m); s=ndimage.sum(m,lab,range(1,n+1)); NB.append(int((np.array(s)>0.05*m.sum()).sum()))
W=np.array(W,float);A=np.array(A,float)
ch=np.array([0]+[(leg[i]^leg[i-1]).sum()/max(leg[i].sum(),1) for i in range(1,len(M))])
k=np.array([e['ang'][4] for e in L]); la=np.array([e['ang'][3] for e in L]); t=np.array([e['t'] for e in L])
ref=np.median(ch[(k<0.01)&(t<14.5)]) if ((k<0.01)&(t<14.5)).any() else np.median(ch)
print(f'{d}: leg change ref (straight) {ref:.3f}/frame')
bad=0
for s in range(0,len(M),15):
  w=ch[s+1:s+15].mean(); fl='FREEZE' if w<0.35*ref else ''
  print(f' t {t[s]:5.2f} view {int(la[s])} k {k[s]:.2f} leg change {w:.3f} ({w/ref:.2f}x) {fl}'); bad+=fl!=''
dup=[]
for i in range(3,len(M)-3):
  nb=np.median(np.r_[W[i-3:i],W[i+1:i+4]]); na=np.median(np.r_[A[i-3:i],A[i+1:i+4]])
  if W[i]>1.15*nb or A[i]>1.15*na or NB[i]>1: dup.append((round(t[i],2),round(k[i],2),round(W[i]/nb,2),round(A[i]/na,2),NB[i]))
print(' freeze windows:',bad,'| duplicate/spike frames:',dup)
sz=[(round(t[i],2),round(A[i]/A[i-1],2)) for i in range(1,len(M)) if abs(A[i]/A[i-1]-1)>0.2]
print(' area snaps >20% frame-to-frame:',sz)

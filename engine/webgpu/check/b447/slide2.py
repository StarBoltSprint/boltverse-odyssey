import glob,sys,json,numpy as np
from PIL import Image
from scipy import ndimage
bd=sys.argv[1]; L=json.load(open(bd+'_log.json')); B=sorted(glob.glob(bd+'/f*.jpg'))
W,H=720,1280
def M(v): return np.array(v).reshape(4,4).T
def proj(m,P): q=m@np.array([*P,1.0]); q=q[:3]/q[3]; return ((q[0]+1)/2*W,(1-q[1])/2*H)
def unproj(m,x,y,gy):
  iv=np.linalg.inv(m); n=[x/W*2-1,1-y/H*2]
  a=iv@np.array([*n,0,1]);a=a[:3]/a[3]; b=iv@np.array([*n,1,1]);b=b[:3]/b[3]
  t=(gy-a[1])/(b[1]-a[1]); return a+t*(b-a)
def bm(f):
  a=np.asarray(Image.open(f).convert('RGB')).astype(int); return (a[...,0]>150)&(a[...,2]>150)&(a[...,1]<110)
Ms=[bm(f) for f in B]; bots=[np.nonzero(m.any(1))[0].max() for m in Ms]; G=np.percentile(bots,90)
paws=[]
for m in Ms:
  ys,xs=np.nonzero(m); h=G-ys.min(); band=m.copy(); band[:int(G-0.10*h)]=0; lab,n=ndimage.label(band); P=[]
  for i in range(1,n+1):
    yy,xx=np.nonzero(lab==i)
    if len(yy)>30: P.append((xx[yy>=yy.max()-3].mean(),yy.max()+1))
  paws.append(P)
sl=[];gv=[]
for i in range(1,len(B)):
  m0,m1=M(L[i-1]['vp']),M(L[i]['vp']); gy=L[i]['bp'][1]
  for (x,y) in paws[i-1]:
    if y<G-5: continue
    ex,ey=proj(m1,unproj(m0,x,y,gy))   # where a planted point would be next frame
    c=[(abs(px-x)+abs(py-y),px,py) for px,py in paws[i] if py>=G-5]
    if c and min(c)[0]<25: _,px,py=min(c); sl.append(np.hypot(px-ex,py-ey)); gv.append(np.hypot(ex-x,ey-y))
sl=np.array(sl);gv=np.array(gv)
print(f'{bd}: contact pairs {len(sl)} | ground point moves {np.median(gv):.2f} px/frame | planted paw error vs ground median {np.median(sl):.2f} px/frame (p90 {np.percentile(sl,90):.2f}) = {100*np.median(sl)/max(np.median(gv),1e-3):.0f}% of ground motion')

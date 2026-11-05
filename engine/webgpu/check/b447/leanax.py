# lean = change of the silhouette principal (body) axis angle vs a lean=0 render at the same t (deg; + = CCW = top toward screen left)
import json,glob,sys,numpy as np
from PIL import Image
def ax(f):
  a=np.asarray(Image.open(f).convert('RGB')).astype(int);m=(a[...,0]>150)&(a[...,2]>150)&(a[...,1]<110)
  ys,xs=np.nonzero(m);x=xs-xs.mean();y=-(ys-ys.mean());c=np.cov(x,y);w,v=np.linalg.eigh(c);e=v[:,1]
  return np.degrees(np.arctan2(e[1],e[0]))
def load(d):
  L=json.load(open(d+'_log.json'));return {round(e['t'],2):(f,e) for f,e in zip(sorted(glob.glob(d+'/f*.jpg')),L)}
A,B=load(sys.argv[1]),load(sys.argv[2]);R=[]
for t in sorted(B):
  if t in A:
    d=ax(A[t][0])-ax(B[t][0]); d=(d+90)%180-90; R.append((t,d,A[t][1]['roll']))
for nm,lo,hi in (('left',16.5,19.5),('right',27.5,28.5)):
  v=np.array([d for t,d,r in R if lo<=t<=hi])
  if len(v): print(nm,'n',len(v),'lean deg median %+.1f IQR %+.1f..%+.1f'%(np.median(v),*np.percentile(v,[25,75])))

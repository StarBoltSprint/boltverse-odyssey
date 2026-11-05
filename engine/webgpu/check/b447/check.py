import json,sys,glob,numpy as np
from PIL import Image
from scipy import ndimage
run,ref=sys.argv[1],sys.argv[2]
L=json.load(open(run+'_bbox.json')); R={round(e['t'],3):e for e in json.load(open(ref+'_bbox.json'))}
fs=sorted(glob.glob(run+'/f*.jpg')); prev=None; diffs=[]; ncomp=[]; rat=[]; ar=[]
def mask(f):
  a=np.asarray(Image.open(f).convert('RGB')).astype(int); return (a[...,0]>150)&(a[...,2]>150)&(a[...,1]<110)
for f,e in zip(fs,L):
  m=mask(f); lab,n=ndimage.label(ndimage.binary_closing(m,iterations=3)); sz=ndimage.sum(m,lab,range(1,n+1)); big=int((np.array(sz)>0.15*max(sz.max() if n else 1,1)).sum())
  ncomp.append(big)
  q3=e['la']!=0 and e['k']<0.02 or e['lb']!=0 and e['k']>0.98
  if prev is not None and q3: diffs.append((m^prev).sum()/max(m.sum(),1))
  prev=m; t=round(e['t'],3)
  if t in R and (e['la']!=0 or e['lb']!=0): rat.append(e['h']/R[t]['h']); ar.append(e['area']/R[t]['area'])
d=np.array(diffs); r=np.array(rat); a=np.array(ar)
print(f"{run}: held-turn frame diff (silhouette XOR/area) min {d.min():.3f} median {np.median(d):.3f} frozen(<0.02) {int((d<0.02).sum())}/{len(d)} | height ratio vs straight p5..p95 {np.percentile(r,5):.3f}..{np.percentile(r,95):.3f} median {np.median(r):.3f} | area ratio median {np.median(a):.2f} | sprite blobs per frame max {max(ncomp)} (frames with >1: {sum(c>1 for c in ncomp)})")

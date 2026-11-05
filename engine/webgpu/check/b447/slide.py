import glob,sys,numpy as np
from PIL import Image
from scipy import ndimage
cd,bd=sys.argv[1],sys.argv[2]
C=sorted(glob.glob(cd+'/f*.jpg')); B=sorted(glob.glob(bd+'/f*.jpg'))
def bm(f):
  a=np.asarray(Image.open(f).convert('RGB')).astype(int); return (a[...,0]>150)&(a[...,2]>150)&(a[...,1]<110)
def gray(f): return np.asarray(Image.open(f).convert('L')).astype(np.float32)
M=[bm(f) for f in B]; bots=[np.nonzero(m.any(1))[0].max() for m in M]; G=np.percentile(bots,90)
paws=[]
for m in M:
  ys,xs=np.nonzero(m); top=ys.min(); h=G-top; band=m.copy(); band[:int(G-0.12*h)]=0
  lab,n=ndimage.label(band); P=[]
  for i in range(1,n+1):
    yy,xx=np.nonzero(lab==i)
    if len(yy)>30: P.append((xx.mean(),yy.max()))
  paws.append(P)
def flow(a,b,y0,y1,x0,x1):
  A=a[y0:y1,x0:x1];Bb=b[y0:y1,x0:x1];A=A-A.mean();Bb=Bb-Bb.mean()
  F=np.fft.fft2(A)*np.conj(np.fft.fft2(Bb)); r=np.real(np.fft.ifft2(F/(abs(F)+1e-6))); dy,dx=np.unravel_index(r.argmax(),r.shape)
  dy=dy-A.shape[0] if dy>A.shape[0]/2 else dy; return -dy
gr=[];pw=[]
for i in range(1,len(B)):
  m=M[i]; xs=np.nonzero(m.any(0))[0]; y0=int(G-40); y1=int(G+40)
  g=[flow(gray(C[i-1]),gray(C[i]),y0,y1,x0,x0+128) for x0 in (max(0,xs.min()-160),min(590,xs.max()+30))]
  gd=np.median(g); 
  for (x,y) in paws[i]:
    if y>=G-6:
      prev=[(abs(x-px),py) for px,py in paws[i-1] if py>=G-6]
      if prev and min(prev)[0]<15: pw.append(y-min(prev)[1]); gr.append(gd)
gr=np.array(gr);pw=np.array(pw)
print(f'ground line y={G:.0f}; contact samples {len(pw)}; ground flow at paw level median {np.median(gr):+.2f} px/frame; planted-paw motion median {np.median(pw):+.2f} px/frame; slip (paw-ground) median {np.median(pw-gr):+.2f} px/frame')

"""Repetition check on the cornice-underside pixels of renders/close3m-up.png: high-passed (sigma 4 px) normalised
autocorrelation; a tiled texture shows a secondary peak > 0.5 away from the centre (> 12 px). Self-test: a 4x tiled
copy of the same crop must FAIL."""
import numpy as np, json
from PIL import Image
from scipy import ndimage as ndi
vs=[];fs=[]
for ln in open('work/terrace-lod0.obj'):
  if ln.startswith('v '): vs.append([float(x) for x in ln.split()[1:4]])
  elif ln.startswith('f '): fs.append([int(t.split('/')[0])-1 for t in ln.split()[1:4]])
T=np.array(vs)[np.array(fs)];n=np.cross(T[:,1]-T[:,0],T[:,2]-T[:,0]);n/=np.linalg.norm(n,axis=1,keepdims=True)
z=np.load('renders/close3m-up-pass.npz');f=z['face'];h=f>=0
under=np.zeros_like(h);under[h]=n[f[h],1]<-0.9
im=np.asarray(Image.open('renders/close3m-up.png').convert('L'),np.float32)
U=ndi.binary_erosion(np.asarray(Image.fromarray(under.astype(np.uint8)*255).resize(im.shape[::-1],0))>0,iterations=3)
lab,_=ndi.label(U);big=lab==np.bincount(lab.ravel())[1:].argmax()+1
ys,xs=np.nonzero(big);sl=(slice(ys.min(),ys.max()+1),slice(xs.min(),xs.max()+1))
def peak(P,M):
    Q=np.where(M,P-ndi.gaussian_filter(P,4),0); Fq=np.fft.fft2(Q,s=(2*Q.shape[0],2*Q.shape[1]))
    ac=np.fft.fftshift(np.real(np.fft.ifft2(Fq*np.conj(Fq)))); cy,cx=np.array(ac.shape)//2; ac/=ac[cy,cx]
    W=np.fft.fftshift(np.real(np.fft.ifft2(np.abs(np.fft.fft2(M.astype(float),s=ac.shape))**2))); W/=W[cy,cx]
    ac=np.where(W>0.25,ac/np.maximum(W,1e-6),0)
    yy,xx=np.mgrid[:ac.shape[0],:ac.shape[1]]; return float(ac[np.hypot(yy-cy,xx-cx)>12].max())
P,M=im[sl],big[sl]; pk=peak(P,M)
t=P[:P.shape[0]//2,:P.shape[1]//4]; tiled=np.tile(t,(2,4))[:P.shape[0],:P.shape[1]]; pt=peak(tiled,np.ones_like(tiled,bool))
r=dict(undersideShare=round(float(under.sum()/h.sum()),3),cropPx=list(P.shape),secondaryPeak=round(pk,3),threshold=0.5,verdict='PASS' if pk<=0.5 else 'FAIL',
       selftestTiledPeak=round(pt,3),selftest='FAIL as expected' if pt>0.5 else 'DID NOT FAIL (check is weak)')
print(r); json.dump(r,open('work/repetition-close3m-up.json','w'),indent=1)

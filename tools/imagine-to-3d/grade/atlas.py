"""imagine-to-3d grade step 3: graded cells -> R8 luma atlases at native 1024 px per cell (no resample) + one low-res
chroma atlas (256 px per cell, chroma offset only). Shader: sRGB = Y + (C - Y(C)).
python3 atlas.py [outDir] [nCells]   (cwd = work dir with g*.rgba)"""
import numpy as np, json, os, sys
from PIL import Image
from skimage import color
S=1024; CS=256
n=int(sys.argv[2]) if len(sys.argv)>2 else len([f for f in os.listdir('.') if f.startswith('g') and f.endswith('.rgba')])
cells=[np.frombuffer(open(f'g{i:02d}.rgba','rb').read(),np.uint8).reshape(S,S,4)[...,:3] for i in range(n)]
W=np.array([0.2126,0.7152,0.0722])
lumas=[np.clip(np.rint(c.astype(np.float64)@W),0,255).astype(np.uint8) for c in cells]
out=sys.argv[1] if len(sys.argv)>1 else './sec-out'; os.makedirs(out,exist_ok=True)
# luma atlases: 16 + 16 + 4 cells, 4 cols
for a,(lo,hi) in enumerate([(k,min(k+16,n)) for k in range(0,n,16)]):
    rows=(hi-lo+3)//4; A=np.zeros((rows*S,4*S),np.uint8)
    for k in range(lo,hi):
        c=k-lo; A[(c//4)*S:(c//4+1)*S,(c%4)*S:(c%4+1)*S]=lumas[k]
    Image.fromarray(A,'L').save(f'{out}/luma{a}.png',optimize=True)
# chroma atlas 6x6 of 256
G=int(np.ceil(np.sqrt(n))); C=np.zeros((G*CS,G*CS,3),np.uint8); errs=[]
for k in range(n):
    sm=np.asarray(Image.fromarray(cells[k]).resize((CS,CS),Image.BOX))
    C[(k//G)*CS:(k//G+1)*CS,(k%G)*CS:(k%G+1)*CS]=sm
    up=np.asarray(Image.fromarray(sm).resize((S,S),Image.BILINEAR)).astype(np.float64)
    yc=up@W
    rec=np.clip(lumas[k][...,None]+(up-yc[...,None]),0,255)
    de=np.linalg.norm(color.rgb2lab(rec/255)-color.rgb2lab(cells[k]/255),axis=-1)
    errs.append((float(de.mean()),float(np.percentile(de,99)),float(de.max())))
Image.fromarray(C,'RGB').save(f'{out}/chroma.png',optimize=True)
e=np.array(errs); print('dE mean',e[:,0].mean().round(3),'p99 worst',e[:,1].max().round(2),'max',e[:,2].max().round(2))
json.dump({'dE_per_cell':errs,'dEmean':float(e[:,0].mean()),'dEp99worst':float(e[:,1].max()),'cells':n,'grid':G},open('recon-de.json','w'))
for f in sorted(os.listdir(out)): print(f, os.path.getsize(f'{out}/{f}')//1024,'KB')

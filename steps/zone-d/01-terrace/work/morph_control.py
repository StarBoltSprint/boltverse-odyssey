"""v3.1 proof: replay the object-gate approach-morph camera path (300->10 m, x0.95/frame, 135x240 mask, vfov 58, eye +2 m)
on (a) the terrace LOD0 OBJ and (b) a rigid plain box of the same AABB, with a hard (non-AA) rasteriser. If the rigid box
shows the same neighbour-drop 'jumps' at 285-199 m, the row measures pixel quantisation of a 10-16 px tall silhouette,
not a shape change."""
import numpy as np, json, math, sys
from PIL import Image, ImageDraw
def obj(p):
    V=[];F=[]
    for l in open(p):
        if l.startswith('v '): V.append([float(x) for x in l.split()[1:4]])
        elif l.startswith('f '): F.append([int(t.split('/')[0])-1 for t in l.split()[1:4]])
    return np.array(V),np.array(F)
V,F=obj('work/terrace-lod0.obj'); lo,hi=V.min(0),V.max(0); C=(lo+hi)/2
bx=np.array([[x,y,z] for x in (lo[0],hi[0]) for y in (lo[1],hi[1]) for z in (lo[2],hi[2])])
BF=np.array([[0,1,3],[0,3,2],[4,6,7],[4,7,5],[0,4,5],[0,5,1],[2,3,7],[2,7,6],[0,2,6],[0,6,4],[1,5,7],[1,7,3]])
sp=(-300*0.7071,300*0.7071); dx,dz=sp[0]-C[0],sp[1]-C[2]; L=math.hypot(dx,dz); dx/=L; dz/=L
r0=max((hi[0]-lo[0])/2,(hi[2]-lo[2])/2); h=hi[1]-lo[1]; W,H,fov=135,240,58
def mask(V,F,eye,tgt):
    f=np.array(tgt)-eye; f/=np.linalg.norm(f); r=np.cross(f,[0,1,0]); r/=np.linalg.norm(r); u=np.cross(r,f)
    P=V-eye; x,y,z=P@r,P@u,P@f; k=H/2/math.tan(math.radians(fov/2)); X=W/2+k*x/z; Y=H/2-k*y/z
    im=Image.new('1',(W,H)); d=ImageDraw.Draw(im)
    for t in F: d.polygon([(X[i],Y[i]) for i in t],fill=1)
    return np.array(im)
res={}
for name,(VV,FF) in {'terrace':(V,F),'rigidBox':(bx,BF)}.items():
    prev=None; ious=[]; d=300.0
    while d>=10:
        x,z=C[0]+dx*(r0+d),C[2]+dz*(r0+d); eye=np.array([x,2.0,z]); ty=lo[1]+min(h*0.5,40,d*0.35+8)
        m=mask(VV,FF,eye,[C[0],ty,C[2]]).astype(bool)
        if prev is not None: ious.append((round(d,1),float((m&prev).sum()/max(1,(m|prev).sum())),int(m.sum())))
        prev=m; d*=0.95
    v=[i[1] for i in ious]; bad=[]
    for i,(dd,io,px) in enumerate(ious):
        nb=sorted([v[j] for j in (i-2,i-1,i+1,i+2) if 0<=j<len(v)]); med=nb[len(nb)>>1]
        if io<0.8 or med-io>0.05: bad.append((dd,round(io,3),px))
    res[name]={'minIoU':round(min(v),3),'jumps':bad,'firstFramePx':ious[0][2]}
    print(name,res[name])
json.dump(res,open('work/morph-control.json','w'),indent=1)

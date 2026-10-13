import numpy as np,cv2,json
SC=2.3;F=0.5957*1024;HC=6.93*SC
nc=np.array([0.0108,-0.9511,-0.3086]);c2b=lambda P:np.stack([P[...,0],P[...,2],-P[...,1]],-1)
nb=c2b(nc);nb/=np.linalg.norm(nb);z=np.array([0,0,1.]);v=np.cross(nb,z);s=np.linalg.norm(v);cc=nb@z
Vx=np.array([[0,-v[2],v[1]],[v[2],0,-v[0]],[-v[1],v[0],0]]);R=np.eye(3)+Vx+Vx@Vx*((1-cc)/s**2);CAM=np.array([0,0,HC])
D=np.load('key-depth.npy')*SC
def rays(u,vv): return c2b(np.stack([(u+.5-512)/F,(vv+.5-512)/F,np.ones_like(u)],-1))@R.T
def pts(mask):
    vv,u=np.nonzero(mask); return CAM+rays(u.astype(float),vv.astype(float))*D[vv,u][:,None]
def vplane(mask):
    P=pts(cv2.erode(mask,np.ones((7,7),np.uint8))); c=np.median(P,0); xy=P[:,:2]-c[:2]
    _,_,vt=np.linalg.svd(xy,full_matrices=False); dvec=np.array([*vt[0],0]); n=np.array([-dvec[1],dvec[0],0])
    if n@(CAM-c)<0: n=-n
    off=np.median((P-c)@n); return c+n*off,n,dvec
def hit(u,vv,p0,n):
    r=rays(u,vv); t=((p0-CAM)@n)/(r@n); return CAM+r*t[:,None],t
def contour(mask,eps=1.0):
    m=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((9,9),np.uint8)); cs,_=cv2.findContours(m,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
    c=max(cs,key=cv2.contourArea); c=cv2.approxPolyDP(c,eps,True)[:,0].astype(float); return c,m
tier=np.load('m_tier.npy'); corn=np.load('m_corn.npy'); door=(cv2.imread('m_door.png',0)>128).astype(np.uint8)
out={}
# tier: wall plane from tier minus door minus the cornice area
tw=(tier>0)&(door==0); p0,n,dv=vplane(tw.astype(np.uint8))
c,_=contour(((tier>0)|(door>0)).astype(np.uint8)); W,_=hit(c[:,0],c[:,1],p0,n)
out['tier']=dict(poly=W.tolist(),n=n.tolist(),depth=3.0)
# door recess: metric depth = MoGe depth of door pixels minus wall-plane hit distance along the same rays
vv,u=np.nonzero(cv2.erode(door,np.ones((5,5),np.uint8))); _,tw_=hit(u.astype(float),vv.astype(float),p0,n)
ddepth=float(np.median(D[vv,u]-tw_)); cd,_=contour(door,0.8); Wd,_=hit(cd[:,0],cd[:,1],p0,n)
out['door']=dict(poly=Wd.tolist(),n=n.tolist(),depth_measured=ddepth,depth=float(np.clip(ddepth,0.8,2.5)))
# cornice: own plane; split slab vs icicle fringe from the bottom profile
cp0,cn,cdv=vplane(corn)
cols=np.nonzero(corn.any(0))[0]; bot=np.array([np.nonzero(corn[:,x])[0].max() for x in cols]); topr=np.array([np.nonzero(corn[:,x])[0].min() for x in cols])
from scipy.ndimage import minimum_filter1d,maximum_filter1d,uniform_filter1d
slab_bot=uniform_filter1d(minimum_filter1d(bot,25).astype(float),15)   # upper envelope of fringe = slab underside
slab=corn.copy()
for x,sb in zip(cols,slab_bot): slab[int(sb)+1:,x]=0
cs,_=contour(slab); Ws,_=hit(cs[:,0],cs[:,1],cp0,cn)
out['cornice']=dict(poly=Ws.tolist(),n=cn.tolist(),depth=2.2)
# icicles: local tips of bottom profile hanging below slab
ic=[]; L=bot-slab_bot; i=0
mx=maximum_filter1d(bot,7)
for k,x in enumerate(cols):
    if bot[k]==mx[k] and L[k]>4:
        wcol=max(2,int(np.sum(corn[int(slab_bot[k])+2,max(0,x-6):x+7])))  # width just under slab
        A_,_=hit(np.array([x+0.]),np.array([slab_bot[k]]),cp0,cn); B_,_=hit(np.array([x+0.]),np.array([bot[k]+0.]),cp0,cn)
        wA,_=hit(np.array([x-wcol/2]),np.array([slab_bot[k]]),cp0,cn); r=float(np.linalg.norm(A_[0]-wA[0]))
        ic.append(dict(top=(A_[0]+cn*0.0).tolist(),tip=B_[0].tolist(),r=max(r,0.04)))
# dedupe close icicles
ded=[]
for e in sorted(ic,key=lambda e:-np.linalg.norm(np.array(e['top'])-np.array(e['tip']))):
    if all(np.linalg.norm(np.array(e['top'])[:2]-np.array(f['top'])[:2])>1.2*max(e['r'],f['r']) for f in ded): ded.append(e)
out['icicles']=ded
out['planes']=dict(tier_dist=float(np.linalg.norm(p0-CAM)),corn_dist=float(np.linalg.norm(cp0-CAM)),corn_ahead_of_wall_m=float((cp0-p0)@n))
json.dump(out,open('kit.json','w'))
print('door depth measured',ddepth,'icicles',len(ded),out['planes'],'tier verts',len(W),'corn verts',len(Ws))
print('tier z range',W[:,2].min(),W[:,2].max(),'corn z',Ws[:,2].min(),Ws[:,2].max())

import numpy as np,cv2,json
exec(open('kitfit.py').read().split("tier=np.load")[0])   # reuse camera, hit(), vplane(), contour()
K=json.load(open('kit.json'))
tier=np.load('m_tier.npy'); corn=np.load('m_corn.npy'); door=(cv2.imread('m_door.png',0)>128).astype(np.uint8)
tw=(tier>0)&(door==0); p0,n,dv=vplane(tw.astype(np.uint8))
# step lines read from the key at column 200 (dark fronts / bright treads), rows bottom->top
c=200.; rows=dict(f1b=624,f1t=576,t1b=540,f2t=496,t2b=464,f3t=424,t3b=408)
def hz(u,vv,z):  # ray hit with horizontal plane z
    r=rays(np.array([u]),np.array([vv]))[0]; t=(z-CAM[2])/r[2]; return CAM+r*t
steps=[]; plane=p0.copy()
B,_=hit(np.array([c]),np.array([rows['f1b']+0.]),plane,n); zb=B[0][2]
for top,back in [('f1t','t1b'),('f2t','t2b'),('f3t','t3b')]:
    Tp,_=hit(np.array([c]),np.array([rows[top]+0.]),plane,n); zt=Tp[0][2]
    Pb=hz(c,rows[back],zt); tread=float((Tp[0]-Pb)@n)
    steps.append(dict(z0=float(zb),z1=float(zt),front=float((plane-p0)@n),tread=tread))
    plane=plane-n*tread; zb=zt
# tier1 outline from SAM on the wall plane (keeps the key outline)
ct,_=contour(((tier>0)|(door>0)).astype(np.uint8)); W,_=hit(ct[:,0],ct[:,1],p0,n)
# cornice: overhang rule = in front of the wall
OVER=1.0; cp=p0+n*OVER
cols=np.nonzero(corn.any(0))[0]; bot=np.array([np.nonzero(corn[:,x])[0].max() for x in cols])
from scipy.ndimage import minimum_filter1d,maximum_filter1d,uniform_filter1d
sb=uniform_filter1d(minimum_filter1d(bot,25).astype(float),15); slab=corn.copy()
for x,s_ in zip(cols,sb): slab[int(s_)+1:,x]=0
cs,_=contour(slab); Ws,_=hit(cs[:,0],cs[:,1],cp,n)
ic=[]
for e in K['icicles']:
    def rep(P):
        q=(np.array(P)-CAM)@R; u=F*q[0]/q[1]+512; v_=F*(-q[2])/q[1]+512; return hit(np.array([u-.5]),np.array([v_-.5]),cp,n)[0][0]
    a=rep(e['top']); b=rep(e['tip']); ic.append(dict(top=a.tolist(),tip=b.tolist(),r=e['r']*np.linalg.norm(cp-CAM)/36.0))
cd,_=contour(door,0.8); Wd,_=hit(cd[:,0],cd[:,1],p0,n)
out=dict(n=n.tolist(),p0=p0.tolist(),steps=steps,tier1=W.tolist(),cornice=Ws.tolist(),over=OVER,icicles=ic,door=Wd.tolist(),door_depth=float(np.clip(K['door']['depth_measured'],1.2,2.5)))
json.dump(out,open('kit3.json','w'))
for s_ in steps: print({k:round(v,2) for k,v in s_.items()})
print('tier1 z',W[:,2].min(),W[:,2].max(),'corn z',Ws[:,2].min(),Ws[:,2].max(),'door depth',out['door_depth'])

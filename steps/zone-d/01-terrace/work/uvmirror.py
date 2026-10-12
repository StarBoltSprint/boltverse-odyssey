"""Negative-UV-scale (mirrored island) check on a builder OBJ: per triangle sign of (dP/du x dP/dv) . n (n = winding normal).
Negative = the plate is shown mirrored on that triangle. Reports counts per material and on the door jambs (|n.x|>0.9 near a door)."""
import sys, numpy as np, json
V=[];T=[];F=[];M=[];cur=None
for l in open(sys.argv[1]):
    if l.startswith('v '): V.append([float(x) for x in l.split()[1:4]])
    elif l.startswith('vt '): T.append([float(x) for x in l.split()[1:3]])
    elif l.startswith('usemtl'): cur=l.split()[1]
    elif l.startswith('f '):
        p=[t.split('/') for t in l.split()[1:4]]; F.append([(int(a)-1,int(b)-1) for a,b in p]); M.append(cur)
V=np.array(V);T=np.array(T);out={}
jneg=jn=0
for f,m in zip(F,M):
    P=V[[a for a,_ in f]];Q=T[[b for _,b in f]]
    e1,e2=P[1]-P[0],P[2]-P[0];d1,d2=Q[1]-Q[0],Q[2]-Q[0];det=d1[0]*d2[1]-d1[1]*d2[0]
    if abs(det)<1e-14: continue
    n=np.cross(e1,e2); dPu=(e1*d2[1]-e2*d1[1])/det; dPv=(e2*d1[0]-e1*d2[0])/det
    s=np.dot(np.cross(dPu,dPv),n); o=out.setdefault(m,[0,0]); o[1]+=1; o[0]+=s<0
    nn=n/np.linalg.norm(n); c=P.mean(0)
    if abs(nn[0])>0.9 and c[2]<0.01 and c[2]>-1.6 and abs(c[0])<3 and c[1]<4: jn+=1; jneg+=s<0
r=dict(perMaterial={k:dict(mirroredTris=int(v[0]),tris=v[1]) for k,v in out.items()},tier1JambTris=jn,tier1JambMirrored=int(jneg))
print(json.dumps(r)); json.dump(r,open(sys.argv[2],'w'),indent=1) if len(sys.argv)>2 else None

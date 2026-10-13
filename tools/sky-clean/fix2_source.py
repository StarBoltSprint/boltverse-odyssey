# generic band/cluster removal: bg fill by masked normalized convolution + star thinning to surround density
import numpy as np, cv2, sys, json
from scipy import ndimage as nd
D='/workspace/zd-bible-1012/zd-plates/sky12/'
src,dst,poly,thin,dobg=sys.argv[1],sys.argv[2],json.loads(sys.argv[3]),float(sys.argv[4]),sys.argv[5]=='1'
a=cv2.imread(D+src).astype(np.float32); H,W=a.shape[:2]
m=np.zeros((H,W),np.uint8)
cv2.fillPoly(m,[np.array([[x*W,y*H] for x,y in poly],np.int32)],1)
mf=cv2.GaussianBlur(m.astype(np.float32),(0,0),20)[...,None]
def mfill(img,sig):  # fill masked area from outside
    w=(1-m).astype(np.float32)
    num=cv2.GaussianBlur(img*w[...,None] if img.ndim==3 else img*w,(0,0),sig)
    den=cv2.GaussianBlur(w,(0,0),sig)
    return num/np.maximum(den[...,None] if img.ndim==3 else den,1e-4)
bg=np.stack([cv2.GaussianBlur(cv2.morphologyEx(a[...,c],cv2.MORPH_OPEN,np.ones((7,7))),(0,0),4) for c in range(3)],-1)
stars=a-bg
def colfill(bg):
    out=bg.copy(); cols=np.where(m.any(0))[0]
    tops=np.full(W,-1); bots=np.full(W,-1)
    for x in cols:
        ys=np.where(m[:,x])[0]; tops[x]=max(ys[0]-1,10); bots[x]=min(ys[-1]+1,H-11)
    T=np.zeros((W,3),np.float32); B=np.zeros((W,3),np.float32)
    for x in cols:
        T[x]=bg[tops[x]-10:tops[x],x].mean(0); B[x]=bg[bots[x]:bots[x]+10,x].mean(0)
    for arr in (T,B):
        arr[cols]=nd.gaussian_filter1d(arr[cols],25,axis=0)
    for x in cols:
        n_=bots[x]-tops[x]; t=np.linspace(0,1,n_)[:,None]
        out[tops[x]:bots[x],x]=T[x]*(1-t)+B[x]*t
    return out
newbg=bg*(1-mf)+colfill(bg)*mf if dobg else bg
L=a.mean(-1)
dog=cv2.GaussianBlur(L,(0,0),.6)-cv2.GaussianBlur(L,(0,0),2)
sm=dog>np.percentile(dog,float(sys.argv[6]) if len(sys.argv)>6 else 99.0)
lab,n=nd.label(sm)
cen=nd.center_of_mass(sm,lab,range(1,n+1))
dens=cv2.GaussianBlur(sm.astype(np.float32),(0,0),12)
ref=mfill(dens,60)
kp=np.clip(ref/np.maximum(dens,1e-6),0,1)**thin
rng=np.random.default_rng(4); kill=np.zeros((H,W),bool); sl=nd.find_objects(lab)
for i,(cy,cx) in enumerate(cen):
    iy,ix=int(cy),int(cx)
    if mf[iy,ix,0]>0.3 and rng.random()>kp[iy,ix]:
        s=sl[i]; kill[s]|=lab[s]==i+1
kill=cv2.dilate(kill.astype(np.uint8),np.ones((5,5)))>0
stars[kill]=0
out=np.clip(newbg+stars,0,255).round().astype(np.uint8)
out=cv2.inpaint(out,kill.astype(np.uint8),3,cv2.INPAINT_TELEA) if not dobg else out
cv2.imwrite(D+dst,out,[cv2.IMWRITE_JPEG_QUALITY,95])
print(dst,'killed',nd.label(kill)[1])

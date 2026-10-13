import cv2,numpy as np
def seamless(a):
    h,w=a.shape[:2]; s=np.roll(np.roll(a,h//2,0),w//2,1).astype(np.float32)
    y=np.abs(np.linspace(-1,1,h))[:,None];x=np.abs(np.linspace(-1,1,w))[None]
    m=np.clip(np.maximum(x,y)*1.6-0.6,0,1)[...,None]; return a*(1-m)+s*m
def height(c):
    l=cv2.cvtColor(c.astype(np.uint8),cv2.COLOR_BGR2GRAY).astype(np.float32)/255
    h=cv2.GaussianBlur(l,(0,0),2)-cv2.GaussianBlur(l,(0,0),30)  # bright=proud, dark joints=deep
    e=cv2.Canny(c.astype(np.uint8),60,140).astype(np.float32)/255; h-=0.15*cv2.GaussianBlur(e,(0,0),1.5)
    h=(h-np.percentile(h,1))/(np.percentile(h,99)-np.percentile(h,1)); return np.clip(h,0,1)
def hexbake(img,hgt,tile_m,out_m,ppm,rot,seed=1):
    N=int(out_m*ppm); T=img.shape[0]; rng=np.random.default_rng(seed)
    full=np.dstack([img,hgt[...,None]*255]).astype(np.float32); mean=full.reshape(-1,4).mean(0)
    yy,xx=np.mgrid[0:N,0:N].astype(np.float32); u=xx/ppm/tile_m; v=yy/ppm/tile_m   # tile units
    s=2.0  # hex cells per tile unit
    # skewed simplex grid
    U=u*s; V=v*s; sk=(U+V)*0.3660254; i0=np.floor(U+sk); j0=np.floor(V+sk)
    un=(i0+j0)*0.2113249; x0=U-(i0-un); y0=V-(j0-un); upper=(x0>y0)
    off=[(0,0),(np.where(upper,1,0),np.where(upper,0,1)),(1,1)]
    out=np.zeros((N,N,4),np.float32); wsum2=np.zeros((N,N),np.float32); ws=[];samples=[]
    for di,dj in off:
        ci=i0+di; cj=j0+dj; uu=ci-(ci+cj)*0.2113249; vv=cj-(ci+cj)*0.2113249
        dx=x0-(uu-(i0-un)); dy=y0-(vv-(j0-un)); w=np.maximum(0.5-dx*dx-dy*dy,0)**2
        hsh=(ci.astype(np.int64)*73856093^cj.astype(np.int64)*19349663)&0xffff
        ox=((hsh*0.6180339)%1.0); oy=((hsh*0.4142135)%1.0)
        uu2=u+ox; vv2=v+oy
        if rot:
            a=(hsh%4)*np.pi/2; cu,cv_=np.cos(a),np.sin(a); uu2,vv2=u*cu-v*cv_+ox,u*cv_+v*cu+oy
        px=((uu2%1)*T).astype(np.int32)%T; py=((vv2%1)*T).astype(np.int32)%T
        ws.append(w); samples.append(full[py,px])
    W=np.stack(ws); W=W**3; W/=W.sum(0)+1e-8   # sharpen
    for w,sm in zip(W,samples): out+=w[...,None]*(sm-mean)
    out=out/np.sqrt((W**2).sum(0))[...,None]+mean   # variance preserving
    return np.clip(out,0,255)
b=seamless(cv2.imread('tex/basalt_src.jpg').astype(np.float32))
s0=cv2.imread('tex/snow2.jpg'); h,w=s0.shape[:2]; s0=s0[:,(w-h)//2:(w-h)//2+h]; s=seamless(cv2.resize(s0,(1024,1024),interpolation=cv2.INTER_CUBIC).astype(np.float32))
for n,c,tm,rot in [('basalt',b,2.0,False),('snow',s,1.2,True)]:
    hg=height(c); cv2.imwrite(f'tex/{n}_c.jpg',c.astype(np.uint8),[cv2.IMWRITE_JPEG_QUALITY,92]); cv2.imwrite(f'tex/{n}_h.png',(hg*65535).astype(np.uint16))
    ppm=512; N=int(10.24*ppm); reps=int(np.ceil(N/ (tm*ppm)))
    pl=cv2.resize(np.dstack([c,hg[...,None]*255]),(int(tm*ppm),int(tm*ppm)),interpolation=cv2.INTER_AREA); pl=np.tile(pl,(reps,reps,1))[:N,:N]
    hx=hexbake(c,hg,tm,10.24,ppm,rot)
    for tag,a in [('plain',pl),('hex',hx)]:
        cv2.imwrite(f'tex/{n}_{tag}_c.jpg',a[...,:3].astype(np.uint8),[cv2.IMWRITE_JPEG_QUALITY,90]); cv2.imwrite(f'tex/{n}_{tag}_h.png',(a[...,3]/255*65535).astype(np.uint16))
        g=cv2.cvtColor(a[...,:3].astype(np.uint8),cv2.COLOR_BGR2GRAY).astype(np.float32); g=g[:512]; g-=g.mean(1,keepdims=True)
        F_=np.fft.rfft(g,n=2*N,axis=1); ac=np.fft.irfft(F_*np.conj(F_),axis=1)[:,:N].mean(0); ac/=ac[0]
        lag0=int(0.3*ppm); k=lag0+np.argmax(ac[lag0:int(0.9*N)])
        print(n,tag,'autocorr_peak',round(float(ac[k]),3),'at_lag_m',round(k/ppm,2))

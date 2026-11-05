import sys,subprocess,numpy as n,cv2
W,H=360,640
for f in sys.argv[1:]:
  r=subprocess.run(['ffmpeg','-loglevel','error','-i',f,'-vf',f'scale={W}:{H}','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True).stdout
  X=n.frombuffer(r,n.uint8).reshape(-1,H,W,3); out=[];pl=None
  for x in X:
    R,G,B=[x[...,i].astype(int) for i in range(3)]; g=cv2.cvtColor(x,cv2.COLOR_RGB2GRAY).astype(n.float32)
    reg=g[int(H*.62):int(H*.95)]; reg=n.concatenate([reg[:,:int(W*.36)],reg[:,int(W*.64):]],1)
    hf=n.abs(reg-cv2.GaussianBlur(reg,(0,0),2)).mean(); mf=n.abs(cv2.GaussianBlur(reg,(0,0),2)-cv2.GaussianBlur(reg,(0,0),8)).mean()
    bm=(R>150)&(R>=B+12)&(G>=B+4)&(n.abs(R-G)<40)
    leg=bm[int(H*.80):int(H*.93),int(W*.40):int(W*.60)]
    lg=0 if pl is None else (leg^pl).sum()/max(leg.sum(),1); pl=leg; out.append([hf,mf,lg,leg.mean()])
  A=n.array(out); print(f.split('/')[-1])
  for k in range(len(A)//30): print(k, *n.median(A[k*30:k*30+30],0).round(3))

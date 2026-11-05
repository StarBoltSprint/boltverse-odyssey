import sys,subprocess,numpy as n,cv2
f=sys.argv[1]; W,H=360,640
r=subprocess.run(['ffmpeg','-loglevel','error','-i',f,'-vf',f'scale={W}:{H}','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True).stdout
X=n.frombuffer(r,n.uint8).reshape(-1,H,W,3)
rows=[];prevleg=None
for x in X:
  R,G,B=[x[...,i].astype(int) for i in range(3)]
  sky=(B>R+25)&(B>G)  # blue sky
  rs=sky.mean(1); hz=int(n.argmax(rs<0.5)) if (rs<0.5).any() else H
  g=cv2.cvtColor(x,cv2.COLOR_RGB2GRAY); e=cv2.Canny(g,60,140)>0
  gm=n.zeros_like(e); gm[min(hz+8,H):int(H*.95)]=1; gm[:, int(W*.36):int(W*.64)]=0
  E=e[gm>0].mean() if gm.sum() else 0
  ls=cv2.HoughLinesP((e&gm>0).astype(n.uint8)*255,1,n.pi/180,40,minLineLength=60,maxLineGap=3)
  Ln=0 if ls is None else len(ls)
  tr=(G>R*1.12)&(G>B*1.15)&(G<150); lv=cv2.Laplacian(g,cv2.CV_32F); tex=n.abs(cv2.GaussianBlur(lv,(7,7),0))>6
  T=(tr&tex)[:int(H*.6)].mean()
  bm=(R>185)&(G>170)&(B>150)&(n.abs(R-B)<60)
  leg=bm[int(H*.80):int(H*.93),int(W*.40):int(W*.60)]
  LEG=0.0 if prevleg is None else (leg^prevleg).sum()/max(leg.sum(),1); prevleg=leg
  cy=(B>170)&(G>160)&(R<160)&(B>R+30)
  PU=cy[:int(H*.5),int(W*.4):int(W*.6)].mean(); PD=cy[int(H*.85):,int(W*.4):int(W*.6)].mean()
  top=x[:int(H*.12)].reshape(-1,3).mean(0); gnd=x[int(H*.7):].reshape(-1,3).mean(0)
  gb=cv2.GaussianBlur(g,(3,3),0); e2=(cv2.Canny(gb,12,30)>0)&(gm>0)
  l2=cv2.HoughLinesP(e2.astype(n.uint8)*255,1,n.pi/360,60,minLineLength=110,maxLineGap=6); L2=0 if l2 is None else len(l2)
  rows.append([E,Ln,T,LEG,PU,PD,hz/H,*top,*gnd,g[min(hz+8,H-1):].std() if hz<H-10 else 0, L2])
n.save(sys.argv[2],n.array(rows)); print(len(rows))

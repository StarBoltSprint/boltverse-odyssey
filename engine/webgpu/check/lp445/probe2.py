import sys,subprocess,numpy as n,cv2
W,H=360,640
def legs(f):
  r=subprocess.run(['ffmpeg','-loglevel','error','-i',f,'-vf',f'scale={W}:{H}','-f','rawvideo','-pix_fmt','gray','-'],capture_output=True).stdout
  X=n.frombuffer(r,n.uint8).reshape(-1,H,W).astype(n.float32); o=[]
  y0,y1=int(H*.80),int(H*.93)
  for i in range(1,len(X)):
    d=n.abs(X[i]-X[i-1])[y0:y1]
    L=d[:,int(W*.42):int(W*.58)].mean(); S=n.concatenate([d[:,int(W*.12):int(W*.30)],d[:,int(W*.70):int(W*.88)]],1).mean()
    o.append(L/(S+1.0))
  return n.array([0]+o)
if __name__=='__main__':
  A=legs(sys.argv[1]); print([round(float(n.median(A[k*30:k*30+30])),2) for k in range(len(A)//30)])

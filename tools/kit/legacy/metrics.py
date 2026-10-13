import cv2,numpy as np,json,sys
V=sys.argv[1]
key=cv2.imread('/workspace/zd-bible-1012/key-zd1-b.jpg'); r=cv2.imread(f'out/R-{V}-1-keycam.png')
m=cv2.imread(f'out/R-{V}-mask.png',0)>128
sam=(np.load('m_tier.npy')|np.load('m_corn.npy'))>0
iou=(m&sam).sum()/(m|sam).sum()
lab=lambda x:cv2.cvtColor(x.astype(np.float32)/255,cv2.COLOR_BGR2LAB)
res={'iou':round(float(iou),3)}
gain={}
for nm,mf in [('tier','m_tier.npy'),('cornice','m_corn.npy')]:
    mk=(np.load(mf)>0)&m
    k=lab(key)[mk].mean(0); q=lab(r)[mk].mean(0); res[f'dE_{nm}']=round(float(np.linalg.norm(k-q)),2)
    gain[nm]=((key[mk].mean(0)/np.maximum(r[mk].mean(0),1))[::-1]**2.2).tolist()   # rgb linear
res['gain_suggest']=gain; print(json.dumps(res)); json.dump(res,open(f'out/metrics-{V}.json','w'))

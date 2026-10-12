import sys, json, numpy as np
sys.path.insert(0,'/workspace/grokcli/wt/zd-terrace-1012/tools')
from common.vision_models import depth_moge, mask_sam2
from PIL import Image
from scipy import ndimage as ndi
out={}
for name in ['plate-front','plate-side']:
    p=f'plates/{name}.jpg'; rgb=np.asarray(Image.open(p).convert('RGB')).astype(np.float32)
    m=mask_sam2(p,'base')[0].astype(bool); d=depth_moge(p,side=512)[0]
    d=np.asarray(Image.fromarray(d).resize((1024,1024),Image.BILINEAR))
    lum=rgb.mean(2); ys,xs=np.nonzero(m)
    r=dict(bbox=[int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())], area=int(m.sum()))
    # dark doorways inside mask
    dark=(lum<38)&ndi.binary_erosion(m,iterations=4)
    dark=ndi.binary_opening(dark,iterations=3); lab,n=ndi.label(dark)
    doors=[]
    for i,sl in enumerate(ndi.find_objects(lab)):
        h=sl[0].stop-sl[0].start; w=sl[1].stop-sl[1].start
        if h>40 and w>25 and h>w*0.9:
            dm=lab==i+1; ring=ndi.binary_dilation(dm,iterations=25)&~ndi.binary_dilation(dm,iterations=8)&m&(lum>45)&(lum<170)
            doors.append(dict(box=[sl[1].start,sl[0].start,sl[1].stop,sl[0].stop],dDoor=float(np.median(d[dm])),dWall=float(np.median(d[ring]))))
    snow=(lum>170)&m; rows=snow.mean(1)
    r.update(doors=doors, snowRows=[int(y) for y in np.nonzero(rows>0.25*m.any(1).astype(float)*rows.max())[0]][:2000:1])
    # silhouette width per row
    r['rowWidth']=[int(v) for v in m.sum(1)]; r['colTop']=[int(np.argmax(c)) if c.any() else -1 for c in m.T]
    np.save(f'work/{name}-mask.npy',m); np.save(f'work/{name}-depth.npy',d)
    out[name]=r
json.dump(out,open('work/analysis.json','w'))
for k,v in out.items(): print(k,v['bbox'],[ (x['box'],round(x['dDoor']-x['dWall'],3),round(x['dWall'],2)) for x in v['doors']])

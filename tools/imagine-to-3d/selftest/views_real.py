# views gate on REAL Imagine views (mesaA plates 10-09, tower m2/m4 views 10-08). Those views were made as near-ortho
# level plates, so the plan describes THEIR cameras (elev 0, long lens) instead of the profile's 12-camera set.
import sys, json, os, shutil, numpy as np
sys.path.insert(0,'/workspace/grokcli/wt/i23d-upgrade/tools/imagine-to-3d')
import views as VW, i23d_common as C
from PIL import Image
W='/workspace/i23d-upgrade-work/vt'
CAMS=lambda names: [dict(name=n, yaw={'y000':0,'y045':45,'y090':90,'y180':180,'y270':270,'top':0}[n], elev=90 if n=='top' else 0) for n in names]
def run(name, crop, typ, h, coarse_dir, seq, cams):
    out=f'{W}/plan-{name}'; shutil.rmtree(out, ignore_errors=True)
    P=VW.plan(C.load_profile(typ), h, coarse_dir, crop, out, vfov=12, cameras=CAMS(cams))
    print(name, 'plan totals', P['totals'], 'required px/m', P['requiredPxPerM'])
    res=[]
    for cam, img, mask, expect in seq:
        Pp=json.load(open(f'{out}/views-plan.json'))
        for v in Pp['views']:
            if v['name']==cam: v['nativeSize']=list(Image.open(img).size)   # pre-tool views: their own native size
        C.dump(Pp, f'{out}/views-plan.json')
        r=VW.accept(f'{out}/views-plan.json', cam, img, mask); r['expected']=expect; r['ok']=True if expect=='finding' else (r['status']=='accepted')==(expect=='accept')
        print(' ', 'OK ' if r['ok'] else 'XX ', cam, os.path.basename(img), r); res.append(r)
    return res
mp='/workspace/zb-preview-1008/mesas'; tv='/workspace/zb-bible-1008/objects1-redo/views'
R={}
R['mesaA']=run('mesaA',f'{mp}/mesaA-front.jpg','rock',45,f'{W}/coarse-mesaA',
  [('y000',f'{mp}/mesaA-front.jpg',f'{W}/mesaA-front-mask.npy','accept'),('y090',f'{mp}/mesaA-side.jpg',f'{W}/mesaA-side-mask.npy','accept'),
   ('top',f'{mp}/mesaA-top.jpg',f'{W}/mesaA-top-mask.npy','accept'),('y180',f'{mp}/mesaA-back.jpg',f'{W}/mesaA-back-mask.npy','finding'),
   ('y270',f'{tv}/m2-side.jpg',f'{W}/m2-side-mask.npy','reject')], ['y000','y090','y180','y270','top'])
R['m2']=run('m2',f'{tv}/m2-front.jpg','building',100,f'{W}/coarse-m2',
  [('y000',f'{tv}/m2-front.jpg',f'{W}/m2-front-mask.npy','accept'),('y090',f'{tv}/m2-side.jpg',f'{W}/m2-side-mask.npy','accept'),
   ('top',f'{tv}/m2-top.jpg',f'{W}/m2-top-mask.npy','accept'),('y045',f'{tv}/m2-q45.jpg',f'{W}/m2-q45-mask.npy','accept')], ['y000','y045','y090','top'])
if not os.path.exists(f'{W}/coarse-m4/coarse.npz'):
    os.system(f"python3 /workspace/grokcli/wt/i23d-upgrade/tools/imagine-to-3d/coarse.py {tv}/m4-front.jpg --mask {W}/m4-front-mask.npy --type building --height-m 100 --out {W}/coarse-m4 > {W}/coarse-m4.log 2>&1")
R['m4']=run('m4',f'{tv}/m4-front.jpg','building',100,f'{W}/coarse-m4',
  [('y000',f'{tv}/m4-front.jpg',f'{W}/m4-front-mask.npy','accept'),('y090',f'{tv}/m4-side.jpg',f'{W}/m4-side-mask.npy','reject')], ['y000','y090'])
json.dump(R, open(f'{W}/views-real-results.json','w'), indent=1)
print('ALL OK' if all(r['ok'] for v in R.values() for r in v) else 'SOME UNEXPECTED')

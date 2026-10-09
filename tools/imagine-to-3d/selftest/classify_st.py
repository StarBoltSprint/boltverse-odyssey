import sys, json, glob, os
sys.path.insert(0,'/workspace/grokcli/wt/i23d-upgrade/tools/imagine-to-3d')
import classify as K
W='/workspace/i23d-upgrade-work/cls'
tune=[('rock',f'{W}/rock-mesaL.png'),('rock',f'{W}/rock-mesaR-arch.png'),('rock','/workspace/grokcli/wt/mesa-1009/in/crop-L-strata.png')]+[('building',f'/workspace/zb-bible-1008/objects1-redo/crops/{x}.png') for x in ['tA-ladder-slab','tB-tall-cable-slab','tC-sheared-top','tD-right-ladder-slab','tE-stub-antenna','spire']]+[('wreck',f'{W}/wreck-ship.png'),('wreck',f'{W}/wreck-panel.png'),('wreck',f'{W}/wreck-rail.png'),('wreck',f'{W}/prop-tablet.png'),('effect','/workspace/zb-bible-1008/stageSand/veil-a.jpg'),('effect','/workspace/zb-bible-1008/stageSand/grains.jpg'),('effect','/workspace/zb-bible-1008/stageSand/veil-b.jpg')]
held=[('building',f'{W}/ho-tower-right.png'),('building',f'{W}/ho-tower-mid.png'),('building',f'{W}/ho-tower-far.png'),('rock',f'{W}/ho-mesa-right.png'),('rock',f'{W}/ho-mesa-left-top.png'),('wreck',f'{W}/ho-debris-bottom.png'),('wreck',f'{W}/ho-truss-left.png')]
R={}
for name,S in (('tuning',tune),('held-out',held)):
    rows=[]
    for exp,p in S:
        r=K.classify(p)
        rows.append(dict(crop=os.path.basename(p), expected=exp, got=r['type'], conf=r['confidence'], margin=r['margin'], needsVision=r['needsVision'], gate=r['gateProfile'], views=r['profile']['views']['count']))
        print(name, 'OK ' if r['type']==exp else 'XX ', exp, r['type'], os.path.basename(p), 'margin', r['margin'], 'vision?', r['needsVision'])
    R[name]=dict(correct=sum(x['expected']==x['got'] for x in rows), total=len(rows), rows=rows)
r=K.classify(f'{W}/rock-mesaL.png', height_m=45); json.dump(r, open(f'{W}/type-profile-mesaL.json','w'), indent=1, default=str)
print({k:(v['correct'],v['total']) for k,v in R.items()})
json.dump(R, open(f'{W}/classify-selftest.json','w'), indent=1)

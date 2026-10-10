import sys, json, os
sys.path.insert(0,'/workspace/grokcli/wt/i23d-upgrade/tools/imagine-to-3d')
import compare as CM, i23d_common as C
W='/workspace/i23d-upgrade-work/st-cmp'; mp='/workspace/zb-preview-1008/mesas'; tv='/workspace/zb-bible-1008/objects1-redo/views'
items=[dict(id='cap', feature='flat caprock and upper tier', region=[420,140,860,300]), dict(id='strata', feature='strata bands mid wall', region=[300,330,1000,520]),
       dict(id='base', feature='talus at the foot', region=[150,520,1130,660]), dict(id='colours', feature='sandstone colours (vision)')]
cases=[('identity', f'{mp}/mesaA-front.jpg', f'{mp}/mesaA-front.jpg', 'rock', 'PASS*'),
       ('violet-perturbed', f'{mp}/mesaA-front.jpg', f'{W}/mesaA-front-violet.png', 'rock', 'FAIL'),
       ('mesa-v1-ingame (SmiR: dome)', f'{mp}/mesaA-front.jpg', f'{W}/mesa-v1-ingame-far.png', 'rock', 'FAIL'),
       ('wrong object (tower)', f'{mp}/mesaA-front.jpg', f'{tv}/m2-front.jpg', 'rock', 'FAIL')]
import compare as _cm
cap_hash=_cm.analyze_mod().phash({'img': f'{mp}/mesaA-front.jpg'})['hash']
recs={'object':'mesaA','items':{'colours':{'pass':True,'by':'selftest stand-in for a Grok-vision record','captures':{'front':cap_hash}}}}
R={}
for name,k,c,t,exp in cases:
    r=CM.compare(k,c,t,f'{W}/{name.split()[0]}',items=items,records=recs,key_mask=f'/workspace/i23d-upgrade-work/vt/mesaA-front-mask.npy' if 'mesaA-front.jpg' in k else None,
                 cap_mask=f'/workspace/i23d-upgrade-work/vt/mesaA-front-mask.npy' if c.endswith('mesaA-front.jpg') or c.endswith('violet.png') else None, object_id=name)
    vals={x['check']:(x['status'],x['value']) for x in r['rows']}
    R[name]=dict(verdict=r['verdict'], expected=exp, rows=vals, sheet=r['sheet'], checklist=[(x['id'],x['status'],x.get('ncc')) for x in r['checklist']])
    print(name, r['verdict'], 'expected', exp); [print('   ',k_, v) for k_,v in vals.items()]
json.dump(R, open(f'{W}/compare-selftest.json','w'), indent=1)

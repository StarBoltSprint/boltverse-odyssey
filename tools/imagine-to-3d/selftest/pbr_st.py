import sys, json
sys.path.insert(0,'/workspace/grokcli/wt/i23d-upgrade/tools/imagine-to-3d')
import pbr
W='/workspace/i23d-upgrade-work'
R={}
R['w1 fallback (colour plate only)']=pbr.bake('/workspace/zb-preview-1008/mesas/plates/w1.jpg',16,'rock',f'{W}/st-pbr/w1')
R['m2 tower view fallback']=pbr.bake('/workspace/zb-bible-1008/objects1-redo/views/m2-front.jpg',34,'building',f'{W}/st-pbr/m2')
R['w1 + real Imagine albedo/height plates']=pbr.bake('/workspace/zb-preview-1008/mesas/plates/w1.jpg',16,'rock',f'{W}/imagine-e2e/pbr-w1/bake',
    albedo=f'{W}/imagine-e2e/pbr-w1/w1-albedo.jpg', height=f'{W}/imagine-e2e/pbr-w1/w1-height.jpg')
out={k:{r['check']:(r['status'],r['value']) for r in v['rows']} for k,v in R.items()}
for k,v in out.items():
    print(k); [print('   ',a,b) for a,b in v.items()]
json.dump(out, open(f'{W}/st-pbr/pbr-selftest.json','w'), indent=1)

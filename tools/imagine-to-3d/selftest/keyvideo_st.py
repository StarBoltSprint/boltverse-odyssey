import sys, json, os, shutil
sys.path.insert(0,'/workspace/grokcli/wt/i23d-upgrade/tools/imagine-to-3d')
import keyvideo as KV, coarse as CO, views as VW, i23d_common as C
W='/workspace/i23d-upgrade-work/st-kv'; shutil.rmtree(W, ignore_errors=True)
R={}
b=KV.request('/workspace/zb-bible-1008/key-city3.jpg', f'{W}/stub'); R['stub request']=dict(ok=os.path.exists(b) and C.read_yaml(f'{W}/stub/ideas.yaml')['status']=='pending-video', batch=b)
v='/workspace/i23d-upgrade-work/imagine-e2e/keyvideo/keyvideo.mp4'
ideas=KV.analyze('/workspace/zb-bible-1008/key-city3.jpg', v, f'{W}/real')
R['analyze real Imagine key video']=dict(ok=ideas['geometry']=='forbidden' and len(ideas['checklistCandidates'])>0, motion=ideas['motion'], candidates=len(ideas['checklistCandidates']))
frame=sorted(p for p in os.listdir(f'{W}/real/frames') if p.endswith('.png'))[0]
try:
    CO.build(f'{W}/real/frames/{frame}', 'rock', 45); R['guard: coarse refuses a video frame']=dict(ok=False)
except ValueError as e: R['guard: coarse refuses a video frame']=dict(ok=True, error=str(e)[:120])
print(json.dumps(R, indent=1)); json.dump(R, open(f'{W}/keyvideo-selftest.json','w'), indent=1)

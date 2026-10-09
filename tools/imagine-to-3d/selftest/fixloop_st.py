import sys, json
sys.path.insert(0,'/workspace/grokcli/wt/i23d-upgrade/tools/imagine-to-3d')
import fixloop as FL, i23d_common as C
R={}
acts=FL.gate_fix_actions(); missing=[a for a in acts if a not in FL.GATE_ACTION_CLASS]
R['gate FIX_ACTIONS covered']=dict(ok=not missing, actions=len(acts), missing=missing); print('coverage', len(acts), 'missing', missing)
# 1) the gate's own fixPlan() output (node, hooks/imagine-to-3d.mjs) on gate-format FAIL rows -> our actions
p=FL.plan(gate_plan='/workspace/i23d-upgrade-work/st-fix/fix-plan.json', obj_type='rock', out='/workspace/i23d-upgrade-work/st-fix/actions-gate.json')
m={a['failure']['check'] if 'check' in a['failure'] else a['failure']['key']: a['action'] for a in p['actions']}
m={a['failure']['key'].split('|')[-1]: a['action'] for a in p['actions']}; print(json.dumps(m, indent=1))
R['gate plan -> actions']=dict(ok=m.get('native Imagine px/m (plates only, unique pixels)')=='regen_section' and m.get('shadow colour neutral (not violet)')=='regen_albedo'
     and m.get('key checklist: every item verified on a current capture')=='vision' and m.get('grounding (no floating)')=='pipeline:sink', mapping=m)
# 2) compare report (violet perturbation selftest) -> actions
p2=FL.plan(compare='/workspace/i23d-upgrade-work/st-cmp/violet-perturbed/compare-report.json', obj_type='rock')
m2=[(a['failure']['key'].split('|')[-1], a['action']) for a in p2['actions']]; print(m2)
R['compare report -> actions']=dict(ok=any(x[1]=='regen_albedo' for x in m2), mapping=m2)
# 3) sharpness loop on the REAL w1 plate metrics (80 px/m at 16 m wide): regen_section halves the metres a plate covers
#    (the new plate is a fresh full-size Imagine edit; here SIMULATED by halving metresWide, no pixel is resampled)
state=dict(m=16.0)
def check():
    r=FL.check_plates([dict(path='/workspace/zb-preview-1008/mesas/plates/w1.jpg', metresWide=state['m'])], 135.3)
    return FL.collect(plates=r)
def apply(A):
    for a in A:
        if a['action']=='regen_section': state['m']/=2
r3=FL.run(check, apply, 'rock'); print('sharpness loop', r3['status'], r3['iterations'], state)
R['sharpness loop']=dict(ok=r3['status']=='PASS' and r3['iterations']==2, result=r3['status'], iterations=r3['iterations'], finalMetresWide=state['m'], pxPerM=1280/state['m'])
# 4) silhouette that never improves -> ladder regen_view -> refine_depth -> regen_view -> HARD FAIL at maxIterations (rock 4)
seen=[]
def check2(): return [dict(source='compare', key='compare|mesa|silhouette IoU', cls='silhouette', detail=0.71)]
def apply2(A): seen.extend(a['action'] for a in A)
r4=FL.run(check2, apply2, 'rock'); print('stuck loop', r4['status'], r4['iterations'], seen)
R['persistent silhouette -> hard fail']=dict(ok=r4['status']=='FAIL' and r4['iterations']==4 and seen==['regen_view','refine_depth','regen_view'], ladder=seen, iterations=r4['iterations'])
# 5) only vision items left -> NEEDS_REVIEW (never auto-pass)
r5=FL.run(lambda: [dict(source='compare-checklist', key='checklist|colours', cls='vision')], lambda A: None, 'rock'); print('vision-only', r5['status'])
R['vision-only -> NEEDS_REVIEW']=dict(ok=r5['status']=='NEEDS_REVIEW')
json.dump(R, open('/workspace/i23d-upgrade-work/st-fix/fixloop-selftest.json','w'), indent=1)
print('ALL OK' if all(v['ok'] for v in R.values()) else 'FAILS: '+str([k for k,v in R.items() if not v['ok']]))

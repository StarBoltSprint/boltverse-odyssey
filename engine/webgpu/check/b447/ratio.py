import json,numpy as np,sys
B={round(r['t'],3):r for r in json.load(open('bm_back_bbox.json'))}
for run in sys.argv[1:]:
  R=[r for r in json.load(open(run+'_bbox.json')) if round(r['t'],3) in B]
  t=np.array([r['t'] for r in R]); q=np.array([r['h']/B[round(r['t'],3)]['h'] for r in R]); db=np.array([(r['bot']-B[round(r['t'],3)]['bot'])/B[round(r['t'],3)]['h'] for r in R])
  k=np.array([r['k'] for r in R]); lb=np.array([r['lb'] for r in R]); a=np.array([r['ang'] for r in R])
  qs=np.array([np.median(q[np.abs(t-ti)<=0.5]) for ti in t]); dbs=np.array([np.median(db[np.abs(t-ti)<=0.5]) for ti in t])
  print(f"== {run}: on-screen bbox height vs straight-run Bolt at the same instant (1 s stride-median)")
  for n,m in [('straight',(k<0.02)&(np.abs(a)<8)),('blend',(k>0.02)&(k<0.98)),('left q3',(k>=0.98)&(lb==1)),('right q3',(k>=0.98)&(lb==2)),('ALL',k>-1)]:
    if m.sum(): print(f"  {n:9s} n={m.sum():3d} height {np.median(q[m])*100-100:+6.2f}%  smoothed {qs[m].min()*100-100:+.2f}..{qs[m].max()*100-100:+.2f}%  foot baseline {np.median(db[m])*100:+.2f}% of h")

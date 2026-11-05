import json,numpy as np
def ld(f): return {round(r['t'],3):r for r in json.load(open(f))}
for name,backs,runs in [('v13',['bm_back'],['bm_t4a','bm_t4b']),('g1',['g_back','g_back2'],['g_ta','g_tb']),('g2',['g_back','g_back2'],['g2_ta','g2_tb']),('g3',['g_back','g_back2'],['g3_ta','g3_tb']),('g5',['g5_back','g5_back2'],['g5_ta','g5_tb']),('g6e',['g6e_back','g6e_back2'],['g6e_ta','g6e_tb']),('g6f',['g6f_back','g6f_back2'],['g6f_ta','g6f_tb']),('g8',['g8_back','g8_back2'],['g8_ta','g8_tb'])]:
  B={}; [B.update(ld(b+'_bbox.json')) for b in backs]; q=[];k=[];hb=[]
  for r in runs:
    for t,e in ld(r+'_bbox.json').items():
      if t in B: q.append(e['h']/B[t]['h']); k.append(e['k']); hb.append(B[t]['h'])
  q=np.array(q);k=np.array(k);hb=np.array(hb)
  for n,m in [('blend',(k>0.02)&(k<0.98)),('q3',k>=0.98)]:
    print(f"{name} {n:5s} n={m.sum():3d} size vs straight: median {100*np.median(q[m])-100:+.1f}%  wobble p5..p95 {100*np.percentile(q[m],5)-100:+.1f}..{100*np.percentile(q[m],95)-100:+.1f}%  max|dev| {100*np.abs(q[m]-1).max():.1f}%")
  print(f"{name} straight-run height bob ±{50*(hb.max()-hb.min())/hb.mean():.1f}%")

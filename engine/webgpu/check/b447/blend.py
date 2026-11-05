import json,numpy as np,sys
R=json.load(open(sys.argv[1]+'_bbox.json')); t=np.array([r['t'] for r in R]); h=np.array([r['h'] for r in R],float); bot=np.array([r['bot'] for r in R],float)
ang=np.array([r['ang'] for r in R]); k=np.array([r['k'] for r in R]); lb=np.array([r['lb'] for r in R])
# gallop-cycle smoothing: 1 s rolling median (≈2 strides) removes the leg-swing, keeps any angle-driven size step
def roll(x): return np.array([np.median(x[np.abs(t-ti)<=0.5]) for ti in t])
hs,bs=roll(h),roll(bot); ref=np.median(h[np.abs(ang)<8]); refb=np.median(bot[np.abs(ang)<8])
print(f"straight ref h={ref:.1f}px bot={refb:.1f}px")
dev=(hs/ref-1)*100; print(f"smoothed h deviation over whole run: min {dev.min():+.2f}% max {dev.max():+.2f}%  (range {dev.max()-dev.min():.2f}%)")
for name,m in [('straight |a|<8',np.abs(ang)<8),('blend 0<k<1',(k>0.02)&(k<0.98)),('left q3 held',(k>=0.98)&(lb==1)),('right q3 held',(k>=0.98)&(lb==2))]:
  if m.sum(): print(f"{name:16s} n={m.sum():3d} h_med={np.median(h[m]):6.1f} ({(np.median(h[m])/ref-1)*100:+.2f}%) smoothed range {dev[m].min():+.2f}..{dev[m].max():+.2f}%  bot_med={np.median(bot[m]):.1f} ({(np.median(bot[m])-refb)/ref*100:+.2f}% of h)")

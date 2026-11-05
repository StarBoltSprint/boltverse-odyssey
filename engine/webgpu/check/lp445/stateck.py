# scene-state jump check: 1 s window medians, flag consecutive-window structural changes
import sys,numpy as n
A=n.load(sys.argv[1]); fps=30; nw=len(A)//fps
M=n.array([n.median(A[k*fps:(k+1)*fps],0) for k in range(nw)])
E,Ln,T,LEG,PU,PD,HZ=[M[:,i] for i in range(7)]; TOP=M[:,7:10]; GND=M[:,10:13]; GS=M[:,13]; L2=M[:,14]
legref=n.median(LEG[2:12]); fails=[]
import os; from probe2 import legs as _legs
_A=_legs(sys.argv[2]) if len(sys.argv)>2 else None
LR=None if _A is None else n.array([n.median(_A[k*30:k*30+30]) for k in range(len(_A)//30)])
print('legratio',None if LR is None else LR.round(2).tolist())
print(" t  edge  lines tree   leg   pathUp pathDn hz    gndRGB          topRGB")
for k in range(nw):
  fl=[]
  if k:
    if abs(E[k]-E[k-1])>0.04 and abs(E[k]-E[k-1])>0.4*max(E[k-1],E[k]): fl.append('EDGE-JUMP')
    if T[k-1]>0.03 and T[k]<0.45*T[k-1]: fl.append('TREES')
    if n.abs(GND[k]-GND[k-1]).max()>60: fl.append('GROUND')
    if n.abs(TOP[k]-TOP[k-1]).max()>45: fl.append('SKY')
    if min(HZ[k],HZ[k-1])>0.05 and abs(HZ[k]-HZ[k-1])>0.095: fl.append('HORIZON')
  if E[k]<0.05: fl.append('FLAT-GROUND')
  if L2[k]>=3 and E[k]<0.12: fl.append('GRID')
  if LR is not None and k<len(LR) and LR[k]<0.35: fl.append('FREEZE')  # v44b: leg/side diff ratio (eye-checked: white-mask XOR false-flagged clouds behind legs)
  if PU[k]>0.25: fl.append('PATH-DETACH')
  if fl: fails.append((k,fl))
  print(f"{k:2d} {E[k]:.3f} {Ln[k]:4.0f} {T[k]:.3f} {LEG[k]:.3f} {PU[k]:.3f} {PD[k]:.3f} {HZ[k]:.2f} {GND[k].round(0)} {TOP[k].round(0)} L2={L2[k]:.0f} {' '.join(fl)}")
print("leg ref",round(legref,3)); print("FAIL" if fails else "PASS", [(k,f) for k,f in fails])

import numpy as np, collections, sys
vs=[];vt=[];fs=[];ft=[];mats=[];cur=None
for ln in open('work/terrace-lod0.obj'):
  if ln.startswith('v '): vs.append([float(x) for x in ln.split()[1:4]])
  elif ln.startswith('vt '): vt.append([float(x) for x in ln.split()[1:3]])
  elif ln.startswith('usemtl'): cur=ln.split()[1]
  elif ln.startswith('f '): fs.append([int(t.split('/')[0])-1 for t in ln.split()[1:4]]); mats.append(cur)
V=np.array(vs);F=np.array(fs);T=V[F];n=np.cross(T[:,1]-T[:,0],T[:,2]-T[:,0]);n/=np.linalg.norm(n,axis=1,keepdims=True);UV=np.array(vt)[F].mean(1)
st=np.load('work/terrace-lod0-stretch.npy')
for v in sys.argv[1:]:
  z=np.load(f'renders/{v}-pass.npz');f=z['face'];c=z['cov']
  bad=f[c==0];sb=f[(f>=0)&(st[np.clip(f,0,None)]>1.3)]
  key=lambda i:(mats[i],tuple(np.round(n[i]).astype(int)),tuple(np.round(T[i].mean(0),0)),tuple(np.round(UV[i]*1024).astype(int)))
  print(v,'UNCOV',collections.Counter([key(i)[:2] for i in bad]).most_common(4), [key(i) for i in bad[::max(1,len(bad)//6)]])
  print('  STR',collections.Counter([key(i)[:2] for i in sb]).most_common(4),[key(i)[:3] for i in sb[::max(1,len(sb)//5)]])

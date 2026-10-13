import bpy,bmesh,numpy as np,math,mathutils,json,sys,os,time
D0='/workspace/alt3d-1013'; VAR=sys.argv[sys.argv.index('--')+1]; GAIN=json.loads(sys.argv[sys.argv.index('--')+2])
VOX=float(sys.argv[sys.argv.index('--')+3]) if len(sys.argv)>sys.argv.index('--')+3 else 0.025
t0=time.time()
SC=2.3;F=0.5957*1024;HC=6.93*SC
nc=np.array([0.0108,-0.9511,-0.3086]);c2b=lambda P:np.stack([P[...,0],P[...,2],-P[...,1]],-1)
nb=c2b(nc);nb/=np.linalg.norm(nb);z=np.array([0,0,1.]);v=np.cross(nb,z);s=np.linalg.norm(v);cc=nb@z
Vx=np.array([[0,-v[2],v[1]],[v[2],0,-v[0]],[-v[1],v[0],0]]);R=np.eye(3)+Vx+Vx@Vx*((1-cc)/s**2)
CAM=np.array([0,0,HC])
def proj(P):
    q=(P-CAM)@R; x,y,zz=q[...,0],-q[...,2],q[...,1]; return F*x/zz+512,F*y/zz+512,zz
bpy.ops.wm.read_factory_settings(use_empty=True); sc=bpy.context.scene
K=json.load(open(D0+'/kit3.json')); n=np.array(K['n']); d=np.cross(n,[0,0,1.]); d/=np.linalg.norm(d); p0=np.array(K['p0'])
TP=np.array(K['tier1']); base=float(np.percentile(TP[:,2],2)); A=TP[np.argmin(TP@d)].copy(); A[2]=base; A=A-n*((A-p0)@n)
RISE=2.5; TREAD=2.5   # rule: rise read from key lines (2.47-2.59 m), tread clamped from 5.3-8.0 m reading to 2.5 m
T={'width':float(np.ptp(TP@d)),'height':RISE}; top=base+RISE
def extrude(name,poly,nv,depth,front=0.0):
    me=bpy.data.meshes.new(name); bm=bmesh.new(); P=np.array(poly)+np.array(nv)*front
    vs=[bm.verts.new(p) for p in P]; f=bm.faces.new(vs)
    r=bmesh.ops.extrude_face_region(bm,geom=[f]); nvs=[e for e in r['geom'] if isinstance(e,bmesh.types.BMVert)]
    bmesh.ops.translate(bm,verts=nvs,vec=tuple(-np.array(nv)*(depth+front)))
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces); bm.to_mesh(me); ob=bpy.data.objects.new(name,me); sc.collection.objects.link(ob); return ob
def boxw(name,a0,a1,f0,f1,z0,z1):   # along d [a0,a1], along n [f1(back),f0(front)], z
    P=[A+d*x+n*y+np.array([0,0,zz-A[2]]) for x in (a0,a1) for y in (f0,f1) for zz in (z0,z1)]
    me=bpy.data.meshes.new(name); bm=bmesh.new(); vs=[bm.verts.new(p) for p in P]
    for f in [(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)]: bm.faces.new([vs[i] for i in f])
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces); bm.to_mesh(me); ob=bpy.data.objects.new(name,me); sc.collection.objects.link(ob); return ob
tier1=extrude('tier',K['tier1'],K['n'],TREAD+0.6)
door=extrude('door',K['door'],K['n'],K['door_depth'],0.3)
bo=tier1.modifiers.new('b','BOOLEAN'); bo.operation='DIFFERENCE'; bo.object=door; bo.solver='EXACT'
bpy.context.view_layer.objects.active=tier1; bpy.ops.object.modifier_apply(modifier='b'); bpy.data.objects.remove(door)
W_=T['width']; upper=[]
for i in (1,2):
    upper.append(boxw(f'up{i}',-0.5,W_+0.5,-TREAD*i,-TREAD*3-1.0,base,base+RISE*(i+1)))
corn=extrude('cornice',K['cornice'],K['n'],K['over']+0.3)
CP=np.array(K['cornice']); ca0=(CP-A)@d; cz0=float(np.percentile(CP[:,2],3))
sup=boxw('support',ca0.min()+0.6,ca0.max()-0.6,-0.4,-TREAD-0.6,base+RISE-0.5,cz0+0.25)   # door-house block the cornice rests on
upper.append(sup)
STATS_SUPPORT=dict(cornice_bottom_z=cz0,support_top_z=cz0+0.25,overlap_m=0.25)
cparts=[corn]
for e in K['icicles']:
    tp=np.array(e['top'])+np.array([0,0,0.15]); tip=np.array(e['tip']); L_=np.linalg.norm(tp-tip)
    bpy.ops.mesh.primitive_cone_add(vertices=8,radius1=max(e['r'],0.05),radius2=0.0,depth=L_,location=tuple((tp+tip)/2))
    c=bpy.context.active_object; c.rotation_euler=mathutils.Vector(tuple(tp-tip)).to_track_quat('Z','Y').to_euler(); cparts.append(c)
def merge(objs,name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]; bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    if len(objs)>1: bpy.ops.object.join()
    o=bpy.context.active_object; o.name=name
    bv=o.modifiers.new('bev','BEVEL'); bv.width=0.035; bv.segments=2; bv.limit_method='ANGLE'
    rm=o.modifiers.new('rm','REMESH'); rm.mode='VOXEL'; rm.voxel_size=VOX
    if int(os.environ.get('SUBDIV','0')):
        ss=o.modifiers.new('ss','SUBSURF'); ss.subdivision_type='SIMPLE'; ss.levels=ss.render_levels=int(os.environ['SUBDIV'])
    bpy.ops.object.convert(target='MESH'); o.data.materials.clear(); return o
upper_keep=os.environ.get('NOUPPER') is None
tier=merge([tier1]+upper if upper_keep else [tier1,sup],'tier')
if not upper_keep: upper.remove(sup)
if not upper_keep:
    for u_ in upper: bpy.data.objects.remove(u_)
corn=merge(cparts,'cornice')
kit=tier
# textures for displacement
def ld(nm): 
    return np.load(f'{D0}/tex/{nm}_{VAR}_h.npy').astype(np.float32)
H={'basalt':ld('basalt'),'snow':ld('snow')}; N=H['basalt'].shape[0]; PPM=N/10.24
edges=np.load(D0+'/edges.npy')
def samp(h,a,b): return h[((-b*PPM).astype(int))%N,((a*PPM).astype(int))%N]
stats={}
AMP=float(os.environ.get('AMP','1'))
cmask=np.load(D0+'/m_corn.npy'); import math as _m

BLK=np.load(D0+'/blocks.npy').astype(np.float32); NB=BLK.shape[0]; PB=NB/10.24
def bsamp(a,b):
    x=(a*PB)%NB; y=(-b*PB)%NB; x0=np.floor(x).astype(int); y0=np.floor(y).astype(int); fx=x-x0; fy=y-y0
    g=lambda yy,xx: BLK[yy%NB,xx%NB]
    return (g(y0,x0)*(1-fx)+g(y0,x0+1)*fx)*(1-fy)+(g(y0+1,x0)*(1-fx)+g(y0+1,x0+1)*fx)*fy
rng=np.random.default_rng(3)
stats={}; ICE=[]
def drift_and_blocks(ob,is_corn):
    me=ob.data; P=np.array([x.co for x in me.vertices]); Nn=np.array([x.normal for x in me.vertices])
    up=np.clip((Nn[:,2]-0.45)/0.3,0,1); vert=np.abs(Nn[:,2])<0.6
    u0,v0,z0=proj(P); ui0=np.clip(u0.astype(int),0,1023); vi0=np.clip(v0.astype(int),0,1023)
    Dk=np.load(D0+'/key-depth.npy')*SC; vis0=z0<Dk[vi0,ui0]*1.04+0.6
    fade=np.clip(np.load(D0+'/sildist.npy')[vi0,ui0]/12.0,0,1)
    ks=np.load(D0+'/keysnow.npy')[vi0,ui0]*vis0
    fn=P@n; dd=P@d
    # blocks on vertical stone faces: triplanar-in-wall-frame, protrude 0.20-0.40, joints at 0
    disp=np.zeros(len(P))
    if not is_corn:
        wn=np.abs(Nn@n); wd=np.abs(Nn@d); s_=wn+wd+1e-6
        b=(wn*bsamp(dd,P[:,2])+wd*bsamp(fn,P[:,2]))/s_
        disp+=np.where(vert,b,0)
    # drifts: up-facing verts, per (z-band, d-bin) front edge
    zb=np.round(P[:,2]/0.35).astype(int); db=np.floor(dd/0.5).astype(int)
    lift=np.zeros(len(P)); fwd=np.zeros(len(P)); drape=np.zeros(len(P))
    upm=up>0.5
    fronts={}
    for k in set(zip(zb[upm].tolist(),db[upm].tolist())):
        sel=upm&(zb==k[0])&(db==k[1]); fronts[k]=(fn[sel].max(),P[sel,2].max())
    D=0.5+0.1*(0.5+0.5*np.sin(dd*1.7+P[:,2]*2.3))   # 0.5-0.8 m, smooth variation
    for k,(f,ztop) in fronts.items():
        sel=upm&(zb==k[0])&(db==k[1]); df=f-fn[sel]
        lift[sel]=D[sel]*(0.45+0.55*np.clip(df/0.9,0,1)**0.5)        # rounded crest falling to the edge
        fwd[sel]=0.25*np.clip(1-df/0.6,0,1)                           # drift overhangs the edge
        # drape: vertical front verts just below this edge get pushed out
        zb_ = zb  # noqa
        sv=vert&(db==k[1])&(P[:,2]<=ztop+0.05)&(P[:,2]>ztop-0.7)&((Nn@n)>0.5)&(np.abs(fn-f)<0.45)
        t=np.clip((P[sv,2]-(ztop-0.7))/0.7,0,1); drape[sv]=np.maximum(drape[sv],0.35*t**2)
        # icicles grow out of this drift lip
        if (not is_corn and rng.random()<0.55) or (is_corn and rng.random()<0.9):
            for j in range(rng.integers(1,4)):
                pdd=(k[1]+rng.random())*0.5; L_=float(np.exp(rng.normal(np.log(0.45),0.6))); L_=min(max(L_,0.12),1.6)
                ICE.append(dict(p=(d*pdd).tolist(),front=float(f+0.12),z=float(ztop+0.15),L=L_,r=float(rng.uniform(0.03,0.08))))
    disp*=fade; fwd*=fade; drape*=fade; lift*=(0.3+0.7*fade)
    down=Nn[:,2]<-0.3
    if is_corn: snowv=np.where(down,0.0,np.maximum((up>0.5).astype(float),ks.astype(float))); icev=down.astype(float)
    else: snowv=np.maximum.reduce([np.clip((lift-0.1)/0.15,0,1)*(up>0.5),(drape>0.12).astype(float),ks.astype(float)]); icev=np.zeros(len(P))
    snowm=snowv
    out=P+Nn*disp[:,None]+np.stack([np.zeros(len(P)),np.zeros(len(P)),lift],1)+n[None]*(fwd+drape)[:,None]
    me.vertices.foreach_set('co',out.ravel())
    for nm_,val in [('snowm',snowv),('_snow',snowv),('_ice',icev),('wear',np.zeros(len(P))),('_disp',np.zeros(len(P)))]:
        a_=me.attributes.new(nm_,'FLOAT','POINT'); a_.data.foreach_set('value',val.astype(np.float32))
    u,vv,_=proj(out); uvl=me.uv_layers.new(name='keyuv'); li=np.array([l.vertex_index for l in me.loops]); uvl.data.foreach_set('uv',np.stack([u/1024,1-vv/1024],1)[li].ravel())
    me.update()
    # decimate to budget: flat block faces / drift slopes collapse well
    tgt=int(os.environ.get('TGT_'+ob.name.upper(),'0'))
    nt=sum(len(p.vertices)-2 for p in me.polygons)
    if tgt and nt>tgt:
        m_=ob.modifiers.new('dc','DECIMATE'); m_.decimate_type='DISSOLVE'; m_.angle_limit=math.radians(float(os.environ.get('PLANAR','4'))); m_.use_dissolve_boundaries=False
        bpy.context.view_layer.objects.active=ob; bpy.ops.object.modifier_apply(modifier='dc')
        t_=ob.modifiers.new('tr','TRIANGULATE'); bpy.ops.object.modifier_apply(modifier='tr')
        import bmesh as _bb; bm_=_bb.new(); bm_.from_mesh(ob.data); _bb.ops.remove_doubles(bm_,verts=bm_.verts,dist=0.002)
        bad=[e for e in bm_.edges if not e.is_manifold]
        if bad: _bb.ops.holes_fill(bm_,edges=bad,sides=8); _bb.ops.triangulate(bm_,faces=bm_.faces)
        bm_.to_mesh(ob.data); bm_.free()
    import bmesh as _b; bm=_b.new(); bm.from_mesh(ob.data); oe=sum(1 for e in bm.edges if not e.is_manifold); bm.free()
    stats[ob.name]=dict(tris=sum(len(p.vertices)-2 for p in ob.data.polygons),open_edges=oe,block_cm=[float(disp.min()*100),float(disp.max()*100)],drift_m=[float(lift.min()),float(lift.max())])
drift_and_blocks(tier,False); drift_and_blocks(corn,True)
# icicles object (matte pale ice)
bm=bmesh.new()
for e in ICE:
    base_=np.array(e['p'])+n*(e['front']-np.array(e['p'])@n); base_[2]=e['z']
    r=bmesh.ops.create_cone(bm,cap_ends=True,segments=6,radius1=e['r'],radius2=0.0,depth=e['L'])
    vs=r['verts']
    for v_ in vs: v_.co.z=-v_.co.z          # wide end up, tip down
    bmesh.ops.translate(bm,verts=vs,vec=tuple(base_-np.array([0,0,e['L']/2])))
bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
mi=bpy.data.meshes.new('icicles'); bm.to_mesh(mi); ice=bpy.data.objects.new('icicles',mi); sc.collection.objects.link(ice)
for nm_ in ['snowm','wear','_disp','_snow','_ice']:
    a_=mi.attributes.new(nm_,'FLOAT','POINT'); a_.data.foreach_set('value',np.zeros(len(mi.vertices),np.float32))
uv_=mi.uv_layers.new(name='keyuv')
stats['icicles']=dict(count=len(ICE),tris=sum(len(p.vertices)-2 for p in mi.polygons))

# ground (plain displaced snow) for context
bpy.ops.mesh.primitive_grid_add(x_subdivisions=int(os.environ.get('GX','600')),y_subdivisions=int(os.environ.get('GY','400')),size=1)
g=bpy.context.active_object; g.name='ground'; g.scale=(30,20,1); g.location=tuple(A+d*8+n*8+np.array([0,0,0])); bpy.ops.object.transform_apply(scale=True,location=True)
G=np.array([x.co for x in g.data.vertices]); G[:,2]=base+0.03*(samp(H['snow'],G[:,0],G[:,1])-0.5); g.data.vertices.foreach_set('co',G.ravel())
a=g.data.attributes.new('_disp','FLOAT','POINT');a.data.foreach_set('value',np.zeros(len(G),np.float32)); a=g.data.attributes.new('_snow','FLOAT','POINT');a.data.foreach_set('value',np.ones(len(G),np.float32)); a=g.data.attributes.new('_ice','FLOAT','POINT');a.data.foreach_set('value',np.zeros(len(G),np.float32)); a=g.data.attributes.new('snowm','FLOAT','POINT');a.data.foreach_set('value',np.ones(len(G),np.float32)); a=g.data.attributes.new('wear','FLOAT','POINT');a.data.foreach_set('value',np.zeros(len(G),np.float32))
u,vv,_=proj(G); uvl=g.data.uv_layers.new(name='keyuv'); li=np.array([l.vertex_index for l in g.data.loops]); uvl.data.foreach_set('uv',np.stack([u/1024,1-vv/1024],1)[li].ravel())
for o in bpy.data.objects: o.data.shade_smooth() if hasattr(o.data,'shade_smooth') else None
build=time.time()-t0

if os.environ.get('EXPORT'):
    for o in (tier,corn,ice,g):
        o.data.materials.clear(); o.data.materials.append(bpy.data.materials.new('m_'+o.name))
    for o in list(bpy.data.objects):
        if o not in (tier,corn,ice,g): bpy.data.objects.remove(o)
    tris={o.name:sum(len(p.vertices)-2 for p in o.data.polygons) for o in (tier,corn,ice,g)}
    import bmesh as _b
    oe={}
    for o in (tier,corn):
        bm=_b.new(); bm.from_mesh(o.data); oe[o.name]=sum(1 for e in bm.edges if not e.is_manifold); bm.free()
    bpy.ops.export_scene.gltf(filepath=os.environ['EXPORT'],export_format='GLB',export_attributes=True,export_cameras=False,export_lights=False)
    print('EXPORTSTATS',json.dumps(dict(tris=tris,total=sum(tris.values()),open_edges=oe)))
    sys.exit(0)

if os.environ.get('LODTAG'):
    tag=os.environ['LODTAG']
    dec=float(os.environ.get('DECIM','1'))
    if dec<1:
        m_=kit.modifiers.new('dc','DECIMATE'); m_.ratio=dec; m_.use_collapse_triangulate=True
        bpy.context.view_layer.objects.active=kit; bpy.ops.object.modifier_apply(modifier='dc')
    import bmesh as _b; bm=_b.new(); bm.from_mesh(kit.data); openE=sum(1 for e in bm.edges if not e.is_manifold); bm.free()
    tris=sum(len(p.vertices)-2 for p in kit.data.polygons)
    g.hide_render=True
    mw=bpy.data.materials.new('white'); mw.use_nodes=True; nt=mw.node_tree; nt.nodes.clear(); e=nt.nodes.new('ShaderNodeEmission'); e.inputs[1].default_value=10; oo=nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(e.outputs[0],oo.inputs[0])
    kit.data.materials.clear(); kit.data.materials.append(mw)
    w=bpy.data.worlds.new('w'); sc.world=w; w.color=(0,0,0); sc.render.engine='BLENDER_EEVEE'; sc.view_settings.view_transform='Standard'
    def lk(p,t,fov=60):
        c=bpy.data.cameras.new('c'); c.sensor_fit='VERTICAL'; c.angle=math.radians(fov); c.clip_end=500
        o=bpy.data.objects.new('cam',c); sc.collection.objects.link(o); o.location=tuple(p); o.rotation_euler=(mathutils.Vector(tuple(t))-mathutils.Vector(tuple(p))).to_track_quat('-Z','Y').to_euler(); return o
    mid=A+d*T['width']*0.45
    for dist in (8,25):
        p=mid+n*dist*0.8+d*dist*0.6; p[2]=base+1.77
        sc.camera=lk(p,mid+np.array([0,0,1.5])); sc.render.resolution_x,sc.render.resolution_y=412,915
        sc.render.filepath=f'{D0}/out/L-{tag}-{dist}m.png'; bpy.ops.render.render(write_still=True)
    pl=A+d*T['width']*0.45+n*3; pl[2]=base+1.77
    cen=np.array([np.array(p.center) for p in kit.data.polygons]); nt_=np.array([len(p.vertices)-2 for p in kit.data.polygons])
    dd=np.linalg.norm(cen-pl,axis=1)
    print('LODSTATS',json.dumps(dict(tag=tag,tris=tris,open_edges=openE,tris_within_8m=int(nt_[dd<8].sum()),tris_8_to_25m=int(nt_[(dd>=8)&(dd<25)].sum()))))
    sys.exit(0)

# material
MEAN={'basalt':np.array([0.136,0.203,0.293]),'snow':np.array([0.394,0.436,0.587])}
def material(name,gain):
    m=bpy.data.materials.new(name); m.use_nodes=True; nt=m.node_tree; Nd=nt.nodes; L=nt.links
    bsdf=Nd['Principled BSDF']; bsdf.inputs['Roughness'].default_value=0.75
    tc=Nd.new('ShaderNodeTexCoord'); mp=Nd.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value=(1/10.24,)*3; L.new(tc.outputs['Object'],mp.inputs[0])
    def im(path,cs='sRGB'):
        t=Nd.new('ShaderNodeTexImage'); t.image=bpy.data.images.load(path); t.image.colorspace_settings.name=cs; t.projection='BOX'; t.projection_blend=0.25; L.new(mp.outputs[0],t.inputs[0]); return t
    bc=im(f'{D0}/tex/basalt_{VAR}_c.jpg'); sc_=im(f'{D0}/tex/snow_{VAR}_c.jpg'); bh=im(f'{D0}/tex/basalt_{VAR}_h.png','Non-Color'); sh=im(f'{D0}/tex/snow_{VAR}_h.png','Non-Color')
    def attr(nm): a=Nd.new('ShaderNodeAttribute'); a.attribute_name=nm; return a
    sm=attr('snowm'); wr=attr('wear')
    def norm(img,mean):
        dv=Nd.new('ShaderNodeMix'); dv.data_type='RGBA'; dv.blend_type='DIVIDE'; dv.inputs[0].default_value=1; L.new(img.outputs[0],dv.inputs[6]); dv.inputs[7].default_value=(*mean,1); return dv
    mx=Nd.new('ShaderNodeMix'); mx.data_type='RGBA'; L.new(sm.outputs['Fac'],mx.inputs[0]); L.new(norm(bc,MEAN['basalt']**2.2).outputs[2],mx.inputs[6]); L.new(norm(sc_,MEAN['snow']**2.2).outputs[2],mx.inputs[7])
    uvm=Nd.new('ShaderNodeUVMap'); uvm.uv_map='keyuv'; key=Nd.new('ShaderNodeTexImage'); key.image=bpy.data.images.load(D0+'/tex/keylow.jpg'); key.extension='EXTEND'; L.new(uvm.outputs[0],key.inputs[0])
    mul=Nd.new('ShaderNodeMix'); mul.data_type='RGBA'; mul.blend_type='MULTIPLY'; mul.inputs[0].default_value=1; L.new(key.outputs[0],mul.inputs[6]); L.new(mx.outputs[2],mul.inputs[7])
    gn=Nd.new('ShaderNodeMix'); gn.data_type='RGBA'; gn.blend_type='MULTIPLY'; gn.inputs[0].default_value=1; L.new(mul.outputs[2],gn.inputs[6]); gA=Nd.new('ShaderNodeMix'); gA.data_type='RGBA'; L.new(sm.outputs['Fac'],gA.inputs[0]); gA.inputs[6].default_value=(*gain,1); gA.inputs[7].default_value=(*GAIN.get('cornice',gain),1); L.new(gA.outputs[2],gn.inputs[7])
    we=Nd.new('ShaderNodeMix'); we.data_type='RGBA'; L.new(wr.outputs['Fac'],we.inputs[0]); we.inputs[0].default_value=0; L.new(gn.outputs[2],we.inputs[6]); we.inputs[7].default_value=(0.55,0.62,0.75,1)
    wf=Nd.new('ShaderNodeMath'); wf.operation='MULTIPLY'; L.new(wr.outputs['Fac'],wf.inputs[0]); wf.inputs[1].default_value=0.35; L.new(wf.outputs[0],we.inputs[0])
    L.new(we.outputs[2],bsdf.inputs['Base Color'])
    # sub-cm normal: bump from height, tiny distance
    hm=Nd.new('ShaderNodeMix'); hm.data_type='FLOAT'; L.new(sm.outputs['Fac'],hm.inputs[0]); L.new(bh.outputs[0],hm.inputs[2]); L.new(sh.outputs[0],hm.inputs[3])
    bp=Nd.new('ShaderNodeBump'); bp.inputs['Strength'].default_value=0.6; bp.inputs['Distance'].default_value=0.008; L.new(hm.outputs[0],bp.inputs['Height']); L.new(bp.outputs[0],bsdf.inputs['Normal'])
    return m
for o in bpy.data.objects: o.data.materials.clear(); o.data.materials.append(material('m_'+o.name,GAIN.get('tier',[1,1,1])))
mI=bpy.data.materials.new('ice'); mI.use_nodes=True; bI=mI.node_tree.nodes['Principled BSDF']; bI.inputs['Base Color'].default_value=(0.55,0.70,0.85,1); bI.inputs['Roughness'].default_value=0.85
ice.data.materials.clear(); ice.data.materials.append(mI)
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; w.node_tree.nodes['Background'].inputs[0].default_value=(0.30,0.36,0.55,1); w.node_tree.nodes['Background'].inputs[1].default_value=1.2
sun=bpy.data.lights.new('sun','SUN'); sun.energy=2.2; sun.color=(0.85,0.9,1.0); so=bpy.data.objects.new('sun',sun); sc.collection.objects.link(so)
so.rotation_euler=mathutils.Vector((-0.6,0.5,0.62)).to_track_quat('Z','Y').to_euler()   # from upper-left/front
sc.render.engine='BLENDER_EEVEE'
if os.environ.get('NORENDER'): print('STATS',stats); sys.exit(0); sc.view_settings.view_transform='Standard'
def cam_key():
    c=bpy.data.cameras.new('k'); c.sensor_fit='VERTICAL'; c.angle=2*math.atan(0.5/0.5957); c.clip_end=500; o=bpy.data.objects.new('kc',c); sc.collection.objects.link(o)
    rgt=R@c2b(np.array([1,0,0.])); up=R@c2b(np.array([0,-1,0.])); bk=-(R@c2b(np.array([0,0,1.])))
    M=mathutils.Matrix(np.column_stack([rgt,up,bk]).tolist()).to_4x4(); M.translation=CAM; o.matrix_world=M; return o
def look(p,t,fov=60):
    c=bpy.data.cameras.new('c'); c.sensor_fit='VERTICAL'; c.angle=math.radians(fov); c.clip_start=0.05; c.clip_end=500
    o=bpy.data.objects.new('cam',c); sc.collection.objects.link(o); o.location=tuple(p); o.rotation_euler=(mathutils.Vector(tuple(t))-mathutils.Vector(tuple(p))).to_track_quat('-Z','Y').to_euler(); return o
door=A+d*(T['width']*0.33); eye=lambda x:np.array([x[0],x[1],base+1.77]); tgt=door+np.array([0,0,1.2])
az=lambda deg,dist,along=0.33:(A+d*(T['width']*along)+dist*(n*math.cos(math.radians(deg))+d*math.sin(math.radians(deg))))
views={'1-keycam':cam_key(),
 '2-near3m':look(eye(az(0,3,0.45)),A+d*T['width']*0.45+np.array([0,0,1.1])),
 '3-chase':look(az(0,7.5,0.45)+np.array([0,0,base+2.6-A[2]+A[2]-base])*0+np.array([0,0,0])+np.array([0,0,(base+2.6)-(A[2])])+np.array([0,0,A[2]-A[2]]),A+d*T['width']*0.45+np.array([0,0,1.8])),
 '4-oblique45':look(eye(az(45,4,0.45)),A+d*T['width']*0.45+np.array([0,0,1.1])),
 '5-grazing':look(np.array([*(A+d*(T['width']+2.0)+n*0.9)[:2],base+1.77]),A+d*(T['width']*0.2)+n*0.2+np.array([0,0,1.2]),50)}
cm=A+d*float(ca0.mean())+np.array([0,0,cz0-base+0.3]); views['6-cornice-side']=look(A+d*(float(ca0.max())+2.5)+n*2.5+np.array([0,0,1.77]),cm,60)
out={}
for k,cam in ({} if os.environ.get('MASKONLY') else views).items():
    sc.camera=cam
    if k=='1-keycam': sc.render.resolution_x=sc.render.resolution_y=1024
    else: sc.render.resolution_x,sc.render.resolution_y=412,915
    sc.render.filepath=f'{D0}/out/R-{VAR}-{k}.png'; bpy.ops.render.render(write_still=True)
# silhouette mask at key cam
for o in bpy.data.objects:
    if o.type=='MESH': o.hide_render=(o.name=='ground')
sc.camera=views['1-keycam']; sc.render.resolution_x=sc.render.resolution_y=1024
mw=bpy.data.materials.new('white'); mw.use_nodes=True; nt=mw.node_tree; nt.nodes.clear(); e=nt.nodes.new('ShaderNodeEmission'); e.inputs[1].default_value=10; oo=nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(e.outputs[0],oo.inputs[0])
mb=bpy.data.materials.new('blk'); mb.use_nodes=True; nt2=mb.node_tree; nt2.nodes.clear(); e2=nt2.nodes.new('ShaderNodeEmission'); e2.inputs[1].default_value=0; o2=nt2.nodes.new('ShaderNodeOutputMaterial'); nt2.links.new(e2.outputs[0],o2.inputs[0])
tier.data.materials.clear(); tier.data.materials.append(mw); tier.data.materials.append(mb); corn.data.materials.clear(); corn.data.materials.append(mw); ice.data.materials.clear(); ice.data.materials.append(mw)
if os.environ.get('SNOWMASK'):
    ms=bpy.data.materials.new('snowem'); ms.use_nodes=True; nt3=ms.node_tree; nt3.nodes.clear(); at=nt3.nodes.new('ShaderNodeAttribute'); at.attribute_name='_snow'; e3=nt3.nodes.new('ShaderNodeEmission'); e3.inputs[1].default_value=10; o3=nt3.nodes.new('ShaderNodeOutputMaterial')
    nt3.links.new(at.outputs['Fac'],e3.inputs[0]); nt3.links.new(e3.outputs[0],o3.inputs[0])
    tier.data.materials[0]=ms; corn.data.materials[0]=ms; ice.data.materials[0]=mb
if os.environ.get('COVER'):
    fn=np.array([p.normal for p in tier.data.polygons]); idx=((fn@n)<0.5).astype(int); tier.data.polygons.foreach_set('material_index',idx); tier.data.update()
w.node_tree.nodes['Background'].inputs[1].default_value=0; so.hide_render=True
sc.render.filepath=f'{D0}/out/R-{VAR}-mask.png'; bpy.ops.render.render(write_still=True)
stats['support']=STATS_SUPPORT; stats['build_s']=build; stats['total_s']=time.time()-t0; stats['ground_tris']=sum(len(p.vertices)-2 for p in g.data.polygons)
json.dump(stats,open(f'{D0}/out/stats-{VAR}.json','w'),indent=1); print('STATS',stats)

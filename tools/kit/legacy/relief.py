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
f2=json.load(open(D0+'/fit2.json')); tp=f2['tier']['p']; d=np.array(f2['tier']['d']); n=np.array(f2['tier']['n'])
A=np.array(f2['tier']['origin'])
T={'width':tp[1],'height':tp[3]-tp[2]}; A=A+np.array([0,0,tp[2]-A[2]]); TB=tp[5]
cp=f2['corn']['p']; C={'start':cp[0]-tp[0],'width':cp[1]}
base=A[2]; top=base+T['height']
bpy.ops.wm.read_factory_settings(use_empty=True); sc=bpy.context.scene
def box(name,o,length,h0,h1,front_off,back):
    # o: start point on tier face line; spans along d by length, from front_off (toward camera) to -back
    p=[o+d*a+n*b+np.array([0,0,c]) for a in (0,length) for b in (front_off,-back) for c in (h0,h1)]
    me=bpy.data.meshes.new(name); bm=bmesh.new(); vs=[bm.verts.new(x) for x in p]
    idx=[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)]
    for f in idx: bm.faces.new([vs[i] for i in f])
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces); bm.to_mesh(me); ob=bpy.data.objects.new(name,me); sc.collection.objects.link(ob)
    bpy.context.view_layer.objects.active=ob; ob.select_set(True)
    m=ob.modifiers.new('bev','BEVEL'); m.width=0.04; m.segments=3
    r=ob.modifiers.new('rm','REMESH'); r.mode='VOXEL'; r.voxel_size=VOX
    bpy.ops.object.convert(target='MESH'); ob.select_set(False); return ob
tier=box('tier',A,T['width'],base,top,0,TB)
ca=C['start']
corn=box('cornice',A+d*ca,C['width'],top-0.15,top+0.5,1.0,2.5)
gnd=None
# textures for displacement
def ld(nm): 
    return np.load(f'{D0}/tex/{nm}_{VAR}_h.npy').astype(np.float32)
H={'basalt':ld('basalt'),'snow':ld('snow')}; N=H['basalt'].shape[0]; PPM=N/10.24
edges=np.load(D0+'/edges.npy')
def samp(h,a,b): return h[((-b*PPM).astype(int))%N,((a*PPM).astype(int))%N]
stats={}
for ob,amp_b,amp_s,allsnow in [(tier,0.06,0.025,False),(corn,0.05,0.04,True)]:
    me=ob.data; P=np.array([x.co for x in me.vertices]); Nn=np.array([x.normal for x in me.vertices])
    w=np.abs(Nn)**4; w/=w.sum(1,keepdims=True)
    def tri(h): return w[:,0]*samp(h,P[:,1],P[:,2])+w[:,1]*samp(h,P[:,0],P[:,2])+w[:,2]*samp(h,P[:,0],P[:,1])
    snowm=np.clip((Nn[:,2]-0.55)/0.25,0,1) if not allsnow else np.ones(len(P))
    hb=tri(H['basalt']); hs=tri(H['snow'])
    # edge wear: bevel zone (normal not axis-aligned in wall frame) AND key shows an edge there
    loc=np.stack([Nn@d,Nn@n,Nn[:,2]],1); bev=np.abs(loc).max(1)<0.97
    u,vv,_=proj(P); ui=np.clip(u.astype(int),0,1023); vi=np.clip(vv.astype(int),0,1023)
    wear=(bev&(edges[vi,ui]>0)).astype(np.float32)
    disp=(1-snowm)*amp_b*(hb-0.5)+snowm*amp_s*(hs-0.5); disp*=(1-0.6*wear)
    P2=P+Nn*disp[:,None]; me.vertices.foreach_set('co',P2.ravel())
    for nm,val in [('snowm',snowm),('wear',wear)]:
        a=me.attributes.new(nm,'FLOAT','POINT'); a.data.foreach_set('value',val.astype(np.float32))
    uvl=me.uv_layers.new(name='keyuv'); li=np.array([l.vertex_index for l in me.loops])
    uvl.data.foreach_set('uv',np.stack([u/1024,1-vv/1024],1)[li].ravel())
    me.update(); stats[ob.name]=dict(tris=sum(len(p.vertices)-2 for p in me.polygons),disp_cm=[float(disp.min()*100),float(disp.max()*100)],wear_verts=int(wear.sum()))
# ground (plain displaced snow) for context
bpy.ops.mesh.primitive_grid_add(x_subdivisions=600,y_subdivisions=400,size=1)
g=bpy.context.active_object; g.name='ground'; g.scale=(30,20,1); g.location=tuple(A+d*8+n*8+np.array([0,0,0])); bpy.ops.object.transform_apply(scale=True,location=True)
G=np.array([x.co for x in g.data.vertices]); G[:,2]=base+0.03*(samp(H['snow'],G[:,0],G[:,1])-0.5); g.data.vertices.foreach_set('co',G.ravel())
a=g.data.attributes.new('snowm','FLOAT','POINT');a.data.foreach_set('value',np.ones(len(G),np.float32)); a=g.data.attributes.new('wear','FLOAT','POINT');a.data.foreach_set('value',np.zeros(len(G),np.float32))
u,vv,_=proj(G); uvl=g.data.uv_layers.new(name='keyuv'); li=np.array([l.vertex_index for l in g.data.loops]); uvl.data.foreach_set('uv',np.stack([u/1024,1-vv/1024],1)[li].ravel())
for o in bpy.data.objects: o.data.shade_smooth() if hasattr(o.data,'shade_smooth') else None
build=time.time()-t0
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
    gn=Nd.new('ShaderNodeMix'); gn.data_type='RGBA'; gn.blend_type='MULTIPLY'; gn.inputs[0].default_value=1; L.new(mul.outputs[2],gn.inputs[6]); gn.inputs[7].default_value=(*gain,1)
    we=Nd.new('ShaderNodeMix'); we.data_type='RGBA'; L.new(wr.outputs['Fac'],we.inputs[0]); we.inputs[0].default_value=0; L.new(gn.outputs[2],we.inputs[6]); we.inputs[7].default_value=(0.55,0.62,0.75,1)
    wf=Nd.new('ShaderNodeMath'); wf.operation='MULTIPLY'; L.new(wr.outputs['Fac'],wf.inputs[0]); wf.inputs[1].default_value=0.35; L.new(wf.outputs[0],we.inputs[0])
    L.new(we.outputs[2],bsdf.inputs['Base Color'])
    # sub-cm normal: bump from height, tiny distance
    hm=Nd.new('ShaderNodeMix'); hm.data_type='FLOAT'; L.new(sm.outputs['Fac'],hm.inputs[0]); L.new(bh.outputs[0],hm.inputs[2]); L.new(sh.outputs[0],hm.inputs[3])
    bp=Nd.new('ShaderNodeBump'); bp.inputs['Strength'].default_value=0.6; bp.inputs['Distance'].default_value=0.008; L.new(hm.outputs[0],bp.inputs['Height']); L.new(bp.outputs[0],bsdf.inputs['Normal'])
    return m
for o in bpy.data.objects: o.data.materials.append(material('m_'+o.name,GAIN.get(o.name,[1,1,1])))
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; w.node_tree.nodes['Background'].inputs[0].default_value=(0.30,0.36,0.55,1); w.node_tree.nodes['Background'].inputs[1].default_value=1.2
sun=bpy.data.lights.new('sun','SUN'); sun.energy=2.2; sun.color=(0.85,0.9,1.0); so=bpy.data.objects.new('sun',sun); sc.collection.objects.link(so)
so.rotation_euler=mathutils.Vector((-0.6,0.5,0.62)).to_track_quat('Z','Y').to_euler()   # from upper-left/front
sc.render.engine='BLENDER_EEVEE'; sc.view_settings.view_transform='Standard'
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
out={}
for k,cam in views.items():
    sc.camera=cam
    if k=='1-keycam': sc.render.resolution_x=sc.render.resolution_y=1024
    else: sc.render.resolution_x,sc.render.resolution_y=412,915
    sc.render.filepath=f'{D0}/out/R-{VAR}-{k}.png'; bpy.ops.render.render(write_still=True)
# silhouette mask at key cam
for o in bpy.data.objects:
    if o.type=='MESH': o.hide_render=(o.name=='ground')
sc.camera=views['1-keycam']; sc.render.resolution_x=sc.render.resolution_y=1024
mw=bpy.data.materials.new('white'); mw.use_nodes=True; nt=mw.node_tree; nt.nodes.clear(); e=nt.nodes.new('ShaderNodeEmission'); e.inputs[1].default_value=10; oo=nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(e.outputs[0],oo.inputs[0])
for o in (tier,corn): o.data.materials[0]=mw
w.node_tree.nodes['Background'].inputs[1].default_value=0; so.hide_render=True
sc.render.filepath=f'{D0}/out/R-{VAR}-mask.png'; bpy.ops.render.render(write_still=True)
stats['build_s']=build; stats['total_s']=time.time()-t0; stats['ground_tris']=sum(len(p.vertices)-2 for p in g.data.polygons)
json.dump(stats,open(f'{D0}/out/stats-{VAR}.json','w'),indent=1); print('STATS',stats)

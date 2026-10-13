import bpy, numpy as np, math, mathutils, os, time
W=H=1024; F=0.5957*W; D0=os.path.dirname(os.path.abspath(__file__))
nc=np.array([0.0108,-0.9511,-0.3086]); nb=np.array([nc[0],-nc[2]*-1*-1,-nc[1]]) # placeholder
def cam2b(P): return np.stack([P[...,0],P[...,2],-P[...,1]],-1)
nb=cam2b(nc[None])[0]; nb/=np.linalg.norm(nb)
R=np.array(mathutils.Vector(nb).rotation_difference(mathutils.Vector((0,0,1))).to_matrix())
SC=2.3
HCAM=6.93*SC
def to_world(P): return cam2b(P)@R.T+np.array([0,0,HCAM])
def backproj(D,step):
    v,u=np.mgrid[0:H+1:step,0:W+1:step].astype(np.float32); v=np.minimum(v,H-1)+.5; u=np.minimum(u,W-1)+.5
    d=D[v.astype(int),u.astype(int)]*np.where(D[v.astype(int),u.astype(int)]>=199,1,SC)
    P=np.stack([(u-512)/F*d,(v-512)/F*d,d],-1); return to_world(P),u/W,1-v/H,d
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s=bpy.context.scene; s.render.engine='BLENDER_EEVEE'; s.render.resolution_x=412; s.render.resolution_y=915
    s.view_settings.view_transform='Standard'; w=bpy.data.worlds.new('w'); s.world=w; w.color=(0.02,0.03,0.06); return s
def mat(name,imgpath,emit=True):
    m=bpy.data.materials.new(name); m.use_nodes=True; nt=m.node_tree; nt.nodes.clear()
    t=nt.nodes.new('ShaderNodeTexImage'); t.image=bpy.data.images.load(imgpath); t.interpolation='Cubic'
    o=nt.nodes.new('ShaderNodeOutputMaterial')
    e=nt.nodes.new('ShaderNodeEmission'); nt.links.new(t.outputs[0],e.inputs[0]); nt.links.new(e.outputs[0],o.inputs[0]); return m
def grid_mesh(name,D,step,m,keep_tri=None):
    X,U,V,d=backproj(D,step); h,w=d.shape; idx=np.arange(h*w).reshape(h,w)
    a,b,c,e=idx[:-1,:-1],idx[:-1,1:],idx[1:,:-1],idx[1:,1:]
    tris=np.concatenate([np.stack([a,c,b],-1).reshape(-1,3),np.stack([b,c,e],-1).reshape(-1,3)])
    dd=d.reshape(-1)
    if keep_tri is not None: tris=tris[keep_tri(dd[tris])]
    used=np.unique(tris); remap=-np.ones(h*w,int); remap[used]=np.arange(len(used)); tris=remap[tris]
    me=bpy.data.meshes.new(name); me.from_pydata(X.reshape(-1,3)[used].tolist(),[],tris.tolist())
    uv=me.uv_layers.new(); uvs=np.stack([U.reshape(-1)[used],V.reshape(-1)[used]],-1)
    li=np.array([l.vertex_index for l in me.loops]); uv.data.foreach_set('uv',uvs[li].reshape(-1))
    ob=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(ob); me.materials.append(m); return ob,len(tris)
def look(pos,tgt,fov=60):
    c=bpy.data.cameras.new('c'); c.sensor_fit='VERTICAL'; c.angle=math.radians(fov); c.clip_end=1000
    o=bpy.data.objects.new('cam',c); bpy.context.collection.objects.link(o); o.location=pos
    o.rotation_euler=(mathutils.Vector(tgt)-mathutils.Vector(pos)).to_track_quat('-Z','Y').to_euler(); return o
def pix_world(D,r,c):
    d=D[r,c]*SC; return to_world(np.array([(c+.5-512)/F*d,(r+.5-512)/F*d,d]))
def views(D):
    door=pix_world(D,560,380); floor=pix_world(D,700,520); floor[2]=1.77; door=list(door); door[2]=1.6
    f=np.array(floor); dirv=np.array(door)-f; dirv[2]=0; dirv/=np.linalg.norm(dirv); left=np.array([-dirv[1],dirv[0],0])
    return {'v0-keycam':((0,0,HCAM),tuple(pix_world(D,512,512)),80*1.0),
     'v1-eye-start':(tuple(f),tuple(door),60),'v2-walk3m':(tuple(f+3*dirv),tuple(door),60),
     'v3-walk6m-yaw35':(tuple(f+6*dirv),tuple(f+6*dirv+12*(dirv*math.cos(.61)-left*math.sin(.61))+[0,0,-.2]),60),
     'v4-strafe4m-oblique45':(tuple(f+4*left+2*dirv),tuple(door),60)}
def render_all(prefix,D):
    s=bpy.context.scene; out={}
    for k,(p,t,fov) in views(D).items():
        cam=look(p,t,fov); s.camera=cam; s.render.filepath=f'{D0}/out/{prefix}-{k}.png'; bpy.ops.render.render(write_still=True)
def export(path):
    bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',export_cameras=False,export_image_format='JPEG',export_jpeg_quality=85)

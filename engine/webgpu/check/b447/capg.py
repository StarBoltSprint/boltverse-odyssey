import sys,os,time,base64,subprocess,json
from playwright.sync_api import sync_playwright
args=["--enable-unsafe-webgpu","--enable-features=Vulkan,WebGPU","--use-vulkan=native","--ignore-gpu-blocklist","--disable-vulkan-surface","--enable-dawn-features=allow_unsafe_apis","--no-sandbox"]
# cap.py out(.mp4|dir) a:b:fps extra_query
out,spec,extra=sys.argv[1],sys.argv[2],sys.argv[3] if len(sys.argv)>3 else ''
a,b,f=map(float,spec.split(':')); ts=[a+i/f for i in range(int(round((b-a)*f)))]
os.environ.setdefault("DISPLAY",":0")
url="http://127.0.0.1:8970/"+os.environ.get("PG","m447v.html?v=447v13")+f"&demo=1&cap=1&w=720&h=1280{extra}"
with sync_playwright() as pw:
  br=pw.chromium.launch(executable_path="/usr/bin/google-chrome",headless=False,args=args)
  p=br.new_page(viewport={"width":360,"height":640}); p.on("console",lambda m: print("CON",m.text) if 'rror' in m.text else None)
  p.goto(url); p.wait_for_function("window.__meadowReady||window.__meadowErr",timeout=240000)
  print(p.evaluate("window.__meadowErr||null"),flush=True)
  ff=None; log=[]
  if out.endswith('.mp4'):
    ff=subprocess.Popen(["ffmpeg","-y","-loglevel","error","-f","image2pipe","-c:v","mjpeg","-framerate",str(f),"-i","-","-c:v","libx264","-crf","18","-pix_fmt","yuv420p","-movflags","+faststart",out],stdin=subprocess.PIPE)
  else: os.makedirs(out,exist_ok=True)
  for i,t in enumerate(ts):
    r=p.evaluate("async t=>{const r=await window.__meadowFrame(t,0.95);return {jpg:r.jpg,ang:window.__ang,roll:window.__roll,vp:window.__vp,bp:window.__bp}}",t); jb=base64.b64decode(r["jpg"]); log.append({"t":t,"ang":r["ang"],"roll":r.get("roll"),"vp":r.get("vp"),"bp":r.get("bp")})
    if ff: ff.stdin.write(jb)
    else: open(f"{out}/f{i:04d}.jpg","wb").write(jb)
  if ff: ff.stdin.close(); ff.wait()
  json.dump(log,open(out.replace('.mp4','')+"_log.json","w"))
  br.close()

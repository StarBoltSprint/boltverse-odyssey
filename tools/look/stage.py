"""Install a staging copy of a Zone B preview. Reads the live tree. Writes only the stage directory."""
import os, shutil

MARKER = "LOOK-UNREAL"


def _symlink_tree(live, stage):
    os.makedirs(stage, exist_ok=True)
    for name in os.listdir(live):
        if name == os.path.basename(stage.rstrip("/")) and os.path.abspath(os.path.join(live, name)) == os.path.abspath(stage):
            continue
        dest = os.path.join(stage, name)
        if os.path.lexists(dest):
            continue
        os.symlink(os.path.join("..", name), dest)


def patch_main(text):
    fov_old = "  camera.fov = cam.fovDeg; camera.updateProjectionMatrix();"
    fov_new = "  camera.fov = (QD.get(\"fov\") && isFinite(+QD.get(\"fov\"))) ? +QD.get(\"fov\") : cam.fovDeg; camera.updateProjectionMatrix();"
    if fov_old in text:
        text = text.replace(fov_old, fov_new, 1)
    if MARKER in text:
        return text
    needle = "window.__gdProf = { world, grade, sky, ground, renderer, camera, render: drawScene };"
    insert = needle + """
// LOOK-UNREAL staging hook. The live page is not edited. Features read ?look= / ?grade= / ?bake= / ?env= / ?fog= / ?shadows= / ?sprites=.
window.__lookCtx = { THREE, renderer, world, camera, grade, skyTex, ground, biome };
"""
    if needle not in text:
        raise SystemExit("stage: main.mjs has no __gdProf anchor")
    text = text.replace(needle, insert, 1)
    move = """    st.z += (f[2] * my + r[2] * mx) / n * speed * dt;
  }
  objs.collide(st);"""
    bench = """    st.z += (f[2] * my + r[2] * mx) / n * speed * dt;
  }
  // LOOK-UNREAL bench path: one camera move, used for the fps before/after of every feature.
  if (window.__lookBench && window.__benchOrigin) {
    const t = (now - window.__benchT0) / 1000;
    const ph = (t % 8) / 8;
    const dir = R.headingToDir(78, 0);
    const ang = ph * Math.PI * 2;
    st.x = window.__benchOrigin.x + dir[0] * ph * 30 + Math.sin(ang) * 6;
    st.z = window.__benchOrigin.z + dir[2] * ph * 30;
    st.yaw = 78 + Math.sin(ang) * 12;
    st.pitch = -4;
    window.__benchDts.push(rawDt * 1000);
    window.__benchCalls = renderer.info.render.calls;
  }
  objs.collide(st);"""
    if move not in text:
        raise SystemExit("stage: main.mjs has no movement anchor")
    text = text.replace(move, bench, 1)
    end = """loadEl.style.display = "none";
window.__ready = true;
if (ares) ares.markReady(performance.now());
requestAnimationFrame(frame);
"""
    tail = """loadEl.style.display = "none";
window.__ready = true;
if (ares) ares.markReady(performance.now());
if (QD.get("bench") === "1") {
  window.__lookBench = true;
  window.__benchT0 = performance.now();
  window.__benchOrigin = { x: st.x, z: st.z };
  window.__benchDts = [];
}
try { await import("./look/look.mjs?v=fix1").then((m) => m.attach(window.__lookCtx)); }
catch (err) { console.warn("look", err); }
requestAnimationFrame(frame);
"""
    if end not in text:
        raise SystemExit("stage: main.mjs has no ready anchor")
    return text.replace(end, tail, 1)


def patch_index(text):
    return text.replace("./main.mjs?v=62", "./main.mjs?v=look1")


def install(live, stage, runtime_dir):
    if os.path.abspath(live) == os.path.abspath(stage):
        raise SystemExit("stage: refusing to install onto the live directory")
    _symlink_tree(live, stage)
    main_src = os.path.join(live, "main.mjs")
    index_src = os.path.join(live, "index.html")
    main_dest = os.path.join(stage, "main.mjs")
    index_dest = os.path.join(stage, "index.html")
    for dest in (main_dest, index_dest):
        if os.path.islink(dest):
            os.unlink(dest)
    open(main_dest, "w").write(patch_main(open(main_src, encoding="utf-8").read()))
    open(index_dest, "w").write(patch_index(open(index_src, encoding="utf-8").read()))
    look_dir = os.path.join(stage, "look")
    os.makedirs(look_dir, exist_ok=True)
    if os.path.isdir(runtime_dir):
        for name in os.listdir(runtime_dir):
            if name.endswith(".mjs"):
                shutil.copy(os.path.join(runtime_dir, name), os.path.join(look_dir, name))
    curves = os.path.join(os.path.dirname(runtime_dir), "curves.mjs")
    if os.path.exists(curves):
        shutil.copy(curves, os.path.join(look_dir, "curves.mjs"))
    return {"main": main_dest, "index": index_dest, "look": look_dir}

// Exact fragment counts (overdraw) per transparent layer, depth-tested against the opaque scene, at the internal res.
// Noise-free substitute for timing under load. node overdraw.mjs <url> <out.json> [w h]   (internal render w x h)
import { writeFileSync } from "fs";
const [url, out, W = "360", H = "800"] = process.argv.slice(2);
const poses = [{ name: "walk", x: 10, z: -200, yaw: 90, pitch: -2 }, { name: "avenue-sun", x: -60, z: -10, yaw: 78, pitch: 4 }, { name: "spire", x: 0, z: 0, yaw: 0, pitch: 8 }, { name: "dunes", x: 120, z: 160, yaw: 200, pitch: 0 }];
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await (await browser.newContext({ viewport: { width: 180, height: 400 }, deviceScaleFactor: 1 })).newPage();
const logs = []; page.on("pageerror", (e) => logs.push("pageerror " + e.message)); page.on("crash", () => console.log("PAGE CRASH")); page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("console", m.text().slice(0, 300)); });
await page.goto(url + `&hud=0&lockq=1&grain=0&eye=1.5&x=${poses[0].x}&z=${poses[0].z}&yaw=${poses[0].yaw}`, { waitUntil: "load", timeout: 900000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 900000 });
await page.waitForTimeout(2000);
const res = {};
for (const p of poses) {
  await page.evaluate((p) => { const s = window.__st; s.x = p.x; s.z = p.z; s.yaw = p.yaw; s.pitch = p.pitch; s.y = window.__gd.field.surfaceHeight(p.x, p.z) + 1.5; }, p);
  await page.waitForTimeout(2500);
  res[p.name] = await page.evaluate(([W, H]) => {
    const P = window.__gdProf, THREE = window.__THREE || P.renderer.constructor.__THREE, r = P.renderer, cam = P.camera, world = P.world;
    const RT = new (window.__gdTHREE.WebGLRenderTarget)(W, H, { depthBuffer: true });
    const T = window.__gdTHREE;
    const trans = []; world.traverse((o) => { if ((o.isMesh || o.isLine || o.isPoints) && o.visible && [].concat(o.material).some((m) => m.transparent || m.blending !== 1)) trans.push(o); });
    const vis = trans.map((o) => o.visible);
    trans.forEach((o) => (o.visible = false));
    const oldA = cam.aspect; cam.aspect = W / H; cam.updateProjectionMatrix();
    r.setRenderTarget(RT); r.autoClear = true; r.render(world, cam);   // opaque only: fills depth
    const buf = new Uint8Array(W * H * 4), out = {};
    r.autoClear = false;
    for (const o of trans) {
      const m0 = o.material; let m;
      if (m0.isShaderMaterial) {
        m = m0.clone(); m.uniforms = m0.uniforms;
        m.fragmentShader = m0.fragmentShader.replace(/void\s+main\s*\(\s*(void)?\s*\)\s*\{/, "void main_o(){") + "\nvoid main(){ gl_FragColor = vec4(1.0/255.0); }\n";
      } else { m = new T.MeshBasicMaterial({ color: 0x010101, side: m0.side }); m.color.setRGB(1 / 255, 1 / 255, 1 / 255, T.LinearSRGBColorSpace); }
      m.transparent = true; m.depthWrite = false; m.depthTest = m0.depthTest; m.blending = T.CustomBlending; m.blendSrc = T.OneFactor; m.blendDst = T.OneFactor; m.blendEquation = T.AddEquation;
      m.blendSrcAlpha = T.OneFactor; m.blendDstAlpha = T.OneFactor;
      r.setClearColor(0, 0); r.clearColor();
      o.material = m; o.visible = true; const L0 = o.layers.mask; o.layers.set(7); cam.layers.set(7);
      r.render(world, cam);
      cam.layers.set(0); o.layers.mask = L0; o.visible = false; o.material = m0; m.dispose();
      r.readRenderTargetPixels(RT, 0, 0, W, H, buf);
      let s = 0, cov = 0, mx = 0; for (let i = 0; i < buf.length; i += 4) { s += buf[i]; if (buf[i]) cov++; if (buf[i] > mx) mx = buf[i]; }
      const k = o.name || "(noname)"; out[k] = { overdraw: +(s / (W * H)).toFixed(3), coverage: +(cov / (W * H)).toFixed(3), maxLayers: mx };
    }
    r.autoClear = true; r.setRenderTarget(null); r.setClearColor(0x000000, 1);
    trans.forEach((o, i) => (o.visible = vis[i]));
    cam.aspect = oldA; cam.updateProjectionMatrix(); RT.dispose();
    return out;
  }, [+W, +H]);
  console.log(p.name, JSON.stringify(res[p.name]));
}
res.logs = logs; writeFileSync(out, JSON.stringify(res, null, 1)); await browser.close();

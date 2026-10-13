// tools/13 play-build gate: render the SERVED play page headless at the phone buffer and inventory its live scene.
// node playgate.mjs <play_url> <out_dir> [--views a,b]   -> JSON on stdout (renders as PNG in out_dir)
import { chromium } from "/workspace/playtest/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs";
const here = new URL(".", import.meta.url).pathname;
const CFG = JSON.parse(readFileSync(here + "playgate.views.json", "utf8"));
const [url, out, ...rest] = process.argv.slice(2);
const only = rest[0] === "--views" ? rest[1].split(",") : Object.keys(CFG.views);
const HOOK = "if (window.__gcam) { const g = window.__gcam; cam.fov = g.fov; cam.updateProjectionMatrix(); cam.position.set(...g.eye); "
  + "if (g.look) cam.lookAt(...g.look); else cam.rotation.set(g.pitch_deg * Math.PI / 180, 0, 0, 'YXZ'); bolt.visible = false; } lod.update(cam);";
const EXPOSE = "window.__scene = scene; window.__cam = cam; window.__cfg = (typeof SC !== \"undefined\") ? { BOOM: SC.behind, EYE: SC.above, pitch0: SC.pitch_deg, fov0: SC.vfov_deg, aim: SC.aim || null, spineFile: Object.keys(FETCH).find((k) => /spine/.test(k)) || null } : { BOOM, EYE, AIM, fov0: cam.fov }; window.__THREE = THREE; window.__RC = THREE.Raycaster; window.__pg = { adaptive, lod, r, bolt, DOOR, CANVAS, SKY, ground }; window.__ready = true;";
// in-page probe: live LOD / mip / texel density (texel) and capsule + door-ROI masks (framing)
const PROBE = ({ texel, framing, roi, grid, oblique, mats: wantMats }) => {
  const { adaptive, lod, r, bolt, DOOR, CANVAS, SKY } = window.__pg, cam = window.__cam, THREE = { ...Object.getPrototypeOf(cam).constructor };
  const out = { lodLevel: lod.getCurrentLevel(), lodSwitch: lod.levels.map((l) => l.distance), camPos: cam.position.toArray().map((x) => +x.toFixed(2)),
    internalRatio: adaptive.level.ratio, canvasRatio: CANVAS, renderScale: +(adaptive.level.ratio / CANVAS).toFixed(3), maxAniso: r.capabilities.getMaxAnisotropy(),
    sky: { on: SKY.on, err: SKY.err || null }, playerPos: bolt.position.toArray().map((x) => +x.toFixed(2)),
    camToDoor_m: +Math.hypot(cam.position.x - DOOR.x, cam.position.z - DOOR.z).toFixed(2), playerToDoor_m: +Math.hypot(bolt.position.x - DOOR.x, bolt.position.z - DOOR.z).toFixed(2),
    camToPlayer_m: +cam.position.distanceTo(bolt.position).toFixed(2), buffer: [r.domElement.width, r.domElement.height] };
  const lvl = lod.levels[out.lodLevel].object, geo = lvl.geometry, mats = Array.isArray(lvl.material) ? lvl.material : [lvl.material];
  if (texel) {
    const uv = geo.attributes.uv.array, q = (k) => { const v = new Float32Array(uv.length / 2); for (let i = 0; i < v.length; i++) v[i] = uv[i * 2 + k];
      v.sort(); let m = 1; for (let i = 1; i < v.length; i++) { const d = v[i] - v[i - 1]; if (d > 1e-9 && d < m) m = d; } return m; };
    out.uvStep = [q(0), q(1)];
    out.textures = mats.map((m) => ({ name: m.name, map: m.map ? [m.map.image.width, m.map.image.height] : null, aniso: m.map ? m.map.anisotropy : null,
      minFilter: m.map ? m.map.minFilter : null, mips: m.map ? m.map.generateMipmaps : null, side: m.side }));
    const rc = new window.__RC(), H = r.domElement.height, W = r.domElement.width, dy = 2 / H, dx = 2 / W, S = [];
    const hit = (x, y) => { rc.setFromCamera({ x, y }, cam); const h = rc.intersectObject(lvl, false)[0]; return h && h.uv ? h : null; };
    for (let gy = 0; gy < grid; gy++) for (let gx = 0; gx < grid; gx++) {
      const x = -0.8 + 1.6 * gx / (grid - 1), y = -0.8 + 1.6 * gy / (grid - 1), a = hit(x, y), b = hit(x + dx, y), c = hit(x, y + dy);
      if (!a || !b || !c || b.face.materialIndex !== a.face.materialIndex && false) continue;
      const m = mats[geo.groups.find((g) => a.faceIndex * 3 >= g.start && a.faceIndex * 3 < g.start + g.count)?.materialIndex ?? 0];
      if (!m.map) continue; const tw = m.map.image.width, th = m.map.image.height;
      const ux = Math.hypot((b.uv.x - a.uv.x) * tw, (b.uv.y - a.uv.y) * th), uy = Math.hypot((c.uv.x - a.uv.x) * tw, (c.uv.y - a.uv.y) * th);
      const tpp = Math.max(ux, uy) / out.renderScale;   // texels per INTERNAL pixel (mip selection uses the larger axis)
      S.push({ ndc: [+x.toFixed(2), +y.toFixed(2)], mat: m.name, dist: +a.distance.toFixed(2), texelsPerCanvasPx: +Math.max(ux, uy).toFixed(3), texelsPerInternalPx: +tpp.toFixed(3),
        aniso: +(Math.max(ux, uy) / Math.max(1e-6, Math.min(ux, uy))).toFixed(2), mip: +Math.max(0, Math.log2(Math.max(tpp, 1e-6))).toFixed(2), texelsPerMetre: +(Math.max(ux, uy) / (a.distance * 2 * Math.tan(cam.fov * Math.PI / 360) / H)).toFixed(1) });
    }
    out.samples = S;
  }
  if (oblique) {   // metric scene depth under every pixel of a 103 x 229 grid (1 ray per 8 buffer px): world hit, normal, material, uv
    const rc = new window.__RC(), H = [];
    for (let j = 0; j < 229; j++) for (let i = 0; i < 103; i++) { rc.setFromCamera({ x: -1 + (i + 0.5) * 2 / 103, y: 1 - (j + 0.5) * 2 / 229 }, cam);
      const h = rc.intersectObject(lvl, false)[0]; if (!h || !h.uv) continue;
      const g = geo.groups.find((q) => h.faceIndex * 3 >= q.start && h.faceIndex * 3 < q.start + q.count);
      const n = h.face.normal.clone().transformDirection(lvl.matrixWorld);
      H.push([i, j, mats[g ? g.materialIndex : 0].name, +h.uv.x.toFixed(5), +h.uv.y.toFixed(5), +h.point.x.toFixed(4), +h.point.y.toFixed(4), +h.point.z.toFixed(4), +n.x.toFixed(3), +n.y.toFixed(3), +n.z.toFixed(3), +h.distance.toFixed(3)]); }
    out.oblique = H;
  }
  {   // material audit: every mesh material, its map, and magenta / fallback texels in the map image
    const A = []; window.__scene.traverse((o) => { if (!o.isMesh) return; for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      const im = m.map && m.map.image; let mag = null;
      if (im && im.width && !m.map.isCompressedTexture && !m.map.isDataTexture) { const c = document.createElement("canvas"); c.width = 128; c.height = 128; const x = c.getContext("2d"); x.drawImage(im, 0, 0, 128, 128);
        const d = x.getImageData(0, 0, 128, 128).data; let k = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 60 && d[i + 2] > 200) k++; mag = +(k / 16384).toFixed(4); }
      A.push({ node: o.name || o.geometry.type, mat: m.name || m.type, type: m.type, hasMap: !!m.map || !!(m.uniforms && m.uniforms.sky), compressed: !!(m.uniforms && m.uniforms.sky), mapSize: im && im.width ? [im.width, im.height] : null, magentaFrac: mag }); } });
    out.materials = A;
  }
  if (framing) {
    const W = r.domElement.width, H = r.domElement.height, rt = new (window.__THREE.WebGLRenderTarget)(W, H), px = new Uint8Array(W * H * 4);
    const mask = (obj) => { const sc = new window.__THREE.Scene(); sc.add(obj); r.setRenderTarget(rt); r.setClearColor(0x000000, 1); r.clear(); r.render(sc, cam); r.readRenderTargetPixels(rt, 0, 0, W, H, px); r.setRenderTarget(null);
      const m = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) m[i] = px[i * 4] > 127 ? 1 : 0; return m; };
    const wm = new window.__THREE.MeshBasicMaterial({ color: 0xffffff });
    const cap = new window.__THREE.Mesh(bolt.geometry, wm); cap.position.copy(bolt.position); cap.rotation.copy(bolt.rotation); cap.updateMatrixWorld();
    const box = new window.__THREE.Mesh(new window.__THREE.BoxGeometry(...roi.size_m), wm); box.position.set(...roi.centre); box.updateMatrixWorld();
    const C = mask(cap), R = mask(box); let c = 0, rr = 0, o = 0, sy = 0, ymin = H;
    for (let i = 0; i < W * H; i++) { if (C[i]) { c++; const y = H - 1 - Math.floor(i / W); sy += y; if (y < ymin) ymin = y; } if (R[i]) { rr++; if (C[i]) o++; } }
    out.framing = { capsuleFrac: +(c / (W * H)).toFixed(4), capsuleCentroidY: c ? +(sy / c / H).toFixed(3) : null, capsuleTopY: c ? +(ymin / H).toFixed(3) : null,
      doorRoiFrac: +(rr / (W * H)).toFixed(4), doorOccluded: rr ? +(o / rr).toFixed(4) : null, boltVisible: bolt.visible };
  }
  return out;
};
const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const res = { url, views: {}, inventory: null, camera: null };
for (const n of only) {
  const v = CFG.views[n];
  const ctx = await browser.newContext({ viewport: { width: CFG.buffer.css[0], height: CFG.buffer.css[1] }, deviceScaleFactor: v.dpr ?? CFG.buffer.dpr, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errs = []; try { page.on("pageerror", (e) => errs.push(e.message));
  await page.route(/index\.html(\?.*)?$/, async (route) => {
    const r = await route.fetch(); let h = await r.text();
    if (!h.includes("lodJoin(); lod.update(cam);") || !h.includes("window.__ready = true;")) throw new Error("hook points missing in served page");
    h = h.replace("lodJoin(); lod.update(cam);", "lodJoin(); " + HOOK).replace("window.__ready = true;", EXPOSE);
    await route.fulfill({ response: r, body: h, headers: { ...r.headers(), "content-type": "text/html" } });
  });
  if (!v.page) await page.addInitScript((g) => { window.__gcam = g; }, v);
  await page.goto(url.replace(/\/?$/, "/") + "index.html?modeb=1&aa=1" + (v.page ? "&" + v.page : ""), { waitUntil: "load", timeout: 180000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  await page.addStyleTag({ content: "#hud,#bar,#stick{display:none!important}" });
  if (v.sky) await page.waitForFunction(() => window.__pg && (window.__pg.SKY.on || window.__pg.SKY.err), null, { timeout: 120000 }).catch(() => errs.push("sky not on after 120 s"));
  await page.waitForTimeout(2500);
  const probe = await page.evaluate(PROBE, { texel: !!v.texel, framing: !!v.framing, roi: CFG.door_roi, grid: CFG.texel.grid, oblique: !!v.oblique });
  const p = `${out}/${n}.png`; await page.screenshot({ path: p, type: "png" });
  if (!res.inventory) {
    res.inventory = await page.evaluate(() => {
      const L = [];
      window.__scene.traverse((o) => { if (!o.isMesh) return; const ms = Array.isArray(o.material) ? o.material : [o.material];
        let lodLevel = null; for (let q = o.parent; q; q = q.parent) if (q.isLOD) lodLevel = q.levels.findIndex((l) => l.object === o);
        L.push({ name: o.name || "", type: o.geometry.type, lodLevel, visible: o.visible,
          materials: ms.map((m) => ({ name: m.name, type: m.type, side: m.side, transparent: m.transparent, opacity: m.opacity,
            map: m.map && m.map.image ? (m.map.image.currentSrc || m.map.image.src || "").split("/").pop() : null })) }); });
      return L; });
    const c = await page.evaluate(() => ({ ...window.__cfg }));
    c.pitch_deg = c.pitch0 ?? Math.atan2(c.AIM - c.EYE, c.BOOM) * 180 / Math.PI; res.camera = c;
  }
  res.views[n] = { png: p, errors: errs, probe }; } catch (e) { res.failed = res.failed || {}; res.failed[n] = String(e.message || e).slice(0, 400); } await ctx.close();
}
await browser.close(); console.log(JSON.stringify(res));

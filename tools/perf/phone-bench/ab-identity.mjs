// A/B identity: same page, frozen time, same pose; new path vs old path (draw order off + G_OLDPOM), full canvas readback.
// Poses: avenue + side view, pitch so the camera looks at the ground 1.5/3/8/30 m ahead. Adapt the "old" switch for your change.
// node ab-identity.mjs <url> <outdir>   then   python3 ab_sheet.py <outdir>
import { writeFileSync, mkdirSync } from "fs";
const [url, outDir] = process.argv.slice(2); mkdirSync(outDir, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 240, height: 450 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { const rn = performance.now.bind(performance); performance.now = () => (window.__tFreeze ?? rn()); });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto(url, { waitUntil: "load", timeout: 900000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 900000 });
await page.waitForTimeout(12000);
console.log("order", JSON.stringify(await page.evaluate(() => window.__order)));
const base = await page.evaluate(() => ({ x: window.__st.x, z: window.__st.z, yaw: window.__st.yaw }));
const poses = [];
for (const [tag, dx, dz, yaw] of [["avenue", 0, 0, base.yaw], ["side", 0, 0, base.yaw + 70]]) for (const d of [1.5, 3, 8, 30]) poses.push({ name: `${tag}-${d}m`, x: base.x + dx, z: base.z + dz, yaw, pitch: -Math.atan(1.5 / d) * 180 / Math.PI });
const meta = {};
for (const p of poses) {
  await page.evaluate((p) => { window.__tFreeze = undefined; window.__skyT = undefined; const s = window.__st; s.x = p.x; s.z = p.z; s.yaw = p.yaw; s.pitch = p.pitch; s.y = window.__gd.field.surfaceHeight(p.x, p.z) + 1.5; }, p);
  await page.waitForTimeout(4000);
  const r = await page.evaluate(() => {
    const P = window.__gdProf, gl = P.renderer.getContext();
    window.__tFreeze = 333333.0; window.__skyT = 333.333;
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
    const grab = () => { P.render(); P.render(); const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let b = ""; for (let i = 0; i < px.length; i += 32768) b += String.fromCharCode.apply(null, px.subarray(i, i + 32768)); return btoa(b); };
    const gm2 = () => P.ground.material; const saved = []; P.world.traverse((o) => saved.push([o, o.renderOrder]));
    const nw = grab();
    P.sky.renderOrder = -1; P.ground.renderOrder = 0; P.world.traverse((o) => { if (o.renderOrder === 3) o.renderOrder = 0; }); const gm = P.ground.material; gm.defines = { ...(gm.defines || {}), G_OLDPOM: 1 }; gm.needsUpdate = true;
    const old = grab();
    saved.forEach(([o, r]) => (o.renderOrder = r)); { const d = { ...gm2().defines }; delete d.G_OLDPOM; gm2().defines = d; gm2().needsUpdate = true; }
    const nw2 = grab();
    window.__tFreeze = undefined; window.__skyT = undefined;
    return { W, H, nw, old, nw2 };
  });
  for (const k of ["nw", "old", "nw2"]) writeFileSync(`${outDir}/${p.name}-${k}.raw`, Buffer.from(r[k], "base64"));
  meta[p.name] = { W: r.W, H: r.H, pose: p }; console.log(p.name, r.W, r.H);
}
writeFileSync(`${outDir}/meta.json`, JSON.stringify(meta)); await browser.close();

// [look] A/B: how far a "nearly invisible" candidate moves the image. Same page, frozen time, full readback; writes <out>/{a,b,ab}.
// Zone B candidates: (a) POM < 8 m (uGroundPomFade 8), (b) detail fade 10-20 m, (ab) both. node ab-look.mjs <url> <outdir>, then ab_sheet.py <outdir>/a etc.
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
console.log("fill", JSON.stringify(await page.evaluate(() => window.__groundFill())));
const base = await page.evaluate(() => ({ x: window.__st.x, z: window.__st.z, yaw: window.__st.yaw }));
const poses = [];
for (const [tag, dx, dz, yaw] of [["avenue", 0, 0, base.yaw], ["side", 0, 0, base.yaw + 70]]) for (const d of [1.5, 3, 8, 30]) poses.push({ name: `${tag}-${d}m`, x: base.x + dx, z: base.z + dz, yaw, pitch: -Math.atan(1.5 / d) * 180 / Math.PI });
const meta = {};
const ONLY = (process.env.POSES || "").split(",").filter(Boolean);
for (const p of poses) {
  if (ONLY.length && !ONLY.includes(p.name)) continue;
  await page.evaluate((p) => { window.__tFreeze = undefined; window.__skyT = undefined; const s = window.__st; s.x = p.x; s.z = p.z; s.yaw = p.yaw; s.pitch = p.pitch; s.y = window.__gd.field.surfaceHeight(p.x, p.z) + 1.5; }, p);
  await page.waitForTimeout(4000);
  const r = await page.evaluate(() => {
    const P = window.__gdProf, gl = P.renderer.getContext();
    window.__tFreeze = 333333.0; window.__skyT = 333.333;
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
    const grab = () => { P.render(); P.render(); const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let b = ""; for (let i = 0; i < px.length; i += 32768) b += String.fromCharCode.apply(null, px.subarray(i, i + 32768)); return btoa(b); };
    const U = window.__gd.groundU, s0 = { f: U.uGroundPomFade.value, n: U.uGDetNear.value, x: U.uGDetFar.value };
    const set = (a, b) => { U.uGroundPomFade.value = a ? 8 : s0.f; U.uGDetNear.value = b ? 10 : s0.n; U.uGDetFar.value = b ? 20 : s0.x; };
    set(0, 0); const nw = grab(); set(1, 0); const la = grab(); set(0, 1); const lb = grab(); set(1, 1); const lab = grab(); set(0, 0); const nw2 = grab();
    window.__abS0 = s0;
    window.__tFreeze = undefined; window.__skyT = undefined;
    return { W, H, nw, la, lb, lab, nw2, s0 };
  });
  for (const [d, k] of [["a", "la"], ["b", "lb"], ["ab", "lab"]]) { mkdirSync(`${outDir}/${d}`, { recursive: true });
    writeFileSync(`${outDir}/${d}/${p.name}-nw.raw`, Buffer.from(r.nw, "base64")); writeFileSync(`${outDir}/${d}/${p.name}-old.raw`, Buffer.from(r[k], "base64")); writeFileSync(`${outDir}/${d}/${p.name}-nw2.raw`, Buffer.from(r.nw2, "base64")); }
  console.log("s0", JSON.stringify(r.s0));
  meta[p.name] = { W: r.W, H: r.H, pose: p }; console.log(p.name, r.W, r.H);
}
for (const d of ["a", "b", "ab"]) writeFileSync(`${outDir}/${d}/meta.json`, JSON.stringify(meta)); await browser.close();

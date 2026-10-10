// Approach / no-morph check for the ground detail layer. Fixed world target T on the ground, the camera walks toward it
// along a fixed heading (eye 1.5 m, looking at T) from 42 m to 4 m; at every step detail ON and OFF frames.
// Writes per-step PNG pairs + JSON; analysis: gd_approach.py. node gd-approach.mjs <url> <outDir> <tx> <tz> <headingDeg>
import { mkdirSync, writeFileSync } from "fs";
const [url, out, tx, tz, hd] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const { chromium } = await import("/workspace/playtest/node_modules/playwright/index.mjs");
const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await (await browser.newContext({ viewport: { width: 270, height: 600 }, deviceScaleFactor: 1 })).newPage();
const logs = []; page.on("console", (m) => logs.push(m.type() + " " + m.text())); page.on("pageerror", (e) => logs.push("pageerror " + e.message));
await page.goto(`${url}?hud=0&lockq=1&grain=0&eye=1.5&x=${tx}&z=${+tz + 30}`, { waitUntil: "load", timeout: 600000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 600000 });
await page.waitForTimeout(3000);
const ds = []; for (let d = 42; d > 4; d *= 0.9) ds.push(+d.toFixed(2)); ds.push(4);
const rec = [];
for (const [k, d] of ds.entries()) {
  const r = await page.evaluate(({ tx, tz, hd, d }) => {
    const st = window.__st, G = window.__gd, f = G.field;
    const a = (hd * Math.PI) / 180, dx = Math.sin(a), dz = -Math.cos(a);       // heading -> direction (yaw 0 = -Z)
    const x = tx - dx * d, z = tz - dz * d, ty = f.surfaceHeight(tx, tz);
    st.x = x; st.z = z; st.yaw = hd; st.y = f.surfaceHeight(x, z) + 1.5;
    st.pitch = (Math.atan2(ty - st.y, d) * 180) / Math.PI;
    return new Promise((res) => setTimeout(() => res({ x, z, pitch: st.pitch }), 1200));
  }, { tx: +tx, tz: +tz, hd: +hd, d });
  for (const on of [1, 0]) {
    await page.evaluate((on) => { window.__gd.groundU.uGDetOn.value = on; }, on);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/s${String(k).padStart(2, "0")}-${on ? "on" : "off"}.png`, timeout: 300000 });
  }
  rec.push({ k, d, ...r }); console.log(k, d, JSON.stringify(r));
}
writeFileSync(`${out}/approach.json`, JSON.stringify({ steps: rec, console: logs }, null, 1));
console.log("console:", JSON.stringify(logs.filter((l) => !/^(log|debug|info) /.test(l))));
await browser.close();

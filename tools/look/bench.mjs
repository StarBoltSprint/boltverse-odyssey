// Phone bench for the staging page. One headless Chrome, 540x1200 at dpr 2 (1080x2400).
// SwiftShader frame time is informational. The script writes the samples; budget.py decides the default.
import { createRequire } from "node:module";
import { existsSync, writeFileSync } from "node:fs";

const require = createRequire("/workspace/playtest/node_modules/playwright-core/package.json");
const { chromium } = require("playwright-core");
const chrome = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium"].find((p) => existsSync(p));
if (!chrome) throw new Error("no chrome");

const url = process.argv[2];
const out = process.argv[3];
const shot = process.argv[4] || "";
if (!url || !out) throw new Error("bench.mjs URL OUT [SHOT]");

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-gpu-sandbox", "--hide-scrollbars", "--mute-audio"],
});
const context = await browser.newContext({
  viewport: { width: 540, height: 1200 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
page.setDefaultTimeout(180000);
page.setDefaultNavigationTimeout(180000);
const logs = [];
page.on("pageerror", (err) => logs.push(String(err && err.message ? err.message : err)));
page.on("console", (msg) => { if (msg.type() === "error") logs.push(msg.text().slice(0, 240)); });
page.on("response", (res) => { if (res.status() >= 400) logs.push(res.status() + " " + res.url().slice(0, 180)); });
let data = { ok: false };
try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  if (url.includes("bench=1")) {
    await page.waitForFunction(() => window.__benchDts && window.__benchDts.length >= 24, null, { timeout: 90000 });
  } else {
    await page.waitForTimeout(8000);
  }
  if (shot) await page.screenshot({ path: shot, type: "png" });
  data = await page.evaluate(() => {
    const info = window.__renderer && window.__renderer.info;
    return {
      ok: true,
      dts: window.__benchDts ? window.__benchDts.slice(12) : [],
      calls: window.__benchCalls || (info && info.render && info.render.calls) || null,
      textures: info && info.memory ? info.memory.textures : null,
      look: window.__look || null,
      errors: window.__errors || [],
      dpr: window.devicePixelRatio,
      size: [window.innerWidth, window.innerHeight],
    };
  });
} catch (err) {
  let state = null;
  try {
    state = await page.evaluate(() => ({
      ready: window.__ready || false,
      bench: !!window.__lookBench,
      n: window.__benchDts ? window.__benchDts.length : null,
      dts: window.__benchDts ? window.__benchDts.slice(4) : [],
      look: window.__look || null,
      errors: window.__errors || [],
      load: document.getElementById("load") ? document.getElementById("load").textContent : "",
    }));
  } catch (e2) {
    state = { eval: String(e2 && e2.message ? e2.message : e2) };
  }
  data = { ok: false, reason: String(err && err.message ? err.message : err), state };
}
data.logs = logs.slice(0, 12);
writeFileSync(out, JSON.stringify(data));
console.log(JSON.stringify({ ok: data.ok, samples: (data.dts || []).length, calls: data.calls, look: data.look && data.look.on, reason: data.reason, logs: data.logs.slice(0, 4) }));
await browser.close();

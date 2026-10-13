// node measure.mjs <job.json> : renders every (glb, view) of the job -> <out>/<label>-<view>.jpg + <out>/hits-<label>-<view>.json
import { chromium } from "/workspace/playtest/node_modules/playwright/index.mjs"; import { readFileSync, writeFileSync } from "node:fs"; import { extname } from "node:path";
const J = JSON.parse(readFileSync(process.argv[2], "utf8")), here = new URL(".", import.meta.url).pathname;
const CT = { ".js": "text/javascript", ".mjs": "text/javascript", ".html": "text/html", ".jpg": "image/jpeg", ".png": "image/png", ".glb": "model/gltf-binary" };
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
for (const m of J.models) for (const v of J.views) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: J.dpr || 2.6 }); const p = await ctx.newPage(); p.on("pageerror", (e) => console.error("ERR", e.message));
  await p.route("http://dm.local/**", async (rt) => { const u = decodeURIComponent(new URL(rt.request().url()).pathname); let f = null;
    if (u.startsWith("/f/")) f = u.slice(2); else if (u.startsWith("/jsm/")) f = J.jsm + u.slice(5); else if (u === "/three.module.js") f = J.three; else if (u === "/page.html") f = here + "page.html";
    if (!f) return rt.fulfill({ status: 404, body: "" }); rt.fulfill({ status: 200, body: readFileSync(f), headers: { "content-type": CT[extname(f)] || "application/octet-stream" } }); });
  const plates = Object.fromEntries(Object.entries(J.plates || {}).map(([k, f]) => [k, "/f" + f]));
  const qs = new URLSearchParams({ glb: "/f" + m.glb, eye: (v.eye || [0, 0, 0]).join(","), look: (v.look || [0, 0, 0]).join(","), ...(J.auto ? { auto: JSON.stringify(J.auto), mat: J.material || "", ...(J.facing ? { facing: JSON.stringify(J.facing) } : {}), dist: v.dist, angle: v.angle } : {}), ratio: J.ratio || 1.5, plates: JSON.stringify(plates) });
  await p.goto("http://dm.local/page.html?" + qs); await p.waitForFunction(() => window.__done, null, { timeout: 600000 }); await p.waitForTimeout(300);
  await p.screenshot({ path: `${J.out}/${m.label}-${v.name}.jpg`, type: "jpeg", quality: 92 });
  writeFileSync(`${J.out}/hits-${m.label}-${v.name}.json`, JSON.stringify(await p.evaluate(() => window.__res))); await ctx.close(); console.log(m.label, v.name);
}
await b.close();

// Dump every WebGL2 fragment shader a page compiles (for checks/perf_budget.py --frag). Staging URLs only.
// node checks/dump-shaders.mjs <url> <outDir> [nameRegex]
// Each program's fragment source is saved as <outDir>/fs-<n>.frag with the three.js ShaderMaterial name (if any) in
// fs-index.json. Uses SwiftShader like the gate; one headless browser at a time on the shared box.
import fs from "node:fs";
const [url, out, rx] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT || "/workspace/playtest/node_modules/playwright/index.mjs");
const b = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await (await b.newContext({ viewport: { width: 270, height: 600 } })).newPage();
await p.addInitScript(() => {
  window.__fs = [];
  const P = WebGL2RenderingContext.prototype, src = P.shaderSource;
  P.shaderSource = function (sh, s) { if (this.getShaderParameter(sh, this.SHADER_TYPE) === this.FRAGMENT_SHADER) window.__fs.push(s); return src.call(this, sh, s); };
});
await p.goto(url, { timeout: 300000 });
await p.waitForFunction(() => window.__ready === true, null, { timeout: 600000, polling: 1000 });
await p.waitForTimeout(3000);
const list = await p.evaluate(() => window.__fs);
const idx = [];
list.forEach((s, i) => {
  const name = (s.match(/#define SHADER_NAME (.+)/) || [])[1] || "";
  if (rx && !new RegExp(rx).test(name + "\n" + s)) return;
  const f = `fs-${String(i).padStart(2, "0")}.frag`; fs.writeFileSync(`${out}/${f}`, s); idx.push({ file: f, name, chars: s.length });
});
fs.writeFileSync(`${out}/fs-index.json`, JSON.stringify(idx, null, 1));
console.log("fragment shaders", list.length, "saved", idx.length);
await b.close();

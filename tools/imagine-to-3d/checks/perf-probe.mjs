const { chromium } = await import("/workspace/playtest/node_modules/playwright/index.mjs");
const url = process.argv[2];
const b = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await (await b.newContext({ viewport: { width: 270, height: 600 } })).newPage();
await p.goto(url, { timeout: 300000 });
await p.waitForFunction(() => window.__ready === true, null, { timeout: 600000, polling: 1000 });
await p.waitForTimeout(1500);
console.log(JSON.stringify(await p.evaluate(() => { const g = window.__objectsGate || {}; return { v: g.version, perf: window.__perf || null }; })));
await b.close();

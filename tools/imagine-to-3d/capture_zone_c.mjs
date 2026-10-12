// Headless captures of the Zone C solids page after Chargement is gone.
//   node tools/imagine-to-3d/capture_zone_c.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "/workspace/playtest/node_modules/playwright/index.mjs";

const OUT = new URL("../../steps/zone-c/05-solids/renders/", import.meta.url);
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage();
const shots = [];

async function ready(width, height) {
  await page.setViewportSize({ width, height });
  await page.goto("http://127.0.0.1:8772/?along=0", { waitUntil: "load", timeout: 120000 });
  await page.waitForFunction(() => {
    if (window.__sceneReady !== true) return false;
    for (const el of document.querySelectorAll("body *")) {
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden") continue;
      const text = el.childNodes && [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("");
      if (/chargement/i.test(text)) return false;
    }
    return true;
  }, null, { timeout: 90000 });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

await ready(1792, 1008);
const keyDraws = await page.evaluate(() => window.__solids.drawCalls);
const keyPath = new URL("key-1792x1008.png", OUT);
await page.screenshot({ path: keyPath.pathname, timeout: 120000 });
shots.push({ name: "key", along: 0, width: 1792, height: 1008, drawCalls: keyDraws, file: "renders/key-1792x1008.png" });

await ready(720, 1600);
for (const along of [8, 30, 60]) {
  const draws = await page.evaluate((a) => {
    window.__terrain.place(a, 0);
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(window.__solids.drawCalls))));
  }, along);
  const file = `plus-${along}.png`;
  await page.screenshot({ path: new URL(file, OUT).pathname, timeout: 120000 });
  shots.push({ name: `+${along}`, along, width: 720, height: 1600, drawCalls: draws, file: "renders/" + file });
}
const phone = new URL("../../steps/zone-c/05-solids/renders/phone-720x1600.png", import.meta.url);
await page.evaluate(() => window.__terrain.place(8, 0));
await page.screenshot({ path: phone.pathname, timeout: 120000 });

writeFileSync(new URL("capture.json", OUT), JSON.stringify({ shots, phone: "renders/phone-720x1600.png" }, null, 2));
console.log(JSON.stringify(shots, null, 2));
await browser.close();

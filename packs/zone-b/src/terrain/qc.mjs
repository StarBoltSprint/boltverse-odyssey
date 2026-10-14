// Ground QC for a relief zone (docs/METHOD/ground.md §6). Measures only; draws nothing.
// usage: node packs/zone-a/src/terrain/qc.mjs <baseUrl> <outDir> [zoneDir]
//   baseUrl: a static server rooted at the repo, e.g. http://127.0.0.1:8957
//   zoneDir: repo-relative zone folder, default packs/zone-a
// Needs playwright-core from tools/playcheck (run `npm ci` there once) and a local Chrome.
// Based on the Director QC of zone A step 1 (2026-10-03). Canvas PNGs come from toDataURL:
// page.screenshot can hang on this WebGL canvas (learn/failures.md, 2026-10-03).
import { createRequire } from "node:module";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const playcheck = process.env.PLAYCHECK_DIR || resolve(repo, "tools/playcheck");
const { chromium } = createRequire(resolve(playcheck, "package.json"))("playwright-core");
const chrome = process.env.CHROME || ["/opt/google/chrome/chrome", "/usr/bin/google-chrome"].find((p) => existsSync(p));

const [base, out, zoneDir = "packs/zone-a"] = process.argv.slice(2);
if (!base || !out) {
  console.log("usage: node qc.mjs <baseUrl> <outDir> [zoneDir]");
  process.exit(2);
}
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required", "--mute-audio"],
});
// Phone: 720×1600 canvas = 360×800 CSS at DPR 2.
const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const logs = [];
page.on("console", (m) => { if (m.type() === "error") logs.push("error: " + m.text()); });
page.on("pageerror", (e) => logs.push("pageerror: " + e.message));
page.on("response", (r) => { if (r.status() >= 400) logs.push(r.status() + " " + r.url()); });
await page.goto(`${base}/${zoneDir}/play/index.html?debug=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__play && (window.__play.ready || window.__play.error), null, { timeout: 180000 });
const err = await page.evaluate(() => window.__play.error || null);
if (err) { console.log("BOOT ERROR", err); await browser.close(); process.exit(1); }

const res = { info: await page.evaluate(() => window.__play.groundInfo()), shots: [], walks: [], logs };
console.log("groundInfo", JSON.stringify(res.info));

// Relief targets (owner/Director 2026-10-02): span <= 3 m inside any 20 m window, slope <= 15 deg.
res.relief = await page.evaluate(async (zoneDir) => {
  // Same module URL as the play page, so this is the live field with the image depth maps loaded.
  const F = await import(`${location.origin}/${zoneDir}/play/field.js`);
  const e = 1.0; // 2 m baseline: macro slope; the 0.1 m image-depth micro relief barely moves it
  const slopeDeg = (x, z) => Math.atan(Math.hypot(F.heightAt(x + e, z) - F.heightAt(x - e, z),
    F.heightAt(x, z + e) - F.heightAt(x, z - e)) / (2 * e)) * 180 / Math.PI;
  const R = F.maxRadius();
  const inner = [];
  let rimMax = 0, innerMax = 0, over = 0, cells = 0, lo = 1e9, hi = -1e9;
  for (let x = -R; x <= R; x += 1) for (let z = -R; z <= R; z += 1) {
    const u = Math.hypot(x, z) / F.radiusAt(Math.atan2(x, z));
    if (u > 1) continue;
    const d = slopeDeg(x, z);
    const h = F.heightAt(x, z);
    lo = Math.min(lo, h); hi = Math.max(hi, h);
    cells++;
    if (d > 15) over++;
    if (u < 0.92) { inner.push([x, z]); innerMax = Math.max(innerMax, d); } else rimMax = Math.max(rimMax, d);
  }
  let maxSpan = 0;
  for (let i = 0; i < inner.length; i += 5) {
    const [cx, cz] = inner[i];
    let a = 1e9, b = -1e9;
    for (let dx = -10; dx <= 10; dx += 2) for (let dz = -10; dz <= 10; dz += 2) {
      if (dx * dx + dz * dz > 100) continue;
      const px = cx + dx, pz = cz + dz;
      if (Math.hypot(px, pz) > F.radiusAt(Math.atan2(px, pz))) continue; // walkable samples only
      const h = F.heightAt(px, pz);
      a = Math.min(a, h); b = Math.max(b, h);
    }
    maxSpan = Math.max(maxSpan, b - a);
  }
  return { cells, minH: lo, maxH: hi, maxSpan20m: maxSpan, maxSlopeDeg: innerMax, rimSlopeDeg: rimMax,
    over15Pct: (100 * over) / Math.max(1, cells) };
}, zoneDir);
console.log("relief", JSON.stringify(res.relief));
if (process.env.QC_RELIEF_ONLY) { await browser.close(); process.exit(0); }

async function frames(n, dt = 1 / 30) { await page.evaluate(([n, dt]) => { for (let i = 0; i < n; i++) window.__play.tick(dt); }, [n, dt]); }
async function shot(name) {
  const snap = await page.evaluate(() => {
    document.getElementById("hud").style.display = "none";
    const st = document.getElementById("stick");
    if (st) st.style.display = "none";
    const s = window.__play.tick(0);
    return { x: s.x, z: s.z, hdg: s.hdg, mag: s.mag, ground: s.ground, url: document.getElementById("view").toDataURL("image/png") };
  });
  const p = `${out}/${name}.png`;
  writeFileSync(p, Buffer.from(snap.url.split(",")[1], "base64"));
  delete snap.url;
  res.shots.push({ name, path: p, ...snap });
  console.log("shot", name, JSON.stringify(snap));
}

// 1. spawn chase (the play camera)
await page.evaluate(() => { window.__play.clearShot(); window.__play.reset(); });
await frames(10); await shot("q1-spawn-chase");
// 2. walk: 8 headings from the centre, gallop until stuck or 30 s; mag must stay <= 1.0
for (const hdg of [0, 45, 90, 135, 180, 225, 270, 315]) {
  const r = await page.evaluate((hdg) => {
    const P = window.__play; P.clearShot(); P.reset(); P.place(0, 0, hdg);
    P.setInput({ forward: 1, turn: 0, gallop: true });
    let maxR = 0, magMax = 0, groundMax = 0, last = null, stuck = 0, t = 0;
    for (let i = 0; i < 900; i++) {
      const s = P.tick(1 / 30); t += 1 / 30;
      magMax = Math.max(magMax, s.mag); groundMax = Math.max(groundMax, s.ground || 0);
      if (i % 30 === 0) {
        maxR = Math.max(maxR, Math.hypot(s.x, s.z));
        if (last && Math.hypot(s.x - last[0], s.z - last[1]) < 0.1) { if (++stuck > 1) break; } else stuck = 0;
        last = [s.x, s.z];
      }
    }
    P.setInput({ forward: 0, turn: 0, gallop: false });
    const s = P.snapshot();
    return { hdg, end: [s.x, s.z], maxR, magMax, groundMax, t };
  }, hdg);
  res.walks.push(r); console.log("walk", JSON.stringify(r));
  if (hdg === 90) await shot("q2-edge-90");
}
// 3. mid-zone chase shots
for (const [x, z, h, n] of [[20, 10, 30, "q3-chase-a"], [-25, -15, 200, "q4-chase-b"], [10, -30, 300, "q5-chase-c"]]) {
  await page.evaluate(([x, z, h]) => { const P = window.__play; P.clearShot(); P.place(x, z, h); }, [x, z, h]);
  await frames(15); await shot(n);
}
// 4. Bolt-height camera (anti-carpet check; mag > 1 is expected here, it is a judge view, not a play camera)
await page.evaluate(() => { const P = window.__play; P.place(0, 0, 0); const y = P.heightAt(0, -2); P.lookAt([0, y + 0.45, -2.5], [0, y + 0.3, 30]); });
await frames(2); await shot("q6-bolt-height");
// 5. close-up at play magnification (boom 4.2 m, the proof 03-close pose)
await page.evaluate(() => {
  const P = window.__play; P.place(-18, 8, 70); const y = P.heightAt(-18, 8); const a = 70 * Math.PI / 180;
  const fx = Math.sin(a), fz = Math.cos(a);
  P.lookAt([-18 - fx * 4.2, y + 1.15, 8 - fz * 4.2], [-18 + fx * 2.4, y + 0.08, 8 + fz * 2.4]);
});
await frames(2); await shot("q7-close");
// 6. wide views: tile grid / repetition judge (overview inside the sky ring, oblique, top-down)
await page.evaluate(() => { const P = window.__play; P.place(0, 0, 32); P.lookAt([-46, 22, -28], [8, 2, 16]); });
await frames(2); await shot("q8-overview");
await page.evaluate(() => { const P = window.__play; P.place(0, 0, 0); P.lookAt([-30, 12, -30], [20, 0, 20]); });
await frames(2); await shot("q9-wide-oblique");
await page.evaluate(() => { const P = window.__play; P.place(0, 0, 0); P.lookAt([0, 90, -1], [0, 0, 0]); });
await frames(2); await shot("q10-topdown");

const walkMag = Math.max(...res.walks.map((w) => w.magMax));
res.verdict = {
  console_errors: logs.length,
  walk_mag_max: walkMag,
  relief_span_20m_m: res.relief.maxSpan20m,
  slope_max_deg: res.relief.maxSlopeDeg,
  rows: {
    boot_clean: logs.length === 0 ? "PASS" : "FAIL",
    walk_mag_le_1: walkMag <= 1 ? "PASS" : "FAIL",
    relief_span_le_3m_per_20m: res.relief.maxSpan20m <= 3 ? "PASS" : "OPEN",
    slope_le_15deg: res.relief.maxSlopeDeg <= 15 ? "PASS" : "OPEN",
    eyes_on: "judge q1-q10 by eye: soft transitions, no tile grid in q8-q10, no flat cap above the sky in q2",
  },
};
writeFileSync(`${out}/qc.json`, JSON.stringify(res, null, 2));
console.log("verdict", JSON.stringify(res.verdict));
await browser.close();
process.exit(res.verdict.rows.boot_clean === "PASS" && res.verdict.rows.walk_mag_le_1 === "PASS" ? 0 : 1);

import path from "node:path";
import { mkdirSync } from "node:fs";
import { angDist, inGateSpan } from "./layout.mjs";

const DT = 1 / 30;

/**
 * Scripted phone walk. Yields often enough for the screencast to see motion.
 * Still PNGs are the photographed steps. Ring samples are ID snapshots every 10°.
 */
export async function runWalk({ page, layout, stillsDir, video, log }) {
  mkdirSync(stillsDir, { recursive: true });
  const shots = [];
  const samples = [];

  const paintEvery = 3;

  async function tickBatch(n = paintEvery) {
    const pose = await page.evaluate((steps) => {
      let pose = null;
      for (let i = 0; i < steps; i++) pose = window.__play.tick(1 / 30);
      return pose;
    }, n);
    if (video) await video.grab(n);
    else await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    return pose;
  }

  async function simulate(seconds, until) {
    const steps = Math.max(1, Math.round(seconds / DT));
    let pose = null;
    for (let i = 0; i < steps; ) {
      const n = Math.min(paintEvery, steps - i);
      pose = await tickBatch(n);
      i += n;
      if (until && until(pose)) break;
    }
    return pose;
  }

  async function capture(id, kind) {
    if (video) await video.grab(2);
    else await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const snap = await page.evaluate(() => window.__play.snapshot());
    const png = path.join(stillsDir, `${id}.png`);
    await page.screenshot({ path: png, type: "png", scale: "device" });
    if (video) await video.grab(8);
    shots.push({ id, kind, snap, png });
    log(`${id}  hdg ${Math.round(snap.hdg)}  mag ${snap.mag}  ${snap.state}`);
    return snap;
  }

  async function resetLook(hdg) {
    await page.evaluate((heading) => {
      window.__play.reset();
      if (heading != null) window.__play.look(heading);
    }, hdg);
    if (video) await video.grab(4);
  }

  await page.evaluate(() => window.__play.reset());
  page.setDefaultTimeout(180000);
  await page.evaluate(() => window.__play.audit());
  await simulate(0.7);
  await capture("01-spawn", "spawn");

  await page.evaluate(() => window.__play.setInput({ forward: 0, turn: 1, gallop: false }));
  const seen10 = new Set();
  const seen45 = new Set();
  const startSnap = await page.evaluate(() => window.__play.snapshot());
  samples.push({ id: "ring-start", kind: "ring", snap: startSnap });
  seen10.add(Math.round(startSnap.hdg / 10) * 10 % 360);
  let turned = 0;
  let prev = startSnap.hdg;
  for (let guard = 0; guard < 500 && turned < 365; guard++) {
    const pose = await tickBatch(1);
    let delta = pose.hdg - prev;
    if (delta < -180) delta += 360;
    if (delta < 0) delta += 360;
    if (delta > 90) delta = 0;
    turned += delta;
    prev = pose.hdg;
    const bucket10 = Math.round(pose.hdg / 10) * 10 % 360;
    const bucket45 = Math.round(pose.hdg / 45) * 45 % 360;
    if (!seen10.has(bucket10) && angDist(pose.hdg, bucket10) <= 6) {
      seen10.add(bucket10);
      const snap = await page.evaluate(() => window.__play.snapshot());
      samples.push({ id: `ring-${bucket10}`, kind: "ring", snap });
    }
    if (!seen45.has(bucket45) && angDist(pose.hdg, bucket45) <= 8 && bucket45 !== 0) {
      seen45.add(bucket45);
      await capture(`02-turn-${String(bucket45).padStart(3, "0")}`, "turn");
    }
  }
  await page.evaluate(() => window.__play.setInput({ forward: 0, turn: 0, gallop: false }));
  log(`turn samples ${samples.length} stills ${seen45.size}`);

  const gate = layout.gates[0];
  await resetLook(gate ? gate.heading : 0);
  await capture("03-gate-start", "gate");
  await page.evaluate(() => window.__play.setInput({ forward: 1, turn: 0, gallop: false }));
  await simulate(7, (p) => p.pathTrigger || (p.blocked && p.spd < 0.05));
  await capture("03-gate-end", "gate");

  const headings = [0, 45, 90, 135, 180, 225, 270, 315].filter((h) => !inGateSpan(h, layout.gates));
  for (const h of headings) {
    await resetLook(h);
    await page.evaluate(() => window.__play.setInput({ forward: 1, turn: 0, gallop: false }));
    await simulate(7, (p) => p.blocked && p.spd < 0.05);
    await page.evaluate(() => window.__play.setInput({ forward: 0, turn: 0, gallop: false }));
    await simulate(0.45);
    await capture(`04-stop-${String(h).padStart(3, "0")}`, "stop");
  }

  for (const obj of layout.interiors) {
    await resetLook(null);
    await page.evaluate((o) => {
      const bearing = Math.atan2(o.x, o.z) * 180 / Math.PI;
      window.__play.look((bearing + 360) % 360);
      window.__play.setInput({ forward: 1, turn: 0, gallop: false });
    }, { x: obj.position[0], z: obj.position[1] });
    await simulate(6, (p) => {
      const d = Math.hypot(p.x - obj.position[0], p.z - obj.position[1]);
      return d < obj.radius + 0.55 || (p.blocked && p.spd < 0.05);
    });
    await page.evaluate(() => window.__play.setInput({ forward: 0, turn: 0, gallop: false }));
    await simulate(0.2);
    await capture(`05-${obj.id}`, "approach");
  }

  await resetLook(20);
  await page.evaluate(() => window.__play.setInput({ forward: 1, turn: 0, gallop: true }));
  await simulate(1.1);
  await capture("06-gallop", "gallop");
  await page.evaluate(() => window.__play.setInput({ forward: 0, turn: 0, gallop: false }));
  await simulate(0.55);
  await capture("07-idle", "idle");

  const wreck = (layout.interiors || []).find((o) => o.id === "hero-00") || layout.interiors[0];
  if (wreck && wreck.position) {
    const inward = Math.atan2(-wreck.position[0], -wreck.position[1]);
    for (const bearing of [0, 90, 180, 270]) {
      await page.evaluate(({ x0, z0, yaw, bearing: b, inward: inn }) => {
        const side = ((yaw + b) * Math.PI) / 180;
        const pull = 0.7;
        let dx = Math.sin(side) * (1 - pull) + Math.sin(inn) * pull;
        let dz = Math.cos(side) * (1 - pull) + Math.cos(inn) * pull;
        const n = Math.hypot(dx, dz) || 1;
        dx /= n;
        dz /= n;
        const dist = 4.8;
        const x = x0 + dx * dist;
        const z = z0 + dz * dist;
        const hdg = (Math.atan2(x0 - x, z0 - z) * 180) / Math.PI;
        window.__play.place(x, z, (hdg + 360) % 360);
        window.__play.setInput({ forward: 0, turn: 0, gallop: false });
      }, { x0: wreck.position[0], z0: wreck.position[1], yaw: wreck.yaw || 0, bearing, inward });
      await simulate(0.25);
      await capture(`08-wreck-${String(bearing).padStart(3, "0")}`, "wreck-orbit");
    }
  }

  return { shots, samples };
}

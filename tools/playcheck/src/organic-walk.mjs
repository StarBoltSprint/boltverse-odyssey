import path from "node:path";
import { mkdirSync } from "node:fs";

const DT = 1 / 30;

/**
 * Waypoint walk for schema clearing/2.
 * Public hook only: reset, look, setInput, tick, snapshot.
 * Stills at each sub-area. Every waypoint is logged.
 * Boundary probes walk from an interior origin along the outward heading.
 */
export async function runOrganicWalk({ page, layout, stillsDir, video, log }) {
  mkdirSync(stillsDir, { recursive: true });
  const shots = [];
  const samples = [];
  const popSamples = [];
  const fadeSamples = [];
  const preloadSamples = [];
  const waypoints = [];

  function takeFade(snap) {
    if (!snap) return null;
    const sample = {};
    let any = false;
    if (snap.opacity) {
      sample.opacity = snap.opacity;
      any = true;
    }
    if (snap.areas) {
      sample.areas = snap.areas;
      any = true;
    }
    if (snap.representation) {
      sample.representation = snap.representation;
      any = true;
    }
    if (Array.isArray(snap.frustum)) {
      sample.frustum = snap.frustum;
      any = true;
    }
    if (snap.occluded != null) sample.occluded = snap.occluded;
    if (snap.beyondFog != null) sample.beyondFog = snap.beyondFog;
    if (snap.far != null) sample.far = snap.far;
    if (snap.t_ms != null) sample.t_ms = snap.t_ms;
    if (snap.distance_m != null) sample.distance_m = snap.distance_m;
    return any ? sample : null;
  }

  function takePreload(snap) {
    if (!snap) return null;
    const sample = {};
    let any = false;
    if (snap.x != null) {
      sample.x = snap.x;
      any = true;
    }
    if (snap.z != null) {
      sample.z = snap.z;
      any = true;
    }
    if (snap.hdg != null) {
      sample.hdg = snap.hdg;
      any = true;
    }
    if (snap.spd != null) sample.spd = snap.spd;
    if (snap.vx != null) sample.vx = snap.vx;
    if (snap.vz != null) sample.vz = snap.vz;
    if (snap.t_ms != null) sample.t_ms = snap.t_ms;
    if (snap.cells) {
      sample.cells = snap.cells;
      any = true;
    }
    return any ? sample : null;
  }

  async function tickBatch(n = 2) {
    const packed = await page.evaluate((steps) => {
      const pops = [];
      const fades = [];
      const pres = [];
      let pose = null;
      for (let i = 0; i < steps; i++) {
        pose = window.__play.tick(1 / 30);
        const snap = window.__play.snapshot();
        if (snap) {
          pose = snap;
          if (snap.areas || Array.isArray(snap.frustum)) {
            const sample = {};
            if (snap.areas) sample.areas = snap.areas;
            if (Array.isArray(snap.frustum)) sample.frustum = snap.frustum;
            pops.push(sample);
          }
          const fade = {};
          let fadeAny = false;
          if (snap.opacity) {
            fade.opacity = snap.opacity;
            fadeAny = true;
          }
          if (snap.areas) {
            fade.areas = snap.areas;
            fadeAny = true;
          }
          if (snap.representation) {
            fade.representation = snap.representation;
            fadeAny = true;
          }
          if (Array.isArray(snap.frustum)) {
            fade.frustum = snap.frustum;
            fadeAny = true;
          }
          if (snap.occluded != null) fade.occluded = snap.occluded;
          if (snap.beyondFog != null) fade.beyondFog = snap.beyondFog;
          if (snap.far != null) fade.far = snap.far;
          if (snap.t_ms != null) fade.t_ms = snap.t_ms;
          if (snap.distance_m != null) fade.distance_m = snap.distance_m;
          if (fadeAny) fades.push(fade);
          const pre = {};
          let preAny = false;
          if (snap.x != null) {
            pre.x = snap.x;
            preAny = true;
          }
          if (snap.z != null) {
            pre.z = snap.z;
            preAny = true;
          }
          if (snap.hdg != null) {
            pre.hdg = snap.hdg;
            preAny = true;
          }
          if (snap.spd != null) pre.spd = snap.spd;
          if (snap.vx != null) pre.vx = snap.vx;
          if (snap.vz != null) pre.vz = snap.vz;
          if (snap.t_ms != null) pre.t_ms = snap.t_ms;
          if (snap.cells) {
            pre.cells = snap.cells;
            preAny = true;
          }
          if (preAny) pres.push(pre);
        }
      }
      return { pose, pops, fades, pres };
    }, n);
    for (const p of packed.pops || []) popSamples.push(p);
    for (const p of packed.fades || []) fadeSamples.push(p);
    for (const p of packed.pres || []) preloadSamples.push(p);
    if (video) await video.grab(n);
    else await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    return packed.pose;
  }

  async function simulate(seconds, until) {
    const steps = Math.max(1, Math.round(seconds / DT));
    let pose = null;
    for (let i = 0; i < steps; ) {
      const n = Math.min(2, steps - i);
      pose = await tickBatch(n);
      i += n;
      if (until && pose && until(pose)) break;
    }
    return pose;
  }

  async function capture(id, kind, extra) {
    if (video) await video.grab(2);
    else await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const snap = await page.evaluate(() => window.__play.snapshot());
    if (extra) Object.assign(snap, extra);
    if (snap.areas || Array.isArray(snap.frustum)) {
      const sample = {};
      if (snap.areas) sample.areas = snap.areas;
      if (Array.isArray(snap.frustum)) sample.frustum = snap.frustum;
      popSamples.push(sample);
    }
    const fade = takeFade(snap);
    if (fade) fadeSamples.push(fade);
    const pre = takePreload(snap);
    if (pre) preloadSamples.push(pre);
    const png = path.join(stillsDir, `${id}.png`);
    await page.screenshot({ path: png, type: "png", scale: "device" });
    if (video) await video.grab(4);
    shots.push({ id, kind, snap, png });
    log(`${id}  hdg ${Math.round(snap.hdg)}  mag ${snap.mag}  ${snap.state}`);
    return snap;
  }

  async function halt() {
    await page.evaluate(() => window.__play.setInput({ forward: 0, turn: 0, gallop: false }));
  }

  async function walkTo(tx, tz, arrive) {
    let retreats = 0;
    let pose = null;
    for (let i = 0; i < 700; i++) {
      pose = await page.evaluate(() => window.__play.snapshot());
      if (!pose) return pose;
      if (Math.hypot(tx - pose.x, tz - pose.z) <= arrive) return pose;
      if (pose.blocked && Number(pose.spd) < 0.05) {
        retreats += 1;
        if (retreats > 12) return pose;
        const away = awayFromContact(pose.x, pose.z, tx, tz) + [0, 50, -50, 90, -90, 180][(retreats - 1) % 6];
        await page.evaluate((h) => {
          window.__play.look((h + 360) % 360);
          window.__play.setInput({ forward: 1, turn: 0, gallop: false });
        }, away);
        await tickBatch(8);
        continue;
      }
      const heading = (Math.atan2(tx - pose.x, tz - pose.z) * 180) / Math.PI;
      await page.evaluate((h) => {
        window.__play.look((h + 360) % 360);
        window.__play.setInput({ forward: 1, turn: 0, gallop: false });
      }, heading);
      await tickBatch(2);
    }
    return pose;
  }

  await page.evaluate(() => window.__play.reset());
  await simulate(0.4);
  await capture("01-spawn", "spawn");

  await page.evaluate(() => {
    window.__play.look(0);
    window.__play.setInput({ forward: 0, turn: 1, gallop: false });
  });
  const seen = new Set();
  let turned = 0;
  let prev = 0;
  for (let guard = 0; guard < 500 && turned < 345; guard++) {
    const pose = await tickBatch(1);
    if (!pose) break;
    let delta = Number(pose.hdg) - prev;
    if (delta < -180) delta += 360;
    if (delta < 0) delta += 360;
    if (delta > 90) delta = 0;
    turned += delta;
    prev = Number(pose.hdg);
    const bucket = ((Math.round(Number(pose.hdg) / 15) * 15) % 360 + 360) % 360;
    if (!seen.has(bucket)) {
      seen.add(bucket);
      const snap = await page.evaluate(() => window.__play.snapshot());
      samples.push({ id: `sweep-${bucket}`, kind: "sweep", snap });
    }
  }
  await halt();
  log(`sweep samples ${seen.size}`);

  const route = (layout.route && layout.route.waypoints) || [];
  for (const wp of route) {
    const pose = await walkTo(wp.x, wp.z, wp.kind === "sub_area" ? 1.15 : 1.35);
    await halt();
    await simulate(wp.kind === "sub_area" ? 0.4 : 0.12);
    const name = wp.kind === "sub_area" ? wp.subArea : wp.passage;
    log(`waypoint ${wp.kind} ${name} x ${Number(wp.x).toFixed(2)} z ${Number(wp.z).toFixed(2)}`);
    waypoints.push({
      id: wp.id,
      kind: wp.kind,
      subArea: wp.subArea,
      passage: wp.passage,
      x: wp.x,
      z: wp.z,
      arrivedX: pose ? pose.x : null,
      arrivedZ: pose ? pose.z : null,
    });
    await capture(wp.kind === "sub_area" ? `wp-${wp.subArea}-${wp.id}` : `wp-${wp.id}`, wp.kind);
  }

  function awayFromContact(x, z, tx, tz) {
    let nearest = null;
    let best = Infinity;
    for (const p of layout.pieces || []) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < best) {
        best = d;
        nearest = p;
      }
    }
    if (nearest && best < nearest.radius + 2) {
      return (Math.atan2(x - nearest.x, z - nearest.z) * 180) / Math.PI;
    }
    return (Math.atan2(x - tx, z - tz) * 180) / Math.PI;
  }

  function stageOf(probe) {
    const rad = (probe.heading_deg * Math.PI) / 180;
    let x = probe.origin[0] - Math.sin(rad) * 4;
    let z = probe.origin[1] - Math.cos(rad) * 4;
    const pieces = layout.pieces || [];
    for (let n = 0; n < 16; n++) {
      let nearest = null;
      let best = Infinity;
      for (const p of pieces) {
        const d = Math.hypot(x - p.x, z - p.z);
        if (d < p.radius + 1.5 && d < best) {
          best = d;
          nearest = p;
        }
      }
      if (!nearest) break;
      const d = best || 1;
      x += ((x - nearest.x) / d) * 0.75;
      z += ((z - nearest.z) / d) * 0.75;
    }
    return [x, z];
  }

  for (const probe of layout.probes || []) {
    if (probe.gate) continue;
    const stage = stageOf(probe);
    await walkTo(stage[0], stage[1], 1.2);
    await page.evaluate((h) => {
      window.__play.look(h);
      window.__play.setInput({ forward: 1, turn: 0, gallop: false });
    }, probe.heading_deg);
    await simulate(3.2, (p) => p.blocked && Number(p.spd) < 0.05);
    await halt();
    await simulate(0.2);
    await capture(probe.id, "boundary", { probeId: probe.id });
  }

  const gate = layout.gates && layout.gates[0];
  if (gate && gate.position) {
    const pose = await page.evaluate(() => window.__play.snapshot());
    const heading = (Math.atan2(gate.position[0] - pose.x, gate.position[1] - pose.z) * 180) / Math.PI;
    await page.evaluate((h) => {
      window.__play.look((h + 360) % 360);
      window.__play.setInput({ forward: 0, turn: 0, gallop: false });
    }, heading);
    await simulate(0.2);
    await capture("03-gate-start", "gate");
    await page.evaluate(() => window.__play.setInput({ forward: 1, turn: 0, gallop: false }));
    await simulate(8, (p) => p.pathTrigger || (p.blocked && Number(p.spd) < 0.05));
    await capture("03-gate-end", "gate");
    await halt();
  }

  await page.evaluate(() => window.__play.setInput({ forward: 1, turn: 0, gallop: true }));
  await simulate(0.8);
  await capture("06-gallop", "gallop");
  await halt();
  await simulate(0.5);
  await capture("07-idle", "idle");

  if (popSamples.length < 2) {
    popSamples.push({ areas: {} }, { areas: {} });
  }
  return { shots, samples, popSamples, fadeSamples, preloadSamples, waypoints };
}

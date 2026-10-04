// Ruin walk: gallop Bolt through the gate opening and into the wreck hangar, then measure.
// Reads the play page through window.__play only. Does not draw anything.

const DT = 1 / 30;

export function frameOf(obj) {
  const s = Math.sin(obj.yaw);
  const c = Math.cos(obj.yaw);
  if (obj.frame === "ship") return { a: s, b: -c, c, d: s, px: obj.x, pz: obj.z };
  return { a: c, b: s, c: -s, d: c, px: obj.x, pz: obj.z };
}
export function toWorld(f, lx, lz) {
  return [f.a * lx + f.b * lz + f.px, f.c * lx + f.d * lz + f.pz];
}
export function toLocal(f, wx, wz) {
  const dx = wx - f.px;
  const dz = wz - f.pz;
  return [f.a * dx + f.c * dz, f.b * dx + f.d * dz];
}
function hdgOf(dx, dz) {
  return ((Math.atan2(dx, dz) * 180) / Math.PI + 360) % 360;
}

/** Rock footprints (centre + radius) from the rocks manifest, for picking a clear straight run. */
export function rockDiscs(rocks) {
  const out = [];
  for (const inst of rocks.instances || []) {
    const t = (rocks.types || {})[inst.type];
    if (!t || t.kind !== "hull" || inst.collider === false) continue;
    const sz = t.objectSize || [1, 1, 1];
    out.push({ id: inst.id, x: inst.x, z: inst.z, r: 0.5 * Math.hypot(sz[0], sz[2]) * (inst.scale || 1) + 0.35 });
  }
  return out;
}

function lineClear(discs, ax, az, bx, bz) {
  let worst = 99;
  for (const d of discs) {
    const vx = bx - ax;
    const vz = bz - az;
    const L2 = vx * vx + vz * vz || 1;
    let t = ((d.x - ax) * vx + (d.z - az) * vz) / L2;
    t = Math.max(0, Math.min(1, t));
    worst = Math.min(worst, Math.hypot(ax + vx * t - d.x, az + vz * t - d.z) - d.r);
  }
  return worst;
}

/** Straight runs derived from the measured parts in the ruin manifest (no fixed coordinates). */
export function ruinRoutes(manifest, discs) {
  const gate = manifest.objects.find((o) => o.frame !== "ship");
  const wreck = manifest.objects.find((o) => o.frame === "ship");
  const out = {};
  if (gate && gate.openingBoxM) {
    const f = frameOf(gate);
    const ob = gate.openingBoxM;
    const depth = Math.abs((gate.bounds && gate.bounds.depth) || 2.9);
    const mid = 0.5 * (ob[0] + ob[1]);
    const half = 0.5 * (ob[1] - ob[0]);
    let best = null;
    for (const off of [0, -0.25, 0.25, -0.5, 0.5, -0.7, 0.7]) {
      if (Math.abs(off) > half - 0.55) continue;
      const a = toWorld(f, mid + off, 8);
      const b = toWorld(f, mid + off, -depth - 4);
      const clear = lineClear(discs, a[0], a[1], b[0], b[1]);
      if (!best || clear > best.clear + 0.05) best = { off, clear, a, b };
    }
    out.arch = {
      frame: f,
      lx: mid + best.off,
      startLocalZ: 8,
      exitLocalZ: -depth - 3,
      start: best.a,
      hdg: hdgOf(best.b[0] - best.a[0], best.b[1] - best.a[1]),
      rockClearM: best.clear,
      depth,
    };
  }
  if (wreck && wreck.hangar) {
    const f = frameOf(wreck);
    const h = wreck.hangar;
    let best = null;
    for (let i = 1; i < 8; i++) {
      const lx = h.x[0] + ((h.x[1] - h.x[0]) * i) / 8;
      const a = toWorld(f, lx, h.portZ + 6);
      const b = toWorld(f, lx, h.portZ);
      const clear = lineClear(discs, a[0], a[1], b[0], b[1]);
      const centred = -Math.abs(i - 4) * 0.01;
      if (!best || clear + centred > best.score) best = { lx, clear, a, b, score: clear + centred };
    }
    out.hangar = {
      frame: f,
      lx: best.lx,
      portZ: h.portZ,
      start: best.a,
      hdg: hdgOf(best.b[0] - best.a[0], best.b[1] - best.a[1]),
      rockClearM: best.clear,
    };
  }
  return out;
}

/**
 * Drive one straight gallop inside the page. `until` is evaluated in the page on the local position.
 * Returns per-frame camera and body records.
 */
export async function drive(page, plan) {
  return page.evaluate(async (plan) => {
    const P = window.__play;
    const f = plan.frame;
    const loc = (x, z) => {
      const dx = x - f.px;
      const dz = z - f.pz;
      return [f.a * dx + f.c * dz, f.b * dx + f.d * dz];
    };
    const rec = [];
    const probeEvery = plan.probeEvery || 0;
    const mags = {};
    const sample = (phase, out) => {
      const cam = P.camState();
      const [lx, lz] = loc(out.x, out.z);
      const w = P.ruinWhere(out.x, out.z);
      rec.push({
        phase, x: out.x, z: out.z, lx, lz, hdg: out.hdg,
        blocked: out.blocked, contact: !!out.ruinContact, state: out.state,
        eye: cam.eye, boom: cam.boom, clamped: cam.clamped, swing: cam.swing, boltMag: cam.boltMag, feet: cam.feet,
        eyeClear: P.ruinClearance(cam.eye[0], cam.eye[1], cam.eye[2]),
        covered: !!(w && w.covered),
        mag: out.mag,
      });
      if (probeEvery && rec.length % probeEvery === 0) {
        const pr = P.ruinProbe();
        for (const k of Object.keys(pr)) {
          const m = pr[k];
          if (!m || !(m.mag > 0)) continue;
          const key = k + (w && w.covered ? "@inside" : "");
          if (!mags[key] || m.mag > mags[key].mag) mags[key] = { mag: m.mag, dist: m.dist, tpm: m.tpm, eye: cam.eye, bolt: [out.x, out.z] };
        }
      }
    };
    for (const step of plan.steps) {
      if (step.place) {
        P.clearShot();
        P.place(step.place[0], step.place[1], step.place[2]);
        for (let i = 0; i < 20; i++) P.tick(plan.dt);
        continue;
      }
      P.setInput(step.input);
      let still = 0;
      let lastX = null;
      let lastZ = null;
      for (let i = 0; i < step.maxTicks; i++) {
        const out = P.tick(plan.dt);
        sample(step.phase, out);
        const [lx, lz] = loc(out.x, out.z);
        if (step.untilLocalZBelow != null && lz < step.untilLocalZBelow) break;
        if (step.untilLocalZAbove != null && lz > step.untilLocalZAbove) break;
        if (lastX != null && Math.hypot(out.x - lastX, out.z - lastZ) < 0.004) still++;
        else still = 0;
        lastX = out.x;
        lastZ = out.z;
        if (step.untilStill && still >= step.untilStill) break;
      }
    }
    P.setInput({ forward: 0, turn: 0, gallop: false });
    P.tick(plan.dt);
    return { rec, mags };
  }, plan);
}

/** Camera smoothness and body metrics from the frame records. */
export function judge(rec, dt = DT) {
  let maxStep = 0;
  let maxJerk = 0;
  let minEyeClear = 99;
  let blocked = 0;
  let clamped = 0;
  let maxBoltMag = 0;
  let maxFeetStep = 0;
  for (let i = 0; i < rec.length; i++) {
    const r = rec[i];
    if (r.blocked) blocked++;
    if (r.clamped) clamped++;
    if (r.eyeClear < minEyeClear) minEyeClear = r.eyeClear;
    if (r.boltMag > maxBoltMag) maxBoltMag = r.boltMag;
    if (i > 0) {
      const p = rec[i - 1];
      const d = Math.hypot(r.eye[0] - p.eye[0], r.eye[1] - p.eye[1], r.eye[2] - p.eye[2]);
      if (d > maxStep) maxStep = d;
      maxFeetStep = Math.max(maxFeetStep, Math.abs(r.feet - p.feet));
    }
    if (i > 1) {
      const p = rec[i - 1];
      const q = rec[i - 2];
      const j = Math.hypot(r.eye[0] - 2 * p.eye[0] + q.eye[0], r.eye[1] - 2 * p.eye[1] + q.eye[1], r.eye[2] - 2 * p.eye[2] + q.eye[2]);
      if (j > maxJerk) maxJerk = j;
    }
  }
  return { frames: rec.length, dt, maxStep, maxJerk, minEyeClear, blocked, clamped, maxBoltMag, maxFeetStep };
}

export function archPlan(route, dt = DT) {
  return {
    dt,
    frame: route.frame,
    probeEvery: 3,
    steps: [
      { place: [route.start[0], route.start[1], route.hdg] },
      { phase: "arch", input: { forward: 1, turn: 0, gallop: true }, maxTicks: Math.ceil((route.startLocalZ - route.exitLocalZ + 2) / (4.4 * dt)), untilLocalZBelow: route.exitLocalZ },
    ],
  };
}

export function hangarPlan(route, dt = DT) {
  return {
    dt,
    frame: route.frame,
    probeEvery: 3,
    steps: [
      { place: [route.start[0], route.start[1], route.hdg] },
      { phase: "in", input: { forward: 1, turn: 0, gallop: true }, maxTicks: Math.ceil(12 / (4.4 * dt)), untilStill: 8 },
      { phase: "turn", input: { forward: 0, turn: 1, gallop: false }, maxTicks: Math.round(180 / (150 * dt)) },
      { phase: "out", input: { forward: 1, turn: 0, gallop: true }, maxTicks: Math.ceil(10 / (4.4 * dt)), untilLocalZAbove: route.portZ + 4 },
    ],
  };
}

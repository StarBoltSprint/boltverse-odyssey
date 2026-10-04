// Ruin walk: gallop Bolt through the gate opening, into the wreck hangar, into walls and along
// them, and around both ruins, then measure. Reads the play page through window.__play only.
// Draws nothing. Every route and every check is derived from the ruin manifest's measured parts
// and the shipped .ruin meshes, so a re-cooked gate or wreck needs no edit here.

const DT = 1 / 30;
// Shake: the eye's acceleration reverses between two frames while both are larger than this
// (metres per frame squared). A smooth chase, ease or slide never does that; jitter does.
const SHAKE_M = 0.04;
// Bolt's straight gallop speed is read from the page; this is only the fallback for tick budgets.
const GALLOP_FALLBACK = 4.4;

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
function dirWorld(f, dlx, dlz) {
  return [f.a * dlx + f.b * dlz, f.c * dlx + f.d * dlz];
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

export function lineClear(discs, ax, az, bx, bz) {
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

function gateDepth(gate) {
  if (gate.bounds && gate.bounds.min) return gate.bounds.max[2] - gate.bounds.min[2];
  throw new Error("gate manifest has no bounds");
}

/** Straight runs derived from the measured parts in the ruin manifest (no fixed coordinates). */
export function ruinRoutes(manifest, discs) {
  const gate = manifest.objects.find((o) => o.frame !== "ship");
  const wreck = manifest.objects.find((o) => o.frame === "ship");
  const out = {};
  if (gate && gate.openingBoxM) {
    const f = frameOf(gate);
    const ob = gate.openingBoxM;
    const depth = gateDepth(gate);
    const front = gate.bounds.max[2];
    const r = (manifest.collider && manifest.collider.bodyRadiusM) || 0.3;
    // Done when the whole body is past the back face, plus a margin.
    const exitZ = front - depth - r - 0.6;
    const mid = 0.5 * (ob[0] + ob[1]);
    const half = 0.5 * (ob[1] - ob[0]);
    // The most central line whose run is clear of rocks; the widest rock gap only as a fallback.
    let best = null;
    let widest = null;
    for (const off of [0, -0.15, 0.15, -0.3, 0.3, -0.45, 0.45, -0.6, 0.6]) {
      if (Math.abs(off) > half - 0.55) continue;
      const a = toWorld(f, mid + off, front + 8);
      const b = toWorld(f, mid + off, exitZ - r);
      const clear = lineClear(discs, a[0], a[1], b[0], b[1]);
      const cand = { off, clear, a, b };
      // Rock discs already carry the body radius, so any positive clearance is a free run.
      if (!best && clear >= 0.1) best = cand;
      if (!widest || clear > widest.clear) widest = cand;
    }
    best = best || widest;
    out.arch = {
      frame: f,
      lx: mid + best.off,
      startLocalZ: front + 8,
      exitLocalZ: exitZ,
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

/** A straight gallop in an object's local frame: start (lx, lz), direction (dlx, dlz), length. */
export function lineRun(f, phase, lx, lz, dlx, dlz, lengthM, extra = {}) {
  const n = Math.hypot(dlx, dlz) || 1;
  const s = toWorld(f, lx, lz);
  const d = dirWorld(f, dlx / n, dlz / n);
  return {
    phase,
    start: s,
    hdg: hdgOf(d[0], d[1]),
    lengthM,
    ...extra,
  };
}

/**
 * Wall, slide and sweep runs for one manifest. All from bounds, opening box and hangar.
 * walls: head-on into solid parts (piers, closed hull side). slides: shallow angle into a face.
 * sweeps: lines across and around each ruin; every contact on them must sit on a real face.
 */
export function ruinProbes(manifest, discs, opt = {}) {
  const r = (manifest.collider && manifest.collider.bodyRadiusM) || 0.3;
  const sweepStep = opt.sweepStepM || 0.5;
  const gate = manifest.objects.find((o) => o.frame !== "ship");
  const wreck = manifest.objects.find((o) => o.frame === "ship");
  const walls = [];
  const slides = [];
  const sweeps = [];
  const clearOf = (run) => {
    const e = [run.start[0] + Math.sin((run.hdg * Math.PI) / 180) * run.lengthM, run.start[1] + Math.cos((run.hdg * Math.PI) / 180) * run.lengthM];
    return lineClear(discs, run.start[0], run.start[1], e[0], e[1]);
  };
  if (gate && gate.openingBoxM && gate.bounds) {
    const f = frameOf(gate);
    const ob = gate.openingBoxM;
    const [x0, , z0] = gate.bounds.min;
    const [x1, , z1] = gate.bounds.max;
    const runIn = 7;
    // Head-on into the middle of each pier's front.
    for (const [name, lx] of [["gate-pier-left", 0.5 * (x0 + ob[0])], ["gate-pier-right", 0.5 * (ob[1] + x1)]]) {
      walls.push({ obj: "gate", frame: f, ...lineRun(f, name, lx, z1 + runIn, 0, -1, runIn + (z1 - z0) + 3) });
    }
    // Slide: a shallow line onto the front face of the wider pier, heading away from the opening.
    const leftW = ob[0] - x0;
    const rightW = x1 - ob[1];
    const side = leftW >= rightW ? -1 : 1;
    const pierMid = side < 0 ? 0.5 * (x0 + ob[0]) : 0.5 * (ob[1] + x1);
    const ang = (opt.slideDeg || 30) * Math.PI / 180;
    const back = 4;
    slides.push({
      obj: "gate",
      frame: f,
      face: { axis: "z", value: z1, normal: 1, along: side },
      ...lineRun(f, "gate-slide", pierMid - side * Math.cos(ang) * back, z1 + Math.sin(ang) * back, side * Math.cos(ang), -Math.sin(ang), back + 4),
    });
    // Sweeps across: lines along local z from in front to behind, every sweepStep across the width.
    for (let lx = x0 - 1; lx <= x1 + 1 + 1e-6; lx += sweepStep) {
      sweeps.push({ obj: "gate", frame: f, ...lineRun(f, "gate-sweep-z", lx, z1 + 4, 0, -1, (z1 - z0) + 8) });
    }
    // Sweeps along: just clear of the front and back faces (body radius plus 0.2 m), and past the ends.
    const g = r + 0.2;
    sweeps.push({ obj: "gate", frame: f, expectFree: true, ...lineRun(f, "gate-pass-front", x0 - 4, z1 + g, 1, 0, (x1 - x0) + 8) });
    sweeps.push({ obj: "gate", frame: f, expectFree: true, ...lineRun(f, "gate-pass-back", x1 + 4, z0 - g, -1, 0, (x1 - x0) + 8) });
    sweeps.push({ obj: "gate", frame: f, expectFree: true, ...lineRun(f, "gate-pass-left", x0 - g, z1 + 4, 0, -1, (z1 - z0) + 8) });
    sweeps.push({ obj: "gate", frame: f, expectFree: true, ...lineRun(f, "gate-pass-right", x1 + g, z1 + 4, 0, -1, (z1 - z0) + 8) });
  }
  if (wreck && wreck.hangar && wreck.bounds) {
    const f = frameOf(wreck);
    const h = wreck.hangar;
    const [x0, , z0] = wreck.bounds.min;
    const [x1, , z1] = wreck.bounds.max;
    // Head-on into the closed port side and a shallow slide along it, beside the bay, on the
    // stretch of hull with the most room from rocks (the lines come from bounds and the bay only).
    const ang = (opt.slideDeg || 30) * Math.PI / 180;
    const back = 4;
    let bestWall = null;
    let bestSlide = null;
    for (let wx = x0 + 2; wx <= x1 - 2 + 1e-6; wx += 1) {
      if (wx > h.x[0] - 1.5 && wx < h.x[1] + 1.5) continue;
      const wall = { obj: "wreck", frame: f, ...lineRun(f, "wreck-hull", wx, z1 + 6, 0, -1, 6 + (z1 - z0)) };
      wall.rockClearM = clearOf(wall);
      if (!bestWall || wall.rockClearM > bestWall.rockClearM) bestWall = wall;
      for (const along of [-1, 1]) {
        const end = wx + along * (back + 5) * Math.cos(ang);
        if (end < x0 + 1 || end > x1 - 1) continue;
        // Keep the slide off the bay mouth so it slides along closed hull only.
        if ((along > 0 && wx < h.x[0] && end > h.x[0] - 1) || (along < 0 && wx > h.x[1] && end < h.x[1] + 1)) continue;
        const slide = {
          obj: "wreck",
          frame: f,
          face: { axis: "z", value: z1, normal: 1, along },
          ...lineRun(f, "wreck-slide", wx - along * Math.cos(ang) * back, z1 + Math.sin(ang) * back, along * Math.cos(ang), -Math.sin(ang), back + 5),
        };
        slide.rockClearM = clearOf(slide);
        if (!bestSlide || slide.rockClearM > bestSlide.rockClearM) bestSlide = slide;
      }
    }
    if (bestWall) walls.push(bestWall);
    if (bestSlide) slides.push(bestSlide);
    // Sweeps across the hull (local z) every 2 m of length, and the bay mouth at sweepStep.
    for (let lx = x0 + 1; lx <= x1 - 1 + 1e-6; lx += opt.hullStepM || 2) {
      sweeps.push({ obj: "wreck", frame: f, ...lineRun(f, "wreck-sweep-z", lx, z1 + 4, 0, -1, (z1 - z0) + 8) });
    }
    for (let lx = h.x[0]; lx <= h.x[1] + 1e-6; lx += opt.bayStepM || sweepStep) {
      sweeps.push({ obj: "wreck", frame: f, ...lineRun(f, "wreck-bay-z", lx, z1 + 4, 0, -1, (z1 - z0) + 8) });
    }
  }
  for (const list of [walls, slides, sweeps]) for (const run of list) run.rockClearM = clearOf(run);
  return { walls, slides, sweeps };
}

/** Parse a .ruin mesh (see packs/<pack>/play/ruins.js). */
export function readRuin(buf) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== "RUIN") throw new Error("not a ruin mesh");
  let o = 4;
  const n = view.getUint32(o, true);
  o += 4;
  const groups = [];
  for (let i = 0; i < n; i++) {
    const skin = view.getUint32(o, true);
    const vc = view.getUint32(o + 4, true);
    const ic = view.getUint32(o + 8, true);
    o += 12;
    const xyzuv = new Float32Array(vc * 5);
    for (let k = 0; k < vc * 5; k++) xyzuv[k] = view.getFloat32(o + k * 4, true);
    o += vc * 20;
    const idx = new Uint32Array(ic);
    for (let k = 0; k < ic; k++) idx[k] = view.getUint32(o + k * 4, true);
    o += ic * 4;
    groups.push({ skin, xyzuv, idx });
  }
  return groups;
}

/** Face samples of one placed ruin in world xz plus world y, deduplicated on a 3D grid. */
export function faceSamplesWorld(groups, f, seatY, spacing = 0.1) {
  const seen = new Set();
  const out = [];
  for (const g of groups) {
    const p = g.xyzuv;
    const idx = g.idx;
    for (let t = 0; t + 2 < idx.length; t += 3) {
      const ia = idx[t] * 5;
      const ib = idx[t + 1] * 5;
      const ic = idx[t + 2] * 5;
      const ex = p[ib] - p[ia], ey = p[ib + 1] - p[ia + 1], ez = p[ib + 2] - p[ia + 2];
      const fx = p[ic] - p[ia], fy = p[ic + 1] - p[ia + 1], fz = p[ic + 2] - p[ia + 2];
      const e = Math.max(Math.hypot(ex, ey, ez), Math.hypot(fx, fy, fz), Math.hypot(ex - fx, ey - fy, ez - fz));
      const n = Math.max(1, Math.ceil(e / spacing));
      for (let i = 0; i <= n; i++) {
        for (let j = 0; j <= n - i; j++) {
          const lx = p[ia] + (i / n) * ex + (j / n) * fx;
          const ly = p[ia + 1] + (i / n) * ey + (j / n) * fy;
          const lz = p[ia + 2] + (i / n) * ez + (j / n) * fz;
          const key = Math.round(lx / (spacing * 0.5)) + "," + Math.round(ly / (spacing * 0.5)) + "," + Math.round(lz / (spacing * 0.5));
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(f.a * lx + f.b * lz + f.px, seatY + ly, f.c * lx + f.d * lz + f.pz);
        }
      }
    }
  }
  return new Float64Array(out);
}

/**
 * Ground truth from the drawn faces, independent of collide.js: world xz of every face sample and
 * its height above the live relief. nearest(x, z, hLo, hHi) = horizontal distance to the closest
 * face sample whose height above the ground lies in [hLo, hHi].
 */
export function truthIndex(xyz, ground, cell = 0.5) {
  const n = ground.length;
  const map = new Map();
  for (let i = 0; i < n; i++) {
    const k = Math.floor(xyz[i * 3] / cell) + "," + Math.floor(xyz[i * 3 + 2] / cell);
    let a = map.get(k);
    if (!a) map.set(k, (a = []));
    a.push(i);
  }
  return {
    count: n,
    nearest(x, z, hLo, hHi, maxR = 2) {
      const cx = Math.floor(x / cell);
      const cz = Math.floor(z / cell);
      const span = Math.ceil(maxR / cell);
      let best = Infinity;
      for (let dx = -span; dx <= span; dx++) {
        for (let dz = -span; dz <= span; dz++) {
          const a = map.get(cx + dx + "," + (cz + dz));
          if (!a) continue;
          for (const i of a) {
            const h = xyz[i * 3 + 1] - ground[i];
            if (h < hLo || h > hHi) continue;
            const d = Math.hypot(xyz[i * 3] - x, xyz[i * 3 + 2] - z);
            if (d < best) best = d;
          }
        }
      }
      return best;
    },
  };
}

/** Build the truth index for every ruin in the manifest. readFile(path) -> Buffer. */
export async function buildTruth(page, manifest, readFile, spacing = 0.1) {
  const info = await page.evaluate(() => window.__play.ruinInfo());
  const parts = [];
  for (const obj of manifest.objects) {
    const seat = info.seats.find((s) => s.id === obj.id);
    const f = frameOf(obj);
    parts.push(faceSamplesWorld(readRuin(readFile(obj.mesh)), f, seat.y, spacing));
  }
  let total = 0;
  for (const p of parts) total += p.length;
  const xyz = new Float64Array(total);
  let o = 0;
  for (const p of parts) {
    xyz.set(p, o);
    o += p.length;
  }
  const xz = [];
  for (let i = 0; i < xyz.length; i += 3) xz.push(xyz[i], xyz[i + 2]);
  const ground = new Float64Array(
    await page.evaluate((xz) => {
      const out = new Array(xz.length / 2);
      for (let i = 0; i < out.length; i++) out[i] = window.__play.heightAt(xz[2 * i], xz[2 * i + 1]);
      return out;
    }, xz),
  );
  return truthIndex(xyz, ground);
}

/**
 * Drive straight gallops inside the page. Returns per-frame camera and body records.
 * A step either places Bolt ({ place: [x, z, hdg] }) or holds an input until a stop condition.
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
    const tickOpt = plan.draw ? undefined : { draw: false };
    const rec = [];
    const probeEvery = plan.probeEvery || 0;
    const mags = {};
    let near = Infinity;
    let nearAt = null;
    let sx = 0;
    let sz = 0;
    let stepIdx = 0;
    const sample = (phase, out, k) => {
      const cam = P.camState();
      const [lx, lz] = loc(out.x, out.z);
      const w = plan.light ? null : P.ruinWhere(out.x, out.z);
      const r = {
        phase, step: stepIdx, k, x: out.x, z: out.z, lx, lz, hdg: out.hdg, spd: out.spd,
        blocked: out.blocked, contact: !!out.ruinContact, state: out.state,
        eye: cam.eye, fwd: cam.fwd, boom: cam.boom, clamped: cam.clamped, swing: cam.swing, boltMag: cam.boltMag, feet: cam.feet,
        eyeClear: plan.light ? 99 : P.ruinClearance(cam.eye[0], cam.eye[1], cam.eye[2]),
        covered: !!(w && w.covered),
        travel: Math.hypot(out.x - sx, out.z - sz),
      };
      rec.push(r);
      if (probeEvery && rec.length % probeEvery === 0) {
        const pr = P.ruinProbe();
        for (const key of Object.keys(pr)) {
          const m = pr[key];
          if (!m) continue;
          if (m.near < near) {
            near = m.near;
            nearAt = { part: key, eye: cam.eye, bolt: [out.x, out.z], phase };
          }
          if (m.near < r.near || r.near == null) r.near = m.near;
          if (!(m.mag > 0)) continue;
          const tag = key + (w && w.covered ? "@inside" : "");
          if (!mags[tag] || m.mag > mags[tag].mag) mags[tag] = { mag: m.mag, dist: m.dist, tpm: m.tpm, eye: cam.eye, bolt: [out.x, out.z] };
        }
      }
    };
    for (const step of plan.steps) {
      stepIdx++;
      if (step.place) {
        P.clearShot();
        P.place(step.place[0], step.place[1], step.place[2]);
        for (let i = 0; i < (step.settle == null ? 20 : step.settle); i++) P.tick(plan.dt, tickOpt);
        sx = step.place[0];
        sz = step.place[1];
        continue;
      }
      P.setInput(step.input);
      let still = 0;
      let lastX = null;
      let lastZ = null;
      for (let i = 0; i < step.maxTicks; i++) {
        const out = P.tick(plan.dt, tickOpt);
        sample(step.phase, out, i);
        const [lx, lz] = loc(out.x, out.z);
        if (step.untilLocalZBelow != null && lz < step.untilLocalZBelow) break;
        if (step.untilLocalZAbove != null && lz > step.untilLocalZAbove) break;
        if (step.untilTravel != null && Math.hypot(out.x - sx, out.z - sz) >= step.untilTravel) break;
        if (lastX != null && Math.hypot(out.x - lastX, out.z - lastZ) < 0.004) still++;
        else still = 0;
        lastX = out.x;
        lastZ = out.z;
        if (step.untilStill && still >= step.untilStill) break;
      }
    }
    P.setInput({ forward: 0, turn: 0, gallop: false });
    P.tick(plan.dt, tickOpt);
    return { rec, mags, near, nearAt };
  }, plan);
}

/**
 * Camera smoothness and body metrics from the frame records.
 * maxStep: largest eye move in one frame (a pop is metre-class).
 * maxJerk: largest second difference of the eye. maxJerkSteady: the same, only on frames where the
 * input has been held for at least 3 frames (an input change may turn the whole rig at once).
 * boomFlips: frames where the boom length reverses direction at speed.
 * shake: frames where the eye's acceleration flips direction at size (SHAKE_M), i.e. jitter.
 */
export function judge(rec, dt = DT) {
  let maxStep = 0;
  let maxJerk = 0;
  let maxJerkSteady = 0;
  let minEyeClear = 99;
  let minNear = Infinity;
  let blocked = 0;
  let clamped = 0;
  let contact = 0;
  let maxBoltMag = 0;
  let maxFeetStep = 0;
  let boomFlips = 0;
  let shake = 0;
  for (let i = 0; i < rec.length; i++) {
    const r = rec[i];
    if (r.blocked) blocked++;
    if (r.clamped) clamped++;
    if (r.contact) contact++;
    if (r.eyeClear < minEyeClear) minEyeClear = r.eyeClear;
    if (r.near != null && r.near < minNear) minNear = r.near;
    if (r.boltMag > maxBoltMag) maxBoltMag = r.boltMag;
    const same1 = i > 0 && rec[i - 1].step === r.step;
    if (same1) {
      const p = rec[i - 1];
      const d = Math.hypot(r.eye[0] - p.eye[0], r.eye[1] - p.eye[1], r.eye[2] - p.eye[2]);
      if (d > maxStep) maxStep = d;
      maxFeetStep = Math.max(maxFeetStep, Math.abs(r.feet - p.feet));
    }
    if (i > 1 && rec[i - 2].step === r.step) {
      const p = rec[i - 1];
      const q = rec[i - 2];
      const j = Math.hypot(r.eye[0] - 2 * p.eye[0] + q.eye[0], r.eye[1] - 2 * p.eye[1] + q.eye[1], r.eye[2] - 2 * p.eye[2] + q.eye[2]);
      if (j > maxJerk) maxJerk = j;
      if (r.k >= 3 && j > maxJerkSteady) maxJerkSteady = j;
      if (i > 2 && rec[i - 3].step === r.step) {
        const o = rec[i - 3];
        const j0 = [p.eye[0] - 2 * q.eye[0] + o.eye[0], p.eye[1] - 2 * q.eye[1] + o.eye[1], p.eye[2] - 2 * q.eye[2] + o.eye[2]];
        const j1 = [r.eye[0] - 2 * p.eye[0] + q.eye[0], r.eye[1] - 2 * p.eye[1] + q.eye[1], r.eye[2] - 2 * p.eye[2] + q.eye[2]];
        const dot = j0[0] * j1[0] + j0[1] * j1[1] + j0[2] * j1[2];
        if (dot < 0 && Math.hypot(...j0) > SHAKE_M && Math.hypot(...j1) > SHAKE_M) shake++;
      }
      const b1 = r.boom - p.boom;
      const b0 = p.boom - q.boom;
      if (b1 * b0 < 0 && Math.abs(b1) > 0.006 && Math.abs(b0) > 0.006) boomFlips++;
    }
  }
  return { frames: rec.length, dt, maxStep, maxJerk, maxJerkSteady, boomFlips, shake, minEyeClear, minNear, blocked, clamped, contact, maxBoltMag, maxFeetStep };
}

function ticksFor(m, dt) {
  return Math.ceil(m / (GALLOP_FALLBACK * 0.7 * dt)) + 10;
}

export function archPlan(route, dt = DT) {
  return {
    dt,
    frame: route.frame,
    probeEvery: 1,
    steps: [
      { place: [route.start[0], route.start[1], route.hdg] },
      { phase: "arch", input: { forward: 1, turn: 0, gallop: true }, maxTicks: ticksFor(route.startLocalZ - route.exitLocalZ + 2, dt), untilLocalZBelow: route.exitLocalZ },
    ],
  };
}

export function hangarPlan(route, dt = DT) {
  return {
    dt,
    frame: route.frame,
    probeEvery: 1,
    steps: [
      { place: [route.start[0], route.start[1], route.hdg] },
      { phase: "in", input: { forward: 1, turn: 0, gallop: true }, maxTicks: ticksFor(12, dt), untilStill: 8 },
      { phase: "turn", input: { forward: 0, turn: 1, gallop: false }, maxTicks: Math.round(180 / (150 * dt)) },
      { phase: "out", input: { forward: 1, turn: 0, gallop: true }, maxTicks: ticksFor(10, dt), untilLocalZAbove: route.portZ + 4 },
    ],
  };
}

/** One straight gallop from lineRun(); stops after its length or when Bolt stands still. */
export function runPlan(run, dt = DT, opt = {}) {
  return {
    dt,
    frame: run.frame,
    probeEvery: opt.probeEvery || 0,
    light: !!opt.light,
    steps: [
      { place: [run.start[0], run.start[1], run.hdg], settle: opt.settle },
      { phase: run.phase, input: { forward: 1, turn: 0, gallop: true }, maxTicks: ticksFor(run.lengthM, dt), untilTravel: run.lengthM, untilStill: opt.untilStill == null ? 10 : opt.untilStill },
    ],
  };
}

/**
 * Check one run against the face truth.
 * invisible: contact frames with no face (any height up to Bolt's) within r + tol of the body.
 * minFace: closest approach of the body centre to a face in the core of the body band.
 */
export function truthCheck(rec, truth, opt) {
  const r = opt.radius;
  const tol = opt.tol == null ? 0.2 : opt.tol;
  let invisible = 0;
  let worstGap = 0;
  let firstInvisible = null;
  let minFace = Infinity;
  for (const f of rec) {
    const core = truth.nearest(f.x, f.z, opt.coreLo, opt.coreHi, r + 1);
    if (core < minFace) minFace = core;
    if (!f.contact) continue;
    const any = truth.nearest(f.x, f.z, opt.anyLo, opt.anyHi, r + tol + 1);
    if (any > r + tol) {
      invisible++;
      if (any - r > worstGap) worstGap = any - r;
      if (!firstInvisible) firstInvisible = { x: f.x, z: f.z, lx: f.lx, lz: f.lz, gap: any - r };
    }
  }
  return { invisible, worstGap, firstInvisible, minFace };
}

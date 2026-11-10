// engine/footcontact.js — stance-phase foot lock for the rear gallop card.
//
// The live card parents every paw to the body, so a sole that should be
// planted still travels at the body's ground speed. Cadence already scales
// with speed (phase += distance / strideLength). This brick keeps that clock
// and, while a sole is in its measured stance, holds that sole's world point.
// The chest is not moved and the card is not scaled, so Bolt's size stays put.
//
// Per biome, pass a config object. `contacts` is the atlas stance table
// (one entry per frame). `lock: false` is the live behaviour, for the before
// measurement. The brick draws no fog.

const D2R = Math.PI / 180;

export const FOOT_CONTACT_DEFAULT = {
  id: "meadow",
  fog: 0,
  speed: 7.0,
  strideHz: 1.95,
  accel: 9.0,
  brake: 5.5,
  vIdle: 0.08,
  idleFrame: 21,
  frames: 32,
  cardH: 1.15,
  cardPxW: 224,
  cardPxH: 652,
  cardFootPx: 6,
  sink: 0.095,
  lock: true,
  nu: 13,
  nv: 21,
  chestV0: 0.42,
  chestV1: 0.62,
  soleU: 0.20,
  soleV: 0.10,
  camBack: 2.35,
  camHeight: 1.12,
  camAhead: 2.2,
  camLookH: 0.66,
  camLat: -0.012,
  camTau: 0.11,
  maxRel: 10 * D2R,
  turnRate: 75 * D2R,
  turnTau: 0.25,
  turnReleaseTau: 0.10,
  idleTau: 0.10,
  contacts: [],
};

export const SCRIPT_SECONDS = 10;

/** Straight gallop, turn left, turn right, release, stand. */
export function scriptInput(t) {
  if (t < 2) return { run: 1, turn: 0, seg: "straight" };
  if (t < 3.5) return { run: 1, turn: 1, seg: "turnL" };
  if (t < 5) return { run: 1, turn: -1, seg: "turnR" };
  return { run: 0, turn: 0, seg: "release" };
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function smooth(t) { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); }
function lerp(a, b, t) { return a + (b - a) * t; }

export function makeFootContact(cfg = {}) {
  const c = { ...FOOT_CONTACT_DEFAULT, ...cfg, contacts: cfg.contacts || FOOT_CONTACT_DEFAULT.contacts };
  c.fog = 0;
  c.cardW = c.cardH * (c.cardPxW / c.cardPxH);
  c.cardFoot = c.cardFootPx / c.cardPxH;
  c.strideM = c.speed / c.strideHz;
  c.idlePhase = c.idleFrame / c.frames;
  c.scale = 1;

  const nu = c.nu, nv = c.nv;
  const uvs = new Float32Array(nu * nv * 2);
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const k = (j * nu + i) * 2;
    uvs[k] = i / (nu - 1);
    uvs[k + 1] = j / (nv - 1);
  }
  const indices = new Uint32Array((nu - 1) * (nv - 1) * 6);
  let n = 0;
  for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu - 1; i++) {
    const a = j * nu + i;
    indices[n++] = a; indices[n++] = a + 1; indices[n++] = a + nu;
    indices[n++] = a + 1; indices[n++] = a + nu + 1; indices[n++] = a + nu;
  }

  function frameOf(phase) {
    const f = Math.round(phase * c.frames);
    return ((f % c.frames) + c.frames) % c.frames;
  }
  function contactsAt(phase) {
    const list = c.contacts[frameOf(phase)];
    return list || [];
  }
  function chest(v) { return smooth((v - c.chestV0) / (c.chestV1 - c.chestV0)); }
  function soleW(u, v, p) {
    const du = (u - p.u) / c.soleU;
    const dv = (v - p.v) / c.soleV;
    const d = Math.hypot(du, dv);
    const core = d <= 1 ? 1 : Math.exp(-((d - 1) * (d - 1)) / 0.35);
    return core * chest(v);
  }

  function basis(s) {
    const camX = -Math.sin(s.cam), camZ = -Math.cos(s.cam);
    const rightX = -camZ, rightZ = camX;
    const eyeX = s.x - camX * c.camBack + rightX * c.camLat;
    const eyeZ = s.z - camZ * c.camBack + rightZ * c.camLat;
    let tx = eyeX - s.x, tz = eyeZ - s.z;
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl; tz /= tl;
    return {
      tx, tz, rtX: -tz, rtZ: tx,
      eye: [eyeX, c.camHeight, eyeZ],
      target: [s.x + camX * c.camAhead + rightX * c.camLat, c.camLookH, s.z + camZ * c.camAhead + rightZ * c.camLat],
    };
  }

  function rest(s, b, u, v) {
    const lx = (0.5 - u) * c.cardW;
    const ly = ((1 - v) - c.cardFoot) * c.cardH - c.sink;
    return [
      s.x + b.rtX * lx + b.tx * 0.02,
      s.y + ly,
      s.z + b.rtZ * lx + b.tz * 0.02,
    ];
  }

  function create(init = {}) {
    return {
      x: 0, y: 0, z: 0, psi: 0, cam: 0, w: 0,
      v: c.speed, phase: 0, run: 1,
      plants: {},
      down: {},
      prev: {},
      dist: 0,
      ...init,
    };
  }

  function updatePlants(s, b) {
    const now = contactsAt(s.phase);
    const seen = new Set();
    for (const p of now) {
      seen.add(p.id);
      if (!s.down[p.id]) {
        const r = rest(s, b, p.u, p.v);
        s.plants[p.id] = { x: r[0], y: 0, z: r[2], u: p.u, v: p.v, side: p.side };
        s.down[p.id] = true;
      } else {
        const rec = s.plants[p.id];
        rec.u = p.u; rec.v = p.v; rec.side = p.side;
      }
    }
    for (const id of Object.keys(s.down)) if (!seen.has(id)) s.down[id] = false;
  }

  function pawPoints(s, b) {
    const out = [];
    for (const p of contactsAt(s.phase)) {
      const r = rest(s, b, p.u, p.v);
      const planted = c.lock && s.down[p.id] && s.plants[p.id];
      const x = planted ? s.plants[p.id].x : r[0];
      const y = planted ? 0 : r[1];
      const z = planted ? s.plants[p.id].z : r[2];
      out.push({ id: p.id, side: p.side, u: p.u, v: p.v, x, y, z, down: true });
    }
    return out;
  }

  function step(s, dt, input) {
    const turn = input.turn || 0;
    const run = input.run ? 1 : 0;
    const target = turn * c.turnRate;
    const tau = target === 0 ? c.turnReleaseTau : c.turnTau;
    s.w += (target - s.w) * (1 - Math.exp(-dt / tau));
    if (target === 0 && Math.abs(s.w) < 0.05) s.w = 0;
    s.run = run;
    if (run) s.v = Math.min(c.speed, s.v + c.accel * dt);
    else s.v = Math.max(0, s.v - c.brake * dt);
    s.psi += s.w * dt;
    const x0 = s.x, z0 = s.z;
    s.x += -Math.sin(s.psi) * s.v * dt;
    s.z += -Math.cos(s.psi) * s.v * dt;
    const moved = Math.hypot(s.x - x0, s.z - z0);
    s.dist += moved;
    if (s.v <= c.vIdle) {
      s.v = 0;
      let d = ((c.idlePhase - s.phase + 1.5) % 1) - 0.5;
      s.phase = (s.phase + d * (1 - Math.exp(-dt / c.idleTau)) + 1) % 1;
      if (Math.abs(d) < 0.02) s.phase = c.idlePhase;
    } else {
      s.phase = (s.phase + moved / c.strideM) % 1;
    }
    s.cam += (s.psi - s.cam) * (1 - Math.exp(-dt / c.camTau));
    if (s.psi - s.cam > c.maxRel) s.cam = s.psi - c.maxRel;
    if (s.cam - s.psi > c.maxRel) s.cam = s.psi + c.maxRel;

    const b = basis(s);
    updatePlants(s, b);
    const paws = pawPoints(s, b);
    const slides = [];
    for (const p of paws) {
      const prev = s.prev[p.id];
      let slideM = null;
      if (prev && prev.down) slideM = Math.hypot(p.x - prev.x, p.z - prev.z);
      slides.push({ id: p.id, slideM, y: p.y });
      s.prev[p.id] = { x: p.x, y: p.y, z: p.z, down: true };
    }
    for (const id of Object.keys(s.prev)) {
      if (!paws.some(p => p.id === id)) s.prev[id] = { ...s.prev[id], down: false };
    }
    s._b = b;
    s._paws = paws;
    s._slides = slides;
    s._moved = moved;
    return s;
  }

  function deform(s) {
    const b = s._b || basis(s);
    const all = s._paws || pawPoints(s, b);
    const paws = all.filter(p => c.lock && s.down[p.id]);
    const deltas = paws.map(p => {
      const r = rest(s, b, p.u, p.v);
      return { p, dx: p.x - r[0], dy: p.y - r[1], dz: p.z - r[2] };
    });
    const pos = new Float32Array(nu * nv * 3);
    let torsoMin = 1e9, torsoMax = -1e9, torsoShift = 0;
    const wAt = (u, v, id) => {
      for (const d of deltas) if (d.p.id === id) return soleW(u, v, d.p);
      return 0;
    };
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const vi = j * nu + i;
      const u = uvs[vi * 2], v = uvs[vi * 2 + 1];
      const r = rest(s, b, u, v);
      let dx = 0, dy = 0, dz = 0;
      let best = 0, bestD = null;
      for (const d of deltas) {
        const w = soleW(u, v, d.p);
        if (w > best) { best = w; bestD = d; }
      }
      // The sole core belongs to one paw. Blending two plants pulls the sole off its plant.
      if (bestD && best > 0) { dx = bestD.dx * best; dy = bestD.dy * best; dz = bestD.dz * best; }
      const x = r[0] + dx, y = r[1] + dy, z = r[2] + dz;
      pos[vi * 3] = x; pos[vi * 3 + 1] = y; pos[vi * 3 + 2] = z;
      if (v <= c.chestV0) {
        torsoMin = Math.min(torsoMin, y);
        torsoMax = Math.max(torsoMax, y);
        torsoShift = Math.max(torsoShift, Math.hypot(dx, dy, dz));
      }
    }
    // The drawn sole is the card texel at the contact uv. If the triangle around
    // that uv is fully locked, the interpolated point is the plant.
    const interp = (u, v) => {
      const x = clamp(u, 0, 1) * (nu - 1), y = clamp(v, 0, 1) * (nv - 1);
      const i0 = Math.min(nu - 2, Math.floor(x));
      const j0 = Math.min(nv - 2, Math.floor(y));
      const tx = x - i0, ty = y - j0;
      const i00 = j0 * nu + i0;
      const at = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
      const mix = (A, B, C, wa, wb, wc) => [
        A[0] * wa + B[0] * wb + C[0] * wc,
        A[1] * wa + B[1] * wb + C[1] * wc,
        A[2] * wa + B[2] * wb + C[2] * wc,
      ];
      if (tx + ty <= 1) return { p: mix(at(i00), at(i00 + 1), at(i00 + nu), 1 - tx - ty, tx, ty), corners: [[i0, j0], [i0 + 1, j0], [i0, j0 + 1]] };
      return { p: mix(at(i00 + 1), at(i00 + nu + 1), at(i00 + nu), 1 - ty, tx + ty - 1, 1 - tx), corners: [[i0 + 1, j0], [i0 + 1, j0 + 1], [i0, j0 + 1]] };
    };
    const drawn = [];
    for (const p of all) {
      const hit = interp(p.u, p.v);
      let lockW = 1;
      for (const [iu, iv] of hit.corners) lockW = Math.min(lockW, wAt(iu / (nu - 1), iv / (nv - 1), p.id));
      const prev = s.prevDrawn?.[p.id];
      let slideM = null;
      if (prev) slideM = Math.hypot(hit.p[0] - prev.x, hit.p[2] - prev.z);
      drawn.push({ id: p.id, x: hit.p[0], y: hit.p[1], z: hit.p[2], slideM, lockW });
      s.prevDrawn = s.prevDrawn || {};
      s.prevDrawn[p.id] = { x: hit.p[0], z: hit.p[2] };
    }
    if (s.prevDrawn) for (const id of Object.keys(s.prevDrawn)) if (!all.some(p => p.id === id)) delete s.prevDrawn[id];
    return { pos, torsoH: torsoMax - torsoMin, torsoTop: torsoMax, torsoShift, drawn };
  }

  function pose(s) {
    const mesh = deform(s);
    const paws = s._paws || [];
    const ys = paws.map(p => p.y);
    const flatDy = ys.length >= 2 ? Math.max(...ys) - Math.min(...ys) : null;
    const lift = ys.length ? ys.reduce((a, y) => a + Math.abs(y), 0) / ys.length : null;
    let d = ((c.idlePhase - s.phase + 1.5) % 1) - 0.5;
    return {
      cfgId: c.id,
      fog: c.fog,
      scale: c.scale,
      lock: c.lock,
      strideM: c.strideM,
      phase: s.phase,
      frame: frameOf(s.phase),
      blend: (s.phase * c.frames) % 1,
      v: s.v,
      idle: s.v === 0 && Math.abs(d) < 0.02,
      paws,
      slides: s._slides || [],
      flatDy,
      lift,
      torsoH: mesh.torsoH,
      torsoTop: mesh.torsoTop,
      torsoShift: mesh.torsoShift,
      mesh: mesh.drawn,
      lockWMin: mesh.drawn.reduce((m, d) => Math.min(m, d.lockW), 1),
      pos: mesh.pos,
      uvs,
      indices,
      eye: s._b.eye,
      target: s._b.target,
      nu, nv,
    };
  }

  return { cfg: c, create, step, pose, basis, rest, frameOf, uvs, indices };
}

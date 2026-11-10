// bricks/bolt-idle.js — usual bolt439 sprite card. Gallop size matches the aaa2 card.
// Idle (speed under vIdle) plants the measured paw frame, breathes from the feet, wags the tail.
// While galloping, misc.x stays 0 so the card is the normal follow-camera sprite. Not m447v.
const CARD_H = 1.15;
const CARD_W = 1.15 * 224 / 652;
const CARD_FOOT = 6 / 652;

const DEFAULTS = {
  speed: 7.0,
  strideHz: 1.95,
  accel: 9.0,
  brake: 5.5,
  idlePhase: 0.0,
  idleFrame: 0,
  vIdle: 0.08,
  atlasCols: 8,
  atlasRows: 4,
  alphaThresh: 16,
  breathAmp: 0.012,
  tailAmp: 0.008,
  tailBaseAmp: 0.004,
  settleTau: 0.10,
  blendV: 0.35,
  launchBlend: 0.22,
  launchAccelScale: 1.0,
  cardH: CARD_H,
  cardW: CARD_W,
  cardFootRun: CARD_FOOT,
  cardFootIdle: CARD_FOOT,
};

export function boltIdle(user = {}) {
  const cfg = { ...DEFAULTS, ...user };
  const state = { footCy: 0.92, idleAmt: 0, breath: 0, tail: 0 };
  const feet = [];
  const paws = [];

  function footFor(frame) {
    return feet[frame] ?? state.footCy;
  }

  function stepMotion(live, dt, run) {
    live.run = run ? 1 : 0;
    const accel = cfg.accel * (live.v < cfg.vIdle ? cfg.launchAccelScale : 1);
    if (live.run) live.v = Math.min(cfg.speed, live.v + accel * dt);
    else live.v = Math.max(0, live.v - cfg.brake * dt);
    if (live.v <= cfg.vIdle) {
      live.v = 0;
      let d = ((cfg.idlePhase - live.phase + 1.5) % 1) - 0.5;
      live.phase = (live.phase + d * (1 - Math.exp(-dt / cfg.settleTau)) + 1) % 1;
      if (Math.abs(d) < 0.02) live.phase = cfg.idlePhase;
    } else {
      live.phase = (live.phase + dt * cfg.strideHz * live.v / cfg.speed) % 1;
    }
    state.v = live.v;
  }

  function sample() {
    return { idleAmt: state.idleAmt, breath: state.breath, tail: state.tail };
  }

  function writeUniforms(U, life) {
    const spd = U[42];
    state.idleAmt = spd <= cfg.vIdle ? 1 : 0;
    state.breath = state.idleAmt;
    state.tail = state.idleAmt;
    U[52] = state.idleAmt;
    if (life) life.idleAmt = state.idleAmt;
  }

  function setFeet(footRows, pawRows) {
    feet.length = 0; paws.length = 0;
    for (const v of footRows) feet.push(v);
    for (const v of pawRows) paws.push(v);
    cfg.feet = feet;
    cfg.paws = paws;
    state.footCy = feet[cfg.idleFrame] ?? state.footCy;
    return { feet, paws };
  }

  function applyPlanted(planted) {
    if (!planted) return;
    cfg.idleFrame = planted.idleFrame;
    cfg.idlePhase = planted.idlePhase;
    state.footCy = planted.footCy;
  }

  const f = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
  const wgsl = /* wgsl */`
fn idleCardLy(c: vec2f) -> vec2f {
  let k = u.misc.x;
  let h = ${f(cfg.cardH)} * (1.0 + k * sin(u.cam.w * 1.6) * ${f(cfg.breathAmp)});
  let foot = mix(${f(cfg.cardFootRun)}, ${f(cfg.cardFootIdle)}, k);
  return vec2f(c.x * ${f(cfg.cardW)}, (c.y - foot) * h - 0.095);
}
fn idleTailUV(uv: vec2f) -> vec2f {
  let wag = u.misc.x * sin(u.cam.w * 2.4) * ${f(cfg.tailAmp)} * smoothstep(0.55, 0.12, uv.y);
  return uv + vec2f(wag, 0.0);
}
`;
  return { cfg, state, stepMotion, sample, writeUniforms, setFeet, applyPlanted, footFor, wgsl };
}

export function measureAtlasFeet(data, width, height, opt = {}) {
  const cols = opt.cols ?? 8, rows = opt.atlasRows ?? opt.rows ?? 4;
  const thresh = opt.alphaThresh ?? 16;
  const fw = width / cols, fh = height / rows;
  const feet = [], paws = [];
  const n = cols * rows;
  for (let f = 0; f < n; f++) {
    const c = f % cols, r = Math.floor(f / cols);
    const x0 = Math.floor(c * fw), y0 = Math.floor(r * fh);
    const x1 = Math.floor((c + 1) * fw), y1 = Math.floor((r + 1) * fh);
    let maxY = -1, minX = 1e9, maxX = -1, count = 0, sumX = 0;
    const yFoot = Math.floor(y0 + (y1 - y0) * 0.72);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const a = data[(y * width + x) * 4 + 3];
        if (a < thresh) continue;
        if (y > maxY) maxY = y;
        if (y >= yFoot) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); sumX += x; count++; }
      }
    }
    const footCy = maxY < 0 ? 0.92 : (maxY - y0) / Math.max(1, y1 - y0);
    feet.push(footCy);
    const cx = count ? (sumX / count - x0) / Math.max(1, x1 - x0) : 0.5;
    paws.push([cx, footCy, count ? (maxX - minX) / Math.max(1, fw) : 0]);
  }
  return { feet, paws, cols, rows };
}

export function pickPlantedFrame(atlas) {
  const feet = atlas.feet || [];
  let best = 0, bestScore = -1;
  for (let i = 0; i < feet.length; i++) {
    const paws = atlas.paws[i] || [0.5, feet[i], 0];
    const grounded = feet[i];
    const spread = paws[2] || 0;
    const score = grounded + spread * 0.15 - Math.abs((paws[0] || 0.5) - 0.5) * 0.05;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  const cols = atlas.cols || 8;
  return {
    idleFrame: best,
    idlePhase: (best % cols) / cols,
    footCy: feet[best] ?? 0.92,
    nPaws: (atlas.paws[best] && atlas.paws[best][2] > 0) ? 1 : 0,
  };
}

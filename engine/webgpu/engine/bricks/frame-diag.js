// Splits a slow meadow from a slowed dog. Does not draw and does not change dt.
// wallDt = time since the previous animation frame. appliedDt = what stepLive receives (capped at 0.05 s).
// Below ~20 fps the cap makes Bolt cover less ground per second. That is slowed simulation, not only stutter.
const CAP_S = 0.05;

function median(xs) {
  const s = xs.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) * 0.5;
}

function pct(xs, p) {
  const s = xs.slice().sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * p)));
  return s[i];
}

export function classifyFrames(samples) {
  const n = samples.length;
  if (n < 8) return { kind: 'warming', n };
  const wall = samples.map((s) => s.wall);
  const applied = samples.map((s) => s.applied);
  const mw = median(wall);
  const ma = median(applied);
  const p95 = pct(wall, 0.95);
  const wallSum = wall.reduce((a, b) => a + b, 0);
  const metres = samples.reduce((a, s) => a + s.speed * s.applied, 0);
  const metresPerSec = wallSum > 0 ? metres / wallSum : 0;
  const ratio = mw > 1e-6 ? ma / mw : 1;
  let kind = 'steady';
  // Slower than 30 fps. The 50 ms step cap starts to shorten the stride below 20 fps.
  if (mw > 1 / 30 && ratio < 0.85) kind = 'slow-frames-capped-sim';
  else if (mw > 1 / 30) kind = 'slow-frames';
  else if (p95 > mw * 2.5) kind = 'hitch';
  return {
    kind, n,
    medianWallMs: +(mw * 1000).toFixed(2),
    medianAppliedMs: +(ma * 1000).toFixed(2),
    p95WallMs: +(p95 * 1000).toFixed(2),
    appliedOverWall: +ratio.toFixed(3),
    metresPerSec: +metresPerSec.toFixed(2),
    capS: CAP_S,
  };
}

export function makeFrameDiag(limit = 64) {
  const samples = [];
  return {
    push(wall, applied, speed) {
      samples.push({ wall, applied, speed });
      if (samples.length > limit) samples.shift();
    },
    report() { return classifyFrames(samples); },
  };
}

// Observation only. Absent or anything other than 1 stays off. Does not change the 50 ms cap.
export function diagOn(search) {
  const q = search.startsWith('?') ? search.slice(1) : search;
  return new URLSearchParams(q).get('diag') === '1';
}

export function diagText(report, adapter) {
  const warm = !report || report.kind === 'warming';
  const n = report ? report.n : 0;
  const head = warm ? `warming ${n}/8` : `${report.kind} n=${n}`;
  const wall = warm ? 'wall med — p95 —' : `wall med ${report.medianWallMs} p95 ${report.p95WallMs} ms`;
  const idle = !warm && report.metresPerSec < 0.2 ? ' idle' : '';
  const sim = warm ? 'sim — · — m/s' : `sim ${report.medianAppliedMs} ms · ${report.metresPerSec} m/s${idle}`;
  const a = adapter || {};
  const who = [a.vendor, a.architecture, a.device, a.description].filter(Boolean).join(' ') || 'unknown';
  const adapterLine = `adapter ${who}${a.isFallback ? ' fallback' : ''}`;
  return `${head}\n${wall}\n${sim}\n${adapterLine}\ngpu time not measured`;
}

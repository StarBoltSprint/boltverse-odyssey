// Which draw class is inside the phone's main (~70 ms) and shadow (~26 ms) passes.
// Grass-wedge and ground-reorder pages already guessed. Neither was remeasured on the phone.
// This module does not remove a class from the live page. It names a paired omit schedule
// so one export can compare each class with the previous full frame.

export const DRAW_CLASS_BUILD = 'm448aaa3-cls1';

// Counts taken from the normal meadow scratch draws. Not a timing.
export const SUBMITTED = {
  grassVerts: 15 * 200 * 200 + 15 * 150 * 150 + 3 * 130 * 130,
  groundVerts: 6 * 128 * 128,
  nearTreeVerts: 25 * 30 + 58 * 12,
  farTreeVerts: 210 + 22 * 6,
  shadowCascades: 2,
  shadowMap: 1024,
  samples: 4,
};

export const OMIT = ['no-grass', 'no-ground', 'no-trees', 'no-shadow-trees'];

// 64 frames: 32 full, 8 of each omit, each omit sitting on the previous full frame.
export function classAt(frame) {
  const slot = frame % 8;
  if ((slot & 1) === 0) return 'all';
  return OMIT[slot >> 1];
}

export function drawMask(cls) {
  return {
    ground: cls !== 'no-ground',
    trees: cls !== 'no-trees',
    grass: cls !== 'no-grass',
    shadowTrees: cls !== 'no-shadow-trees',
  };
}

function summarize(values) {
  if (!values.length) return { n: 0 };
  const s = values.slice().sort((a, b) => a - b);
  const at = (p) => s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * p)))];
  return { n: s.length, median: at(0.5), p95: at(0.95), max: s[s.length - 1] };
}

function passDelta(prev, cur, name) {
  const a = prev.gpu && prev.gpu[name];
  const b = cur.gpu && cur.gpu[name];
  if (!a || !b || a.status !== 'ok' || b.status !== 'ok') return null;
  return a.ns - b.ns;
}

// Positive deltaNs: the full frame's pass took that many ns longer than the next frame, which skipped one class.
// Neighboring frames only. A median of all-frames versus a median of omit-frames is not this number.
export function pairDeltas(samples) {
  const rows = [];
  for (let i = 1; i < samples.length; i++) {
    const cur = samples[i];
    const prev = samples[i - 1];
    if (!cur || cur.cls === 'all' || !OMIT.includes(cur.cls) || !prev || prev.cls !== 'all') continue;
    const pass = cur.cls === 'no-shadow-trees' ? 'shadow' : 'main';
    const control = pass === 'main' ? 'shadow' : 'main';
    const deltaNs = passDelta(prev, cur, pass);
    if (deltaNs == null) continue;
    rows.push({
      cls: cur.cls,
      pass,
      deltaNs,
      controlPass: control,
      controlDeltaNs: passDelta(prev, cur, control),
    });
  }
  const delta = {};
  for (const cls of OMIT) {
    const mine = rows.filter((r) => r.cls === cls);
    const control = mine.map((r) => r.controlDeltaNs).filter((n) => n != null);
    delta[cls] = {
      ...summarize(mine.map((r) => r.deltaNs)),
      pass: cls === 'no-shadow-trees' ? 'shadow' : 'main',
      unit: 'ns',
      control: summarize(control),
    };
  }
  return { pairs: rows, delta };
}

export const READING = [
  'all frames issue the same draws as the normal meadow scratch.',
  'An omit frame skips one class inside the existing pass. It is not a separate pass and not a picture change to ship.',
  'deltaNs is full-frame pass time minus the next omit frame. Positive means that class accounted for those nanoseconds versus its neighbor.',
  'no-grass is the cleanest main pair: the ground already wrote depth under the blades.',
  'no-ground can let the sky shader fill pixels the ground no longer covers, so a small delta does not prove the ground shader is cheap.',
  'no-trees can add grass fragments where a tree had been in front.',
  'no-shadow-trees skips tree casters in the shadow pass only. Its main control delta should stay near the noise.',
  'Wall, CPU and GPU clocks overlap. Do not add them. Do not treat a median ratio as a per-frame split.',
  'This page does not change resolution, MSAA, grass density, shadows, Bolt, or the normal page.',
].join(' ');

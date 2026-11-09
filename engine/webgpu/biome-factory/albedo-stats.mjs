// CPU side of the material premise. No canyon albedo is invented here.
import { spawnSync } from 'child_process';
import { SHADE } from './shade.js';

export function srgbToLin(c8) {
  const c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function present8(linear) {
  const x = Math.min(1, Math.max(0, linear));
  return Math.round((x ** (1 / 2.2)) * 255);
}

export function lit8(c8, ndl) {
  return present8(srgbToLin(c8) * (SHADE.ambient + SHADE.sun * ndl));
}

function pstdev(vals) {
  const n = vals.length || 1;
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  let s = 0;
  for (const v of vals) s += (v - mean) ** 2;
  return { mean, pstdev: Math.sqrt(s / n), n };
}

export function jpegPixels(file, step = 32) {
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:'], { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024 });
  if (raw.status !== 0) throw new Error('jpeg decode failed ' + file);
  const b = raw.stdout;
  const out = [];
  for (let i = 0; i < b.length; i += 3 * step) out.push([b[i], b[i + 1], b[i + 2]]);
  return out;
}

export function jpegStats(file) {
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:'], { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024 });
  if (raw.status !== 0) throw new Error('jpeg decode failed ' + file);
  const b = raw.stdout;
  const ch = [[], [], []];
  const lit = [[], [], []];
  const step = 16;
  for (let i = 0; i < b.length; i += 3 * step) {
    for (let c = 0; c < 3; c++) {
      const v = b[i + c];
      ch[c].push(v);
      lit[c].push(lit8(v, 0.75));
    }
  }
  const names = ['r', 'g', 'b'];
  const source = {};
  const shaded = {};
  names.forEach((name, i) => {
    source[name] = pstdev(ch[i]);
    shaded[name] = pstdev(lit[i]);
  });
  const srcMax = Math.max(source.r.pstdev, source.g.pstdev, source.b.pstdev);
  const litMax = Math.max(shaded.r.pstdev, shaded.g.pstdev, shaded.b.pstdev);
  return {
    file,
    samples: ch[0].length,
    source: roundStats(source),
    shadedAtNdl075: roundStats(shaded),
    sourcePstdevMax: round(srcMax),
    shadedPstdevMax: round(litMax),
  };
}

function round(n) { return Math.round(n * 100) / 100; }
function roundStats(s) {
  const o = {};
  for (const [k, v] of Object.entries(s)) o[k] = { mean: round(v.mean), pstdev: round(v.pstdev) };
  return o;
}

export function groundNdl(sun) {
  const l = Math.hypot(sun[0], sun[1], sun[2]) || 1;
  return Math.max(0, sun[1] / l);
}

export function premiseFrom(parts) {
  const colourMae = parts.flatMae;
  const colourOk = colourMae <= 6;
  const low = parts.materials.filter(m => m.sourcePstdevMax < 15).map(m => m.id);
  const holdsDetail = parts.rampLitSpread >= 100;
  const mipDrops = parts.sourcePstdev > 8 && parts.gpuPstdev != null && parts.gpuPstdev < parts.sourcePstdev * 0.7;
  let because;
  if (!colourOk) {
    because = 'unlit GPU quad does not match the JPEG. Colourspace, sampler, or gamma is changing the albedo.';
  } else if (!holdsDetail) {
    because = 'a full 0–255 ramp collapses under this shade. The lighting code would hide a good albedo.';
  } else if (low.length) {
    because = 'the unlit level-0 quad matches the JPEG and a 0–255 ramp still spans the frame after shading. Every current original is low contrast, so a correct metre scale cannot create wall grain or crystal colour facets. Face-to-face shading still comes from the mesh normals.';
    if (mipDrops) because += ' On the canyon path the mip filter averages that small variation further.';
  } else {
    because = 'the originals carry contrast and the unlit path reproduces them.';
  }
  return {
    statement: 'good correct-scale albedo alone, with current material/light/UV code, will yield a convincing crystal canyon',
    holds: false,
    colourPipelineOk: colourOk,
    shadePreservesRamp: holdsDetail,
    lowContrastIds: low,
    because,
  };
}

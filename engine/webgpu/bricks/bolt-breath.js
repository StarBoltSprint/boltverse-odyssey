// gen4b breath on the meadow card. Motion stays in bolt-idle (7 m/s, brake, planted phase).
// Pictures and the crossfade are the m447idle4b5 gen4b path: 144 PNG frames, 24 fps,
// 200 ms mix, stamp into the 384×896 cell. The WebM is the Art clip name; the GPU reads the PNGs.
// Tail/body crop and paw plant of that source are unchanged.

export const BREATH_BUILD = 'm448aaa3-breath1';

export const BREATH_MEADOW = {
  speed: 7,
  blendV: 0.35,
  frames: 144,
  fps: 24,
  xfS: 0.2,
  cellW: 384,
  cellH: 896,
  stamp: { sx: 286, sy: 570, sw: 156, sh: 470, dx: 55.46, dy: 35.60, dw: 260, dh: 825 },
  clipName: 'bolt_idle4b_loop_alpha.webm',
  rgbaDir: 'bolt_idle4b5_rgba',
};

export function breathFrame(idleT, cfg = BREATH_MEADOW) {
  const period = cfg.frames / cfg.fps;
  const t = ((idleT % period) + period) % period;
  return Math.floor(t * cfg.fps) % cfg.frames;
}

export function rgbaName(index, cfg = BREATH_MEADOW) {
  const fi = ((index % cfg.frames) + cfg.frames) % cfg.frames;
  return cfg.rgbaDir + '/f' + String(fi).padStart(4, '0') + '.png';
}

// run=false and speed already under blendV*speed starts the mix. bolt-idle still brakes and plants the phase.
export function stepBreath(live, dt, run, cfg = BREATH_MEADOW) {
  const slow = !run && live.v <= cfg.blendV * cfg.speed;
  const xf = Math.max(cfg.xfS, 1e-4);
  if (slow) live.idleMix = Math.min(1, (live.idleMix || 0) + dt / xf);
  else live.idleMix = Math.max(0, (live.idleMix || 0) - dt / xf);
  if (live.idleMix >= 0.5) live.idleT = (live.idleT || 0) + dt;
  else live.idleT = live.idleT || 0;
  live.breathState = live.idleMix >= 0.999 ? 'idle' : live.idleMix > 0.001 ? (run ? 'xf_to_run' : 'xf_to_idle') : 'run';
  live.breathFrame = breathFrame(live.idleT, cfg);
  return live;
}

export function breathMixWgsl() {
  return `
@group(0) @binding(18) var tIdle: texture_2d<f32>;
fn breathMix(cIn: vec3f, aIn: f32, uv: vec2f) -> vec4f {
  let imix = clamp(u.misc.y, 0.0, 1.0);
  if (imix <= 0.001) { return vec4f(cIn, aIn); }
  let idS = textureSampleLevel(tIdle, samp, clamp(uv, vec2f(0.002), vec2f(0.998)), 0.0);
  let idA = smoothstep(0.05, 0.50, idS.a);
  let c = mix(cIn, pow(clamp(idS.rgb, vec3f(0.0), vec3f(1.0)), vec3f(2.2)), imix * idA);
  let al = mix(aIn, idA, imix);
  return vec4f(c, al);
}
`;
}

export async function makeBreathClip(dev, assetRoot, user = {}) {
  const cfg = { ...BREATH_MEADOW, ...user };
  const tex = dev.createTexture({
    size: [cfg.cellW, cfg.cellH],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  const canvas = new OffscreenCanvas(cfg.cellW, cfg.cellH);
  const cx = canvas.getContext('2d', { willReadFrequently: true });
  const cache = new Map();
  let uploaded = -1;
  const root = assetRoot.endsWith('/') ? assetRoot : assetRoot + '/';
  async function load(i) {
    const fi = ((i % cfg.frames) + cfg.frames) % cfg.frames;
    if (cache.has(fi)) return cache.get(fi);
    const url = root + rgbaName(fi, cfg);
    const res = await fetch(url);
    if (!res.ok) throw new Error('breath frame missing ' + url);
    const bmp = await createImageBitmap(await res.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    cache.set(fi, bmp);
    return bmp;
  }
  function stamp(bmp) {
    const s = cfg.stamp;
    cx.clearRect(0, 0, cfg.cellW, cfg.cellH);
    cx.drawImage(bmp, s.sx, s.sy, s.sw, s.sh, s.dx, s.dy, s.dw, s.dh);
    dev.queue.copyExternalImageToTexture({ source: canvas }, { texture: tex }, [cfg.cellW, cfg.cellH]);
  }
  const batch = 16;
  for (let i = 0; i < cfg.frames; i += batch) {
    await Promise.all(Array.from({ length: Math.min(batch, cfg.frames - i) }, (_, k) => load(i + k)));
  }
  stamp(cache.get(0));
  uploaded = 0;
  function sync(idleT) {
    const fi = breathFrame(idleT || 0, cfg);
    if (fi === uploaded) return fi;
    const bmp = cache.get(fi);
    if (!bmp) return uploaded;
    stamp(bmp);
    uploaded = fi;
    return fi;
  }
  return { cfg, texture: tex, sync, cache };
}

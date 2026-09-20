/** Live GPU compositor — law 15 + 17 + 22 (Frost KEEP, any biome, GPU_VER 24).
 * Two-pass WebGL + mark quads. Direct video → texture (rVFC stamp, not harvest).
 * Port into Live as src/game/bolt-key-gl.ts.
 * Wire: makeCompositor(canvas) BEFORE getContext("2d").
 *
 * FAIL if you use the old scissor / IGN-fract sketch (vertical bars + eaten paws + sticker).
 * FAIL if you mix raw plate into the coat (neon through torso) — law 22.
 * FAIL if you 5-tap-smear the whole body (Bolt looks out of focus) — law 22.
 * FAIL if you draw one body-ellipse shadow (hoverboard).
 * Archive: bolt-key-gl-scissor-prev.ts
 *
 * Docs: biome/docs/22-gpu24-frost-keep.md · biome/docs/17-live-compositor.md
 *       biome/docs/COLD_START-gpu24.md
 */

export const GPU_VER = 24;

const ROAD_VS = `
attribute vec2 a;
varying vec2 vUv;
void main() {
  vUv = a * 0.5 + 0.5;
  gl_Position = vec4(a, 0.0, 1.0);
}
`;

const BOLT_VS = `
attribute vec2 a;
uniform vec4 uRect;
uniform vec2 uTrauma;
varying vec2 vUv;
varying vec2 vScreen;
void main() {
  vUv = a * 0.5 + 0.5;
  vec2 pos = uRect.xy + vUv * uRect.zw + uTrauma;
  vScreen = pos * 0.5 + 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;

const ROAD_FS = `
precision mediump float;
uniform sampler2D uRoad;
uniform vec4 uShadow;
uniform float uShadowK;
uniform float uStance;
uniform vec2 uTrauma;
uniform float uHit;
uniform float uHaveRoad;
uniform vec3 uClear;
uniform float uGrade;
uniform float uNeon;
uniform float uSnow;
varying vec2 vUv;

void main() {
  vec2 uv = vUv + uTrauma;
  vec3 road = texture2D(uRoad, uv).rgb;
  vec3 color = mix(uClear, road, uHaveRoad);
  color = mix(color, color * color * (3.0 - 2.0 * color), uGrade);
  float y = uv.y;
  float halfLane = mix(0.018, 0.121, clamp((y - 0.22) / 0.64, 0.0, 1.0));
  float roadHalf = halfLane * 3.2;
  float inRoad = (1.0 - smoothstep(roadHalf, roadHalf + 0.04, abs(uv.x - 0.5))) * smoothstep(0.30, 0.50, y);
  color = mix(color, mix(color, vec3(0.86, 0.91, 0.96), 0.32), inRoad * uSnow);
  float g = color.g - max(color.r, color.b);
  float dash = inRoad * smoothstep(0.04, 0.16, g);
  vec3 neon = vec3(0.16, 1.0, 0.46);
  color += neon * dash * uNeon * 0.7;
  float halfIce = mix(0.125, 0.018, clamp(y / 0.58, 0.0, 1.0));
  float iceMask = 1.0 - smoothstep(halfIce * 3.2, halfIce * 3.2 + 0.05, abs(uv.x - 0.5));
  iceMask *= 1.0 - smoothstep(0.46, 0.62, y);
  float grazing = exp(-y * 2.6);
  color += vec3(0.10, 0.40, 0.20) * grazing * iceMask * 0.30;
  float spec = pow(clamp(dot(color, vec3(0.22, 0.62, 0.16)), 0.0, 1.0), 5.5);
  color += vec3(0.32, 0.70, 0.52) * spec * grazing * iceMask * 0.22;
  float streak = 0.0;
  for (int i = 1; i <= 4; i++) {
    float t = float(i);
    vec3 s = texture2D(uRoad, clamp(uv - vec2(0.0, t * 0.012), 0.0, 1.0)).rgb;
    streak += smoothstep(0.045, 0.16, s.g - max(s.r, s.b)) * (1.0 - t / 5.0);
  }
  color += neon * streak * grazing * iceMask * uNeon * 0.18;
  float sparkN = fract(sin(dot(road.rgb + vec3(uv.x * 9.1), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  color += vec3(0.70, 1.0, 0.80) * step(0.987, sparkN) * iceMask * (0.20 + 0.50 * grazing);
  vec3 skyAmb = texture2D(uRoad, vec2(0.50, 0.78)).rgb;
  color += skyAmb * iceMask * 0.07;
  vec2 shC = uShadow.xy;
  vec2 shR = max(uShadow.zw, vec2(0.001));
  float st = max(uStance, 0.003);
  vec2 dL = (uv - shC - vec2(st, 0.0)) / shR;
  vec2 dR = (uv - shC + vec2(st, 0.0)) / shR;
  float paw = exp(-dot(dL, dL)) + exp(-dot(dR, dR));
  vec2 dB = (uv - shC) / vec2(shR.x * 2.2 + st, shR.y * 1.45);
  float body = exp(-dot(dB, dB)) * 0.22;
  float sh = (paw + body) * uShadowK;
  color *= mix(vec3(1.0), vec3(0.48, 0.56, 0.66), clamp(sh, 0.0, 0.82));
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  color += (n - 0.5) * 0.006;
  color = mix(color, vec3(0.75, 0.11, 0.19), uHit);
  gl_FragColor = vec4(color, 1.0);
}
`;

const BOLT_FS = `
precision mediump float;
uniform sampler2D uPlate;
uniform sampler2D uBolt;
uniform vec3 uCool;
uniform float uSat;
uniform float uUnder;
uniform vec3 uRim;
uniform float uHit;
uniform float uMirror;
varying vec2 vUv;
varying vec2 vScreen;

vec4 sampleKey(vec2 uv) {
  vec4 p = texture2D(uBolt, uv);
  float m = max(p.r, p.b);
  float greenness = p.g - m;
  float luma = dot(p.rgb, vec3(0.2126, 0.7152, 0.0722));
  float hard = step(0.157, p.g) * step(0.063, greenness);
  float soft = step(0.118, p.g) * smoothstep(0.016, 0.063, greenness);
  float a = 1.0 - mix(soft, 1.0, hard);
  float protect = (1.0 - step(0.14, luma)) * (1.0 - step(0.12, greenness));
  a = max(a, protect);
  p.g -= max(greenness, 0.0);
  float leftover = p.g - max(p.r, p.b);
  p.g -= max(leftover, 0.0) * 0.85;
  return vec4(p.rgb, a);
}

void main() {
  float mir = uMirror;
  vec2 uv = vec2(vUv.x, mix(vUv.y, 1.0 - vUv.y, step(0.001, mir)));
  vec2 dy = vec2(0.0, 0.0030);
  vec2 dx = vec2(0.0036, 0.0);
  vec4 k0 = sampleKey(uv);
  vec4 k1 = sampleKey(uv + dy);
  vec4 k2 = sampleKey(uv - dy);
  float aL = sampleKey(uv + dx).a;
  float aR = sampleKey(uv - dx).a;
  vec3 premul = k0.rgb * k0.a * 0.72 + k1.rgb * k1.a * 0.14 + k2.rgb * k2.a * 0.14;
  float aAvg = k0.a * 0.72 + k1.a * 0.14 + k2.a * 0.14;
  vec3 c = premul / max(aAvg, 0.001);
  vec3 cSharp = k0.rgb;
  float aErode = min(min(k0.a, min(k1.a, k2.a)), min(aL, aR));
  float a = mix(aAvg, aErode, 0.32);
  a = smoothstep(0.05, 0.80, a);
  float edge = 1.0 - a;
  c = mix(cSharp, c, clamp(0.18 + 0.72 * edge, 0.0, 1.0));
  float spill = c.g - max(c.r, c.b);
  c.g -= max(spill, 0.0);
  a *= 1.0 - clamp(max(spill, 0.0) * 2.4, 0.0, 0.40);
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(luma), c, uSat) * uCool;
  float py = 1.0 - uv.y;
  c *= mix(1.0, uUnder, clamp((py - 0.60) * 2.5, 0.0, 1.0));
  c += uRim * 0.70 * clamp(1.0 - py * 2.5, 0.0, 1.0);
  vec3 p0 = texture2D(uPlate, clamp(vScreen, 0.0, 1.0)).rgb;
  vec3 p1 = texture2D(uPlate, clamp(vScreen + vec2(0.018, 0.0), 0.0, 1.0)).rgb;
  vec3 p2 = texture2D(uPlate, clamp(vScreen - vec2(0.018, 0.0), 0.0, 1.0)).rgb;
  vec3 plate = (p0 + p1 + p2) / 3.0;
  float pLuma = dot(plate, vec3(0.2126, 0.7152, 0.0722));
  float pG = plate.g - max(plate.r, plate.b);
  float neonM = smoothstep(0.035, 0.14, pG);
  vec3 bounceSrc = mix(plate, vec3(pLuma), neonM);
  vec3 bounce = bounceSrc / max(dot(bounceSrc, vec3(0.2126, 0.7152, 0.0722)), 0.07);
  c *= mix(vec3(1.0), bounce, 0.42);
  c = mix(c, bounceSrc, 0.11);
  c = mix(c, bounceSrc, 0.34 * edge * edge);
  vec3 sky = texture2D(uPlate, vec2(0.50, 0.78)).rgb;
  vec3 wallL = texture2D(uPlate, clamp(vScreen + vec2(-0.14, 0.06), 0.0, 1.0)).rgb;
  vec3 wallR = texture2D(uPlate, clamp(vScreen + vec2(0.14, 0.06), 0.0, 1.0)).rgb;
  vec3 fill = (wallL + wallR) * 0.5;
  float fillG = fill.g - max(fill.r, fill.b);
  float fillL = dot(fill, vec3(0.2126, 0.7152, 0.0722));
  fill = mix(fill, vec3(fillL), smoothstep(0.04, 0.15, fillG));
  vec3 fillN = fill / max(fillL, 0.08);
  fillN = mix(vec3(1.0), fillN, 0.38);
  float skyL = dot(sky, vec3(0.2126, 0.7152, 0.0722));
  vec3 skyN = mix(vec3(1.0), sky / max(skyL, 0.08), 0.42);
  float up = clamp(1.0 - py, 0.0, 1.0);
  c *= mix(fillN, skyN, up * 0.62);
  c += sky * up * 0.06;
  c = mix(c, vec3(0.75, 0.11, 0.19), uHit);
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  c += (n - 0.5) * (0.008 + 0.020 * edge) * a;
  float pawHold = smoothstep(0.90, 1.0, py);
  a *= mix(1.0, 0.78, pawHold);
  float isMir = step(0.001, mir);
  c = mix(c, c * vec3(0.48, 0.80, 0.68), isMir * 0.9);
  c = mix(c, bounceSrc, 0.16 * isMir);
  a *= mix(1.0, mir * vUv.y * vUv.y, isMir);
  gl_FragColor = vec4(c, a);
}
`;

const MARK_FS = `
precision mediump float;
uniform vec3 uCol;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  vec2 d = vUv * 2.0 - 1.0;
  float m = exp(-dot(d, d));
  float a = m * uAlpha;
  gl_FragColor = vec4(uCol * a, a);
}
`;

export type GpuFrame = {
  road: HTMLVideoElement | HTMLImageElement | null;
  bolt: HTMLVideoElement | null;
  haveRoad: boolean;
  haveBolt: boolean;
  chap: string;
  dest: { x: number; y: number; w: number; h: number };
  shadow: { cx: number; cy: number; rx: number; ry: number; k: number; stance: number };
  prints: Float32Array;
  drops: Float32Array;
  traumaX: number;
  traumaY: number;
  hit: number;
  reflectK: number;
  cw: number;
  ch: number;
};

export type GpuCompositor = {
  ver: number;
  resize: (w: number, h: number) => void;
  frame: (f: GpuFrame) => boolean;
  destroy: () => void;
  last: { haveBolt: boolean; haveRoad: boolean; err: number };
};

type TexCache = { tex: WebGLTexture; w: number; h: number; stamp: number };

type Watch = { el: HTMLVideoElement | null; id: number; media: number };

function makeWatch(): Watch {
  return { el: null, id: 0, media: -1 };
}

function dropWatch(w: Watch) {
  if (w.el && w.id && typeof w.el.cancelVideoFrameCallback === "function") {
    try {
      w.el.cancelVideoFrameCallback(w.id);
    } catch {
      /* ignore */
    }
  }
  w.el = null;
  w.id = 0;
  w.media = -1;
}

function armWatch(w: Watch, el: HTMLVideoElement) {
  if (w.el === el) return;
  dropWatch(w);
  w.el = el;
  if (typeof el.requestVideoFrameCallback !== "function") return;
  const tick = (_now: number, meta: VideoFrameCallbackMetadata) => {
    w.media = meta.mediaTime;
    if (w.el === el) w.id = el.requestVideoFrameCallback(tick);
  };
  w.id = el.requestVideoFrameCallback(tick);
}

function videoStamp(el: HTMLVideoElement, w: Watch) {
  if (w.el === el && w.media >= 0) return w.media;
  return el.currentTime;
}

const COMPILE_STATUS = 0x8b81;
const LINK_STATUS = 0x8b82;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, COMPILE_STATUS)) {
    gl.deleteShader(s);
    return null;
  }
  return s;
}

function link(
  gl: WebGLRenderingContext,
  vsSrc: string,
  fsSrc: string,
): WebGLProgram | null {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, LINK_STATUS)) {
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
}

function paintOf(ch: string) {
  const k = (ch || "").toLowerCase();
  if (k === "frost" || k === "ice" || k === "snow") return "frost";
  if (k === "night" || k === "neon") return "night";
  if (k === "war" || k === "ash" || k === "ember") return "ash";
  return "warm";
}

function uniformsFor(ch: string) {
  const paint = paintOf(ch);
  if (paint === "frost") {
    return {
      cool: [0.84, 0.93, 1.12] as const,
      sat: 0.54,
      under: 0.70,
      rim: [0.05, 0.10, 0.12] as const,
      clear: [0.73, 0.81, 0.88] as const,
      print: [0.40, 0.50, 0.48] as const,
      drop: [0.48, 0.94, 0.70] as const,
      grade: 0.1,
      neon: 0.42,
      snow: 0.0,
    };
  }
  if (paint === "night") {
    return {
      cool: [0.78, 0.84, 1.14] as const,
      sat: 0.68,
      under: 0.7,
      rim: [0.07, 0.09, 0.16] as const,
      clear: [0.05, 0.05, 0.09] as const,
      print: [0.06, 0.07, 0.1] as const,
      drop: [0.7, 0.82, 1.0] as const,
      grade: 0.08,
      neon: 0,
      snow: 0,
    };
  }
  if (paint === "ash") {
    return {
      cool: [0.96, 0.94, 0.9] as const,
      sat: 0.78,
      under: 0.82,
      rim: [0.12, 0.1, 0.08] as const,
      clear: [0.12, 0.09, 0.07] as const,
      print: [0.12, 0.08, 0.06] as const,
      drop: [1.0, 0.62, 0.28] as const,
      grade: 0.06,
      neon: 0,
      snow: 0,
    };
  }
  return {
    cool: [1.06, 0.97, 0.84] as const,
    sat: 0.9,
    under: 0.82,
    rim: [0.16, 0.09, 0.03] as const,
    clear: [0.07, 0.06, 0.04] as const,
    print: [0.12, 0.1, 0.08] as const,
    drop: [0.82, 0.72, 0.52] as const,
    grade: 0.05,
    neon: 0,
    snow: 0,
  };
}

function makeTex(gl: WebGLRenderingContext): WebGLTexture | null {
  const tex = gl.createTexture();
  if (!tex) return null;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  return tex;
}

function sizeOf(src: HTMLVideoElement | HTMLImageElement) {
  if ("videoWidth" in src && src.videoWidth > 0) return { w: src.videoWidth, h: src.videoHeight };
  if ("naturalWidth" in src && src.naturalWidth > 0) return { w: src.naturalWidth, h: src.naturalHeight };
  return { w: 0, h: 0 };
}

function upload(
  gl: WebGLRenderingContext,
  unit: number,
  cache: TexCache,
  src: HTMLVideoElement | HTMLImageElement,
  stamp: number,
) {
  const { w, h } = sizeOf(src);
  if (w < 2 || h < 2) return false;
  if (cache.w === w && cache.h === h && cache.stamp === stamp) return true;
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, cache.tex);
  try {
    if (cache.w === w && cache.h === h) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      cache.w = w;
      cache.h = h;
    }
    cache.stamp = stamp;
    return true;
  } catch {
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      cache.w = w;
      cache.h = h;
      cache.stamp = stamp;
      return true;
    } catch {
      return false;
    }
  }
}

function stampMarks(
  gl: WebGLRenderingContext,
  aLoc: number,
  uRect: WebGLUniformLocation | null,
  uCol: WebGLUniformLocation | null,
  uAlpha: WebGLUniformLocation | null,
  uTrauma: WebGLUniformLocation | null,
  packed: Float32Array,
  n: number,
  col: readonly [number, number, number],
  stretch: number,
  aspect: number,
  traumaX: number,
  traumaY: number,
) {
  gl.uniform2f(uTrauma, traumaX, traumaY);
  gl.uniform3f(uCol, col[0], col[1], col[2]);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const a = packed[o + 3]!;
    if (a < 0.04) continue;
    const u = packed[o]!;
    const v = packed[o + 1]!;
    const ru = packed[o + 2]!;
    const rx = Math.max(ru * aspect * 2, 0.004);
    const ry = Math.max(ru * stretch * 2, 0.004);
    gl.uniform4f(uRect, u * 2 - 1 - rx * 0.5, v * 2 - 1 - ry * 0.5, rx, ry);
    gl.uniform1f(uAlpha, a);
    gl.enableVertexAttribArray(aLoc);
    gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

export function makeCompositor(canvas: HTMLCanvasElement): GpuCompositor | null {
  const opts: WebGLContextAttributes = {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
    desynchronized: true,
  };
  const gl =
    (canvas.getContext("webgl2", opts) as WebGL2RenderingContext | null) ||
    (canvas.getContext("webgl", opts) as WebGLRenderingContext | null);
  if (!gl) return null;

  const roadProg = link(gl, ROAD_VS, ROAD_FS);
  const boltProg = link(gl, BOLT_VS, BOLT_FS);
  const markProg = link(gl, BOLT_VS, MARK_FS);
  if (!roadProg || !boltProg || !markProg) return null;

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const roadA = gl.getAttribLocation(roadProg, "a");
  const boltA = gl.getAttribLocation(boltProg, "a");
  const markA = gl.getAttribLocation(markProg, "a");

  const roadTex = makeTex(gl);
  const boltTex = makeTex(gl);
  if (!roadTex || !boltTex) return null;
  const roadCache: TexCache = { tex: roadTex, w: 1, h: 1, stamp: -1 };
  const boltCache: TexCache = { tex: boltTex, w: 1, h: 1, stamp: -1 };
  const roadWatch = makeWatch();
  const boltWatch = makeWatch();

  const uRoad = gl.getUniformLocation(roadProg, "uRoad");
  const uRShadow = gl.getUniformLocation(roadProg, "uShadow");
  const uRShadowK = gl.getUniformLocation(roadProg, "uShadowK");
  const uRStance = gl.getUniformLocation(roadProg, "uStance");
  const uRTrauma = gl.getUniformLocation(roadProg, "uTrauma");
  const uRHit = gl.getUniformLocation(roadProg, "uHit");
  const uHaveRoad = gl.getUniformLocation(roadProg, "uHaveRoad");
  const uClear = gl.getUniformLocation(roadProg, "uClear");
  const uGrade = gl.getUniformLocation(roadProg, "uGrade");
  const uNeon = gl.getUniformLocation(roadProg, "uNeon");
  const uSnow = gl.getUniformLocation(roadProg, "uSnow");

  const uBolt = gl.getUniformLocation(boltProg, "uBolt");
  const uPlate = gl.getUniformLocation(boltProg, "uPlate");
  const uRect = gl.getUniformLocation(boltProg, "uRect");
  const uBTrauma = gl.getUniformLocation(boltProg, "uTrauma");
  const uCool = gl.getUniformLocation(boltProg, "uCool");
  const uSat = gl.getUniformLocation(boltProg, "uSat");
  const uUnder = gl.getUniformLocation(boltProg, "uUnder");
  const uRim = gl.getUniformLocation(boltProg, "uRim");
  const uBHit = gl.getUniformLocation(boltProg, "uHit");
  const uBMirror = gl.getUniformLocation(boltProg, "uMirror");

  const uMRect = gl.getUniformLocation(markProg, "uRect");
  const uMTrauma = gl.getUniformLocation(markProg, "uTrauma");
  const uMCol = gl.getUniformLocation(markProg, "uCol");
  const uMAlpha = gl.getUniformLocation(markProg, "uAlpha");

  const boot = uniformsFor("frost");
  gl.useProgram(roadProg);
  gl.uniform1i(uRoad, 0);
  gl.uniform3f(uClear, boot.clear[0], boot.clear[1], boot.clear[2]);
  gl.uniform1f(uGrade, boot.grade);
  gl.uniform1f(uNeon, boot.neon);
  gl.uniform1f(uSnow, boot.snow);
  gl.useProgram(boltProg);
  gl.uniform1i(uPlate, 0);
  gl.uniform1i(uBolt, 1);
  gl.uniform3f(uCool, boot.cool[0], boot.cool[1], boot.cool[2]);
  gl.uniform1f(uSat, boot.sat);
  gl.uniform1f(uUnder, boot.under);
  gl.uniform3f(uRim, boot.rim[0], boot.rim[1], boot.rim[2]);
  gl.uniform1f(uBMirror, 0);

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  gl.disable(gl.CULL_FACE);
  gl.clearColor(boot.clear[0], boot.clear[1], boot.clear[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  let chap = "frost";
  let viewW = 0;
  let viewH = 0;
  let diagnosed = false;
  let fx = boot;
  const last = { haveBolt: false, haveRoad: false, err: 0, rect: [0, 0, 0, 0] as number[] };

  return {
    ver: GPU_VER,
    last,
    resize(w, h) {
      if (w === viewW && h === viewH) return;
      viewW = w;
      viewH = h;
      gl.viewport(0, 0, w, h);
    },
    frame(f) {
      if (f.cw < 2 || f.ch < 2) return false;
      this.resize(f.cw, f.ch);

      let haveRoad = false;
      if (f.haveRoad && f.road) {
        if (f.road instanceof HTMLVideoElement && f.road.videoWidth > 2) {
          const v = f.road;
          armWatch(roadWatch, v);
          const stamp = videoStamp(v, roadWatch);
          const roadFrame = (stamp * 48 + 0.5) | 0;
          if (roadCache.stamp === roadFrame && roadCache.w === v.videoWidth) {
            haveRoad = true;
          } else {
            haveRoad = upload(gl, 0, roadCache, v, roadFrame);
          }
        } else {
          haveRoad = upload(gl, 0, roadCache, f.road, 1);
        }
      }

      let haveBolt = false;
      if (f.haveBolt && f.bolt && f.bolt.readyState >= 2 && f.bolt.videoWidth > 2) {
        armWatch(boltWatch, f.bolt);
        const stamp = videoStamp(f.bolt, boltWatch);
        if (boltCache.stamp === stamp && boltCache.w === f.bolt.videoWidth) {
          haveBolt = true;
        } else {
          haveBolt = upload(gl, 1, boltCache, f.bolt, stamp);
        }
      }

      if (chap !== f.chap) {
        chap = f.chap;
        fx = uniformsFor(chap);
        gl.useProgram(boltProg);
        gl.uniform3f(uCool, fx.cool[0], fx.cool[1], fx.cool[2]);
        gl.uniform1f(uSat, fx.sat);
        gl.uniform1f(uUnder, fx.under);
        gl.uniform3f(uRim, fx.rim[0], fx.rim[1], fx.rim[2]);
        gl.useProgram(roadProg);
        gl.uniform3f(uClear, fx.clear[0], fx.clear[1], fx.clear[2]);
        gl.uniform1f(uGrade, fx.grade);
        gl.uniform1f(uNeon, fx.neon);
        gl.uniform1f(uSnow, fx.snow);
      }

      const cw = f.cw;
      const ch = f.ch;
      const tUvX = f.traumaX / cw;
      const tUvY = -f.traumaY / ch;

      gl.disable(gl.BLEND);
      gl.useProgram(roadProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(roadA);
      gl.vertexAttribPointer(roadA, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, roadCache.tex);
      gl.uniform4f(uRShadow, f.shadow.cx / cw, 1 - f.shadow.cy / ch, f.shadow.rx / cw, f.shadow.ry / ch);
      gl.uniform1f(uRShadowK, f.shadow.k);
      gl.uniform1f(uRStance, Math.max(f.shadow.stance, 1) / cw);
      gl.uniform2f(uRTrauma, tUvX, tUvY);
      gl.uniform1f(uRHit, f.hit);
      gl.uniform1f(uHaveRoad, haveRoad ? 1 : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      const aspect = ch / Math.max(cw, 1);
      gl.enable(gl.BLEND);
      gl.useProgram(markProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA);
      if (f.prints && f.prints.length >= 40) {
        stampMarks(gl, markA, uMRect, uMCol, uMAlpha, uMTrauma, f.prints, 10, fx.print, 2.4, aspect, tUvX * 2, tUvY * 2);
      }
      gl.blendFunc(gl.ONE, gl.ONE);
      if (f.drops && f.drops.length >= 112) {
        stampMarks(gl, markA, uMRect, uMCol, uMAlpha, uMTrauma, f.drops, 28, fx.drop, 1.0, aspect, tUvX * 2, tUvY * 2);
      }

      if (haveBolt) {
        const x0 = (f.dest.x / cw) * 2 - 1;
        const y0 = 1 - ((f.dest.y + f.dest.h) / ch) * 2;
        const rw = (f.dest.w / cw) * 2;
        const rh = (f.dest.h / ch) * 2;
        last.rect = [x0, y0, rw, rh, f.dest.x, f.dest.y, f.dest.w, f.dest.h];
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(boltProg);
        gl.enableVertexAttribArray(boltA);
        gl.vertexAttribPointer(boltA, 2, gl.FLOAT, false, 0, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, roadCache.tex);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, boltCache.tex);
        gl.uniform2f(uBTrauma, tUvX * 2, tUvY * 2);
        gl.uniform1f(uBHit, f.hit);
        if (f.reflectK > 0.04) {
          const reflH = f.dest.h * 0.36;
          const my0 = 1 - ((f.dest.y + f.dest.h + reflH) / ch) * 2;
          const mrh = (reflH / ch) * 2;
          gl.uniform1f(uBMirror, f.reflectK);
          gl.uniform4f(uRect, x0, my0, rw, mrh);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
        gl.uniform1f(uBMirror, 0);
        gl.uniform4f(uRect, x0, y0, rw, rh);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      gl.disable(gl.BLEND);

      last.haveBolt = haveBolt;
      last.haveRoad = haveRoad;
      if (!diagnosed) {
        last.err = gl.getError();
        diagnosed = true;
      }
      return haveRoad || haveBolt;
    },
    destroy() {
      dropWatch(roadWatch);
      dropWatch(boltWatch);
    },
  };
}

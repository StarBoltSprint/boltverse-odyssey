/** Live GPU compositor — law 15 + 17 (Frost-parity, any biome).
 * Two-pass WebGL + mark quads. Direct video → texture (rVFC stamp, not harvest).
 * Port into Live as src/game/bolt-key-gl.ts.
 * Wire: makeCompositor(canvas) BEFORE getContext("2d").
 *
 * FAIL if you use the old scissor / IGN-fract sketch (vertical bars + eaten paws + sticker).
 * Archive: bolt-key-gl-scissor-prev.ts
 */


export const GPU_VER = 10;

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
uniform vec2 uTrauma;
uniform float uHit;
uniform float uHaveRoad;
uniform vec3 uClear;
varying vec2 vUv;

void main() {
  vec2 uv = vUv + uTrauma;
  vec3 road = texture2D(uRoad, uv).rgb;
  vec3 color = mix(uClear, road, uHaveRoad);
  vec2 d = (uv - uShadow.xy) / max(uShadow.zw, vec2(0.001));
  float sh = exp(-dot(d, d)) * uShadowK;
  color *= 1.0 - clamp(sh, 0.0, 0.72);
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  color += (n - 0.5) * 0.03;
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
varying vec2 vUv;
varying vec2 vScreen;

vec4 keyed(vec2 uv) {
  vec4 p = texture2D(uBolt, uv);
  float m = max(p.r, p.b);
  float greenness = p.g - m;
  float luma = dot(p.rgb, vec3(0.2126, 0.7152, 0.0722));
  float hard = step(0.157, p.g) * step(0.063, greenness);
  float soft = step(0.118, p.g) * smoothstep(0.016, 0.063, greenness);
  float a = 1.0 - mix(soft, 1.0, hard);
  float protect = (1.0 - step(0.14, luma)) * (1.0 - step(0.12, greenness));
  a = max(a, protect);
  p.g = mix(p.g, m, clamp(greenness * 10.0, 0.0, 1.0) * step(m, p.g));
  vec3 c = mix(vec3(luma), p.rgb, uSat) * uCool;
  float py = 1.0 - uv.y;
  c *= mix(1.0, uUnder, clamp((py - 0.60) * 2.5, 0.0, 1.0));
  c += uRim * 0.35 * clamp(1.0 - py * 2.5, 0.0, 1.0);
  return vec4(c, a);
}

void main() {
  vec2 dy = vec2(0.0, 0.0055);
  vec4 k0 = keyed(vUv);
  vec4 k1 = keyed(vUv + dy);
  vec4 k2 = keyed(vUv - dy);
  vec3 premul = k0.rgb * k0.a * 0.50 + k1.rgb * k1.a * 0.25 + k2.rgb * k2.a * 0.25;
  float a = k0.a * 0.50 + k1.a * 0.25 + k2.a * 0.25;
  vec3 c = premul / max(a, 0.001);
  a = smoothstep(0.05, 0.78, a);
  vec3 plate = texture2D(uPlate, clamp(vScreen, 0.0, 1.0)).rgb;
  float pLuma = dot(plate, vec3(0.2126, 0.7152, 0.0722));
  vec3 bounce = plate / max(pLuma, 0.07);
  c *= mix(vec3(1.0), bounce, 0.32);
  c = mix(c, plate, 0.10);
  c = mix(c, vec3(0.75, 0.11, 0.19), uHit);
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  c += (n - 0.5) * 0.03 * a;
  gl_FragColor = vec4(c, a);
}
`;

const MARK_FS = `
precision mediump float;
uniform float uKind;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  vec2 d = vUv * 2.0 - 1.0;
  d.y *= mix(2.5, 1.0, uKind);
  float m = exp(-dot(d, d));
  vec3 col = mix(vec3(0.07, 0.11, 0.16), vec3(0.84, 0.92, 0.98), uKind);
  float a = m * uAlpha * mix(0.72, 0.95, uKind);
  gl_FragColor = vec4(col * a, a);
}
`;

export type GpuFrame = {
  road: HTMLVideoElement | HTMLImageElement | null;
  bolt: HTMLVideoElement | null;
  haveRoad: boolean;
  haveBolt: boolean;
  chap: string;
  dest: { x: number; y: number; w: number; h: number };
  shadow: { cx: number; cy: number; rx: number; ry: number; k: number };
  prints: Float32Array;
  drops: Float32Array;
  traumaX: number;
  traumaY: number;
  hit: number;
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
  if (k === "frost" || k === "ice" || k === "snow" || k === "crystal") return "frost";
  if (k === "tide" || k === "wet" || k === "rain") return "tide";
  if (k === "night" || k === "neon") return "night";
  if (k === "war" || k === "ash" || k === "ember") return "ash";
  return "warm";
}

function uniformsFor(ch: string) {
  const paint = paintOf(ch);
  if (paint === "frost") return { cool: [0.84, 0.93, 1.12] as const, sat: 0.58, under: 0.74, rim: [0.04, 0.055, 0.08] as const };
  if (paint === "tide") return { cool: [0.82, 0.95, 1.08] as const, sat: 0.62, under: 0.76, rim: [0.05, 0.09, 0.12] as const };
  if (paint === "night") return { cool: [0.78, 0.84, 1.14] as const, sat: 0.68, under: 0.7, rim: [0.07, 0.09, 0.16] as const };
  if (paint === "ash") return { cool: [0.96, 0.94, 0.9] as const, sat: 0.78, under: 0.82, rim: [0.12, 0.1, 0.08] as const };
  return { cool: [1.06, 0.97, 0.84] as const, sat: 0.9, under: 0.82, rim: [0.16, 0.09, 0.03] as const };
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
  prog: WebGLProgram,
  aLoc: number,
  uRect: WebGLUniformLocation | null,
  uKind: WebGLUniformLocation | null,
  uAlpha: WebGLUniformLocation | null,
  uTrauma: WebGLUniformLocation | null,
  packed: Float32Array,
  n: number,
  kind: number,
  aspect: number,
  traumaX: number,
  traumaY: number,
) {
  gl.uniform2f(uTrauma, traumaX, traumaY);
  gl.uniform1f(uKind, kind);
  const stretch = kind < 0.5 ? 2.2 : 1.0;
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
  const uRTrauma = gl.getUniformLocation(roadProg, "uTrauma");
  const uRHit = gl.getUniformLocation(roadProg, "uHit");
  const uHaveRoad = gl.getUniformLocation(roadProg, "uHaveRoad");
  const uClear = gl.getUniformLocation(roadProg, "uClear");

  const uBolt = gl.getUniformLocation(boltProg, "uBolt");
  const uPlate = gl.getUniformLocation(boltProg, "uPlate");
  const uRect = gl.getUniformLocation(boltProg, "uRect");
  const uBTrauma = gl.getUniformLocation(boltProg, "uTrauma");
  const uCool = gl.getUniformLocation(boltProg, "uCool");
  const uSat = gl.getUniformLocation(boltProg, "uSat");
  const uUnder = gl.getUniformLocation(boltProg, "uUnder");
  const uRim = gl.getUniformLocation(boltProg, "uRim");
  const uBHit = gl.getUniformLocation(boltProg, "uHit");

  const uMRect = gl.getUniformLocation(markProg, "uRect");
  const uMTrauma = gl.getUniformLocation(markProg, "uTrauma");
  const uMKind = gl.getUniformLocation(markProg, "uKind");
  const uMAlpha = gl.getUniformLocation(markProg, "uAlpha");

  gl.useProgram(roadProg);
  gl.uniform1i(uRoad, 0);
  gl.uniform3f(uClear, 0.027, 0.024, 0.039);
  gl.useProgram(boltProg);
  gl.uniform1i(uPlate, 0);
  gl.uniform1i(uBolt, 1);

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  gl.disable(gl.CULL_FACE);

  let chap = "";
  let viewW = 0;
  let viewH = 0;
  let diagnosed = false;
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
          const roadFrame = (stamp * 24) | 0;
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
        const u = uniformsFor(chap);
        gl.useProgram(boltProg);
        gl.uniform3f(uCool, u.cool[0], u.cool[1], u.cool[2]);
        gl.uniform1f(uSat, u.sat);
        gl.uniform1f(uUnder, u.under);
        gl.uniform3f(uRim, u.rim[0], u.rim[1], u.rim[2]);
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
      gl.uniform2f(uRTrauma, tUvX, tUvY);
      gl.uniform1f(uRHit, f.hit);
      gl.uniform1f(uHaveRoad, haveRoad ? 1 : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      const aspect = ch / Math.max(cw, 1);
      gl.enable(gl.BLEND);
      gl.useProgram(markProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA);
      if (f.prints && f.prints.length >= 24) {
        stampMarks(gl, markProg, markA, uMRect, uMKind, uMAlpha, uMTrauma, f.prints, 6, 0, aspect, tUvX * 2, tUvY * 2);
      }
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      if (f.drops && f.drops.length >= 64) {
        stampMarks(gl, markProg, markA, uMRect, uMKind, uMAlpha, uMTrauma, f.drops, 16, 1, aspect, tUvX * 2, tUvY * 2);
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
        gl.uniform4f(uRect, x0, y0, rw, rh);
        gl.uniform2f(uBTrauma, tUvX * 2, tUvY * 2);
        gl.uniform1f(uBHit, f.hit);
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

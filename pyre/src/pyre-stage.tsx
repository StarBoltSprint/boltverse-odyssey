import { useEffect, useRef, useState } from "react";

type Phase = "cover" | "run" | "fallen" | "citadel";

type Foe = {
  id: number;
  kind: 0 | 1 | 2;
  lane: number;
  aim: number | null;
  z: number;
  speed: number;
  struck: boolean;
  side: -1 | 0 | 1;
  wide: number;
  hp: number;
  hurt: number;
};

type Ash = {
  kind: 0 | 1 | 2;
  x: number;
  y: number;
  w: number;
  h: number;
  t: number;
  life: number;
};

const PEAK_KEY = "pyre-peak-v1";
const IDLE_LIVE = [
  { src: "/master/live/c2b2-03.mp4?v=1", x: 1, y: 0.2 },
  { src: "/master/live/c2b2-06.mp4?v=1", x: 1, y: 0.46 },
  { src: "/master/live/c2b2-09.mp4?v=1", x: 1, y: 0.71 },
  { src: "/master/live/c2b2-12.mp4?v=1", x: 1, y: 0.96 },
  { src: "/master/live/b2a2-06.mp4?v=1", x: 1, y: 1.46 },
  { src: "/master/live/b2a2-12.mp4?v=1", x: 1, y: 1.96 },
];
const SLIDE_AMP = 0.36;
const BOLT_H = 0.28;
const BOLT_ASPECT = 784 / 1168;
const TURN_FIT = 1.55;
const THUNDER_FIT = 1.62;
const PAW_V = 0.93;
const PLANT_Y = 0.8;
const BOLT_RATE = 4;
const BREATH_AT = 4.25;
const STAR_MAP = "https://boltversee-odyssey-star-map.grok.me";

const backToRoom = () => {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search);
  const at = (q.get("at") || q.get("return") || "").toLowerCase();
  if (at === "room" || at === "map") return true;
  if (window.location.hash === "#room") return true;
  return document.referrer.includes("boltversee-odyssey-star-map");
};

const roomReturnUrl = () => {
  const back = new URL(window.location.href);
  back.hash = "";
  back.search = "";
  back.searchParams.set("at", "room");
  return back.toString();
};
const HORIZON = 0.545;
const ROOM_VANISH = 0.5;
const ROOM_STEP = 0.67;
const PYRE_PACES = 600;
const GOD = true;
const FOE_ASPECT = 480 / 854;
const FOE_KIND = [
  { h: 0.3, foot: 0.96, reach: 0.34, rate: 1.45, agility: 1.55 },
  { h: 0.4, foot: 0.97, reach: 0.48, rate: 1.05, agility: 0.7 },
  { h: 1.05, foot: 0.98, reach: 0.7, rate: 1.15, agility: 0.15 },
] as const;

const ROAD_VS = `
attribute vec2 aPos;
attribute vec2 aUv;
uniform float uZoom;
uniform vec2 uFocus;
varying vec2 vUv;
void main() {
  vUv = aUv;
  gl_Position = vec4(uFocus + (aPos - uFocus) * uZoom, 0.0, 1.0);
}`;

const ROAD_FS = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uRoad;
uniform sampler2D uSideL;
uniform sampler2D uSideR;
uniform float uGlance;
uniform float uWings;
uniform float uFlash;
uniform float uAlpha;
uniform float uApproach;
void main() {
  vec2 screen = vUv;
  float mag = abs(uGlance);
  float open = smoothstep(0.10, 0.48, mag);
  float shift = uGlance * open * uWings;
  float ruvx = screen.x + shift;
  float sy = clamp(screen.y, 0.001, 0.999);
  float cover = smoothstep(0.02, 0.14, abs(shift));
  float floorK = 1.0 - smoothstep(0.35, 0.70, sy);
  float seam = mix(0.14, 0.32, floorK);
  float wSideL = ruvx < 0.0 ? cover : (1.0 - smoothstep(0.0, seam, ruvx)) * cover;
  float wSideR = ruvx > 1.0 ? cover : smoothstep(1.0 - seam, 1.0, ruvx) * cover;
  vec3 rc = texture2D(uRoad, vec2(clamp(ruvx, 0.001, 0.999), sy)).rgb;
  float intoL = clamp(max(ruvx, 0.0) / max(seam, 0.001), 0.0, 1.0);
  float sideLU = clamp(mix(ruvx + 1.0, 0.70, intoL), 0.04, 0.96);
  float intoR = clamp(max(1.0 - ruvx, 0.0) / max(seam, 0.001), 0.0, 1.0);
  float sideRU = clamp(mix(ruvx - 1.0, 0.30, intoR), 0.04, 0.96);
  vec3 lc = texture2D(uSideL, vec2(sideLU, sy)).rgb;
  vec3 qc = texture2D(uSideR, vec2(sideRU, sy)).rgb;
  vec3 side = mix(lc, qc, step(wSideL, wSideR));
  vec3 c = mix(rc, side, clamp(max(wSideL, wSideR), 0.0, 1.0));
  c = pow(max(c, 0.0), vec3(0.92));
  c *= vec3(1.04, 0.9, 0.82);
  float vig = smoothstep(0.2, 0.95, length(screen - vec2(0.5, 0.48)));
  c *= mix(1.0, 0.62, vig);
  c = mix(c, c * vec3(0.74, 0.82, 1.12) + vec3(0.03, 0.02, 0.07), clamp(uApproach, 0.0, 1.0) * 0.7);
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  c += (n - 0.5) * 0.028;
  c = mix(c, vec3(0.55, 0.05, 0.08), uFlash * 0.55);
  gl_FragColor = vec4(c, uAlpha);
}`;

const BOLT_FS = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform sampler2D uTexB;
uniform float uFlash;
uniform float uTime;
uniform float uBreath;
vec4 keyed(vec4 c) {
  float m = max(c.r, c.b);
  float greenness = c.g - m;
  float a = 1.0 - smoothstep(0.16, 0.38, greenness);
  c.g = mix(c.g, m, clamp(greenness / 0.07, 0.0, 1.0));
  if (greenness > 0.36) a = 0.0;
  return vec4(c.rgb, a);
}
void main() {
  vec4 run = keyed(texture2D(uTex, vUv));
  vec4 idle = keyed(texture2D(uTexB, vUv));
  vec4 c = mix(run, idle, uBreath);
  float a = c.a;
  float luma = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  float moon = smoothstep(0.42, 0.96, vUv.y);
  float belly = smoothstep(0.48, 0.08, vUv.y);
  float shade = smoothstep(0.18, 0.7, luma);
  float fringe = smoothstep(0.02, 0.55, a) * smoothstep(0.98, 0.22, a);
  float spark = fract(sin(dot(vec2(vUv.x * 42.0, vUv.y * 26.0 - uTime * 8.0), vec2(12.9898, 78.233))) * 43758.5453);
  float crack = smoothstep(0.74, 0.96, spark);
  c.rgb += vec3(0.72, 0.1, 0.05) * (1.0 - shade) * belly * 0.45;
  c.rgb += vec3(0.95, 0.22, 0.12) * moon * shade * 0.07;
  c.rgb += vec3(1.0, 0.2, 0.06) * fringe * crack * 0.35;
  c.rgb += vec3(0.9, 0.16, 0.08) * moon * 0.08;
  c.rgb = mix(c.rgb, vec3(0.72, 0.04, 0.06), uFlash * 0.65);
  gl_FragColor = vec4(c.rgb, a);
}`;

const ENEMY_FS = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uFlash;
uniform float uThreat;
uniform float uAlpha;
void main() {
  vec4 c = texture2D(uTex, vUv);
  float m = max(c.r, c.b);
  float greenness = c.g - m;
  float a = 1.0;
  if (greenness > 0.05 && c.g > 0.2) a = 0.0;
  else if (c.g > m + 0.03) c.g = m;
  c.rgb = mix(c.rgb, vec3(0.9, 0.12, 0.05), uThreat * 0.28);
  c.rgb = mix(c.rgb, vec3(0.72, 0.04, 0.06), uFlash * 0.55);
  gl_FragColor = vec4(c.rgb, a * uAlpha);
}`;

const TAU = Math.PI * 2;

// Film cards. The finger only writes yaw (orbit) and speed (plateV).
// Sky, ground and the run clip are derived from these. Do not retune the shader.
const SKY = {
  faces: 4,
  span: 0.7,
  fadeDeg: 74,
  moonBottom: 0.35,
  lead: 0.55,
  band: 0.76,
  v1: 0.9,
};
const GROUND = {
  tileMeters: 1 / 4.6,
  detail: 1.673,
};
const RUN = {
  idleRate: 0.55,
  strideSeconds: 1,
  strideMeters: 1.8 / 1.05,
};

const skyFov = (SKY.span / SKY.faces) * TAU;
const groundXMul = 2 * Math.tan(skyFov / 2) * GROUND.detail;
const groundHorizon = SKY.moonBottom + 0.01;
const groundFade0 = SKY.moonBottom - 0.09;
const groundFade1 = SKY.moonBottom;

const BOLT_FOOT_Y = 0.16;
const boltPivot = 0.72 / Math.max(0.02, groundHorizon - BOLT_FOOT_Y);
const gaitFor = (speed: number) => RUN.idleRate + Math.abs(speed) * (RUN.strideSeconds / RUN.strideMeters);

const PLATE_FS = `
#extension GL_OES_standard_derivatives : enable
precision mediump float;
varying vec2 vUv;
uniform sampler2D uPath;
uniform float uYaw;
uniform float uXMul;
uniform float uHorizon;
uniform float uFade0;
uniform float uFade1;
uniform float uPivot;
uniform float uWorldX;
uniform float uWorldZ;
void main() {
  float horizon = uHorizon;
  if (vUv.y > horizon) discard;
  float dy = max(0.02, horizon - vUv.y);
  float depth = 0.72 / dy;
  float x = (vUv.x - 0.5) * depth * uXMul;
  float c = cos(uYaw);
  float s = sin(uYaw);
  float relZ = depth - uPivot;
  float wx = x * c - relZ * s + uWorldX;
  float wz = x * s + relZ * c + uPivot + uWorldZ;
  vec2 p = vec2(wx, wz) * 0.18;
  vec2 f = fract(p);
  vec3 a = texture2D(uPath, f).rgb;
  vec3 b = texture2D(uPath, fract(p + 0.5)).rgb;
  float edge = max(abs(f.x - 0.5), abs(f.y - 0.5)) * 2.0;
  float seam = smoothstep(0.92, 1.0, edge);
  vec3 stone = mix(a, b, seam);
  float stretch = max(length(dFdx(p)), length(dFdy(p)));
  float sharp = 1.0 - smoothstep(0.02, 0.055, stretch);
  float intoSky = 1.0 - smoothstep(uFade0, uFade1, vUv.y);
  gl_FragColor = vec4(stone, sharp * intoSky);
}`;

const PROP_FS = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uAlpha;
void main() {
  vec4 c = texture2D(uTex, vUv);
  float m = max(c.r, c.b);
  float greenness = c.g - m;
  if (greenness > 0.14) discard;
  if (c.g > m + 0.03) c.g = m;
  gl_FragColor = vec4(c.rgb, uAlpha);
}`;

const SKY_FS = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D u0;
uniform sampler2D u1;
uniform sampler2D u2;
uniform sampler2D u3;
uniform float uA;
uniform float uB;
uniform float uMix;
uniform float uU0;
uniform float uU1;
uniform float uSpan;
uniform float uV0;
uniform float uV1;
vec3 face(float i, vec2 uv) {
  if (i < 0.5) return texture2D(u0, uv).rgb;
  if (i < 1.5) return texture2D(u1, uv).rgb;
  if (i < 2.5) return texture2D(u2, uv).rgb;
  return texture2D(u3, uv).rgb;
}
void main() {
  float v = mix(uV0, uV1, vUv.y);
  vec3 a = face(uA, vec2(uU0 + vUv.x * uSpan, v));
  vec3 b = face(uB, vec2(uU1 + vUv.x * uSpan, v));
  gl_FragColor = vec4(mix(a, b, uMix), 1.0);
}`;

const HOWL_FS = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uReveal;
void main() {
  float u = mix(0.34, 0.66, vUv.x);
  vec4 c = texture2D(uTex, vec2(u, vUv.y * uReveal));
  float m = max(c.r, c.b);
  float greenness = c.g - m;
  if (greenness > 0.04 && c.g > 0.16) discard;
  if (c.g > m) c.g = m;
  float a = smoothstep(0.05, 0.28, max(c.r, max(c.g, c.b)));
  c.rgb += vec3(0.35, 0.04, 0.02) * c.r;
  gl_FragColor = vec4(c.rgb, a);
}`;

const SHADOW_FS = `
precision mediump float;
varying vec2 vUv;
void main() {
  vec2 p = vec2((vUv.x - 0.5) * 1.35, (vUv.y - 0.8) * 1.7);
  float d = dot(p, p);
  float a = smoothstep(1.05, 0.02, d) * smoothstep(0.0, 0.28, vUv.y);
  gl_FragColor = vec4(0.02, 0.0, 0.0, a * 0.22);
}`;

const WAKE_FS = `
precision mediump float;
varying vec2 vUv;
uniform float uTime;
uniform float uBend;
void main() {
  float along = vUv.y;
  float x = vUv.x - 0.5 - uBend * (1.0 - along);
  float wake = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float drift = sin(uTime * 7.0 + fi * 1.7) * 0.035;
    float lane = (fi - 2.0) * 0.07 + drift * (1.0 - along);
    float strand = smoothstep(0.045, 0.0, abs(x - lane));
    float spark = fract(sin(dot(vec2(fi, along * 18.0 - uTime * 9.0), vec2(12.9898, 78.233))) * 43758.5453);
    wake += strand * mix(0.35, 1.0, smoothstep(0.62, 0.95, spark));
  }
  float fade = along * along;
  vec3 col = vec3(1.0, 0.16, 0.04) * wake * fade;
  gl_FragColor = vec4(col, 1.0);
}`;

const GATE_FS = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uAlpha;
uniform float uV0;
uniform float uV1;
uniform float uMask;
void main() {
  vec2 uv = vec2(vUv.x, mix(uV0, uV1, vUv.y));
  vec3 rgb = texture2D(uTex, uv).rgb;
  float side = smoothstep(0.0, 0.32, vUv.x) * smoothstep(1.0, 0.68, vUv.x);
  float intoRoad = smoothstep(0.0, 0.58, vUv.y);
  float intoSky = smoothstep(1.0, 0.86, vUv.y);
  float mask = mix(1.0, side * intoRoad * intoSky, uMask);
  gl_FragColor = vec4(rgb, uAlpha * mask);
}`;

const ORBIT_FS = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uFront;
uniform sampler2D uLeft;
uniform sampler2D uRight;
uniform sampler2D uBack;
uniform float uOrbit;
const float H = 1.5707963;
vec3 texAt(sampler2D tex, float u, float y) {
  return texture2D(tex, vec2(clamp(u, 0.001, 0.999), clamp(y, 0.001, 0.999))).rgb;
}
void main() {
  float ang = clamp(uOrbit, -3.14159, 3.14159);
  float dir = ang >= 0.0 ? 1.0 : -1.0;
  float seg = min(abs(ang) / H, 2.0);
  float idx = seg >= 1.0 ? 1.0 : 0.0;
  float k = seg >= 2.0 ? 1.0 : seg - idx;
  vec3 fromC;
  vec3 toC;
  float uFrom = vUv.x - dir * k;
  float uTo = vUv.x - dir * (k - 1.0);
  if (dir > 0.0) {
    fromC = idx < 0.5 ? texAt(uFront, uFrom, vUv.y) : texAt(uLeft, uFrom, vUv.y);
    toC = idx < 0.5 ? texAt(uLeft, uTo, vUv.y) : texAt(uBack, uTo, vUv.y);
  } else {
    fromC = idx < 0.5 ? texAt(uFront, uFrom, vUv.y) : texAt(uRight, uFrom, vUv.y);
    toC = idx < 0.5 ? texAt(uRight, uTo, vUv.y) : texAt(uBack, uTo, vUv.y);
  }
  float edge = dir > 0.0 ? k : 1.0 - k;
  float incoming = dir > 0.0
    ? smoothstep(edge + 0.045, edge - 0.045, vUv.x)
    : smoothstep(edge - 0.045, edge + 0.045, vUv.x);
  vec3 col = mix(fromC, toC, incoming);
  float vig = smoothstep(0.35, 1.05, length(vUv - vec2(0.5, 0.48)));
  col *= mix(1.0, 0.78, vig);
  gl_FragColor = vec4(col, 1.0);
}`;

function readPeak() {
  try {
    return Number(localStorage.getItem(PEAK_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writePeak(n: number) {
  try {
    localStorage.setItem(PEAK_KEY, String(Math.floor(n)));
  } catch {
    /* private mode */
  }
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("shader");
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || "shader compile");
  }
  return shader;
}

function program(gl: WebGLRenderingContext, fsSrc: string) {
  const prog = gl.createProgram();
  if (!prog) throw new Error("program");
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, ROAD_VS));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fsSrc));
  gl.bindAttribLocation(prog, 0, "aPos");
  gl.bindAttribLocation(prog, 1, "aUv");
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prog) || "link");
  }
  return prog;
}

function makeTex(gl: WebGLRenderingContext) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([12, 6, 8, 255]),
  );
  return tex;
}

function upload(gl: WebGLRenderingContext, tex: WebGLTexture | null, source: TexImageSource) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
}

const frameStamp = new WeakMap<HTMLVideoElement, number>();
function uploadVideo(gl: WebGLRenderingContext, tex: WebGLTexture | null, video: HTMLVideoElement) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  if (video.readyState < 2) return;
  const frames = video.getVideoPlaybackQuality?.().totalVideoFrames ?? 0;
  if (frames > 0) {
    if (frameStamp.get(video) === frames) return;
    frameStamp.set(video, frames);
  }
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
}

function lookShift(glance: number, wingsReady: boolean) {
  if (!wingsReady) return 0;
  const t = Math.min(1, Math.max(0, (Math.abs(glance) - 0.1) / 0.38));
  return glance * (t * t * (3 - 2 * t));
}

function quad(x: number, y: number, w: number, h: number) {
  const x0 = x * 2 - 1;
  const x1 = (x + w) * 2 - 1;
  const yTop = 1 - y * 2;
  const yBot = 1 - (y + h) * 2;
  return new Float32Array([
    x0, yBot, 0, 0,
    x1, yBot, 1, 0,
    x0, yTop, 0, 1,
    x1, yTop, 1, 1,
  ]);
}

const FULL = quad(0, 0, 1, 1);

function beam(x0: number, y0: number, x1: number, y1: number, halfW: number) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 0.001;
  const px = (-dy / len) * halfW;
  const py = (dx / len) * halfW;
  const clip = (x: number, y: number) => [x * 2 - 1, 1 - y * 2] as const;
  const a = clip(x0 + px, y0 + py);
  const b = clip(x0 - px, y0 - py);
  const c = clip(x1 + px, y1 + py);
  const d = clip(x1 - px, y1 - py);
  return new Float32Array([
    b[0], b[1], 0, 0,
    d[0], d[1], 0, 1,
    a[0], a[1], 1, 0,
    c[0], c[1], 1, 1,
  ]);
}

export function PyreStage({ startInRoom = false }: { startInRoom?: boolean }) {
  const glRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const roadARef = useRef<HTMLVideoElement>(null);
  const roadBRef = useRef<HTMLVideoElement>(null);
  const boltRef = useRef<HTMLVideoElement>(null);
  const boltIdleRef = useRef<HTMLVideoElement>(null);
  const boltFaceRef = useRef<HTMLVideoElement>(null);
  const boltTurnRef = useRef<HTMLVideoElement>(null);
  const boltTurnBackRef = useRef<HTMLVideoElement>(null);
  const boltTurnLeftRef = useRef<HTMLVideoElement>(null);
  const boltTurnLeftBackRef = useRef<HTMLVideoElement>(null);
  const boltThunderRef = useRef<HTMLVideoElement>(null);
  const boltThunderRiseRef = useRef<HTMLVideoElement>(null);
  const boltThunderRightRef = useRef<HTMLVideoElement>(null);
  const boltThunderRightBackRef = useRef<HTMLVideoElement>(null);
  const boltThunderLeftRef = useRef<HTMLVideoElement>(null);
  const boltThunderLeftBackRef = useRef<HTMLVideoElement>(null);
  const boltThunderRightIdleRef = useRef<HTMLVideoElement>(null);
  const boltThunderLeftIdleRef = useRef<HTMLVideoElement>(null);
  const boltThunderRunRef = useRef<HTMLVideoElement>(null);
  const boltThunderRunLeftRef = useRef<HTMLVideoElement>(null);
  const boltThunderRunRightRef = useRef<HTMLVideoElement>(null);
  const boltThunderBackstepRef = useRef<HTMLVideoElement>(null);
  const boltThunderFaceRef = useRef<HTMLVideoElement>(null);
  const plainRef = useRef<HTMLVideoElement>(null);
  const plainLeftLiveRef = useRef<HTMLVideoElement>(null);
  const plainRightLiveRef = useRef<HTMLVideoElement>(null);
  const idleRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const fallenRef = useRef<HTMLVideoElement>(null);
  const bruteRef = useRef<HTMLVideoElement>(null);
  const bossRef = useRef<HTMLVideoElement>(null);
  const bossAshRef = useRef<HTMLVideoElement>(null);
  const wingLRef = useRef<HTMLVideoElement>(null);
  const wingRRef = useRef<HTMLVideoElement>(null);
  const gateARef = useRef<HTMLVideoElement>(null);
  const gateBRef = useRef<HTMLVideoElement>(null);
  const gateWingLRef = useRef<HTMLVideoElement>(null);
  const gateWingRRef = useRef<HTMLVideoElement>(null);
  const citadelRef = useRef<HTMLVideoElement>(null);
  const openRef = useRef<HTMLVideoElement>(null);
  const hallRef = useRef<HTMLVideoElement>(null);
  const breathRef = useRef<HTMLVideoElement>(null);
  const camLeftRef = useRef<HTMLVideoElement>(null);
  const camRightRef = useRef<HTMLVideoElement>(null);
  const camLeftBackRef = useRef<HTMLVideoElement>(null);
  const camRightBackRef = useRef<HTMLVideoElement>(null);
  const holoRef = useRef<HTMLVideoElement>(null);
  const exitRef = useRef<HTMLVideoElement>(null);
  const howlRef = useRef<HTMLVideoElement>(null);
  const ashFallenRef = useRef<HTMLVideoElement>(null);
  const ashBruteRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>(startInRoom ? "citadel" : "cover");
  const [peak, setPeak] = useState(0);
  const [lastRun, setLastRun] = useState(0);
  const [paces, setPaces] = useState(0);
  const [wounds, setWounds] = useState(0);
  const [bossHp, setBossHp] = useState(0);
  const [gatesOpen, setGatesOpen] = useState(false);
  const [doorsReady, setDoorsReady] = useState(false);
  const [roomLive, setRoomLive] = useState(startInRoom);
  const [portalReady, setPortalReady] = useState(false);
  const [plainLive, setPlainLive] = useState(false);
  const phaseRef = useRef<Phase>(startInRoom ? "citadel" : "cover");
  const startInRoomRef = useRef(startInRoom);
  const hudRef = useRef<(paces: number, wounds: number) => void>(() => undefined);

  useEffect(() => {
    setPeak(readPeak());
    const origin = "https://boltverse-pack.vercel.app";
    window.BOLTVERSE_PACK_ORIGIN = origin;
    if (!document.querySelector("script[data-pack='pyre']")) {
      const script = document.createElement("script");
      script.src = "/client/pack.js";
      script.async = true;
      script.dataset.pack = "pyre";
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    hudRef.current = (nextPaces, nextWounds) => {
      setPaces(nextPaces);
      setWounds(nextWounds);
    };
    const canvas = glRef.current;
    const fx = fxRef.current;
    const roadA = roadARef.current;
    const roadB = roadBRef.current;
    const bolt = boltRef.current;
    const boltIdle = boltIdleRef.current;
    const boltFace = boltFaceRef.current;
    const boltTurn = boltTurnRef.current;
    const boltTurnBack = boltTurnBackRef.current;
    const boltTurnLeft = boltTurnLeftRef.current;
    const boltTurnLeftBack = boltTurnLeftBackRef.current;
    const boltThunder = boltThunderRef.current;
    const boltThunderRise = boltThunderRiseRef.current;
    const boltThunderRight = boltThunderRightRef.current;
    const boltThunderRightBack = boltThunderRightBackRef.current;
    const boltThunderLeft = boltThunderLeftRef.current;
    const boltThunderLeftBack = boltThunderLeftBackRef.current;
    const boltThunderRightIdle = boltThunderRightIdleRef.current;
    const boltThunderLeftIdle = boltThunderLeftIdleRef.current;
    const boltThunderRun = boltThunderRunRef.current;
    const boltThunderRunLeft = boltThunderRunLeftRef.current;
    const boltThunderRunRight = boltThunderRunRightRef.current;
    const boltThunderBackstep = boltThunderBackstepRef.current;
    const boltThunderFace = boltThunderFaceRef.current;
    const plainVid = plainRef.current;
    const plainLeftLive = plainLeftLiveRef.current;
    const plainRightLive = plainRightLiveRef.current;
    const fallen = fallenRef.current;
    const brute = bruteRef.current;
    const boss = bossRef.current;
    const bossAsh = bossAshRef.current;
    const wingL = wingLRef.current;
    const wingR = wingRRef.current;
    const gateA = gateARef.current;
    const gateB = gateBRef.current;
    const gateWingL = gateWingLRef.current;
    const gateWingR = gateWingRRef.current;
    const citadel = citadelRef.current;
    const openVid = openRef.current;
    const hall = hallRef.current;
    const breath = breathRef.current;
    const camLeft = camLeftRef.current;
    const camRight = camRightRef.current;
    const camLeftBack = camLeftBackRef.current;
    const camRightBack = camRightBackRef.current;
    const holo = holoRef.current;
    const exitVid = exitRef.current;
    const howlVid = howlRef.current;
    const ashFallen = ashFallenRef.current;
    const ashBrute = ashBruteRef.current;
    const frame = frameRef.current;
    if (
      !canvas || !fx || !roadA || !roadB || !bolt || !boltIdle || !boltFace || !boltTurn || !boltTurnBack || !boltTurnLeft || !boltTurnLeftBack || !boltThunder || !boltThunderRise || !boltThunderRight || !boltThunderRightBack || !boltThunderLeft || !boltThunderLeftBack || !boltThunderRightIdle || !boltThunderLeftIdle || !boltThunderRun || !boltThunderRunLeft || !boltThunderRunRight || !boltThunderBackstep || !boltThunderFace || !plainVid || !plainLeftLive || !plainRightLive || !fallen || !brute || !boss || !bossAsh ||
      !wingL || !wingR || !howlVid || !ashFallen || !ashBrute || !gateA || !gateB ||
      !gateWingL || !gateWingR || !citadel || !openVid || !hall || !breath || !camLeft || !camRight || !camLeftBack || !camRightBack || !holo || !exitVid || !frame
    ) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
    });
    const ctx = fx.getContext("2d");
    if (!gl || !ctx) return;
    gl.getExtension("OES_standard_derivatives");

    const roadProg = program(gl, ROAD_FS);
    const boltProg = program(gl, BOLT_FS);
    const enemyProg = program(gl, ENEMY_FS);
    const rockProg = program(gl, PLATE_FS);
    const propProg = program(gl, PROP_FS);
    const skyProg = program(gl, SKY_FS);
    const howlProg = program(gl, HOWL_FS);
    const gateProg = program(gl, GATE_FS);
    const orbitProg = program(gl, ORBIT_FS);
    const shadowProg = program(gl, SHADOW_FS);
    const ORBIT_N = 16;
    const loadOrbit = (name: string, v = 1) =>
      Array.from({ length: ORBIT_N }, (_, i) => {
        const img = new Image();
        img.decoding = "async";
        img.src = `/master/orbit/${name}-${String(i + 1).padStart(2, "0")}.jpg?v=${v}`;
        return img;
      });
    const leftPack = loadOrbit("left", 5);
    const rightPack = loadOrbit("right", 4);
    const take = (pack: HTMLImageElement[], from: number, to: number) => pack.slice(from - 1, to);
    const leftSide = take(leftPack, 1, 16);
    const rightSide = take(rightPack, 1, 16);
    const plainLeft = loadOrbit("plain-left", 1);
    const plainRight = loadOrbit("plain-right", 1);
    const loadStrip = (name: string, n: number) =>
      Array.from({ length: n }, (_, i) => {
        const img = new Image();
        img.decoding = "async";
        img.src = `/master/orbit/${name}-${String(i + 1).padStart(2, "0")}.jpg?v=1`;
        return img;
      });
    const plainGo = loadStrip("plain-go", 32);
    const plainGoL = loadStrip("plain-go-l", 24);
    const plainGoR = loadStrip("plain-go-r", 24);
    const loadGrid = (name: string) =>
      Array.from({ length: 12 }, (_, i) => {
        const img = new Image();
        img.decoding = "async";
        img.src = `/master/grid/${name}-${String(i + 1).padStart(2, "0")}.jpg?v=1`;
        return img;
      });
    const nsPack = [
      [loadGrid("c1b1"), loadGrid("b1a1")],
      [loadGrid("c2b2"), loadGrid("b2a2")],
      [loadGrid("c3b3"), loadGrid("b3a3")],
    ];
    const ewPack = [
      [loadGrid("c1c2"), loadGrid("c2c3")],
      [loadGrid("b1b2"), loadGrid("b2b3")],
      [loadGrid("a1a2"), loadGrid("a2a3")],
    ];
    let gx = 1;
    let gy = 0;
    const gridFrame = () => {
      if (doorMode !== "out" || !(vistaHold || outArrived)) return null;
      const col = Math.max(0, Math.min(2, gx));
      const row = Math.max(0, Math.min(2, gy));
      const xOff = Math.abs(col - Math.round(col));
      const yOff = Math.abs(row - Math.round(row));
      if (xOff < 0.008 && yOff < 0.008) {
        const c = Math.round(col);
        const r = Math.round(row);
        if (c === 1 && r === 0) return null;
        if (r > 0) return shotAt(nsPack[c]![r - 1]!, 0.999);
        if (c > 0) return shotAt(ewPack[r]![c - 1]!, 0.999);
        return shotAt(ewPack[0]![0]!, 0);
      }
      if (xOff <= yOff) {
        const c = Math.max(0, Math.min(2, Math.round(col)));
        const row0 = Math.max(0, Math.min(1, Math.floor(Math.min(1.999, row))));
        return shotAt(nsPack[c]![row0]!, row - row0);
      }
      const r = Math.max(0, Math.min(2, Math.round(row)));
      const col0 = Math.max(0, Math.min(1, Math.floor(Math.min(1.999, col))));
      return shotAt(ewPack[r]![col0]!, col - col0);
    };
    const shotAt = (pack: HTMLImageElement[], t: number) => {
      const idx = Math.min(pack.length - 1, Math.floor(Math.min(0.999, Math.max(0, t)) * pack.length));
      for (let i = idx; i >= 0; i--) {
        const shot = pack[i];
        if (shot && shot.complete && shot.naturalWidth > 0) return shot;
      }
      return null;
    };
    const SIDE = Math.PI / 2;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const roadTex = makeTex(gl);
    const wingLTex = makeTex(gl);
    const wingRTex = makeTex(gl);
    const gateRoadTex = makeTex(gl);
    const gateWingLTex = makeTex(gl);
    const gateWingRTex = makeTex(gl);
    const citadelTex = makeTex(gl);
    const boltTex = makeTex(gl);
    const boltIdleTex = makeTex(gl);
    const foeTex = [makeTex(gl), makeTex(gl), makeTex(gl)];
    const howlTex = makeTex(gl);
    const ashTex = [makeTex(gl), makeTex(gl), makeTex(gl)];
    const farTex = makeTex(gl);
    const roomLeftTex = makeTex(gl);
    const roomRightTex = makeTex(gl);
    const roomBackTex = makeTex(gl);
    const skyTex = [makeTex(gl), makeTex(gl), makeTex(gl), makeTex(gl)];
    const pathTex = makeTex(gl);
    const rockPropTex = makeTex(gl);
    const spireTex = makeTex(gl);
    const cityTex = makeTex(gl);
    const decorImg = (src: string) => {
      const img = new Image();
      img.src = src;
      return img;
    };
    const skyVids = [0, 1, 2, 3].map((i) => {
      const video = document.createElement("video");
      video.src = `/master/decor/sky-${i}.mp4?v=1`;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "auto";
      video.setAttribute("playsinline", "");
      frame.appendChild(video);
      if (i === 0) {
        const play = () => {
          const pending = video.play();
          if (pending) pending.catch(() => undefined);
        };
        if (video.readyState >= 2) play();
        else video.addEventListener("loadeddata", play, { once: true });
      }
      return video;
    });
    const groundVid = document.createElement("video");
    groundVid.src = "/master/decor/ground.mp4?v=2";
    groundVid.muted = true;
    groundVid.loop = true;
    groundVid.playsInline = true;
    groundVid.preload = "auto";
    groundVid.setAttribute("playsinline", "");
    frame.appendChild(groundVid);
    const pathImg = decorImg("/master/decor/path.jpg");
    const rockImg = decorImg("/master/decor/rock.jpg");
    const spireImg = decorImg("/master/decor/spire.jpg");
    const cityImg = decorImg("/master/decor/citadel.jpg");
    const decorHash = (n: number) => {
      const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    const poster = new Image();
    poster.src = "/master/pyre-first.jpg";
    const far = new Image();
    far.src = "/master/citadel-far.jpg";
    const roomLeft = new Image();
    roomLeft.src = "/master/room-left.jpg";
    const roomRight = new Image();
    roomRight.src = "/master/room-right.jpg";
    const roomBack = new Image();
    roomBack.src = "/master/room-back.jpg";
    let roomPlates = false;

    const keys = new Set<string>();
    let steerOverride: number | null = null;
    let lanePos = 0;
    let glance = 0;
    let glanceTarget = 0;
    let orbit = 0;
    let orbitTarget = 0;
    let selfAng = 0;
    let orbitHold = false;
    let orbitDrag = false;
    let chase = false;
    let profileGo = false;
    let profileAge = 0;
    let worldX = 0;
    let worldZ = 0;
    let viewShift = 0;
    let drag: {
      id: number;
      x: number;
      y: number;
      lane: number;
      depth: number;
      looking: boolean;
      ny: number;
      onBolt: boolean;
      orbit: number;
      self: number;
      sweep: number;
      lastAng: number | null;
      arc: boolean;
      at: number;
      pts: { x: number; y: number }[];
      gx: number;
      gy: number;
      axis: "ns" | "ew" | null;
    } | null = null;
    let distance = 0;
    let wounds = 0;
    let invuln = 0;
    let flash = 0;
    let shake = 0;
    let spawnIn = 2.1;
    let flankNext: -1 | 1 = -1;
    let activeRoad = 0;
    let activeGate = 0;
    let arriveAge = 0;
    let citadelCalled = false;
    let cardShown = false;
    let doorsLive = false;
    let doorMode: "ride" | "open" | "hall" | "room" | "map" | "out" = "ride";
    let roomDepth = 0;
    let depthTarget = 0;
    let mapHop = false;
    let outHide = false;
    let outArrived = false;
    let thunderOn = false;
    let thunderHold: HTMLVideoElement | null = null;
    let thunderArmed = false;
    let thunderFace: "back" | "face" = "back";
    let thunderTurn: HTMLVideoElement | null = null;
    let thunderTurnTo: "back" | "face" = "back";
    let thunderTurnAge = 0;
    let thunderTurnSeenStart = false;
    let plainPush: "run" | "back" | null = null;
    let plateWish = 0;
    let plateV = 0;
    let plateOffset = 0;
    let zoom = 1;
    let zoomTarget = 1;
    let pinch: { dist: number; zoom: number } | null = null;
    let vistaHold = false;
    let portalHint = false;
    let plainNoted = false;
    let breathMix = startInRoomRef.current ? 1 : 0;
    let idleOn = breathMix > 0.5;
    let yaw: "back" | "face" = "back";
    let turnTo: "back" | "face" | null = null;
    let turnSide: "left" | "right" = "right";
    let turnAge = 0;
    let runHold = false;
    const hands = new Map<number, { x: number; y: number }>();
    let pair: { x: number; y: number; ang: number; fired: boolean } | null = null;
    let spinTo: "face" | "back" | null = null;
    let spinSide: "left" | "right" = "right";
    let best = readPeak();
    const foes: Foe[] = [];
    const ashes: Ash[] = [];
    let nextFoe = 1;
    const shots: { t: number; dur: number; id: number }[] = [];
    const foeClips = [fallen, brute, boss];
    const trail: { lane: number; age: number }[] = [];
    const roads = [roadA, roadB];
    const wings = [wingL, wingR];
    const gateRoads = [gateA, gateB];
    const gateWings = [gateWingL, gateWingR];

    const arm = (video: HTMLVideoElement) => {
      video.muted = true;
      video.playsInline = true;
      video.loop = false;
    };
    arm(roadA);
    arm(roadB);
    bolt.muted = true;
    bolt.playsInline = true;
    bolt.loop = true;
    bolt.defaultPlaybackRate = BOLT_RATE;
    bolt.playbackRate = BOLT_RATE;
    bolt.disablePictureInPicture = true;
    boltIdle.muted = true;
    boltIdle.playsInline = true;
    boltIdle.loop = true;
    boltIdle.playbackRate = 1;
    boltIdle.disablePictureInPicture = true;
    for (const clip of [boltFace, boltTurn, boltTurnBack, boltTurnLeft, boltTurnLeftBack, boltThunder, boltThunderRise, boltThunderRight, boltThunderRightBack, boltThunderLeft, boltThunderLeftBack, boltThunderRightIdle, boltThunderLeftIdle, boltThunderRun, boltThunderRunLeft, boltThunderRunRight, boltThunderBackstep, boltThunderFace]) {
      clip.muted = true;
      clip.playsInline = true;
      clip.disablePictureInPicture = true;
      clip.playbackRate = 1;
    }
    boltFace.loop = true;
    boltThunder.loop = true;
    boltThunderRightIdle.loop = true;
    boltThunderLeftIdle.loop = true;
    boltThunderRun.loop = true;
    boltThunderRunLeft.loop = true;
    boltThunderRunRight.loop = true;
    boltThunderBackstep.loop = true;
    boltThunderFace.loop = true;
    boltThunderRun.playbackRate = 1.25;
    boltThunderRise.loop = false;
    boltThunderRight.loop = false;
    boltThunderRightBack.loop = false;
    boltThunderLeft.loop = false;
    boltThunderLeftBack.loop = false;
    boltTurn.loop = false;
    boltTurnBack.loop = false;
    boltTurnLeft.loop = false;
    boltTurnLeftBack.loop = false;
    for (const clip of foeClips) {
      clip.muted = true;
      clip.playsInline = true;
      clip.loop = true;
      clip.disablePictureInPicture = true;
    }
    fallen.defaultPlaybackRate = FOE_KIND[0].rate;
    fallen.playbackRate = FOE_KIND[0].rate;
    brute.defaultPlaybackRate = FOE_KIND[1].rate;
    brute.playbackRate = FOE_KIND[1].rate;
    for (const wing of [...wings, ...gateWings]) {
      wing.muted = true;
      wing.playsInline = true;
      wing.loop = true;
      wing.playbackRate = 1;
      wing.disablePictureInPicture = true;
    }
    for (const clip of [gateA, gateB, citadel, openVid, hall, breath, holo, exitVid, plainVid, plainLeftLive, plainRightLive]) {
      clip.muted = true;
      clip.playsInline = true;
      clip.loop = clip === breath || clip === gateA || clip === gateB || clip === plainVid || clip === plainLeftLive || clip === plainRightLive;
      clip.disablePictureInPicture = true;
    }
    for (const clip of [howlVid, ashFallen, ashBrute]) {
      clip.muted = true;
      clip.playsInline = true;
      clip.loop = false;
      clip.disablePictureInPicture = true;
    }
    const playSafe = (video: HTMLVideoElement) => {
      const pending = video.play();
      if (pending) pending.catch(() => undefined);
    };
    let turnsHot = false;
    const turnClip = (to: "face" | "back", side: "left" | "right") => {
      if (to === "face") return side === "left" ? boltTurnLeft : boltTurn;
      return side === "left" ? boltTurnLeftBack : boltTurnBack;
    };
    const warmTurns = () => {
      for (const clip of [boltTurn, boltTurnBack, boltTurnLeft, boltTurnLeftBack, boltFace]) {
        const go = () => {
          if (clip.readyState < 2) return;
          try {
            if (!turnTo && clip.currentTime < 0.02) clip.currentTime = 0.04;
          } catch {
            /* not seekable yet */
          }
          const pending = clip.play();
          if (!pending) return;
          pending
            .then(() => {
              turnsHot = true;
              const showingFace = yaw === "face" && clip === boltFace && doorMode === "room";
              const showingTurn = turnTo !== null && clip === turnClip(turnTo, turnSide);
              if (!showingFace && !showingTurn) {
                clip.pause();
                try {
                  clip.currentTime = 0;
                } catch {
                  /* not seekable yet */
                }
              }
            })
            .catch(() => undefined);
        };
        if (clip.readyState >= 2) go();
        else clip.addEventListener("loadeddata", go, { once: true });
      }
    };
    warmTurns();
    for (const clip of [camLeft, camRight, camLeftBack, camRightBack]) {
      const go = () => {
        if (clip.readyState < 2) return;
        const pending = clip.play();
        if (!pending) return;
        pending.then(() => clip.pause()).catch(() => undefined);
      };
      if (clip.readyState >= 2) go();
      else clip.addEventListener("loadeddata", go, { once: true });
    }
    wings.forEach(playSafe);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        fx.width = w;
        fx.height = h;
        gl.viewport(0, 0, w, h);
      }
    };

    let frameZoom = 1;
    let frameFocusY = 0;
    const drawBuffer = (data: Float32Array) => {
      const prog = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram | null;
      if (prog) {
        gl.uniform1f(gl.getUniformLocation(prog, "uZoom"), frameZoom);
        gl.uniform2f(gl.getUniformLocation(prog, "uFocus"), 0, frameFocusY);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const paintHud = () => {
      hudRef.current(Math.floor(distance), wounds);
    };

    const fall = () => {
      phaseRef.current = "fallen";
      setPhase("fallen");
      setLastRun(Math.floor(distance));
      if (distance > best) {
        best = distance;
        writePeak(best);
        setPeak(Math.floor(best));
      }
      roads.forEach((video) => video.pause());
      bolt.pause();
      foeClips.forEach((video) => video.pause());
      wings.forEach((video) => video.pause());
      gateRoads.forEach((video) => video.pause());
      gateWings.forEach((video) => video.pause());
      citadel.pause();
      openVid.pause();
      hall.pause();
      exitVid.pause();
      breath.pause();
      holo.pause();
      howlVid.pause();
      ashFallen.pause();
      ashBrute.pause();
    };

    const begin = () => {
      phaseRef.current = "run";
      distance = 0;
      wounds = 0;
      invuln = 0;
      flash = 0;
      lanePos = 0;
      glance = 0;
      glanceTarget = 0;
      orbit = 0;
      selfAng = 0;
      orbitTarget = 0;
      orbitHold = false;
      orbitDrag = false;
      chase = false;
      foes.length = 0;
      ashes.length = 0;
      shots.length = 0;
      trail.length = 0;
      spawnIn = 2.1;
      arriveAge = 0;
      activeGate = 0;
      citadelCalled = false;
      cardShown = false;
      doorsLive = false;
      doorMode = "ride";
      roomDepth = 0;
      depthTarget = 0;
      mapHop = false;
      vistaHold = false;
      setBossHp(0);
      setGatesOpen(false);
      setDoorsReady(false);
      setRoomLive(false);
      setPlainLive(false);
      setPhase("run");
      setLastRun(0);
      paintHud();
      roads.forEach((video) => {
        video.pause();
        try {
          video.currentTime = 0;
        } catch {
          /* not seekable yet */
        }
      });
      activeRoad = 0;
      playSafe(roadA);
      playSafe(bolt);
      breathMix = 0;
      idleOn = false;
      yaw = "back";
      turnTo = null;
      turnAge = 0;
      wings.forEach((video) => {
        video.playbackRate = 1;
        try {
          video.currentTime = 0;
        } catch {
          /* not seekable yet */
        }
        playSafe(video);
      });
      foeClips.forEach((video, index) => {
        video.playbackRate = FOE_KIND[index]!.rate;
        playSafe(video);
      });
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx && !audio.ctx) {
        const ac = new AudioCtx();
        const master = ac.createGain();
        master.gain.value = 0.18;
        master.connect(ac.destination);
        const osc = ac.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = 52;
        const filter = ac.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 160;
        const gain = ac.createGain();
        gain.gain.value = 0.12;
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        osc.start();
        audio.ctx = ac;
        audio.master = master;
      }
      if (audio.ctx?.state === "suspended") void audio.ctx.resume();
    };

    const audio: { ctx?: AudioContext; master?: GainNode } = {};

    const hit = () => {
      if (GOD || invuln > 0) return;
      wounds += 1;
      invuln = 0.85;
      flash = 1;
      shake = 0.18;
      frame.classList.remove("pyre-shake");
      void frame.offsetWidth;
      frame.classList.add("pyre-shake");
      if (audio.ctx && audio.master) {
        const osc = audio.ctx.createOscillator();
        const gain = audio.ctx.createGain();
        osc.type = "square";
        osc.frequency.value = 90;
        gain.gain.setValueAtTime(0.2, audio.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + 0.18);
        osc.connect(gain);
        gain.connect(audio.master);
        osc.start();
        osc.stop(audio.ctx.currentTime + 0.2);
      }
      paintHud();
      if (wounds >= 3) fall();
    };

    const probe = {
      getYaw: () => -lanePos * 0.55,
      getSpeed: () => (phaseRef.current === "run" ? 14 : 0),
      setSteer: (v: number) => {
        steerOverride = v;
      },
      setKeys: (codes: string[]) => {
        keys.clear();
        for (const code of codes) keys.add(code);
      },
    };
    window.__controlsTest = probe;

    const foeSpot = (foe: Foe) => {
      const spec = FOE_KIND[foe.kind];
      const near = Math.min(1, Math.max(0, foe.z));
      const spread = 0.28 + 0.72 * near;
      const worldX = foe.side === 0 ? 0.5 + foe.lane * SLIDE_AMP * spread : foe.wide;
      const footX = worldX - viewShift;
      const footY = HORIZON + (PLANT_Y - HORIZON) * near;
      const grow = foe.kind === 2 ? near : foe.side === 0 ? 0.42 + 0.58 * near : 0.58 + 0.42 * near;
      const h = spec.h * grow;
      const aspect = canvas.width / Math.max(1, canvas.height);
      const w = (h * FOE_ASPECT) / aspect;
      return { footX, footY, x: footX - w / 2, y: footY - spec.foot * h, w, h };
    };
    const bark = () => {
      if (!audio.ctx || !audio.master) return;
      const t = audio.ctx.currentTime;
      const osc = audio.ctx.createOscillator();
      const gain = audio.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(190, t);
      osc.frequency.exponentialRampToValueAtTime(48, t + 0.42);
      gain.gain.setValueAtTime(0.24, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start(t);
      osc.stop(t + 0.5);
    };
    const crack = () => {
      if (!audio.ctx || !audio.master) return;
      const t = audio.ctx.currentTime;
      const osc = audio.ctx.createOscillator();
      const gain = audio.ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(36, t + 0.22);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start(t);
      osc.stop(t + 0.26);
    };
    const castHowl = (foe: Foe) => {
      if (phaseRef.current !== "run") return;
      if (shots.some((item) => item.id === foe.id)) return;
      const mouthY = PLANT_Y - PAW_V * BOLT_H + BOLT_H * 0.2;
      const mouthX = 0.5 + lanePos * SLIDE_AMP - viewShift;
      const reach = foeSpot(foe);
      const dist = Math.hypot(reach.footX - mouthX, reach.y + reach.h * 0.42 - mouthY);
      shots.push({ t: 0, dur: 0.2 + Math.min(0.28, dist * 0.55), id: foe.id });
      if (howlVid.paused) {
        try {
          howlVid.currentTime = 0;
        } catch {
          /* not seekable yet */
        }
        howlVid.playbackRate = 2.2;
        playSafe(howlVid);
      }
      bark();
    };
    const foeUnder = (nx: number, ny: number) => {
      let hit: Foe | null = null;
      let bestZ = -1;
      for (const foe of foes) {
        const spot = foeSpot(foe);
        const pad = 0.07;
        if (nx < spot.x - pad || nx > spot.x + spot.w + pad || ny < spot.y - pad || ny > spot.y + spot.h + pad) continue;
        if (foe.z > bestZ) {
          hit = foe;
          bestZ = foe.z;
        }
      }
      return hit;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      keys.add(event.code);
      if (event.code === "Space" || event.code === "Enter") {
        if (phaseRef.current !== "run") begin();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code);
    const onBlur = () => keys.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    const slideTo = (clientX: number, originX: number, originLane: number) => {
      const width = frame.clientWidth || 1;
      lanePos = Math.max(-1, Math.min(1, originLane + (clientX - originX) / width / 0.22));
    };
    const inRoomNow = () => phaseRef.current === "citadel" && doorMode === "room";
    const handCenter = () => {
      let x = 0;
      let y = 0;
      let n = 0;
      for (const point of hands.values()) {
        x += point.x;
        y += point.y;
        n += 1;
      }
      return n ? { x: x / n, y: y / n } : null;
    };
    const fingerAngle = () => {
      const pts = [...hands.values()];
      if (pts.length < 2) return 0;
      return Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
    };
    const fingerDist = () => {
      const pts = [...hands.values()];
      if (pts.length < 2) return 0;
      return Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    };
    const wrapAng = (angle: number) => {
      let a = angle;
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      return a;
    };
    const arcOf = (pts: { x: number; y: number }[]) => {
      if (pts.length < 6) return null;
      const a = pts[0]!;
      const b = pts[pts.length - 1]!;
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const chord = Math.hypot(abx, aby) || 1;
      let dev = 0;
      let len = 0;
      let pos = 0;
      let neg = 0;
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i]!;
        dev = Math.max(dev, Math.abs(abx * (p.y - a.y) - aby * (p.x - a.x)) / chord);
        const prev = pts[i - 1]!;
        const dx = p.x - prev.x;
        const dy = p.y - prev.y;
        len += Math.hypot(dx, dy);
        if (i >= 2) {
          const older = pts[i - 2]!;
          const turn = (prev.x - older.x) * dy - (prev.y - older.y) * dx;
          if (turn > 0.4) pos += 1;
          else if (turn < -0.4) neg += 1;
        }
      }
      const head = Math.atan2(pts[2]!.y - a.y, pts[2]!.x - a.x);
      const tail = Math.atan2(b.y - pts[pts.length - 3]!.y, b.x - pts[pts.length - 3]!.x);
      let sweep = tail - head;
      while (sweep > Math.PI) sweep -= Math.PI * 2;
      while (sweep < -Math.PI) sweep += Math.PI * 2;
      const same = Math.max(pos, neg);
      const flip = Math.min(pos, neg);
      if (len < 140 || len < chord * 1.32 || dev < 58 || dev < chord * 0.52) return null;
      if (Math.abs(sweep) < 1.2) return null;
      if (same < 3 || flip > same * 0.35) return null;
      return sweep > 0 ? ("right" as const) : ("left" as const);
    };
    const beginTurn = (to: "face" | "back", side: "left" | "right") => {
      if (doorMode !== "room") return;
      if (yaw === to && !turnTo) return;
      if (turnTo === to && turnSide === side) return;
      const clip = turnClip(to, side);
      runHold = false;
      for (const other of [boltTurn, boltTurnBack, boltTurnLeft, boltTurnLeftBack]) {
        if (other !== clip) other.pause();
      }
      turnTo = to;
      turnSide = side;
      turnAge = 0;
      breathMix = 1;
      idleOn = true;
      const kick = () => {
        if (turnTo !== to || turnSide !== side) return;
        try {
          clip.currentTime = 0;
        } catch {
          /* not seekable yet */
        }
        clip.playbackRate = 1;
        playSafe(clip);
      };
      kick();
      if (clip.readyState < 2) clip.addEventListener("canplay", kick, { once: true });
    };
    const onSlideDown = (event: PointerEvent) => {
      const hit = event.target as HTMLElement | null;
      if (hit?.closest(".pyre-cover, button")) return;
      const riding = phaseRef.current === "run" || (phaseRef.current === "citadel" && doorMode !== "map");
      if (!riding || event.button !== 0) return;
      hands.set(event.pointerId, { x: event.clientX, y: event.clientY });
      try {
        frame.setPointerCapture(event.pointerId);
      } catch {
        /* synthetic events */
      }
      if (phaseRef.current === "citadel" && doorMode === "out" && hands.size >= 2) {
        pinch = { dist: Math.max(28, fingerDist()), zoom: zoomTarget };
        plainPush = null;
        drag = null;
        return;
      }
      if (inRoomNow() && hands.size >= 2) {
        const center = handCenter();
        if (center) pair = { x: center.x, y: center.y, ang: fingerAngle(), fired: false };
        if (drag) {
          lanePos = drag.lane;
          depthTarget = drag.depth;
        }
        if (!turnsHot) warmTurns();
        return;
      }
      if (drag) return;
      if (inRoomNow() && !turnsHot) warmTurns();
      const rect = frame.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / (rect.width || 1);
      const ny = (event.clientY - rect.top) / (rect.height || 1);
      const box = boltBox();
      const pad = 0.05;
      let hitX = box.x;
      let hitY = box.y;
      let hitW = box.w;
      let hitH = box.h;
      if (doorMode === "out" && thunderOn) {
        hitW = box.w * THUNDER_FIT;
        hitH = box.h * THUNDER_FIT;
        hitX = box.x + box.w / 2 - hitW / 2;
        hitY = box.footY - 0.97 * hitH;
      }
      const onBolt = nx >= hitX - pad && nx <= hitX + hitW + pad && ny >= hitY - pad && ny <= hitY + hitH + pad;
      const tapped = phaseRef.current === "run" ? foeUnder(nx, ny) : null;
      if (tapped && !onBolt) {
        hands.delete(event.pointerId);
        castHowl(tapped);
        return;
      }
      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        lane: lanePos,
        depth: depthTarget,
        looking: phaseRef.current === "run" && !onBolt,
        ny,
        onBolt,
        orbit: orbitTarget,
        self: selfAng,
        sweep: 0,
        lastAng: null,
        arc: false,
        at: performance.now(),
        pts: [{ x: event.clientX, y: event.clientY }],
        gx,
        gy,
        axis: null,
      };
    };
    const onSlideMove = (event: PointerEvent) => {
      if (hands.has(event.pointerId)) hands.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (phaseRef.current === "citadel" && doorMode === "out" && hands.size >= 2 && pinch) {
        const dist = fingerDist();
        if (dist > 16) zoomTarget = Math.max(1, Math.min(2.35, pinch.zoom * (dist / pinch.dist)));
        return;
      }
      if (inRoomNow() && hands.size >= 2 && pair) {
        const center = handCenter();
        if (!center) return;
        const dx = center.x - pair.x;
        const dy = center.y - pair.y;
        const dAng = wrapAng(fingerAngle() - pair.ang);
        if (drag) {
          lanePos = drag.lane;
          depthTarget = drag.depth;
        }
        const swiped = Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 0.65;
        const spun = Math.abs(dAng) > 0.38;
        const side: "left" | "right" = swiped ? (dx > 0 ? "right" : "left") : dAng > 0 ? "right" : "left";
        const starting = !pair.fired && (swiped || spun);
        const reversing = pair.fired && (swiped || spun) && side !== spinSide;
        if (starting || reversing) {
          const to: "face" | "back" = turnTo ? (turnTo === "face" ? "back" : "face") : yaw === "face" ? "back" : "face";
          pair.fired = true;
          pair.x = center.x;
          pair.y = center.y;
          pair.ang = fingerAngle();
          spinTo = to;
          spinSide = side;
          beginTurn(to, side);
        }
        return;
      }
      if (!drag || event.pointerId !== drag.id) return;
      if (phaseRef.current === "citadel" && doorMode === "out") {
        const height = frame.clientHeight || 1;
        const width = frame.clientWidth || 1;
        drag.pts.push({ x: event.clientX, y: event.clientY });
        if (drag.pts.length > 36) drag.pts.splice(1, 1);
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        let bow = 0;
        const origin = drag.pts[0]!;
        const tip = drag.pts[drag.pts.length - 1]!;
        const spanX = tip.x - origin.x;
        const spanY = tip.y - origin.y;
        const span = Math.hypot(spanX, spanY) || 1;
        for (const p of drag.pts) {
          bow = Math.max(bow, Math.abs(spanX * (p.y - origin.y) - spanY * (p.x - origin.x)) / span);
        }
        const flat = Math.abs(dx) > 16 && Math.abs(dx) > Math.abs(dy) * 1.2 && bow < 34 && bow < span * 0.22;
        const horizontal = Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 0.8;
        if ((orbitDrag || chase || (!drag.arc && (flat || horizontal))) && (vistaHold || outArrived)) {
          selfAng = drag.self + (-dx / width) * (Math.PI * 2);
          const turned = Math.abs(wrapAng(selfAng - drag.orbit));
          const side = turned > 0.7 && turned < 2.5;
          if (side && Math.abs(dx) > width * 0.16) {
            profileGo = true;
            plateWish = 1.25;
            plainPush = "run";
            if (!chase) {
              orbit = drag.orbit;
              orbitTarget = drag.orbit;
              orbitDrag = true;
            } else {
              orbitDrag = false;
              orbitTarget = selfAng;
            }
          } else if (!chase) {
            profileGo = false;
            orbit = drag.orbit;
            orbitTarget = drag.orbit;
            orbitDrag = true;
            plateWish = 0;
            plainPush = null;
          }
          return;
        }
        const curl = arcOf(drag.pts);
        if (curl) {
          lanePos = drag.lane;
          depthTarget = drag.depth;
          roomDepth = drag.depth;
          orbit = drag.orbit;
          orbitTarget = drag.orbit;
          gx = drag.gx;
          gy = drag.gy;
          plainPush = null;
          plateWish = 0;
          const finger = Math.atan2(event.clientY - drag.y, event.clientX - drag.x);
          if (drag.lastAng == null) drag.lastAng = finger;
          else {
            selfAng += wrapAng(finger - drag.lastAng);
            drag.lastAng = finger;
          }
          drag.arc = true;
          chase = false;
          return;
        }
        if (!drag.axis && (Math.abs(dx) > 12 || Math.abs(dy) > 12)) {
          drag.axis = Math.abs(dx) > Math.abs(dy) ? "ew" : "ns";
        }
        if (drag.axis === "ns") {
          gx = Math.max(0, Math.min(2, Math.round(drag.gx)));
          const pull = (drag.y - event.clientY) / height;
          plateWish = Math.max(-1.8, Math.min(1.8, pull * 3.2));
          plainPush = plateWish > 0.08 ? "run" : plateWish < -0.08 ? "back" : null;
        } else if (drag.axis === "ew") {
          gy = Math.max(0, Math.min(2, Math.round(drag.gy)));
          const next = Math.max(0, Math.min(2, drag.gx + (event.clientX - drag.x) / (width * 0.46)));
          gx = next;
          plainPush = Math.abs(next - drag.gx) > 0.05 ? "run" : null;
        }
        return;
      }
      if (phaseRef.current === "citadel" && doorMode === "room") {
        const width = frame.clientWidth || 1;
        const height = frame.clientHeight || 1;
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        const horizontal = Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.05;
        if (horizontal || !drag.onBolt) {
          if (horizontal) {
            const gain = SIDE / 0.5;
            orbitTarget = Math.max(-SIDE, Math.min(SIDE, drag.orbit + (-dx / width) * gain));
            orbit = orbitTarget;
            orbitDrag = true;
            lanePos = 0;
            depthTarget = 0;
            roomDepth = 0;
            if (turnTo) {
              turnTo = null;
              turnAge = 0;
              boltTurn.pause();
              boltTurnBack.pause();
              boltTurnLeft.pause();
              boltTurnLeftBack.pause();
            }
          }
          if (!drag.onBolt || orbitDrag) return;
        }
        slideTo(event.clientX, drag.x, drag.lane);
        depthTarget = Math.max(0, Math.min(1, drag.depth - dy / (height * 0.42)));
        if (Math.hypot(dx, dy) > 16) {
          if (turnTo) {
            turnTo = null;
            turnAge = 0;
            boltTurn.pause();
            boltTurnBack.pause();
            boltTurnLeft.pause();
            boltTurnLeftBack.pause();
          }
          runHold = true;
          breathMix = 0;
        }
        return;
      }
      if (drag.looking) {
        const width = frame.clientWidth || 1;
        const dx = event.clientX - drag.x;
        glanceTarget = Math.max(-1, Math.min(1, dx / (width * 0.42)));
        return;
      }
      slideTo(event.clientX, drag.x, drag.lane);
    };
    const onSlideUp = (event: PointerEvent) => {
      const fired = pair?.fired ?? false;
      const dir = spinTo;
      hands.delete(event.pointerId);
      if (hands.size < 2) {
        pinch = null;
        if (drag && hands.has(drag.id)) {
          const stay = hands.get(drag.id)!;
          drag.x = stay.x;
          drag.y = stay.y;
          drag.lane = lanePos;
          drag.depth = depthTarget;
        }
        pair = null;
      }
      if (fired) {
        if (drag) {
          lanePos = drag.lane;
          depthTarget = drag.depth;
        }
        if (dir) beginTurn(dir, spinSide);
        if (drag && event.pointerId === drag.id && !hands.has(drag.id)) {
          if (orbitDrag && doorMode !== "out") {
            const span = SIDE;
            orbitTarget = Math.max(-span, Math.min(span, Math.round(orbit / span) * span));
          }
          drag = null;
          runHold = false;
          orbitDrag = false;
          chase = false;
        }
        spinTo = null;
        try {
          if (frame.hasPointerCapture(event.pointerId)) frame.releasePointerCapture(event.pointerId);
        } catch {
          /* already released */
        }
        return;
      }
      if (!drag || event.pointerId !== drag.id) {
        try {
          if (frame.hasPointerCapture(event.pointerId)) frame.releasePointerCapture(event.pointerId);
        } catch {
          /* already released */
        }
        return;
      }
      if (doorMode === "out") {
        const curl = orbitDrag ? null : arcOf(drag.pts);
        if (curl) {
          lanePos = drag.lane;
          depthTarget = drag.depth;
          roomDepth = drag.depth;
          orbit = drag.orbit;
          orbitTarget = drag.orbit;
          gx = drag.gx;
          gy = drag.gy;
          plainPush = null;
          if (!drag.arc) beginThunderTurn(curl);
        } else if (orbitDrag && !chase) {
          orbitTarget = orbit;
          plainPush = null;
          profileGo = false;
        } else if (!chase) {
          plainPush = null;
          profileGo = false;
        }
        if (profileGo || Math.abs(wrapAng(selfAng - orbit)) > 0.7) {
          chase = true;
          orbitDrag = false;
          orbitTarget = selfAng;
          profileGo = false;
          plainPush = null;
          plateWish = 0;
        }
        drag = null;
        runHold = false;
        orbitDrag = false;
        try {
          if (frame.hasPointerCapture(event.pointerId)) frame.releasePointerCapture(event.pointerId);
        } catch {
          /* already released */
        }
        return;
      }
      const moved = Math.hypot(event.clientX - drag.x, event.clientY - drag.y);
      const inRoom = inRoomNow();
      if (drag.looking) glanceTarget = 0;
      else if (!inRoom || drag.onBolt) slideTo(event.clientX, drag.x, drag.lane);
      const rect = frame.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / (rect.width || 1);
      if (phaseRef.current === "citadel" && moved < 36) {
        if (doorMode === "ride" && doorsLive && drag.ny < 0.72) openTheDoors();
        else if (inRoom && !drag.onBolt) {
          const onDoor = nx > 0.34 && nx < 0.66 && drag.ny > 0.28 && drag.ny < 0.58;
          const onRing = nx > 0.16 && nx < 0.84 && drag.ny > 0.55 && drag.ny < 0.92;
          if (onDoor) {
            if (roomDepth > 0.68 && Math.abs(orbit) < 0.22) leaveThrough();
            else depthTarget = 1;
          } else if (onRing) openMap();
        }
      }
      if (orbitDrag && doorMode !== "out") {
        orbitTarget = Math.max(-SIDE, Math.min(SIDE, Math.round(orbit / SIDE) * SIDE));
      }
      drag = null;
      runHold = false;
      orbitDrag = false;
      chase = false;
      try {
        if (frame.hasPointerCapture(event.pointerId)) frame.releasePointerCapture(event.pointerId);
      } catch {
        /* already released */
      }
    };
    frame.addEventListener("pointerdown", onSlideDown);
    frame.addEventListener("pointermove", onSlideMove);
    frame.addEventListener("pointerup", onSlideUp);
    frame.addEventListener("pointercancel", onSlideUp);
    const onWheel = (event: WheelEvent) => {
      if (phaseRef.current !== "citadel" || doorMode !== "out") return;
      event.preventDefault();
      zoomTarget = Math.max(1, Math.min(2.35, zoomTarget * Math.exp(-event.deltaY * 0.0014)));
    };
    frame.addEventListener("wheel", onWheel, { passive: false });

    let raf = 0;
    let last = performance.now();

    const openTheDoors = () => {
      if (doorMode !== "ride" || !doorsLive) return;
      doorMode = "open";
      doorsLive = false;
      setDoorsReady(false);
      openVid.loop = false;
      if (openVid.currentTime > 0.05) {
        try {
          openVid.currentTime = 0;
        } catch {
          /* not seekable yet */
        }
      }
      playSafe(openVid);
    };

    const leaveThrough = () => {
      if (doorMode !== "room" || roomDepth < 0.68 || Math.abs(orbit) > 0.22) return;
      doorMode = "out";
      outHide = false;
      outArrived = false;
      portalHint = false;
      setPortalReady(false);
      setRoomLive(false);
      setPlainLive(false);
      lanePos = 0;
      glance = 0;
      glanceTarget = 0;
      orbit = 0;
      selfAng = 0;
      orbitTarget = 0;
      gx = 1;
      gy = 0;
      yaw = "back";
      turnTo = null;
      thunderArmed = false;
      thunderFace = "back";
      thunderTurn = null;
      vistaHold = false;
      plainNoted = false;
      zoom = 1;
      zoomTarget = 1;
      depthTarget = 1;
      exitVid.loop = false;
      try {
        exitVid.currentTime = 0;
      } catch {
        /* not seekable yet */
      }
      playSafe(exitVid);
    };

    const beginThunderTurn = (side: "left" | "right") => {
      if (doorMode !== "out" || !thunderOn) return;
      const riseDone =
        vistaHold ||
        (boltThunderRise.readyState >= 2 &&
          boltThunderRise.duration > 0 &&
          (boltThunderRise.ended || boltThunderRise.currentTime > boltThunderRise.duration - 0.12));
      if (!riseDone && thunderFace === "back" && !thunderTurn) return;
      const from = thunderTurn ? thunderTurnTo : thunderFace;
      const toFace = from !== "face";
      const clip = toFace
        ? side === "right"
          ? boltThunderRight
          : boltThunderLeft
        : side === "right"
          ? boltThunderRightBack
          : boltThunderLeftBack;
      const to: "back" | "face" = toFace ? "face" : "back";
      if (thunderTurn) thunderTurn.pause();
      thunderTurn = clip;
      thunderTurnTo = to;
      thunderTurnAge = 0;
      thunderTurnSeenStart = false;
      clip.loop = false;
      try {
        clip.currentTime = 0;
      } catch {
        /* not seekable yet */
      }
      playSafe(clip);
    };

    const openMap = () => {
      if (doorMode !== "room" || mapHop) return;
      doorMode = "map";
      setRoomLive(false);
      setPlainLive(false);
      try {
        holo.currentTime = 0;
      } catch {
        /* not seekable yet */
      }
      holo.loop = false;
      playSafe(holo);
    };

    const boltBox = () => {
      const aspect = (frame.clientWidth || 1) / (frame.clientHeight || 1);
      const depth =
        phaseRef.current === "citadel" && doorMode === "room"
          ? roomDepth
          : phaseRef.current === "citadel" && doorMode === "out"
            ? 0.08
            : 0;
      const nearSpan = PLANT_Y - ROOM_VANISH;
      const farSpan = Math.max(0.04, ROOM_STEP - ROOM_VANISH);
      const persp = 1 + depth * (nearSpan / farSpan - 1);
      const footY = ROOM_VANISH + nearSpan / persp;
      const scale = (footY - ROOM_VANISH) / nearSpan;
      const h = BOLT_H * scale;
      const w = (h * BOLT_ASPECT) / aspect;
      const y = footY - PAW_V * h;
      const amp = SLIDE_AMP * scale;
      const x = 0.5 + lanePos * amp - viewShift - w / 2;
      return { x, y, w, h, footY };
    };

    const openGates = (atDoors = false) => {
      if (!atDoors && phaseRef.current !== "run") return;
      phaseRef.current = "citadel";
      arriveAge = 0;
      foes.length = 0;
      ashes.length = 0;
      shots.length = 0;
      glance = 0;
      glanceTarget = 0;
      orbit = 0;
      selfAng = 0;
      orbitTarget = 0;
      lanePos = 0;
      doorMode = "ride";
      doorsLive = atDoors;
      cardShown = false;
      roomDepth = 0;
      depthTarget = 0;
      mapHop = false;
      vistaHold = false;
      setPhase("citadel");
      setRoomLive(false);
      setPlainLive(false);
      setBossHp(0);
      setDoorsReady(atDoors);
      setGatesOpen(false);
      if (!atDoors && distance > best) {
        best = distance;
        writePeak(best);
        setPeak(Math.floor(best));
      }
      if (atDoors) distance = PYRE_PACES;
      setLastRun(Math.floor(distance));
      paintHud();
      const park = () => {
        const end = Math.max(0, (citadel.duration || 0) - 0.08);
        try {
          citadel.currentTime = end;
        } catch {
          /* not seekable yet */
        }
      };
      citadel.loop = false;
      if (atDoors) {
        if (citadel.readyState >= 1 && citadel.duration) park();
        else citadel.addEventListener("loadedmetadata", park, { once: true });
        citadel.pause();
      } else {
        try {
          citadel.currentTime = 0;
        } catch {
          /* not seekable yet */
        }
        playSafe(citadel);
      }
      playSafe(bolt);
      breathMix = atDoors ? 1 : 0;
      idleOn = atDoors;
      openVid.pause();
      hall.pause();
      exitVid.pause();
      breath.pause();
      holo.pause();
    };

    const enterRoom = () => {
      phaseRef.current = "citadel";
      doorMode = "room";
      doorsLive = false;
      cardShown = true;
      roomDepth = 0.42;
      depthTarget = 0.42;
      mapHop = false;
      vistaHold = false;
      distance = PYRE_PACES;
      lanePos = 0;
      glance = 0;
      glanceTarget = 0;
      orbit = 0;
      selfAng = 0;
      orbitTarget = 0;
      foes.length = 0;
      ashes.length = 0;
      shots.length = 0;
      setPhase("citadel");
      setRoomLive(true);
      setDoorsReady(false);
      setGatesOpen(false);
      setBossHp(0);
      setLastRun(PYRE_PACES);
      setPaces(PYRE_PACES);
      paintHud();
      roads.forEach((video) => video.pause());
      citadel.pause();
      openVid.pause();
      hall.pause();
      exitVid.pause();
      holo.pause();
      const startBreath = () => {
        breath.loop = true;
        try {
          breath.currentTime = 0;
        } catch {
          /* not seekable yet */
        }
        playSafe(breath);
      };
      if (breath.readyState >= 2) startBreath();
      else breath.addEventListener("loadeddata", startBreath, { once: true });
      playSafe(bolt);
      breathMix = 1;
      idleOn = true;
      warmTurns();
    };

    const enterVista = () => {
      phaseRef.current = "citadel";
      doorMode = "out";
      doorsLive = false;
      cardShown = true;
      vistaHold = true;
      thunderArmed = true;
      thunderOn = true;
      thunderFace = "back";
      thunderTurn = null;
      zoom = 1;
      zoomTarget = 1;
      outHide = false;
      outArrived = true;
      roomDepth = 0.06;
      depthTarget = 0.06;
      mapHop = false;
      distance = PYRE_PACES;
      lanePos = 0;
      glance = 0;
      glanceTarget = 0;
      orbit = 0;
      selfAng = 0;
      orbitTarget = 0;
      gx = 1;
      gy = 0;
      yaw = "back";
      turnTo = null;
      foes.length = 0;
      ashes.length = 0;
      shots.length = 0;
      setPhase("citadel");
      setRoomLive(false);
      setPlainLive(false);
      setPortalReady(false);
      setPlainLive(true);
      setDoorsReady(false);
      setGatesOpen(false);
      setBossHp(0);
      setLastRun(PYRE_PACES);
      setPaces(PYRE_PACES);
      paintHud();
      roads.forEach((video) => video.pause());
      citadel.pause();
      openVid.pause();
      hall.pause();
      breath.pause();
      holo.pause();
      const parkExit = () => {
        const end = Math.max(0, (exitVid.duration || 10) - 0.04);
        try {
          exitVid.currentTime = end;
        } catch {
          /* not seekable yet */
        }
        exitVid.pause();
      };
      exitVid.loop = false;
      if (exitVid.readyState >= 1 && exitVid.duration) parkExit();
      else exitVid.addEventListener("loadedmetadata", parkExit, { once: true });
      boltThunder.loop = true;
      const startThunder = () => playSafe(boltThunder);
      if (boltThunder.readyState >= 2) startThunder();
      else boltThunder.addEventListener("loadeddata", startThunder, { once: true });
      const startPlain = () => playSafe(plainVid);
      if (plainVid.readyState >= 2) startPlain();
      else plainVid.addEventListener("loadeddata", startPlain, { once: true });
      playSafe(bolt);
      breathMix = 1;
      idleOn = true;
    };

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      zoom = Math.max(1, zoom);
      zoomTarget = Math.max(1, zoomTarget);
      zoom += (zoomTarget - zoom) * (1 - Math.exp(-dt * 12));
      outHide = false;
      thunderOn = false;
      resize();
      const running = phaseRef.current === "run";
      const glanceEase = drag?.looking ? 14 : 10;
      glance += (glanceTarget - glance) * (1 - Math.exp(-glanceEase * dt));
      if (Math.abs(glance) < 0.0008 && glanceTarget === 0) glance = 0;

      if (running) {
        if (!drag) {
          let steer = steerOverride ?? 0;
          if (steerOverride == null) {
            if (keys.has("KeyA") || keys.has("ArrowLeft")) steer += 1;
            if (keys.has("KeyD") || keys.has("ArrowRight")) steer -= 1;
          }
          steer = Math.max(-1, Math.min(1, steer));
          lanePos = Math.max(-1, Math.min(1, lanePos - steer * 3.4 * dt));
        }
        distance += 14 * dt;
        if (distance > best) {
          best = distance;
          writePeak(best);
        }
        invuln = Math.max(0, invuln - dt);
        flash = Math.max(0, flash - dt * 3.2);
        shake = Math.max(0, shake - dt);
        spawnIn -= dt;
        const farBusy = foes.some((foe) => foe.z < 0.55);
        if (!citadelCalled && distance >= PYRE_PACES) {
          citadelCalled = true;
          foes.length = 0;
          ashes.length = 0;
          shots.length = 0;
          openGates();
        }
        if (spawnIn <= 0 && foes.length < 2 && !farBusy && !citadelCalled && distance < PYRE_PACES - 40) {
          const pace = 1 + Math.min(0.55, distance / 220);
          const kind: 0 | 1 = Math.random() < 0.7 ? 0 : 1;
          const fromSide = Math.random() < 0.6;
          const side: -1 | 0 | 1 = fromSide ? flankNext : 0;
          if (fromSide) flankNext = flankNext === -1 ? 1 : -1;
          const aimLane = Math.max(-1, Math.min(1, lanePos + (Math.random() - 0.5) * 0.5));
          const hunter = side === 0 && Math.random() < 0.62;
          foes.push({
            id: nextFoe++,
            kind,
            lane: side === 0 ? Math.random() * 2.2 - 1.1 : aimLane,
            aim: hunter ? null : aimLane,
            z: 0,
            speed: (kind === 0 ? 0.3 : 0.2) * pace,
            struck: false,
            side,
            wide: side < 0 ? -0.22 : side > 0 ? 1.22 : 0.5,
            hp: 1,
            hurt: 0,
          });
          spawnIn = 2.6 + Math.random() * 1.5;
        }
        for (let i = foes.length - 1; i >= 0; i -= 1) {
          const foe = foes[i]!;
          foe.hurt = Math.max(0, foe.hurt - dt);
          if (foe.kind === 2) {
            foe.z = Math.min(0.52, foe.z + foe.speed * dt);
            foe.lane += (0 - foe.lane) * Math.min(1, dt * 1.4);
            continue;
          }
          const spec = FOE_KIND[foe.kind];
          const near = Math.min(1, Math.max(0, foe.z));
          if (foe.side === 0) {
            const desired = foe.aim ?? lanePos;
            const commit = foe.z > 0.68 ? 0.18 : 1;
            const step = Math.max(-1.15, Math.min(1.15, desired - foe.lane));
            foe.lane = Math.max(-1.25, Math.min(1.25, foe.lane + step * spec.agility * commit * dt));
          } else {
            const shoulder = foe.side < 0 ? -0.46 : 1.46;
            const far = foe.side < 0 ? -0.16 : 1.16;
            const along = near < 0.46 ? far + (shoulder - far) * (near / 0.46) : shoulder;
            const aimLane = foe.aim ?? lanePos;
            const entry = 0.5 + Math.max(-1, Math.min(1, aimLane)) * SLIDE_AMP;
            const cutT = Math.min(1, Math.max(0, (near - 0.46) / 0.34));
            const cut = cutT * cutT * (3 - 2 * cutT);
            foe.wide = along + (entry - along) * cut;
            foe.lane = (foe.wide - 0.5) / SLIDE_AMP;
          }
          const linger = foe.side !== 0 && foe.z < 0.48 ? 0.58 : 1;
          foe.z += foe.speed * dt * (0.72 + foe.z) * linger;
          if (!foe.struck && foe.z >= 0.9) {
            foe.struck = true;
            if (Math.abs(foe.lane) < 1.35 && Math.abs(foe.lane - lanePos) < spec.reach) hit();
          }
          if (foe.z > 1.2) foes.splice(i, 1);
        }
        for (let i = shots.length - 1; i >= 0; i -= 1) {
          const boltShot = shots[i]!;
          boltShot.t += dt;
          if (boltShot.t < boltShot.dur) continue;
          const foe = foes.find((item) => item.id === boltShot.id);
          shots.splice(i, 1);
          if (!foe) continue;
          foe.hp -= 1;
          foe.hurt = 0.35;
          if (foe.kind === 2) setBossHp(Math.max(0, foe.hp));
          if (foe.hp > 0) {
            crack();
            continue;
          }
          const spot = foeSpot(foe);
          ashes.push({
            kind: foe.kind,
            x: spot.x - spot.w * 0.08,
            y: spot.y - spot.h * 0.06,
            w: spot.w * 1.16,
            h: spot.h * 1.12,
            t: 0,
            life: foe.kind === 2 ? 2.1 : 1.45,
          });
          foes.splice(foes.indexOf(foe), 1);
          const vid = foe.kind === 0 ? ashFallen : foe.kind === 1 ? ashBrute : bossAsh;
          try {
            vid.currentTime = foe.kind === 2 ? 0.4 : 0.9;
          } catch {
            /* not seekable yet */
          }
          vid.playbackRate = foe.kind === 2 ? 1.15 : 1.7;
          playSafe(vid);
          crack();
          if (foe.kind === 2) openGates();
        }
        if (!shots.length && !howlVid.paused) howlVid.pause();
        for (let i = ashes.length - 1; i >= 0; i -= 1) {
          ashes[i]!.t += dt;
          if (ashes[i]!.t >= ashes[i]!.life) ashes.splice(i, 1);
        }
        if (Math.floor(distance) !== Math.floor(distance - 14 * dt)) paintHud();

        const lead = roads[activeRoad]!;
        const next = roads[1 - activeRoad]!;
        const roadRate = 1;
        if (lead.playbackRate !== roadRate) lead.playbackRate = roadRate;
        if (lead.duration && lead.currentTime > lead.duration - 0.35 && next.paused) {
          try {
            next.currentTime = 0;
          } catch {
            /* ignore */
          }
          playSafe(next);
        }
        if (
          lead.duration &&
          (lead.ended || lead.currentTime > lead.duration - 0.04) &&
          next.readyState >= 2 &&
          next.currentTime > 0.01
        ) {
          lead.pause();
          try {
            lead.currentTime = 0;
          } catch {
            /* ignore */
          }
          activeRoad = 1 - activeRoad;
        }
        if (lead.paused && !lead.ended) playSafe(lead);
        const shown = roads[activeRoad]!;
        for (const wing of wings) {
          if (wing.playbackRate !== roadRate) wing.playbackRate = roadRate;
          if (wing.paused) playSafe(wing);
          if (shown.readyState >= 2 && wing.readyState >= 2 && wing.duration && shown.currentTime < 0.08 && wing.currentTime > 0.4) {
            try {
              wing.currentTime = 0;
            } catch {
              /* seek during decode */
            }
          }
        }
        if (bolt.playbackRate !== BOLT_RATE) bolt.playbackRate = BOLT_RATE;
        if (bolt.paused) playSafe(bolt);
        foeClips.forEach((video, index) => {
          const rate = FOE_KIND[index]!.rate;
          if (video.playbackRate !== rate) video.playbackRate = rate;
          if (video.paused) playSafe(video);
        });
        for (let i = trail.length - 1; i >= 0; i -= 1) {
          trail[i]!.age += dt;
          if (trail[i]!.age > 0.62) trail.splice(i, 1);
        }
        const lastMark = trail[trail.length - 1];
        if (!lastMark || lastMark.age > 0.028) trail.push({ lane: lanePos, age: 0 });
      }
      if (phaseRef.current === "citadel") {
        if (doorMode !== "map" && !drag) {
          let steer = steerOverride ?? 0;
          if (steerOverride == null) {
            if (keys.has("KeyA") || keys.has("ArrowLeft")) steer += 1;
            if (keys.has("KeyD") || keys.has("ArrowRight")) steer -= 1;
          }
          steer = Math.max(-1, Math.min(1, steer));
          lanePos = Math.max(-1, Math.min(1, lanePos - steer * 3.4 * dt));
          if (doorMode === "room") {
            if (keys.has("KeyW") || keys.has("ArrowUp")) depthTarget = Math.min(1, depthTarget + dt * 0.55);
            if (keys.has("KeyS") || keys.has("ArrowDown")) depthTarget = Math.max(0, depthTarget - dt * 0.55);
          }
        }
        const clipT = (video: HTMLVideoElement) => {
          const span = video.duration || 10;
          if (video.ended) return 1;
          return Math.min(1, Math.max(0, video.currentTime / span));
        };
        const ease = (a: number, b: number, x: number) => {
          const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
          return t * t * (3 - 2 * t);
        };
        let gait = BOLT_RATE;
        if (doorMode === "ride") {
          const t = clipT(citadel);
          const k = Math.pow(1 - t, 1.05);
          gait = 2.35 + (BOLT_RATE - 2.35) * k;
        } else if (doorMode === "open") {
          const t = clipT(openVid);
          const surge = ease(0.2, 0.45, t) * (1 - ease(0.7, 0.92, t));
          gait = 2.45 + surge * 0.75;
        } else if (doorMode === "hall") {
          const t = clipT(hall);
          gait = 1.85 + (2.5 - 1.85) * Math.pow(1 - t, 1.05);
        } else if (doorMode === "room") {
          gait = Math.abs(depthTarget - roomDepth) > 0.03 ? 1.7 : 1.15;
        } else if (doorMode === "out") {
          gait = outArrived ? 1.15 : 2.35;
        } else {
          gait = 1.15;
        }
        if (doorMode !== "map") {
          if (Math.abs(bolt.playbackRate - gait) > 0.04) bolt.playbackRate = gait;
          if (bolt.paused) playSafe(bolt);
        }
        if (doorMode === "ride") {
          if (!doorsLive && citadel.paused && !citadel.ended) playSafe(citadel);
          if (!doorsLive && (citadel.ended || (citadel.duration > 0 && citadel.currentTime > citadel.duration - 0.4))) {
            doorsLive = true;
            setDoorsReady(true);
          }
        } else if (doorMode === "open") {
          if (openVid.paused && !openVid.ended) playSafe(openVid);
          if (!cardShown && (openVid.ended || (openVid.duration > 0 && openVid.currentTime > openVid.duration - 0.45))) {
            cardShown = true;
            doorMode = "hall";
            roomDepth = 0;
            depthTarget = 0;
            try {
              hall.currentTime = 0;
            } catch {
              /* not seekable yet */
            }
            hall.loop = false;
            playSafe(hall);
          }
        } else if (doorMode === "hall") {
          if (hall.paused && !hall.ended) playSafe(hall);
          if (hall.ended || (hall.duration > 0 && hall.currentTime > hall.duration - 0.35)) {
            doorMode = "room";
            setRoomLive(true);
            try {
              breath.currentTime = 0;
            } catch {
              /* not seekable yet */
            }
            breath.loop = true;
            playSafe(breath);
          }
        } else if (doorMode === "room") {
          if (breath.paused) playSafe(breath);
          const looking = orbitDrag || Math.abs(orbit) > 0.04;
          if (looking) {
            lanePos = 0;
            depthTarget = 0;
            roomDepth = 0;
          }
          const step = 0.42 * dt;
          if (roomDepth < depthTarget) roomDepth = Math.min(depthTarget, roomDepth + step);
          else roomDepth = Math.max(depthTarget, roomDepth - step);
          const follow = 1 - Math.exp(-dt * 2.2);
          if (orbitDrag) orbit = orbitTarget;
          else orbit += (orbitTarget - orbit) * follow;
          const nearMid = roomDepth > 0.68 && Math.abs(orbit) < 0.22 && !orbitDrag;
          if (nearMid !== portalHint) {
            portalHint = nearMid;
            setPortalReady(nearMid);
          }
        } else if (doorMode === "out") {
          if (!vistaHold && exitVid.paused && !exitVid.ended) playSafe(exitVid);
          const span = exitVid.duration || 10;
          let t = exitVid.ended ? 1 : Math.min(1, Math.max(0, exitVid.currentTime / span));
          if (vistaHold) t = 1;
          outArrived = vistaHold || exitVid.ended || t > 0.84;
          outHide = !vistaHold && !outArrived && t > 0.4 && t < 0.64;
          thunderOn = t >= 0.64;
          const settled = vistaHold || outArrived;
          if (settled && !plainVid.paused) plainVid.pause();
          if (settled) {
            if (!plainNoted) {
              plainNoted = true;
              setPlainLive(true);
              if (!drag) {
                depthTarget = 0.06;
                roomDepth = 0.06;
              }
            }
          } else {
            depthTarget = t < 0.64 ? 1 : 0.06;
          }
          if (thunderOn && !thunderArmed && !vistaHold) {
            thunderArmed = true;
            boltThunderRise.loop = false;
            try {
              boltThunderRise.currentTime = 0;
            } catch {
              /* not seekable yet */
            }
            playSafe(boltThunderRise);
          }
          depthTarget = settled ? depthTarget : t < 0.64 ? 1 : 0.06;
          if (!(settled && drag)) {
            const step = settled ? 1.8 * dt : 2.4 * dt;
            if (roomDepth < depthTarget) roomDepth = Math.min(depthTarget, roomDepth + step);
            else roomDepth = Math.max(depthTarget, roomDepth - step);
          }
          if (outArrived && breath.paused) playSafe(breath);
          const follow = 1 - Math.exp(-dt * (chase ? 4.5 : 6));
          const gap = Math.abs(wrapAng(selfAng - orbit));
          if (profileGo && !chase) profileAge += dt;
          else if (!profileGo && !chase) profileAge = 0;
          if (profileGo && profileAge > 0.7) {
            chase = true;
            orbitDrag = false;
            orbitTarget = selfAng;
          }
          if (orbitDrag) orbit = orbitTarget;
          else orbit += wrapAng((chase || gap > 0.08 ? selfAng : orbitTarget) - orbit) * follow;
          if (settled && !orbitDrag) {
            if (profileGo) {
              plateWish = 1.25;
              plainPush = "run";
            }
            const wish = (drag && drag.axis === "ns" && !drag.arc) || profileGo ? plateWish : 0;
            plateV += (wish - plateV) * (1 - Math.exp(-dt * 5));
            if (Math.abs(plateV) < 0.02 && wish === 0) plateV = 0;
            plateOffset += plateV * dt;
            const scrolled = (plateV * dt) / GROUND.tileMeters;
            worldX += -Math.sin(selfAng) * scrolled;
            worldZ += Math.cos(selfAng) * scrolled;
            if (!orbitDrag && !profileGo && gap <= 0.08) {
              const tau = Math.PI * 2;
              let folded = ((orbit % tau) + tau) % tau;
              if (folded > Math.PI) folded -= tau;
              selfAng += folded - orbit;
              orbit = folded;
              orbitTarget = orbit;
              if (!drag) chase = false;
            }
            if (!(drag && drag.axis === "ns")) {
              if (profileGo) plainPush = "run";
              else plainPush = plateV > 0.08 ? "run" : plateV < -0.12 ? "back" : null;
            }
          } else if (!drag) {
            plateV = 0;
            plateWish = 0;
          }
        } else if (!mapHop) {
          if (holo.paused && !holo.ended) playSafe(holo);
          if (holo.ended || (holo.duration > 0 && holo.currentTime > holo.duration - 0.4)) {
            mapHop = true;
            const dest = new URL(STAR_MAP);
            dest.searchParams.set("return", roomReturnUrl());
            window.location.replace(dest.toString());
          }
        }
      }

      const road = roads[activeRoad]!;
      const roadSource = road.readyState >= 2 ? road : poster.complete ? poster : null;
      const roomWalking = doorMode === "room" && Math.abs(depthTarget - roomDepth) > 0.03 && yaw === "back" && !turnTo && !runHold;
      const wantIdle =
        !runHold &&
        (turnTo !== null ||
          (phaseRef.current === "citadel" &&
            doorMode !== "map" &&
            !roomWalking &&
            (doorMode === "room" || (doorMode === "ride" && doorsLive) || (doorMode === "out" && outArrived))));
      if (turnTo) {
        turnAge += dt;
        const clip = turnClip(turnTo, turnSide);
        const ready = clip.readyState >= 2 && clip.duration > 0;
        const done = ready && (clip.ended || clip.currentTime > clip.duration - 0.08);
        if (done) {
          yaw = turnTo;
          turnTo = null;
          turnAge = 0;
          const next = yaw === "face" ? boltFace : boltIdle;
          try {
            next.currentTime = 0;
          } catch {
            /* not seekable yet */
          }
          playSafe(next);
        } else if (turnAge > 8 || clip.error) {
          turnTo = null;
          turnAge = 0;
        }
      }
      const liveTurn = turnTo;
      const turnLive = liveTurn !== null && turnClip(liveTurn, turnSide).readyState >= 2;
      let pose = turnLive && liveTurn ? turnClip(liveTurn, turnSide) : yaw === "face" && doorMode === "room" ? boltFace : boltIdle;
      let orbitMate: HTMLVideoElement | null = null;
      let orbitMix = 1;
      orbitHold = doorMode === "room" && Math.abs(orbit) > 0.04;
      if (orbitHold) {
        pose = boltIdle;
        breathMix = 1;
        yaw = "back";
      }
      if (wantIdle && !idleOn && boltIdle.readyState >= 2 && Math.abs(bolt.currentTime - BREATH_AT) < 0.08) {
        try {
          boltIdle.currentTime = 0;
        } catch {
          /* not seekable yet */
        }
        breathMix = 1;
      }
      if (!wantIdle && idleOn && breathMix > 0.65) {
        try {
          bolt.currentTime = BREATH_AT;
        } catch {
          /* not seekable yet */
        }
      }
      idleOn = wantIdle;
      const breathStep = dt / 0.2;
      breathMix = Math.max(0, Math.min(1, breathMix + (wantIdle ? breathStep : -breathStep)));
      if (runHold) breathMix = 0;
      if (orbitHold) breathMix = 1;
      if (thunderOn) {
        if (thunderTurn) {
          thunderTurnAge += dt;
          if (thunderTurn.currentTime > 0.4) thunderTurnSeenStart = true;
          const spinDur = thunderTurn.duration || 0;
          const atEnd =
            thunderTurnSeenStart &&
            (thunderTurn.ended ||
              (spinDur > 0 && thunderTurn.currentTime > spinDur - 0.15) ||
              (spinDur > 0 && thunderTurnAge > spinDur - 0.12) ||
              thunderTurnAge > 6.2);
          const rewound = thunderTurnSeenStart && thunderTurn.paused && thunderTurn.currentTime < 0.12 && thunderTurnAge > 0.8;
          if (atEnd || rewound) {
            thunderFace = thunderTurnTo;
            try {
              if (spinDur > 0.2) thunderTurn.currentTime = Math.max(0.05, spinDur - 0.05);
            } catch {
              /* not seekable yet */
            }
            thunderTurn.pause();
            thunderTurn = null;
            thunderTurnAge = 0;
            thunderTurnSeenStart = false;
          }
        }
        const riseDone =
          vistaHold ||
          (boltThunderRise.readyState >= 2 &&
            boltThunderRise.duration > 0 &&
            (boltThunderRise.ended || boltThunderRise.currentTime > boltThunderRise.duration - 0.12));
        const nextPose =
          thunderTurn && thunderTurn.readyState >= 2
            ? thunderTurn
            : plainPush === "run" && thunderFace === "back" && boltThunderRun.readyState >= 2
              ? boltThunderRun
              : plainPush === "back" && thunderFace === "back" && boltThunderBackstep.readyState >= 2
                ? boltThunderBackstep
                : thunderFace === "face"
                  ? boltThunderFace.readyState >= 2
                    ? boltThunderFace
                    : thunderHold
                  : !riseDone && boltThunderRise.readyState >= 2
                    ? boltThunderRise
                    : boltThunder.readyState >= 2
                      ? boltThunder
                      : null;
        if (nextPose) thunderHold = nextPose;
        if (thunderHold) pose = thunderHold;
        if (pose === boltThunderRun || pose === boltThunderRunLeft || pose === boltThunderRunRight || pose === boltThunderBackstep) {
          const gait = gaitFor(plateV);
          if (Math.abs(pose.playbackRate - gait) > 0.04) pose.playbackRate = gait;
        }
        const plainNow = doorMode === "out" && (vistaHold || outArrived);
        if (plainNow && !thunderTurn) {
          const ang = (((selfAng - orbit) % TAU) + TAU) % TAU;
          const views = [boltThunder, boltThunderLeftIdle, boltThunderFace, boltThunderRightIdle];
          const step = TAU / 4;
          const u = ang / step;
          const i = Math.floor(u) % 4;
          const f = u - Math.floor(u);
          const moving = profileGo || plainPush === "run" || Math.abs(plateV) > 0.08;
          if (moving && boltThunderRun.readyState >= 2) {
            const dBack = Math.min(ang, TAU - ang);
            const dLeft = Math.abs(ang - Math.PI / 2);
            const dRight = Math.abs(ang - Math.PI * 1.5);
            pose =
              dLeft <= dBack && dLeft <= dRight && boltThunderRunLeft.readyState >= 2
                ? boltThunderRunLeft
                : dRight < dBack && boltThunderRunRight.readyState >= 2
                  ? boltThunderRunRight
                  : boltThunderRun;
            thunderHold = pose;
            orbitMate = null;
            orbitMix = 1;
          } else if ((ang < 0.55 || ang > TAU - 0.55) && plainPush === "back" && boltThunderBackstep.readyState >= 2) {
            pose = boltThunderBackstep;
            thunderHold = pose;
          } else if (views[i]!.readyState >= 2) {
            const blend = 0.32;
            const t = f > 1 - blend ? (f - (1 - blend)) / blend : 0;
            const eased = t * t * (3 - 2 * t);
            const next = views[(i + 1) % 4]!;
            pose = views[i]!;
            thunderHold = pose;
            orbitMate = eased > 0.02 && next.readyState >= 2 ? next : null;
            orbitMix = orbitMate ? eased : 0;
          }
        }
        breathMix = 1;
        yaw = "back";
      } else thunderHold = null;
      if (orbitHold) {
        if (boltIdle.paused) playSafe(boltIdle);
      } else if (pose.paused) {
        const spin =
          pose === boltThunderRight ||
          pose === boltThunderRightBack ||
          pose === boltThunderLeft ||
          pose === boltThunderLeftBack;
        const dur = pose.duration || 0;
        const atSpinEnd = pose.ended || pose.currentTime < 0.08 || (dur > 0 && pose.currentTime > dur - 0.12);
        if (!spin || (!atSpinEnd && pose.currentTime > 0.08)) playSafe(pose);
      }
      if (orbitMate && orbitMate.paused) playSafe(orbitMate);
      const onPlain = doorMode === "out" && (vistaHold || outArrived);
      if (onPlain) {
        for (const clip of [plainVid, plainLeftLive, plainRightLive, roadA, roadB, wingL, wingR, fallen, brute, boss, bolt, breath, exitVid, howlVid]) {
          if (!clip.paused) clip.pause();
        }
        idleRefs.current.forEach((clip) => {
          if (clip && !clip.paused) clip.pause();
        });
        const thunderClips = [boltThunder, boltThunderRise, boltThunderRun, boltThunderRunLeft, boltThunderRunRight, boltThunderBackstep, boltThunderFace, boltThunderRight, boltThunderRightBack, boltThunderLeft, boltThunderLeftBack, boltThunderRightIdle, boltThunderLeftIdle];
        for (const clip of thunderClips) {
          if (clip !== pose && clip !== orbitMate && !clip.paused) clip.pause();
        }
        if (groundVid.paused) playSafe(groundVid);
      }
      if (!onPlain && !groundVid.paused) groundVid.pause();
      if (!onPlain && roadSource) {
        if (roadSource instanceof HTMLVideoElement) uploadVideo(gl, roadTex, roadSource);
        else upload(gl, roadTex, roadSource);
      }
      if (!onPlain && bolt.readyState >= 2) uploadVideo(gl, boltTex, bolt);
      if (thunderOn) {
        if (orbitMix < 1 && pose.readyState >= 2) uploadVideo(gl, boltTex, pose);
        const mate = orbitMate ?? thunderHold;
        if (mate && mate.readyState >= 2) uploadVideo(gl, boltIdleTex, mate);
      } else if (!onPlain && pose.readyState >= 2) uploadVideo(gl, boltIdleTex, pose);
      else if (!onPlain && boltIdle.readyState >= 2) uploadVideo(gl, boltIdleTex, boltIdle);
      if (!onPlain) {
        if (fallen.readyState >= 2) uploadVideo(gl, foeTex[0]!, fallen);
        if (brute.readyState >= 2) uploadVideo(gl, foeTex[1]!, brute);
        if (boss.readyState >= 2) uploadVideo(gl, foeTex[2]!, boss);
        if (howlVid.readyState >= 2) uploadVideo(gl, howlTex, howlVid);
        if (ashFallen.readyState >= 2) uploadVideo(gl, ashTex[0]!, ashFallen);
        if (ashBrute.readyState >= 2) uploadVideo(gl, ashTex[1]!, ashBrute);
        if (bossAsh.readyState >= 2) uploadVideo(gl, ashTex[2]!, bossAsh);
        if (wingL.readyState >= 2) uploadVideo(gl, wingLTex, wingL);
        if (wingR.readyState >= 2) uploadVideo(gl, wingRTex, wingR);
      }
      let camFrame: HTMLImageElement | null = null;
      let sideLive: HTMLVideoElement | null = null;
      const lookingOut = !onPlain && doorMode === "out" && (vistaHold || outArrived) && Math.abs(orbit) > 0.05;
      if (lookingOut) {
        const parked = !orbitDrag && Math.abs(Math.abs(orbit) - SIDE) < 0.16;
        const live = orbit >= 0 ? plainLeftLive : plainRightLive;
        if (parked && live.readyState >= 2) {
          if (live.paused) playSafe(live);
          sideLive = live;
        } else {
          const seq = orbit >= 0 ? plainLeft : plainRight;
          const shot = shotAt(seq, Math.min(0.999, Math.abs(orbit) / SIDE));
          if (shot) camFrame = shot;
        }
      }
      const walked = onPlain || lookingOut ? null : gridFrame();
      if (!camFrame && !sideLive && walked) camFrame = walked;
      let pathLive: HTMLVideoElement | null = null;
      if (!onPlain && !drag && !lookingOut && !sideLive && doorMode === "out" && (vistaHold || outArrived) && Math.abs(gx - 1) < 0.28 && gy > 0.08) {
        let best = 0;
        let bestDist = 1e9;
        IDLE_LIVE.forEach((spot, index) => {
          const dist = (gx - spot.x) * (gx - spot.x) + (gy - spot.y) * (gy - spot.y);
          if (dist < bestDist) {
            bestDist = dist;
            best = index;
          }
        });
        const live = idleRefs.current[best];
        if (live && live.readyState >= 2 && bestDist < 0.2) {
          if (live.paused) playSafe(live);
          pathLive = live;
          camFrame = null;
        }
        idleRefs.current.forEach((clip) => {
          if (clip && clip !== pathLive && !clip.paused) clip.pause();
        });
      }
      const orbitSeq =
        lookingOut || walked
          ? null
          : doorMode === "room" && Math.abs(orbit) > 0.06
          ? orbit >= 0
            ? leftSide
            : rightSide
          : null;
      if (!onPlain && !lookingOut && !walked && doorMode === "out" && (vistaHold || outArrived) && Math.abs(orbit) > SIDE * 0.62) {
        const along = shotAt(orbit > 0 ? plainGoL : plainGoR, roomDepth);
        if (along) camFrame = along;
      }
      if (!camFrame && orbitSeq) {
        const local = Math.min(0.999, Math.abs(orbit) / SIDE);
        const idx = Math.min(orbitSeq.length - 1, Math.floor(local * orbitSeq.length));
        let img: HTMLImageElement | undefined;
        for (let i = idx; i >= 0; i--) {
          const shot = orbitSeq[i];
          if (shot && shot.complete && shot.naturalWidth > 0) {
            img = shot;
            break;
          }
        }
        if (img) camFrame = img;
      }
      const plate =
        phaseRef.current !== "citadel"
          ? null
          : doorMode === "ride"
            ? citadel
            : doorMode === "open"
              ? openVid
              : doorMode === "hall"
                ? hall.readyState >= 2
                  ? hall
                  : openVid
                : doorMode === "map"
                  ? holo.readyState >= 2
                    ? holo
                    : breath
                  : doorMode === "out"
                    ? (vistaHold || outArrived) && plainVid.readyState >= 2
                      ? plainVid
                      : exitVid.readyState >= 2 && (!vistaHold || exitVid.currentTime > (exitVid.duration || 10) * 0.85)
                        ? exitVid
                        : vistaHold
                          ? null
                          : breath
                    : breath.readyState >= 2
                      ? breath
                      : hall;
      const shown = plate;
      if (!onPlain && camFrame) upload(gl, citadelTex, camFrame);
      else if (!onPlain && sideLive && sideLive.readyState >= 2) uploadVideo(gl, citadelTex, sideLive);
      else if (!onPlain && pathLive && pathLive.readyState >= 2) uploadVideo(gl, citadelTex, pathLive);
      else if (!onPlain && shown && shown.readyState >= 2) uploadVideo(gl, citadelTex, shown);
      if (!roomPlates && roomLeft.complete && roomRight.complete && roomBack.complete && roomLeft.naturalWidth > 0) {
        upload(gl, roomLeftTex, roomLeft);
        upload(gl, roomRightTex, roomRight);
        upload(gl, roomBackTex, roomBack);
        roomPlates = true;
      }
      if (!onPlain && far.complete && far.naturalWidth > 0) upload(gl, farTex, far);
      const wingsReady = wingL.readyState >= 2 && wingR.readyState >= 2;
      const shift = lookShift(glance, wingsReady);
      viewShift = shift;

      const pinchZoom = doorMode === "out" ? zoom : 1;
      frameZoom = pinchZoom;
      frameFocusY = 0;

      const paintRoad = () => {
        gl.disable(gl.BLEND);
        gl.useProgram(roadProg);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, roadTex);
        gl.uniform1i(gl.getUniformLocation(roadProg, "uRoad"), 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, wingLTex);
        gl.uniform1i(gl.getUniformLocation(roadProg, "uSideL"), 1);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, wingRTex);
        gl.uniform1i(gl.getUniformLocation(roadProg, "uSideR"), 2);
        gl.uniform1f(gl.getUniformLocation(roadProg, "uGlance"), glance);
        gl.uniform1f(gl.getUniformLocation(roadProg, "uWings"), wingsReady ? 1 : 0);
        gl.uniform1f(gl.getUniformLocation(roadProg, "uFlash"), flash);
        gl.uniform1f(gl.getUniformLocation(roadProg, "uAlpha"), 1);
        gl.uniform1f(gl.getUniformLocation(roadProg, "uApproach"), 0);
        gl.activeTexture(gl.TEXTURE0);
        drawBuffer(FULL);
      };
      const onBlack = doorMode === "out" && (vistaHold || outArrived);
      if (onBlack) {
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        if (skyVids[0].readyState >= 2) {
          const band = SKY.band;
          const bandAspect = canvas.width / Math.max(1, canvas.height) / band;
          const vidAspect = skyVids[0].videoWidth > 0 ? skyVids[0].videoWidth / skyVids[0].videoHeight : 9 / 16;
          const span = SKY.span;
          const vSpan = Math.min(0.9, (vidAspect * span) / Math.max(0.2, bandAspect));
          const v1 = SKY.v1;
          const v0 = Math.max(0, v1 - vSpan);
          const ang = (((0.125 - orbit / TAU) % 1) + 1) % 1;
          const slice = ang * SKY.faces;
          const faceA = Math.floor(slice) % SKY.faces;
          const f = slice - Math.floor(slice);
          const u0 = (1 - span) * f;
          const fadeStart = 1 - SKY.fadeDeg / (360 / SKY.faces);
          let faceB = faceA;
          let u1 = u0;
          let mixB = 0;
          if (f > fadeStart) {
            faceB = (faceA + 1) % SKY.faces;
            const t = (f - fadeStart) / (1 - fadeStart);
            mixB = t * t * (3 - 2 * t);
            u1 = (1 - span) * (1 - f) * SKY.lead;
          }
          for (let i = 0; i < 4; i += 1) {
            const vid = skyVids[i]!;
            if (vid.paused) playSafe(vid);
            gl.activeTexture(gl.TEXTURE0 + i);
            if (vid.readyState >= 2) uploadVideo(gl, skyTex[i]!, vid);
            else gl.bindTexture(gl.TEXTURE_2D, skyTex[i]!);
          }
          gl.disable(gl.BLEND);
          gl.useProgram(skyProg);
          gl.uniform1i(gl.getUniformLocation(skyProg, "u0"), 0);
          gl.uniform1i(gl.getUniformLocation(skyProg, "u1"), 1);
          gl.uniform1i(gl.getUniformLocation(skyProg, "u2"), 2);
          gl.uniform1i(gl.getUniformLocation(skyProg, "u3"), 3);
          gl.uniform1f(gl.getUniformLocation(skyProg, "uA"), faceA);
          gl.uniform1f(gl.getUniformLocation(skyProg, "uB"), faceB);
          gl.uniform1f(gl.getUniformLocation(skyProg, "uMix"), mixB);
          gl.uniform1f(gl.getUniformLocation(skyProg, "uU0"), u0);
          gl.uniform1f(gl.getUniformLocation(skyProg, "uU1"), u1);
          gl.uniform1f(gl.getUniformLocation(skyProg, "uSpan"), span);
          gl.uniform1f(gl.getUniformLocation(skyProg, "uV0"), v0);
          gl.uniform1f(gl.getUniformLocation(skyProg, "uV1"), v1);
          gl.activeTexture(gl.TEXTURE0);
          drawBuffer(quad(0, 0, 1, band));
        }
        gl.activeTexture(gl.TEXTURE0);
        if (groundVid.readyState >= 2) uploadVideo(gl, pathTex, groundVid);
        else if (pathImg.complete && pathImg.naturalWidth > 0) upload(gl, pathTex, pathImg);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(rockProg);
        gl.bindTexture(gl.TEXTURE_2D, pathTex);
        gl.uniform1i(gl.getUniformLocation(rockProg, "uPath"), 0);
        gl.uniform1f(gl.getUniformLocation(rockProg, "uWorldX"), worldX);
        gl.uniform1f(gl.getUniformLocation(rockProg, "uWorldZ"), worldZ);
        gl.uniform1f(gl.getUniformLocation(rockProg, "uYaw"), orbit);
        gl.uniform1f(gl.getUniformLocation(rockProg, "uXMul"), groundXMul);
        gl.uniform1f(gl.getUniformLocation(rockProg, "uHorizon"), groundHorizon);
        gl.uniform1f(gl.getUniformLocation(rockProg, "uFade0"), groundFade0);
        gl.uniform1f(gl.getUniformLocation(rockProg, "uFade1"), groundFade1);
        gl.uniform1f(gl.getUniformLocation(rockProg, "uPivot"), boltPivot);
        drawBuffer(FULL);
      } else if (camFrame && doorMode === "room") {
        gl.disable(gl.BLEND);
        gl.useProgram(gateProg);
        gl.bindTexture(gl.TEXTURE_2D, citadelTex);
        gl.uniform1i(gl.getUniformLocation(gateProg, "uTex"), 0);
        gl.uniform1f(gl.getUniformLocation(gateProg, "uAlpha"), 1);
        gl.uniform1f(gl.getUniformLocation(gateProg, "uV0"), 0);
        gl.uniform1f(gl.getUniformLocation(gateProg, "uV1"), 1);
        gl.uniform1f(gl.getUniformLocation(gateProg, "uMask"), 0);
        drawBuffer(FULL);
      } else if (plate && plate.readyState >= 2) {
        gl.disable(gl.BLEND);
        gl.useProgram(gateProg);
        gl.bindTexture(gl.TEXTURE_2D, citadelTex);
        gl.uniform1i(gl.getUniformLocation(gateProg, "uTex"), 0);
        gl.uniform1f(gl.getUniformLocation(gateProg, "uAlpha"), 1);
        gl.uniform1f(gl.getUniformLocation(gateProg, "uV0"), 0);
        gl.uniform1f(gl.getUniformLocation(gateProg, "uV1"), 1);
        gl.uniform1f(gl.getUniformLocation(gateProg, "uMask"), 0);
        drawBuffer(FULL);
      } else if (phaseRef.current === "citadel") {
        gl.disable(gl.BLEND);
        gl.useProgram(gateProg);
        gl.bindTexture(gl.TEXTURE_2D, citadelTex);
        gl.uniform1i(gl.getUniformLocation(gateProg, "uTex"), 0);
        gl.uniform1f(gl.getUniformLocation(gateProg, "uAlpha"), 1);
        gl.uniform1f(gl.getUniformLocation(gateProg, "uV0"), 0);
        gl.uniform1f(gl.getUniformLocation(gateProg, "uV1"), 1);
        gl.uniform1f(gl.getUniformLocation(gateProg, "uMask"), 0);
        drawBuffer(FULL);
      } else if (roadSource) paintRoad();

      const aspect = canvas.width / canvas.height;
      const placed =
        phaseRef.current === "cover"
          ? []
          : foes
              .map((foe) => {
                const spot = foeSpot(foe);
                const near = Math.min(1, Math.max(0, foe.z));
                const alpha = foe.z > 1 ? Math.max(0, 1 - (foe.z - 1) / 0.18) : 1;
                const threat = near > 0.42 && Math.abs(foe.lane - lanePos) < FOE_KIND[foe.kind].reach ? near : 0;
                return { foe, ...spot, alpha, threat };
              })
              .sort((a, b) => a.foe.z - b.foe.z);

      const drawFoes = (inFront: boolean) => {
        for (const spot of placed) {
          if ((spot.foe.z >= 0.82) !== inFront) continue;
          const clip = foeClips[spot.foe.kind];
          if (!clip || clip.readyState < 2 || spot.alpha < 0.04) continue;
          gl.useProgram(shadowProg);
          const shadowW = spot.w * 0.46;
          const shadowH = Math.max(0.008, spot.h * 0.035);
          drawBuffer(quad(spot.footX - shadowW / 2, spot.footY - shadowH * 0.25, shadowW, shadowH));
          gl.useProgram(enemyProg);
          gl.bindTexture(gl.TEXTURE_2D, foeTex[spot.foe.kind]!);
          gl.uniform1i(gl.getUniformLocation(enemyProg, "uTex"), 0);
          gl.uniform1f(gl.getUniformLocation(enemyProg, "uFlash"), flash + (spot.foe.kind === 2 ? spot.foe.hurt * 0.35 : 0));
          gl.uniform1f(gl.getUniformLocation(enemyProg, "uThreat"), spot.foe.kind === 2 ? 0 : spot.threat);
          gl.uniform1f(gl.getUniformLocation(enemyProg, "uAlpha"), spot.alpha);
          drawBuffer(quad(spot.x, spot.y, spot.w, spot.h));
        }
      };

      gl.enable(gl.BLEND);
      frameZoom = pinchZoom;
      frameFocusY = 0;
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      drawFoes(false);

      if (!outHide && phaseRef.current !== "cover" && doorMode !== "map" && !(thunderOn && !thunderHold) && (bolt.readyState >= 2 || boltIdle.readyState >= 2 || thunderHold)) {
        const box = boltBox();
        const thunderPlate =
          pose === boltThunder ||
          pose === boltThunderRise ||
          pose === boltThunderRight ||
          pose === boltThunderRightBack ||
          pose === boltThunderLeft ||
          pose === boltThunderLeftBack ||
          pose === boltThunderRightIdle ||
          pose === boltThunderLeftIdle ||
          pose === boltThunderRun ||
          pose === boltThunderRunLeft ||
          pose === boltThunderRunRight ||
          pose === boltThunderBackstep ||
          pose === boltThunderFace;
        const turningPlate =
          pose === boltTurn || pose === boltTurnBack || pose === boltTurnLeft || pose === boltTurnLeftBack;
        const fit = thunderPlate ? THUNDER_FIT : turningPlate && pose.readyState >= 2 ? TURN_FIT : 1;
        gl.useProgram(shadowProg);
        const pawX = box.x + box.w / 2;
        const shadowW = box.w * 0.42 * fit;
        const shadowH = box.h * 0.04 * fit;
        const shadowY = box.footY - shadowH * 0.35;
        drawBuffer(quad(pawX - shadowW / 2, shadowY, shadowW, shadowH));
        gl.useProgram(boltProg);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, boltTex);
        gl.uniform1i(gl.getUniformLocation(boltProg, "uTex"), 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, boltIdleTex);
        gl.uniform1i(gl.getUniformLocation(boltProg, "uTexB"), 1);
        gl.uniform1f(gl.getUniformLocation(boltProg, "uFlash"), flash);
        gl.uniform1f(gl.getUniformLocation(boltProg, "uTime"), now * 0.001);
        gl.uniform1f(gl.getUniformLocation(boltProg, "uBreath"), thunderOn ? orbitMix : boltIdle.readyState >= 2 ? breathMix : 0);
        gl.activeTexture(gl.TEXTURE0);
        const paw = thunderPlate ? 0.97 : PAW_V;
        const dw = box.w * fit;
        const dh = box.h * fit;
        const dx = box.x + box.w / 2 - dw / 2;
        const dy = box.footY - paw * dh;
        drawBuffer(quad(dx, dy, dw, dh));
      }

      if (shots.length && howlVid.readyState >= 2) {
        const mouthX = 0.5 + lanePos * SLIDE_AMP - shift;
        const mouthY = PLANT_Y - PAW_V * BOLT_H + BOLT_H * 0.18;
        gl.useProgram(howlProg);
        gl.bindTexture(gl.TEXTURE_2D, howlTex);
        gl.uniform1i(gl.getUniformLocation(howlProg, "uTex"), 0);
        for (const boltShot of shots) {
          const p = Math.min(1, boltShot.t / boltShot.dur);
          const foe = foes.find((item) => item.id === boltShot.id);
          if (!foe) continue;
          const spot = foeSpot(foe);
          const tipX = spot.footX;
          const tipY = spot.y + spot.h * 0.45;
          const hx = mouthX + (tipX - mouthX) * p;
          const hy = mouthY + (tipY - mouthY) * p;
          gl.uniform1f(gl.getUniformLocation(howlProg, "uReveal"), Math.max(0.12, p));
          drawBuffer(beam(mouthX, mouthY, hx, hy, 0.045 + 0.02 * p));
        }
      }

      if (ashes.length) {
        gl.useProgram(enemyProg);
        for (const ash of ashes) {
          const vid = ash.kind === 0 ? ashFallen : ash.kind === 1 ? ashBrute : bossAsh;
          if (vid.readyState < 2) continue;
          const fade = ash.t > ash.life - 0.3 ? Math.max(0, (ash.life - ash.t) / 0.3) : 1;
          gl.bindTexture(gl.TEXTURE_2D, ashTex[ash.kind]!);
          gl.uniform1i(gl.getUniformLocation(enemyProg, "uTex"), 0);
          gl.uniform1f(gl.getUniformLocation(enemyProg, "uFlash"), flash);
          gl.uniform1f(gl.getUniformLocation(enemyProg, "uThreat"), 0);
          gl.uniform1f(gl.getUniformLocation(enemyProg, "uAlpha"), fade);
          drawBuffer(quad(ash.x, ash.y, ash.w, ash.h));
        }
      }

      drawFoes(true);

      ctx.clearRect(0, 0, fx.width, fx.height);
      if (running) {
        for (const spot of placed) {
          if (spot.threat <= 0 || spot.foe.z > 1) continue;
          ctx.globalAlpha = 0.22 * spot.threat;
          ctx.strokeStyle = "#c4313c";
          ctx.lineWidth = Math.max(1, fx.width * 0.004);
          ctx.beginPath();
          ctx.moveTo(spot.footX * fx.width, HORIZON * fx.height);
          ctx.lineTo(spot.footX * fx.width, spot.footY * fx.height);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    paintHud();
    if (startInRoomRef.current || backToRoom()) enterRoom();

    const api = { begin, atGates: () => openGates(true), atVista: () => enterVista() };
    frame.dataset.ready = "1";
    (frame as HTMLDivElement & { __pyre?: { begin: () => void; atGates: () => void; atVista: () => void } }).__pyre = api;

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      frame.removeEventListener("pointerdown", onSlideDown);
      frame.removeEventListener("pointermove", onSlideMove);
      frame.removeEventListener("pointerup", onSlideUp);
      frame.removeEventListener("pointercancel", onSlideUp);
      frame.removeEventListener("wheel", onWheel);
      if (window.__controlsTest === probe) delete window.__controlsTest;
      for (const vid of skyVids) {
        vid.pause();
        vid.remove();
      }
      groundVid.pause();
      groundVid.remove();
      audio.ctx?.close().catch(() => undefined);
    };
  }, []);

  const pyreApi = () =>
    frameRef.current as (HTMLDivElement & { __pyre?: { begin: () => void; atGates: () => void; atVista: () => void } }) | null;

  const start = () => {
    pyreApi()?.__pyre?.begin();
  };

  const atGates = () => {
    pyreApi()?.__pyre?.atGates();
  };

  const atVista = () => {
    pyreApi()?.__pyre?.atVista();
  };

  return (
    <main className="pyre-root">
      <div className={phase === "run" || phase === "citadel" ? "pyre-frame" : "pyre-frame is-menu"} ref={frameRef}>
        <canvas ref={glRef} className="pyre-gl" />
        <canvas ref={fxRef} className="pyre-fx" />
        <video
          ref={roadARef}
          className="pyre-video"
          src="/master/pyre-road.mp4"
          poster="/master/pyre-first.jpg"
          muted
          playsInline
          preload="auto"
        />
        <video
          ref={roadBRef}
          className="pyre-video"
          src="/master/pyre-road.mp4"
          muted
          playsInline
          preload="auto"
        />
        <video
          ref={boltRef}
          className="pyre-video"
          src="/master/bolt-native.mp4?v=2"
          muted
          playsInline
          disablePictureInPicture
          preload="auto"
        />
        <video
          ref={boltIdleRef}
          className="pyre-video"
          src="/master/bolt-breath.mp4?v=2"
          muted
          loop
          playsInline
          disablePictureInPicture
          preload="auto"
        />
        <video
          ref={boltFaceRef}
          className="pyre-video"
          src="/master/bolt-breath-face.mp4?v=1"
          muted
          loop
          playsInline
          disablePictureInPicture
          preload="auto"
        />
        <video
          ref={boltTurnRef}
          className="pyre-video"
          src="/master/bolt-turn.mp4?v=4"
          muted
          playsInline
          disablePictureInPicture
          preload="auto"
        />
        <video
          ref={boltTurnBackRef}
          className="pyre-video"
          src="/master/bolt-turn-back.mp4?v=4"
          muted
          playsInline
          disablePictureInPicture
          preload="auto"
        />
        <video
          ref={boltTurnLeftRef}
          className="pyre-video"
          src="/master/bolt-turn-left.mp4?v=1"
          muted
          playsInline
          disablePictureInPicture
          preload="auto"
        />
        <video
          ref={boltTurnLeftBackRef}
          className="pyre-video"
          src="/master/bolt-turn-left-back.mp4?v=1"
          muted
          playsInline
          disablePictureInPicture
          preload="auto"
        />
        <video
          ref={boltThunderRef}
          className="pyre-video"
          src="/master/bolt-thunder.mp4?v=1"
          muted
          loop
          playsInline
          disablePictureInPicture
          preload="auto"
        />
        <video
          ref={boltThunderRiseRef}
          className="pyre-video"
          src="/master/bolt-thunder-rise.mp4?v=1"
          muted
          playsInline
          disablePictureInPicture
          preload="auto"
        />
        <video ref={boltThunderRightRef} className="pyre-video" src="/master/bolt-thunder-to-face-r.mp4?v=2" muted playsInline disablePictureInPicture preload="auto" />
        <video ref={boltThunderRightBackRef} className="pyre-video" src="/master/bolt-thunder-to-back-r.mp4?v=2" muted playsInline disablePictureInPicture preload="auto" />
        <video ref={boltThunderLeftRef} className="pyre-video" src="/master/bolt-thunder-to-face-l.mp4?v=2" muted playsInline disablePictureInPicture preload="auto" />
        <video ref={boltThunderLeftBackRef} className="pyre-video" src="/master/bolt-thunder-to-back-l.mp4?v=2" muted playsInline disablePictureInPicture preload="auto" />
        <video ref={boltThunderRightIdleRef} className="pyre-video" src="/master/bolt-thunder-right-idle.mp4?v=1" muted loop playsInline disablePictureInPicture preload="auto" />
        <video ref={boltThunderLeftIdleRef} className="pyre-video" src="/master/bolt-thunder-left-idle.mp4?v=1" muted loop playsInline disablePictureInPicture preload="auto" />
        <video ref={boltThunderRunRef} className="pyre-video" src="/master/bolt-thunder-run.mp4?v=3" muted loop playsInline disablePictureInPicture preload="auto" />
        <video ref={boltThunderRunLeftRef} className="pyre-video" src="/master/bolt-thunder-run-left.mp4?v=1" muted loop playsInline disablePictureInPicture preload="auto" />
        <video ref={boltThunderRunRightRef} className="pyre-video" src="/master/bolt-thunder-run-right.mp4?v=1" muted loop playsInline disablePictureInPicture preload="auto" />
        <video ref={boltThunderBackstepRef} className="pyre-video" src="/master/bolt-thunder-backstep.mp4?v=1" muted loop playsInline disablePictureInPicture preload="auto" />
        <video ref={boltThunderFaceRef} className="pyre-video" src="/master/bolt-thunder-face.mp4?v=1" muted loop playsInline disablePictureInPicture preload="auto" />
        <video
          ref={fallenRef}
          className="pyre-video"
          src="/master/foe-fallen.mp4"
          muted
          playsInline
          disablePictureInPicture
          preload="auto"
        />
        <video
          ref={bruteRef}
          className="pyre-video"
          src="/master/foe-brute.mp4"
          muted
          playsInline
          disablePictureInPicture
          preload="auto"
        />
        <video
          ref={bossRef}
          className="pyre-video"
          src="/master/boss.mp4?v=atk"
          muted
          playsInline
          disablePictureInPicture
          preload="auto"
        />
        <video
          ref={bossAshRef}
          className="pyre-video"
          src="/master/boss-ash.mp4"
          muted
          playsInline
          disablePictureInPicture
          preload="auto"
        />
        <video
          ref={wingLRef}
          className="pyre-video"
          src="/master/pyre-wing-l.mp4"
          muted
          playsInline
          disablePictureInPicture
          preload="auto"
        />
        <video
          ref={wingRRef}
          className="pyre-video"
          src="/master/pyre-wing-r.mp4"
          muted
          playsInline
          disablePictureInPicture
          preload="auto"
        />
        <video
          ref={howlRef}
          className="pyre-video"
          src="/master/howl.mp4"
          muted
          playsInline
          disablePictureInPicture
          preload="auto"
        />
        <video
          ref={ashFallenRef}
          className="pyre-video"
          src="/master/ash-fallen.mp4"
          muted
          playsInline
          disablePictureInPicture
          preload="auto"
        />
        <video
          ref={ashBruteRef}
          className="pyre-video"
          src="/master/ash-brute.mp4"
          muted
          playsInline
          disablePictureInPicture
          preload="auto"
        />
        <video
          ref={gateARef}
          className="pyre-video"
          src="/master/citadel-road.mp4"
          muted
          playsInline
          preload="auto"
        />
        <video
          ref={gateBRef}
          className="pyre-video"
          src="/master/citadel-road.mp4"
          muted
          playsInline
          preload="auto"
        />
        <video
          ref={gateWingLRef}
          className="pyre-video"
          src="/master/citadel-wing-l.mp4"
          muted
          playsInline
          disablePictureInPicture
          preload="auto"
        />
        <video
          ref={gateWingRRef}
          className="pyre-video"
          src="/master/citadel-wing-r.mp4"
          muted
          playsInline
          disablePictureInPicture
          preload="auto"
        />
        <video
          ref={citadelRef}
          className="pyre-video"
          src="/master/citadel-arrive.mp4?v=1"
          muted
          playsInline
          disablePictureInPicture
          preload="auto"
        />
        <video
          ref={openRef}
          className="pyre-video"
          src="/master/citadel-open.mp4?v=1"
          muted
          playsInline
          disablePictureInPicture
          preload="auto"
        />
        <video
          ref={hallRef}
          className="pyre-video"
          src="/master/citadel-hall.mp4?v=1"
          muted
          playsInline
          disablePictureInPicture
          preload="auto"
        />
        <video
          ref={breathRef}
          className="pyre-video"
          src="/master/room-breath.mp4?v=1"
          muted
          playsInline
          loop
          disablePictureInPicture
          preload="auto"
        />
        <video ref={camLeftRef} className="pyre-video" muted playsInline disablePictureInPicture preload="none" />
        <video ref={camRightRef} className="pyre-video" muted playsInline disablePictureInPicture preload="none" />
        <video ref={camLeftBackRef} className="pyre-video" muted playsInline disablePictureInPicture preload="none" />
        <video ref={camRightBackRef} className="pyre-video" muted playsInline disablePictureInPicture preload="none" />
        <video
          ref={holoRef}
          className="pyre-video"
          src="/master/room-holo.mp4?v=2"
          muted
          playsInline
          disablePictureInPicture
          preload="auto"
        />
        <video
          ref={exitRef}
          className="pyre-video"
          src="/master/citadel-exit.mp4?v=1"
          muted
          playsInline
          disablePictureInPicture
          preload="auto"
        />
        <video
          ref={plainRef}
          className="pyre-video"
          src="/master/citadel-plain.mp4?v=1"
          muted
          loop
          playsInline
          disablePictureInPicture
          preload="auto"
        />
        <video ref={plainLeftLiveRef} className="pyre-video" src="/master/plain-left-live.mp4?v=1" muted loop playsInline disablePictureInPicture preload="auto" />
        <video ref={plainRightLiveRef} className="pyre-video" src="/master/plain-right-live.mp4?v=1" muted loop playsInline disablePictureInPicture preload="auto" />
        {IDLE_LIVE.map((spot, index) => (
          <video
            key={spot.src}
            ref={(el) => {
              idleRefs.current[index] = el;
            }}
            className="pyre-video"
            src={spot.src}
            muted
            loop
            playsInline
            disablePictureInPicture
            preload="auto"
          />
        ))}
        <div className="pyre-hud" hidden={phase === "cover"}>
          <div>
            <p className="pyre-paces">
              <span>{paces}</span>
              <small>paces · best {peak}{bossHp > 0 ? ` · ${bossHp} howls` : ""}</small>
            </p>
          </div>
          <div className="pyre-wounds" aria-label="Wounds left">
            {[0, 1, 2].map((mark) => (
              <i key={mark} className={mark < 3 - wounds ? "pyre-wound is-lit" : "pyre-wound"} />
            ))}
          </div>
        </div>
        {phase === "citadel" && doorsReady && <p className="pyre-tap">Tap the gates</p>}
        {phase === "citadel" && roomLive && portalReady && <p className="pyre-tap is-low">Tap the door</p>}
        {phase === "citadel" && roomLive && !portalReady && <p className="pyre-tap is-low">Drag Bolt · swipe the floor, he turns and the room turns with him</p>}
        {phase === "citadel" && plainLive && <p className="pyre-tap is-low">Swipe up to run. Swipe the ground to turn the camera all the way around</p>}
        {phase !== "run" && phase !== "citadel" && (
          <div className="pyre-cover">
            <p className="pyre-kicker">{phase === "fallen" ? "The ash kept you" : "Blood-moon causeway"}</p>
            <h1 className="pyre-title">Pyre</h1>
            <p className="pyre-deck">
              {phase === "fallen"
                ? `${lastRun} paces before the horde closed. Best ${peak}.`
                : "A gothic causeway under a blood moon. The damned hunt your lane."}
            </p>
            <div className="pyre-menu">
              <button type="button" className="pyre-start" onPointerUp={(event) => { event.preventDefault(); event.stopPropagation(); start(); }}>
                Start
              </button>
              <button type="button" className="pyre-start is-ghost" onPointerUp={(event) => { event.preventDefault(); event.stopPropagation(); atGates(); }}>
                The gates
              </button>
              <button type="button" className="pyre-start is-ghost" onPointerUp={(event) => { event.preventDefault(); event.stopPropagation(); atVista(); }}>
                The plain
              </button>
            </div>
            <p className="pyre-note">Stay on the pyre road. At 600 paces the road runs into the citadel.</p>
          </div>
        )}
      </div>
    </main>
  );
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setSteer?: (v: number) => void;
      setKeys?: (codes: string[]) => void;
    };
    BOLTVERSE_PACK_ORIGIN?: string;
    webkitAudioContext?: typeof AudioContext;
  }
}

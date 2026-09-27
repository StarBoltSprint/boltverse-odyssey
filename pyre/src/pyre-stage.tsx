import { useEffect, useRef, useState, type FormEvent } from "react";
import { askGrok } from "@/lib/ask-grok";

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
uniform float uGrove;
uniform float uSun;
uniform float uFront;
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
  float lava = 1.0 - uGrove;
  c.rgb += vec3(0.72, 0.1, 0.05) * (1.0 - shade) * belly * 0.45 * lava;
  c.rgb += vec3(0.95, 0.22, 0.12) * moon * shade * 0.07 * lava;
  c.rgb += vec3(1.0, 0.2, 0.06) * fringe * crack * 0.35 * lava;
  c.rgb += vec3(0.9, 0.16, 0.08) * moon * 0.08 * lava;
  c.rgb = mix(c.rgb, vec3(0.72, 0.04, 0.06), uFlash * 0.65);
  if (uGrove > 0.5) {
    float side = clamp(uSun, -1.2, 1.2);
    float facing = clamp(uFront, 0.0, 1.0);
    float onSun = clamp(0.5 + side * (vUv.x - 0.5) * 2.6, 0.0, 1.0);
    float crown = smoothstep(0.12, 0.88, vUv.y);
    float lit = mix(0.16, onSun, 0.28 + facing * 0.72) * mix(0.62, 1.0, crown);
    c.rgb *= mix(vec3(0.46, 0.54, 0.68), vec3(1.06, 0.98, 0.86), lit);
    float edge = smoothstep(0.5, 0.02, abs(vUv.x - clamp(0.5 + side * 0.42, 0.06, 0.94)));
    c.rgb += vec3(1.0, 0.9, 0.68) * edge * abs(side) * (1.0 - facing * 0.65) * 0.2;
  }
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
const EYE = 0.8;

const BOLT_FOOT_Y = 0.16;
const boltPivot = EYE / Math.max(0.02, groundHorizon - BOLT_FOOT_Y);
const gaitFor = (speed: number) => RUN.idleRate + Math.abs(speed) * (RUN.strideSeconds / RUN.strideMeters);

const simplex2 = (() => {
  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;
  const grad = [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) p[i] = i;
  let seed = 2166136261;
  for (let i = 255; i > 0; i -= 1) {
    seed = Math.imul(seed ^ (seed >>> 16), 0x7feb352d);
    const j = (seed >>> 0) % (i + 1);
    const t = p[i]!;
    p[i] = p[j]!;
    p[j] = t;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i += 1) perm[i] = p[i & 255]!;
  return (xin: number, yin: number) => {
    const skew = (xin + yin) * F2;
    const i = Math.floor(xin + skew);
    const j = Math.floor(yin + skew);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const g0 = grad[perm[ii + perm[jj]!]! % 8]!;
    const g1 = grad[perm[ii + i1 + perm[jj + j1]!]! % 8]!;
    const g2 = grad[perm[ii + 1 + perm[jj + 1]!]! % 8]!;
    let n0 = 0;
    let n1 = 0;
    let n2 = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      t0 *= t0;
      n0 = t0 * t0 * (g0[0]! * x0 + g0[1]! * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      t1 *= t1;
      n1 = t1 * t1 * (g1[0]! * x1 + g1[1]! * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      t2 *= t2;
      n2 = t2 * t2 * (g2[0]! * x2 + g2[1]! * y2);
    }
    return 70 * (n0 + n1 + n2);
  };
})();

const groveHeight = (x: number, z: number) => {
  const n = simplex2(x * 0.016, z * 0.016);
  const t = Math.max(0, (n - 0.38) / 0.62);
  return t * t * 0.7;
};
const groveShade = (x: number, z: number) => {
  const h0 = groveHeight(x, z);
  let shade = 1;
  for (let i = 1; i <= 4; i += 1) {
    const s = i * 1.7;
    const rise = groveHeight(x + SUN_X * s, z + SUN_Z * s) - h0;
    const cover = Math.max(0, Math.min(1, (rise - 0.015 * i) / (0.09 + 0.02 * i)));
    shade *= 1 - cover * (0.08 + 0.04 * (5 - i) / 4);
  }
  return Math.max(0.64, shade);
};

const SUN_X = 0.34;
const SUN_Z = 0.94;

const RELIEF_VS = `
attribute vec2 aScreen;
attribute vec4 aGround;
attribute float aShade;
uniform float uZoom;
uniform vec2 uFocus;
varying vec2 vView;
varying float vH;
varying float vDepth;
varying float vShade;
void main() {
  vView = aGround.xy;
  vH = aGround.z;
  vDepth = aGround.w;
  vShade = aShade;
  vec2 clip = vec2(aScreen.x * 2.0 - 1.0, 1.0 - aScreen.y * 2.0);
  gl_Position = vec4(uFocus + (clip - uFocus) * uZoom, 0.0, 1.0);
}`;

const RELIEF_FS = `
#extension GL_OES_standard_derivatives : enable
precision mediump float;
varying vec2 vView;
varying float vH;
varying float vDepth;
varying float vShade;
uniform sampler2D uPath;
uniform sampler2D uNorm;
uniform float uYaw;
uniform float uWorldX;
uniform float uWorldZ;
uniform float uPivot;
uniform vec2 uSun;
void main() {
  float c = cos(uYaw);
  float s = sin(uYaw);
  float wx = vView.x * c - vView.y * s + uWorldX;
  float wz = vView.x * s + vView.y * c + uPivot + uWorldZ;
  float tile = 0.18;
  vec2 p = vec2(wx, wz) * tile;
  vec2 f = fract(p);
  vec3 a = texture2D(uPath, f).rgb;
  vec3 b = texture2D(uPath, fract(p + 0.5)).rgb;
  float edge = max(abs(f.x - 0.5), abs(f.y - 0.5)) * 2.0;
  float seam = smoothstep(0.92, 1.0, edge);
  vec3 col = mix(a, b, seam);
  vec2 dH = vec2(dFdx(vH), dFdy(vH));
  vec2 dX = vec2(dFdx(vView.x), dFdy(vView.x));
  vec2 dZ = vec2(dFdx(vView.y), dFdy(vView.y));
  float det = dX.x * dZ.y - dX.y * dZ.x;
  float ghx = 0.0;
  float ghz = 0.0;
  if (abs(det) > 0.0001) {
    ghx = (dH.x * dZ.y - dH.y * dZ.x) / det;
    ghz = (dX.x * dH.y - dX.y * dH.x) / det;
  }
  vec3 nGeo = normalize(vec3(-ghx, 1.0, -ghz));
  vec3 nTex = texture2D(uNorm, f).xyz * 2.0 - 1.0;
  nTex = normalize(vec3(nTex.xy, max(nTex.z, 0.15)));
  vec3 nDw = vec3(nTex.x, nTex.z, nTex.y);
  vec3 nDv = vec3(nDw.x * c + nDw.z * s, nDw.y, -nDw.x * s + nDw.z * c);
  vec3 n1 = normalize(vec3(nGeo.x, nGeo.z, nGeo.y));
  vec3 n2 = normalize(vec3(nDv.x, nDv.z, nDv.y));
  n1.z += 1.0;
  n2.xy *= -1.0;
  vec3 r = n1 * dot(n1, n2) / n1.z - n2;
  vec3 n = normalize(vec3(r.x, r.z, r.y));
  vec3 L = normalize(vec3(uSun.x, 0.7, uSun.y));
  float ndl = clamp(dot(n, L), 0.0, 1.0);
  float sky = clamp(n.y, 0.0, 1.0);
  vec3 key = vec3(0.82, 0.64, 0.34) * ndl;
  vec3 fill = vec3(0.37, 0.43, 0.5) * (0.62 + 0.28 * sky);
  col *= key + fill;
  vec3 V = normalize(vec3(0.0, 0.55, -1.0));
  float spec = pow(clamp(dot(n, normalize(L + V)), 0.0, 1.0), 28.0);
  col += vec3(1.0, 0.86, 0.55) * spec * 0.14 * vShade;
  float crease = length(vec2(dFdx(ghx), dFdy(ghx))) + length(vec2(dFdx(ghz), dFdy(ghz)));
  col *= 1.0 - clamp(crease * 0.45, 0.0, 0.22);
  col *= vShade;
  float alpha = 1.0 - smoothstep(22.0, 44.0, vDepth);
  if (alpha < 0.02) discard;
  gl_FragColor = vec4(col, alpha);
}`;

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
uniform float uFlat;
void main() {
  float horizon = uHorizon;
  if (vUv.y > horizon) discard;
  float dy = max(0.02, horizon - vUv.y);
  float depth = 0.8 / dy;
  float x = (vUv.x - 0.5) * depth * uXMul;
  float c = cos(uYaw);
  float s = sin(uYaw);
  float relZ = depth - uPivot;
  float wx = x * c - relZ * s + uWorldX;
  float wz = x * s + relZ * c + uPivot + uWorldZ;
  float tile = 0.18;
  vec2 p = vec2(wx, wz) * tile;
  vec2 f = fract(p);
  vec3 a = texture2D(uPath, f).rgb;
  vec3 b = texture2D(uPath, fract(p + 0.5)).rgb;
  float edge = max(abs(f.x - 0.5), abs(f.y - 0.5)) * 2.0;
  float seam = smoothstep(0.92, 1.0, edge);
  vec3 stone = mix(a, b, seam);
  float stretch = max(length(dFdx(p)), length(dFdy(p)));
  float near = uFlat > 0.5 ? 0.1 : 0.02;
  float far = uFlat > 0.5 ? 0.5 : 0.055;
  float sharp = 1.0 - smoothstep(near, far, stretch);
  float intoSky = 1.0 - smoothstep(uFade0, uFade1, vUv.y);
  vec3 col = stone;
  float alpha = sharp * intoSky;
  if (uFlat > 0.5) {
    float dyScreen = horizon - vUv.y;
    col = stone;
    alpha = smoothstep(0.0, 0.055, dyScreen);
  }
  gl_FragColor = vec4(col, alpha);
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

const RIBBON_FS = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uAlpha;
uniform float uS0;
uniform float uS1;
uniform float uUp;
uniform float uLit;
void main() {
  float along = mix(uS0, uS1, uUp > 0.5 ? vUv.x : vUv.y);
  float across = uUp > 0.5 ? vUv.y : vUv.x;
  vec2 uv = uUp > 0.5 ? vec2(mix(0.32, 0.68, vUv.y), fract(along / 8.0)) : vec2(vUv.x, fract(along / 8.0));
  vec4 c = texture2D(uTex, uv);
  float ridge = smoothstep(0.02, 0.46, across) * smoothstep(0.98, 0.54, across);
  c.rgb *= mix(0.12, 1.08, ridge);
  c.rgb *= 1.0 + uLit * (0.42 - across) * 0.12;
  float lum = max(c.r, max(c.g, c.b));
  float a = smoothstep(0.02, 0.16, lum);
  if (uUp > 0.5) a *= mix(1.0, 0.28, vUv.y);
  if (a < 0.03) discard;
  gl_FragColor = vec4(c.rgb, a * uAlpha);
}`;

const MARK_FS = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uAlpha;
uniform float uFlip;
uniform float uShade;
uniform float uKey;
uniform float uSide;
uniform float uFog;
uniform float uWind;
uniform float uFlick;
void main() {
  vec2 uv = vec2(uFlip > 0.5 ? 1.0 - vUv.x : vUv.x, vUv.y);
  vec4 base = texture2D(uTex, uv);
  float leaf = smoothstep(0.03, 0.16, base.g - max(base.r, base.b));
  float top = smoothstep(0.22, 0.78, uv.y);
  float clump = sin(uv.x * 22.0 + uv.y * 13.0 + uFlick * 2.6);
  float clump2 = sin(uv.x * 41.0 - uv.y * 27.0 + uFlick * 4.1);
  float clump3 = sin(uv.x * 9.0 + uv.y * 33.0 - uFlick * 1.8);
  float amp = abs(uWind);
  vec2 off = vec2(uWind * (0.75 + 0.95 * clump) + clump2 * amp * 0.9 + clump3 * amp * 0.4, clump2 * amp * 0.32 + clump * amp * 0.14);
  off *= leaf * top;
  vec4 c = texture2D(uTex, clamp(uv + off, 0.0, 1.0));
  float a;
  if (uKey > 0.5) {
    float mag = min(c.r, c.b) - c.g;
    a = 1.0 - smoothstep(0.12, 0.42, mag);
    if (mag > 0.48) a = 0.0;
    float spill = clamp(mag / 0.18, 0.0, 1.0);
    c.r = mix(c.r, c.g, spill);
    c.b = mix(c.b, c.g, spill);
  } else {
    float m = max(c.r, c.b);
    float greenness = c.g - m;
    a = 1.0 - smoothstep(0.08, 0.28, greenness);
    if (greenness > 0.26) a = 0.0;
    c.g = mix(c.g, m, clamp(greenness / 0.08, 0.0, 1.0));
  }
  if (a < 0.04) discard;
  float sideLit = clamp(0.5 + (uv.x - 0.5) * uSide, 0.0, 1.0);
  c.rgb *= mix(vec3(0.62, 0.72, 0.86), vec3(1.2, 1.08, 0.94), sideLit);
  c.rgb = mix(c.rgb, vec3(0.62, 0.74, 0.88), uFog);
  gl_FragColor = vec4(c.rgb * uShade, a * uAlpha);
}`;

const TREE_FS = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform sampler2D uDepth;
uniform float uParallax;
uniform float uAlpha;
uniform float uFlip;
uniform float uShade;
uniform float uSide;
uniform float uFog;
uniform float uTube;
uniform float uRepeat;
uniform float uLo;
uniform float uHi;
void main() {
  vec2 uv = vec2(uFlip > 0.5 ? 1.0 - vUv.x : vUv.x, vUv.y);
  float d = texture2D(uDepth, uv).r;
  if (uHi > 0.0 && (d < uLo || d >= uHi)) discard;
  float shift = (d - 0.45) * uParallax;
  float u = uv.x + shift;
  if (uRepeat < 0.5) u = clamp(u, 0.0, 1.0);
  vec2 uv2 = vec2(u, uv.y);
  vec4 c = texture2D(uTex, uv2);
  vec4 edge = texture2D(uTex, uv);
  float magC = min(c.r, c.b) - c.g;
  if (magC > 0.08) c = edge;
  float mag = min(edge.r, edge.b) - edge.g;
  float alpha = 1.0 - smoothstep(0.12, 0.42, mag);
  if (mag > 0.48) alpha = 0.0;
  float spill = clamp(mag / 0.18, 0.0, 1.0);
  c.r = mix(c.r, c.g, spill);
  c.b = mix(c.b, c.g, spill);
  float low = 1.0 - smoothstep(0.42, 0.56, uv.y);
  alpha *= 1.0 - uTube * low;
  if (alpha < 0.04) discard;
  float sideLit = clamp(0.5 + (uv2.x - 0.5) * uSide, 0.0, 1.0);
  c.rgb *= mix(vec3(0.62, 0.72, 0.86), vec3(1.2, 1.08, 0.94), sideLit);
  c.rgb = mix(c.rgb, vec3(0.62, 0.74, 0.88), uFog);
  gl_FragColor = vec4(c.rgb * uShade, alpha * uAlpha);
}`;

const INST_VS = `
attribute vec2 aCorner;
attribute vec4 aRect;
attribute vec4 aLive;
attribute float aLean;
uniform float uZoom;
uniform vec2 uFocus;
uniform vec4 uCrop;
varying vec2 vUv;
varying float vShade;
varying float vAlpha;
varying float vFog;
void main() {
  float u = mix(uCrop.x, uCrop.y, aCorner.x);
  if (aLive.x > 0.5) u = mix(uCrop.y, uCrop.x, aCorner.x);
  float v = mix(uCrop.w, uCrop.z, aCorner.y);
  vUv = vec2(u, v);
  vShade = aLive.y;
  vAlpha = aLive.z;
  vFog = aLive.w;
  float tip = 1.0 - aCorner.y;
  vec2 p = vec2(aRect.x + aCorner.x * aRect.z + aLean * tip, aRect.y + aCorner.y * aRect.w);
  vec2 clip = vec2(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0);
  gl_Position = vec4(uFocus + (clip - uFocus) * uZoom, 0.0, 1.0);
}`;

const INST_FS = `
precision mediump float;
varying vec2 vUv;
varying float vShade;
varying float vAlpha;
varying float vFog;
uniform sampler2D uTex;
uniform float uSide;
void main() {
  vec4 c = texture2D(uTex, vUv);
  float mag = min(c.r, c.b) - c.g;
  float a = 1.0 - smoothstep(0.12, 0.42, mag);
  if (mag > 0.48) a = 0.0;
  float spill = clamp(mag / 0.18, 0.0, 1.0);
  c.r = mix(c.r, c.g, spill);
  c.b = mix(c.b, c.g, spill);
  a *= vAlpha;
  if (a < 0.04) discard;
  float sideLit = clamp(0.5 + (vUv.x - 0.5) * uSide, 0.0, 1.0);
  vec3 rgb = c.rgb * vShade * mix(vec3(0.68, 0.78, 0.9), vec3(1.16, 1.06, 0.96), sideLit);
  float warm = clamp((vShade - 0.62) / 0.5, 0.0, 1.0);
  rgb *= mix(vec3(0.92, 0.98, 1.0), vec3(1.02, 1.0, 0.96), warm);
  rgb = mix(rgb, vec3(0.62, 0.74, 0.88), vFog);
  gl_FragColor = vec4(rgb, a);
}`;

const SPARK_VS = `
attribute vec2 aCorner;
attribute vec4 aRect;
attribute vec4 aLive;
uniform float uZoom;
uniform vec2 uFocus;
varying vec2 vUv;
varying vec3 vTint;
varying float vAlpha;
void main() {
  vUv = vec2(aCorner.x, 1.0 - aCorner.y);
  vTint = aLive.xyz;
  vAlpha = aLive.w;
  vec2 p = vec2(aRect.x + aCorner.x * aRect.z, aRect.y + aCorner.y * aRect.w);
  vec2 clip = vec2(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0);
  gl_Position = vec4(uFocus + (clip - uFocus) * uZoom, 0.0, 1.0);
}`;

const SPARK_FS = `
precision mediump float;
varying vec2 vUv;
varying vec3 vTint;
varying float vAlpha;
uniform sampler2D uTex;
void main() {
  vec4 c = texture2D(uTex, vUv);
  float mag = min(c.r, c.b) - c.g;
  float a = 1.0 - smoothstep(0.06, 0.32, mag);
  float hot = max(c.r, max(c.g, c.b));
  if (a < 0.04 || hot < 0.05) discard;
  gl_FragColor = vec4(vTint * hot * a * vAlpha, 1.0);
}`;

const RAY_VS = `
attribute vec2 aCorner;
attribute vec4 aRect;
attribute vec4 aLive;
uniform float uZoom;
uniform vec2 uFocus;
varying vec2 vUv;
varying float vAlpha;
varying float vCut;
void main() {
  vUv = vec2(aCorner.x, aCorner.y);
  vAlpha = aLive.z;
  vCut = aLive.w;
  vec2 dir = aLive.xy;
  vec2 side = vec2(-dir.y, dir.x);
  float grow = 0.9 + aCorner.y * 0.25;
  vec2 p = aRect.xy + dir * aCorner.y * aRect.z + side * (aCorner.x - 0.5) * aRect.w * grow;
  vec2 clip = vec2(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0);
  gl_Position = vec4(uFocus + (clip - uFocus) * uZoom, 0.0, 1.0);
}`;

const SHAFT_FS = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uAlpha;
uniform vec2 uOrigin;
uniform vec2 uRad;
void main() {
  vec3 c = texture2D(uTex, vUv).rgb;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  float a = smoothstep(0.05, 0.28, lum) * uAlpha;
  vec2 q = (vUv - uOrigin) / max(uRad, vec2(0.001));
  a *= smoothstep(0.9, 1.2, length(q));
  if (a < 0.015) discard;
  gl_FragColor = vec4(c, a);
}`;

const RAY_FS = `
precision mediump float;
varying vec2 vUv;
varying float vAlpha;
varying float vCut;
uniform sampler2D uTex;
void main() {
  if (vUv.y > vCut) discard;
  float side = abs(vUv.x - 0.5) * 2.0;
  float soft = exp(-side * side * 10.0);
  float along = clamp(vUv.y / max(vCut, 0.05), 0.0, 1.0);
  vec4 c = texture2D(uTex, vec2(vUv.x, vUv.y));
  float hot = max(c.r, max(c.g, c.b));
  float fade = soft * (1.0 - along) * (0.65 + 0.35 * hot);
  if (fade * vAlpha < 0.02) discard;
  gl_FragColor = vec4(1.0, 0.96, 0.84, fade * vAlpha);
}`;

const GRADE_FS = `
precision mediump float;
varying vec2 vUv;
void main() {
  gl_FragColor = vec4(1.0, 0.95, 0.88, 0.055);
}`;

const GLARE_FS = `
precision mediump float;
varying vec2 vUv;
uniform vec2 uSun;
uniform float uWorld;
uniform float uLook;
uniform float uAspect;
void main() {
  vec2 p = vUv - uSun;
  p.x *= uAspect;
  float d = length(p);
  float disc = smoothstep(0.058, 0.02, d);
  float aureole = exp(-d * d * 18.0);
  float air = exp(-d * 1.55);
  float cover = smoothstep(0.05, 0.4, uWorld);
  float a = disc * (0.72 + 0.28 * cover) + (aureole * 0.3 + air * 0.045) * uWorld + uLook * (aureole * 0.22 + air * 0.03);
  if (a < 0.012) discard;
  vec3 warm = vec3(1.0, 0.97, 0.9);
  vec3 sky = vec3(0.8, 0.89, 1.0);
  gl_FragColor = vec4(mix(warm, sky, smoothstep(0.03, 0.42, d)), a);
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
uniform float uWrap;
uniform float uRun;
uniform float uWX;
uniform float uWZ;
vec3 face(float i, vec2 uv) {
  vec3 c;
  if (i < 0.5) c = texture2D(u0, uv).rgb;
  else if (i < 1.5) c = texture2D(u1, uv).rgb;
  else if (i < 2.5) c = texture2D(u2, uv).rgb;
  else c = texture2D(u3, uv).rgb;
  if (i < 0.5) {
    vec2 d = uv - vec2(0.50, 0.71);
    vec2 e = vec2(d.x / 0.22, d.y / 0.13);
    float r = length(e);
    if (r < 1.85) {
      vec2 dir = e / max(r, 0.001);
      vec3 around = texture2D(u0, clamp(vec2(0.50, 0.71) + vec2(dir.x * 0.22, dir.y * 0.13) * 1.9, vec2(0.02), vec2(0.98))).rgb;
      vec3 left = texture2D(u0, vec2(0.22, 0.71)).rgb;
      vec3 right = texture2D(u0, vec2(0.78, 0.71)).rgb;
      if (dot(left, vec3(1.0)) < dot(around, vec3(1.0))) around = left;
      if (dot(right, vec3(1.0)) < dot(around, vec3(1.0))) around = right;
      c = mix(around, c, smoothstep(0.12, 1.55, r));
    }
  }
  return c;
}
void main() {
  float v = mix(uV0, uV1, vUv.y);
  if (uWrap > 0.5) {
    float horizon = uV0;
    float above = clamp((vUv.y - horizon) / max(0.001, 1.0 - horizon), 0.0, 1.0);
    float tv = mix(0.04, 0.96, pow(above, 0.72));
    vec3 sky = texture2D(u0, vec2(clamp(vUv.x, 0.0, 1.0), tv)).rgb;
    vec3 haze = vec3(0.55, 0.74, 0.90);
    sky = mix(sky, haze, smoothstep(0.16, 0.0, above) * 0.85);
    if (vUv.y < horizon) sky = haze;
    gl_FragColor = vec4(sky, 1.0);
    return;
  }
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
  float a = smoothstep(1.2, 0.2, d) * smoothstep(0.0, 0.42, vUv.y);
  gl_FragColor = vec4(0.03, 0.045, 0.07, a * 0.32);
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

function linkProg(gl: WebGLRenderingContext, vsSrc: string, fsSrc: string) {
  const prog = gl.createProgram();
  if (!prog) throw new Error("program");
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fsSrc));
  gl.bindAttribLocation(prog, 0, "aCorner");
  gl.bindAttribLocation(prog, 2, "aRect");
  gl.bindAttribLocation(prog, 3, "aLive");
  gl.bindAttribLocation(prog, 4, "aLean");
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
  const stamp = Math.round(video.currentTime * 30) + frames * 100000;
  if (frameStamp.get(video) === stamp) return;
  frameStamp.set(video, stamp);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  try {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
  } catch {
    frameStamp.delete(video);
  }
}

function lookShift(glance: number, wingsReady: boolean) {
  if (!wingsReady) return 0;
  const t = Math.min(1, Math.max(0, (Math.abs(glance) - 0.1) / 0.38));
  return glance * (t * t * (3 - 2 * t));
}

function quad(x: number, y: number, w: number, h: number) {
  return quadLean(x, y, w, h, 0);
}

function quadLean(x: number, y: number, w: number, h: number, lean: number) {
  const x0 = x * 2 - 1;
  const x1 = (x + w) * 2 - 1;
  const yTop = 1 - y * 2;
  const yBot = 1 - (y + h) * 2;
  const s = lean * 2;
  return new Float32Array([
    x0, yBot, 0, 0,
    x1, yBot, 1, 0,
    x0 + s, yTop, 0, 1,
    x1 + s, yTop, 1, 1,
  ]);
}

const FULL = quad(0, 0, 1, 1);

function quadUV(x: number, y: number, w: number, h: number, u0: number, v0: number, u1: number, v1: number) {
  const x0 = x * 2 - 1;
  const x1 = (x + w) * 2 - 1;
  const yTop = 1 - y * 2;
  const yBot = 1 - (y + h) * 2;
  return new Float32Array([
    x0, yBot, u0, v0,
    x1, yBot, u1, v0,
    x0, yTop, u0, v1,
    x1, yTop, u1, v1,
  ]);
}

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

function ribbonUV(
  x0: number, y0: number, u0: number, v0: number,
  x1: number, y1: number, u1: number, v1: number,
  x2: number, y2: number, u2: number, v2: number,
  x3: number, y3: number, u3: number, v3: number,
) {
  const clip = (x: number, y: number) => [x * 2 - 1, y * 2 - 1] as const;
  const p0 = clip(x0, y0);
  const p1 = clip(x1, y1);
  const p2 = clip(x2, y2);
  const p3 = clip(x3, y3);
  return new Float32Array([
    p0[0], p0[1], u0, v0,
    p1[0], p1[1], u1, v1,
    p2[0], p2[1], u2, v2,
    p3[0], p3[1], u3, v3,
  ]);
}

function groundRibbon(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
) {
  const clip = (x: number, y: number) => [x * 2 - 1, y * 2 - 1] as const;
  const p0 = clip(x0, y0);
  const p1 = clip(x1, y1);
  const p2 = clip(x2, y2);
  const p3 = clip(x3, y3);
  return new Float32Array([
    p0[0], p0[1], 0, 0,
    p1[0], p1[1], 0, 1,
    p2[0], p2[1], 1, 0,
    p3[0], p3[1], 1, 1,
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
  const groveRunRef = useRef<HTMLVideoElement>(null);
  const groveIdleRef = useRef<HTMLVideoElement>(null);
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
  const boltThunderRunFaceRef = useRef<HTMLVideoElement>(null);
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
  const [groveLive, setGroveLive] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [askQ, setAskQ] = useState("");
  const [askBusy, setAskBusy] = useState(false);
  const [askEar, setAskEar] = useState(false);
  const askOpenRef = useRef(false);
  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const grokOnRef = useRef(true);
  const [grokOn, setGrokOn] = useState(true);
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
    const groveRun = groveRunRef.current;
    const groveIdle = groveIdleRef.current;
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
    const boltThunderRunFace = boltThunderRunFaceRef.current;
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
      !canvas || !fx || !roadA || !roadB || !bolt || !boltIdle || !groveRun || !groveIdle || !boltFace || !boltTurn || !boltTurnBack || !boltTurnLeft || !boltTurnLeftBack || !boltThunder || !boltThunderRise || !boltThunderRight || !boltThunderRightBack || !boltThunderLeft || !boltThunderLeftBack || !boltThunderRightIdle || !boltThunderLeftIdle || !boltThunderRun || !boltThunderRunLeft || !boltThunderRunRight || !boltThunderRunFace || !boltThunderBackstep || !boltThunderFace || !plainVid || !plainLeftLive || !plainRightLive || !fallen || !brute || !boss || !bossAsh ||
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
    const reliefProg = (() => {
      const prog = gl.createProgram();
      if (!prog) throw new Error("program");
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, RELIEF_VS));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, RELIEF_FS));
      gl.bindAttribLocation(prog, 0, "aScreen");
      gl.bindAttribLocation(prog, 1, "aGround");
      gl.bindAttribLocation(prog, 2, "aShade");
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(prog) || "link");
      }
      return prog;
    })();
    const RELIEF_COLS = 16;
    const RELIEF_ROWS = 28;
    const reliefStride = RELIEF_COLS + 1;
    const reliefVerts = new Float32Array(reliefStride * (RELIEF_ROWS + 1) * 7);
    const reliefIndex = new Uint16Array(RELIEF_COLS * RELIEF_ROWS * 6);
    {
      let k = 0;
      for (let iz = RELIEF_ROWS - 1; iz >= 0; iz -= 1) {
        for (let ix = 0; ix < RELIEF_COLS; ix += 1) {
          const a = iz * reliefStride + ix;
          const b = a + 1;
          const c = a + reliefStride;
          const d = c + 1;
          reliefIndex[k++] = a;
          reliefIndex[k++] = c;
          reliefIndex[k++] = b;
          reliefIndex[k++] = b;
          reliefIndex[k++] = c;
          reliefIndex[k++] = d;
        }
      }
    }
    const reliefBuf = gl.createBuffer();
    const reliefIdx = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, reliefIdx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, reliefIndex, gl.STATIC_DRAW);
    const propProg = program(gl, PROP_FS);
    const ribbonProg = program(gl, RIBBON_FS);
    const markProg = program(gl, MARK_FS);
    const treeTurnProg = program(gl, TREE_FS);
    const instExt = gl.getExtension("ANGLE_instanced_arrays");
    const instProg = linkProg(gl, INST_VS, INST_FS);
    const sparkProg = linkProg(gl, SPARK_VS, SPARK_FS);
    const rayProg = linkProg(gl, RAY_VS, RAY_FS);
    const shaftProg = program(gl, SHAFT_FS);
    const glareProg = program(gl, GLARE_FS);
    const gradeProg = program(gl, GRADE_FS);
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
        img.dataset.src = `/master/orbit/${name}-${String(i + 1).padStart(2, "0")}.jpg?v=${v}`;
        return img;
      });
    const leftPack = loadOrbit("left", 5);
    const rightPack = loadOrbit("right", 4);
    const take = (pack: HTMLImageElement[], from: number, to: number) => pack.slice(from - 1, to);
    const leftSide = take(leftPack, 1, 16);
    const rightSide = take(rightPack, 1, 16);
    const plainLeft: HTMLImageElement[] = [];
    const plainRight: HTMLImageElement[] = [];
    const loadStrip = (name: string, n: number) =>
      Array.from({ length: n }, (_, i) => {
        const img = new Image();
        img.decoding = "async";
        img.dataset.src = `/master/orbit/${name}-${String(i + 1).padStart(2, "0")}.jpg?v=1`;
        return img;
      });
    const plainGo: HTMLImageElement[] = [];
    const plainGoL: HTMLImageElement[] = [];
    const plainGoR: HTMLImageElement[] = [];
    const loadGrid = (name: string) =>
      Array.from({ length: 12 }, (_, i) => {
        const img = new Image();
        img.decoding = "async";
        img.dataset.src = `/master/grid/${name}-${String(i + 1).padStart(2, "0")}.jpg?v=1`;
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
    const warmImgs = (imgs: HTMLImageElement[]) => {
      for (const img of imgs) {
        const src = img.dataset.src;
        if (src && !img.getAttribute("src")) img.src = src;
      }
    };
    const warmWorld = () => {
      warmImgs(leftPack);
      warmImgs(rightPack);
      for (const row of nsPack) for (const pack of row) warmImgs(pack);
      for (const row of ewPack) for (const pack of row) warmImgs(pack);
    };
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
    const normTex = makeTex(gl);
    gl.bindTexture(gl.TEXTURE_2D, normTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 255, 255]));
    const pathGlowTex = makeTex(gl);
    const treeTex = [0, 1, 2].map(() => makeTex(gl));
    const floorTex = [0, 1, 2].map(() => makeTex(gl));
    const detailTex = [0, 1, 2].map(() => makeTex(gl));
    const boulderTex = makeTex(gl);
    const rockPropTex = makeTex(gl);
    const sparkTex = makeTex(gl);
    const sparkImg = new Image();
    sparkImg.src = "/master/decor/grove-spark.png?v=1";
    let sparkReady = false;
    const cornerBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    const instBuf = gl.createBuffer();
    const instScratch = new Float32Array(4096 * 9);
    const spireTex = makeTex(gl);
    const cityTex = makeTex(gl);
    const decorImg = (src: string) => {
      const img = new Image();
      img.src = src;
      return img;
    };
    const skyVids = [0, 1, 2, 3].map((i) => {
      const video = document.createElement("video");
      video.dataset.src = `/master/decor/sky-${i}.mp4?v=1`;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "none";
      video.setAttribute("playsinline", "");
      frame.appendChild(video);
      return video;
    });
    const groundVid = document.createElement("video");
    groundVid.muted = true;
    groundVid.loop = true;
    groundVid.playsInline = true;
    groundVid.preload = "none";
    groundVid.setAttribute("playsinline", "");
    frame.appendChild(groundVid);
    const armVid = (video: HTMLVideoElement) => {
      const src = video.dataset.src;
      if (src && !video.getAttribute("src")) {
        video.preload = "auto";
        video.src = src;
      }
    };
    const forestClip = (src: string) => {
      const video = document.createElement("video");
      video.dataset.src = src;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "none";
      video.setAttribute("playsinline", "");
      frame.appendChild(video);
      return video;
    };
    const forestSkies = [0, 1, 2, 3].map((i) => forestClip(`/master/decor/forest-sky-${i}.mp4?v=1`));
    const pathGlowVid = forestClip("/master/decor/grove-path.mp4?v=4");
    let skyLock: { x: number; y: number; vis: number } | null = null;
    let liveSunSide = 0;
    const sunImg = decorImg("/master/decor/grove-sun-0.jpg?v=1");
    const sunTex = makeTex(gl);
    let sunSent = false;
    const treeVids = [0, 1, 2].map((i) => forestClip(`/master/decor/grove-tree-${i}.mp4?v=1`));
    const boleVid = forestClip("/master/decor/grove-bole.mp4?v=1");
    const crownVid = forestClip("/master/decor/grove-crown.mp4?v=1");
    const boleTex = makeTex(gl);
    const crownTex = makeTex(gl);
    const grokVid = forestClip("/master/decor/grove-grok.mp4?v=1");
    const grokTex = makeTex(gl);
    const turnTex = [0, 1, 2, 3, 4, 5].map(() => makeTex(gl));
    const turnImg = [0, 1, 2, 3, 4, 5].map((i) => decorImg(`/master/decor/grove-turn-${i}.jpg?v=4`));
    const depthTex = [0, 1, 2, 3, 4, 5].map(() => makeTex(gl));
    const depthImg = [0, 1, 2, 3, 4, 5].map((i) => decorImg(`/master/decor/grove-depth-${i}.jpg?v=3`));
    const barkTex = makeTex(gl);
    const barkImg = decorImg("/master/decor/grove-bark.jpg?v=3");
    const turnHold = new WeakMap<object, number>();
    let turnSent = false;
    let barkSent = false;
    const treeAspects = [768 / 1168, 768 / 1168, 832 / 1088];
    const floorVids = [
      forestClip("/master/decor/grove-moss.mp4?v=2"),
      forestClip("/master/decor/grove-grass.mp4?v=4"),
      forestClip("/master/decor/grove-leaves.mp4?v=2"),
    ];
    const floorAspects = [1.5, 768 / 1168, 1.5];
    const flatImg = decorImg("/master/decor/grove-grass-flat.jpg?v=1");
    const flatTex = makeTex(gl);
    let flatSent = false;
    const detailVids = [
      forestClip("/master/decor/grove-mist.mp4?v=3"),
      forestClip("/master/decor/grove-mushroom.mp4?v=1"),
      forestClip("/master/decor/grove-dust.mp4?v=3"),
    ];
    const lifeVids = [
      forestClip("/master/decor/grove-fly.mp4?v=1"),
      forestClip("/master/decor/grove-bird.mp4?v=1"),
      forestClip("/master/decor/grove-oakleaf.mp4?v=1"),
    ];
    const flyFrames = [0, 1, 2, 3, 4, 5].map((i) => decorImg(`/master/decor/grove-fly-${i}.jpg?v=2`));
    const lifeTex = [0, 1, 2].map(() => makeTex(gl));
    const LAVA_GROUND = "/master/decor/ground.mp4?v=3";
    const groveFloorImg = decorImg("/master/decor/grove-land.jpg?v=4");
    const groveNormImg = decorImg("/master/decor/grove-land-n.jpg?v=2");
    let groveFloorSent = false;
    let groveNormSent = false;
    const setGround = (src: string) => {
      if (groundVid.dataset.plate === src) {
        if (groundVid.paused) playSafe(groundVid);
        return;
      }
      groundVid.dataset.plate = src;
      groundVid.src = src;
      const start = () => playSafe(groundVid);
      if (groundVid.readyState >= 2) start();
      else groundVid.addEventListener("loadeddata", start, { once: true });
    };
    const pathImg = decorImg("/master/decor/path.jpg");
    const boulderImg = decorImg("/master/decor/grove-rock.jpg");
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
    let grokHit: { x: number; y: number; w: number; h: number } | null = null;
    let boltGround = 0;
    let groveSprint = false;
    const BOLT_SLOTS = 8;
    const runSheets: HTMLCanvasElement[] = [];
    const idleSheets: HTMLCanvasElement[] = [];
    let runGot = 0;
    let idleGot = 0;
    let runClock = 0;
    let idleClock = 0;
    let lastRunT = -1;
    let lastIdleT = -1;
    const grabBolt = (video: HTMLVideoElement, sheets: HTMLCanvasElement[], i: number) => {
      const srcW = video.videoWidth || 2;
      const srcH = video.videoHeight || 2;
      const fit = Math.min(1, 420 / Math.max(srcW, srcH));
      const w = Math.max(2, Math.round(srcW * fit));
      const h = Math.max(2, Math.round(srcH * fit));
      let sheet = sheets[i];
      if (!sheet) {
        sheet = document.createElement("canvas");
        sheets[i] = sheet;
      }
      if (sheet.width !== w || sheet.height !== h) {
        sheet.width = w;
        sheet.height = h;
      }
      sheet.getContext("2d")?.drawImage(video, 0, 0, w, h);
    };
    let strafeWish = 0;
    let strafeV = 0;
    let plateOffset = 0;
    let zoom = 1;
    let zoomTarget = 1;
    let pinch: { dist: number; zoom: number } | null = null;
    let vistaHold = false;
    let grove = false;
    let groveBoltLive = false;
    const grovePath: { x: number; z: number; s: number }[] = [];
    const groveMarks: { x: number; z: number; s: number; kind: number; scale: number; flip: number; shade: number; variant: number; ang: number }[] = [];
    let pathS = 0;
    let pathCursor = 0;
    const grassSeen = new Set<number>();
    const treeSeen = new Set<number>();
    const mistSeen = new Set<number>();
    const shroomSeen = new Set<number>();
    const dustSeen = new Set<number>();
    let boulderReady = false;
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
    groveRun.muted = true;
    groveRun.playsInline = true;
    groveRun.loop = true;
    groveRun.playbackRate = 2.4;
    groveIdle.muted = true;
    groveIdle.playsInline = true;
    groveIdle.loop = true;
    groveIdle.playbackRate = 1;
    for (const clip of [boltFace, boltTurn, boltTurnBack, boltTurnLeft, boltTurnLeftBack, boltThunder, boltThunderRise, boltThunderRight, boltThunderRightBack, boltThunderLeft, boltThunderLeftBack, boltThunderRightIdle, boltThunderLeftIdle, boltThunderRun, boltThunderRunLeft, boltThunderRunRight, boltThunderRunFace, boltThunderBackstep, boltThunderFace]) {
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
    boltThunderRunFace.loop = true;
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

    type Card = { x: number; y: number; w: number; h: number; flip: number; shade: number; alpha: number; fog?: number; lean?: number };
    const drawCards = (tex: WebGLTexture, crop: [number, number, number, number], cards: Card[]) => {
      const n = Math.min(cards.length, 4096);
      if (!n || !tex) return;
      if (!instExt) {
        gl.useProgram(markProg);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(gl.getUniformLocation(markProg, "uTex"), 0);
        gl.uniform1f(gl.getUniformLocation(markProg, "uKey"), 1);
        for (let i = 0; i < n; i += 1) {
          const card = cards[i]!;
          gl.uniform1f(gl.getUniformLocation(markProg, "uAlpha"), card.alpha);
          gl.uniform1f(gl.getUniformLocation(markProg, "uFlip"), card.flip);
          gl.uniform1f(gl.getUniformLocation(markProg, "uShade"), card.shade);
          gl.uniform1f(gl.getUniformLocation(markProg, "uFog"), card.fog ?? 0);
          gl.uniform1f(gl.getUniformLocation(markProg, "uSide"), liveSunSide);
          drawBuffer(quadUV(card.x, card.y, card.w, card.h, crop[0], crop[2], crop[1], crop[3]));
        }
        return;
      }
      let o = 0;
      for (let i = 0; i < n; i += 1) {
        const card = cards[i]!;
        instScratch[o++] = card.x;
        instScratch[o++] = card.y;
        instScratch[o++] = card.w;
        instScratch[o++] = card.h;
        instScratch[o++] = card.flip;
        instScratch[o++] = card.shade;
        instScratch[o++] = card.alpha;
        instScratch[o++] = card.fog ?? 0;
        instScratch[o++] = card.lean ?? 0;
      }
      gl.useProgram(instProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(gl.getUniformLocation(instProg, "uTex"), 0);
      gl.uniform1f(gl.getUniformLocation(instProg, "uSide"), liveSunSide);
      gl.uniform4f(gl.getUniformLocation(instProg, "uCrop"), crop[0], crop[1], crop[2], crop[3]);
      gl.uniform1f(gl.getUniformLocation(instProg, "uZoom"), frameZoom);
      gl.uniform2f(gl.getUniformLocation(instProg, "uFocus"), 0, frameFocusY);
      gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      instExt.vertexAttribDivisorANGLE(0, 0);
      gl.disableVertexAttribArray(1);
      gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
      gl.bufferData(gl.ARRAY_BUFFER, instScratch.subarray(0, n * 9), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(2);
      gl.enableVertexAttribArray(3);
      gl.enableVertexAttribArray(4);
      gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 36, 0);
      gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 36, 16);
      gl.vertexAttribPointer(4, 1, gl.FLOAT, false, 36, 32);
      instExt.vertexAttribDivisorANGLE(2, 1);
      instExt.vertexAttribDivisorANGLE(3, 1);
      instExt.vertexAttribDivisorANGLE(4, 1);
      instExt.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, 4, n);
      instExt.vertexAttribDivisorANGLE(2, 0);
      instExt.vertexAttribDivisorANGLE(3, 0);
      instExt.vertexAttribDivisorANGLE(4, 0);
      gl.disableVertexAttribArray(2);
      gl.disableVertexAttribArray(3);
      gl.disableVertexAttribArray(4);
    };

    type Mote = { x: number; z: number; h: number; life: number; max: number; size: number; seed: number };
    const motes: Mote[] = [];
    const spawnMote = (ahead: boolean) => {
      const side = (Math.random() - 0.5) * 16;
      const along = (ahead ? 3 : -3) + Math.random() * 18;
      const c = Math.cos(selfAng);
      const s = Math.sin(selfAng);
      const life = 2.8 + Math.random() * 3.2;
      motes.push({
        x: worldX + c * side - s * along,
        z: worldZ + s * side + c * along,
        h: 1.6 + Math.random() * 4.6,
        life,
        max: life,
        size: 0.22 + Math.random() * 0.18,
        seed: Math.random() * 6.28,
      });
    };
    const drawMotes = () => {
      const vid = detailVids[2];
      if (!vid || vid.readyState < 2 || !instExt) return;
      const side = canvas.width / Math.max(1, canvas.height);
      const batch: { x: number; y: number; w: number; h: number; a: number }[] = [];
      for (const mote of motes) {
        const at = groveScreen(mote.x, mote.z);
        if (!at || at.x < -0.2 || at.x > 1.2) continue;
        const rise = mote.h / at.depth;
        const s = Math.min(0.04, Math.max(0.012, mote.size / at.depth));
        if (s < 0.004) continue;
        const foot = 1 - at.y;
        batch.push({
          x: at.x - s / 2,
          y: foot - rise - s,
          w: s,
          h: s * side,
          a: Math.min(1, mote.life / mote.max) * 0.85,
        });
      }
      if (!batch.length) return;
      let o = 0;
      for (const p of batch) {
        instScratch[o++] = p.x;
        instScratch[o++] = p.y;
        instScratch[o++] = p.w;
        instScratch[o++] = p.h;
        instScratch[o++] = 1;
        instScratch[o++] = 0.86;
        instScratch[o++] = 0.42;
        instScratch[o++] = p.a;
      }
      gl.useProgram(sparkProg);
      gl.activeTexture(gl.TEXTURE0);
      uploadVideo(gl, detailTex[2]!, vid);
      gl.bindTexture(gl.TEXTURE_2D, detailTex[2]!);
      gl.uniform1i(gl.getUniformLocation(sparkProg, "uTex"), 0);
      gl.uniform1f(gl.getUniformLocation(sparkProg, "uZoom"), frameZoom);
      gl.uniform2f(gl.getUniformLocation(sparkProg, "uFocus"), 0, frameFocusY);
      gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      instExt.vertexAttribDivisorANGLE(0, 0);
      gl.disableVertexAttribArray(1);
      gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
      gl.bufferData(gl.ARRAY_BUFFER, instScratch.subarray(0, batch.length * 8), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(2);
      gl.enableVertexAttribArray(3);
      gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 0);
      gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 32, 16);
      instExt.vertexAttribDivisorANGLE(2, 1);
      instExt.vertexAttribDivisorANGLE(3, 1);
      instExt.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, 4, batch.length);
      instExt.vertexAttribDivisorANGLE(2, 0);
      instExt.vertexAttribDivisorANGLE(3, 0);
      gl.disableVertexAttribArray(2);
      gl.disableVertexAttribArray(3);
    };
    type Drifter = {
      kind: number;
      x: number;
      z: number;
      h: number;
      vx: number;
      vz: number;
      flip: number;
      size: number;
      seed: number;
      life: number;
      max: number;
    };
    const drifters: Drifter[] = [];
    let flyFront: { x: number; y: number; w: number; h: number; flip: number }[] = [];
    let flyWait = 4;
    const placeDrifter = (kind: number): Drifter => {
      const c = Math.cos(selfAng);
      const s = Math.sin(selfAng);
      const across = Math.random() < 0.5 ? -1 : 1;
      const along = kind === 1 ? 10 + Math.random() * 24 : -1 + Math.random() * 18;
      const side = kind === 1 ? (Math.random() - 0.5) * 36 : (Math.random() - 0.5) * 16;
      const speed = kind === 1 ? 4 + Math.random() * 3 : 0.85 + Math.random() * 0.55;
      const life = kind === 1 ? 16 : 9;
      if (kind === 0) {
        const oc = Math.cos(orbit);
        const os = Math.sin(orbit);
        const across = Math.random() < 0.5 ? -1 : 1;
        const relZ = 1.8 + Math.random() * 2.2;
        const depth = relZ + boltPivot;
        const half = 0.5 * depth * groundXMul;
        const viewX = -across * (half + depth * groundXMul * 0.16);
        const fly = 1.05 + Math.random() * 0.35;
        const span = 20;
        return {
          kind,
          x: worldX + viewX * oc - relZ * os,
          z: worldZ + boltPivot + viewX * os + relZ * oc,
          h: 0.75 + Math.random() * 0.7,
          vx: across * fly * oc,
          vz: across * fly * os,
          flip: across > 0 ? 1 : 0,
          size: 0.46,
          seed: Math.random() * 6.28,
          life: span,
          max: span,
        };
      }
      return {
        kind,
        x: worldX + c * side - s * along,
        z: worldZ + s * side + c * along,
        h: kind === 1 ? 8 + Math.random() * 8 : kind === 0 ? 0.55 + Math.random() * 0.85 : 3 + Math.random() * 5,
        vx: kind === 2 ? 0 : c * across * speed - s * (kind === 0 ? 0.3 : 0),
        vz: kind === 2 ? 0 : s * across * speed + c * (kind === 0 ? 0.3 : 0),
        flip: across > 0 ? 1 : 0,
        size: kind === 1 ? 1.35 : kind === 0 ? 0.46 : 0.34,
        seed: Math.random() * 6.28,
        life,
        max: life,
      };
    };
    type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; r: number; g: number; b: number };
    const sparks: Spark[] = [];
    let sparkAcc = 0;
    const drawSparks = () => {
      const n = Math.min(sparks.length, 96);
      if (!n || !sparkReady) return;
      const side = canvas.width / Math.max(1, canvas.height);
      if (!instExt) {
        gl.useProgram(sparkProg);
        return;
      }
      let o = 0;
      for (let i = 0; i < n; i += 1) {
        const p = sparks[i]!;
        const w = p.size;
        const h = p.size * side;
        instScratch[o++] = p.x - w / 2;
        instScratch[o++] = p.y - h / 2;
        instScratch[o++] = w;
        instScratch[o++] = h;
        instScratch[o++] = p.r;
        instScratch[o++] = p.g;
        instScratch[o++] = p.b;
        instScratch[o++] = p.life / p.max;
      }
      gl.useProgram(sparkProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sparkTex);
      gl.uniform1i(gl.getUniformLocation(sparkProg, "uTex"), 0);
      gl.uniform1f(gl.getUniformLocation(sparkProg, "uZoom"), frameZoom);
      gl.uniform2f(gl.getUniformLocation(sparkProg, "uFocus"), 0, frameFocusY);
      gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      instExt.vertexAttribDivisorANGLE(0, 0);
      gl.disableVertexAttribArray(1);
      gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
      gl.bufferData(gl.ARRAY_BUFFER, instScratch.subarray(0, n * 8), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(2);
      gl.enableVertexAttribArray(3);
      gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 0);
      gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 32, 16);
      instExt.vertexAttribDivisorANGLE(2, 1);
      instExt.vertexAttribDivisorANGLE(3, 1);
      instExt.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, 4, n);
      instExt.vertexAttribDivisorANGLE(2, 0);
      instExt.vertexAttribDivisorANGLE(3, 0);
      gl.disableVertexAttribArray(2);
      gl.disableVertexAttribArray(3);
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
      grove = false;
      setGroveLive(false);
      setGround(LAVA_GROUND);
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
        if (phaseRef.current === "run") begin();
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
      if (hit?.closest(".pyre-cover, button, .pyre-ask, input, textarea")) return;
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
      if (grove && plateV <= 0.08 && grokHit) {
        const onGrok =
          nx >= grokHit.x - 0.03 &&
          nx <= grokHit.x + grokHit.w + 0.03 &&
          ny >= grokHit.y - 0.03 &&
          ny <= grokHit.y + grokHit.h + 0.03;
        if (onGrok) {
          hands.delete(event.pointerId);
          try {
            if (frame.hasPointerCapture(event.pointerId)) frame.releasePointerCapture(event.pointerId);
          } catch {
            /* synthetic */
          }
          plateWish = 0;
          askOpenRef.current = true;
          setAskOpen(true);
          return;
        }
      }
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
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (grove && (vistaHold || outArrived)) {
          if (!drag.axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) drag.axis = Math.abs(dx) > Math.abs(dy) * 0.75 ? "ew" : "ns";
          if (drag.axis === "ew") {
            const next = drag.self + (-dx / width) * TAU;
            selfAng = next;
            orbit = next;
            orbitTarget = next;
            strafeWish = 0;
            plateWish = 0;
            plainPush = null;
          } else if (drag.axis === "ns") {
            const pull = (drag.y - event.clientY) / height;
            plateWish = Math.max(0, Math.min(2.8, pull * 4.4));
            strafeWish = 0;
            plainPush = plateWish > 0.08 ? "run" : null;
            slideTo(event.clientX, drag.x, drag.lane);
          }
          return;
        }
        drag.pts.push({ x: event.clientX, y: event.clientY });
        if (drag.pts.length > 36) drag.pts.splice(1, 1);
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
        if (grove) {
          orbit = selfAng;
          orbitTarget = selfAng;
          profileGo = false;
          chase = false;
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
      if (orbitDrag) {
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
    let frameNow = 0;
    let frameDt = 0.016;
    const windAmp = (x: number, z: number) => {
      const gust = Math.pow(Math.max(0, Math.sin(frameNow * 0.00048)), 2);
      const sway = Math.sin(x * 1.35 + z * 0.85 + frameNow * 0.00155);
      const field = Math.sin(frameNow * 0.00085);
      return (sway * 0.55 + field * 0.4) * (0.45 + gust * 1.5);
    };
    const trample: { x: number; z: number; t: number }[] = [];
    let trampleCarry = 0;

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
      setGroveLive(false);
      grove = false;
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
      grove = false;
      setPhase("citadel");
      setRoomLive(false);
      setPlainLive(false);
      setGroveLive(false);
      setGround(LAVA_GROUND);
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
      grove = false;
      setGroveLive(false);
      setGround(LAVA_GROUND);
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
      warmWorld();
      for (const vid of skyVids) armVid(vid);
      grove = false;
      setGroveLive(false);
      setGround(LAVA_GROUND);
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

    const enterGrove = () => {
      phaseRef.current = "citadel";
      doorMode = "out";
      grove = true;
      doorsLive = false;
      cardShown = true;
      vistaHold = true;
      thunderArmed = false;
      thunderOn = false;
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
      worldX = 0;
      worldZ = 0;
      grovePath.length = 0;
      groveMarks.length = 0;
      pathS = 0;
      pathCursor = 0;
      grassSeen.clear();
      trample.length = 0;
      trampleCarry = 0;
      treeSeen.clear();
      mistSeen.clear();
      shroomSeen.clear();
      dustSeen.clear();
      plateV = 0;
      boltGround = 0;
      plateWish = 0;
      plainPush = null;
      profileGo = false;
      chase = false;
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
      setGroveLive(true);
      setPortalReady(false);
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
      exitVid.pause();
      plainVid.pause();
      boltThunder.pause();
      bolt.pause();
      boltIdle.pause();
      groveRun.pause();
      groveIdle.preload = "auto";
      groveRun.preload = "auto";
      const startGrove = () => playSafe(groveIdle);
      if (groveIdle.readyState >= 2) startGrove();
      else {
        groveIdle.addEventListener("loadeddata", startGrove, { once: true });
        groveIdle.load();
        groveRun.load();
      }
      forestSkies.forEach((vid) => {
        armVid(vid);
        const start = () => playSafe(vid);
        if (vid.readyState >= 2) start();
        else vid.addEventListener("loadeddata", start, { once: true });
      });
      for (const vid of [pathGlowVid, ...treeVids, boleVid, crownVid, grokVid, ...floorVids, ...detailVids, lifeVids[2]!]) {
        armVid(vid);
        const start = () => playSafe(vid);
        if (vid.readyState >= 2) start();
        else vid.addEventListener("loadeddata", start, { once: true });
      }
      breathMix = 0;
      idleOn = true;
    };

    const groveFoot = () => ({ x: worldX, z: worldZ + boltPivot });
    const smooth01 = (t: number) => {
      const x = Math.max(0, Math.min(1, t));
      return x * x * (3 - 2 * x);
    };
    const groveHeading = (s: number) => 0.62 + s * 0.007;
    const groveHash = (n: number) => {
      let x = Math.imul(n | 0, 0x9e3779b1);
      x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
      x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
      return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
    };
    const groveNearest = () => {
      const foot = groveFoot();
      let best = pathCursor;
      let bestD = Infinity;
      for (const p of grovePath) {
        if (p.s < pathCursor - 1.5 || p.s > pathCursor + 6) continue;
        const d = (p.x - foot.x) ** 2 + (p.z - foot.z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = p.s;
        }
      }
      if (best > pathCursor) pathCursor = best;
      return pathCursor;
    };
    const growGrovePath = () => {
      if (!grovePath.length) {
        const foot = groveFoot();
        grovePath.push({ x: foot.x, z: foot.z, s: 0 });
        pathS = 0;
      }
      const speed = Math.max(plateV, 1.7);
      const unit = 1 / GROUND.tileMeters;
      const need = groveNearest() + speed * unit * 7.5;
      const step = 0.45;
      while (pathS < need) {
        const ang = groveHeading(pathS);
        const prev = grovePath[grovePath.length - 1]!;
        const x = prev.x - Math.sin(ang) * step;
        const z = prev.z + Math.cos(ang) * step;
        pathS += step;
        grovePath.push({ x, z, s: pathS });
      }
      const nearest = (px: number, pz: number) => {
        let nearD = 1e9;
        let nearS = 0;
        let nearI = 0;
        for (let i = 0; i < grovePath.length; i += 2) {
          const p = grovePath[i]!;
          const d = Math.hypot(p.x - px, p.z - pz);
          if (d < nearD) {
            nearD = d;
            nearS = p.s;
            nearI = i;
          }
        }
        return { nearD, nearS, nearI };
      };
      const cell = 0.52;
      const ix0 = Math.floor((worldX - 16) / cell);
      const ix1 = Math.floor((worldX + 16) / cell);
      const iz0 = Math.floor((worldZ - 6) / cell);
      const iz1 = Math.floor((worldZ + 28) / cell);
      for (let ix = ix0; ix <= ix1; ix += 1) {
        for (let iz = iz0; iz <= iz1; iz += 1) {
          const key = ix * 8192 + iz;
          if (grassSeen.has(key)) continue;
          const wx = ix * cell;
          const wz = iz * cell;
          const px = wx + simplex2(wx * 1.7 + 8, wz * 1.7) * cell * 0.22;
          const pz = wz + simplex2(wx * 1.7, wz * 1.7 + 8) * cell * 0.22;
          const spot = nearest(px, pz);
          if (spot.nearI >= grovePath.length - 2 || spot.nearD < 1.15) continue;
          grassSeen.add(key);
          const n = key * 3 + 11;
          groveMarks.push({
            x: px,
            z: pz,
            s: spot.nearS,
            kind: 3,
            scale: 1.35 + groveHash(n + 5) * 0.3,
            flip: groveHash(n + 6) > 0.5 ? 1 : 0,
            shade: 0.9 + groveHash(n + 7) * 0.12,
            variant: 0,
            ang: groveHash(n + 8) * 6.2,
          });
        }
      }
      const treeCell = 3.3;
      const tx0 = Math.floor((worldX - 18) / treeCell);
      const tx1 = Math.floor((worldX + 18) / treeCell);
      const tz0 = Math.floor((worldZ - 8) / treeCell);
      const tz1 = Math.floor((worldZ + 30) / treeCell);
      for (let ix = tx0; ix <= tx1; ix += 1) {
        for (let iz = tz0; iz <= tz1; iz += 1) {
          const key = ix * 4096 + iz;
          if (treeSeen.has(key)) continue;
          const wx = ix * treeCell;
          const wz = iz * treeCell;
          const clump = simplex2(wx * 0.055, wz * 0.055);
          const pick = simplex2(wx * 0.41 + 17, wz * 0.41);
          const px = wx + simplex2(wx * 0.77 + 12, wz * 0.77) * treeCell * 0.95;
          const pz = wz + simplex2(wx * 0.77, wz * 0.77 + 12) * treeCell * 0.95;
          const spot = nearest(px, pz);
          if (spot.nearI >= grovePath.length - 2 || spot.nearD < 4.1) continue;
          treeSeen.add(key);
          const n = key * 5 + 3;
          if (pick <= 0.46 - clump * 0.72) {
            const rockN = simplex2(wx * 0.23 + 50, wz * 0.23);
            if (rockN > 0.62) {
              groveMarks.push({
                x: px,
                z: pz,
                s: spot.nearS,
                kind: 1,
                scale: 0.65 + rockN * 0.35,
                flip: 0,
                shade: 0.9,
                variant: 0,
                ang: 0,
              });
            }
            continue;
          }
          groveMarks.push({
            x: px,
            z: pz,
            s: spot.nearS,
            kind: 0,
            scale: 0.82 + Math.max(0, clump) * 0.7,
            flip: groveHash(n) > 0.5 ? 1 : 0,
            shade: 0.74 + groveHash(n + 2) * 0.36,
            variant: Math.floor(groveHash(n + 4) * 3),
            ang: groveHeading(spot.nearS) + groveHash(n + 6) * 1.4,
          });
        }
      }
      const scatter = (
        seen: Set<number>,
        cell: number,
        reachX: number,
        reachZ: number,
        kind: number,
        take: (wx: number, wz: number, spot: { nearD: number; nearS: number; nearI: number }) => boolean,
      ) => {
        const ix0 = Math.floor((worldX - reachX) / cell);
        const ix1 = Math.floor((worldX + reachX) / cell);
        const iz0 = Math.floor((worldZ - 6) / cell);
        const iz1 = Math.floor((worldZ + reachZ) / cell);
        for (let ix = ix0; ix <= ix1; ix += 1) {
          for (let iz = iz0; iz <= iz1; iz += 1) {
            const key = ix * 8192 + iz;
            if (seen.has(key)) continue;
            const wx = ix * cell;
            const wz = iz * cell;
            const jx = simplex2(wx * 0.71 + kind, wz * 0.71) * cell * 0.8;
            const jz = simplex2(wx * 0.71, wz * 0.71 + kind) * cell * 0.8;
            const px = wx + jx;
            const pz = wz + jz;
            const spot = nearest(px, pz);
            if (spot.nearI >= grovePath.length - 2) continue;
            seen.add(key);
            if (!take(px, pz, spot)) continue;
            const n = key * 7 + kind * 13;
            groveMarks.push({
              x: px,
              z: pz,
              s: spot.nearS,
              kind,
              scale: 0.85 + groveHash(n) * 0.35,
              flip: groveHash(n + 3) > 0.5 ? 1 : 0,
              shade: 0.92 + groveHash(n + 5) * 0.1,
              variant: 0,
              ang: groveHash(n + 9) * 6.2,
            });
          }
        }
      };
      scatter(mistSeen, 6.4, 16, 24, 5, (px, pz, spot) => {
        if (spot.nearD < 3.6) return false;
        return simplex2(px * 0.08, pz * 0.08) < -0.34;
      });
      scatter(shroomSeen, 4.6, 16, 24, 6, (_px, _pz, spot) => spot.nearD > 2.75 && spot.nearD < 5.1 && groveHash(spot.nearS * 13 + spot.nearD) > 0.78);
      const keep = groveNearest() - 18;
      while (grovePath.length > 8 && grovePath[1]!.s < keep) grovePath.shift();
      while (groveMarks.length && groveMarks[0]!.s < keep) groveMarks.shift();
    };
    const groveScreen = (wx: number, wz: number) => {
      const c = Math.cos(orbit);
      const s = Math.sin(orbit);
      const dx = wx - worldX;
      const dz = wz - (worldZ + boltPivot);
      const x = dx * c + dz * s;
      const relZ = -dx * s + dz * c;
      const depth = relZ + boltPivot;
      if (depth < 0.8) return null;
      const y = groundHorizon - EYE / depth + groveHeight(wx, wz) / depth;
      if (y < -0.05 || y > groundHorizon + 0.12) return null;
      return { x: 0.5 + x / (depth * groundXMul), y, depth, viewX: x, relZ };
    };
    const paintGrove = () => {
      drawSunRays();
      growGrovePath();
      const paw = groveFoot();
      const fwdX = -Math.sin(selfAng);
      const fwdZ = Math.cos(selfAng);
      if (plateV > 0.12) {
        trampleCarry += plateV * frameDt;
        if (trampleCarry > 0.2) {
          trampleCarry = 0;
          trample.push({ x: paw.x, z: paw.z, t: frameNow });
          if (trample.length > 40) trample.shift();
        }
      }
      const bendGrass = (x: number, z: number) => {
        const dx = x - paw.x;
        const dz = z - paw.z;
        const d = Math.hypot(dx, dz);
        let crush = 0;
        if (d < 2.4) {
          for (let i = trample.length - 1; i >= 0; i -= 1) {
            const step = trample[i]!;
            const age = (frameNow - step.t) / 1000;
            if (age > 4.2) continue;
            const sd = Math.hypot(x - step.x, z - step.z);
            if (sd > 0.9) continue;
            crush = Math.max(crush, (1 - sd / 0.9) * (1 - age / 4.2));
          }
        }
        let ox = 0;
        let oz = 0;
        if (d < 1.45 && d > 0.001) {
          const push = (1 - d / 1.45) ** 1.35;
          const along = dx * fwdX + dz * fwdZ;
          let sideX = dx - fwdX * along;
          let sideZ = dz - fwdZ * along;
          const side = Math.hypot(sideX, sideZ);
          if (side < 0.04) {
            sideX = -fwdZ;
            sideZ = fwdX;
          }
          const sideN = Math.hypot(sideX, sideZ) || 1;
          const away = 1.15 * push;
          ox = (sideX / sideN) * away;
          oz = (sideZ / sideN) * away;
          const under = along > -0.2 && along < 0.7 && side < 0.34;
          crush = Math.max(crush, under ? push : push * 0.42);
        }
        return { ox, oz, crush: Math.min(1, crush) };
      };
      const speed = Math.max(plateV, 1.7);
      const unit = 1 / GROUND.tileMeters;
      const near = groveNearest();
      const lead = near + speed * unit * 0.28;
      const far = near + speed * unit * 3;
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      if (pathGlowVid.readyState >= 2) {
        gl.activeTexture(gl.TEXTURE0);
        uploadVideo(gl, pathGlowTex, pathGlowVid);
        gl.useProgram(ribbonProg);
        gl.bindTexture(gl.TEXTURE_2D, pathGlowTex);
        gl.uniform1i(gl.getUniformLocation(ribbonProg, "uTex"), 0);
        const alpha = gl.getUniformLocation(ribbonProg, "uAlpha");
        const s0 = gl.getUniformLocation(ribbonProg, "uS0");
        const s1 = gl.getUniformLocation(ribbonProg, "uS1");
        const up = gl.getUniformLocation(ribbonProg, "uUp");
        const lit = gl.getUniformLocation(ribbonProg, "uLit");
        for (let i = 0; i < grovePath.length - 1; i += 1) {
          const a = grovePath[i]!;
          const b = grovePath[i + 1]!;
          if (b.s < lead || a.s > far) continue;
          const dx = b.x - a.x;
          const dz = b.z - a.z;
          const len = Math.hypot(dx, dz) || 0.001;
          const rx = dz / len;
          const rz = -dx / len;
          const half = 2.4;
          const leftA = groveScreen(a.x + rx * half, a.z + rz * half);
          const rightA = groveScreen(a.x - rx * half, a.z - rz * half);
          const leftB = groveScreen(b.x + rx * half, b.z + rz * half);
          const rightB = groveScreen(b.x - rx * half, b.z - rz * half);
          if (!leftA || !rightA || !leftB || !rightB) continue;
          const mid = (a.s + b.s) * 0.5;
          const t = (mid - lead) / Math.max(0.001, far - lead);
          const fade = Math.min(smooth01(t / 0.12), smooth01((1 - t) / 0.16));
          if (fade < 0.04) continue;
          gl.uniform1f(s0, a.s);
          gl.uniform1f(s1, b.s);
          gl.uniform1f(up, 0);
          gl.uniform1f(lit, rx * SUN_X + rz * SUN_Z);
          gl.uniform1f(alpha, fade);
          drawBuffer(groundRibbon(rightA.x, rightA.y, rightB.x, rightB.y, leftA.x, leftA.y, leftB.x, leftB.y));
        }
      }
      for (let i = 0; i < treeVids.length; i += 1) {
        const vid = treeVids[i]!;
        if (vid.readyState < 2) continue;
        if (vid.videoWidth > 0) treeAspects[i] = vid.videoWidth / vid.videoHeight;
        gl.activeTexture(gl.TEXTURE0);
        uploadVideo(gl, treeTex[i]!, vid);
      }
      if (boleVid.readyState >= 2) uploadVideo(gl, boleTex, boleVid);
      if (crownVid.readyState >= 2) uploadVideo(gl, crownTex, crownVid);
      for (let i = 0; i < floorVids.length; i += 1) {
        const vid = floorVids[i]!;
        if (vid.readyState < 2) continue;
        if (vid.videoWidth > 0) floorAspects[i] = vid.videoWidth / vid.videoHeight;
        gl.activeTexture(gl.TEXTURE0);
        uploadVideo(gl, floorTex[i]!, vid);
      }
      for (let i = 0; i < detailVids.length; i += 1) {
        const vid = detailVids[i]!;
        if (vid.readyState < 2) continue;
        gl.activeTexture(gl.TEXTURE0);
        uploadVideo(gl, detailTex[i]!, vid);
      }
      if (!boulderReady && boulderImg.complete && boulderImg.naturalWidth > 0) {
        upload(gl, boulderTex, boulderImg);
        boulderReady = true;
      }
      const aspect = canvas.height / Math.max(1, canvas.width);
      const air: { depth: number; kind: number; x: number; y: number; w: number; h: number; flip: number }[] = [];
      const front: { x: number; y: number; w: number; h: number; flip: number }[] = [];
      for (const d of drifters) {
        const at = groveScreen(d.x, d.z);
        if (!at) continue;
        const edge = d.kind === 0 ? 0.55 : 0.3;
        if (at.x < -edge || at.x > 1 + edge) continue;
        const imgAspect = d.kind === 1 ? 16 / 9 : 1;
        const hs = Math.min(d.kind === 1 ? 0.1 : 0.085, d.size / at.depth);
        if (hs < 0.008) continue;
        const w = hs * imgAspect * aspect;
        const foot = 1 - at.y;
        const rise = Math.min(d.kind === 1 ? 0.32 : 0.48, d.h / at.depth);
        const card = {
          depth: at.depth,
          kind: d.kind,
          x: at.x - w / 2,
          y: foot - rise - hs,
          w,
          h: hs,
          flip: d.flip,
        };
        if (d.kind === 0) front.push(card);
        else air.push(card);
      }
      air.sort((a, b) => b.depth - a.depth);
      flyFront = front;
      const lifeUp = [false, false, false];
      let airI = 0;
      const drawAir = (card: { kind: number; x: number; y: number; w: number; h: number; flip: number; depth: number }) => {
        const vid = lifeVids[card.kind];
        const tex = lifeTex[card.kind];
        if (!vid || !tex || vid.readyState < 2) return;
        if (!lifeUp[card.kind]) {
          uploadVideo(gl, tex, vid);
          lifeUp[card.kind] = true;
        }
        flushGrass();
        gl.useProgram(markProg);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(gl.getUniformLocation(markProg, "uTex"), 0);
        gl.uniform1f(gl.getUniformLocation(markProg, "uKey"), 1);
        gl.uniform1f(gl.getUniformLocation(markProg, "uAlpha"), 1);
        gl.uniform1f(gl.getUniformLocation(markProg, "uFlip"), card.flip);
        gl.uniform1f(gl.getUniformLocation(markProg, "uShade"), (card.kind === 1 ? 1.02 : 0.92) * sunBillboard);
        gl.uniform1f(gl.getUniformLocation(markProg, "uSide"), sunSide);
        gl.uniform1f(gl.getUniformLocation(markProg, "uFog"), card.kind === 1 ? 0.22 : fogFor(card.depth));
        gl.uniform1f(gl.getUniformLocation(markProg, "uWind"), 0);
        drawBuffer(quad(card.x, card.y, card.w, card.h));
      };
      const flushAir = (limit: number) => {
        while (airI < air.length && air[airI]!.depth > limit) drawAir(air[airI++]!);
      };
      const lookX = -Math.sin(orbit);
      const lookZ = Math.cos(orbit);
      const sunAmt = (nd: number) => {
        const t = Math.max(0, Math.min(1, nd));
        return 0.58 + 0.55 * t;
      };
      const sunBillboard = sunAmt((lookX * SUN_X + lookZ * SUN_Z) * 0.5 + 0.5);
      const sunCard = (ang: number) => sunAmt(Math.abs(Math.cos(ang) * SUN_X + Math.sin(ang) * SUN_Z));
      const aim = skyLock;
      liveSunSide = aim ? Math.max(-1.3, Math.min(1.3, (aim.x - 0.5) * 2.6)) : 0;
      const sunSide = liveSunSide;
      gl.useProgram(markProg);
      gl.uniform1f(gl.getUniformLocation(markProg, "uSide"), sunSide);
      const drawn = groveMarks
        .map((mark) => ({ mark, at: groveScreen(mark.x, mark.z) }))
        .filter((row): row is { mark: (typeof groveMarks)[number]; at: { x: number; y: number; depth: number } } => {
          if (!row.at) return false;
          return row.at.x > -0.35 && row.at.x < 1.35;
        })
        .sort((a, b) => b.at.depth - a.at.depth);
      const grassBatch: Card[] = [];
      const flatBatch: Card[] = [];
      const flushGrass = () => {
        const tex = floorTex[1];
        if (grassBatch.length && tex && floorVids[1]!.readyState >= 2) drawCards(tex, [0.04, 0.96, 0.04, 0.9], grassBatch);
        if (flatBatch.length && flatImg.complete && flatImg.naturalWidth > 0) {
          if (!flatSent) {
            upload(gl, flatTex, flatImg);
            flatSent = true;
          }
          drawCards(flatTex, [0, 1, 0, 1], flatBatch);
        }
        grassBatch.length = 0;
        flatBatch.length = 0;
      };
      const trees: { x: number; z: number }[] = [];
      for (let i = 0; i < groveMarks.length; i += 1) {
        const m = groveMarks[i]!;
        if (m.kind === 0) trees.push(m);
      }
      const inTreeShade = (x: number, z: number) => {
        for (let i = 0; i < trees.length; i += 1) {
          const m = trees[i]!;
          const dx = m.x - x;
          const dz = m.z - z;
          if (dx * dx + dz * dz > 36) continue;
          const along = dx * SUN_X + dz * SUN_Z;
          if (along < 0.4 || along > 5) continue;
          const side = dx * SUN_Z - dz * SUN_X;
          if (side * side < 0.75) return true;
        }
        return false;
      };
      const fogFor = (depth: number) => smooth01((depth - 11) / 26);
      const grokWorld =
        grove && grokOnRef.current && plateV <= 0.08 && grokVid.readyState >= 2
          ? groveScreen(
              worldX - Math.cos(orbit) * 1.25 + Math.sin(orbit) * 0.2,
              worldZ + boltPivot - Math.sin(orbit) * 1.25 - Math.cos(orbit) * 0.2,
            )
          : null;
      if (!grokWorld) grokHit = null;
      if (plateV > 0.08 && askOpenRef.current) {
        askOpenRef.current = false;
        setAskOpen(false);
      }
      let grokDrawn = false;
      const drawGrok = (at: { x: number; y: number; depth: number }) => {
        flushGrass();
        gl.useProgram(markProg);
        gl.activeTexture(gl.TEXTURE0);
        uploadVideo(gl, grokTex, grokVid);
        gl.bindTexture(gl.TEXTURE_2D, grokTex);
        gl.uniform1i(gl.getUniformLocation(markProg, "uTex"), 0);
        gl.uniform1f(gl.getUniformLocation(markProg, "uKey"), 1);
        gl.uniform1f(gl.getUniformLocation(markProg, "uAlpha"), 1);
        gl.uniform1f(gl.getUniformLocation(markProg, "uFlip"), 0);
        gl.uniform1f(gl.getUniformLocation(markProg, "uShade"), 1.2);
        gl.uniform1f(gl.getUniformLocation(markProg, "uFog"), fogFor(at.depth));
        const h = Math.min(0.4, 1.35 / at.depth);
        const imgAspect = grokVid.videoWidth > 0 ? grokVid.videoWidth / grokVid.videoHeight : 0.56;
        const w = h * imgAspect * aspect;
        const foot = 1 - at.y;
        const x = at.x - w / 2;
        const y = foot - h;
        grokHit = { x, y, w, h };
        drawBuffer(quad(x, y, w, h));
      };
      for (const row of drawn) {
        flushAir(row.at.depth);
        if (grokWorld && !grokDrawn && row.at.depth < grokWorld.depth) {
          drawGrok(grokWorld);
          grokDrawn = true;
        }
        gl.useProgram(markProg);
        gl.uniform1f(gl.getUniformLocation(markProg, "uFog"), fogFor(row.at.depth));
        gl.uniform1f(gl.getUniformLocation(markProg, "uWind"), 0.0);
        gl.uniform1f(gl.getUniformLocation(markProg, "uFlick"), frameNow * 0.004);
        if (row.mark.kind !== 3) flushGrass();
        if (row.mark.kind >= 5) {
          if (row.mark.kind === 7) continue;
          const slot = row.mark.kind - 5;
          const vid = detailVids[slot];
          if (!vid || vid.readyState < 2) continue;
          const dy = groundHorizon - row.at.y;
          if (dy < 0.01) continue;
          const lod = smooth01(Math.min(1, (dy - 0.01) / 0.04));
          const mist = row.mark.kind === 5;
          const shroom = row.mark.kind === 6;
          const worldH = mist ? 0.22 : shroom ? 0.52 : 1.15;
          const cap = mist ? 0.026 : shroom ? 0.05 : 0.11;
          const h = Math.min(cap, (worldH * row.mark.scale) / row.at.depth);
          if (h < 0.01) continue;
          const imgAspect = mist ? 7.5 : shroom ? 0.67 : 1;
          const w = h * imgAspect * aspect;
          const foot = 1 - row.at.y;
          const lift = row.mark.kind === 7 ? h * 2.1 : 0;
          if (row.mark.kind === 7) gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
          gl.useProgram(markProg);
          gl.bindTexture(gl.TEXTURE_2D, detailTex[slot]!);
          gl.uniform1i(gl.getUniformLocation(markProg, "uTex"), 0);
          gl.uniform1f(gl.getUniformLocation(markProg, "uKey"), 1);
          if (shroom) {
            const worldHalf = (w * groundXMul * row.at.depth) / 2 * 0.65;
            const ang = row.mark.ang + Math.PI / 4;
            const dirs = [
              [Math.cos(ang), Math.sin(ang)],
              [-Math.sin(ang), Math.cos(ang)],
            ];
            let side: { dx: number; dz: number; face: number; flip: number } | null = null;
            dirs.forEach(([dx, dz], i) => {
              const face = Math.abs(-dz! * lookX + dx! * lookZ);
              const score = face * (1 - face);
              if (!side || score > side.face * (1 - side.face)) side = { dx: dx!, dz: dz!, face, flip: i === 0 ? row.mark.flip : 1 - row.mark.flip };
            });
            if (side && side.face > 0.18 && side.face < 0.82) {
              const left = groveScreen(row.mark.x - side.dx * worldHalf, row.mark.z - side.dz * worldHalf);
              const right = groveScreen(row.mark.x + side.dx * worldHalf, row.mark.z + side.dz * worldHalf);
              if (left && right) {
                gl.uniform1f(gl.getUniformLocation(markProg, "uAlpha"), lod * 0.8);
                gl.uniform1f(gl.getUniformLocation(markProg, "uFlip"), side.flip);
                gl.uniform1f(gl.getUniformLocation(markProg, "uShade"), row.mark.shade * 0.85);
                drawBuffer(groundRibbon(left.x, left.y, left.x, left.y + h, right.x, right.y, right.x, right.y + h));
              }
            }
          }
          gl.uniform1f(gl.getUniformLocation(markProg, "uAlpha"), lod * (mist ? 0.38 : 1));
          gl.uniform1f(gl.getUniformLocation(markProg, "uFlip"), row.mark.flip);
          gl.uniform1f(gl.getUniformLocation(markProg, "uShade"), (row.mark.kind === 7 ? 1.05 : row.mark.shade) * sunBillboard);
          drawBuffer(mist
            ? quadUV(row.at.x - w / 2, foot - h * 0.35, w, h, 0.08, 0.4, 0.92, 0.62)
            : quad(row.at.x - w / 2, foot - h - lift, w, h));
          if (row.mark.kind === 7) gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
          continue;
        }
        if (row.mark.kind >= 2) {
          const slot = row.mark.kind === 3 ? 1 : row.mark.kind === 4 ? 2 : 0;
          const vid = floorVids[slot]!;
          if (vid.readyState < 2) continue;
          const dy = groundHorizon - row.at.y;
          if (dy < 0.01) continue;
          const lod = smooth01(Math.min(1, (dy - 0.01) / 0.04));
          const worldH = row.mark.kind === 3 ? 0.72 : row.mark.kind === 2 ? 0.7 : 0.32;
          const cap = row.mark.kind === 3 ? 0.13 : row.mark.kind === 2 ? 0.13 : 0.045;
          const h = Math.min(cap, (worldH * row.mark.scale) / row.at.depth);
          if (h < 0.012 || (row.mark.kind === 3 && h < 0.02)) continue;
          const imgAspect = row.mark.kind === 3 ? 1.08 : floorAspects[slot]!;
          const w = h * imgAspect * aspect;
          const foot = 1 - row.at.y + Math.min(0.006, h * 0.05);
          if (row.mark.kind === 3) {
            const bend = bendGrass(row.mark.x, row.mark.z);
            const stood = bend.ox || bend.oz ? groveScreen(row.mark.x + bend.ox, row.mark.z + bend.oz) : row.at;
            if (!stood) continue;
            const crush = bend.crush;
            const squat = 1 - crush * 0.55;
            const h2 = h * squat;
            const w2 = w * (1 + crush * 0.15);
            const foot2 = 1 - stood.y + Math.min(0.006, h2 * 0.05);
            const shade = row.mark.shade * sunBillboard * (row.at.depth < 9 && inTreeShade(row.mark.x, row.mark.z) ? 0.58 : 1);
            const lean = windAmp(row.mark.x, row.mark.z) * h2 * (1 - crush * 0.94);
            if (crush < 0.92) {
              grassBatch.push({
                x: stood.x - w2 / 2,
                y: foot2 - h2,
                w: w2,
                h: h2,
                flip: row.mark.flip,
                shade,
                alpha: lod * (1 - crush),
                fog: fogFor(row.at.depth),
                lean,
              });
            }
            if (crush > 0.08) {
              const flatH = h * 0.38;
              const flatW = flatH * (1206 / 370) * aspect;
              const flatFoot = 1 - stood.y + Math.min(0.006, flatH * 0.05);
              flatBatch.push({
                x: stood.x - flatW / 2,
                y: flatFoot - flatH,
                w: flatW,
                h: flatH,
                flip: row.mark.flip,
                shade: shade * 0.92,
                alpha: lod * Math.min(1, crush * 1.25),
                fog: fogFor(row.at.depth),
                lean: lean * 0.25,
              });
            }
            continue;
          }
          gl.useProgram(markProg);
          gl.bindTexture(gl.TEXTURE_2D, floorTex[slot]!);
          gl.uniform1i(gl.getUniformLocation(markProg, "uTex"), 0);
          gl.uniform1f(gl.getUniformLocation(markProg, "uKey"), 1);
          const worldHalf = (w * groundXMul * row.at.depth) / 2 * 0.7;
          const ang = row.mark.ang + Math.PI / 4;
          const dirs = [
            [Math.cos(ang), Math.sin(ang)],
            [-Math.sin(ang), Math.cos(ang)],
          ];
          let side: { dx: number; dz: number; face: number; flip: number } | null = null;
          dirs.forEach(([dx, dz], i) => {
            const face = Math.abs(-dz! * lookX + dx! * lookZ);
            const score = face * (1 - face);
            if (!side || score > side.face * (1 - side.face)) side = { dx: dx!, dz: dz!, face, flip: i === 0 ? row.mark.flip : 1 - row.mark.flip };
          });
          if (row.mark.kind !== 3 && side && side.face > 0.18 && side.face < 0.82) {
            const thick = side.face * (1 - side.face) * 4;
            const near = (px: number, pz: number) => {
              let p = groveScreen(row.mark.x + px, row.mark.z + pz);
              if (p && p.depth < row.at.depth * 0.75) p = groveScreen(row.mark.x + px * 0.45, row.mark.z + pz * 0.45);
              return p;
            };
            const left = near(-side.dx * worldHalf, -side.dz * worldHalf);
            const right = near(side.dx * worldHalf, side.dz * worldHalf);
            if (left && right && thick > 0.2) {
              gl.uniform1f(gl.getUniformLocation(markProg, "uAlpha"), lod * thick * 0.85);
              gl.uniform1f(gl.getUniformLocation(markProg, "uFlip"), side.flip);
              gl.uniform1f(gl.getUniformLocation(markProg, "uShade"), row.mark.shade * 0.8);
              drawBuffer(groundRibbon(
                left.x, left.y,
                left.x, left.y + h,
                right.x, right.y,
                right.x, right.y + h,
              ));
            }
          }
          gl.uniform1f(gl.getUniformLocation(markProg, "uAlpha"), lod);
          gl.uniform1f(gl.getUniformLocation(markProg, "uFlip"), row.mark.flip);
          gl.uniform1f(gl.getUniformLocation(markProg, "uShade"), row.mark.shade * sunBillboard * sunCard(row.mark.ang));
          const card = row.mark.kind === 3
            ? quadUV(row.at.x - w / 2, foot - h, w, h, 0.12, 0.0, 0.88, 0.56)
            : quad(row.at.x - w / 2, foot - h, w, h);
          drawBuffer(card);
          continue;
        }
        const rock = row.mark.kind === 1;
        const variant = row.mark.variant % 3;
        const treeReady = treeVids[variant]!.readyState >= 2;
        if (rock ? !boulderReady : !treeReady) continue;
        const dy = groundHorizon - row.at.y;
        if (dy < 0.012) continue;
        const treeH = 4.8;
        const h = ((rock ? 0.9 : treeH) * row.mark.scale) / row.at.depth;
        if (h < 0.02) continue;
        const turnReady = false;
        const w = h * (rock ? 1.55 : turnReady ? 768 / 1168 : treeAspects[variant]!) * aspect;
        const sink = rock ? h * 0.08 : Math.min(0.008, h * 0.03);
        const foot = 1 - row.at.y + sink;
        const lod = Math.max(0.82, smooth01(Math.min(1, (dy - 0.012) / 0.045)));
        if (row.at.depth < 14) {
          const len = rock ? 1.35 : 2.8;
          const tip = groveScreen(row.mark.x - SUN_X * len, row.mark.z - SUN_Z * len);
          gl.useProgram(shadowProg);
          if (tip) {
            const x0 = row.at.x;
            const y0 = row.at.y;
            const dx = tip.x - x0;
            const dy = tip.y - y0;
            const span = Math.hypot(dx, dy) || 0.001;
            const hw = w * (rock ? 0.22 : 0.16);
            const px = (-dy / span) * hw;
            const py = (dx / span) * hw;
            drawBuffer(groundRibbon(x0 + px, y0 + py, x0 - px, y0 - py, tip.x + px, tip.y + py, tip.x - px, tip.y - py));
          }
        }
        gl.useProgram(markProg);
        gl.bindTexture(gl.TEXTURE_2D, rock ? boulderTex : treeTex[variant]!);
        gl.uniform1i(gl.getUniformLocation(markProg, "uTex"), 0);
        gl.uniform1f(gl.getUniformLocation(markProg, "uShade"), row.mark.shade * sunBillboard * (rock ? 1 : sunCard(row.mark.ang)));
        gl.uniform1f(gl.getUniformLocation(markProg, "uKey"), rock ? 0 : 1);
        if (!rock && turnReady) {
          const worldHalf = (treeH * row.mark.scale * treeAspects[variant]! * aspect * groundXMul) / 2;
          const ang = row.mark.ang + Math.PI / 4;
          const dirs = [
            [Math.cos(ang), Math.sin(ang)],
            [-Math.sin(ang), Math.cos(ang)],
          ];
          let side: { dx: number; dz: number; face: number; flip: number } | null = null;
          dirs.forEach(([dx, dz], i) => {
            const face = Math.abs(-dz! * lookX + dx! * lookZ);
            const score = face * (1 - face);
            if (!side || score > side.face * (1 - side.face)) side = { dx: dx!, dz: dz!, face, flip: i === 0 ? row.mark.flip : 1 - row.mark.flip };
          });
          if (side) {
            const span = side.face < 0.28 || side.face > 0.72 ? 0 : worldHalf * 0.75;
            const near = (px: number, pz: number) => {
              let p = groveScreen(row.mark.x + px, row.mark.z + pz);
              if (p && p.depth < row.at.depth * 0.75) p = groveScreen(row.mark.x + px * 0.45, row.mark.z + pz * 0.45);
              return p;
            };
            const left = span > 0 ? near(-side.dx * span, -side.dz * span) : null;
            const right = span > 0 ? near(side.dx * span, side.dz * span) : null;
            const thick = side.face * (1 - side.face) * 4;
            if (left && right && thick > 0.08) {
              const hT = (treeH * row.mark.scale) / row.at.depth;
              const sinkT = Math.min(0.008, hT * 0.03);
              gl.uniform1f(gl.getUniformLocation(markProg, "uAlpha"), lod * Math.max(0.45, thick));
              gl.uniform1f(gl.getUniformLocation(markProg, "uFlip"), side.flip);
              gl.uniform1f(gl.getUniformLocation(markProg, "uShade"), row.mark.shade * sunCard(row.mark.ang) * 0.82);
              drawBuffer(groundRibbon(
                left.x, left.y - sinkT,
                left.x, left.y - sinkT + hT,
                right.x, right.y - sinkT,
                right.x, right.y - sinkT + hT,
              ));
            }
          }
        }
        gl.uniform1f(gl.getUniformLocation(markProg, "uAlpha"), lod);
        gl.uniform1f(gl.getUniformLocation(markProg, "uFlip"), row.mark.flip);
        gl.uniform1f(gl.getUniformLocation(markProg, "uShade"), row.mark.shade * sunBillboard * (rock ? 1 : sunCard(row.mark.ang)));
        gl.uniform1f(gl.getUniformLocation(markProg, "uSide"), sunSide);
        if (!rock && turnReady) {
          if (!turnSent) {
            turnImg.forEach((img, i) => upload(gl, turnTex[i]!, img));
            depthImg.forEach((img, i) => upload(gl, depthTex[i]!, img));
            turnSent = true;
          }
          const dx = worldX - row.mark.x;
          const dz = worldZ + boltPivot - row.mark.z;
          let rel = Math.atan2(dx, dz) - row.mark.ang;
          rel = Math.atan2(Math.sin(rel), Math.cos(rel));
          let flipTurn = rel < 0 ? 1 : 0;
          let angAbs = Math.abs(rel);
          if (angAbs > Math.PI / 2) {
            angAbs = Math.PI - angAbs;
            flipTurn = 1 - flipTurn;
          }
          const step = (Math.PI / 2) / 5;
          const target = Math.round(Math.min(5, angAbs / step));
          const held = turnHold.get(row.mark);
          let frame = held ?? target;
          if (held !== undefined && Math.abs(angAbs / step - held) > 2.4) frame = target;
          turnHold.set(row.mark, frame);
          const i0 = frame;
          const residual = Math.max(-1, Math.min(1, (angAbs / step - frame) / 1.6));
          const parallax = residual * 0.03;
          const barkReady = barkImg.complete && barkImg.naturalWidth > 0;
          const tube = 0;
          if (tube > 0.04) {
            if (!barkSent) {
              upload(gl, barkTex, barkImg);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
              barkSent = true;
            }
            const worldHalf = (w * groundXMul * row.at.depth) / 2;
            const yaw = row.mark.ang;
            const sideX = Math.cos(yaw);
            const sideZ = -Math.sin(yaw);
            const fwdX = Math.sin(yaw);
            const fwdZ = Math.cos(yaw);
            const halfW = worldHalf * 0.36;
            const halfD = worldHalf * 0.26;
            const trunkH = 0.5;
            gl.useProgram(treeTurnProg);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, turnTex[i0]!);
            gl.uniform1i(gl.getUniformLocation(treeTurnProg, "uTex"), 0);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, depthTex[i0]!);
            gl.uniform1i(gl.getUniformLocation(treeTurnProg, "uDepth"), 1);
            gl.uniform1f(gl.getUniformLocation(treeTurnProg, "uParallax"), 0);
            gl.uniform1f(gl.getUniformLocation(treeTurnProg, "uTube"), 0);
            gl.uniform1f(gl.getUniformLocation(treeTurnProg, "uAlpha"), lod * tube);
            gl.uniform1f(gl.getUniformLocation(treeTurnProg, "uSide"), 0);
            gl.uniform1f(gl.getUniformLocation(treeTurnProg, "uFlip"), 0);
            gl.uniform1f(gl.getUniformLocation(treeTurnProg, "uRepeat"), 0);
            gl.uniform1f(gl.getUniformLocation(treeTurnProg, "uLo"), 0);
            gl.uniform1f(gl.getUniformLocation(treeTurnProg, "uHi"), -1);
            gl.uniform1f(gl.getUniformLocation(treeTurnProg, "uFog"), fogFor(row.at.depth));
            const place = (sx: number, dz: number, frac: number) => {
              const p = groveScreen(row.mark.x + sideX * sx + fwdX * dz, row.mark.z + sideZ * sx + fwdZ * dz);
              if (!p) return null;
              return { x: p.x, y: p.y + h * trunkH * frac * (row.at.depth / p.depth) };
            };
            const slabs = [
              [-halfW, -halfD, halfW, -halfD, 0.34, 0.66, 1],
              [halfW, halfD, -halfW, halfD, 0.34, 0.66, 0.72],
              [-halfW, halfD, -halfW, -halfD, 0.36, 0.42, 0.62],
              [halfW, -halfD, halfW, halfD, 0.58, 0.64, 0.62],
            ];
            for (const [x0, z0, x1, z1, u0, u1, lit] of slabs) {
              const a = place(x0, z0, 0);
              const b = place(x0, z0, 1);
              const c = place(x1, z1, 0);
              const d = place(x1, z1, 1);
              if (!a || !b || !c || !d) continue;
              gl.uniform1f(gl.getUniformLocation(treeTurnProg, "uShade"), row.mark.shade * lit);
              drawBuffer(ribbonUV(
                a.x, a.y, u0, 0,
                b.x, b.y, u0, trunkH,
                c.x, c.y, u1, 0,
                d.x, d.y, u1, trunkH,
              ));
            }
          }
          gl.useProgram(treeTurnProg);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, turnTex[i0]!);
          gl.uniform1i(gl.getUniformLocation(treeTurnProg, "uTex"), 0);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, depthTex[i0]!);
          gl.uniform1i(gl.getUniformLocation(treeTurnProg, "uDepth"), 1);
          gl.uniform1f(gl.getUniformLocation(treeTurnProg, "uParallax"), parallax);
          gl.uniform1f(gl.getUniformLocation(treeTurnProg, "uAlpha"), lod);
          gl.uniform1f(gl.getUniformLocation(treeTurnProg, "uFlip"), flipTurn);
          gl.uniform1f(gl.getUniformLocation(treeTurnProg, "uShade"), row.mark.shade * sunCard(row.mark.ang));
          gl.uniform1f(gl.getUniformLocation(treeTurnProg, "uSide"), sunSide);
          gl.uniform1f(gl.getUniformLocation(treeTurnProg, "uFog"), fogFor(row.at.depth));
          gl.uniform1f(gl.getUniformLocation(treeTurnProg, "uRepeat"), 0);
          gl.uniform1f(gl.getUniformLocation(treeTurnProg, "uTube"), tube);
          gl.uniform1f(gl.getUniformLocation(treeTurnProg, "uLo"), 0);
          gl.uniform1f(gl.getUniformLocation(treeTurnProg, "uHi"), -1);
          gl.activeTexture(gl.TEXTURE0);
          drawBuffer(quad(row.at.x - w / 2, foot - h, w, h));
        } else if (!rock && row.at.depth < 12 && boleVid.readyState >= 2 && crownVid.readyState >= 2) {
          const partAspect = (boleVid.videoWidth > 0 ? boleVid.videoWidth / boleVid.videoHeight : 768 / 1168);
          const pw = h * partAspect * aspect;
          const boleH = h * 0.62;
          gl.bindTexture(gl.TEXTURE_2D, boleTex);
          drawBuffer(quad(row.at.x - pw / 2, foot - boleH, pw, boleH));
          const closer = groveScreen(row.mark.x - lookX * 1.1, row.mark.z - lookZ * 1.1);
          const slide = closer ? (closer.x - row.at.x) * 0.4 : 0;
          gl.uniform1f(gl.getUniformLocation(markProg, "uWind"), (windAmp(row.mark.x, row.mark.z) * 0.55 + Math.sin(frameNow * 0.0031 + row.mark.x * 0.4) * 0.7) * 0.034);
          gl.bindTexture(gl.TEXTURE_2D, crownTex);
          drawBuffer(quad(row.at.x + slide - pw / 2, foot - h, pw, h));
        } else {
          if (!rock) gl.uniform1f(gl.getUniformLocation(markProg, "uWind"), (windAmp(row.mark.x, row.mark.z) * 0.55 + Math.sin(frameNow * 0.0031 + row.mark.x * 0.4) * 0.7) * 0.03);
          drawBuffer(rock
            ? quadUV(row.at.x - w / 2, foot - h, w, h, 0.15, 0.28, 0.85, 0.74)
            : quad(row.at.x - w / 2, foot - h, w, h));
        }
      }
      flushGrass();
      flushAir(-1);
      if (grokWorld && !grokDrawn) drawGrok(grokWorld);
    };

    const sunPlace = () => {
      const vx = SUN_X * Math.cos(orbit) + SUN_Z * Math.sin(orbit);
      const vz = -SUN_X * Math.sin(orbit) + SUN_Z * Math.cos(orbit);
      const glare = smooth01((vz - 0.78) / 0.2);
      const x = 0.5 + (vx / Math.max(0.35, vz)) * 0.38 - 0.16;
      return { x, y: 0.27, glare, vz };
    };
    const drawSunRays = () => {
      const sun = skyLock;
      if (!sun || sun.vis < 0.05) return;
      if (!sunImg.complete || sunImg.naturalWidth < 2) return;
      if (!sunSent) {
        upload(gl, sunTex, sunImg);
        sunSent = true;
      }
      const side = canvas.width / Math.max(1, canvas.height);
      const w = 1.42;
      const originV = 0.893;
      const v1 = 0.97;
      const aspect = (sunImg.naturalHeight / sunImg.naturalWidth) * side;
      const h = w * aspect * v1;
      const x = sun.x - w * 0.503;
      const y = sun.y - ((v1 - originV) / v1) * h;
      const disc = 0.046;
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.useProgram(shaftProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sunTex);
      gl.uniform1i(gl.getUniformLocation(shaftProg, "uTex"), 0);
      gl.uniform2f(gl.getUniformLocation(shaftProg, "uOrigin"), 0.503, originV);
      gl.uniform2f(gl.getUniformLocation(shaftProg, "uRad"), disc / w, (disc * v1) / h);
      gl.uniform1f(gl.getUniformLocation(shaftProg, "uAlpha"), 0.2 * sun.vis);
      drawBuffer(quadUV(x, y, w, h, 0, 0, 1, v1));
      drawSunGlow(1, 0);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    };
    const drawSunGlow = (world: number, look: number) => {
      const sun = skyLock;
      if (!sun || sun.vis < 0.05 || (world < 0.01 && look < 0.01)) return;
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.useProgram(glareProg);
      gl.uniform2f(gl.getUniformLocation(glareProg, "uSun"), sun.x, 1 - sun.y);
      gl.uniform1f(gl.getUniformLocation(glareProg, "uAspect"), canvas.width / Math.max(1, canvas.height));
      gl.uniform1f(gl.getUniformLocation(glareProg, "uWorld"), world * sun.vis);
      gl.uniform1f(gl.getUniformLocation(glareProg, "uLook"), look * sun.vis);
      drawBuffer(FULL);
    };
    const decorPinned = new WeakSet<HTMLVideoElement>();
    const tick = (now: number) => {
      if (phaseRef.current === "cover") {
        raf = requestAnimationFrame(tick);
        return;
      }
      try {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      frameNow = now;
      frameDt = dt;
      if (grove) {
        for (let i = sparks.length - 1; i >= 0; i -= 1) {
          const mote = sparks[i]!;
          mote.life -= dt;
          if (mote.life <= 0) {
            sparks.splice(i, 1);
            continue;
          }
          mote.x += mote.vx * dt;
          mote.y += mote.vy * dt;
        }
        sparkAcc += dt * (0.55 + Math.max(0, plateV) * 7);
        const paw = boltBox();
        while (sparkAcc > 1 && sparks.length < 72) {
          sparkAcc -= 1;
          const roll = Math.random();
          const dust = roll < 0.42;
          const hot = !dust && roll > 0.72;
          const tint = dust ? [0.62, 0.48, 0.28] : hot ? [1, 0.86, 0.4] : [1, 0.3, 0.06];
          const life = dust ? 0.5 + Math.random() * 0.4 : 0.26 + Math.random() * 0.32;
          sparks.push({
            x: paw.x + paw.w * (0.3 + Math.random() * 0.4),
            y: paw.footY + (dust ? 0.012 : -0.018),
            vx: (Math.random() - 0.5) * (dust ? 0.24 : 0.09),
            vy: dust ? 0.04 + Math.random() * 0.07 : -(0.07 + Math.random() * 0.2),
            life,
            max: life,
            size: dust ? 0.038 + Math.random() * 0.028 : 0.013 + Math.random() * 0.016,
            r: tint[0]!,
            g: tint[1]!,
            b: tint[2]!,
          });
        }
        if (sparkAcc > 4) sparkAcc = 0;
        const gust = Math.pow(Math.max(0, Math.sin(now * 0.00048)), 2);
        const push = 0.7 + gust * 2.6;
        const windX = Math.cos(selfAng);
        const windZ = Math.sin(selfAng);
        for (let i = motes.length - 1; i >= 0; i -= 1) {
          const mote = motes[i]!;
          mote.life -= dt;
          const sway = Math.sin(now * 0.00155 + mote.seed);
          mote.x += (windX * push + sway * 0.45) * dt;
          mote.z += windZ * push * dt;
          mote.h += Math.sin(now * 0.0013 + mote.seed) * 0.45 * dt;
          const dx = mote.x - worldX;
          const dz = mote.z - worldZ;
          if (mote.life <= 0 || dx * dx + dz * dz > 420 || mote.h < 0.15) motes.splice(i, 1);
        }
        while (motes.length < 128) spawnMote(true);
        for (let i = drifters.length - 1; i >= 0; i -= 1) {
          const d = drifters[i]!;
          d.life -= dt;
          const sway = Math.sin(now * 0.0022 + d.seed);
          if (d.kind === 2) {
            d.h -= (0.42 + (d.seed % 1) * 0.25) * dt;
            d.x += (windX * (0.9 + gust * 1.4) + sway * 0.4) * dt;
            d.z += windZ * (0.9 + gust * 1.4) * dt;
          } else if (d.kind === 0) {
            d.x += d.vx * dt;
            d.z += d.vz * dt;
            d.h += Math.sin(now * 0.0031 + d.seed) * 0.42 * dt;
          } else {
            const wind = d.kind === 0 ? 0.28 : 0.12;
            d.x += (d.vx + windX * push * wind + sway * (d.kind === 0 ? 0.4 : 0.15)) * dt;
            d.z += (d.vz + windZ * push * wind) * dt;
            d.h += Math.sin(now * 0.0028 + d.seed) * (d.kind === 0 ? 0.55 : 0.22) * dt;
          }
          const dx = d.x - worldX;
          const dz = d.z - worldZ;
          if (d.kind === 0) {
            const at = groveScreen(d.x, d.z);
            const age = d.max - d.life;
            const left = d.flip === 0;
            const off = !at || (left ? at.x < -0.55 : at.x > 1.55);
            if ((off && age > 0.6) || d.life <= 0) drifters.splice(i, 1);
            continue;
          }
          const far = d.kind === 1 ? 2400 : 220;
          if (d.kind === 1 || d.life <= 0 || d.h < 0.12 || dx * dx + dz * dz > far) drifters.splice(i, 1);
        }
        let flies = 0;
        let leaves = 0;
        for (const d of drifters) {
          if (d.kind === 0) flies += 1;
          else if (d.kind === 2) leaves += 1;
        }
        if (flies === 0) {
          flyWait -= dt;
          if (flyWait <= 0) {
            drifters.push(placeDrifter(0));
            flyWait = 8 + Math.random() * 10;
          }
        }
        while (leaves < 5) {
          drifters.push(placeDrifter(2));
          leaves += 1;
        }
      } else if (sparks.length || drifters.length) {
        sparks.length = 0;
        drifters.length = 0;
      }
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
          if (grove) thunderOn = false;
          const settled = vistaHold || outArrived;
          if (settled && !plainVid.paused) plainVid.pause();
          if (settled) {
            if (grove) setPlainLive(false);
            else if (!plainNoted) {
              plainNoted = true;
              if (!grove) setPlainLive(true);
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
          if (grove && settled) {
            const camX0 = worldX;
            const camZ0 = worldZ;
            profileGo = false;
            chase = false;
            orbitDrag = false;
            orbit = selfAng;
            orbitTarget = selfAng;
            if (drag && drag.axis === "ns" && lanePos !== 0) {
              const catchUp = 1 - Math.exp(-dt * 3.6);
              const take = lanePos * catchUp;
              selfAng -= take * 0.85;
              orbit = selfAng;
              orbitTarget = selfAng;
              const sideStep = take * 2.2;
              worldX += Math.cos(selfAng) * sideStep;
              worldZ += Math.sin(selfAng) * sideStep;
              lanePos -= take;
              drag.lane = lanePos;
              const hand = hands.get(drag.id);
              if (hand) drag.x = hand.x;
            }
            const wish = drag && drag.axis === "ns" ? Math.max(0, plateWish) : 0;
            const side = drag && drag.axis === "ew" ? strafeWish : 0;
            plateV += (wish - plateV) * (1 - Math.exp(-dt * 7));
            strafeV += (side - strafeV) * (1 - Math.exp(-dt * 7));
            if (plateV < 0.02 && wish === 0) plateV = 0;
            if (Math.abs(strafeV) < 0.02 && side === 0) strafeV = 0;
            plateOffset += plateV * dt;
            const step = (dt / GROUND.tileMeters) * 4;
            worldX += -Math.sin(selfAng) * plateV * step + Math.cos(selfAng) * strafeV * step;
            worldZ += Math.cos(selfAng) * plateV * step + Math.sin(selfAng) * strafeV * step;
            plainPush = plateV > 0.08 || Math.abs(strafeV) > 0.08 ? "run" : null;
            thunderOn = false;
            const cdx = worldX - camX0;
            const cdz = worldZ - camZ0;
            if (cdx !== 0 || cdz !== 0) {
              for (const d of drifters) {
                if (d.kind !== 0) continue;
                d.x += cdx;
                d.z += cdz;
              }
            }
          } else if (settled && !orbitDrag) {
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
      const groveMoving = grove && (plateV > 0.05 || Math.abs(strafeV) > 0.05);
      const wantIdle =
        !runHold &&
        !groveMoving &&
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
        if (pose === boltThunderRun || pose === boltThunderRunLeft || pose === boltThunderRunRight || pose === boltThunderRunFace || pose === boltThunderBackstep) {
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
          const toward = !profileGo && (plainPush === "back" || plateV < -0.08);
          const away = profileGo || plainPush === "run" || plateV > 0.08;
          if (toward && boltThunderRunFace.readyState >= 2) {
            pose = boltThunderRunFace;
            thunderHold = pose;
            orbitMate = null;
            orbitMix = 1;
          } else if (away && boltThunderRun.readyState >= 2) {
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
        if (pose === boltThunderRun || pose === boltThunderRunLeft || pose === boltThunderRunRight || pose === boltThunderRunFace || pose === boltThunderBackstep) {
          const gait = gaitFor(plateV);
          if (Math.abs(pose.playbackRate - gait) > 0.04) pose.playbackRate = gait;
        }
        breathMix = 1;
        yaw = "back";
      } else thunderHold = null;
      if (grove) {
        if (!bolt.paused) bolt.pause();
        if (!boltIdle.paused) boltIdle.pause();
      } else if (orbitHold) {
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
        for (const clip of [plainVid, plainLeftLive, plainRightLive, roadA, roadB, wingL, wingR, fallen, brute, boss, bolt, boltIdle, breath, exitVid, howlVid]) {
          if (!clip.paused) clip.pause();
        }
        idleRefs.current.forEach((clip) => {
          if (clip && !clip.paused) clip.pause();
        });
        const thunderClips = [boltThunder, boltThunderRise, boltThunderRun, boltThunderRunLeft, boltThunderRunRight, boltThunderRunFace, boltThunderBackstep, boltThunderFace, boltThunderRight, boltThunderRightBack, boltThunderLeft, boltThunderLeftBack, boltThunderRightIdle, boltThunderLeftIdle];
        for (const clip of thunderClips) {
          if (clip !== pose && clip !== orbitMate && !clip.paused) clip.pause();
        }
        if (onPlain && groundVid.paused) playSafe(groundVid);
      }
      if (grove && onPlain) {
        if (plateV > 0.12 || Math.abs(strafeV) > 0.12) groveSprint = true;
        else if (plateV < 0.03 && Math.abs(strafeV) < 0.03) groveSprint = false;
        const clip = groveSprint ? groveRun : groveIdle;
        pose = clip;
        breathMix = 0;
        thunderHold = null;
        thunderOn = false;
        for (const other of [boltThunder, boltThunderRise, boltThunderRun, boltThunderRunLeft, boltThunderRunRight, boltThunderRunFace, boltThunderBackstep, boltThunderFace]) {
          if (!other.paused) other.pause();
        }
        if (groveSprint) {
          for (const vid of [...detailVids, lifeVids[2]!, grokVid]) {
            if (vid && !vid.paused) vid.pause();
          }
        }
        if (groveRun.playbackRate !== 2.2) groveRun.playbackRate = 2.2;
        if (groveIdle.playbackRate !== 1) groveIdle.playbackRate = 1;
        if (clip.paused) playSafe(clip);
        if (bolt !== pose && !bolt.paused) bolt.pause();
        if (boltIdle !== pose && !boltIdle.paused) boltIdle.pause();
        if (groveRun !== pose && !groveRun.paused) groveRun.pause();
        if (groveIdle !== pose && !groveIdle.paused) groveIdle.pause();
        breathMix = 0;
        thunderHold = null;
        thunderOn = false;
        for (const vid of [pathGlowVid, ...floorVids, ...treeVids, boleVid, crownVid]) {
          if (vid.readyState >= 2) {
            if (!vid.paused) vid.pause();
            if (!decorPinned.has(vid)) {
              decorPinned.add(vid);
              try {
                vid.currentTime = 0.08;
              } catch {
                decorPinned.delete(vid);
              }
            }
          } else if (vid.paused) playSafe(vid);
        }
        if (!groveSprint && grokVid.paused) playSafe(grokVid);
        if (!groveSprint) {
          for (const vid of detailVids) {
            if (vid.paused) playSafe(vid);
          }
        }
        const leaf = lifeVids[2]!;
        if (!groveSprint && leaf.paused) playSafe(leaf);
        if (!lifeVids[0]!.paused) lifeVids[0]!.pause();
      } else {
        for (const vid of forestSkies) if (!vid.paused) vid.pause();
        for (const vid of [pathGlowVid, ...treeVids, boleVid, crownVid, grokVid, ...floorVids, ...detailVids, ...lifeVids]) if (!vid.paused) vid.pause();
      }
      if (!onPlain && !groundVid.paused) groundVid.pause();
      if (!onPlain && roadSource) {
        if (roadSource instanceof HTMLVideoElement) uploadVideo(gl, roadTex, roadSource);
        else upload(gl, roadTex, roadSource);
      }
      if (grove) {
        const forest = pose === groveRun || pose === groveIdle;
        if (forest) {
          const clip = groveSprint ? groveRun : groveIdle;
          const sheets = groveSprint ? runSheets : idleSheets;
          let got = groveSprint ? runGot : idleGot;
          const seen = groveSprint ? lastRunT : lastIdleT;
          if (clip.readyState >= 2 && !clip.seeking && (seen < 0 || Math.abs(clip.currentTime - seen) > 0.04)) {
            grabBolt(clip, sheets, got < BOLT_SLOTS ? got : Math.floor(groveSprint ? runClock : idleClock) % BOLT_SLOTS);
            if (groveSprint) {
              lastRunT = clip.currentTime;
              if (runGot < BOLT_SLOTS) runGot += 1;
            } else {
              lastIdleT = clip.currentTime;
              if (idleGot < BOLT_SLOTS) idleGot += 1;
            }
            got = groveSprint ? runGot : idleGot;
          }
          if (got >= 3) {
            if (groveSprint) runClock = (runClock + dt * 16) % got;
            else idleClock = (idleClock + dt * 8) % got;
            const frame = sheets[Math.floor(groveSprint ? runClock : idleClock) % got];
            if (frame) {
              upload(gl, boltTex, frame);
              groveBoltLive = true;
            }
          } else if (clip.readyState >= 2 && !clip.seeking) {
            upload(gl, boltTex, clip);
            groveBoltLive = true;
          }
        }
      } else if (!onPlain && bolt.readyState >= 2) {
        uploadVideo(gl, boltTex, bolt);
        groveBoltLive = false;
      }
      if (!grove && thunderOn) {
        if (orbitMix < 1 && pose.readyState >= 2) uploadVideo(gl, boltTex, pose);
        const mate = orbitMate ?? thunderHold;
        if (mate && mate.readyState >= 2) uploadVideo(gl, boltIdleTex, mate);
      } else if (!grove && !onPlain && pose.readyState >= 2) uploadVideo(gl, boltIdleTex, pose);
      else if (!grove && !onPlain && boltIdle.readyState >= 2) uploadVideo(gl, boltIdleTex, boltIdle);
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
        skyLock = null;
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        const skies = grove ? forestSkies : skyVids;
        if (skies[0].readyState >= 2) {
          const band = SKY.band;
          const skySrc = skies[0];
          const bandAspect = canvas.width / Math.max(1, canvas.height) / Math.max(0.2, band);
          const vidAspect = skySrc.videoWidth > 0 ? skySrc.videoWidth / skySrc.videoHeight : 9 / 16;
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
            const vid = skies[i]!;
            const showing = i === faceA || i === faceB;
            if (showing) {
              if (vid.paused) playSafe(vid);
            } else if (!vid.paused) vid.pause();
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
          gl.uniform1f(gl.getUniformLocation(skyProg, "uWrap"), 0);
          gl.uniform1f(gl.getUniformLocation(skyProg, "uRun"), 0);
          gl.uniform1f(gl.getUniformLocation(skyProg, "uWX"), 0);
          gl.uniform1f(gl.getUniformLocation(skyProg, "uWZ"), 0);
          const SUN_V = 0.71;
          let rel = ((((slice - 0.53) % SKY.faces) + SKY.faces) % SKY.faces);
          if (rel > 2) rel -= SKY.faces;
          const vx = 0.5 - ((1 - span) / span) * rel;
          const vy = (SUN_V - v0) / Math.max(0.001, v1 - v0);
          const y = (1 - vy) * band;
          let vis = Math.max(0, 1 - Math.max(0, Math.abs(rel) - 0.2) / 1.35);
          if (vx < 0) vis *= Math.max(0, 1 + vx / 0.55);
          else if (vx > 1) vis *= Math.max(0, 1 - (vx - 1) / 0.55);
          skyLock = vis > 0.04 ? { x: vx, y, vis } : null;
          gl.activeTexture(gl.TEXTURE0);
          drawBuffer(quad(0, 0, 1, band));
        }
        const groveVid = false;
        const groveStill = grove && groveFloorImg.complete && groveFloorImg.naturalWidth > 0;
        if (groveVid || groveStill || (!grove && (groundVid.readyState >= 2 || (pathImg.complete && pathImg.naturalWidth > 0)))) {
        gl.activeTexture(gl.TEXTURE0);
        if (groveVid) {
          uploadVideo(gl, pathTex, groundVid);
          groveFloorSent = false;
        } else if (groveStill) {
          if (!groveFloorSent) {
            upload(gl, pathTex, groveFloorImg);
            groveFloorSent = true;
          }
          if (!groveNormSent && groveNormImg.complete && groveNormImg.naturalWidth > 0) {
            upload(gl, normTex, groveNormImg);
            groveNormSent = true;
          }
        } else if (groundVid.readyState >= 2 && !grove) {
          uploadVideo(gl, pathTex, groundVid);
          groveFloorSent = false;
        } else if (pathImg.complete && pathImg.naturalWidth > 0) upload(gl, pathTex, pathImg);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(rockProg);
        gl.bindTexture(gl.TEXTURE_2D, pathTex);
        gl.uniform1i(gl.getUniformLocation(rockProg, "uPath"), 0);
        const groundTile = 0.18;
        const wrapGround = (v: number) => {
          const u = v * groundTile;
          return (u - Math.floor(u)) / groundTile;
        };
        gl.uniform1f(gl.getUniformLocation(rockProg, "uWorldX"), wrapGround(worldX));
        gl.uniform1f(gl.getUniformLocation(rockProg, "uWorldZ"), wrapGround(worldZ));
        gl.uniform1f(gl.getUniformLocation(rockProg, "uYaw"), orbit);
        gl.uniform1f(gl.getUniformLocation(rockProg, "uXMul"), groundXMul);
        gl.uniform1f(gl.getUniformLocation(rockProg, "uHorizon"), groundHorizon);
        gl.uniform1f(gl.getUniformLocation(rockProg, "uFade0"), groundFade0);
        gl.uniform1f(gl.getUniformLocation(rockProg, "uFade1"), groundFade1);
        gl.uniform1f(gl.getUniformLocation(rockProg, "uFlat"), grove ? 1 : 0);
        gl.uniform1f(gl.getUniformLocation(rockProg, "uPivot"), boltPivot);
        if (grove) {
          const c = Math.cos(orbit);
          const s = Math.sin(orbit);
          let o = 0;
          for (let iz = 0; iz <= RELIEF_ROWS; iz += 1) {
            const t = iz / RELIEF_ROWS;
            const depth = 0.95 + t * t * 42;
            for (let ix = 0; ix <= RELIEF_COLS; ix += 1) {
              const x = (ix / RELIEF_COLS - 0.5) * depth * groundXMul * 1.5;
              const relZ = depth - boltPivot;
              const dx = x * c - relZ * s;
              const dz = x * s + relZ * c;
              const wx = worldX + dx;
              const wz = worldZ + boltPivot + dz;
              const h = groveHeight(wx, wz);
              const uvY = groundHorizon - EYE / depth + h / depth;
              reliefVerts[o++] = 0.5 + x / (depth * groundXMul);
              reliefVerts[o++] = 1 - uvY;
              reliefVerts[o++] = x;
              reliefVerts[o++] = relZ;
              reliefVerts[o++] = h;
              reliefVerts[o++] = depth;
              reliefVerts[o++] = groveShade(wx, wz);
            }
          }
          gl.useProgram(reliefProg);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, normTex);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, pathTex);
          gl.uniform1i(gl.getUniformLocation(reliefProg, "uPath"), 0);
          gl.uniform1i(gl.getUniformLocation(reliefProg, "uNorm"), 1);
          gl.uniform1f(gl.getUniformLocation(reliefProg, "uWorldX"), wrapGround(worldX));
          gl.uniform1f(gl.getUniformLocation(reliefProg, "uWorldZ"), wrapGround(worldZ));
          gl.uniform1f(gl.getUniformLocation(reliefProg, "uYaw"), orbit);
          gl.uniform1f(gl.getUniformLocation(reliefProg, "uPivot"), boltPivot);
          gl.uniform2f(
            gl.getUniformLocation(reliefProg, "uSun"),
            SUN_X * Math.cos(orbit) + SUN_Z * Math.sin(orbit),
            -SUN_X * Math.sin(orbit) + SUN_Z * Math.cos(orbit),
          );
          gl.uniform1f(gl.getUniformLocation(reliefProg, "uZoom"), frameZoom);
          gl.uniform2f(gl.getUniformLocation(reliefProg, "uFocus"), 0, frameFocusY);
          gl.bindBuffer(gl.ARRAY_BUFFER, reliefBuf);
          gl.bufferData(gl.ARRAY_BUFFER, reliefVerts, gl.DYNAMIC_DRAW);
          gl.enableVertexAttribArray(0);
          gl.enableVertexAttribArray(1);
          gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 28, 0);
          gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 8);
          gl.enableVertexAttribArray(2);
          gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 28, 24);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, reliefIdx);
          gl.drawElements(gl.TRIANGLES, reliefIndex.length, gl.UNSIGNED_SHORT, 0);
          gl.disableVertexAttribArray(1);
          gl.disableVertexAttribArray(2);
        } else drawBuffer(FULL);
        if (grove) paintGrove();
        }
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
        (phaseRef.current as string) === "cover"
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

      if (!outHide && (phaseRef.current as string) !== "cover" && doorMode !== "map" && !(thunderOn && !thunderHold) && (!grove || groveBoltLive) && (grove || bolt.readyState >= 2 || boltIdle.readyState >= 2 || thunderHold)) {
        const box = boltBox();
        const thunderPlate =
          !grove &&
          (pose === boltThunder ||
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
          pose === boltThunderRunFace ||
          pose === boltThunderBackstep ||
          pose === boltThunderFace);
        const turningPlate =
          pose === boltTurn || pose === boltTurnBack || pose === boltTurnLeft || pose === boltTurnLeftBack;
        const fit = thunderPlate ? THUNDER_FIT : turningPlate && pose.readyState >= 2 ? TURN_FIT : 1;
        const paw = thunderPlate ? 0.97 : PAW_V;
        const dw = box.w * fit;
        const dh = box.h * fit;
        const dx = box.x + box.w / 2 - dw / 2;
        const foot = box.footY;
        if (grove) {
          const target = groveHeight(worldX, worldZ + boltPivot);
          boltGround += (target - boltGround) * (1 - Math.exp(-dt * 3.2));
        } else boltGround = 0;
        const groveLift = boltGround / boltPivot;
        const dy = foot - paw * dh - groveLift;
        gl.useProgram(shadowProg);
        const pawX = box.x + box.w / 2;
        const shadowW = box.w * 0.42 * fit;
        const shadowH = box.h * 0.035 * fit;
        const shadowY = foot - shadowH * 0.45 - boltGround / boltPivot;
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
        gl.uniform1f(gl.getUniformLocation(boltProg, "uBreath"), grove ? 0 : thunderOn ? orbitMix : boltIdle.readyState >= 2 ? breathMix : 0);
        gl.uniform1f(gl.getUniformLocation(boltProg, "uGrove"), grove ? 1 : 0);
        const aim = skyLock;
        gl.uniform1f(gl.getUniformLocation(boltProg, "uSun"), aim ? Math.max(-1.3, Math.min(1.3, (aim.x - 0.5) * 2)) : 0);
        gl.uniform1f(gl.getUniformLocation(boltProg, "uFront"), aim ? aim.vis : 0.12);
        gl.activeTexture(gl.TEXTURE0);
        drawBuffer(quad(dx, dy, dw, dh));
      }

      if (grove && sparks.length) {
        if (!sparkReady && sparkImg.complete && sparkImg.naturalWidth > 0) {
          upload(gl, sparkTex, sparkImg);
          sparkReady = true;
        }
        if (sparkReady) {
          gl.blendFunc(gl.ONE, gl.ONE);
          drawSparks();
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        }
      }
      if (grove && motes.length && detailVids[2]!.readyState >= 2) {
        gl.blendFunc(gl.ONE, gl.ONE);
        drawMotes();
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }
      if (grove && flyFront.length) {
        const frame = flyFrames[Math.floor(now * 0.036) % flyFrames.length]!;
        if (frame.complete && frame.naturalWidth > 0) {
          upload(gl, lifeTex[0]!, frame);
          gl.useProgram(markProg);
          gl.bindTexture(gl.TEXTURE_2D, lifeTex[0]!);
          gl.uniform1i(gl.getUniformLocation(markProg, "uTex"), 0);
          gl.uniform1f(gl.getUniformLocation(markProg, "uKey"), 1);
          gl.uniform1f(gl.getUniformLocation(markProg, "uAlpha"), 1);
          gl.uniform1f(gl.getUniformLocation(markProg, "uShade"), sunBillboard);
          gl.uniform1f(gl.getUniformLocation(markProg, "uSide"), liveSunSide);
          gl.uniform1f(gl.getUniformLocation(markProg, "uFog"), 0);
          gl.uniform1f(gl.getUniformLocation(markProg, "uWind"), 0);
          for (const card of flyFront) {
            gl.uniform1f(gl.getUniformLocation(markProg, "uFlip"), card.flip);
            drawBuffer(quad(card.x, card.y, card.w, card.h));
          }
        }
      }
      if (grove) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(gradeProg);
        drawBuffer(FULL);
        if (skyLock) {
          const dx = skyLock.x - 0.5;
          const dy = (skyLock.y - 0.3) * 1.35;
          const look = Math.max(0, 1 - Math.hypot(dx * 1.15, dy) / 0.9);
          drawSunGlow(0, look * 0.75);
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        }
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
      } catch {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    paintHud();
    if (startInRoomRef.current || backToRoom()) enterRoom();

    const api = { begin, atGates: () => openGates(true), atVista: () => enterVista(), atGrove: () => enterGrove() };
    frame.dataset.ready = "1";
    (frame as HTMLDivElement & { __pyre?: { begin: () => void; atGates: () => void; atVista: () => void; atGrove: () => void } }).__pyre = api;

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
      for (const vid of forestSkies) {
        vid.pause();
        vid.remove();
      }
      pathGlowVid.pause();
      pathGlowVid.remove();
      for (const vid of [...treeVids, boleVid, crownVid, grokVid]) {
        vid.pause();
        vid.remove();
      }
      for (const vid of floorVids) {
        vid.pause();
        vid.remove();
      }
      for (const vid of detailVids) {
        vid.pause();
        vid.remove();
      }
      for (const vid of lifeVids) {
        vid.pause();
        vid.remove();
      }
      audio.ctx?.close().catch(() => undefined);
    };
  }, [PLATE_FS]);

  const pyreApi = () =>
    frameRef.current as (HTMLDivElement & { __pyre?: { begin: () => void; atGates: () => void; atVista: () => void; atGrove: () => void } }) | null;

  const start = () => {
    pyreApi()?.__pyre?.begin();
  };

  const atGates = () => {
    pyreApi()?.__pyre?.atGates();
  };

  const atVista = () => {
    pyreApi()?.__pyre?.atVista();
  };
  const atGrove = () => {
    pyreApi()?.__pyre?.atGrove();
  };
  const closeAsk = () => {
    askOpenRef.current = false;
    setAskOpen(false);
    setAskEar(false);
    voiceRef.current?.pause();
  };
  const armVoice = () => {
    const audio = voiceRef.current ?? new Audio();
    voiceRef.current = audio;
    if (!audio.getAttribute("src")) {
      audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
    }
    void audio.play().catch(() => undefined);
  };
  const playVoice = (b64: string) => {
    const raw = atob(b64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
    const audio = voiceRef.current ?? new Audio();
    voiceRef.current = audio;
    audio.pause();
    audio.src = url;
    audio.onended = () => URL.revokeObjectURL(url);
    return audio.play();
  };
  const speakFallback = (line: string) => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(line);
    utter.lang = navigator.language || "fr-FR";
    utter.rate = 1;
    synth.speak(utter);
  };
  const sendAsk = async (event?: FormEvent, spoken?: string) => {
    event?.preventDefault();
    armVoice();
    const question = (spoken ?? askQ).trim();
    if (!question || askBusy) return;
    setAskBusy(true);
    try {
      const res = await askGrok({ data: { question } });
      if (!res.ok) return;
      if (res.audio) {
        try {
          await playVoice(res.audio);
        } catch {
          speakFallback(res.text);
        }
      } else speakFallback(res.text);
    } catch {
      /* quiet */
    } finally {
      setAskBusy(false);
    }
  };
  const hearAsk = () => {
    armVoice();
    const host = window as Window & {
      SpeechRecognition?: new () => SpeechRecognition;
      webkitSpeechRecognition?: new () => SpeechRecognition;
    };
    const Rec = host.SpeechRecognition || host.webkitSpeechRecognition;
    if (!Rec) return;
    const rec = new Rec();
    rec.lang = navigator.language || "fr-FR";
    rec.interimResults = false;
    setAskEar(true);
    rec.onresult = (event) => {
      const line = event.results[0]?.[0]?.transcript ?? "";
      if (!line) return;
      setAskQ(line);
      void sendAsk(undefined, line);
    };
    rec.onerror = () => setAskEar(false);
    rec.onend = () => setAskEar(false);
    try {
      rec.start();
    } catch {
      setAskEar(false);
    }
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
          preload="none"
        />
        <video
          ref={roadBRef}
          className="pyre-video"
          src="/master/pyre-road.mp4"
          muted
          playsInline
          preload="none"
        />
        <video
          ref={boltRef}
          className="pyre-video"
          src="/master/bolt-native.mp4?v=3"
          muted
          playsInline
          disablePictureInPicture
          preload="none"
        />
        <video
          ref={groveRunRef}
          className="pyre-video"
          src="/master/bolt-grove-run.mp4?v=1"
          muted
          loop
          playsInline
          disablePictureInPicture
          preload="auto"
        />
        <video
          ref={groveIdleRef}
          className="pyre-video"
          src="/master/bolt-grove-idle.mp4?v=2"
          muted
          loop
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
          preload="none"
        />
        <video
          ref={boltFaceRef}
          className="pyre-video"
          src="/master/bolt-breath-face.mp4?v=1"
          muted
          loop
          playsInline
          disablePictureInPicture
          preload="none"
        />
        <video
          ref={boltTurnRef}
          className="pyre-video"
          src="/master/bolt-turn.mp4?v=4"
          muted
          playsInline
          disablePictureInPicture
          preload="none"
        />
        <video
          ref={boltTurnBackRef}
          className="pyre-video"
          src="/master/bolt-turn-back.mp4?v=4"
          muted
          playsInline
          disablePictureInPicture
          preload="none"
        />
        <video
          ref={boltTurnLeftRef}
          className="pyre-video"
          src="/master/bolt-turn-left.mp4?v=1"
          muted
          playsInline
          disablePictureInPicture
          preload="none"
        />
        <video
          ref={boltTurnLeftBackRef}
          className="pyre-video"
          src="/master/bolt-turn-left-back.mp4?v=1"
          muted
          playsInline
          disablePictureInPicture
          preload="none"
        />
        <video
          ref={boltThunderRef}
          className="pyre-video"
          src="/master/bolt-thunder.mp4?v=1"
          muted
          loop
          playsInline
          disablePictureInPicture
          preload="none"
        />
        <video
          ref={boltThunderRiseRef}
          className="pyre-video"
          src="/master/bolt-thunder-rise.mp4?v=1"
          muted
          playsInline
          disablePictureInPicture
          preload="none"
        />
        <video ref={boltThunderRightRef} className="pyre-video" src="/master/bolt-thunder-to-face-r.mp4?v=2" muted playsInline disablePictureInPicture preload="none" />
        <video ref={boltThunderRightBackRef} className="pyre-video" src="/master/bolt-thunder-to-back-r.mp4?v=2" muted playsInline disablePictureInPicture preload="none" />
        <video ref={boltThunderLeftRef} className="pyre-video" src="/master/bolt-thunder-to-face-l.mp4?v=2" muted playsInline disablePictureInPicture preload="none" />
        <video ref={boltThunderLeftBackRef} className="pyre-video" src="/master/bolt-thunder-to-back-l.mp4?v=2" muted playsInline disablePictureInPicture preload="none" />
        <video ref={boltThunderRightIdleRef} className="pyre-video" src="/master/bolt-thunder-right-idle.mp4?v=1" muted loop playsInline disablePictureInPicture preload="none" />
        <video ref={boltThunderLeftIdleRef} className="pyre-video" src="/master/bolt-thunder-left-idle.mp4?v=2" muted loop playsInline disablePictureInPicture preload="none" />
        <video ref={boltThunderRunRef} className="pyre-video" src="/master/bolt-thunder-run.mp4?v=4" muted loop playsInline disablePictureInPicture preload="none" />
        <video ref={boltThunderRunLeftRef} className="pyre-video" src="/master/bolt-thunder-run-left.mp4?v=2" muted loop playsInline disablePictureInPicture preload="none" />
        <video ref={boltThunderRunRightRef} className="pyre-video" src="/master/bolt-thunder-run-right.mp4?v=2" muted loop playsInline disablePictureInPicture preload="none" />
        <video ref={boltThunderRunFaceRef} className="pyre-video" src="/master/bolt-thunder-run-face.mp4?v=2" muted loop playsInline disablePictureInPicture preload="none" />
        <video ref={boltThunderBackstepRef} className="pyre-video" src="/master/bolt-thunder-backstep.mp4?v=1" muted loop playsInline disablePictureInPicture preload="none" />
        <video ref={boltThunderFaceRef} className="pyre-video" src="/master/bolt-thunder-face.mp4?v=2" muted loop playsInline disablePictureInPicture preload="none" />
        <video
          ref={fallenRef}
          className="pyre-video"
          src="/master/foe-fallen.mp4"
          muted
          playsInline
          disablePictureInPicture
          preload="none"
        />
        <video
          ref={bruteRef}
          className="pyre-video"
          src="/master/foe-brute.mp4"
          muted
          playsInline
          disablePictureInPicture
          preload="none"
        />
        <video
          ref={bossRef}
          className="pyre-video"
          src="/master/boss.mp4?v=atk"
          muted
          playsInline
          disablePictureInPicture
          preload="none"
        />
        <video
          ref={bossAshRef}
          className="pyre-video"
          src="/master/boss-ash.mp4"
          muted
          playsInline
          disablePictureInPicture
          preload="none"
        />
        <video
          ref={wingLRef}
          className="pyre-video"
          src="/master/pyre-wing-l.mp4"
          muted
          playsInline
          disablePictureInPicture
          preload="none"
        />
        <video
          ref={wingRRef}
          className="pyre-video"
          src="/master/pyre-wing-r.mp4"
          muted
          playsInline
          disablePictureInPicture
          preload="none"
        />
        <video
          ref={howlRef}
          className="pyre-video"
          src="/master/howl.mp4"
          muted
          playsInline
          disablePictureInPicture
          preload="none"
        />
        <video
          ref={ashFallenRef}
          className="pyre-video"
          src="/master/ash-fallen.mp4"
          muted
          playsInline
          disablePictureInPicture
          preload="none"
        />
        <video
          ref={ashBruteRef}
          className="pyre-video"
          src="/master/ash-brute.mp4"
          muted
          playsInline
          disablePictureInPicture
          preload="none"
        />
        <video
          ref={gateARef}
          className="pyre-video"
          src="/master/citadel-road.mp4"
          muted
          playsInline
          preload="none"
        />
        <video
          ref={gateBRef}
          className="pyre-video"
          src="/master/citadel-road.mp4"
          muted
          playsInline
          preload="none"
        />
        <video
          ref={gateWingLRef}
          className="pyre-video"
          src="/master/citadel-wing-l.mp4"
          muted
          playsInline
          disablePictureInPicture
          preload="none"
        />
        <video
          ref={gateWingRRef}
          className="pyre-video"
          src="/master/citadel-wing-r.mp4"
          muted
          playsInline
          disablePictureInPicture
          preload="none"
        />
        <video
          ref={citadelRef}
          className="pyre-video"
          src="/master/citadel-arrive.mp4?v=1"
          muted
          playsInline
          disablePictureInPicture
          preload="none"
        />
        <video
          ref={openRef}
          className="pyre-video"
          src="/master/citadel-open.mp4?v=1"
          muted
          playsInline
          disablePictureInPicture
          preload="none"
        />
        <video
          ref={hallRef}
          className="pyre-video"
          src="/master/citadel-hall.mp4?v=1"
          muted
          playsInline
          disablePictureInPicture
          preload="none"
        />
        <video
          ref={breathRef}
          className="pyre-video"
          src="/master/room-breath.mp4?v=1"
          muted
          playsInline
          loop
          disablePictureInPicture
          preload="none"
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
          preload="none"
        />
        <video
          ref={exitRef}
          className="pyre-video"
          src="/master/citadel-exit.mp4?v=1"
          muted
          playsInline
          disablePictureInPicture
          preload="none"
        />
        <video
          ref={plainRef}
          className="pyre-video"
          src="/master/citadel-plain.mp4?v=1"
          muted
          loop
          playsInline
          disablePictureInPicture
          preload="none"
        />
        <video ref={plainLeftLiveRef} className="pyre-video" src="/master/plain-left-live.mp4?v=1" muted loop playsInline disablePictureInPicture preload="none" />
        <video ref={plainRightLiveRef} className="pyre-video" src="/master/plain-right-live.mp4?v=1" muted loop playsInline disablePictureInPicture preload="none" />
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
            preload="none"
          />
        ))}
        <div className="pyre-hud" hidden={phase === "cover"}>
          <div>
            <p className="pyre-paces" hidden={groveLive}>
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
        {phase === "citadel" && groveLive && (
          <button
            type="button"
            className={grokOn ? "pyre-grok-toggle" : "pyre-grok-toggle is-off"}
            aria-label={grokOn ? "Hide Grok" : "Show Grok"}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              setGrokOn((on) => {
                const next = !on;
                grokOnRef.current = next;
                if (!next) {
                  askOpenRef.current = false;
                  setAskOpen(false);
                }
                return next;
              });
            }}
          />
        )}
        {askOpen && groveLive && grokOn && (
          <form className={askBusy ? "pyre-ask is-busy" : "pyre-ask"} onSubmit={sendAsk} onPointerDown={(event) => event.stopPropagation()}>
            <button type="button" className={askEar ? "pyre-ask-mic is-ear" : "pyre-ask-mic"} aria-label="Speak" onClick={hearAsk}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 15a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z" />
                <path d="M7 11a5 5 0 0 0 10 0M12 16v3" />
              </svg>
            </button>
            <input
              value={askQ}
              onChange={(event) => setAskQ(event.target.value)}
              placeholder="Ask the grove"
              maxLength={280}
              enterKeyHint="send"
              autoFocus
            />
            <button type="submit" className="pyre-ask-send" aria-label="Send" disabled={askBusy || !askQ.trim()}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h12M13 6l6 6-6 6" />
              </svg>
            </button>
            <button type="button" className="pyre-ask-x" aria-label="Close" onClick={closeAsk}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 7l10 10M17 7L7 17" />
              </svg>
            </button>
          </form>
        )}
        {phase !== "run" && phase !== "citadel" && (
          <div className="pyre-cover">
            <p className="pyre-kicker">{phase === "fallen" ? "The ash kept you" : "Blood-moon causeway"}</p>
            <h1 className="pyre-title">Pyre</h1>
            <p className="pyre-deck">
              {phase === "fallen"
                ? `${lastRun} paces before the horde closed. Best ${peak}.`
                : "The gates, or the forest."}
            </p>
            <div className="pyre-menu">
              <button type="button" className="pyre-start" onPointerUp={(event) => { event.preventDefault(); event.stopPropagation(); atGates(); }}>
                The gates
              </button>
              <button type="button" className="pyre-start is-ghost" onPointerUp={(event) => { event.preventDefault(); event.stopPropagation(); atGrove(); }}>
                The forest
              </button>
            </div>
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

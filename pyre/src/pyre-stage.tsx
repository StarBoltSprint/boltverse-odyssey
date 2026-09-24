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
const SLIDE_AMP = 0.36;
const BOLT_H = 0.28;
const BOLT_ASPECT = 784 / 1168;
const TURN_FIT = 1.55;
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
varying vec2 vUv;
void main() {
  vUv = aUv;
  gl_Position = vec4(aPos, 0.0, 1.0);
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
  float a = 1.0 - smoothstep(0.22, 0.48, greenness);
  if (greenness > 0.06) c.g = mix(c.g, m, smoothstep(0.06, 0.5, greenness));
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
    const howlVid = howlRef.current;
    const ashFallen = ashFallenRef.current;
    const ashBrute = ashBruteRef.current;
    const frame = frameRef.current;
    if (
      !canvas || !fx || !roadA || !roadB || !bolt || !boltIdle || !boltFace || !boltTurn || !boltTurnBack || !boltTurnLeft || !boltTurnLeftBack || !fallen || !brute || !boss || !bossAsh ||
      !wingL || !wingR || !howlVid || !ashFallen || !ashBrute || !gateA || !gateB ||
      !gateWingL || !gateWingR || !citadel || !openVid || !hall || !breath || !camLeft || !camRight || !camLeftBack || !camRightBack || !holo || !frame
    ) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
    });
    const ctx = fx.getContext("2d");
    if (!gl || !ctx) return;

    const roadProg = program(gl, ROAD_FS);
    const boltProg = program(gl, BOLT_FS);
    const enemyProg = program(gl, ENEMY_FS);
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
    let orbitHold = false;
    let orbitDrag = false;
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
      sweep: number;
      lastAng: number | null;
      arc: boolean;
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
    let doorMode: "ride" | "open" | "hall" | "room" | "map" = "ride";
    let roomDepth = 0;
    let depthTarget = 0;
    let mapHop = false;
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
    for (const clip of [boltFace, boltTurn, boltTurnBack, boltTurnLeft, boltTurnLeftBack]) {
      clip.muted = true;
      clip.playsInline = true;
      clip.disablePictureInPicture = true;
      clip.playbackRate = 1;
    }
    boltFace.loop = true;
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
    for (const clip of [gateA, gateB, citadel, openVid, hall, breath, holo]) {
      clip.muted = true;
      clip.playsInline = true;
      clip.loop = clip === breath || clip === gateA || clip === gateB;
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

    const drawBuffer = (data: Float32Array) => {
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
      orbitTarget = 0;
      orbitHold = false;
      orbitDrag = false;
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
      setBossHp(0);
      setGatesOpen(false);
      setDoorsReady(false);
      setRoomLive(false);
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
    const wrapAng = (angle: number) => {
      let next = angle;
      while (next > Math.PI) next -= Math.PI * 2;
      while (next < -Math.PI) next += Math.PI * 2;
      return next;
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
      const riding = phaseRef.current === "run" || (phaseRef.current === "citadel" && doorMode !== "map");
      if (!riding || event.button !== 0) return;
      hands.set(event.pointerId, { x: event.clientX, y: event.clientY });
      try {
        frame.setPointerCapture(event.pointerId);
      } catch {
        /* synthetic events */
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
      const onBolt = nx >= box.x - pad && nx <= box.x + box.w + pad && ny >= box.y - pad && ny <= box.y + box.h + pad;
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
        sweep: 0,
        lastAng: null,
        arc: false,
      };
    };
    const onSlideMove = (event: PointerEvent) => {
      if (hands.has(event.pointerId)) hands.set(event.pointerId, { x: event.clientX, y: event.clientY });
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
          if (orbitDrag) {
            orbitTarget = Math.max(-SIDE, Math.min(SIDE, Math.round(orbit / SIDE) * SIDE));
          }
          drag = null;
          runHold = false;
          orbitDrag = false;
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
          if (onDoor) depthTarget = 1;
          else if (onRing) openMap();
        }
      }
      if (orbitDrag) {
        orbitTarget = Math.max(-SIDE, Math.min(SIDE, Math.round(orbit / SIDE) * SIDE));
      }
      drag = null;
      runHold = false;
      orbitDrag = false;
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

    const openMap = () => {
      if (doorMode !== "room" || mapHop) return;
      doorMode = "map";
      setRoomLive(false);
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
      const depth = phaseRef.current === "citadel" && doorMode === "room" ? roomDepth : 0;
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
      orbitTarget = 0;
      lanePos = 0;
      doorMode = "ride";
      doorsLive = atDoors;
      cardShown = false;
      roomDepth = 0;
      depthTarget = 0;
      mapHop = false;
      setPhase("citadel");
      setRoomLive(false);
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
      distance = PYRE_PACES;
      lanePos = 0;
      glance = 0;
      glanceTarget = 0;
      orbit = 0;
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

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
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
      if (roadSource) upload(gl, roadTex, roadSource);
      const roomWalking = doorMode === "room" && Math.abs(depthTarget - roomDepth) > 0.03 && yaw === "back" && !turnTo && !runHold;
      const wantIdle =
        !runHold &&
        (turnTo !== null ||
          (phaseRef.current === "citadel" &&
            doorMode !== "map" &&
            !roomWalking &&
            (doorMode === "room" || (doorMode === "ride" && doorsLive))));
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
      if (orbitHold) {
        if (boltIdle.paused) playSafe(boltIdle);
      } else if (pose.paused) playSafe(pose);
      if (bolt.readyState >= 2) upload(gl, boltTex, bolt);
      if (pose.readyState >= 2) upload(gl, boltIdleTex, pose);
      else if (boltIdle.readyState >= 2) upload(gl, boltIdleTex, boltIdle);
      if (fallen.readyState >= 2) upload(gl, foeTex[0]!, fallen);
      if (brute.readyState >= 2) upload(gl, foeTex[1]!, brute);
      if (boss.readyState >= 2) upload(gl, foeTex[2]!, boss);
      if (howlVid.readyState >= 2) upload(gl, howlTex, howlVid);
      if (ashFallen.readyState >= 2) upload(gl, ashTex[0]!, ashFallen);
      if (ashBrute.readyState >= 2) upload(gl, ashTex[1]!, ashBrute);
      if (bossAsh.readyState >= 2) upload(gl, ashTex[2]!, bossAsh);
      if (wingL.readyState >= 2) upload(gl, wingLTex, wingL);
      if (wingR.readyState >= 2) upload(gl, wingRTex, wingR);
      let camFrame: HTMLImageElement | null = null;
      if (doorMode === "room" && Math.abs(orbit) > 0.06) {
        const seq = orbit >= 0 ? leftSide : rightSide;
        const local = Math.min(0.999, Math.abs(orbit) / SIDE);
        const idx = Math.min(seq.length - 1, Math.floor(local * seq.length));
        let img: HTMLImageElement | undefined;
        for (let i = idx; i >= 0; i--) {
          const shot = seq[i];
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
                  : breath.readyState >= 2
                    ? breath
                    : hall;
      const shown = plate;
      if (camFrame) upload(gl, citadelTex, camFrame);
      else if (shown && shown.readyState >= 2) upload(gl, citadelTex, shown);
      if (!roomPlates && roomLeft.complete && roomRight.complete && roomBack.complete && roomLeft.naturalWidth > 0) {
        upload(gl, roomLeftTex, roomLeft);
        upload(gl, roomRightTex, roomRight);
        upload(gl, roomBackTex, roomBack);
        roomPlates = true;
      }
      if (far.complete) upload(gl, farTex, far);
      const wingsReady = wingL.readyState >= 2 && wingR.readyState >= 2;
      const shift = lookShift(glance, wingsReady);
      viewShift = shift;

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
      if (camFrame && doorMode === "room") {
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
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      drawFoes(false);

      if (phaseRef.current !== "cover" && doorMode !== "map" && (bolt.readyState >= 2 || boltIdle.readyState >= 2)) {
        const box = boltBox();
        gl.useProgram(shadowProg);
        const pawX = box.x + box.w / 2;
        const shadowW = box.w * 0.34;
        const shadowH = box.h * 0.045;
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
        gl.uniform1f(gl.getUniformLocation(boltProg, "uBreath"), boltIdle.readyState >= 2 ? breathMix : 0);
        gl.activeTexture(gl.TEXTURE0);
        const turningPlate =
          pose === boltTurn || pose === boltTurnBack || pose === boltTurnLeft || pose === boltTurnLeftBack;
        const fit = turningPlate && pose.readyState >= 2 ? TURN_FIT : 1;
        const dw = box.w * fit;
        const dh = box.h * fit;
        const dx = box.x + box.w / 2 - dw / 2;
        const dy = box.footY - PAW_V * dh;
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

    const api = { begin, atGates: () => openGates(true) };
    frame.dataset.ready = "1";
    (frame as HTMLDivElement & { __pyre?: { begin: () => void; atGates: () => void } }).__pyre = api;

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      frame.removeEventListener("pointerdown", onSlideDown);
      frame.removeEventListener("pointermove", onSlideMove);
      frame.removeEventListener("pointerup", onSlideUp);
      frame.removeEventListener("pointercancel", onSlideUp);
      if (window.__controlsTest === probe) delete window.__controlsTest;
      audio.ctx?.close().catch(() => undefined);
    };
  }, []);

  const pyreApi = () =>
    frameRef.current as (HTMLDivElement & { __pyre?: { begin: () => void; atGates: () => void } }) | null;

  const start = () => {
    pyreApi()?.__pyre?.begin();
  };

  const atGates = () => {
    pyreApi()?.__pyre?.atGates();
  };

  return (
    <main className="pyre-root">
      <div className="pyre-frame" ref={frameRef}>
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
        {phase === "citadel" && roomLive && <p className="pyre-tap is-low">Drag Bolt · swipe the floor, he turns and the room turns with him</p>}
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
              <button type="button" className="pyre-start" onClick={start}>
                Start
              </button>
              <button type="button" className="pyre-start is-ghost" onClick={atGates}>
                The gates
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

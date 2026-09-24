import { useEffect, useRef, useState } from "react";

type Phase = "cover" | "run" | "fallen";

type Foe = {
  id: number;
  kind: 0 | 1;
  lane: number;
  aim: number | null;
  z: number;
  speed: number;
  struck: boolean;
  side: -1 | 0 | 1;
  wide: number;
};

type Ash = {
  kind: 0 | 1;
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
const PAW_V = 0.93;
const PLANT_Y = 0.8;
const BOLT_RATE = 4;
const HORIZON = 0.545;
const FOE_ASPECT = 480 / 854;
const FOE_KIND = [
  { h: 0.3, foot: 0.96, reach: 0.34, rate: 1.45, agility: 1.55 },
  { h: 0.4, foot: 0.97, reach: 0.48, rate: 1.05, agility: 0.7 },
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
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  c += (n - 0.5) * 0.028;
  c = mix(c, vec3(0.55, 0.05, 0.08), uFlash * 0.55);
  gl_FragColor = vec4(c, 1.0);
}`;

const BOLT_FS = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uFlash;
uniform float uTime;
void main() {
  vec4 c = texture2D(uTex, vUv);
  float m = max(c.r, c.b);
  float greenness = c.g - m;
  float a = 1.0;
  if (greenness > 0.02 && c.g > 0.12) {
    a = 0.0;
  } else if (c.g > m) {
    c.g = m;
  }
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

const PLATE_FS = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
void main() {
  vec3 c = texture2D(uTex, vUv).rgb;
  float hot = smoothstep(0.05, 0.42, c.r);
  gl_FragColor = vec4(vec3(c.r * 1.5, c.r * 0.28, c.r * 0.05) * hot, 1.0);
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

export function PyreStage() {
  const glRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const roadARef = useRef<HTMLVideoElement>(null);
  const roadBRef = useRef<HTMLVideoElement>(null);
  const boltRef = useRef<HTMLVideoElement>(null);
  const fallenRef = useRef<HTMLVideoElement>(null);
  const bruteRef = useRef<HTMLVideoElement>(null);
  const wingLRef = useRef<HTMLVideoElement>(null);
  const wingRRef = useRef<HTMLVideoElement>(null);
  const howlRef = useRef<HTMLVideoElement>(null);
  const ashFallenRef = useRef<HTMLVideoElement>(null);
  const ashBruteRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>("cover");
  const [peak, setPeak] = useState(0);
  const [lastRun, setLastRun] = useState(0);
  const [paces, setPaces] = useState(0);
  const [wounds, setWounds] = useState(0);
  const phaseRef = useRef<Phase>("cover");
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
    const fallen = fallenRef.current;
    const brute = bruteRef.current;
    const wingL = wingLRef.current;
    const wingR = wingRRef.current;
    const howlVid = howlRef.current;
    const ashFallen = ashFallenRef.current;
    const ashBrute = ashBruteRef.current;
    const frame = frameRef.current;
    if (!canvas || !fx || !roadA || !roadB || !bolt || !fallen || !brute || !wingL || !wingR || !howlVid || !ashFallen || !ashBrute || !frame) return;

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
    const shadowProg = program(gl, SHADOW_FS);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const roadTex = makeTex(gl);
    const wingLTex = makeTex(gl);
    const wingRTex = makeTex(gl);
    const boltTex = makeTex(gl);
    const foeTex = [makeTex(gl), makeTex(gl)];
    const howlTex = makeTex(gl);
    const ashTex = [makeTex(gl), makeTex(gl)];
    const poster = new Image();
    poster.src = "/master/pyre-first.jpg";

    const keys = new Set<string>();
    let steerOverride: number | null = null;
    let lanePos = 0;
    let glance = 0;
    let glanceTarget = 0;
    let viewShift = 0;
    let drag: { id: number; x: number; y: number; lane: number; looking: boolean } | null = null;
    let distance = 0;
    let wounds = 0;
    let invuln = 0;
    let flash = 0;
    let shake = 0;
    let spawnIn = 2.1;
    let flankNext: -1 | 1 = -1;
    let activeRoad = 0;
    let best = readPeak();
    const foes: Foe[] = [];
    const ashes: Ash[] = [];
    let nextFoe = 1;
    const shots: { t: number; dur: number; id: number }[] = [];
    const foeClips = [fallen, brute];
    const trail: { lane: number; age: number }[] = [];
    const roads = [roadA, roadB];
    const wings = [wingL, wingR];

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
    for (const wing of wings) {
      wing.muted = true;
      wing.playsInline = true;
      wing.loop = true;
      wing.playbackRate = 1;
      wing.disablePictureInPicture = true;
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
      foes.length = 0;
      ashes.length = 0;
      shots.length = 0;
      trail.length = 0;
      spawnIn = 2.1;
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
      if (invuln > 0) return;
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
      const grow = foe.side === 0 ? 0.42 + 0.58 * near : 0.58 + 0.42 * near;
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
    const onSlideDown = (event: PointerEvent) => {
      if (phaseRef.current !== "run" || event.button !== 0) return;
      const rect = frame.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / (rect.width || 1);
      const ny = (event.clientY - rect.top) / (rect.height || 1);
      const aspect = (rect.width || 1) / (rect.height || 1);
      const h = BOLT_H;
      const w = (h * BOLT_ASPECT) / aspect;
      const x = 0.5 + lanePos * SLIDE_AMP - viewShift - w / 2;
      const y = PLANT_Y - PAW_V * h;
      const pad = 0.05;
      const onBolt = nx >= x - pad && nx <= x + w + pad && ny >= y - pad && ny <= y + h + pad;
      const tapped = foeUnder(nx, ny);
      if (tapped && !onBolt) {
        castHowl(tapped);
        return;
      }
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, lane: lanePos, looking: !onBolt };
      try {
        frame.setPointerCapture(event.pointerId);
      } catch {
        /* synthetic events */
      }
    };
    const onSlideMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      if (drag.looking) {
        const width = frame.clientWidth || 1;
        const dx = event.clientX - drag.x;
        glanceTarget = Math.max(-1, Math.min(1, dx / (width * 0.42)));
        return;
      }
      slideTo(event.clientX, drag.x, drag.lane);
    };
    const onSlideUp = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      if (drag.looking) glanceTarget = 0;
      else slideTo(event.clientX, drag.x, drag.lane);
      drag = null;
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
        if (spawnIn <= 0 && foes.length < 2 && !farBusy) {
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
          });
          spawnIn = 2.6 + Math.random() * 1.5;
        }
        for (let i = foes.length - 1; i >= 0; i -= 1) {
          const foe = foes[i]!;
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
          const spot = foeSpot(foe);
          ashes.push({
            kind: foe.kind,
            x: spot.x - spot.w * 0.08,
            y: spot.y - spot.h * 0.06,
            w: spot.w * 1.16,
            h: spot.h * 1.12,
            t: 0,
            life: 1.45,
          });
          foes.splice(foes.indexOf(foe), 1);
          const vid = foe.kind === 0 ? ashFallen : ashBrute;
          try {
            vid.currentTime = 0.9;
          } catch {
            /* not seekable yet */
          }
          vid.playbackRate = 1.7;
          playSafe(vid);
          crack();
        }
        if (!shots.length && !howlVid.paused) howlVid.pause();
        for (let i = ashes.length - 1; i >= 0; i -= 1) {
          ashes[i]!.t += dt;
          if (ashes[i]!.t >= ashes[i]!.life) ashes.splice(i, 1);
        }
        if (Math.floor(distance) !== Math.floor(distance - 14 * dt)) paintHud();

        const lead = roads[activeRoad]!;
        const next = roads[1 - activeRoad]!;
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
          if (wing.playbackRate !== 1) wing.playbackRate = 1;
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

      const road = roads[activeRoad]!;
      const roadSource = road.readyState >= 2 ? road : poster.complete ? poster : null;
      if (roadSource) upload(gl, roadTex, roadSource);
      if (bolt.readyState >= 2) upload(gl, boltTex, bolt);
      if (fallen.readyState >= 2) upload(gl, foeTex[0]!, fallen);
      if (brute.readyState >= 2) upload(gl, foeTex[1]!, brute);
      if (howlVid.readyState >= 2) upload(gl, howlTex, howlVid);
      if (ashFallen.readyState >= 2) upload(gl, ashTex[0]!, ashFallen);
      if (ashBrute.readyState >= 2) upload(gl, ashTex[1]!, ashBrute);
      if (wingL.readyState >= 2) upload(gl, wingLTex, wingL);
      if (wingR.readyState >= 2) upload(gl, wingRTex, wingR);
      const wingsReady = wingL.readyState >= 2 && wingR.readyState >= 2;
      const shift = lookShift(glance, wingsReady);
      viewShift = shift;

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
      gl.activeTexture(gl.TEXTURE0);
      drawBuffer(FULL);

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
          gl.uniform1f(gl.getUniformLocation(enemyProg, "uFlash"), flash);
          gl.uniform1f(gl.getUniformLocation(enemyProg, "uThreat"), spot.threat);
          gl.uniform1f(gl.getUniformLocation(enemyProg, "uAlpha"), spot.alpha);
          drawBuffer(quad(spot.x, spot.y, spot.w, spot.h));
        }
      };

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      drawFoes(false);

      if (phaseRef.current !== "cover" && bolt.readyState >= 2) {
        const h = BOLT_H;
        const w = (h * BOLT_ASPECT) / aspect;
        const y = PLANT_Y - PAW_V * h;
        const x = 0.5 + lanePos * SLIDE_AMP - shift - w / 2;
        gl.useProgram(shadowProg);
        const pawX = 0.5 + lanePos * SLIDE_AMP - shift;
        const shadowW = w * 0.34;
        const shadowH = h * 0.045;
        const shadowY = PLANT_Y - shadowH * 0.35;
        drawBuffer(quad(pawX - shadowW / 2, shadowY, shadowW, shadowH));
        gl.useProgram(boltProg);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, boltTex);
        gl.uniform1i(gl.getUniformLocation(boltProg, "uTex"), 0);
        gl.uniform1f(gl.getUniformLocation(boltProg, "uFlash"), flash);
        gl.uniform1f(gl.getUniformLocation(boltProg, "uTime"), now * 0.001);
        drawBuffer(quad(x, y, w, h));
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
          const vid = ash.kind === 0 ? ashFallen : ashBrute;
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

    const api = { begin };
    frame.dataset.ready = "1";
    (frame as HTMLDivElement & { __pyre?: { begin: () => void } }).__pyre = api;

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

  const start = () => {
    const frame = frameRef.current as (HTMLDivElement & { __pyre?: { begin: () => void } }) | null;
    frame?.__pyre?.begin();
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
        <div className="pyre-hud" hidden={phase === "cover"}>
          <div>
            <p className="pyre-paces">
              <span>{paces}</span>
              <small>paces · best {peak}</small>
            </p>
          </div>
          <div className="pyre-wounds" aria-label="Wounds left">
            {[0, 1, 2].map((mark) => (
              <i key={mark} className={mark < 3 - wounds ? "pyre-wound is-lit" : "pyre-wound"} />
            ))}
          </div>
        </div>
        {phase !== "run" && (
          <div className="pyre-cover">
            <p className="pyre-kicker">{phase === "fallen" ? "The ash kept you" : "Blood-moon causeway"}</p>
            <h1 className="pyre-title">Pyre</h1>
            <p className="pyre-deck">
              {phase === "fallen"
                ? `${lastRun} paces before the horde closed. Best ${peak}.`
                : "A gothic causeway under a blood moon. The damned hunt your lane."}
            </p>
            <button type="button" className="pyre-start" onClick={start}>
              Start
            </button>
            <p className="pyre-note">Tap a foe and Bolt howls straight at him. Slide on Bolt to change lane. Slide beside him to look.</p>
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

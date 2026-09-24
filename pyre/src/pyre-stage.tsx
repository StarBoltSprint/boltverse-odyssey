import { useEffect, useRef, useState } from "react";

type Phase = "cover" | "run" | "fallen";

type Hazard = {
  lane: number;
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
uniform sampler2D uTex;
uniform float uFlash;
void main() {
  vec3 c = texture2D(uTex, vUv).rgb;
  c = pow(max(c, 0.0), vec3(0.92));
  c *= vec3(1.04, 0.9, 0.82);
  float vig = smoothstep(0.2, 0.95, length(vUv - vec2(0.5, 0.48)));
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

export function PyreStage() {
  const glRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const roadARef = useRef<HTMLVideoElement>(null);
  const roadBRef = useRef<HTMLVideoElement>(null);
  const boltRef = useRef<HTMLVideoElement>(null);
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
    const frame = frameRef.current;
    if (!canvas || !fx || !roadA || !roadB || !bolt || !frame) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
    });
    const ctx = fx.getContext("2d");
    if (!gl || !ctx) return;

    const roadProg = program(gl, ROAD_FS);
    const boltProg = program(gl, BOLT_FS);
    const shadowProg = program(gl, SHADOW_FS);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const roadTex = makeTex(gl);
    const boltTex = makeTex(gl);
    const poster = new Image();
    poster.src = "/master/pyre-first.jpg";

    const keys = new Set<string>();
    let steerOverride: number | null = null;
    let lanePos = 0;
    let drag: { id: number; x: number; lane: number } | null = null;
    let distance = 0;
    let wounds = 0;
    let invuln = 0;
    let flash = 0;
    let shake = 0;
    let spawnIn = 1.15;
    let activeRoad = 0;
    let best = readPeak();
    const hazards: Hazard[] = [];
    const trail: { lane: number; age: number }[] = [];
    const roads = [roadA, roadB];

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

    const playSafe = (video: HTMLVideoElement) => {
      const pending = video.play();
      if (pending) pending.catch(() => undefined);
    };

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
    };

    const begin = () => {
      phaseRef.current = "run";
      distance = 0;
      wounds = 0;
      invuln = 0;
      flash = 0;
      lanePos = 0;
      hazards.length = 0;
      trail.length = 0;
      spawnIn = 1.15;
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
      drag = { id: event.pointerId, x: event.clientX, lane: lanePos };
      try {
        frame.setPointerCapture(event.pointerId);
      } catch {
        /* synthetic events */
      }
    };
    const onSlideMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      slideTo(event.clientX, drag.x, drag.lane);
    };
    const onSlideUp = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      slideTo(event.clientX, drag.x, drag.lane);
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
        if (spawnIn <= 0) {
          const roll = Math.random();
          const lane = roll < 0.34 ? -1 : roll < 0.67 ? 0 : 1;
          hazards.push({ lane, t: 0, life: 2.65 });
          spawnIn = 1.15 + Math.random() * 0.55;
        }
        for (let i = hazards.length - 1; i >= 0; i -= 1) {
          const hazard = hazards[i]!;
          hazard.t += dt;
          if (hazard.t >= hazard.life) {
            if (Math.abs(lanePos - hazard.lane) < 0.42) hit();
            hazards.splice(i, 1);
          }
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
        if (bolt.playbackRate !== BOLT_RATE) bolt.playbackRate = BOLT_RATE;
        if (bolt.paused) playSafe(bolt);
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

      gl.disable(gl.BLEND);
      gl.useProgram(roadProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, roadTex);
      gl.uniform1i(gl.getUniformLocation(roadProg, "uTex"), 0);
      gl.uniform1f(gl.getUniformLocation(roadProg, "uFlash"), flash);
      drawBuffer(FULL);

      if (phaseRef.current !== "cover" && bolt.readyState >= 2) {
        const aspect = canvas.width / canvas.height;
        const h = BOLT_H;
        const w = (h * BOLT_ASPECT) / aspect;
        const y = PLANT_Y - PAW_V * h;
        const x = 0.5 + lanePos * SLIDE_AMP - w / 2;
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(shadowProg);
        const pawX = 0.5 + lanePos * SLIDE_AMP;
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

      ctx.clearRect(0, 0, fx.width, fx.height);
      if (running) {
        for (const hazard of hazards) {
          const p = hazard.t / hazard.life;
          const x = (0.5 + hazard.lane * SLIDE_AMP) * fx.width;
          const y = (0.4 + p * 0.4) * fx.height;
          const s = (0.35 + p * 0.9) * fx.width * 0.045;
          ctx.save();
          ctx.translate(x, y);
          ctx.globalAlpha = 0.28 + p * 0.72;
          ctx.strokeStyle = "rgba(154, 36, 51, 0.85)";
          ctx.lineWidth = Math.max(2, fx.width * 0.008);
          ctx.beginPath();
          ctx.moveTo(0, -fx.height * 0.18 * (1 - p));
          ctx.lineTo(0, -s);
          ctx.stroke();
          ctx.fillStyle = "#efe6d6";
          ctx.beginPath();
          ctx.moveTo(0, -s * 1.8);
          ctx.lineTo(s * 0.42, s * 0.15);
          ctx.lineTo(0, s * 0.45);
          ctx.lineTo(-s * 0.42, s * 0.15);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#9a2433";
          ctx.beginPath();
          ctx.ellipse(0, s * 0.35, s * 0.7, s * 0.22, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
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
                ? `${lastRun} paces before the spikes closed. Best ${peak}.`
                : "A gothic causeway under a blood moon. The shepherd sprints. The stone comes at you."}
            </p>
            <button type="button" className="pyre-start" onClick={start}>
              Start
            </button>
            <p className="pyre-note">Slide across the causeway. Stay off the bone spikes.</p>
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

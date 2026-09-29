import * as THREE from "three";

export type TouchPilot = {
  stickX: number;
  stickY: number;
  rise: number;
  boost: boolean;
  lookDx: number;
  lookDy: number;
};

export type VoidHud = {
  speed: number;
  bearing: string;
  place: string;
};

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const PLATE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D map;
uniform float alpha;
uniform float feather;
uniform vec2 lightUv;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(map, vUv).rgb;
  float e = 1.0;
  if (feather > 0.001) {
    e = smoothstep(0.0, feather, vUv.x) * smoothstep(1.0, 1.0 - feather, vUv.x);
    e *= smoothstep(0.0, feather, vUv.y) * smoothstep(1.0, 1.0 - feather, vUv.y);
  }
  float d = distance(vUv, lightUv);
  float gloss = exp(-d * d * 5.5) * 0.22;
  vec3 rgb = c * (0.92 + gloss) + gloss * vec3(0.25, 0.72, 0.78);
  gl_FragColor = vec4(rgb, alpha * e);
}
`;

const SHELL_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SHELL_FRAG = /* glsl */ `
precision mediump float;
uniform sampler2D flank;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(flank, vUv).rgb;
  float m = max(c.r, max(c.g, c.b));
  if (m < 0.035) discard;
  gl_FragColor = vec4(c, 1.0);
}
`;

const BOLT_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D still;
uniform sampler2D run;
uniform float mixRun;
varying vec2 vUv;
void main() {
  vec3 body = mix(texture2D(still, vUv).rgb, texture2D(run, vUv).rgb, mixRun);
  float m = max(body.r, max(body.g, body.b));
  float fur = smoothstep(0.045, 0.16, m);
  if (fur < 0.04) discard;
  gl_FragColor = vec4(body, fur);
}
`;

const TURN = 1.55;
const ACCEL = 42;
const DRAG = 1.35;
const STRAFE = 26;
const LOOK = 0.00215;

const SHIP = new THREE.Vector3(0, 4, -52);

function makeVideo(src: string, bin: HTMLElement) {
  const video = document.createElement("video");
  video.src = src;
  video.loop = true;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.setAttribute("playsinline", "");
  video.setAttribute("muted", "");
  video.crossOrigin = "anonymous";
  bin.appendChild(video);
  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return { video, texture };
}

function plateMaterial(texture: THREE.Texture, alpha: number, feather: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: texture },
      alpha: { value: alpha },
      feather: { value: feather },
      lightUv: { value: new THREE.Vector2(0.5, 0.5) },
    },
    vertexShader: VERT,
    fragmentShader: PLATE_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.FrontSide,
    toneMapped: false,
  });
}

export function mountVoidBiome(
  canvas: HTMLCanvasElement,
  touch: TouchPilot,
  onHud: (hud: VoidHud) => void,
) {
  const bin = document.createElement("div");
  bin.setAttribute("aria-hidden", "true");
  bin.style.cssText = "position:fixed;width:0;height:0;overflow:hidden;pointer-events:none";
  document.body.appendChild(bin);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
    premultipliedAlpha: false,
  });
  renderer.setClearColor(0x000000, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const mobile = window.matchMedia("(max-width: 800px)").matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(64, 1, 0.08, 8000);
  scene.add(camera);

  const videos: HTMLVideoElement[] = [];
  const geo = new THREE.PlaneGeometry(1, 1);

  const sky = new THREE.Group();
  scene.add(sky);
  const skyReach = 420;
  const skyFaces: { src: string; pos: [number, number, number]; rot: [number, number, number] }[] = [
    { src: "/biome/sky-n.mp4", pos: [0, 0, -1], rot: [0, 0, 0] },
    { src: "/biome/sky-s.mp4", pos: [0, 0, 1], rot: [0, Math.PI, 0] },
    { src: "/biome/sky-e.mp4", pos: [1, 0, 0], rot: [0, -Math.PI / 2, 0] },
    { src: "/biome/sky-w.mp4", pos: [-1, 0, 0], rot: [0, Math.PI / 2, 0] },
    { src: "/biome/sky-u.mp4", pos: [0, 1, 0], rot: [Math.PI / 2, 0, 0] },
    { src: "/biome/sky-d.mp4", pos: [0, -1, 0], rot: [-Math.PI / 2, 0, 0] },
  ];
  for (const face of skyFaces) {
    const { video, texture } = makeVideo(face.src, bin);
    videos.push(video);
    const mesh = new THREE.Mesh(geo, plateMaterial(texture, 1, 0.14));
    mesh.position.set(face.pos[0] * skyReach, face.pos[1] * skyReach, face.pos[2] * skyReach);
    mesh.rotation.set(face.rot[0], face.rot[1], face.rot[2]);
    mesh.scale.set(skyReach * 2.55 * (16 / 9), skyReach * 2.55, 1);
    mesh.frustumCulled = false;
    mesh.renderOrder = 0;
    sky.add(mesh);
  }

  const shipW = 300;
  const shipH = 170;
  const BEAM = 12;
  const HULL_W = 192;
  const HULL_H = 108;
  const shipRoot = new THREE.Group();
  scene.add(shipRoot);
  const loader = new THREE.TextureLoader();
  const stillTex = (src: string) => {
    const tex = loader.load(src);
    tex.colorSpace = THREE.NoColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  };
  const flankMap = stillTex("/biome/ship-flank.jpg");
  const shellMat = new THREE.ShaderMaterial({
    uniforms: { flank: { value: flankMap } },
    vertexShader: SHELL_VERT,
    fragmentShader: SHELL_FRAG,
    side: THREE.DoubleSide,
    depthWrite: true,
    depthTest: true,
    transparent: true,
    toneMapped: false,
  });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(shipW, shipH), shellMat);
  card.position.z = 1;
  card.frustumCulled = false;
  card.renderOrder = 3;
  shipRoot.add(card);
  const hullThick = new Float32Array(HULL_W * HULL_H);
  const deckY = new Float32Array(HULL_W);
  const deckT = new Float32Array(HULL_W);
  const sampleThick = (x: number, y: number) => {
    const u = x / shipW + 0.5;
    const v = y / shipH + 0.5;
    if (u <= 0 || v <= 0 || u >= 1 || v >= 1) return 0;
    const fx = u * (HULL_W - 1);
    const fy = v * (HULL_H - 1);
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const tx = fx - i;
    const ty = fy - j;
    const at = (ii: number, jj: number) => hullThick[Math.max(0, Math.min(HULL_H - 1, jj)) * HULL_W + Math.max(0, Math.min(HULL_W - 1, ii))];
    const a = at(i, j);
    const b = at(i + 1, j);
    const c = at(i, j + 1);
    const d = at(i + 1, j + 1);
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
  };
  const depthImg = new Image();
  depthImg.onload = () => {
    const canvas2d = document.createElement("canvas");
    canvas2d.width = depthImg.width;
    canvas2d.height = depthImg.height;
    const ctx = canvas2d.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(depthImg, 0, 0);
    const px = ctx.getImageData(0, 0, canvas2d.width, canvas2d.height).data;
    const gw = canvas2d.width;
    const gh = canvas2d.height;
    if (gw !== HULL_W || gh !== HULL_H) return;
    const front = new Int32Array(gw * gh).fill(-1);
    const positions: number[] = [];
    const uvs: number[] = [];
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const src = ((gh - 1 - j) * gw + i) * 4;
        const half = (px[src + 1] > 128 ? px[src] / 255 : 0) * BEAM;
        hullThick[j * gw + i] = half;
        if (half > deckT[i]) {
          deckT[i] = half;
          deckY[i] = (j / (gh - 1) - 0.5) * shipH;
        }
        if (half < 0.35) continue;
        const u = i / (gw - 1);
        const v = j / (gh - 1);
        const x = (u - 0.5) * shipW;
        const y = (v - 0.5) * shipH;
        positions.push(x, y, half, x, y, -half);
        uvs.push(u, v, u, v);
        front[j * gw + i] = (positions.length / 3) - 2;
      }
    }
    const indices: number[] = [];
    const cell = (i: number, j: number) => {
      if (i < 0 || j < 0 || i >= gw - 1 || j >= gh - 1) return false;
      return front[j * gw + i] >= 0 && front[j * gw + i + 1] >= 0 && front[(j + 1) * gw + i] >= 0 && front[(j + 1) * gw + i + 1] >= 0;
    };
    for (let j = 0; j < gh - 1; j++) {
      for (let i = 0; i < gw - 1; i++) {
        if (!cell(i, j)) continue;
        const a = front[j * gw + i];
        const b = front[j * gw + i + 1];
        const c = front[(j + 1) * gw + i + 1];
        const d = front[(j + 1) * gw + i];
        indices.push(a, b, c, a, c, d, a + 1, c + 1, b + 1, a + 1, d + 1, c + 1);
      }
    }
    const stitch = (a: number, b: number) => {
      indices.push(a, b, b + 1, a, b + 1, a + 1);
    };
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const a = front[j * gw + i];
        if (a < 0) continue;
        if (i + 1 < gw && front[j * gw + i + 1] >= 0 && !(cell(i, j) || cell(i, j - 1))) stitch(a, front[j * gw + i + 1]);
        if (j + 1 < gh && front[(j + 1) * gw + i] >= 0 && !(cell(i, j) || cell(i - 1, j))) stitch(a, front[(j + 1) * gw + i]);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, shellMat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    shipRoot.add(mesh);
    card.visible = false;
  };
  depthImg.src = "/biome/ship-depth.png";
  shipRoot.position.copy(SHIP);

  const breath = makeVideo("/biome/bolt-breath.mp4", bin);
  const gallop = makeVideo("/biome/bolt-gallop.mp4", bin);
  videos.push(breath.video, gallop.video);
  const boltMat = new THREE.ShaderMaterial({
    uniforms: {
      still: { value: breath.texture },
      run: { value: gallop.texture },
      mixRun: { value: 0 },
    },
    vertexShader: VERT,
    fragmentShader: BOLT_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const bolt = new THREE.Mesh(geo, boltMat);
  bolt.position.set(0, -0.52, -2.2);
  bolt.scale.set(2.05 * (9 / 16), 2.05, 1);
  bolt.renderOrder = 20;
  bolt.frustumCulled = false;
  camera.add(bolt);
  const fitBolt = () => {
    const w = breath.video.videoWidth || gallop.video.videoWidth;
    const h = breath.video.videoHeight || gallop.video.videoHeight;
    if (!w || !h) return;
    const height = 2.05;
    bolt.scale.set(height * (w / h), height, 1);
  };
  breath.video.addEventListener("loadedmetadata", fitBolt);
  gallop.video.addEventListener("loadedmetadata", fitBolt);
  fitBolt();

  const pos = new THREE.Vector3(0, 12, 28);
  const vel = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const toCam = new THREE.Vector3();
  const plateNormal = new THREE.Vector3();
  let yaw = 0;
  let pitch = 0;
  let speed = 0;
  let hudAcc = 0;
  let runMix = 0;
  let bank = 0;
  let landed = false;
  let shipSpeed = 0;
  let shipAge = 0;
  let inside = false;
  let soundOn = true;

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  };
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  const keys = new Set<string>();
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
    keys.add(e.code);
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.code);
  };
  const onBlur = () => {
    keys.clear();
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  let audio: AudioContext | null = null;
  let master: GainNode | null = null;
  const ensureSound = () => {
    if (audio) return;
    const Ctx = window.AudioContext;
    audio = new Ctx();
    master = audio.createGain();
    master.gain.value = soundOn ? 0.02 : 0;
    master.connect(audio.destination);
    const bed = audio.createOscillator();
    bed.type = "sine";
    bed.frequency.value = 46;
    const high = audio.createOscillator();
    high.type = "sine";
    high.frequency.value = 69.3;
    const highGain = audio.createGain();
    highGain.gain.value = 0.28;
    bed.connect(master);
    high.connect(highGain);
    highGain.connect(master);
    bed.start();
    high.start();
  };

  let armed = false;
  const arm = () => {
    armed = true;
    for (const video of videos) {
      video.muted = true;
      const pending = video.play();
      if (pending) {
        pending.catch(() => {
          video.muted = true;
          void video.play().catch(() => undefined);
        });
      }
    }
    ensureSound();
    void audio?.resume();
  };
  const setSound = (on: boolean) => {
    soundOn = on;
    if (!audio) {
      if (on && armed) ensureSound();
      return;
    }
    if (master) master.gain.value = on ? 0.02 : 0;
    if (on) void audio.resume();
  };

  let dragging = false;
  let lastTapAt = 0;
  const fingers = new Map<number, { x: number; y: number; ox: number; oy: number; side: "move" | "look" }>();
  const dropFinger = (id: number) => {
    fingers.delete(id);
    if (![...fingers.values()].some((finger) => finger.side === "move")) {
      touch.stickX = 0;
      touch.stickY = 0;
    }
    if (fingers.size < 2) touch.rise = 0;
  };
  const onPointerDown = (e: PointerEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest("[data-ui]")) return;
    if (!armed) arm();
    if (e.pointerType === "touch") {
      e.preventDefault();
      const side = e.clientX < window.innerWidth * 0.46 ? "move" : "look";
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY, side });
      return;
    }
    if (e.button !== 0) return;
    dragging = true;
    if (armed) {
      const lock = canvas.requestPointerLock?.();
      void lock?.catch(() => undefined);
    }
  };
  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === "touch") {
      const finger = fingers.get(e.pointerId);
      const moved = finger ? (e.clientX - finger.ox) ** 2 + (e.clientY - finger.oy) ** 2 : 999;
      dropFinger(e.pointerId);
      if (moved < 22 * 22) {
        const now = performance.now();
        if (now - lastTapAt < 300) {
          touch.boost = !touch.boost;
          lastTapAt = 0;
        } else lastTapAt = now;
      }
      return;
    }
    dragging = false;
  };
  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === "touch") {
      const finger = fingers.get(e.pointerId);
      if (!finger) return;
      const prevX = finger.x;
      const prevY = finger.y;
      finger.x = e.clientX;
      finger.y = e.clientY;
      if (fingers.size >= 2) {
        let best = 0;
        for (const held of fingers.values()) {
          const dy = held.oy - held.y;
          if (Math.abs(dy) > Math.abs(best)) best = dy;
        }
        touch.rise = Math.max(-1, Math.min(1, best / 72));
        return;
      }
      if (finger.side === "look") {
        touch.lookDx += e.clientX - prevX;
        touch.lookDy += e.clientY - prevY;
      } else {
        const dx = e.clientX - finger.ox;
        const dy = e.clientY - finger.oy;
        touch.stickX = Math.abs(dx) < 16 ? 0 : Math.max(-1, Math.min(1, dx / 74));
        touch.stickY = Math.abs(dy) < 16 ? 0 : Math.max(-1, Math.min(1, -dy / 74));
      }
      return;
    }
    const locked = document.pointerLockElement === canvas;
    if (!locked && !dragging) return;
    yaw -= e.movementX * LOOK;
    pitch = Math.max(-1.2, Math.min(1.2, pitch - e.movementY * LOOK));
  };
  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("pointermove", onPointerMove);

  window.__controlsTest = {
    getYaw: () => yaw,
    getSpeed: () => speed,
    setKeys: (codes: string[]) => {
      keys.clear();
      for (const code of codes) keys.add(code);
    },
    setPose: (x: number, y: number, z: number, faceYaw: number) => {
      pos.set(x, y, z);
      vel.set(0, 0, 0);
      yaw = faceYaw;
      pitch = 0;
    },
    isAboard: () => pos.distanceTo(SHIP) < 80,
    isLanded: () => landed,
    isGrounded: () => false,
    getPose: () => ({ x: pos.x, y: pos.y, z: pos.z, yaw, speed }),
  };

  const timer = new THREE.Timer();
  timer.connect(document);
  const cp0 = Math.cos(pitch);
  forward.set(-Math.sin(yaw) * cp0, Math.sin(pitch), -Math.cos(yaw) * cp0);
  desired.copy(pos).addScaledVector(forward, -6.2).addScaledVector(up, 1.1);
  camPos.copy(desired);
  camera.position.copy(camPos);
  lookAt.copy(pos).addScaledVector(forward, 12);
  camera.lookAt(lookAt);

  const step = (dt: number) => {
    let steer = 0;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) steer += 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) steer -= 1;
    steer -= touch.stickX;
    const yawBefore = yaw;
    yaw += steer * TURN * dt;
    yaw -= touch.lookDx * LOOK;
    pitch = Math.max(-1.2, Math.min(1.2, pitch - touch.lookDy * LOOK));
    touch.lookDx = 0;
    touch.lookDy = 0;

    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    forward.set(-Math.sin(yaw) * cp, sp, -Math.cos(yaw) * cp);
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));

    let throttle = 0;
    if (keys.has("KeyW") || keys.has("ArrowUp")) throttle += 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) throttle -= 1;
    throttle += touch.stickY;
    const boost = keys.has("ShiftLeft") || keys.has("ShiftRight") || touch.boost;
    let rise = touch.rise;
    if (keys.has("Space")) rise += 1;
    if (keys.has("KeyC") || keys.has("ControlLeft") || keys.has("ControlRight")) rise -= 1;

    const accel = ACCEL * (boost ? 2.35 : 1);
    vel.addScaledVector(forward, throttle * accel * dt);
    vel.y += rise * STRAFE * dt;
    const drag = Math.exp(-DRAG * dt);
    vel.multiplyScalar(drag);
    pos.addScaledVector(vel, dt);

    shipAge += dt;
    const lead = pos.z - SHIP.z;
    const cruiseSpeed = lead > 80 ? 2.2 : 7;
    const wantSpeed = shipAge < 4 ? 0 : cruiseSpeed;
    shipSpeed = THREE.MathUtils.damp(shipSpeed, wantSpeed, 0.7, dt);
    SHIP.z -= shipSpeed * dt;
    shipRoot.position.copy(SHIP);

    let lx = pos.x - SHIP.x;
    let ly = pos.y - SHIP.y;
    let lz = pos.z - SHIP.z;
    const colU = lx / shipW + 0.5;
    const colI = Math.max(0, Math.min(HULL_W - 1, Math.round(colU * (HULL_W - 1))));
    const top = deckY[colI];
    const topT = deckT[colI];
    if (landed && (rise > 0.45 || topT < 1 || ly > top + 16)) {
      landed = false;
      if (rise > 0.45) vel.y = Math.max(vel.y, 18);
    }
    if (!landed && topT > 2 && Math.abs(lz) < topT + 3 && ly > top - 1.5 && ly < top + 10 && rise <= 0.05) {
      landed = true;
    }
    if (!landed) {
      for (let n = 0; n < 5; n++) {
        const t = sampleThick(lx, ly);
        if (t < 0.4 || Math.abs(lz) >= t) break;
        const penZ = t - Math.abs(lz);
        const gx = sampleThick(lx + 2.2, ly) - sampleThick(lx - 2.2, ly);
        const gy = sampleThick(lx, ly + 2.2) - sampleThick(lx, ly - 2.2);
        const glen = Math.hypot(gx, gy);
        const penXY = glen > 0.15 ? (t * 4.4) / glen : 99;
        if (penZ <= penXY) {
          lz = Math.sign(lz || 1) * (t + 0.4);
          vel.z = -shipSpeed;
          break;
        }
        lx -= (gx / glen) * 2.4;
        ly -= (gy / glen) * 2.4;
        vel.x = 0;
        vel.y = Math.min(vel.y, 0);
      }
      pos.x = SHIP.x + lx;
      pos.y = SHIP.y + ly;
      pos.z = SHIP.z + lz;
    }
    if (landed) {
      const slide = THREE.MathUtils.clamp(-steer * 12, -16, 16);
      pos.x = THREE.MathUtils.damp(pos.x, pos.x + slide * dt * 3, 6, dt);
      lx = pos.x - SHIP.x;
      const u = Math.max(0, Math.min(HULL_W - 1, Math.round((lx / shipW + 0.5) * (HULL_W - 1))));
      const stand = deckY[u];
      const standT = deckT[u];
      if (standT < 1) landed = false;
      else {
        pos.y = SHIP.y + stand + 1.3;
        pos.z = THREE.MathUtils.clamp(pos.z, SHIP.z - standT + 1, SHIP.z + standT - 1);
        vel.set(0, 0, -shipSpeed);
        speed = Math.abs(slide);
      }
    }
    if (!landed) speed = vel.length();
    const running = speed > 3;
    runMix = THREE.MathUtils.damp(runMix, running ? 1 : 0, 6, dt);
    boltMat.uniforms.mixRun.value = runMix;
    if (gallop.video.readyState >= 2) {
      const rate = THREE.MathUtils.clamp(0.9 + speed / 22, 0.9, 1.7);
      if (Math.abs(gallop.video.playbackRate - rate) > 0.08) gallop.video.playbackRate = rate;
    }

    desired.copy(pos).addScaledVector(forward, -6.4).addScaledVector(up, 1.15 * cp);
    camPos.lerp(desired, 1 - Math.exp(-7 * dt));
    camera.position.copy(camPos);
    lookAt.copy(pos).addScaledVector(forward, 16);
    camera.lookAt(lookAt);

    const yawRate = (yaw - yawBefore) / Math.max(dt, 0.001);
    const bankTarget = THREE.MathUtils.clamp(yawRate * 0.14, -0.4, 0.4);
    bank = THREE.MathUtils.damp(bank, bankTarget, 7, dt);
    bolt.position.set(0, -0.55, -2.15);
    bolt.rotation.set(pitch * 0.1, 0, bank);
    camera.fov = THREE.MathUtils.damp(camera.fov, boost ? 76 : 63, 4, dt);
    camera.updateProjectionMatrix();
    sky.position.copy(pos);
    sky.rotation.y = pos.z * 0.004;
    sky.rotation.x = pos.y * 0.002;


    hudAcc += dt;
    if (hudAcc > 0.12) {
      hudAcc = 0;
      const deg = ((yaw * 180) / Math.PI) % 360;
      const bearing = `${Math.round((deg + 360) % 360)
        .toString()
        .padStart(3, "0")}°`;
      const near = pos.distanceTo(SHIP);
      onHud({
        speed: Math.round(speed),
        bearing,
        place: landed ? "On the hull" : near < 160 ? "Meridian" : "open void",
      });
    }
  };

  renderer.setAnimationLoop((stamp: number) => {
    timer.update(stamp);
    const dt = Math.min(timer.getDelta(), 0.05);
    if (dt > 0) step(dt);
    renderer.render(scene, camera);
  });

  return {
    arm,
    setSound,
    destroy() {
      renderer.setAnimationLoop(null);
      timer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("pointermove", onPointerMove);
      if (window.__controlsTest) delete window.__controlsTest;
      for (const video of videos) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
      bin.remove();
      geo.dispose();
      renderer.dispose();
      void audio?.close();
    },
  };
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys: (codes: string[]) => void;
      setPose: (x: number, y: number, z: number, faceYaw: number) => void;
      isAboard: () => boolean;
      isLanded: () => boolean;
      isGrounded: () => boolean;
      getPose: () => { x: number; y: number; z: number; yaw: number; speed: number };
    };
  }
}

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
uniform sampler2D map;
varying vec2 vUv;
void main() {
  gl_FragColor = vec4(texture2D(map, vUv).rgb, 1.0);
}
`;

const METAL_FRAG = /* glsl */ `
precision mediump float;
varying vec2 vUv;
void main() {
  float rim = smoothstep(0.0, 0.07, vUv.x) * smoothstep(1.0, 0.93, vUv.x);
  rim *= smoothstep(0.0, 0.07, vUv.y) * smoothstep(1.0, 0.93, vUv.y);
  vec3 c = vec3(0.07, 0.074, 0.086) + vUv.y * 0.025;
  c += (1.0 - rim) * vec3(0.11, 0.08, 0.035);
  gl_FragColor = vec4(c, 1.0);
}
`;

const GUN_FRAG = /* glsl */ `
precision mediump float;
varying vec2 vUv;
void main() {
  float along = vUv.y;
  float around = vUv.x;
  float band = smoothstep(0.035, 0.0, abs(fract(along * 5.0) - 0.18));
  float muzzle = smoothstep(0.9, 0.96, along);
  vec3 steel = vec3(0.1, 0.105, 0.115) * (0.72 + 0.28 * sin(around * 6.28318));
  vec3 gold = vec3(0.78, 0.58, 0.2);
  vec3 c = mix(steel, gold, clamp(band + muzzle * 0.85, 0.0, 1.0));
  c = mix(c, vec3(0.015, 0.018, 0.02), smoothstep(0.93, 1.0, along));
  gl_FragColor = vec4(c, 1.0);
}
`;

const GOLD_FRAG = /* glsl */ `
precision mediump float;
varying vec2 vUv;
void main() {
  vec3 c = vec3(0.66, 0.48, 0.16) * (0.82 + 0.18 * vUv.y);
  gl_FragColor = vec4(c, 1.0);
}
`;

const CRAFT_FRAG = /* glsl */ `
precision mediump float;
varying vec2 vUv;
void main() {
  vec3 hull = vec3(0.07, 0.075, 0.09);
  float win = smoothstep(0.18, 0.28, vUv.x) * smoothstep(0.78, 0.68, vUv.x);
  win *= smoothstep(0.3, 0.42, vUv.y) * smoothstep(0.72, 0.6, vUv.y);
  vec3 c = hull + win * vec3(0.15, 0.72, 0.9);
  gl_FragColor = vec4(c, 1.0);
}
`;


const STERN_FRAG = /* glsl */ `
precision mediump float;
uniform sampler2D map;
uniform vec4 crop;
varying vec2 vUv;
void main() {
  if (vUv.x < 0.0 || vUv.y < 0.0 || vUv.x > 1.0 || vUv.y > 1.0) discard;
  vec2 tuv = vec2(mix(crop.x, crop.z, vUv.x), mix(crop.y, crop.w, vUv.y));
  vec3 c = texture2D(map, tuv).rgb;
  if (c.r + c.g + c.b < 0.09) discard;
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

const SHIP = new THREE.Vector3(0, 8, -168);

function makeVideo(src: string, bin: HTMLElement) {
  const video = document.createElement("video");
  video.src = src;
  video.loop = true;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.autoplay = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("muted", "");
  video.crossOrigin = "anonymous";
  bin.appendChild(video);
  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  void video.play().catch(() => undefined);
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
    depthTest: true,
    side: THREE.FrontSide,
    toneMapped: false,
  });
}

export function mountVoidBiome(
  canvas: HTMLCanvasElement,
  touch: TouchPilot,
  onHud: (hud: VoidHud) => void,
) {
  SHIP.set(0, 8, -168);
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

  const shipLen = 520;
  const shipH = 102;
  const shipBeam = 120;
  const shipYaw = 0.28;
  const NX = 160;
  const hullTop = new Float32Array(NX);
  const hullBot = new Float32Array(NX);
  const hullHalf = new Float32Array(NX);
  let hullReady = false;
  let hullX0 = -shipLen * 0.5;
  let hullX1 = shipLen * 0.5;
  let bayOn = false;
  let bayX0 = 0;
  let bayX1 = 0;
  const bayFloorT = new Float32Array(NX);
  const bayCeilT = new Float32Array(NX);
  let bayDepth = 34;
  const blocks: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }[] = [];
  const shipRoot = new THREE.Group();
  shipRoot.rotation.y = shipYaw;
  scene.add(shipRoot);
  const loader = new THREE.TextureLoader();
  const stillTex = (src: string) => {
    const tex = loader.load(src);
    tex.colorSpace = THREE.NoColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  };
  const flankMap = stillTex("/biome/ship-flank.jpg");
  const topMap = stillTex("/biome/ship-top.jpg");
  const bellyMap = stillTex("/biome/ship-belly.jpg");
  const sternMap = stillTex("/biome/ship-stern.jpg");
  const flankHiMap = [0, 1, 2, 3].map((i) => stillTex(`/biome/flank-${i}.jpg`));
  const topHiMap = [0, 1, 2, 3].map((i) => stillTex(`/biome/top-${i}.jpg`));
  const bellyHiMap = [0, 1, 2, 3].map((i) => stillTex(`/biome/belly-${i}.jpg`));
  const bayBackMap = stillTex("/biome/hangar-back.jpg");
  const bayFloorMap = stillTex("/biome/hangar-floor.jpg");
  const bayCeilMap = stillTex("/biome/hangar-ceiling.jpg");
  const bayWallMap = stillTex("/biome/hangar-wall.jpg");
  const faceMat = (map: THREE.Texture) =>
    new THREE.ShaderMaterial({
      uniforms: { map: { value: map } },
      vertexShader: SHELL_VERT,
      fragmentShader: SHELL_FRAG,
      side: THREE.DoubleSide,
      depthWrite: true,
      depthTest: true,
      toneMapped: false,
    });
  const metalMat = new THREE.ShaderMaterial({
    vertexShader: SHELL_VERT,
    fragmentShader: METAL_FRAG,
    side: THREE.DoubleSide,
    depthWrite: true,
    depthTest: true,
    toneMapped: false,
  });
  const sternMat = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: sternMap },
      crop: { value: new THREE.Vector4(0, 0, 1, 1) },
    },
    vertexShader: SHELL_VERT,
    fragmentShader: STERN_FRAG,
    side: THREE.DoubleSide,
    depthWrite: true,
    depthTest: true,
    toneMapped: false,
  });
  type Pix = { data: Uint8ClampedArray; w: number; h: number };
  const loadPix = (src: string) =>
    new Promise<Pix>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve({ data: new Uint8ClampedArray(16), w: 2, h: 2 });
          return;
        }
        ctx.drawImage(img, 0, 0);
        const im = ctx.getImageData(0, 0, c.width, c.height);
        resolve({ data: im.data, w: c.width, h: c.height });
      };
      img.onerror = () => resolve({ data: new Uint8ClampedArray(16), w: 2, h: 2 });
      img.src = src;
    });
  const sampleCol = (x: number) => {
    const u = x / shipLen + 0.5;
    if (u <= 0.002 || u >= 0.998) return null;
    const f = u * (NX - 1);
    const i = Math.floor(f);
    const t = f - i;
    const i1 = Math.min(NX - 1, i + 1);
    if (hullHalf[i] < 1 || hullHalf[i1] < 1) return null;
    return {
      top: hullTop[i] * (1 - t) + hullTop[i1] * t,
      bot: hullBot[i] * (1 - t) + hullBot[i1] * t,
      half: hullHalf[i] * (1 - t) + hullHalf[i1] * t,
    };
  };
  void Promise.all([
    loadPix("/biome/ship-flank.jpg"),
    loadPix("/biome/ship-top.jpg"),
    loadPix("/biome/ship-belly.jpg"),
    loadPix("/biome/ship-stern.jpg"),
    loadPix("/biome/cannon-side.jpg"),
    loadPix("/biome/cannon-top.jpg"),
    loadPix("/biome/cannon-bottom.jpg"),
    loadPix("/biome/cannon-muzzle.jpg"),
    ...[0, 1, 2, 3].flatMap((i) => [
      loadPix(`/biome/flank-${i}.jpg`),
      loadPix(`/biome/top-${i}.jpg`),
      loadPix(`/biome/belly-${i}.jpg`),
    ]),
  ]).then((loaded) => {
    const side = loaded[0];
    const top = loaded[1];
    const belly = loaded[2];
    const stern = loaded[3];
    const cSide = loaded[4];
    const cTop = loaded[5];
    const cBot = loaded[6];
    const cMuz = loaded[7];
    const flankHi = [0, 1, 2, 3].map((i) => loaded[8 + i * 3]);
    const topHi = [0, 1, 2, 3].map((i) => loaded[9 + i * 3]);
    const bellyHi = [0, 1, 2, 3].map((i) => loaded[10 + i * 3]);
    const lum = (p: Pix, x: number, y: number) => {
      const xx = Math.max(0, Math.min(p.w - 1, x | 0));
      const yy = Math.max(0, Math.min(p.h - 1, y | 0));
      const i = (yy * p.w + xx) * 4;
      return (p.data[i] + p.data[i + 1] + p.data[i + 2]) / 3;
    };
    const on = (p: Pix, x: number, y: number) => lum(p, x, y) > 16;
    const bounds = (p: Pix) => {
      let x0 = p.w;
      let y0 = p.h;
      let x1 = 0;
      let y1 = 0;
      for (let y = 0; y < p.h; y += 2) {
        for (let x = 0; x < p.w; x += 2) {
          if (!on(p, x, y)) continue;
          if (x < x0) x0 = x;
          if (y < y0) y0 = y;
          if (x > x1) x1 = x;
          if (y > y1) y1 = y;
        }
      }
      return { x0, y0, x1, y1 };
    };
    const colSpan = (p: Pix, box: { x0: number; y0: number; x1: number; y1: number }, u: number) => {
      const x = Math.round(box.x0 + u * (box.x1 - box.x0));
      let a = -1;
      let b = -1;
      for (let y = box.y0; y <= box.y1; y++) {
        if (!on(p, x, y)) continue;
        if (a < 0) a = y;
        b = y;
      }
      return a < 0 ? null : { a, b };
    };
    const sideBox = bounds(side);
    const topBox = bounds(top);
    const bellyBox = bounds(belly);
    const sternBox = bounds(stern);
    const s0 = new Int32Array(NX);
    const s1 = new Int32Array(NX);
    const rawHalf = new Float32Array(NX);
    let maxSpan = 1;
    for (let i = 0; i < NX; i++) {
      const u = i / (NX - 1);
      const ss = colSpan(side, sideBox, u);
      const ts = colSpan(top, topBox, u);
      if (!ss || !ts) continue;
      s0[i] = ss.a;
      s1[i] = ss.b;
      const span = ts.b - ts.a;
      rawHalf[i] = span;
      if (span > maxSpan) maxSpan = span;
    }
    for (let i = 0; i < NX; i++) {
      if (rawHalf[i] > 0) continue;
      let p = i - 1;
      let n = i + 1;
      while (p >= 0 && rawHalf[p] <= 0) p--;
      while (n < NX && rawHalf[n] <= 0) n++;
      if (p < 0 || n >= NX) continue;
      const t = (i - p) / (n - p);
      s0[i] = Math.round(s0[p] * (1 - t) + s0[n] * t);
      s1[i] = Math.round(s1[p] * (1 - t) + s1[n] * t);
      rawHalf[i] = rawHalf[p] * (1 - t) + rawHalf[n] * t;
    }
    for (let i = 0; i < NX; i++) {
      if (rawHalf[i] <= 0 || s1[i] <= s0[i]) continue;
      const topT = (s0[i] - sideBox.y0) / Math.max(1, sideBox.y1 - sideBox.y0);
      const botT = (s1[i] - sideBox.y0) / Math.max(1, sideBox.y1 - sideBox.y0);
      hullTop[i] = (0.5 - topT) * shipH;
      hullBot[i] = (0.5 - botT) * shipH;
      hullHalf[i] = (rawHalf[i] / maxSpan) * (shipBeam * 0.5);
    }
    const blur = (src: Float32Array) => {
      const tmp = Float32Array.from(src);
      for (let i = 1; i < NX - 1; i++) {
        if (src[i] === 0 || src[i - 1] === 0 || src[i + 1] === 0) continue;
        tmp[i] = src[i] * 0.5 + src[i - 1] * 0.25 + src[i + 1] * 0.25;
      }
      src.set(tmp);
    };
    blur(hullTop);
    blur(hullBot);
    blur(hullHalf);
    let i0 = 0;
    let i1 = NX - 1;
    while (i0 < NX && hullHalf[i0] < 2) i0++;
    while (i1 > i0 && hullHalf[i1] < 2) i1--;
    hullX0 = (i0 / (NX - 1) - 0.5) * shipLen;
    hullX1 = (i1 / (NX - 1) - 0.5) * shipLen;
    if (i1 - i0 < 4) return;
    const NY = 28;
    const NZ = 36;
    const pushMesh = (mat: THREE.ShaderMaterial, pos: number[], uv: number[], idx: number[], axis: number, sign: number) => {
      if (idx.length < 3) return;
      const order = idx.slice();
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(order);
      geo.computeVertexNormals();
      const nrm = geo.getAttribute("normal");
      let sum = 0;
      for (let i = 0; i < nrm.count; i += 6) sum += nrm.getComponent(i, axis);
      if (sum * sign < 0) {
        for (let t = 0; t < order.length; t += 3) {
          const tmp = order[t + 1];
          order[t + 1] = order[t + 2];
          order[t + 2] = tmp;
        }
        geo.setIndex(order);
        geo.computeVertexNormals();
      }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
      shipRoot.add(mesh);
    };
    const quad = (idx: number[], a: number, b: number, c: number, d: number) => {
      if (a < 0 || b < 0 || c < 0 || d < 0) return;
      idx.push(a, b, c, a, c, d);
    };
    const sideU = (i: number, t: number) => {
      const u = i / (NX - 1);
      const ix = sideBox.x0 + u * (sideBox.x1 - sideBox.x0);
      const iy = s1[i] + (s0[i] - s1[i]) * t;
      return [ix / side.w, 1 - iy / side.h, lum(side, ix, iy)] as const;
    };
    const pixU = (ix: number) => (ix - sideBox.x0) / Math.max(1, sideBox.x1 - sideBox.x0);
    const bayIx0 = 1085;
    const bayIx1 = 1475;
    const bayIyTop = 500;
    const bayIyBot = 615;
    const uA = Math.max(0, Math.min(1, pixU(bayIx0)));
    const uB = Math.max(0, Math.min(1, pixU(bayIx1)));
    bayX0 = (uA - 0.5) * shipLen;
    bayX1 = (uB - 0.5) * shipLen;
    const tOfIy = (i: number, iy: number) => {
      const den = s0[i] - s1[i];
      if (Math.abs(den) < 2) return -1;
      return (iy - s1[i]) / den;
    };
    for (let i = 0; i < NX; i++) {
      bayFloorT[i] = tOfIy(i, bayIyBot);
      bayCeilT[i] = tOfIy(i, bayIyTop);
    }
    const iA = Math.max(i0, Math.min(i1, Math.round(uA * (NX - 1))));
    const iB = Math.max(iA + 2, Math.min(i1, Math.round(uB * (NX - 1))));
    const midI = (iA + iB) >> 1;
    bayDepth = Math.min(40, Math.max(22, hullHalf[midI] - 16));
    bayOn = bayCeilT[midI] > bayFloorT[midI] + 0.04;
    const inOpening = (i: number, j: number) => {
      if (!bayOn) return false;
      const x = (i / (NX - 1) - 0.5) * shipLen;
      if (x <= bayX0 || x >= bayX1) return false;
      const t = j / NY;
      const tf = bayFloorT[i];
      const tc = bayCeilT[i];
      return tf >= 0 && tc > tf && t > tf && t < tc;
    };
    const contentBox = (p: Pix) => {
      let x0 = p.w;
      let y0 = p.h;
      let x1 = 0;
      let y1 = 0;
      for (let y = 0; y < p.h; y += 2) {
        for (let x = 0; x < p.w; x += 2) {
          if (lum(p, x, y) <= 16) continue;
          if (x < x0) x0 = x;
          if (y < y0) y0 = y;
          if (x > x1) x1 = x;
          if (y > y1) y1 = y;
        }
      }
      if (x1 <= x0 || y1 <= y0) return { x0: 0, y0: 0, x1: Math.max(1, p.w - 1), y1: Math.max(1, p.h - 1) };
      return { x0, y0, x1, y1 };
    };
    const colIx = (i: number) => {
      const u = i / (NX - 1);
      return sideBox.x0 + u * (sideBox.x1 - sideBox.x0);
    };
    const SECTIONS = 4;
    const flankBox = flankHi.map(contentBox);
    for (const sign of [1, -1] as const) {
      for (let s = 0; s < SECTIONS; s++) {
        const pixX0 = (s * side.w) / SECTIONS;
        const pixX1 = ((s + 1) * side.w) / SECTIONS;
        const owns = (i: number) => {
          const ix = colIx(i);
          return s === SECTIONS - 1 ? ix >= pixX0 && ix <= pixX1 + 1 : ix >= pixX0 && ix < pixX1;
        };
        let ia = i1;
        let ib = i0;
        for (let i = i0; i < i1; i++) {
          if (!owns(i)) continue;
          if (i < ia) ia = i;
          if (i + 1 > ib) ib = i + 1;
        }
        if (ib <= ia) continue;
        const box = flankBox[s];
        const img = flankHi[s];
        const pos: number[] = [];
        const uv: number[] = [];
        const idx: number[] = [];
        const row = new Int32Array((ib - ia + 1) * (NY + 1)).fill(-1);
        const at = (i: number, j: number) => row[(i - ia) * (NY + 1) + j];
        for (let i = ia; i <= ib; i++) {
          for (let j = 0; j <= NY; j++) {
            const t = j / NY;
            const y = hullBot[i] + t * (hullTop[i] - hullBot[i]);
            const x = (i / (NX - 1) - 0.5) * shipLen;
            const su = sideU(i, t);
            const edge = j === 0 || j === NY || i === ia || i === ib;
            const z = sign * (hullHalf[i] + (edge ? 0 : (su[2] / 255 - 0.42) * 2.2));
            const k = Math.max(0, Math.min(1, (colIx(i) - pixX0) / (pixX1 - pixX0)));
            const ixT = box.x0 + k * (box.x1 - box.x0);
            const iyT = box.y1 + t * (box.y0 - box.y1);
            pos.push(x, y, z);
            uv.push(ixT / img.w, 1 - iyT / img.h);
            row[(i - ia) * (NY + 1) + j] = pos.length / 3 - 1;
          }
        }
        for (let i = ia; i < ib; i++) {
          if (!owns(i)) continue;
          for (let j = 0; j < NY; j++) {
            if (inOpening(i, j) && inOpening(i + 1, j) && inOpening(i + 1, j + 1) && inOpening(i, j + 1)) continue;
            quad(idx, at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1));
          }
        }
        pushMesh(faceMat(flankHiMap[s]), pos, uv, idx, 2, sign);
      }
    }
    const deck = (
      up: boolean,
      p: Pix,
      box: { x0: number; y0: number; x1: number; y1: number },
      hi: Pix[],
      maps: THREE.Texture[],
    ) => {
      const boxes = hi.map(contentBox);
      for (let s = 0; s < SECTIONS; s++) {
        const pixX0 = (s * p.w) / SECTIONS;
        const pixX1 = ((s + 1) * p.w) / SECTIONS;
        const owns = (i: number) => {
          const u = i / (NX - 1);
          const uu = box.x0 + u * (box.x1 - box.x0);
          return s === SECTIONS - 1 ? uu >= pixX0 && uu <= pixX1 + 1 : uu >= pixX0 && uu < pixX1;
        };
        let ia = i1;
        let ib = i0;
        for (let i = i0; i < i1; i++) {
          if (!owns(i)) continue;
          if (i < ia) ia = i;
          if (i + 1 > ib) ib = i + 1;
        }
        if (ib <= ia) continue;
        const hb = boxes[s];
        const img = hi[s];
        const pos: number[] = [];
        const uv: number[] = [];
        const idx: number[] = [];
        const row = new Int32Array((ib - ia + 1) * (NZ + 1)).fill(-1);
        const at = (i: number, k: number) => row[(i - ia) * (NZ + 1) + k];
        for (let i = ia; i <= ib; i++) {
          const u = i / (NX - 1);
          const span = colSpan(p, box, u);
          const x = (u - 0.5) * shipLen;
          const uu = box.x0 + u * (box.x1 - box.x0);
          const kAlong = Math.max(0, Math.min(1, (uu - pixX0) / (pixX1 - pixX0)));
          for (let k = 0; k <= NZ; k++) {
            const t = k / NZ;
            const z0 = -hullHalf[i] + t * hullHalf[i] * 2;
            const edge = k === 0 || k === NZ || i === ia || i === ib;
            let y = up ? hullTop[i] : hullBot[i];
            let vv = box.y0 + t * (box.y1 - box.y0);
            if (span) vv = span.a + t * (span.b - span.a);
            if (!edge) y += (up ? 1 : -1) * (lum(p, uu, vv) / 255 - 0.42) * 1.4;
            const ixT = hb.x0 + kAlong * (hb.x1 - hb.x0);
            const iyT = hb.y0 + t * (hb.y1 - hb.y0);
            pos.push(x, y, z0);
            uv.push(ixT / img.w, 1 - iyT / img.h);
            row[(i - ia) * (NZ + 1) + k] = pos.length / 3 - 1;
          }
        }
        for (let i = ia; i < ib; i++) {
          if (!owns(i)) continue;
          for (let k = 0; k < NZ; k++) quad(idx, at(i, k), at(i + 1, k), at(i + 1, k + 1), at(i, k + 1));
        }
        pushMesh(faceMat(maps[s]), pos, uv, idx, 1, up ? 1 : -1);
      }
    };
    deck(true, top, topBox, topHi, topHiMap);
    deck(false, belly, bellyBox, bellyHi, bellyHiMap);
    const cap = (i: number, nose: boolean) => {
      const pos: number[] = [];
      const uv: number[] = [];
      const idx: number[] = [];
      const x = (i / (NX - 1) - 0.5) * shipLen;
      const u = i / (NX - 1);
      const ix = sideBox.x0 + u * (sideBox.x1 - sideBox.x0);
      for (let j = 0; j <= NY; j++) {
        for (let k = 0; k <= NZ; k++) {
          const ty = j / NY;
          const tz = k / NZ;
          const y = hullBot[i] + ty * (hullTop[i] - hullBot[i]);
          const z = -hullHalf[i] + tz * hullHalf[i] * 2;
          const iy = s1[i] + (s0[i] - s1[i]) * ty;
          pos.push(x, y, z);
          uv.push(ix / side.w, 1 - iy / side.h);
        }
      }
      const at = (j: number, k: number) => j * (NZ + 1) + k;
      for (let j = 0; j < NY; j++) {
        for (let k = 0; k < NZ; k++) quad(idx, at(j, k), at(j, k + 1), at(j + 1, k + 1), at(j + 1, k));
      }
      pushMesh(metalMat, pos, uv, idx, 0, nose ? 1 : -1);
      if (nose) return;
      const photoA = (sternBox.x1 - sternBox.x0) / Math.max(1, sternBox.y1 - sternBox.y0);
      const capA = (hullHalf[i] * 2) / Math.max(1, hullTop[i] - hullBot[i]);
      let spanU = 1;
      let spanV = 1;
      if (capA < photoA) spanV = capA / photoA;
      else spanU = photoA / capA;
      const dPos: number[] = [];
      const dUv: number[] = [];
      const dIdx: number[] = [];
      const xOut = x - 0.8;
      for (let j = 0; j <= NY; j++) {
        for (let k = 0; k <= NZ; k++) {
          const ty = j / NY;
          const tz = k / NZ;
          const y = hullBot[i] + ty * (hullTop[i] - hullBot[i]);
          const z = -hullHalf[i] + tz * hullHalf[i] * 2;
          const photoU = (tz - (0.5 - spanU / 2)) / spanU;
          const photoV = (ty - (0.5 - spanV / 2)) / spanV;
          dPos.push(xOut, y, z);
          dUv.push(photoU, photoV);
        }
      }
      for (let j = 0; j < NY; j++) {
        for (let k = 0; k < NZ; k++) quad(dIdx, at(j, k), at(j, k + 1), at(j + 1, k + 1), at(j + 1, k));
      }
      sternMat.uniforms.crop.value.set(
        sternBox.x0 / stern.w,
        1 - sternBox.y1 / stern.h,
        sternBox.x1 / stern.w,
        1 - sternBox.y0 / stern.h,
      );
      pushMesh(sternMat, dPos, dUv, dIdx, 0, -1);
    };
    cap(i0, false);
    cap(i1, true);
    if (bayOn) {
      const backMat = faceMat(bayBackMap);
      const floorMat = faceMat(bayFloorMap);
      const ceilMat = faceMat(bayCeilMap);
      const wallMat = faceMat(bayWallMap);
      const yAt = (i: number, t: number) => hullBot[i] + t * (hullTop[i] - hullBot[i]);
      const NB = 14;
      for (const sign of [1, -1] as const) {
        const band = (mat: THREE.ShaderMaterial, edge: "floor" | "ceil" | "back" | "aft" | "fore") => {
          const pos: number[] = [];
          const uv: number[] = [];
          const idx: number[] = [];
          const cols = edge === "aft" || edge === "fore" ? 8 : NB;
          for (let i = 0; i <= cols; i++) {
            const u = i / cols;
            const x = edge === "aft" ? bayX0 : edge === "fore" ? bayX1 : bayX0 + (bayX1 - bayX0) * u;
            const ii = Math.max(0, Math.min(NX - 1, Math.round((x / shipLen + 0.5) * (NX - 1))));
            const tf = Math.max(0.02, bayFloorT[ii]);
            const tc = Math.min(0.92, bayCeilT[ii]);
            const y0 = yAt(ii, tf) + 0.2;
            const y1 = yAt(ii, tc) - 0.2;
            const zOut = sign * (hullHalf[ii] - 0.35);
            const zIn = sign * Math.max(8, hullHalf[ii] - bayDepth);
            if (edge === "floor" || edge === "ceil") {
              const y = edge === "floor" ? y0 : y1;
              pos.push(x, y, zOut, x, y, zIn);
              uv.push(u, 0, u, 1);
            } else if (edge === "back") {
              pos.push(x, y0, zIn, x, y1, zIn);
              uv.push(u, 0, u, 1);
            } else {
              const z = zIn + (zOut - zIn) * u;
              pos.push(x, y0, z, x, y1, z);
              uv.push(u, 0, u, 1);
            }
          }
          for (let i = 0; i < cols; i++) {
            const a = i * 2;
            idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
          }
          const axis = edge === "floor" || edge === "ceil" ? 1 : edge === "back" ? 2 : 0;
          const facing =
            edge === "ceil" ? -1 : edge === "back" ? sign : edge === "fore" ? -1 : 1;
          pushMesh(mat, pos, uv, idx, axis, facing);
        };
        band(floorMat, "floor");
        band(ceilMat, "ceil");
        band(backMat, "back");
        band(wallMat, "aft");
        band(wallMat, "fore");
      }
    }
    const plateBox = (p: Pix) => {
      let x0 = p.w;
      let y0 = p.h;
      let x1 = 0;
      let y1 = 0;
      for (let y = 0; y < p.h; y += 2) {
        for (let x = 0; x < p.w; x += 2) {
          if (lum(p, x, y) <= 16) continue;
          if (x < x0) x0 = x;
          if (y < y0) y0 = y;
          if (x > x1) x1 = x;
          if (y > y1) y1 = y;
        }
      }
      return { x0, y0, x1, y1 };
    };
    const cSideBox = plateBox(cSide);
    const cTopBox = plateBox(cTop);
    const cBotBox = plateBox(cBot);
    const cMuzBox = plateBox(cMuz);
    const CN = 26;
    const cannonLen = 68;
    const sideTop = new Float32Array(CN);
    const sideBot = new Float32Array(CN);
    const halfW = new Float32Array(CN);
    const spanAt = (p: Pix, box: { x0: number; y0: number; x1: number; y1: number }, u: number) => {
      const x = box.x0 + u * (box.x1 - box.x0);
      let a = -1;
      let b = -1;
      for (let y = box.y0; y <= box.y1; y++) {
        if (lum(p, x, y) <= 14) continue;
        if (a < 0) a = y;
        b = y;
      }
      if (a < 0) {
        const mid = (box.y0 + box.y1) >> 1;
        return { a: mid, b: mid + 2 };
      }
      return { a, b };
    };
    for (let i = 0; i < CN; i++) {
      const u = i / (CN - 1);
      const s = spanAt(cSide, cSideBox, u);
      sideTop[i] = s.a;
      sideBot[i] = s.b;
      const tspan = spanAt(cTop, cTopBox, u);
      const zScale = cannonLen / Math.max(1, cTopBox.x1 - cTopBox.x0);
      halfW[i] = Math.max(1.8, (tspan.b - tspan.a) * 0.5 * zScale);
    }
    const yScale = cannonLen / Math.max(1, cSideBox.x1 - cSideBox.x0);
    const sideMid = (cSideBox.y0 + cSideBox.y1) * 0.5;
    const yLocal = (iy: number) => (sideMid - iy) * yScale;
    const xLocal = (i: number) => (i / (CN - 1) - 0.5) * cannonLen;
    const sideMat = faceMat(flankMap);
    const topMatC = faceMat(topMap);
    const muzMat = faceMat(flankMap);
    const arm = { x0: 500, y0: 348, x1: 1040, y1: 470 };
    let maxHalf = 1;
    for (let i = 0; i < CN; i++) if (halfW[i] > maxHalf) maxHalf = halfW[i];
    const stampUv = (geo: THREE.CircleGeometry, box: { x0: number; y0: number; x1: number; y1: number }, img: Pix) => {
      const uv = geo.getAttribute("uv");
      const u0 = box.x0 / img.w;
      const u1 = box.x1 / img.w;
      const v0 = 1 - box.y1 / img.h;
      const v1 = 1 - box.y0 / img.h;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
      }
      uv.needsUpdate = true;
    };
    const stations = [-228, -148, -68, 18, 208];
    for (const cx of stations) {
      const u = cx / shipLen + 0.5;
      const ii = Math.max(0, Math.min(NX - 1, Math.round(u * (NX - 1))));
      if (hullHalf[ii] < 8) continue;
      if (bayOn && cx + cannonLen * 0.5 > bayX0 - 4 && cx - cannonLen * 0.5 < bayX1 + 4) continue;
      const yMid = hullBot[ii] + 0.2 * (hullTop[ii] - hullBot[ii]);
      for (const sign of [1, -1] as const) {
        const zMid = sign * (hullHalf[ii] + maxHalf * 0.42);
        const addStrip = (
          mat: THREE.ShaderMaterial,
          kind: "side" | "top" | "bot",
          zSign: number,
        ) => {
          const pos: number[] = [];
          const uv: number[] = [];
          const idx: number[] = [];
          for (let i = 0; i < CN; i++) {
            const x = xLocal(i) + cx;
            const uu = i / (CN - 1);
            if (kind === "side") {
              const yA = yMid + yLocal(sideTop[i]);
              const yB = yMid + yLocal(sideBot[i]);
              const z = zMid + zSign * halfW[i];
              const ix = arm.x0 + uu * (arm.x1 - arm.x0);
              pos.push(x, yA, z, x, yB, z);
              uv.push(ix / side.w, 1 - arm.y0 / side.h, ix / side.w, 1 - arm.y1 / side.h);
            } else {
              const y = yMid + yLocal(kind === "top" ? sideTop[i] : sideBot[i]);
              pos.push(x, y, zMid - halfW[i], x, y, zMid + halfW[i]);
              uv.push(0.28 + uu * 0.44, 0.58, 0.28 + uu * 0.44, 0.42);
            }
          }
          for (let i = 0; i < CN - 1; i++) {
            const a = i * 2;
            idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
          }
          pushMesh(mat, pos, uv, idx, kind === "side" ? 2 : 1, kind === "bot" ? -1 : zSign);
        };
        addStrip(sideMat, "side", 1);
        addStrip(sideMat, "side", -1);
        addStrip(topMatC, "top", 1);
        addStrip(topMatC, "bot", -1);
        const endHalf = Math.abs(yLocal(sideTop[CN - 1]) - yLocal(sideBot[CN - 1])) * 0.5;
        const muzR = Math.max(1.4, Math.min(halfW[CN - 1], endHalf) * 0.96);
        const muzzle = new THREE.Mesh(new THREE.CircleGeometry(muzR, 20), muzMat);
        stampUv(muzzle.geometry as THREE.CircleGeometry, { x0: 700, y0: 360, x1: 860, y1: 450 }, side);
        muzzle.rotation.y = Math.PI / 2;
        muzzle.position.set(cx + cannonLen * 0.5 + 0.08, yMid, zMid);
        muzzle.frustumCulled = false;
        const brR = Math.max(1.4, Math.min(halfW[0], Math.abs(yLocal(sideTop[0]) - yLocal(sideBot[0])) * 0.5) * 0.9);
        const breech = new THREE.Mesh(new THREE.CircleGeometry(brR, 16), sideMat);
        stampUv(breech.geometry as THREE.CircleGeometry, {
          x0: arm.x0,
          x1: arm.x0 + 160,
          y0: arm.y0,
          y1: arm.y1,
        }, side);
        breech.rotation.y = -Math.PI / 2;
        breech.position.set(cx - cannonLen * 0.5 - 0.08, yMid, zMid);
        breech.frustumCulled = false;
        shipRoot.add(muzzle, breech);
        const y0 = yMid + yLocal(sideBot[CN >> 1]);
        const y1 = yMid + yLocal(sideTop[CN >> 1]);
        blocks.push({
          x0: cx - cannonLen * 0.48,
          x1: cx + cannonLen * 0.48,
          y0: Math.min(y0, y1) - 0.4,
          y1: Math.max(y0, y1) + 0.4,
          z0: zMid - maxHalf,
          z1: zMid + maxHalf,
        });
      }
    }
    hullReady = true;
  }).catch(() => {
    hullReady = false;
  });
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

  const pos = new THREE.Vector3(0, 20, -24);
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
  let landBay = false;
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
    setLook: (faceYaw: number, facePitch: number) => {
      yaw = faceYaw;
      pitch = facePitch;
    },
    isAboard: () => pos.distanceTo(SHIP) < 80,
    getShip: () => {
      const mid = (bayX0 + bayX1) * 0.5;
      const col = sampleCol(mid);
      const u = mid / shipLen + 0.5;
      const f = u * (NX - 1);
      const i = Math.max(0, Math.min(NX - 2, Math.floor(f)));
      const tt = f - i;
      const tF = bayFloorT[i] * (1 - tt) + bayFloorT[i + 1] * tt;
      const tC = bayCeilT[i] * (1 - tt) + bayCeilT[i + 1] * tt;
      const span = col ? col.top - col.bot : 0;
      return {
        x: SHIP.x,
        y: SHIP.y,
        z: SHIP.z,
        yaw: shipYaw,
        bayOn,
        bayX0,
        bayX1,
        bayDepth,
        y0: col ? col.bot + tF * span : 0,
        y1: col ? col.bot + tC * span : 0,
        half: col ? col.half : 0,
      };
    },
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
    const along = pos.z - SHIP.z;
    const cruiseSpeed = along > 210 ? 0 : along > 160 ? 2.2 : along > 100 ? 5.5 : 8.5;
    const wantSpeed = shipAge < 1.2 ? 0 : cruiseSpeed;
    shipSpeed = THREE.MathUtils.damp(shipSpeed, wantSpeed, 0.7, dt);
    SHIP.z -= shipSpeed * dt;
    shipRoot.position.copy(SHIP);

    const cY = Math.cos(shipYaw);
    const sY = Math.sin(shipYaw);
    const dx = pos.x - SHIP.x;
    const dz = pos.z - SHIP.z;
    let lx = dx * cY - dz * sY;
    let ly = pos.y - SHIP.y;
    let lz = dx * sY + dz * cY;
    const writeLocal = () => {
      pos.x = SHIP.x + lx * cY + lz * sY;
      pos.y = SHIP.y + ly;
      pos.z = SHIP.z - lx * sY + lz * cY;
    };
    if (hullReady) {
      const col = sampleCol(lx);
      let bay: { y0: number; y1: number; inner: number; half: number } | null = null;
      if (bayOn && col && lx > bayX0 && lx < bayX1) {
        const u = lx / shipLen + 0.5;
        const f = u * (NX - 1);
        const i = Math.max(0, Math.min(NX - 2, Math.floor(f)));
        const tt = f - i;
        const tF = bayFloorT[i] * (1 - tt) + bayFloorT[i + 1] * tt;
        const tC = bayCeilT[i] * (1 - tt) + bayCeilT[i + 1] * tt;
        if (tC > tF && tF > -0.05) {
          const span = col.top - col.bot;
          bay = {
            y0: col.bot + tF * span,
            y1: col.bot + tC * span,
            inner: Math.max(8, col.half - bayDepth),
            half: col.half,
          };
        }
      }
      const inBay =
        !!bay &&
        ly > bay.y0 - 1.1 &&
        ly < bay.y1 + 0.7 &&
        Math.abs(lz) > bay.inner - 1.5 &&
        Math.abs(lz) < bay.half + 2.4;
      const over = !col || ly > col.top + 1.4 || Math.abs(lz) > col.half + 2.5;
      if (landed && landBay) {
        if (rise > 0.45 || !inBay) {
          landed = false;
          landBay = false;
          if (rise > 0.45) vel.y = Math.max(vel.y, 16);
        }
      } else if (landed && (rise > 0.45 || over)) {
        landed = false;
        landBay = false;
        if (rise > 0.45) vel.y = Math.max(vel.y, 16);
      }
      if (
        !landed &&
        !inBay &&
        col &&
        Math.abs(lz) < col.half * 0.94 &&
        ly <= col.top + 2.4 &&
        ly >= col.top - 2.4 &&
        vel.y <= 1.6 &&
        rise <= 0.05
      ) {
        landed = true;
        landBay = false;
      }
      if (!landed && inBay && bay && ly <= bay.y0 + 3.1 && ly >= bay.y0 - 1.2 && vel.y <= 2.4 && rise <= 0.05) {
        landed = true;
        landBay = true;
      }
      if (!landed && inBay && bay) {
        const sgn = Math.sign(lz) || 1;
        if (Math.abs(lz) < bay.inner + 0.8) lz = sgn * (bay.inner + 1);
        if (ly > bay.y1 - 0.35) {
          ly = bay.y1 - 0.7;
          vel.y = Math.min(vel.y, 0);
        }
        if (ly < bay.y0 + 0.35) {
          ly = bay.y0 + 0.55;
          vel.y = Math.max(vel.y, 0);
        }
        lx = THREE.MathUtils.clamp(lx, bayX0 + 1.2, bayX1 - 1.2);
        writeLocal();
      } else if (!landed && col && ly < col.top + 0.4 && ly > col.bot - 0.4 && Math.abs(lz) < col.half + 1.2) {
        const penTop = col.top - ly;
        const penBot = ly - col.bot;
        const penZ = col.half - Math.abs(lz);
        if (penTop < penZ && penTop < penBot && penTop < 10) {
          ly = col.top + 1.6;
          vel.y = Math.max(vel.y, 2);
        } else if (penZ <= penTop && penZ <= penBot) {
          lz = Math.sign(lz || 1) * (col.half + 1.4);
          vel.z = -shipSpeed;
        } else {
          ly = col.bot - 1.6;
          vel.y = Math.min(vel.y, -2);
        }
        writeLocal();
      }
      if (!landed && !col && lx < hullX0 && lx > hullX0 - 8) {
        const end = sampleCol(hullX0 + 4);
        if (end && ly < end.top && ly > end.bot && Math.abs(lz) < end.half) {
          lx = hullX0 - 1.5;
          vel.x = 0;
          writeLocal();
        }
      }
      if (!landed && !col && lx > hullX1 && lx < hullX1 + 8) {
        const end = sampleCol(hullX1 - 4);
        if (end && ly < end.top && ly > end.bot && Math.abs(lz) < end.half) {
          lx = hullX1 + 1.5;
          vel.x = 0;
          writeLocal();
        }
      }
      if (!landed && !inBay) {
        for (let bi = 0; bi < blocks.length; bi++) {
          const b = blocks[bi];
          if (lx < b.x0 || lx > b.x1 || ly < b.y0 || ly > b.y1 || lz < b.z0 || lz > b.z1) continue;
          const px = Math.min(lx - b.x0, b.x1 - lx);
          const py = Math.min(ly - b.y0, b.y1 - ly);
          const pz = Math.min(lz - b.z0, b.z1 - lz);
          if (pz <= px && pz <= py) lz = lz < (b.z0 + b.z1) * 0.5 ? b.z0 - 0.8 : b.z1 + 0.8;
          else if (py <= px) ly = ly < (b.y0 + b.y1) * 0.5 ? b.y0 - 0.8 : b.y1 + 0.8;
          else lx = lx < (b.x0 + b.x1) * 0.5 ? b.x0 - 0.8 : b.x1 + 0.8;
          writeLocal();
        }
      }
      if (landed && landBay && bay) {
        lx += -steer * 18 * dt;
        lx = THREE.MathUtils.clamp(lx, bayX0 + 2, bayX1 - 2);
        const stand = sampleCol(lx);
        if (!stand) {
          landed = false;
          landBay = false;
        } else {
          const spn = stand.top - stand.bot;
          const uf = lx / shipLen + 0.5;
          const ff = uf * (NX - 1);
          const ii = Math.max(0, Math.min(NX - 2, Math.floor(ff)));
          const ttt = ff - ii;
          const tf = bayFloorT[ii] * (1 - ttt) + bayFloorT[ii + 1] * ttt;
          const y0 = stand.bot + tf * spn;
          const inner = Math.max(8, stand.half - bayDepth);
          ly = y0 + 1.7;
          const sgn = Math.sign(lz) || 1;
          lz = sgn * THREE.MathUtils.clamp(Math.abs(lz), inner + 1.5, stand.half - 1.1);
          writeLocal();
          vel.set(0, 0, -shipSpeed);
          speed = Math.abs(steer) * 8;
        }
      } else if (landed) {
        lx += -steer * 26 * dt;
        const stand = sampleCol(lx);
        if (!stand || Math.abs(lz) > stand.half + 2) {
          landed = false;
          landBay = false;
        } else {
          ly = stand.top + 1.8;
          lz = THREE.MathUtils.clamp(lz, -stand.half + 1.4, stand.half - 1.4);
          writeLocal();
          vel.set(0, 0, -shipSpeed);
          speed = Math.abs(steer) * 8;
        }
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
        place: landed ? "On the hull" : near < 480 ? "Meridian" : "open void",
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
      setLook: (faceYaw: number, facePitch: number) => void;
      isAboard: () => boolean;
      getShip: () => {
        x: number;
        y: number;
        z: number;
        yaw: number;
        bayOn: boolean;
        bayX0: number;
        bayX1: number;
        bayDepth: number;
        y0: number;
        y1: number;
        half: number;
      };
      isLanded: () => boolean;
      isGrounded: () => boolean;
      getPose: () => { x: number; y: number; z: number; yaw: number; speed: number };
    };
  }
}

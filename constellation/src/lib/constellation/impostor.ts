import { LOD1, LOD2, LOD3, lod1Id, lod2Id, lod3Id, NODES, type NodeId } from "./world";

export interface ImpostorCfg {
  source: number;
  halo: number;
  cx: number;
  cy: number;
  parallax: number;
  /** 0 star, 1 ocean, 2 rock, 3 ice, 4 dark, 5 ash */
  kind: number;
  a: [number, number, number];
  b: [number, number, number];
  c: [number, number, number];
  seed: number;
}

/** Disc in the Imagine plate + palette for the far-side wrap. */
export const IMPOSTOR: Record<NodeId, ImpostorCfg> = {
  core: {
    source: 0.28,
    halo: 0.58,
    cx: 0.504,
    cy: 0.495,
    parallax: 0.02,
    kind: 0,
    a: [0.55, 0.72, 1.0],
    b: [0.85, 0.92, 1.0],
    c: [1.0, 0.98, 0.94],
    seed: 11.2,
  },
  tide: {
    source: 0.42,
    halo: 0.49,
    cx: 0.491,
    cy: 0.493,
    parallax: 0.07,
    kind: 1,
    a: [0.05, 0.22, 0.42],
    b: [0.16, 0.48, 0.22],
    c: [0.9, 0.95, 1.0],
    seed: 4.7,
  },
  canyon: {
    source: 0.448,
    halo: 0.452,
    cx: 0.524,
    cy: 0.489,
    parallax: 0.08,
    kind: 2,
    a: [0.38, 0.14, 0.06],
    b: [0.78, 0.38, 0.16],
    c: [0.9, 0.72, 0.48],
    seed: 8.1,
  },
  crystal: {
    source: 0.422,
    halo: 0.426,
    cx: 0.5,
    cy: 0.5,
    parallax: 0.08,
    kind: 3,
    a: [0.38, 0.52, 0.66],
    b: [0.78, 0.9, 0.98],
    c: [1.0, 1.0, 1.0],
    seed: 2.4,
  },
  hollow: {
    source: 0.17,
    halo: 0.22,
    cx: 0.5,
    cy: 0.5,
    parallax: 0.1,
    kind: 4,
    a: [0.07, 0.08, 0.1],
    b: [0.18, 0.2, 0.24],
    c: [0.32, 0.36, 0.4],
    seed: 6.6,
  },
  drift: {
    source: 0.09,
    halo: 0.135,
    cx: 0.5,
    cy: 0.5,
    parallax: 0.11,
    kind: 5,
    a: [0.2, 0.18, 0.16],
    b: [0.42, 0.38, 0.34],
    c: [0.62, 0.55, 0.48],
    seed: 13.9,
  },
};

export const LOD1_IMPOSTOR: Partial<Record<NodeId, ImpostorCfg>> = {
  canyon: {
    source: 0.455,
    halo: 0.46,
    cx: 0.508,
    cy: 0.492,
    parallax: 0.04,
    kind: 2,
    a: [0.38, 0.14, 0.06],
    b: [0.78, 0.38, 0.16],
    c: [0.9, 0.72, 0.48],
    seed: 8.1,
  },
};

export interface ImpostorSprite {
  id: NodeId;
  x: number;
  y: number;
  z: number;
  size: number;
  opacity: number;
  yaw: number;
  pitch: number;
  lod: number;
  /** Texture key if not the orbital loop. */
  tex?: string;
  /** 0..1 multiplier on baked parallax (freeze during LOD fade). */
  para?: number;
  /** Full-plate landscape — no sphere disc. */
  flat?: boolean;
}

export interface ImpostorFrame {
  vw: number;
  vh: number;
  sprites: ImpostorSprite[];
  liveId: string | null;
}

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
uniform vec4 uUvRect;
void main() {
  vec2 unit = aPos * 0.5 + 0.5;
  vUv = uUvRect.xy + unit * uUvRect.zw;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uView;
uniform vec2 uCenter;
uniform vec4 uParams;
uniform float uOpacity;
uniform float uKind;
uniform float uTide;
uniform float uSeed;
uniform float uTime;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
uniform float uFlat;

float hash31(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}

float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash31(i);
  float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
  float x00 = mix(n000, n100, f.x);
  float x10 = mix(n010, n110, f.x);
  float x01 = mix(n001, n101, f.x);
  float x11 = mix(n011, n111, f.x);
  return mix(mix(x00, x10, f.y), mix(x01, x11, f.y), f.z);
}

float fbm(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p *= 2.07;
    a *= 0.5;
  }
  return s;
}

vec3 rotY(vec3 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
}

vec3 rotX(vec3 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
}

void main() {
  if (uFlat > 0.5) {
    vec3 rgb = texture2D(uTex, vUv).rgb;
    float a = uOpacity;
    gl_FragColor = vec4(rgb * a, a);
    return;
  }
  float source = uParams.x;
  float halo0 = uParams.y;
  float para = uParams.z;
  float lod = uParams.w;
  float halo = halo0;
  float isTide = max(uTide, step(0.5, uKind) * (1.0 - step(1.5, uKind)));

  vec2 d = vUv - uCenter;
  float pr = length(d);
  if (pr > halo) {
    gl_FragColor = vec4(0.0);
    return;
  }
  // Hard limb for rock/ice/ash — never a second ring of plate.
  if (uKind >= 1.5 && pr > source * 1.012) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec2 uv = vUv;
  vec4 raw = texture2D(uTex, uv);

  vec2 sph = d / max(source, 0.0001);
  float sr2 = dot(sph, sph);
  float onBody = 1.0 - smoothstep(0.9, 1.03, sr2);
  float z = sqrt(max(0.0, 1.0 - min(sr2, 1.0)));
  vec3 nCam = normalize(vec3(sph, z));

  float twist = 1.0 - lod * 0.8;
  float yaw = uView.x * twist;
  float pit = uView.y * twist;

  vec2 tilt = vec2(sin(yaw), sin(pit)) * para;
  vec2 samp = (uv - uCenter) + tilt * z * source;
  float sampR = length(samp);
  float maxR = source * 0.86;
  if (sampR > maxR) samp *= maxR / max(sampR, 0.0001);
  vec3 face = texture2D(uTex, uCenter + samp).rgb;

  vec3 nWrap = rotX(rotY(nCam, -yaw * 0.55), -pit * 0.55);
  float grain = fbm(nWrap * 6.0 + vec3(uSeed));
  float crag = fbm(nWrap * 16.0 + vec3(uSeed * 1.7));
  float spark = fbm(nWrap * 10.0 + vec3(uTime * 0.55));
  float boil = fbm(nWrap * 22.0 + vec3(uTime * 0.9, uSeed, uTime * 0.4));
  float amt = 0.12 * twist * (1.0 - lod * 0.5);
  float rawLuma = max(raw.r, max(raw.g, raw.b));

  // Bump from fbm so canyons catch the light (no derivatives — Samsung safe).
  vec3 t1 = normalize(vec3(-nCam.z, 0.0, nCam.x));
  vec3 t2 = cross(nCam, t1);
  nCam = normalize(nCam + (t1 * (grain - 0.5) + t2 * (crag - 0.5)) * 0.22 * onBody);

  vec3 rgb = raw.rgb;
  if (uKind < 0.5) {
    vec3 starFace = raw.rgb;
    float heart = 1.0 - smoothstep(0.0, source * 1.15, pr);
    // Pulse the white nucleus — lightning stays in the video, no rigid spin.
    starFace += uC * (spark - 0.4) * 0.22 * heart;
    starFace += uB * (boil - 0.45) * 0.12 * heart;
    starFace *= 0.9 + spark * 0.22 * heart;
    rgb = starFace;
  } else {
    rgb = mix(raw.rgb, face, twist * 0.22 * (1.0 - lod) * onBody);
    rgb *= mix(1.0, mix(0.96, 1.04, grain), amt * 0.4 * onBody);

    vec3 key = normalize(vec3(-0.42, 0.5, 0.76));
    vec3 fill = normalize(vec3(0.55, -0.15, 0.45));
    float ndl = clamp(dot(nCam, key), 0.0, 1.0);
    float fillL = clamp(dot(nCam, fill), 0.0, 1.0);
    float wrap = clamp(ndl * 0.28 + 0.72 + fillL * 0.08, 0.0, 1.08);
    float fres = pow(clamp(1.0 - nCam.z, 0.0, 1.0), 1.8);
    vec3 lit = rgb * mix(0.88, 1.06, wrap);
    lit += mix(uA, uC, 0.4) * fres * 0.14;
    float specPow = mix(18.0, 42.0, isTide);
    float spec = pow(max(dot(nCam, normalize(key + vec3(0.0, 0.0, 1.0))), 0.0), specPow);
    lit += uC * spec * mix(0.06, 0.18, isTide) * twist;
    rgb = mix(rgb, lit, onBody);
  }

  float luma = max(rgb.r, max(rgb.g, rgb.b));
  float window = 1.0 - smoothstep(halo * 0.88, halo, pr);
  float starA = smoothstep(0.04, 0.16, luma) * window;

  float globe = 1.0 - smoothstep(source * 0.985, source * 1.002, pr);
  // Rings only where the plate is actually lit — never a black cookie.
  float ring = smoothstep(0.34, 0.55, luma) * (1.0 - smoothstep(halo * 0.92, halo, pr));
  float planetA = mix(globe, max(globe, ring), isTide);

  float a = mix(starA, planetA, step(0.5, uKind)) * uOpacity;
  gl_FragColor = vec4(rgb * a, a);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function createImpostorLayer(
  canvas: HTMLCanvasElement,
  onReady?: () => void,
) {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: true,
    depth: false,
    stencil: false,
  });
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uTex = gl.getUniformLocation(prog, "uTex");
  const uUvRect = gl.getUniformLocation(prog, "uUvRect");
  const uView = gl.getUniformLocation(prog, "uView");
  const uCenter = gl.getUniformLocation(prog, "uCenter");
  const uParams = gl.getUniformLocation(prog, "uParams");
  const uOpacity = gl.getUniformLocation(prog, "uOpacity");
  const uKind = gl.getUniformLocation(prog, "uKind");
  const uTide = gl.getUniformLocation(prog, "uTide");
  const uSeed = gl.getUniformLocation(prog, "uSeed");
  const uTime = gl.getUniformLocation(prog, "uTime");
  const uA = gl.getUniformLocation(prog, "uA");
  const uB = gl.getUniformLocation(prog, "uB");
  const uC = gl.getUniformLocation(prog, "uC");
  const uFlat = gl.getUniformLocation(prog, "uFlat");
  gl.uniform1i(uTex, 0);

  const textures: Record<string, WebGLTexture> = {};

  const makeTex = () => {
    const t = gl.createTexture();
    if (!t) return null;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0]),
    );
    return t;
  };

  let loaded = 0;
  const posters: Array<{ key: string; src: string }> = NODES.map((n) => ({
    key: n.id,
    src: n.poster,
  }));
  for (const id of Object.keys(LOD1) as NodeId[]) {
    const extra = LOD1[id];
    if (extra) posters.push({ key: lod1Id(id), src: extra.poster });
  }
  for (const id of Object.keys(LOD2) as NodeId[]) {
    const extra = LOD2[id];
    if (extra) posters.push({ key: lod2Id(id), src: extra.poster });
  }
  for (const id of Object.keys(LOD3) as NodeId[]) {
    const extra = LOD3[id];
    if (extra) posters.push({ key: lod3Id(id), src: extra.poster });
  }
  const need = posters.length;
  for (const p of posters) {
    const t = makeTex();
    if (!t) continue;
    textures[p.key] = t;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      } catch {
        /* tainted */
      }
      loaded += 1;
      if (loaded >= need) onReady?.();
    };
    img.onerror = () => {
      loaded += 1;
      if (loaded >= need) onReady?.();
    };
    img.src = p.src;
  }

  const uploadVideo = (id: string, video: HTMLVideoElement) => {
    const t = textures[id];
    if (!t || video.readyState < 2) return;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    } catch {
      /* not ready */
    }
  };

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  const draw = (frame: ImpostorFrame, videos: Record<string, HTMLVideoElement | null>) => {
    const cssW = Math.max(1, canvas.clientWidth || frame.vw);
    const cssH = Math.max(1, canvas.clientHeight || frame.vh);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(cssW * dpr));
    const h = Math.max(1, Math.floor(cssH * dpr));
    const sx = cssW / Math.max(frame.vw, 1);
    const sy = cssH / Math.max(frame.vh, 1);
    const sxy = Math.min(sx, sy);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (videos.core) uploadVideo("core", videos.core);
    if (frame.liveId && frame.liveId !== "core" && videos[frame.liveId]) {
      uploadVideo(frame.liveId, videos[frame.liveId]!);
    }
    const lodLive = frame.liveId ? lod1Id(frame.liveId as NodeId) : null;
    if (lodLive && videos[lodLive]) uploadVideo(lodLive, videos[lodLive]!);
    const lod2Live = frame.liveId ? lod2Id(frame.liveId as NodeId) : null;
    if (lod2Live && videos[lod2Live]) uploadVideo(lod2Live, videos[lod2Live]!);
    const lod3Live = frame.liveId ? lod3Id(frame.liveId as NodeId) : null;
    if (lod3Live && videos[lod3Live]) uploadVideo(lod3Live, videos[lod3Live]!);

    const tSec = performance.now() * 0.001;
    const sprites = frame.sprites.slice().sort((a, b) => b.z - a.z);
    for (const s of sprites) {
      if (s.opacity < 0.03 || s.size < 8) continue;
      const texKey = s.tex ?? s.id;
      const tex = textures[texKey];
      if (!tex) continue;
      const cfg =
        s.tex && s.tex.endsWith("-lod1")
          ? (LOD1_IMPOSTOR[s.id] ?? IMPOSTOR[s.id])
          : IMPOSTOR[s.id];
      const px = s.x * sx * dpr;
      const py = s.y * sy * dpr;
      const sz = s.flat ? Math.max(w, h) * 1.02 : s.size * sxy * dpr;
      const x0 = px - sz / 2;
      const y0 = h - (py + sz / 2);
      if (!s.flat && (x0 + sz < 0 || y0 + sz < 0 || x0 > w || y0 > h)) continue;

      if (s.flat) {
        gl.viewport(0, 0, w, h);
        gl.uniform4f(uUvRect, 0, 0, 1, 1);
      } else {
        const clipL = Math.max(0, x0);
        const clipB = Math.max(0, y0);
        const clipR = Math.min(w, x0 + sz);
        const clipT = Math.min(h, y0 + sz);
        const vwPx = clipR - clipL;
        const vhPx = clipT - clipB;
        if (vwPx < 1 || vhPx < 1) continue;

        gl.viewport(
          Math.floor(clipL),
          Math.floor(clipB),
          Math.max(1, Math.floor(vwPx)),
          Math.max(1, Math.floor(vhPx)),
        );
        gl.uniform4f(
          uUvRect,
          (clipL - x0) / sz,
          (clipB - y0) / sz,
          vwPx / sz,
          vhPx / sz,
        );
      }
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform2f(uView, s.yaw, s.pitch);
      gl.uniform2f(uCenter, cfg.cx, cfg.cy);
      const para = cfg.parallax * (s.para ?? 1);
      gl.uniform4f(uParams, cfg.source, cfg.halo, para, s.lod);
      gl.uniform1f(uOpacity, s.opacity);
      gl.uniform1f(uKind, cfg.kind);
      gl.uniform1f(uTide, s.id === "tide" ? 1.0 : 0.0);
      gl.uniform1f(uSeed, cfg.seed);
      gl.uniform1f(uTime, tSec);
      gl.uniform3f(uA, cfg.a[0], cfg.a[1], cfg.a[2]);
      gl.uniform3f(uB, cfg.b[0], cfg.b[1], cfg.b[2]);
      gl.uniform3f(uC, cfg.c[0], cfg.c[1], cfg.c[2]);
      gl.uniform1f(uFlat, s.flat ? 1.0 : 0.0);
      if (cfg.kind < 0.5) gl.blendFunc(gl.ONE, gl.ONE);
      else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.viewport(0, 0, w, h);
  };

  const destroy = () => {
    for (const t of Object.values(textures)) gl.deleteTexture(t);
    gl.deleteBuffer(buf);
    gl.deleteProgram(prog);
  };

  return { draw, destroy, ok: true as const };
}

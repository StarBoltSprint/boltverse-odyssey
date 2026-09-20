/**
 * Bolt GPU compositor — PRIORITY 0 (law 15).
 * One/two-pass WebGL: road + contact shadow + chroma + despill + cold grade + grain.
 * ZERO getImageData on the hot path.
 *
 * Port into Live as src/game/bolt-key-gl.ts (or equivalent).
 * Wire: makeCompositor(canvas) BEFORE any getContext("2d").
 */

export type Compositor = {
  kind: "webgl" | "none";
  draw: (args: DrawArgs) => void;
  resize: (w: number, h: number) => void;
  destroy: () => void;
};

export type DrawArgs = {
  /** Plate / road video or canvas already decoded this frame (or null to skip road upload). */
  roadSource: CanvasImageSource | null;
  /** Bolt green-screen video frame (upload every rAF when playing). */
  boltSource: CanvasImageSource;
  /** Skip bolt tex upload if cycle frame unchanged (e.g. pause). */
  boltDirty: boolean;
  /** Skip road tex upload if plate frame unchanged. */
  roadDirty: boolean;
  /** Normalized plant UV of paws (0–1), for contact shadow. */
  plantUV: { x: number; y: number };
  /** 0–1 shadow strength (weaker in air). */
  shadowK: number;
  /** Dest rect of Bolt in CSS pixels (pass-2 scissor / quad). */
  boltRect: { x: number; y: number; w: number; h: number };
  /** Stage sizes (upload targets). */
  boltStage?: { w: number; h: number };
  roadStage?: { w: number; h: number };
};

const DEFAULT_BOLT_STAGE = { w: 384, h: 584 };
const DEFAULT_ROAD_STAGE = { w: 360, h: 640 };

const VS = `
attribute vec2 a_pos;
attribute vec2 a_uv;
varying vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

/** Pass 1: road + contact shadow + grain (fullscreen). */
const FS_ROAD = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_road;
uniform vec2 u_plant;
uniform float u_shadowK;
uniform float u_time;

float ign(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

void main() {
  vec4 road = texture2D(u_road, v_uv);
  vec2 d = (v_uv - u_plant) * vec2(1.0, 1.6);
  float ell = exp(-dot(d, d) * 40.0);
  float sh = mix(1.0, 0.55, ell * u_shadowK);
  road.rgb *= sh;
  float g = ign(gl_FragCoord.xy + u_time) * 0.04;
  road.rgb += g - 0.02;
  gl_FragColor = road;
}
`;

/** Pass 2: chroma + despill + cold grade on Bolt quad only. */
const FS_BOLT = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_bolt;

void main() {
  vec4 c = texture2D(u_bolt, v_uv);
  float greenness = c.g - max(c.r, c.b);
  // soft key thresholds ~0.14 / 0.018 (branchless)
  float a = smoothstep(0.14, 0.018, greenness);
  // despill: pull G toward max(R,B)
  float spill = max(0.0, c.g - max(c.r, c.b));
  c.g -= spill * a;
  // cold grade (frost): desat + ice tint + darker belly approx via luminance
  float luma = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  vec3 cold = mix(c.rgb, vec3(luma), 0.18);
  cold = mix(cold, cold * vec3(0.92, 0.97, 1.05), 0.35);
  cold *= mix(0.88, 1.0, smoothstep(0.0, 0.55, v_uv.y)); // belly darker (lower uv if rear)
  // rim hint
  float edge = smoothstep(0.02, 0.12, min(min(v_uv.x, 1.0 - v_uv.x), min(v_uv.y, 1.0 - v_uv.y)));
  cold += (1.0 - edge) * 0.04 * vec3(0.7, 0.85, 1.0);
  gl_FragColor = vec4(cold, a * c.a);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(log || "shader compile fail");
  }
  return s;
}

function link(gl: WebGLRenderingContext, vsSrc: string, fsSrc: string): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p) || "link fail");
  }
  return p;
}

function fullScreenQuad(gl: WebGLRenderingContext): WebGLBuffer {
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  // x,y,u,v — full NDC
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1, 0, 1, 1, -1, 1, 1, -1, 1, 0, 0, -1, 1, 0, 0, 1, -1, 1, 1, 1, 1, 1, 0,
    ]),
    gl.STATIC_DRAW
  );
  return buf;
}

/**
 * Create compositor on canvas. Call BEFORE getContext("2d") on the same canvas.
 * Returns kind:"none" if WebGL unavailable — caller must CPU-fallback once.
 */
export function makeCompositor(canvas: HTMLCanvasElement): Compositor {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
  });
  if (!gl) {
    return {
      kind: "none",
      draw() {},
      resize() {},
      destroy() {},
    };
  }

  const progRoad = link(gl, VS, FS_ROAD);
  const progBolt = link(gl, VS, FS_BOLT);
  const quad = fullScreenQuad(gl);

  const texRoad = gl.createTexture()!;
  const texBolt = gl.createTexture()!;
  for (const t of [texRoad, texBolt]) {
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  let roadAlloc = false;
  let boltAlloc = false;
  let roadStage = { ...DEFAULT_ROAD_STAGE };
  let boltStage = { ...DEFAULT_BOLT_STAGE };
  let t0 = performance.now();

  function bindAttrib(prog: WebGLProgram) {
    const aPos = gl.getAttribLocation(prog, "a_pos");
    const aUv = gl.getAttribLocation(prog, "a_uv");
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(aUv);
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);
  }

  function upload(
    tex: WebGLTexture,
    src: CanvasImageSource,
    stage: { w: number; h: number },
    allocated: boolean
  ): boolean {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // Draw source into offscreen? For simplicity upload directly (browser scales).
    if (!allocated) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src as TexImageSource);
      return true;
    }
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, src as TexImageSource);
    return true;
  }

  function draw(args: DrawArgs) {
    const w = canvas.width;
    const h = canvas.height;
    gl.viewport(0, 0, w, h);
    if (args.roadStage) roadStage = args.roadStage;
    if (args.boltStage) boltStage = args.boltStage;

    if (args.roadSource && args.roadDirty) {
      roadAlloc = upload(texRoad, args.roadSource, roadStage, roadAlloc) || roadAlloc;
      if (!roadAlloc) roadAlloc = true;
    }
    if (args.boltDirty) {
      boltAlloc = upload(texBolt, args.boltSource, boltStage, boltAlloc) || boltAlloc;
      if (!boltAlloc) boltAlloc = true;
    }

    // Pass 1 — road fullscreen
    gl.disable(gl.BLEND);
    gl.useProgram(progRoad);
    bindAttrib(progRoad);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texRoad);
    gl.uniform1i(gl.getUniformLocation(progRoad, "u_road"), 0);
    gl.uniform2f(gl.getUniformLocation(progRoad, "u_plant"), args.plantUV.x, args.plantUV.y);
    gl.uniform1f(gl.getUniformLocation(progRoad, "u_shadowK"), args.shadowK);
    gl.uniform1f(gl.getUniformLocation(progRoad, "u_time"), (performance.now() - t0) * 0.001);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Pass 2 — Bolt quad only (approx via scissor on boltRect)
    const r = args.boltRect;
    const sx = Math.max(0, Math.floor(r.x));
    const sy = Math.max(0, Math.floor(h - r.y - r.h));
    const sw = Math.min(w - sx, Math.ceil(r.w));
    const sh = Math.min(h - sy, Math.ceil(r.h));
    if (sw > 0 && sh > 0) {
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(sx, sy, sw, sh);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(progBolt);
      bindAttrib(progBolt);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texBolt);
      gl.uniform1i(gl.getUniformLocation(progBolt, "u_bolt"), 0);
      // Remap quad UVs would be better; scissor + fullscreen sample is a coarse port —
      // Live should replace with a true screen-space Bolt quad. For reference KEEP path:
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.disable(gl.SCISSOR_TEST);
    }
  }

  return {
    kind: "webgl",
    draw,
    resize(cw, ch) {
      canvas.width = cw;
      canvas.height = ch;
    },
    destroy() {
      gl.deleteTexture(texRoad);
      gl.deleteTexture(texBolt);
      gl.deleteBuffer(quad);
      gl.deleteProgram(progRoad);
      gl.deleteProgram(progBolt);
    },
  };
}

/** Hard bans for new Grok — document in comments / assert at boot. */
export const GPU_BANS = [
  "getImageData on hot path",
  "putImageData chroma every rAF",
  "harvest 534 canvases",
  "*24 / 1-of-N on dog frames",
  "invent new gallop — REUSE lock/bolt-gallop-cycle.mp4 (6s / 534 / 96fps)",
] as const;

export const CANON_CYCLE = {
  path: "lock/bolt-gallop-cycle.mp4",
  fps: 96,
  frames: 534,
  stridesPerCycle: 22,
  durationSec: 5.5625,
  playRate: 1,
  loop: true,
} as const;

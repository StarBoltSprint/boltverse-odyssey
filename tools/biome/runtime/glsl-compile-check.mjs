// Compiles the runtime GLSL chunks in a real WebGL2 context (headless Chromium, SwiftShader).
//   node tools/biome/runtime/glsl-compile-check.mjs        (needs playwright; set PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs)
import { FOG_GLSL, GRADE_FRAG, FULLSCREEN_VERT, SKY_EQUIRECT_GLSL } from "./biome-runtime.js";
const mod = process.env.PLAYWRIGHT_MODULE || "playwright";
let chromium;
try { ({ chromium } = await import(mod)); } catch (e) { console.log(`[glsl] SKIP: playwright not found (${mod})`); process.exit(0); }
const fogFrag = `#version 300 es
precision highp float;
${FOG_GLSL}
uniform vec3 uEye; in vec3 vW; out vec4 o;
void main(){ o = vec4(biomeFog(vec3(0.5), distance(uEye, vW), vW.y), 1.0); }`;
const fogVert = `#version 300 es
in vec3 p; out vec3 vW; void main(){ vW = p; gl_Position = vec4(p, 1.0); }`;
const skyFrag = `#version 300 es
precision highp float;
uniform sampler2D map; in vec3 vW; out vec4 o;
${SKY_EQUIRECT_GLSL}
void main(){ o = vec4(biomeSky(map, vW), 1.0); }`;
const b = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage();
const res = await p.evaluate(([progs]) => {
  const gl = document.createElement("canvas").getContext("webgl2");
  if (!gl) return { error: "no webgl2" };
  const out = {};
  for (const [name, vs, fs] of progs) {
    const pr = gl.createProgram();
    let log = "";
    for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) log += gl.getShaderInfoLog(sh);
      gl.attachShader(pr, sh);
    }
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) log += gl.getProgramInfoLog(pr);
    out[name] = log || "ok";
  }
  return out;
}, [[["fog", fogVert, fogFrag], ["grade", FULLSCREEN_VERT, GRADE_FRAG], ["sky", fogVert, skyFrag]]]);
await b.close();
console.log("[glsl]", JSON.stringify(res));
process.exit(Object.values(res).every((v) => v === "ok") ? 0 : 1);

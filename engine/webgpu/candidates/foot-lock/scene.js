// Isolated candidate. Does not import the meadow scene, the river, or the tunnel.
// Bolt's card size and the follow camera match the live meadow. Fog is absent.
import { makeFootContact, scriptInput, SCRIPT_SECONDS } from "../../engine/footcontact.js";
import { MEADOW_FEET, CANYON_FEET } from "./biomes.js";

const qs = new URLSearchParams(location.search);
const hud = document.getElementById("hud");
const BIOMES = { meadow: MEADOW_FEET, canyon: CANYON_FEET };
const biome = BIOMES[qs.get("biome")] || MEADOW_FEET;
const PLAY = qs.get("play") === "1";
const W = parseInt(qs.get("w"), 10) || 720;
const H = parseInt(qs.get("h"), 10) || 1280;

const GROUND = /* wgsl */`
struct U { vp: mat4x4f, eye: vec4f, misc: vec4f };
@group(0) @binding(0) var<uniform> u: U;
struct V { @builtin(position) p: vec4f, @location(0) w: vec3f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> V {
  var q = array<vec2f, 6>(vec2f(-1, -1), vec2f(1, -1), vec2f(1, 1), vec2f(-1, -1), vec2f(1, 1), vec2f(-1, 1));
  let xz = q[i] * 80.0;
  let w = vec3f(u.eye.x + xz.x, 0.0, u.eye.z + xz.y);
  var o: V; o.p = u.vp * vec4f(w, 1.0); o.w = w; return o;
}
@fragment fn fs(v: V) -> @location(0) vec4f {
  let g = floor(v.w.xz * 2.0);
  let chk = fract((g.x + g.y) * 0.5) < 0.5;
  var c = select(vec3f(0.34, 0.46, 0.24), vec3f(0.28, 0.40, 0.20), chk);
  let f = abs(fract(v.w.xz) - 0.5);
  let line = step(0.475, max(f.x, f.y));
  c = mix(c, vec3f(0.16, 0.22, 0.12), line * 0.65);
  return vec4f(c, 1.0);
}`;

const BOLT = /* wgsl */`
struct U { vp: mat4x4f, eye: vec4f, misc: vec4f };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var atlas: texture_2d<f32>;
struct V { @builtin(position) p: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@location(0) pos: vec3f, @location(1) uv: vec2f) -> V {
  var o: V; o.p = u.vp * vec4f(pos, 1.0); o.uv = uv; return o;
}
fn cell(f: u32, uv: vec2f) -> vec4f {
  let g = vec2f(f32(f % 8u), f32(f / 8u));
  return textureSampleLevel(atlas, samp, (g + clamp(uv, vec2f(0.002), vec2f(0.998))) / vec2f(8.0, 4.0), 0.0);
}
@fragment fn fs(v: V) -> @location(0) vec4f {
  let f = u32(u.misc.x); let k = u.misc.y;
  let s = mix(cell(f, v.uv), cell((f + 1u) % 32u, v.uv), k);
  if (s.a < 0.15) { discard; }
  return vec4f(s.rgb, s.a);
}`;

function lookAt(e, c, up) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };
  const f = norm(sub(c, e)), s = norm(cross(f, up)), u = cross(s, f);
  return new Float32Array([s[0], u[0], -f[0], 0, s[1], u[1], -f[1], 0, s[2], u[2], -f[2], 0, -dot(s, e), -dot(u, e), dot(f, e), 1]);
}
function persp(fovy, asp, n, f) {
  const t = 1 / Math.tan(fovy / 2);
  return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, f / (n - f), -1, 0, 0, n * f / (n - f), 0]);
}
function mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}

const held = new Set();
addEventListener("keydown", e => held.add(e.key.toLowerCase()));
addEventListener("keyup", e => held.delete(e.key.toLowerCase()));
function liveInput() {
  let turn = 0;
  if (["a", "arrowleft", "q"].some(k => held.has(k))) turn += 1;
  if (["d", "arrowright"].some(k => held.has(k))) turn -= 1;
  const run = ["w", "arrowup", " "].some(k => held.has(k)) ? 1 : 0;
  return { run, turn, seg: "live" };
}

async function main() {
  const doc = await fetch("./contacts.json").then(r => r.json());
  const fc = makeFootContact({ ...biome, contacts: doc.framesContacts, idleFrame: doc.idleFrame, lock: qs.get("lock") !== "0" });
  if (fc.cfg.fog !== 0) throw new Error("fog");
  const state = fc.create({ v: PLAY ? 0 : biome.speed, phase: PLAY ? (doc.idleFrame / 32) : 0 });
  const ad = await navigator.gpu?.requestAdapter();
  if (!ad) { hud.textContent = "No WebGPU"; return; }
  const dev = await ad.requestDevice();
  const canvas = document.getElementById("c");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("webgpu");
  const fmt = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device: dev, format: fmt, alphaMode: "opaque" });

  const ub = dev.createBuffer({ size: 256, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const atlasBmp = await createImageBitmap(await (await fetch("../../assets/meadow/bolt439_atlas.png")).blob());
  const atlas = dev.createTexture({ size: [atlasBmp.width, atlasBmp.height], format: "rgba8unorm-srgb", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
  dev.queue.copyExternalImageToTexture({ source: atlasBmp }, { texture: atlas }, [atlasBmp.width, atlasBmp.height]);
  const samp = dev.createSampler({ magFilter: "linear", minFilter: "linear" });

  const bglG = dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: {} }] });
  const bglB = dev.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: {} },
    { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} },
  ] });
  const bgG = dev.createBindGroup({ layout: bglG, entries: [{ binding: 0, resource: { buffer: ub } }] });
  const bgB = dev.createBindGroup({ layout: bglB, entries: [
    { binding: 0, resource: { buffer: ub } },
    { binding: 1, resource: samp },
    { binding: 2, resource: atlas.createView() },
  ] });
  const pG = dev.createRenderPipeline({
    layout: dev.createPipelineLayout({ bindGroupLayouts: [bglG] }),
    vertex: { module: dev.createShaderModule({ code: GROUND }), entryPoint: "vs" },
    fragment: { module: dev.createShaderModule({ code: GROUND }), entryPoint: "fs", targets: [{ format: fmt }] },
    primitive: { topology: "triangle-list", cullMode: "none" },
    depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" },
  });
  const pB = dev.createRenderPipeline({
    layout: dev.createPipelineLayout({ bindGroupLayouts: [bglB] }),
    vertex: {
      module: dev.createShaderModule({ code: BOLT }), entryPoint: "vs",
      buffers: [{ arrayStride: 20, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }, { shaderLocation: 1, offset: 12, format: "float32x2" }] }],
    },
    fragment: { module: dev.createShaderModule({ code: BOLT }), entryPoint: "fs", targets: [{ format: fmt }] },
    primitive: { topology: "triangle-list", cullMode: "none" },
    depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less", depthBias: -2, depthBiasSlopeScale: -1 },
  });
  const depth = dev.createTexture({ size: [W, H], format: "depth24plus", usage: GPUTextureUsage.RENDER_ATTACHMENT });
  const vN = fc.cfg.nu * fc.cfg.nv;
  const vbo = dev.createBuffer({ size: vN * 20, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  const ibo = dev.createBuffer({ size: fc.indices.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
  dev.queue.writeBuffer(ibo, 0, fc.indices);
  const interleaved = new Float32Array(vN * 5);

  let t = 0, last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const input = PLAY ? liveInput() : scriptInput(t % SCRIPT_SECONDS);
    fc.step(state, dt, input);
    const pose = fc.pose(state);
    for (let i = 0; i < vN; i++) {
      interleaved[i * 5] = pose.pos[i * 3];
      interleaved[i * 5 + 1] = pose.pos[i * 3 + 1];
      interleaved[i * 5 + 2] = pose.pos[i * 3 + 2];
      interleaved[i * 5 + 3] = pose.uvs[i * 2];
      interleaved[i * 5 + 4] = pose.uvs[i * 2 + 1];
    }
    dev.queue.writeBuffer(vbo, 0, interleaved);
    const vp = mul(persp(62 * Math.PI / 180, W / H, 0.05, 200), lookAt(pose.eye, pose.target, [0, 1, 0]));
    const U = new Float32Array(32);
    U.set(vp, 0);
    U.set([pose.eye[0], pose.eye[1], pose.eye[2], t], 16);
    U[20] = pose.frame; U[21] = pose.blend; U[22] = pose.v; U[23] = pose.scale;
    dev.queue.writeBuffer(ub, 0, U);
    const enc = dev.createCommandEncoder();
    const pass = enc.beginRenderPass({
      colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: [0.50, 0.68, 0.88, 1] }],
      depthStencilAttachment: { view: depth.createView(), depthLoadOp: "clear", depthClearValue: 1, depthStoreOp: "discard" },
    });
    pass.setPipeline(pG); pass.setBindGroup(0, bgG); pass.draw(6);
    pass.setPipeline(pB); pass.setBindGroup(0, bgB); pass.setVertexBuffer(0, vbo); pass.setIndexBuffer(ibo, "uint32"); pass.drawIndexed(fc.indices.length);
    pass.end();
    dev.queue.submit([enc.finish()]);
    if (!PLAY) t += dt;
    const seg = PLAY ? "play" : scriptInput(t % SCRIPT_SECONDS).seg;
    hud.textContent = `${fc.cfg.id} · ${seg} · ${pose.v.toFixed(1)} m/s · f${pose.frame}`;
    requestAnimationFrame(frame);
  }
  hud.textContent = fc.cfg.id;
  requestAnimationFrame(frame);
}
main().catch(e => { hud.textContent = "ERR " + e; console.error(e); });

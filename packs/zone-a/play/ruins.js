/**
 * Unlit Imagine ruins. The mesh is a measured loft. Pixels stay on the skins.
 * Drawn into the scene target so the existing fog applies.
 */

const VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aUv;
uniform mat4 uVP;
uniform vec3 uPos;
uniform float uYaw;
uniform float uFrame;
out vec2 vUv;
void main() {
  float s = sin(uYaw);
  float c = cos(uYaw);
  float wx;
  float wz;
  if (uFrame < 0.5) {
    wx = aPos.x * c + aPos.z * s;
    wz = -aPos.x * s + aPos.z * c;
  } else {
    wx = aPos.x * s - aPos.z * c;
    wz = aPos.x * c + aPos.z * s;
  }
  vUv = aUv;
  gl_Position = uVP * vec4(uPos.x + wx, uPos.y + aPos.y, uPos.z + wz, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
uniform sampler2D uTex;
in vec2 vUv;
out vec4 o;
void main() {
  vec4 c = texture(uTex, vUv);
  o = vec4(c.rgb, 1.0);
}`;

function program(gl, vs, fs) {
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

function empty() {
  return {
    draws: 0,
    loadMs: 0,
    draw() {},
    mag() { return 0; },
    ease(x, z) { return { x, z }; },
    info() { return { count: 0, loadMs: 0, draws: 0 }; },
  };
}

function parseRuin(buf) {
  const view = new DataView(buf);
  if (view.byteLength < 8) throw new Error("ruin short");
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== "RUIN") throw new Error("ruin magic");
  let o = 4;
  const n = view.getUint32(o, true);
  o += 4;
  const groups = [];
  for (let i = 0; i < n; i++) {
    const skin = view.getUint32(o, true);
    o += 4;
    const vc = view.getUint32(o, true);
    o += 4;
    const ic = view.getUint32(o, true);
    o += 4;
    const xyzuv = new Float32Array(buf, o, vc * 5);
    o += vc * 5 * 4;
    const idx = new Uint32Array(buf, o, ic);
    o += ic * 4;
    groups.push({ skin, xyzuv, idx });
  }
  return groups;
}

function seatOf(obj, heightAt) {
  const yaw = obj.yaw;
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  const lx = obj.contact[0] || 0;
  const lz = obj.contact[1] || 0;
  let wx;
  let wz;
  if (obj.frame === "ship") {
    wx = obj.x + lx * s - lz * c;
    wz = obj.z + lx * c + lz * s;
  } else {
    wx = obj.x + lx * c + lz * s;
    wz = obj.z - lx * s + lz * c;
  }
  return { x: obj.x, y: heightAt(wx, wz) - (obj.sink || 0), z: obj.z, contactX: wx, contactZ: wz };
}

export async function mountRuins(gl, env) {
  const t0 = performance.now();
  let manifest;
  try {
    const res = await fetch(env.absUrl("packs/zone-a/src/ruins/manifest.json"));
    if (!res.ok) return empty();
    manifest = await res.json();
  } catch (e) {
    return empty();
  }
  const objects = manifest.objects || [];
  if (!objects.length) return empty();
  const prog = program(gl, VS, FS);
  const loc = {
    vp: gl.getUniformLocation(prog, "uVP"),
    pos: gl.getUniformLocation(prog, "uPos"),
    yaw: gl.getUniformLocation(prog, "uYaw"),
    frame: gl.getUniformLocation(prog, "uFrame"),
    tex: gl.getUniformLocation(prog, "uTex"),
  };
  const batches = [];
  const keeps = [];
  const mags = [];
  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    const bin = await (await fetch(env.absUrl(obj.mesh))).arrayBuffer();
    const groups = parseRuin(bin);
    const textures = [];
    for (let s = 0; s < obj.skins.length; s++) {
      const img = await env.loadImage(env.absUrl(obj.skins[s]));
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.generateMipmap(gl.TEXTURE_2D);
      env.trackTex("ruin:" + obj.id + ":" + s, Math.ceil(img.width * img.height * 4 * 4 / 3));
      textures.push(tex);
    }
    const seat = seatOf(obj, env.heightAt);
    const draws = [];
    for (let g = 0; g < groups.length; g++) {
      const group = groups[g];
      if (!group.idx.length || !textures[group.skin]) continue;
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const vb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, group.xyzuv, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
      const ib = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, group.idx, gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      draws.push({ vao, tex: textures[group.skin], count: group.idx.length });
    }
    batches.push({
      draws,
      pos: [seat.x, seat.y, seat.z],
      yaw: obj.yaw,
      frame: obj.frame === "ship" ? 1 : 0,
    });
    keeps.push({ x: obj.x, z: obj.z, r: obj.keepRadiusM });
    mags.push({
      id: obj.id,
      x: obj.x,
      z: obj.z,
      horiz: obj.horizRadiusM,
      texels: obj.texelsPerM,
      approach: obj.minApproachM,
      seatY: seat.y,
      contactX: seat.contactX,
      contactZ: seat.contactZ,
    });
  }
  const loadMs = performance.now() - t0;
  let drawCount = 0;
  for (let i = 0; i < batches.length; i++) drawCount += batches[i].draws.length;
  return {
    draws: drawCount,
    loadMs,
    draw(vp, mode) {
      if (mode === 1) return;
      gl.useProgram(prog);
      gl.uniformMatrix4fv(loc.vp, false, vp);
      gl.uniform1i(loc.tex, 0);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      gl.activeTexture(gl.TEXTURE0);
      for (let b = 0; b < batches.length; b++) {
        const batch = batches[b];
        gl.uniform3f(loc.pos, batch.pos[0], batch.pos[1], batch.pos[2]);
        gl.uniform1f(loc.yaw, batch.yaw);
        gl.uniform1f(loc.frame, batch.frame);
        for (let d = 0; d < batch.draws.length; d++) {
          const draw = batch.draws[d];
          gl.bindVertexArray(draw.vao);
          gl.bindTexture(gl.TEXTURE_2D, draw.tex);
          gl.drawElements(gl.TRIANGLES, draw.count, gl.UNSIGNED_INT, 0);
        }
      }
      gl.bindVertexArray(null);
    },
    mag(eye, focal) {
      let m = 0;
      let which = "";
      for (let i = 0; i < mags.length; i++) {
        const o = mags[i];
        const dist = Math.max(0.35, Math.hypot(eye[0] - o.x, eye[2] - o.z) - o.horiz);
        const mm = focal / (o.texels * dist);
        if (mm > m) {
          m = mm;
          which = o.id;
        }
      }
      return { m, which };
    },
    ease(x, z) {
      let ox = x;
      let oz = z;
      for (let i = 0; i < keeps.length; i++) {
        const k = keeps[i];
        const dx = ox - k.x;
        const dz = oz - k.z;
        const d = Math.hypot(dx, dz);
        if (!(d < k.r) || d < 1e-4) continue;
        const step = Math.min(k.r - d, 0.35);
        ox += (dx / d) * step;
        oz += (dz / d) * step;
      }
      return { x: ox, z: oz };
    },
    info() {
      return {
        count: objects.length,
        draws: drawCount,
        loadMs,
        seats: mags.map((o) => ({
          id: o.id,
          y: o.seatY,
          contact: [o.contactX, o.contactZ],
          approach: o.approach,
        })),
      };
    },
  };
}

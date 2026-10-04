/**
 * Unlit Imagine ruins. The mesh is a measured loft. Pixels stay on the skins.
 * Drawn into the scene target so the existing fog applies.
 * Colliders come from the same faces (collide.js): a wall where a face crosses Bolt's body band,
 * openings stay walkable, no keep-out circle.
 */
import { buildCollider, buildMagProbe, frameOf } from "./collide.js";

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
    mag() { return { m: 0, which: "" }; },
    collide(ox, oz, x, z) { return { x, z, contact: false }; },
    lift() { return 0; },
    near() { return false; },
    clearance() { return 99; },
    clearGrad() { return null; },
    segFree() { return 1; },
    where() { return null; },
    probe() { return {}; },
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
  // contactY is the local height of the contact point: 0 for a base contact, the sill for a hangar seat.
  return { x: obj.x, y: heightAt(wx, wz) - (obj.contactY || 0) - (obj.sink || 0), z: obj.z, contactX: wx, contactZ: wz };
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
  const mags = [];
  const solids = [];
  const colliderOpt = manifest.collider || {};
  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    const bin = await (await fetch(env.absUrl(obj.mesh))).arrayBuffer();
    const groups = parseRuin(bin);
    const textures = [];
    const texSize = [];
    for (let s = 0; s < obj.skins.length; s++) {
      const img = await env.loadImage(env.absUrl(obj.skins[s]));
      texSize.push([img.width, img.height]);
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
    const frame = frameOf(obj, seat);
    const tc = performance.now();
    const col = buildCollider(groups, frame, env.heightAt, colliderOpt);
    const openTop = obj.openingTopM || 0;
    solids.push({
      id: obj.id,
      col,
      groups,
      frame,
      texSize,
      probe: null,
      tagOf: obj.frame === "ship"
        ? () => "hull"
        : (gi, ti, cy, ny) => (ny < -0.5 ? "arch-underside" : cy < openTop ? "pier" : "lintel"),
      texelsPerM: obj.texelsPerM,
      buildMs: performance.now() - tc,
    });
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
    /** Closest drawn face from the eye, at the skin's nominal texel density. */
    mag(eye, focal) {
      let m = 0;
      let which = "";
      for (let i = 0; i < solids.length; i++) {
        const o = solids[i];
        if (!o.col.near(eye[0], eye[2], 30)) continue;
        const dist = Math.max(0.05, o.col.dist(eye[0], eye[1], eye[2]));
        const mm = focal / (o.texelsPerM * dist);
        if (mm > m) {
          m = mm;
          which = o.id;
        }
      }
      return { m, which };
    },
    /**
     * Move the body from (ox, oz) toward (x, z). A wall pushes it out along the field gradient,
     * so it slides along the face instead of stopping or snapping. Substeps stop tunnelling.
     */
    collide(ox, oz, x, z, radius) {
      const r = radius || colliderOpt.bodyRadiusM || 0.3;
      let any = false;
      for (let i = 0; i < solids.length; i++) {
        if (solids[i].col.near(x, z, r + 0.5) || solids[i].col.near(ox, oz, r + 0.5)) any = true;
      }
      if (!any) return { x, z, contact: false };
      let cx = ox;
      let cz = oz;
      let contact = false;
      const dx = x - ox;
      const dz = z - oz;
      const len = Math.hypot(dx, dz);
      const steps = Math.max(1, Math.ceil(len / solids[0].col.cellM));
      for (let s = 0; s < steps; s++) {
        cx += dx / steps;
        cz += dz / steps;
        for (let iter = 0; iter < 4; iter++) {
          let moved = false;
          for (let i = 0; i < solids.length; i++) {
            const col = solids[i].col;
            if (!col.near(cx, cz, r)) continue;
            const d = col.sd(cx, cz);
            if (d >= r) continue;
            const g = col.grad(cx, cz);
            if (g[0] === 0 && g[1] === 0) continue;
            cx += g[0] * (r - d);
            cz += g[1] * (r - d);
            moved = true;
            contact = true;
          }
          if (!moved) break;
        }
      }
      return { x: cx, z: cz, contact };
    },
    /** Floor lift above the relief where a face sits within one step of it (a sill, a hull foot). */
    lift(x, z) {
      let m = 0;
      for (let i = 0; i < solids.length; i++) {
        const col = solids[i].col;
        if (!col.near(x, z, 0)) continue;
        const v = col.lift(x, z);
        if (v > m) m = v;
      }
      return m;
    },
    near(x, z, extra) {
      for (let i = 0; i < solids.length; i++) if (solids[i].col.near(x, z, extra || 0)) return true;
      return false;
    },
    /** Distance from a world point to the nearest drawn ruin face. */
    clearance(x, y, z) {
      let m = 99;
      for (let i = 0; i < solids.length; i++) {
        const col = solids[i].col;
        if (!col.near(x, z, 2)) continue;
        const v = col.dist(x, y, z);
        if (v < m) m = v;
      }
      return m;
    },
    /** Unit gradient of clearance() (direction away from the nearest face), or null when flat. */
    clearGrad(x, y, z) {
      const h = 0.08;
      const gx = this.clearance(x + h, y, z) - this.clearance(x - h, y, z);
      const gy = this.clearance(x, y + h, z) - this.clearance(x, y - h, z);
      const gz = this.clearance(x, y, z + h) - this.clearance(x, y, z - h);
      const l = Math.hypot(gx, gy, gz);
      return l > 1e-6 ? [gx / l, gy / l, gz / l] : null;
    },
    /** Fraction of the segment A->B that stays at least eps from every face (sphere march). 1 = clear. */
    segFree(ax, ay, az, bx, by, bz, eps) {
      const e = eps == null ? 0.08 : eps;
      const dx = bx - ax;
      const dy = by - ay;
      const dz = bz - az;
      const len = Math.hypot(dx, dy, dz);
      if (len < 1e-6) return 1;
      let close = false;
      for (let i = 0; i < solids.length; i++) {
        if (solids[i].col.near(ax, az, len + 2)) close = true;
      }
      if (!close) return 1;
      const minStep = solids[0].col.voxM * 0.5;
      let t = 0;
      while (t < len) {
        const f = t / len;
        const d = this.clearance(ax + dx * f, ay + dy * f, az + dz * f);
        if (d < e) return f;
        t += Math.max(d - e * 0.5, minStep);
      }
      return 1;
    },
    /** Which ruin a point is in or under (tests, HUD). */
    where(x, z) {
      for (let i = 0; i < solids.length; i++) {
        const col = solids[i].col;
        if (!col.near(x, z, 0)) continue;
        return {
          id: solids[i].id,
          covered: col.covered(x, z),
          wall: col.wall(x, z),
          sd: col.sd(x, z),
          lx: col.toLocalX(x, z),
          lz: col.toLocalZ(x, z),
        };
      }
      return null;
    },
    /** Close-up magnification per part, from the face UVs, inside the frustum. Built on first call. */
    probe(eye, fwd, right, up, focal, tanH, tanV) {
      const out = {};
      for (let i = 0; i < solids.length; i++) {
        const o = solids[i];
        if (!o.probe) o.probe = buildMagProbe(o.groups, o.frame, o.texSize, o.tagOf);
        const r = o.probe(eye, fwd, right, up, focal, tanH, tanV);
        for (const k of Object.keys(r)) out[o.id + ":" + k] = r[k];
      }
      return out;
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
        colliders: solids.map((o) => ({
          id: o.id,
          cells: [o.col.nx, o.col.nz],
          voxels: [o.col.vnx, o.col.vny, o.col.vnz],
          wallCells: o.col.wallCells,
          sealedCells: o.col.sealed,
          buildMs: Math.round(o.buildMs),
          bodyBand: [o.col.stepM, o.col.clearM],
        })),
      };
    },
  };
}

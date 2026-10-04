/**
 * Instanced micro-details. One atlas, one draw. Cards do not block.
 * Seated on the drawn relief. World-locked crossed cards.
 */
const VS = `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aBody;
layout(location=2) in vec4 aGeom;
layout(location=3) in vec4 aUv;
uniform mat4 uVP;
out vec2 vUv;
void main() {
  float yaw = aBody.w;
  float c = cos(yaw);
  float s = sin(yaw);
  vec3 p = vec3(aBody.x, aBody.y, aBody.z);
  p += vec3(c, 0.0, -s) * (aCorner.x - 0.5) * aGeom.x;
  p.y += aCorner.y * aGeom.y;
  vUv = mix(aUv.xy, aUv.zw, aCorner);
  gl_Position = uVP * vec4(p, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
uniform sampler2D uTex;
in vec2 vUv;
out vec4 o;
void main() {
  vec4 c = texture(uTex, vUv);
  if (c.a < 0.45) discard;
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
    info() { return { placed: 0, drawn: 0, byType: {}, loadMs: 0, draws: 0 }; },
  };
}

// Lowest drawn ground under the bottom edge of every crossed plane, so no
// part of a card floats and micro relief between mesh vertices cannot bury it.
function seatMin(groundAt, x, z, yaw, planes, halfW) {
  let min = Infinity;
  for (let k = 0; k < planes; k++) {
    const a = yaw + k * Math.PI / planes;
    const ux = Math.cos(a);
    const uz = -Math.sin(a);
    for (let i = -2; i <= 2; i++) {
      const t = (i / 2) * halfW;
      const h = groundAt(x + ux * t, z + uz * t);
      if (h < min) min = h;
    }
  }
  return min;
}

// The manifests store v with the image's top row at v = 1, so every atlas is
// uploaded flipped. The unpack flags are shared GL state that other layers
// change between awaits: set them for this upload and put them back.
function texUpload(gl, img) {
  const flip = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
  const pre = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flip);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, pre);
}

export async function mountDetails(gl, env) {
  const t0 = performance.now();
  let manifest;
  try {
    const res = await fetch(env.absUrl("packs/zone-a/src/details/manifest.json"));
    if (!res.ok) return empty();
    manifest = await res.json();
  } catch (e) {
    return empty();
  }
  const variants = manifest.variants || [];
  const instances = manifest.instances || [];
  if (!variants.length || !instances.length || !manifest.atlas) return empty();
  const img = await env.loadImage(env.absUrl(manifest.atlas));
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  texUpload(gl, img);
  gl.generateMipmap(gl.TEXTURE_2D);
  const tw = img.width;
  const th = img.height;
  env.trackTex("details", Math.ceil(tw * th * 4 * 4 / 3));

  const byType = {};
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    if (!byType[v.type]) byType[v.type] = [];
    byType[v.type].push(v);
  }
  let quads = 0;
  for (let i = 0; i < instances.length; i++) quads += instances[i].planes || 2;
  const data = new Float32Array(quads * 12);
  const magN = quads > 0 ? instances.length : 0;
  const mx = new Float32Array(magN * 3);
  const mh = new Float32Array(magN);
  const mpx = new Float32Array(magN);
  const counts = {};
  const groundAt = env.drawnHeightAt || env.heightAt;
  let w = 0;
  let placed = 0;
  for (let i = 0; i < instances.length; i++) {
    const inst = instances[i];
    const group = byType[inst.type];
    const variant = group && group[inst.variant];
    if (!variant || !variant.contentH) continue;
    const worldH = inst.heightM * (inst.scale || 1);
    const rectH = variant.rectH || variant.contentH;
    const rectW = variant.rectW || variant.contentW;
    const quadH = worldH * (rectH / variant.contentH);
    const quadW = quadH * (rectW / rectH);
    const sink = worldH * ((variant.padBottom || 0) / variant.contentH) + 0.006;
    const yaw0 = (inst.yaw || 0) * Math.PI / 180;
    const planes = inst.planes || 2;
    const halfW = 0.5 * worldH * ((variant.contentW || rectW) / variant.contentH);
    const base = seatMin(groundAt, inst.x, inst.z, yaw0, planes, halfW);
    const y = base - sink;
    mx[placed * 3] = inst.x;
    mx[placed * 3 + 1] = y + worldH * 0.5;
    mx[placed * 3 + 2] = inst.z;
    mh[placed] = worldH;
    mpx[placed] = variant.contentH;
    counts[inst.type] = (counts[inst.type] || 0) + 1;
    placed++;
    for (let k = 0; k < planes; k++) {
      const o = w * 12;
      data[o] = inst.x;
      data[o + 1] = y;
      data[o + 2] = inst.z;
      data[o + 3] = yaw0 + k * Math.PI / planes;
      data[o + 4] = quadW;
      data[o + 5] = quadH;
      data[o + 8] = variant.u0;
      data[o + 9] = variant.v0;
      data[o + 10] = variant.u1;
      data[o + 11] = variant.v1;
      w++;
    }
  }
  const prog = program(gl, VS, FS);
  const loc = {
    vp: gl.getUniformLocation(prog, "uVP"),
    tex: gl.getUniformLocation(prog, "uTex"),
  };
  const corners = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);

  function upload(img, label) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    texUpload(gl, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    env.trackTex(label, Math.ceil(img.width * img.height * 4 * 4 / 3));
    return t;
  }

  function bindInstances(buf, n) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ib);
    gl.bufferData(gl.ARRAY_BUFFER, buf.subarray(0, n * 12), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 48, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 48, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 48, 32);
    gl.vertexAttribDivisor(3, 1);
    gl.bindVertexArray(null);
    return vao;
  }

  const vao = bindInstances(data, w);
  const drawn = w;
  let fDrawn = 0;
  let fPlaced = 0;
  let fVao = null;
  let fTex = null;
  let fCounts = {};
  let fMx = new Float32Array(0);
  let fMh = new Float32Array(0);
  let fPx = new Float32Array(0);
  let fGeo = new Float32Array(0);
  let fW = 0;
  let fH = 0;
  try {
    const fres = await fetch(env.absUrl("packs/zone-a/src/details/features.json"));
    if (fres.ok) {
      const fman = await fres.json();
      const fimg = await env.loadImage(env.absUrl(fman.atlas));
      fTex = upload(fimg, "features");
      fW = fimg.width;
      fH = fimg.height;
      const fBy = {};
      const fvars = fman.variants || [];
      const fists = fman.instances || [];
      for (let i = 0; i < fvars.length; i++) {
        const v = fvars[i];
        if (!fBy[v.type]) fBy[v.type] = [];
        fBy[v.type].push(v);
      }
      const fd = new Float32Array(fists.length * 12);
      fMx = new Float32Array(fists.length * 3);
      fMh = new Float32Array(fists.length);
      fPx = new Float32Array(fists.length);
      fGeo = new Float32Array(fists.length * 4);
      let fw = 0;
      for (let i = 0; i < fists.length; i++) {
        const inst = fists[i];
        const group = fBy[inst.type];
        const variant = group && group[inst.variant];
        if (!variant || !variant.contentH) continue;
        const worldH = inst.heightM * (inst.scale || 1);
        const rectH = variant.rectH || variant.contentH;
        const rectW = variant.rectW || variant.contentW;
        const quadH = worldH * (rectH / variant.contentH);
        const quadW = quadH * (rectW / rectH);
        // The painted dust collar goes under the drawn ground so the body rises out of it.
        const skirt = (variant.skirtPx || 0) * (fman.skirtBuryFrac == null ? 0.85 : fman.skirtBuryFrac);
        const sink = worldH * (((variant.padBottom || 0) + skirt) / variant.contentH) + (inst.buryM || 0);
        const yaw0 = (inst.yaw || 0) * Math.PI / 180;
        const planes = inst.planes || 1;
        const halfW = 0.5 * worldH * ((variant.contentW || rectW) / variant.contentH);
        const base = seatMin(groundAt, inst.x, inst.z, yaw0, planes, halfW);
        const y = base - sink;
        const pi = fPlaced;
        fMx[pi * 3] = inst.x;
        fMx[pi * 3 + 1] = y + worldH * 0.5;
        fMx[pi * 3 + 2] = inst.z;
        fMh[pi] = worldH;
        fPx[pi] = variant.contentH;
        fGeo[pi * 4] = y;
        fGeo[pi * 4 + 1] = Math.cos(yaw0);
        fGeo[pi * 4 + 2] = -Math.sin(yaw0);
        fGeo[pi * 4 + 3] = halfW;
        fCounts[inst.type] = (fCounts[inst.type] || 0) + 1;
        fPlaced++;
        for (let k = 0; k < planes; k++) {
          const o = fw * 12;
          fd[o] = inst.x;
          fd[o + 1] = y;
          fd[o + 2] = inst.z;
          fd[o + 3] = yaw0 + k * Math.PI / planes;
          fd[o + 4] = quadW;
          fd[o + 5] = quadH;
          fd[o + 8] = inst.mirror ? variant.u1 : variant.u0;
          fd[o + 9] = variant.v0;
          fd[o + 10] = inst.mirror ? variant.u0 : variant.u1;
          fd[o + 11] = variant.v1;
          fw++;
        }
      }
      fDrawn = fw;
      if (fDrawn) fVao = bindInstances(fd, fDrawn);
    }
  } catch (err) {
    fDrawn = 0;
    fPlaced = 0;
  }
  const loadMs = performance.now() - t0;
  const draws = (drawn ? 1 : 0) + (fDrawn ? 1 : 0);

  // A card off screen paints no pixel, so it cannot be stretched. With a view
  // matrix, only cards whose bounding sphere meets the frustum count.
  // Portrait 720x1600: clip margin per metre is 2*focal/W across, 2*focal/H up.
  function onScreen(vp, focal, x, y, z, r) {
    if (!vp) return true;
    const cx = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
    const cy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
    const cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
    if (cw < 0.05 - r) return false;
    const px = r * (2 * focal / 720);
    const py = r * (2 * focal / 1600);
    return Math.abs(cx) <= cw + px && Math.abs(cy) <= cw + py;
  }

  function worst(eye, focal, n, xs, hs, ps, vp) {
    let m = 0;
    for (let i = 0; i < n; i++) {
      if (!onScreen(vp, focal, xs[i * 3], xs[i * 3 + 1], xs[i * 3 + 2], hs[i])) continue;
      const dx = eye[0] - xs[i * 3];
      const dy = eye[1] - xs[i * 3 + 1];
      const dz = eye[2] - xs[i * 3 + 2];
      const dist = Math.max(0.35, Math.hypot(dx, dy, dz));
      const mm = (focal * hs[i]) / (dist * (ps[i] || 1));
      if (mm > m) m = mm;
    }
    return m;
  }

  // Features are wide single cards: use the nearest point of the card, not its centre.
  function worstCards(eye, focal, n, xs, hs, ps, geo, vp) {
    let m = 0;
    for (let i = 0; i < n; i++) {
      const x = xs[i * 3];
      const z = xs[i * 3 + 2];
      const y0 = geo[i * 4];
      const ux = geo[i * 4 + 1];
      const uz = geo[i * 4 + 2];
      const hw = geo[i * 4 + 3];
      const h = hs[i];
      if (!onScreen(vp, focal, x, y0 + h * 0.5, z, Math.hypot(hw, h * 0.5))) continue;
      const ex = eye[0] - x;
      const ez = eye[2] - z;
      const t = Math.max(-hw, Math.min(hw, ex * ux + ez * uz));
      const qy = Math.max(y0, Math.min(y0 + h, eye[1]));
      const dist = Math.max(0.35, Math.hypot(ex - ux * t, eye[1] - qy, ez - uz * t));
      const mm = (focal * h) / (dist * (ps[i] || 1));
      if (mm > m) m = mm;
    }
    return m;
  }

  function paint(vp, batchVao, batchTex, n) {
    if (!n || !batchVao) return;
    gl.useProgram(prog);
    gl.bindVertexArray(batchVao);
    gl.uniformMatrix4fv(loc.vp, false, vp);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, batchTex);
    gl.uniform1i(loc.tex, 0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n);
    gl.bindVertexArray(null);
  }

  return {
    draws,
    loadMs,
    draw(vp) {
      paint(vp, vao, tex, drawn);
      paint(vp, fVao, fTex, fDrawn);
    },
    mag(eye, focal, vp) {
      return Math.max(worst(eye, focal, placed, mx, mh, mpx, vp), worstCards(eye, focal, fPlaced, fMx, fMh, fPx, fGeo, vp));
    },
    magFeatures(eye, focal, vp) {
      return worstCards(eye, focal, fPlaced, fMx, fMh, fPx, fGeo, vp);
    },
    info() {
      return {
        placed,
        drawn,
        byType: counts,
        loadMs,
        draws,
        texMiB: (tw * th * 4 * 4 / 3) / (1024 * 1024),
        atlas: [tw, th],
        features: {
          placed: fPlaced,
          drawn: fDrawn,
          byType: fCounts,
          atlas: [fW, fH],
          texMiB: fW && fH ? (fW * fH * 4 * 4 / 3) / (1024 * 1024) : 0,
        },
      };
    },
  };
}

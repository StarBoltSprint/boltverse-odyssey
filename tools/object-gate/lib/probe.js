// object-gate in-page probe. Evaluated in the game page after the adapter has published window.__ogHost:
//   { THREE, scene, camera, renderer, groundHeight(x,z), setPose({x,z,yaw,pitch}), path: [[x,z],...] }
// Everything here is measurement. It hides/overrides objects only inside one synchronous call and restores them
// before returning, so the live game frame is untouched.
(() => {
  const H = () => {
    if (!window.__ogHost) throw new Error("adapter did not publish window.__ogHost");
    return window.__ogHost;
  };
  const urlOf = (img) => (img && window.__ogTags && window.__ogTags.get(img)) || null;

  function matchRoots(sel) {
    const { scene } = H();
    const re = new RegExp(sel.names);
    const ex = sel.exclude ? new RegExp(sel.exclude) : null;
    const roots = [];
    scene.traverse((o) => {
      if (!o.name || !re.test(o.name) || (ex && ex.test(o.name))) return;
      let p = o.parent, nested = false;
      while (p) { if (p.name && re.test(p.name) && !(ex && ex.test(p.name))) { nested = true; break; } p = p.parent; }
      if (!nested) roots.push(o);
    });
    return roots;
  }
  function meshesOf(roots) {
    const out = [];
    for (const r of roots) r.traverse((o) => { if (o.isMesh || o.isPoints || o.isLine) out.push(o); });
    return out;
  }
  /** A mesh the page has unloaded (empty BufferGeometry) has no surface. Scoring it crashes on `.count`. */
  function hasSurface(geo) {
    if (!geo || !geo.getAttribute) return false;
    const pos = geo.getAttribute("position");
    return !!(pos && pos.count >= 3);
  }
  /** One record per placed copy: InstancedMesh index, LOD (level 0 geometry), or plain mesh. */
  function instancesOf(sel) {
    const { THREE } = H();
    const out = [];
    for (const r of matchRoots(sel)) {
      r.updateWorldMatrix(true, true);
      if (r.isInstancedMesh) {
        if (!hasSurface(r.geometry)) continue;
        const m = new THREE.Matrix4();
        for (let i = 0; i < r.count; i++) {
          r.getMatrixAt(i, m);
          out.push({ id: r.name + "#" + i, mesh: r, geo: r.geometry, matrix: new THREE.Matrix4().multiplyMatrices(r.matrixWorld, m) });
        }
      } else if (r.isLOD) {
        const lvl = r.levels[0] && r.levels[0].object;
        let mesh = null; if (lvl) lvl.traverse((o) => { if (!mesh && o.isMesh) mesh = o; });
        if (mesh && hasSurface(mesh.geometry)) { mesh.updateWorldMatrix(true, false); out.push({ id: r.name, mesh, geo: mesh.geometry, matrix: mesh.matrixWorld.clone(), lod: r }); }
      } else {
        const ms = []; r.traverse((o) => { if (o.isMesh && hasSurface(o.geometry)) ms.push(o); });
        for (const mesh of ms) out.push({ id: r.name + (ms.length > 1 ? "/" + (mesh.name || mesh.id) : ""), mesh, geo: mesh.geometry, matrix: mesh.matrixWorld.clone() });
      }
    }
    return out;
  }

  function texturesOfMaterial(mat) {
    const { renderer } = H();
    const found = [];
    const add = (slot, t) => { if (t && t.isTexture) found.push({ slot, t }); };
    for (const k of Object.keys(mat)) add(k, mat[k]);
    if (mat.uniforms) for (const k of Object.keys(mat.uniforms)) add(k, mat.uniforms[k] && mat.uniforms[k].value);
    try {
      const pr = renderer.properties.get(mat);
      if (pr && pr.uniforms) for (const k of Object.keys(pr.uniforms)) add(k, pr.uniforms[k] && pr.uniforms[k].value);
    } catch (e) {}
    const seen = new Set();
    return found.filter(({ t }) => (seen.has(t) ? false : (seen.add(t), true)));
  }
  function texInfo(slot, t) {
    const img = t.image || {};
    const url = urlOf(img) || (img.currentSrc || img.src) || null;
    // A loader may ImageBitmap.close() after upload. The CPU image then reports 0, while userData
    // still holds the size that was uploaded (sec6 atlases do this).
    const udW = t.userData && t.userData.w, udH = t.userData && t.userData.h;
    const w0 = img.width || (t.source && t.source.data && t.source.data.width) || 0;
    const h0 = img.height || (t.source && t.source.data && t.source.data.height) || 0;
    return {
      slot, url, uuid: t.uuid,
      w: w0 || udW || 0,
      h: h0 || udH || 0,
      depth: img.depth || 1,
      fileW: t.userData && t.userData.w, fileH: t.userData && t.userData.h,
      kind: t.isRenderTargetTexture ? "rendertarget" : t.isDepthTexture ? "depth" : t.isDataArrayTexture ? "array" : t.isDataTexture ? "data" : t.isCubeTexture ? "cube" : t.isVideoTexture ? "video" : "image",
      minFilter: t.minFilter, magFilter: t.magFilter, mipmaps: !!t.generateMipmaps || (t.mipmaps && t.mipmaps.length > 1),
      anisotropy: t.anisotropy, repeat: [t.repeat.x, t.repeat.y], wrap: [t.wrapS, t.wrapT],
    };
  }
  function texturesOf(sel) {
    const { renderer } = H();
    const meshes = meshesOf(matchRoots(sel));
    const byUuid = new Map();
    for (const m of meshes) for (const mat of [].concat(m.material || [])) {
      for (const { slot, t } of texturesOfMaterial(mat)) {
        const i = byUuid.get(t.uuid) || Object.assign(texInfo(slot, t), { meshes: [], slots: [] });
        if (!i.meshes.includes(m.name)) i.meshes.push(m.name);
        if (!i.slots.includes(slot)) i.slots.push(slot);
        byUuid.set(t.uuid, i);
      }
    }
    return { anisoMax: renderer.capabilities.getMaxAnisotropy(), meshes: meshes.map((m) => m.name), textures: [...byUuid.values()] };
  }

  const LIN_MIP = 1008; // THREE.LinearMipmapLinearFilter
  function classOf(n) {
    const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
    if (ay >= ax && ay >= az) return n[1] > 0 ? "+y" : "-y";
    if (az >= ax) return n[2] > 0 ? "+z" : "-z";
    return n[0] > 0 ? "+x" : "-x";
  }
  function distToPath(x, z, path) {
    let best = Infinity;
    for (let i = 0; i + 1 < path.length; i++) {
      const [ax, az] = path[i], [bx, bz] = path[i + 1];
      const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L));
      best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz));
    }
    if (path.length === 1) best = Math.hypot(x - path[0][0], z - path[0][1]);
    return best;
  }

  /** World area of every surface (optionally only some normal classes) of every copy matched by sel. */
  function surfaceArea(sel, classes) {
    const { THREE } = H(); let total = 0;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (const inst of instancesOf(sel)) {
      const pos = inst.geo.getAttribute("position"); if (!pos) continue; const idx = inst.geo.getIndex();
      const n = idx ? idx.count / 3 : pos.count / 3;
      for (let t = 0; t < n; t++) {
        const i0 = idx ? idx.getX(3 * t) : 3 * t, i1 = idx ? idx.getX(3 * t + 1) : 3 * t + 1, i2 = idx ? idx.getX(3 * t + 2) : 3 * t + 2;
        a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
        const ln = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
        if (ln.lengthSq() < 1e-14) continue;
        if (classes) { const k = classOf(ln.clone().normalize().toArray()); if (!classes.includes(k)) continue; }
        a.applyMatrix4(inst.matrix); b.applyMatrix4(inst.matrix); c.applyMatrix4(inst.matrix);
        total += new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).length() / 2;
      }
    }
    return total;
  }
  /**
   * Native Imagine px/m per surface class (signed local normal axis) per instance and per plate texture.
   * sampling px/m = sqrt(uvArea * texPixels / worldArea). If the class's UV area exceeds 1 (the plate repeats), the
   * pixels are not unique: unique px/m = sqrt(texPixels / worldArea). The gate scores UNIQUE px/m.
   * Stretch: per-triangle ratio of the two singular values of the world->texel map, area-weighted p95.
   */
  function texel(sel, plates) {
    const { THREE } = H();
    const path = H().path || [];
    const insts = instancesOf(sel);
    const poolArea = {};
    for (const p of plates) if (p.pool) poolArea[p.match] = surfaceArea(p.pool.sharedSelect || sel, p.classes);
    const texs = texturesOf(sel).textures;
    const rows = [];
    const geoCache = new Map();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (const inst of insts) {
      const geo = inst.geo, pos = geo.getAttribute("position"), uv = geo.getAttribute("uv");
      if (!pos) continue;
      const idx = geo.getIndex();
      const nTri = idx ? idx.count / 3 : pos.count / 3;
      const mats = [].concat(inst.mesh.material || []);
      const matTex = new Set(mats.flatMap((m) => texturesOfMaterial(m).map(({ t }) => t.uuid)));
      for (const p of plates) {
        const tex = texs.find((t) => matTex.has(t.uuid) && new RegExp(p.match).test((t.url || "") + " " + t.slots.join(" ")));
        if (!tex) continue;
        const pix = tex.w * tex.h;
        if (p.projected) {
          // plate projected in the shader: its pixels span metresAcross (model units) x the copy's scale
          const e = inst.matrix.elements; const sc = Math.cbrt(Math.abs(new THREE.Matrix4().copy(inst.matrix).determinant())) || 1;
          if (!geo.boundingBox) geo.computeBoundingBox();
          const cc = new THREE.Vector3(); geo.boundingBox.getCenter(cc).applyMatrix4(inst.matrix);
          const pm = tex.w / (p.projected.metresAcross * sc);
          rows.push({ inst: inst.id, plate: p.match, tex: tex.url, texW: tex.w, texH: tex.h, cls: "projected", areaM2: +(p.projected.metresAcross * sc * tex.h / tex.w * p.projected.metresAcross * sc).toFixed(1),
            samplingPxPerM: +pm.toFixed(2), repeats: 1, uniquePxPerM: +pm.toFixed(2), stretchP95: 1, nearPathM: +distToPath(cc.x, cc.z, path).toFixed(1) });
          continue;
        }
        if (p.pool) {
          // array of section plates, one layer per cellM x cellM cell, picked by a lookup: sampling = W / cellM; the pool's
          // unique pixels (depth layers) are shared by every surface of every object using it.
          const depth = tex.depth || 1, cellM = p.pool.cellM;
          const shared = poolArea[p.match] || 1;
          const sampling = tex.w / cellM;
          const unique = Math.min(sampling, Math.sqrt((depth * tex.w * tex.h) / shared));
          if (!geo.boundingBox) geo.computeBoundingBox();
          const cc = new THREE.Vector3(); geo.boundingBox.getCenter(cc).applyMatrix4(inst.matrix);
          rows.push({ inst: inst.id, plate: p.match, tex: tex.url || tex.slots.join("/"), texW: tex.w, texH: tex.h, layers: depth, cls: "pool", areaM2: +shared.toFixed(0),
            samplingPxPerM: +sampling.toFixed(2), repeats: +((shared / (cellM * cellM)) / depth).toFixed(2), uniquePxPerM: +unique.toFixed(2), stretchP95: 1,
            nearPathM: +distToPath(cc.x, cc.z, path).toFixed(1), note: `${depth} layers of ${tex.w}x${tex.h} for ${(shared / (cellM * cellM)).toFixed(0)} cells of ${cellM} m` });
          continue;
        }
        const cls = {};
        for (let t = 0; t < nTri; t++) {
          const i0 = idx ? idx.getX(3 * t) : 3 * t, i1 = idx ? idx.getX(3 * t + 1) : 3 * t + 1, i2 = idx ? idx.getX(3 * t + 2) : 3 * t + 2;
          a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
          const ln = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
          if (ln.lengthSq() < 1e-14) continue;
          ln.normalize();
          const k = classOf([ln.x, ln.y, ln.z]);
          if (p.classes && !p.classes.includes(k)) continue;
          a.applyMatrix4(inst.matrix); b.applyMatrix4(inst.matrix); c.applyMatrix4(inst.matrix);
          const e1 = new THREE.Vector3().subVectors(b, a), e2 = new THREE.Vector3().subVectors(c, a);
          const wArea = e1.clone().cross(e2).length() / 2;
          if (wArea < 1e-6) continue;
          let uArea = 0, sv = 1;
          if (uv) {
            const rx = tex.repeat[0], ry = tex.repeat[1];
            const u0 = uv.getX(i0) * rx, v0 = uv.getY(i0) * ry, u1 = uv.getX(i1) * rx, v1 = uv.getY(i1) * ry, u2 = uv.getX(i2) * rx, v2 = uv.getY(i2) * ry;
            uArea = Math.abs((u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0)) / 2;
            // 2D frame in the triangle plane
            const L1 = e1.length(); const ex = e1.clone().divideScalar(L1);
            const ey = new THREE.Vector3().crossVectors(ln.clone().transformDirection(inst.matrix), ex).normalize();
            const x2 = e2.dot(ex), y2 = e2.dot(ey);
            // J maps world (x,y) -> texel (u*W, v*H): solve from the two edges
            const du1 = (u1 - u0) * tex.w, dv1 = (v1 - v0) * tex.h, du2 = (u2 - u0) * tex.w, dv2 = (v2 - v0) * tex.h;
            const det = L1 * y2;
            if (Math.abs(det) > 1e-9) {
              const j00 = (du1 * y2 - du2 * 0) / det, j01 = (du2 * L1 - du1 * x2) / det;
              const j10 = (dv1 * y2) / det, j11 = (dv2 * L1 - dv1 * x2) / det;
              const T = j00 * j00 + j01 * j01 + j10 * j10 + j11 * j11, D = Math.abs(j00 * j11 - j01 * j10);
              const s1 = Math.sqrt((T + Math.sqrt(Math.max(0, T * T - 4 * D * D))) / 2), s2 = D / (s1 || 1);
              sv = s2 > 1e-9 ? s1 / s2 : 99;
            }
          }
          const cx = (a.x + b.x + c.x) / 3, cz = (a.z + b.z + c.z) / 3;
          const q = cls[k] || (cls[k] = { wArea: 0, uArea: 0, stretch: [], near: Infinity, uMin: Infinity, uMax: -Infinity });
          q.wArea += wArea; q.uArea += uArea; q.stretch.push([sv, wArea]);
          q.near = Math.min(q.near, distToPath(cx, cz, path));
        }
        for (const [k, q] of Object.entries(cls)) {
          if (q.wArea < 4) continue; // ignore slivers under 4 m²
          const sampling = Math.sqrt((q.uArea * pix) / q.wArea);
          const repeats = q.uArea;
          const unique = repeats > 1.05 ? Math.sqrt(pix / q.wArea) : sampling;
          q.stretch.sort((x, y) => x[0] - y[0]);
          let acc = 0, p95 = 1; const tot = q.stretch.reduce((s, x) => s + x[1], 0);
          for (const [s, w] of q.stretch) { acc += w; if (acc >= 0.95 * tot) { p95 = s; break; } }
          rows.push({ inst: inst.id, plate: p.match, tex: tex.url, texW: tex.w, texH: tex.h, cls: k, areaM2: +q.wArea.toFixed(1),
            samplingPxPerM: +sampling.toFixed(2), repeats: +repeats.toFixed(2), uniquePxPerM: +unique.toFixed(2),
            stretchP95: +p95.toFixed(3), nearPathM: +q.near.toFixed(1) });
        }
      }
    }
    return rows;
  }

  function placeCam(cam, p, t, fov, w, h) {
    cam.fov = fov; cam.aspect = w / h; cam.near = 0.3; cam.far = 6000; cam.updateProjectionMatrix();
    cam.position.set(p[0], p[1], p[2]); cam.lookAt(t[0], t[1], t[2]); cam.updateMatrixWorld(true);
  }
  function withOnly(sel, fn) {
    const { scene } = H();
    const keep = new Set(meshesOf(matchRoots(sel)));
    const hidden = [];
    scene.traverse((o) => { if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && o.visible && !keep.has(o)) { o.visible = false; hidden.push(o); } });
    try { return fn(); } finally { for (const o of hidden) o.visible = true; }
  }
  function readRT(w, h, draw) {
    const { THREE, renderer } = H();
    const rt = new THREE.WebGLRenderTarget(w, h);
    // Default RT stores linear bytes. The gate reads them as sRGB, so a lit
    // facade of linear ~0.03 became Lab L* 0.1. Encode on write.
    if (THREE.SRGBColorSpace) rt.texture.colorSpace = THREE.SRGBColorSpace;
    const prevT = renderer.getRenderTarget(), prevC = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha();
    const auto = renderer.info.autoReset;
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 1); renderer.clear();
    draw();
    const px = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
    renderer.setRenderTarget(prevT); renderer.setClearColor(prevC, prevA); renderer.info.autoReset = auto;
    rt.dispose();
    return px;
  }
  /** White silhouette of the selected object(s) only. Returns a "0/1" string, row 0 = bottom. */
  function mask(sel, p, t, w = 135, h = 240, fov = 58) {
    const { THREE, scene, renderer } = H();
    const cam = new THREE.PerspectiveCamera(); placeCam(cam, p, t, fov, w, h);
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, side: THREE.DoubleSide });
    const px = withOnly(sel, () => {
      const bg = scene.background, fg = scene.fog, ov = scene.overrideMaterial;
      scene.background = null; scene.fog = null; scene.overrideMaterial = white;
      try { return readRT(w, h, () => renderer.render(scene, cam)); }
      finally { scene.background = bg; scene.fog = fg; scene.overrideMaterial = ov; }
    });
    white.dispose();
    let s = ""; for (let i = 0; i < w * h; i++) s += px[i * 4] > 127 ? "1" : "0";
    return s;
  }
  /** Silhouette of one placed copy. Sibling copies of the same module stay out of the mask,
   *  so walking past another tower is not scored as a silhouette jump of this copy. */
  function maskInstance(sel, instId, p, t, w = 135, h = 240, fov = 58) {
    const { THREE } = H();
    const saved = [];
    for (const i of instancesOf(sel)) {
      if (i.id === instId || !i.mesh.isInstancedMesh) continue;
      const idx = +String(i.id).slice(String(i.id).lastIndexOf("#") + 1);
      if (!Number.isFinite(idx)) continue;
      const m = new THREE.Matrix4();
      i.mesh.getMatrixAt(idx, m);
      saved.push([i.mesh, idx, m]);
      i.mesh.setMatrixAt(idx, new THREE.Matrix4().makeTranslation(0, -1e6, 0));
      i.mesh.instanceMatrix.needsUpdate = true;
    }
    try { return mask(sel, p, t, w, h, fov); }
    finally {
      for (const [mesh, idx, m] of saved) { mesh.setMatrixAt(idx, m); mesh.instanceMatrix.needsUpdate = true; }
    }
  }
  /** Mask from the LIVE game camera (after a game frame), for cropping a screenshot to the object. */
  function maskFromGameCamera(sel, w, h) {
    const { camera } = H();
    const d = new (H().THREE.Vector3)(); camera.getWorldDirection(d);
    const p = camera.position;
    return mask(sel, [p.x, p.y, p.z], [p.x + d.x, p.y + d.y, p.z + d.z], w, h, camera.fov);
  }

  function toPng(px, w, h) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    g.putImageData(img, 0, 0); return c.toDataURL("image/png");
  }
  /**
   * Fronto-parallel orthographic view of one copy's face (axis "z" = local front, "x" = local side), lit as in the game,
   * object only, no fog. A plate that tiles repeats EXACTLY in this view, so the autocorrelation sees it.
   * Frames the lower part of the face (base + 4 m, height <= 2 x width). Returns { png, mask } (mask PNG, white = object).
   */
  function orthoFace(sel, instId, axis = "z", w = 512, h = 1024) {
    const { THREE, scene, renderer } = H();
    const inst = instancesOf(sel).find((i) => i.id === instId) || instancesOf(sel)[0];
    if (!inst.geo.boundingBox) inst.geo.computeBoundingBox();
    const bb = inst.geo.boundingBox; const e = inst.matrix.elements;
    const sc = [Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10])];
    const X = new THREE.Vector3(e[0], e[1], e[2]).normalize(), Y = new THREE.Vector3(e[4], e[5], e[6]).normalize(), Z = new THREE.Vector3(e[8], e[9], e[10]).normalize();
    const fwd = axis === "z" ? Z : X, right = axis === "z" ? X : Z.clone().negate();
    const halfW = ((axis === "z" ? bb.max.x - bb.min.x : bb.max.z - bb.min.z) * (axis === "z" ? sc[0] : sc[2])) / 2;
    const halfD = ((axis === "z" ? bb.max.z - bb.min.z : bb.max.x - bb.min.x) * (axis === "z" ? sc[2] : sc[0])) / 2;
    const Hh = (bb.max.y - bb.min.y) * sc[1];
    const viewW = halfW * 2 * 0.92, viewH = Math.min(Hh * 0.7, viewW * (h / w));
    const c = new THREE.Vector3(); bb.getCenter(c).applyMatrix4(inst.matrix);
    const base = c.clone().addScaledVector(Y, -Hh / 2);
    const mid = base.clone().addScaledVector(Y, 4 + viewH / 2);
    const cam = new THREE.OrthographicCamera(-viewW / 2, viewW / 2, viewH / 2, -viewH / 2, 1, halfD * 2 + 60);
    cam.up.copy(Y); cam.position.copy(mid).addScaledVector(fwd, halfD + 30); cam.lookAt(mid); cam.updateMatrixWorld(true);
    const hw = Math.round(viewH / viewW * w) || h; const W = w, Hp = Math.min(h, hw);
    const restoreFx = hideFx(null);
    const out = withOnly(sel, () => {
      const fg = scene.fog; scene.fog = null;
      try {
        const col = readRT(W, Hp, () => renderer.render(scene, cam));
        const white = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, side: THREE.DoubleSide });
        const bg = scene.background, ov = scene.overrideMaterial; scene.background = null; scene.overrideMaterial = white;
        const m = readRT(W, Hp, () => renderer.render(scene, cam));
        scene.background = bg; scene.overrideMaterial = ov; white.dispose();
        return { png: toPng(col, W, Hp), mask: toPng(m, W, Hp), pxPerM: +(W / viewW).toFixed(2), viewM: [+viewW.toFixed(1), +viewH.toFixed(1)] };
      } finally { scene.fog = fg; }
    });
    restoreFx();
    return out;
  }
  /**
   * Checklist camera. spec comes from tools/common/frame_bbox.py:
   * { sel, eye, target, up, fovY, orthoW, orthoH, near, far, width, height, kind }.
   * Renders the TARGET only (other meshes hidden). Returns colour PNG, white mask PNG, cover.
   */
  function renderPose(spec) {
    const { THREE, scene, renderer } = H();
    const w = spec.width | 0, h = spec.height | 0;
    const eye = spec.eye, target = spec.target, up = spec.up || [0, 1, 0];
    let cam;
    if (spec.kind === "ortho" || spec.orthoW) {
      const hw = spec.orthoW / 2, hh = spec.orthoH / 2;
      cam = new THREE.OrthographicCamera(-hw, hw, hh, -hh, spec.near || 0.05, spec.far || 8000);
    } else {
      cam = new THREE.PerspectiveCamera(spec.fovY, w / h, spec.near || 0.05, spec.far || 8000);
    }
    cam.up.set(up[0], up[1], up[2]);
    cam.position.set(eye[0], eye[1], eye[2]);
    cam.lookAt(target[0], target[1], target[2]);
    cam.updateMatrixWorld(true);
    const minCover = (spec.kind === "ortho" || spec.orthoW) ? 0.60 : 0.25;
    const restoreFx = hideFx(null);
    const shoot = () => withOnly(spec.sel, () => {
      const fg = scene.fog, bg = scene.background, ov = scene.overrideMaterial;
      scene.fog = null;
      try {
        const col = readRT(w, h, () => renderer.render(scene, cam));
        const white = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, side: THREE.DoubleSide });
        scene.background = null; scene.overrideMaterial = white;
        const m = readRT(w, h, () => renderer.render(scene, cam));
        scene.background = bg; scene.overrideMaterial = ov; white.dispose();
        let on = 0;
        for (let i = 0; i < w * h; i++) if (m[i * 4] > 127) on++;
        return { png: toPng(col, w, h), mask: toPng(m, w, h), cover: on / (w * h), px: m };
      } finally { scene.fog = fg; scene.background = bg; scene.overrideMaterial = ov; }
    });
    let out = shoot();
    if (out.cover + 1e-6 < minCover && out.cover > 0.002) {
      const ortho = !!(spec.kind === "ortho" || spec.orthoW);
      const base = ortho ? { l: cam.left, r: cam.right, t: cam.top, b: cam.bottom } : null;
      const fov0 = cam.fov;
      let lo = ortho ? 0.08 : 12;
      let hi = ortho ? 1 : Math.max(12.1, fov0);
      let best = null;
      const apply = (s) => {
        if (ortho) {
          cam.left = base.l * s; cam.right = base.r * s; cam.top = base.t * s; cam.bottom = base.b * s;
        } else cam.fov = s;
        cam.updateProjectionMatrix();
      };
      for (let i = 0; i < 8; i++) {
        const s = (lo + hi) / 2;
        apply(s);
        const trial = shoot();
        if (trial.cover + 1e-6 >= minCover) { best = trial; lo = s; }
        else hi = s;
      }
      if (best) out = best;
      else apply(ortho ? 1 : fov0);
    }
    delete out.px;
    restoreFx();
    return out;
  }
  /**
   * One 8 m head-on capture per facade axis, for the visible px/m log.
   * The eye sits in the air in front of that face. This is not the gate's
   * optical-zoom phone shot; that shot stays cap-visible-8m.
   */
  function faceCaptures(sel, instId, dist = 8, fov = 50, w = 360, h = 640) {
    const { THREE, scene, renderer } = H();
    const inst = instancesOf(sel).find((i) => i.id === instId) || instancesOf(sel)[0];
    if (!inst) return [];
    if (!inst.geo.boundingBox) inst.geo.computeBoundingBox();
    const bb = inst.geo.boundingBox;
    const e = inst.matrix.elements;
    const axisLen = (i) => Math.hypot(e[i], e[i + 1], e[i + 2]) || 1;
    const X = new THREE.Vector3(e[0], e[1], e[2]).multiplyScalar(1 / axisLen(0));
    const Y = new THREE.Vector3(e[4], e[5], e[6]).multiplyScalar(1 / axisLen(4));
    const Z = new THREE.Vector3(e[8], e[9], e[10]).multiplyScalar(1 / axisLen(8));
    const half = {
      x: (bb.max.x - bb.min.x) * axisLen(0) / 2,
      y: (bb.max.y - bb.min.y) * axisLen(4) / 2,
      z: (bb.max.z - bb.min.z) * axisLen(8) / 2,
    };
    const c = new THREE.Vector3(); bb.getCenter(c).applyMatrix4(inst.matrix);
    const faces = [["+z", Z, half.z], ["-z", Z.clone().negate(), half.z], ["+x", X, half.x], ["-x", X.clone().negate(), half.x]];
    const S = h / (2 * dist * Math.tan((fov * Math.PI) / 360));
    const restoreFx = hideFx(null);
    const out = [];
    try {
      for (const [cls, fwd, halfD] of faces) {
        const look = c.clone().addScaledVector(Y, -half.y * 0.25);
        const eye = look.clone().addScaledVector(fwd, halfD + dist);
        const cam = new THREE.PerspectiveCamera(fov, w / h, 0.3, 6000);
        cam.up.copy(Y); cam.position.copy(eye); cam.lookAt(look); cam.updateMatrixWorld(true);
        const shot = withOnly(sel, () => {
          const fg = scene.fog; scene.fog = null;
          try {
            const col = readRT(w, h, () => renderer.render(scene, cam));
            const white = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, side: THREE.DoubleSide });
            const bg = scene.background, ov = scene.overrideMaterial;
            scene.background = null; scene.overrideMaterial = white;
            const m = readRT(w, h, () => renderer.render(scene, cam));
            scene.background = bg; scene.overrideMaterial = ov; white.dispose();
            let on = 0;
            for (let i = 0; i < w * h; i++) if (m[i * 4] > 127) on++;
            return { png: toPng(col, w, h), mask: toPng(m, w, h), cover: on / (w * h) };
          } finally { scene.fog = fg; }
        });
        out.push({ cls, distM: dist, screenPxPerM: +S.toFixed(2), ...shot });
      }
    } finally { restoreFx(); }
    return out;
  }
  function hideFx(fxNames) {
    const { scene } = H(); const re = fxNames ? new RegExp(fxNames) : null; const hidden = [];
    scene.traverse((o) => { if ((o.isPoints || o.isLine || (re && o.name && re.test(o.name))) && o.visible) { o.visible = false; hidden.push(o); } });
    return () => { for (const o of hidden) o.visible = true; };
  }
  /**
   * Shadow probe from a fixed camera: render with the object casting, then with castShadow off (shadow map forced to
   * re-render), then restore. Ground pixels that darken by > 20% are this object's shadow.
   */
  function shadow(sel, p, t, w = 180, h = 320, fxNames) {
    const { THREE, scene, renderer } = H();
    const cam = new THREE.PerspectiveCamera(); placeCam(cam, p, t, 58, w, h);
    const restoreFx = hideFx(fxNames);
    // The drawn shell is often not the caster. Mesa rocks cast from an unnamed sibling on the shadow layer.
    const meshes = meshesOf(matchRoots(sel));
    const seen = new Set(meshes);
    for (const m of meshes) {
      const p = m.parent; if (!p) continue;
      for (const c of p.children) if (c.isMesh && c.castShadow && !seen.has(c)) { meshes.push(c); seen.add(c); }
    }
    const prevCast = meshes.map((m) => m.castShadow);
    const om = mask(sel, p, t, w, h, 58);
    const draw = () => { renderer.shadowMap.needsUpdate = true; renderer.render(scene, cam); };
    let on, off;
    try {
      on = readRT(w, h, draw);
      meshes.forEach((m) => { m.castShadow = false; });
      off = readRT(w, h, draw);
    } finally {
      meshes.forEach((m, i) => { m.castShadow = prevCast[i]; });
      renderer.shadowMap.needsUpdate = true; renderer.render(scene, cam); // map back to the real casters
      restoreFx();
    }
    const sm = new Uint8Array(w * h); let n = 0; const sum = [0, 0, 0], sumOff = [0, 0, 0];
    for (let i = 0; i < w * h; i++) {
      if (om[i] === "1") continue;
      const lOn = on[4 * i] * 0.2126 + on[4 * i + 1] * 0.7152 + on[4 * i + 2] * 0.0722;
      const lOff = off[4 * i] * 0.2126 + off[4 * i + 1] * 0.7152 + off[4 * i + 2] * 0.0722;
      if (lOff > 8 && lOn < lOff * 0.8) { sm[i] = 1; n++; for (let k = 0; k < 3; k++) { sum[k] += on[4 * i + k]; sumOff[k] += off[4 * i + k]; } }
    }
    return { n, frac: n / (w * h), meanOn: sum.map((x) => x / Math.max(1, n)), meanOff: sumOff.map((x) => x / Math.max(1, n)), mask: Array.from(sm).join("") };
  }

  /** Columns under the lower 20% of the object: lowest object hit from below vs ground height. */
  function grounding(sel, grid = 9) {
    const { THREE } = H();
    const out = [];
    const rc = new THREE.Raycaster();
    for (const inst of instancesOf(sel)) {
      const pos = inst.geo.getAttribute("position"); if (!pos) continue;
      if (!inst.geo.boundingBox) inst.geo.computeBoundingBox();
      const bb = inst.geo.boundingBox.clone().applyMatrix4(inst.matrix);
      const hgt = bb.max.y - bb.min.y;
      // probe mesh: a temporary single mesh for this instance (InstancedMesh raycast hits every copy)
      const probe = new THREE.Mesh(inst.geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
      probe.matrixAutoUpdate = false; probe.matrix.copy(inst.matrix); probe.matrixWorld.copy(inst.matrix);
      // footprint of the lower 20%
      const v = new THREE.Vector3(); let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(inst.matrix); if (v.y < bb.min.y + 0.2 * hgt) { x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z); } }
      let worst = -Infinity, worstAt = null, cols = 0;
      for (let i = 0; i < grid; i++) for (let j = 0; j < grid; j++) {
        const x = x0 + ((i + 0.5) / grid) * (x1 - x0), z = z0 + ((j + 0.5) / grid) * (z1 - z0);
        rc.set(new THREE.Vector3(x, bb.min.y - 5, z), new THREE.Vector3(0, 1, 0)); rc.far = 0.2 * hgt + 5;
        const hit = rc.intersectObject(probe, false)[0];
        if (!hit) continue;
        cols++;
        const air = hit.point.y - H().groundHeight(x, z);
        if (air > worst) { worst = air; worstAt = [+x.toFixed(1), +z.toFixed(1)]; }
      }
      probe.material.dispose();
      out.push({ inst: inst.id, cols, maxAirM: +worst.toFixed(3), at: worstAt, baseY: +bb.min.y.toFixed(2) });
    }
    return out;
  }

  /** Per unique geometry: non-manifold / open edges (welded), facade relief, oriented size per instance.
   *  A merged draw (aZbPart) stacks closed variant shells in one buffer. Welding that union marks every
   *  edge non-manifold, so each part is scored on its own. One shell, or no part attribute, stays one row. */
  function geometry(sel) {
    const { THREE } = H();
    const insts = instancesOf(sel);
    const geos = new Map();
    for (const i of insts) if (!geos.has(i.geo.uuid)) geos.set(i.geo.uuid, { geo: i.geo, insts: [] });
    for (const i of insts) geos.get(i.geo.uuid).insts.push(i);
    const measure = (geo, list, partId) => {
      const pos = geo.getAttribute("position"); const idx = geo.getIndex();
      const partAttr = partId == null ? null : geo.getAttribute("aZbPart");
      const nAll = idx ? idx.count / 3 : pos.count / 3;
      const key = (i) => `${Math.round(pos.getX(i) * 1e3)},${Math.round(pos.getY(i) * 1e3)},${Math.round(pos.getZ(i) * 1e3)}`;
      const vid = new Map(); const id = (i) => { const k = key(i); if (!vid.has(k)) vid.set(k, vid.size); return vid.get(k); };
      const edges = new Map();
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      const box = new THREE.Box3();
      const relief = { "+x": new Map(), "-x": new Map(), "+z": new Map(), "-z": new Map() };
      const crispAcc = { "+x": [], "-x": [], "+z": [], "-z": [] };
      let degenerate = 0, nTri = 0;
      for (let t = 0; t < nAll; t++) {
        const i = [0, 1, 2].map((k) => (idx ? idx.getX(3 * t + k) : 3 * t + k));
        if (partAttr && Math.round(partAttr.getX(i[0])) !== partId) continue;
        nTri++;
        const v = i.map(id);
        a.fromBufferAttribute(pos, i[0]); b.fromBufferAttribute(pos, i[1]); c.fromBufferAttribute(pos, i[2]);
        box.expandByPoint(a); box.expandByPoint(b); box.expandByPoint(c);
        if (v[0] === v[1] || v[1] === v[2] || v[0] === v[2]) { degenerate++; continue; }
        for (let k = 0; k < 3; k++) { const e = v[k] < v[(k + 1) % 3] ? v[k] + "_" + v[(k + 1) % 3] : v[(k + 1) % 3] + "_" + v[k]; edges.set(e, (edges.get(e) || 0) + 1); }
        const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
        const ar = n.length() / 2; if (ar < 1e-6) continue; n.normalize();
        const k = classOf([n.x, n.y, n.z]);
        if (!relief[k] || Math.abs(k[1] === "x" ? n.x : n.z) < 0.7) continue;
        const off = k[1] === "x" ? (a.x + b.x + c.x) / 3 : (a.z + b.z + c.z) / 3;
        const y = (a.y + b.y + c.y) / 3;
        const yb = Math.floor(y);
        const m = relief[k]; const r = m.get(yb) || [Infinity, -Infinity, 0, []]; r[0] = Math.min(r[0], off); r[1] = Math.max(r[1], off); r[2] += ar; r[3].push(off); m.set(yb, r);
        crispAcc[k].push({ off, ar, y, axis: Math.max(Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)) > 0.92 });
      }
      let open = 0, nonManifold = 0; for (const n of edges.values()) { if (n === 1) open++; else if (n > 2) nonManifold++; }
      const reliefM = {};
      for (const [k, m] of Object.entries(relief)) {
        // outer shell only: faces within 3 m of the outermost face of that metre (hole walls / inner faces excluded)
        const rs = [...m.values()].filter((r) => r[2] > 0.2).map((r) => r[3].filter((q) => (k[0] === "+" ? r[1] - q : q - r[0]) <= 3)).map((qs) => Math.max(...qs) - Math.min(...qs)).sort((x, y) => x - y);
        reliefM[k] = rs.length ? +rs[rs.length >> 1].toFixed(3) : null;
      }
      const crisp = {};
      for (const [k, faces] of Object.entries(crispAcc)) {
        // Outermost offset per metre of height. A designed taper moves that shell; the step depth is the
        // residual, scaled back by the shell so one bay plane stays one bin. A flat slab has one residual.
        const env = new Map();
        for (const f of faces) {
          const yb = Math.floor(f.y);
          const e = env.get(yb);
          env.set(yb, e == null ? f.off : (k[0] === "+" ? Math.max(e, f.off) : Math.min(e, f.off)));
        }
        let eBase = null;
        for (const e of env.values()) eBase = eBase == null ? e : (k[0] === "+" ? Math.max(eBase, e) : Math.min(eBase, e));
        const keptF = [];
        for (const f of faces) {
          const e = env.get(Math.floor(f.y));
          if (e == null || Math.abs(e) < 0.25 || eBase == null) continue;
          const inward = (k[0] === "+" ? e - f.off : f.off - e) * (eBase / e);
          if (inward <= 3.2 && inward >= -0.08) keptF.push({ ar: f.ar, axis: f.axis, res: Math.max(0, inward) });
        }
        const area = keptF.reduce((s, f) => s + f.ar, 0);
        const bins = new Map();
        for (const f of keptF) { const b = Math.round(f.res / 0.05); bins.set(b, (bins.get(b) || 0) + f.ar); }
        const planes = [...bins.values()].filter((a) => area > 0 && a / area >= 0.02).length;
        const axis = keptF.reduce((s, f) => s + (f.axis ? f.ar : 0), 0);
        crisp[k] = { axisFrac: area > 0 ? +(axis / area).toFixed(3) : 0, planes };
      }
      let s;
      if (partId == null) {
        if (!geo.boundingBox) geo.computeBoundingBox();
        s = geo.boundingBox.getSize(new THREE.Vector3());
      } else s = box.isEmpty() ? new THREE.Vector3() : box.getSize(new THREE.Vector3());
      const sizes = list.slice(0, 64).map((i) => {
        const e = i.matrix.elements;
        const sc = [Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10])];
        return { inst: i.id, w: +(s.x * sc[0]).toFixed(2), h: +(s.y * sc[1]).toFixed(2), d: +(s.z * sc[2]).toFixed(2) };
      });
      return { geo: geo.uuid.slice(0, 8), usedBy: partId == null ? list[0].mesh.name : list[0].mesh.name + "#part" + partId, part: partId, instances: list.length, tris: nTri, verts: vid.size, open, nonManifold, degenerate, reliefM, crisp, local: { w: +s.x.toFixed(2), h: +s.y.toFixed(2), d: +s.z.toFixed(2) }, sizes };
    };
    const out = [];
    for (const { geo, insts: list } of geos.values()) {
      const partAttr = geo.getAttribute("aZbPart");
      const ids = new Set();
      if (partAttr) for (let i = 0; i < partAttr.count; i++) ids.add(Math.round(partAttr.getX(i)));
      if (ids.size > 1) for (const pid of [...ids].sort((x, y) => x - y)) out.push(measure(geo, list, pid));
      else out.push(measure(geo, list, null));
    }
    return out;
  }

  /** Effects: every material must take its look from an Imagine image (not a typed colour). */
  function effects(sel) {
    const meshes = meshesOf(matchRoots(sel));
    return meshes.map((m) => {
      const mats = [].concat(m.material || []);
      const texs = mats.flatMap((mat) => texturesOfMaterial(mat).map(({ slot, t }) => texInfo(slot, t)));
      const colours = [];
      for (const mat of mats) {
        if (mat.color && !mat.map) colours.push("color #" + mat.color.getHexString());
        if (mat.uniforms) for (const [k, u] of Object.entries(mat.uniforms)) if (u && u.value && u.value.isColor) colours.push(k + " #" + u.value.getHexString());
        const src = (mat.fragmentShader || "");
        const lit = src.match(/vec3\(\s*[0-9.]+\s*,\s*[0-9.]+\s*,\s*[0-9.]+\s*\)/g) || [];
        if (lit.length) colours.push(`${lit.length} vec3 colour literals in the fragment shader (e.g. ${lit[0]})`);
      }
      return { mesh: m.name, kind: m.isPoints ? "points" : m.isLine ? "lines" : m.isInstancedMesh ? "instanced" : "mesh", textures: texs.filter((t) => t.kind !== "rendertarget" && t.kind !== "depth"), colours };
    });
  }

  function instanceBoxes(sel) {
    const { THREE } = H();
    return instancesOf(sel).map((i) => {
      if (!i.geo.boundingBox) i.geo.computeBoundingBox();
      const bb = i.geo.boundingBox.clone().applyMatrix4(i.matrix);
      const front = new THREE.Vector3(0, 0, 1).transformDirection(i.matrix);
      const side = new THREE.Vector3(1, 0, 0).transformDirection(i.matrix);
      const e = i.matrix.elements; const ls = i.geo.boundingBox.getSize(new THREE.Vector3());
      const sc = [Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10])];
      const c = new THREE.Vector3(); i.geo.boundingBox.getCenter(c).applyMatrix4(i.matrix);
      return { id: i.id, min: bb.min.toArray(), max: bb.max.toArray(), center: c.toArray(), front: [front.x, front.z], side: [side.x, side.z],
        halfW: (ls.x * sc[0]) / 2, halfD: (ls.z * sc[2]) / 2, height: ls.y * sc[1],
        nearPathM: distToPath(c.x, c.z, H().path || []) };
    });
  }

  function lights() {
    const { scene } = H(); const out = [];
    scene.traverse((o) => { if (o.isDirectionalLight) { o.updateMatrixWorld(); const d = o.position.clone().sub(o.target.position).normalize(); out.push({ name: o.name, cast: o.castShadow, dir: d.toArray(), intensity: o.intensity, mapSize: o.shadow && o.shadow.mapSize.x, autoUpdate: H().renderer.shadowMap.autoUpdate }); } });
    return out;
  }
  function stats() {
    const { renderer, scene } = H(); let meshes = 0, tris = 0;
    scene.traverse((o) => { if (o.isMesh && o.visible) { meshes++; const g = o.geometry; const n = g.index ? g.index.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0); tris += n * (o.isInstancedMesh ? o.count : 1); } });
    return { renderInfo: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, programs: (renderer.info.programs || []).length }, visibleMeshes: meshes, sceneTris: tris, pixelRatio: renderer.getPixelRatio() };
  }
  async function frames(n = 2) { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r())); }

  window.__og = { orthoFace, renderPose, faceCaptures, matchRoots, instancesOf, texturesOf, texel, mask, maskInstance, maskFromGameCamera, shadow, grounding, geometry, effects, instanceBoxes, lights, stats, frames, LIN_MIP };
})();

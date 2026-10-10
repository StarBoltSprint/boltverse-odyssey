
export async function mountMesas({ THREE, biome, field, world, camera, renderer }) {
  const P = await (await fetch(`./mesas/plates/plates.json?v=${MV}`)).json();
  const names = [...P.walls, P.block, ...P.caps];
  const geoInfo = {}, bins = {};
  const SD = new URLSearchParams(location.search).get("mesaStrata") || "strata";   // staging A/B: strata (depth) | strata-nodepth
  const [texs] = await Promise.all([
    Promise.all(names.map((n) => loadTex(THREE, `./mesas/plates/${n}.jpg?v=${MV}`))),
    Promise.all(MESA_LAYOUT.map(async (L) => {
      geoInfo[L.id] = await (await fetch(`./mesas/${SD}/${L.id}-geo.json?v=${MV}`)).json();
      bins[L.id] = new Float32Array(await (await fetch(`./mesas/${SD}/${L.id}.bin?v=${MV}`)).arrayBuffer());
    })),
  ]);
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const tex = {};
  names.forEach((n, i) => {
    const t = texs[i];
    t.colorSpace = THREE.SRGBColorSpace; t.flipY = false;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    t.anisotropy = aniso; t.needsUpdate = true; tex[n] = t;
  });
  const dbg = window.__zbDebug || {};
  const shadowLight = dbg.sun || null;
  const ground = dbg.ground || null;
  let sunL = null; world.traverse((o) => { if (o.isDirectionalLight && o !== shadowLight && !sunL) sunL = o; });
  const sd = sunL ? new THREE.Vector3().subVectors(sunL.position, sunL.target.position).normalize()
    : (() => { const h = headingToDir(90); const e = (8 * Math.PI) / 180; return new THREE.Vector3(h[0] * Math.cos(e), Math.sin(e), h[1] * Math.cos(e)); })();
  const sc0 = sunL ? sunL.color.clone().multiplyScalar(sunL.intensity) : new THREE.Color(0xffb089).multiplyScalar(1.35);
  const opts = { sunDir: sd.toArray(), sunCol: [sc0.r, sc0.g, sc0.b], amb: [0.15, 0.155, 0.17], sky: [0.07, 0.072, 0.08], gain: 1.0, fogW: 0.12, hazeW: 0.2 };
  const mats = LOD_BANDS.map((b) => rockMaterial(THREE, biome, P, tex, shadowLight, b, opts));
  const casterMat = new THREE.MeshBasicMaterial({ colorWrite: false });
  const items = [];
  const group = new THREE.Group(); group.name = "zb-mesas";
  const driftGeos = [];
  const lodTris = [];
  for (const L of MESA_LAYOUT) {
    const gi = geoInfo[L.id], bin = bins[L.id];
    const [x, z] = avXZ(L.s, L.lat);
    let yawDeg = L.yaw ?? 0;
    if (L.face) yawDeg = (Math.atan2(HERO[0] - x, HERO[1] - z) * 180) / Math.PI;
    const yaw = (yawDeg * Math.PI) / 180, mx = L.mirror ? -1 : 1;
    const toWorld = ([px, pz]) => { const lx = px * mx, lz = pz; return [x + lx * Math.cos(yaw) + lz * Math.sin(yaw), z - lx * Math.sin(yaw) + lz * Math.cos(yaw)]; };
    const ringLocal = (r) => r.map(([a, b]) => [a, -b]);   // hull z3 -> three local z
    const base = ringLocal(gi.rings[0].ring);
    let maxR = 0; for (const r of gi.rings) for (const [a, b] of r.ring) maxR = Math.max(maxR, Math.hypot(a, b));
    const ringW = base.map(toWorld);
    let minG = Infinity, maxG = -Infinity;
    for (const [wx, wz] of ringW) { const h = field.surfaceHeight(wx, wz); minG = Math.min(minG, h); maxG = Math.max(maxG, h); }
    const baseY = minG - 0.6 * L.scale;
    const meshes = [];
    gi.lods.forEach((ld, li) => {
      const n = ld.verts, off = ld.offset;
      const pos = new Float32Array(n * 3), pl = new Float32Array(n), px = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        const k = (off + i) * 6;
        pos[i * 3] = bin[k]; pos[i * 3 + 1] = bin[k + 1]; pos[i * 3 + 2] = bin[k + 2];
        pl[i] = bin[k + 3]; px[i * 2] = bin[k + 4]; px[i * 2 + 1] = bin[k + 5];
      }
      // fallen blocks (36 verts each, after the cliff verts) sit on their own dune height: never float
      if (ld.blockStart != null) for (let b = ld.blockStart; b + 36 <= n; b += 36) {
        let bx = 0, bz = 0; for (let i = b; i < b + 36; i++) { bx += pos[i * 3]; bz += pos[i * 3 + 2]; } bx /= 36; bz /= 36;
        const [wx, wz] = toWorld([bx, bz]); const dy = field.surfaceHeight(wx, wz) - baseY;
        for (let i = b; i < b + 36; i++) pos[i * 3 + 1] += Math.max(0, dy);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("aPl", new THREE.BufferAttribute(pl, 1));
      g.setAttribute("aPx", new THREE.BufferAttribute(px, 2));
      // standard uv (plate-normalised) so external probes (object-gate) can measure px/m + stretch; caps: 0 (cell mode)
      const uvA = new Float32Array(n * 2); for (let i = 0; i < n; i++) if (pl[i] >= 0) { uvA[i * 2] = px[i * 2] / 1280; uvA[i * 2 + 1] = 1 - px[i * 2 + 1] / 720; }
      g.setAttribute("uv", new THREE.BufferAttribute(uvA, 2));
      g.computeVertexNormals(); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mats[li]); m.name = `mesa-${L.id}-lod${li}`; m.frustumCulled = true;
      m.position.set(x, baseY, z); m.rotation.y = yaw; m.scale.set(mx, 1, 1);
      m.visible = li === 0;
      group.add(m); meshes.push(m);
      lodTris[li] = (lodTris[li] || 0) + n / 3;
    });
    const caster = new THREE.Mesh(meshes[1].geometry, casterMat);
    caster.layers.set(1); caster.castShadow = true; caster.position.copy(meshes[1].position); caster.rotation.copy(meshes[1].rotation); caster.scale.copy(meshes[1].scale);
    group.add(caster);
    driftGeos.push(buildDrift(THREE, field, ringW, 2.2, 14 * L.scale, 2.0, baseY));
    const hTop = gi.rings[gi.rings.length - 1].y1;
    items.push({ id: L.id, x, z, yaw: yawDeg, scale: L.scale, mirror: !!L.mirror, baseY, minG, maxG, sink: maxG - baseY, heightM: hTop,
      solid: ringW, collider: offsetPoly(ringW, 1.0), meshes, caster, maxR, gi });
  }
  world.add(group);
  group.updateMatrixWorld(true);
  let drift = null;
  if (ground) {
    let vc = 0, ic = 0; for (const g of driftGeos) { vc += g.attributes.position.count; ic += g.index.count; }
    const Pp = new Float32Array(vc * 3), N = new Float32Array(vc * 3), I = new Uint32Array(ic); let v = 0, k = 0;
    for (const g of driftGeos) { Pp.set(g.attributes.position.array, v * 3); N.set(g.attributes.normal.array, v * 3); for (const a of g.index.array) I[k++] = a + v; v += g.attributes.position.count; }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(Pp, 3)); g.setAttribute("normal", new THREE.BufferAttribute(N, 3)); g.setIndex(new THREE.BufferAttribute(I, 1));
    g.computeBoundingSphere();
    drift = new THREE.Mesh(g, ground.material); drift.name = "mesa-drifts"; drift.frustumCulled = false;
    let towerDrift = null; world.traverse((o) => { if (o.name === "sand-drifts") towerDrift = o; });
    if (towerDrift && towerDrift.onBeforeRender) drift.onBeforeRender = towerDrift.onBeforeRender;
    world.add(drift);
  }
  let shadowFit = null;
  if (shadowLight) {
    shadowLight.shadow.camera.layers.enable(1);
    const towersFp = ((window.__objectsGate && window.__objectsGate.footprints) || []).map((f) => ({ solid: f.solid, top: 170, base: -6 }));
    const casters = [...towersFp, ...items.filter((it) => Math.hypot(it.x - 200, it.z + 40) < 520).map((it) => ({ solid: offsetPoly(it.solid, 3), top: it.baseY + it.heightM + 2, base: it.baseY - 2 }))];
    const shCam = shadowLight.shadow.camera;
    const sdir = new THREE.Vector3().subVectors(shadowLight.position, shadowLight.target.position).normalize();
    let cx = 0, cz = 0, n = 0; for (const c of casters) for (const [x, z] of c.solid) { cx += x; cz += z; n++; } cx /= n; cz /= n;
    const D = 1500;
    shadowLight.position.set(cx + sdir.x * D, sdir.y * D, cz + sdir.z * D); shadowLight.target.position.set(cx, 0, cz);
    shadowLight.updateMatrixWorld(); shadowLight.target.updateMatrixWorld();
    shCam.position.copy(shadowLight.position); shCam.lookAt(shadowLight.target.position); shCam.updateMatrixWorld(true);
    const inv = shCam.matrixWorldInverse, v = new THREE.Vector3();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const c of casters) for (const [x, z] of c.solid) for (const y of [c.base, c.top]) {
      v.set(x, y, z).applyMatrix4(inv);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z);
    }
    shCam.left = x0 - 4; shCam.right = x1 + 4; shCam.bottom = y0 - 4; shCam.top = y1 + 4;
    shCam.near = Math.max(1, -z1 - 20); shCam.far = -z0 + 900; shCam.updateProjectionMatrix();
    if (ground && ground.material.uniforms.uShadowDepthM) ground.material.uniforms.uShadowDepthM.value = shCam.far - shCam.near;
    for (const m of mats) m.userData.u.uShadowDepthM.value = shCam.far - shCam.near;
    renderer.shadowMap.needsUpdate = true;
    shadowFit = { casters: casters.length, mesaCasters: casters.length - towersFp.length,
      texelM: +(Math.max(shCam.right - shCam.left, shCam.top - shCam.bottom) / 2048).toFixed(3),
      extentM: [+(shCam.right - shCam.left).toFixed(1), +(shCam.top - shCam.bottom).toFixed(1)], depthM: +(shCam.far - shCam.near).toFixed(1) };
  }
  let warm = 6;
  const cp = new THREE.Vector3();
  function update(cam) {
    if (warm > 0) { warm--; renderer.shadowMap.needsUpdate = true; }
    for (const m of mats) {
      const u = m.userData.u;
      if (shadowLight && shadowLight.shadow.map && u.uShadowMap.value !== shadowLight.shadow.map.texture) { u.uShadowMap.value = shadowLight.shadow.map.texture; u.uShadowOn.value = 1; }
    }
    const c = (cam || camera).getWorldPosition(cp);
    for (const it of items) {
      const d = Math.hypot(c.x - it.x, c.y - it.baseY, c.z - it.z);
      it.meshes.forEach((m, li) => { const b = LOD_BANDS[li]; m.visible = d >= b[0] && d <= b[3]; });
    }
  }
  function collide(st) {
    for (const it of items) {
      const c = it.collider;
      if (Math.hypot(st.x - it.x, st.z - it.z) > it.maxR + 20) continue;
      if (insidePoly(st.x, st.z, c)) { const [nx, nz] = nearestOnPoly(st.x, st.z, c); st.x = nx; st.z = nz; }
    }
  }
  window.__mesasGate = {
    version: MV, method: "strata-v2", strataDir: SD,
    count: items.length,
    lods: lodTris.map((t) => Math.round(t)), lodBands: LOD_BANDS,
    perMesa: items.map((it) => ({ id: it.id, lods: it.gi.lods.map((l) => ({ tris: l.tris, relief: !!l.stretch.relief, nonManifoldEdges: l.stretch.nonManifoldEdges ?? null, wallOut: l.stretch.wallOut ?? null, minPxPerM: +l.stretch.minPxPerM.toFixed(1), p01PxPerM: +l.stretch.p01PxPerM.toFixed(1), maxStretch: +l.stretch.maxStretch.toFixed(3), layers: l.layers, blocks: l.blocks })),
      strata: it.gi.strata.length - 1, repeatClash: it.gi.repeatClash ?? null, adjSamePlate: it.gi.adjSamePlate ?? null })),
    textures: Object.fromEntries(Object.entries(tex).map(([k, t]) => [k, { w: t.image.width, h: t.image.height, aniso: t.anisotropy, mips: t.generateMipmaps, minFilter: t.minFilter === THREE.LinearMipmapLinearFilter ? "trilinear" : t.minFilter }])),
    anisoMax: aniso,
    pxPerM: { wall: P.pxm.wall, cap: P.pxm.cap, block: P.pxm.block },
    stretch: Math.max(...items.flatMap((it) => it.gi.lods.map((l) => l.stretch.maxStretch))),
    minPxPerM: Math.min(...items.flatMap((it) => it.gi.lods.map((l) => l.stretch.minPxPerM)), P.pxm.cap),
    items: items.map((it) => ({ id: it.id, x: +it.x.toFixed(1), z: +it.z.toFixed(1), yaw: +it.yaw.toFixed(1), scale: it.scale, baseY: +it.baseY.toFixed(2),
      minGround: +it.minG.toFixed(2), maxGround: +it.maxG.toFixed(2), heightM: +it.heightM.toFixed(1), solid: it.solid })),
    shadow: shadowFit, drift: !!drift,
    light: { sunDir: opts.sunDir.map((v) => +v.toFixed(3)), sunCol: opts.sunCol.map((v) => +v.toFixed(3)), amb: opts.amb, sky: opts.sky, foundSun: !!sunL },
  };
  window.__mesasTune = (o) => { for (const m of mats) { const u = m.userData.u;
    if (o.gain != null) u.uGain.value = o.gain; if (o.fogW != null) u.uFogW.value = o.fogW; if (o.hazeW != null) u.uHazeW.value = o.hazeW;
    if (o.amb) u.uAmb.value.set(...o.amb); if (o.sky) u.uSky.value.set(...o.sky); if (o.debug != null) u.uDebug.value = o.debug; }
    const u = mats[0].userData.u; return { gain: u.uGain.value, fogW: u.uFogW.value, hazeW: u.uHazeW.value, amb: u.uAmb.value.toArray(), sky: u.uSky.value.toArray() }; };
  return { update, collide, items };
}

// object-gate in-page probe, part 2 (API 1.3): raycast + optical zoom for the render-based visible px/m capture.
// Evaluated after lib/probe.js; extends window.__og. Measurement only: zoom(null) restores the game's own fov.
(() => {
  const H = () => window.__ogHost;
  const og = window.__og;
  const meshesOf = (roots) => { const out = []; for (const r of roots) r.traverse((o) => { if (o.isMesh) out.push(o); }); return out; };
  /** First visible surface of the selected object along a ray (null if missed). */
  function surfaceHit(sel, o, d, far = 600) {
    const { THREE } = H();
    const shown = (x) => { for (let p = x; p; p = p.parent) if (p.visible === false) return false; return true; };
    const rc = new THREE.Raycaster(new THREE.Vector3(...o), new THREE.Vector3(...d).normalize(), 0, far);
    const hits = rc.intersectObjects(meshesOf(og.matchRoots(sel)).filter((m) => m.isMesh && shown(m)), false);
    if (!hits.length) return null;
    const h = hits[0];
    let n = null;
    if (h.face) {
      const m = h.object.matrixWorld.clone();
      if (h.instanceId != null && h.object.isInstancedMesh) { const im = new THREE.Matrix4(); h.object.getMatrixAt(h.instanceId, im); m.multiply(im); }
      const v = h.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(m)).normalize();
      if (v.dot(rc.ray.direction) > 0) v.negate();
      n = v.toArray();
    }
    return { d: h.distance, point: h.point.toArray(), normal: n, name: h.object.name };
  }
  /** Optical zoom of the live game camera: same position, same LOD and distance fades, finer mips = a higher-resolution
   *  screen at the same distance. zoom(null) restores the game's own fov. Returns the fov the projection really uses. */
  let zoomSaved = null;
  function zoom(fovDeg) {
    const c = H().camera;
    if (fovDeg == null) {
      if (zoomSaved != null) { delete c.fov; c.fov = zoomSaved; zoomSaved = null; c.updateProjectionMatrix(); }
    } else {
      if (zoomSaved == null) zoomSaved = c.fov;
      Object.defineProperty(c, "fov", { configurable: true, get: () => fovDeg, set: () => {} });
      c.updateProjectionMatrix();
    }
    return (2 * Math.atan(1 / c.projectionMatrix.elements[5]) * 180) / Math.PI;
  }

  Object.assign(og, { surfaceHit, zoom });
})();

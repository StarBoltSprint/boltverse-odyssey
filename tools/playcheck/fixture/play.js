/**
 * Measurement harness for tools/playcheck. Not a biome and not a play build.
 * Test patterns stand in for Imagine pixels so the validator can be run in this repo.
 * ?debug=1 installs window.__play. ?fixture=take8 reproduces invisible colliders,
 * a missing gate, an unkeyed black rectangle, a repeated floor, an upscaled ring,
 * magnification above 1, and a real texSubImage3D error.
 */
(async () => {
  const params = new URLSearchParams(location.search);
  const debug = params.has("debug");
  const take8 = params.get("fixture") === "take8";
  const layout = await (await fetch("clearing.json")).json();
  const canvas = document.getElementById("view");
  const hud = document.getElementById("hud");
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: true, preserveDrawingBuffer: true });
  if (!gl) throw new Error("webgl2 missing");

  const VFOV = 68 * Math.PI / 180;
  const TILE = 0.9;
  const RING = layout.edge_ring.radius_m;
  const HERO_R = 0.35;
  const CULL = layout.near_lens.cull_m;
  const gate = layout.gates[0];
  const gateHalf = Math.atan(gate.width_m / 2 / RING) * 180 / Math.PI;

  if (take8) provokeTexError(gl);

  const hulls = layout.edge_ring.hulls.map((h, i) => ({
    id: h.id,
    heading: h.heading_deg,
    width: h.width_deg,
    index: i + 1,
  }));
  const interiors = layout.interior_objects.map((o, i) => ({
    id: o.id,
    x: o.position[0],
    z: o.position[1],
    radius: o.radius_m || 0.75,
    index: hulls.length + 1 + i,
  }));
  const gateIndex = hulls.length + interiors.length + 1;
  const fogIndex = gateIndex + 1;
  const heroIndex = fogIndex + 1;
  const labels = [""];
  for (const h of hulls) labels[h.index] = h.id;
  for (const o of interiors) labels[o.index] = o.id;
  labels[gateIndex] = `gate:${gate.id}`;
  labels[fogIndex] = "fog";
  labels[heroIndex] = "hero";

  const ID_W = 180;
  const ID_H = 400;
  const id = makeTarget(gl, ID_W, ID_H);

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }
  resize();

  const groundD = estimateGroundDistance(canvas.height || 1600);
  const fy0 = ((canvas.height || 1600) / 2) / Math.tan(VFOV / 2);
  const groundPx = fy0 * TILE / groundD;
  const tileSize = take8 ? Math.max(32, Math.round(groundPx / 1.17)) : 1024;
  const backdropW = take8 ? 512 : 8192;
  const backdropH = take8 ? 96 : 1024;

  const tiles = [0, 1, 2, 3].map((i) =>
    texFromCanvas(gl, makeTile(tileSize, i, take8), take8 ? gl.NEAREST : gl.LINEAR),
  );
  const backdrop = texFromCanvas(gl, makeBackdrop(backdropW, backdropH, take8), take8 ? gl.NEAREST : gl.LINEAR);
  const fogTex = texFromCanvas(gl, makeFog(), gl.LINEAR);
  const heroTex = texFromCanvas(gl, makeHero(), gl.LINEAR);
  const white = texFromCanvas(gl, solid(8, 8, 255, 255, 255, 255), gl.LINEAR);
  const flat = texFromCanvas(gl, solid(4, 4, 255, 255, 255, 255), gl.NEAREST);

  const prog = program(gl, VS, FS);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  const aPos = gl.getAttribLocation(prog, "aPos");
  const aUv = gl.getAttribLocation(prog, "aUv");
  gl.enableVertexAttribArray(aPos);
  gl.enableVertexAttribArray(aUv);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 20, 0);
  gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 20, 12);
  const loc = {
    mvp: gl.getUniformLocation(prog, "uMvp"),
    tex: gl.getUniformLocation(prog, "uTex"),
    tint: gl.getUniformLocation(prog, "uTint"),
    idMode: gl.getUniformLocation(prog, "uIdMode"),
    id: gl.getUniformLocation(prog, "uId"),
    cut: gl.getUniformLocation(prog, "uCut"),
    keep: gl.getUniformLocation(prog, "uKeepAlpha"),
  };

  const sim = {
    x: 0,
    z: 0,
    hdg: gate.heading_deg,
    spd: 0,
    state: "IDLE",
    idleTimer: 1,
    blocked: false,
    pathTrigger: false,
    automated: false,
    input: { forward: 0, turn: 0, gallop: false },
  };

  const keys = new Set();
  addEventListener("keydown", (e) => keys.add(e.code));
  addEventListener("keyup", (e) => keys.delete(e.code));
  const stick = document.getElementById("stick");
  stick.addEventListener("pointerdown", (e) => {
    stick.setPointerCapture(e.pointerId);
    sim.input.forward = 1;
  });
  stick.addEventListener("pointerup", () => {
    sim.input.forward = 0;
  });

  function applyKeys() {
    if (!debug) return;
    let f = 0;
    let t = 0;
    if (keys.has("KeyW") || keys.has("ArrowUp")) f = 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) f = 0;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) t -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) t += 1;
    if (f || t) {
      sim.input.forward = f;
      sim.input.turn = t;
      sim.input.gallop = keys.has("ShiftLeft") || keys.has("ShiftRight");
    }
  }

  function step(dt) {
    const speed = sim.input.forward > 0.05 ? (sim.input.gallop ? 6.2 : 4.6) * sim.input.forward : 0;
    sim.hdg = wrap(sim.hdg + sim.input.turn * 70 * dt);
    const rad = sim.hdg * Math.PI / 180;
    const nx = sim.x + Math.sin(rad) * speed * dt;
    const nz = sim.z + Math.cos(rad) * speed * dt;
    if (speed > 0 && blockedAt(nx, nz)) {
      sim.blocked = true;
      sim.spd = 0;
    } else {
      sim.x = nx;
      sim.z = nz;
      sim.spd = speed;
      // Contact survives releasing the stick, so the settled idle still reports the stop.
      const px = sim.x + Math.sin(rad) * 0.08;
      const pz = sim.z + Math.cos(rad) * 0.08;
      sim.blocked = blockedAt(px, pz);
    }
    const ang = wrap(Math.atan2(sim.x, sim.z) * 180 / Math.PI);
    const distC = Math.hypot(sim.x, sim.z);
    if (distC > RING - 0.2 && angDist(ang, gate.heading_deg) <= gateHalf) sim.pathTrigger = true;
    if (sim.spd > 0.2) {
      sim.state = "GALLOP";
      sim.idleTimer = 0;
    } else {
      sim.idleTimer += dt;
      if (sim.idleTimer >= 0.25) sim.state = "IDLE";
    }
  }

  function blockedAt(nx, nz) {
    const d = Math.hypot(nx, nz);
    const ang = wrap(Math.atan2(nx, nz) * 180 / Math.PI);
    if (d > RING - HERO_R) {
      if (angDist(ang, gate.heading_deg) <= gateHalf) return false;
      return true;
    }
    for (const o of interiors) {
      if (Math.hypot(nx - o.x, nz - o.z) < o.radius + HERO_R) return true;
    }
    return false;
  }

  function camera() {
    const yaw = sim.hdg * Math.PI / 180;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const eye = [sim.x - fx * 1.75, 1.5, sim.z - fz * 1.75];
    const target = [sim.x + fx * 8, 0.35, sim.z + fz * 8];
    return { eye, target, view: lookAt(eye, target, [0, 1, 0]) };
  }

  function metrics() {
    resize();
    const hfov = 2 * Math.atan(Math.tan(VFOV / 2) * (canvas.width / Math.max(1, canvas.height))) * 180 / Math.PI;
    const fy = (canvas.height / 2) / Math.tan(VFOV / 2);
    const dGround = estimateGroundDistance(canvas.height);
    const groundMag = (fy * TILE / dGround) / tileSize;
    const skyH = Math.round(canvas.height * 0.42);
    const slice = backdropW * (hfov / 360);
    const backMag = Math.max(canvas.width / slice, skyH / backdropH);
    const gx = Math.sin(gate.heading_deg * Math.PI / 180) * RING;
    const gz = Math.cos(gate.heading_deg * Math.PI / 180) * RING;
    const dx = gx - sim.x;
    const dz = gz - sim.z;
    const bearing = wrap180(Math.atan2(dx, dz) * 180 / Math.PI - sim.hdg);
    let nearest = 80;
    const { eye } = camera();
    const consider = (wx, wz, rad) => {
      const d = Math.hypot(wx - eye[0], wz - eye[2]) - rad;
      if (d < nearest) nearest = d;
    };
    if (!take8) {
      for (const h of hulls) consider(Math.sin(h.heading * Math.PI / 180) * RING, Math.cos(h.heading * Math.PI / 180) * RING, 0.4);
      for (const o of interiors) consider(o.x, o.z, o.radius);
      consider(gx, gz, 0.4);
    }
    return {
      mag: round3(groundMag),
      magSources: { ground: round3(groundMag), backdrop: round3(backMag) },
      hfov,
      skyH,
      gate: { id: gate.id, bearing_deg: round3(bearing), dist_m: round3(Math.hypot(dx, dz)) },
      nearestVisibleM: round3(Math.max(0, nearest)),
    };
  }

  function pose() {
    const m = metrics();
    return {
      x: round3(sim.x),
      z: round3(sim.z),
      hdg: round3(wrap(sim.hdg)),
      spd: round3(sim.spd),
      mag: m.mag,
      magSources: m.magSources,
      state: sim.state,
      blocked: sim.blocked,
      pathTrigger: sim.pathTrigger,
      heroCount: 1,
      gate: m.gate,
    };
  }

  function updateHud() {
    const p = pose();
    hud.textContent =
      `x ${p.x.toFixed(2)}   z ${p.z.toFixed(2)}   hdg ${p.hdg.toFixed(0)}\n` +
      `spd ${p.spd.toFixed(2)}   mag ${p.mag.toFixed(3)}\n` +
      `hero ${p.state}\n` +
      `gate ${p.gate.id}  brg ${p.gate.bearing_deg.toFixed(0)}  ${p.gate.dist_m.toFixed(1)} m`;
  }

  let drawMode = "color";
  function render(mode) {
    drawMode = mode;
    resize();
    const w = mode === "id" ? ID_W : canvas.width;
    const h = mode === "id" ? ID_H : canvas.height;
    if (mode === "id") {
      gl.bindFramebuffer(gl.FRAMEBUFFER, id.fbo);
      gl.viewport(0, 0, ID_W, ID_H);
      gl.disable(gl.BLEND);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(mode === "id" ? 0 : 0.11, mode === "id" ? 0 : 0.13, mode === "id" ? 0 : 0.16, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(prog);
    gl.uniform1i(loc.tex, 0);
    const proj = perspective(VFOV, w / h, 0.08, 80);
    const cam = camera();
    const vp = mul(proj, cam.view);
    const m = metrics();

    gl.disable(gl.DEPTH_TEST);
    const skyTop = 1;
    const skyBot = 1 - 2 * 0.42;
    if (mode === "color") screenQuad(skyBot, skyTop, -1, 1, backdrop, [1, 1, 1, 1], 0, 0.02, skyUv(m.hfov));
    gl.enable(gl.DEPTH_TEST);

    const reach = 16;
    if (mode === "color") {
      const x0 = Math.floor((sim.x - reach) / TILE);
      const x1 = Math.ceil((sim.x + reach) / TILE);
      const z0 = Math.floor((sim.z - 4) / TILE);
      const z1 = Math.ceil((sim.z + reach) / TILE);
      for (let iz = z0; iz <= z1; iz++) {
        for (let ix = x0; ix <= x1; ix++) {
          const variant = take8 ? 0 : Math.abs((ix * 13 + iz * 7) % 4);
          quad(
            vp,
            [
              [ix * TILE, 0, iz * TILE],
              [(ix + 1) * TILE, 0, iz * TILE],
              [(ix + 1) * TILE, 0, (iz + 1) * TILE],
              [ix * TILE, 0, (iz + 1) * TILE],
            ],
            tiles[variant],
            [1, 1, 1, 1],
            0,
            0.1,
          );
        }
      }
    }

    if (!take8) {
      for (const h of hulls) drawHull(vp, h, cam.eye);
      drawGate(vp, cam.eye);
      for (const o of interiors) {
        const d = Math.hypot(o.x - cam.eye[0], o.z - cam.eye[2]);
        if (d < CULL) continue;
        const yaw = Math.atan2(cam.eye[0] - o.x, cam.eye[2] - o.z);
        billboard(vp, o.x, 0.9, o.z, 1.3, 1.8, yaw, flat, hullColor(o.index), o.index, 0.2);
      }
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      for (let i = 0; i < layout.fog_band.patches; i++) {
        const a = (i / layout.fog_band.patches) * Math.PI * 2;
        // Stay inside the ring so a stop looking outward sees the wall, not a fog card.
        const r = 7 + (i % 5) * 1.1;
        const px = Math.cos(a) * r;
        const pz = Math.sin(a) * r;
        const yaw = Math.atan2(cam.eye[0] - px, cam.eye[2] - pz);
        billboard(vp, px, 1.3, pz, 4.2, 2.4, yaw, fogTex, [0.82, 0.88, 0.9, 0.7], fogIndex, mode === "id" ? 0.18 : 0.08, true);
      }
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    gl.disable(gl.DEPTH_TEST);
    screenQuad(-0.95, -0.52, -0.12, 0.12, heroTex, [1, 1, 1, 1], heroIndex, 0.4);
    if (take8 && mode === "color") {
      screenQuad(0.12, 0.5, -0.28, 0.22, flat, [0, 0, 0, 1], 0, 0.01);
    }
    gl.enable(gl.DEPTH_TEST);
  }

  function drawHull(vp, h, eye) {
    // Short arc slices sit on the ring. One chord would fall inside the collider,
    // so a stop at the ring would look past the wall.
    const steps = Math.max(2, Math.ceil(h.width / 8));
    for (let i = 0; i < steps; i++) {
      const t0 = -0.5 + i / steps;
      const t1 = -0.5 + (i + 1) / steps;
      const a0 = (h.heading + t0 * h.width) * Math.PI / 180;
      const a1 = (h.heading + t1 * h.width) * Math.PI / 180;
      const x0 = Math.sin(a0) * RING;
      const z0 = Math.cos(a0) * RING;
      const x1 = Math.sin(a1) * RING;
      const z1 = Math.cos(a1) * RING;
      const midX = (x0 + x1) / 2;
      const midZ = (z0 + z1) / 2;
      if (Math.hypot(midX - eye[0], midZ - eye[2]) < CULL) continue;
      quad(
        vp,
        [
          [x0, 0, z0],
          [x1, 0, z1],
          [x1, 3.2, z1],
          [x0, 3.2, z0],
        ],
        flat,
        hullColor(h.index),
        h.index,
        0.15,
      );
    }
  }

  function drawGate(vp, eye) {
    const h = gate.heading_deg * Math.PI / 180;
    const half = gateHalf * Math.PI / 180;
    const left = h - half;
    const right = h + half;
    const posts = [
      [Math.sin(left) * RING, Math.cos(left) * RING],
      [Math.sin(right) * RING, Math.cos(right) * RING],
    ];
    for (const [px, pz] of posts) {
      if (Math.hypot(px - eye[0], pz - eye[2]) < CULL) continue;
      const yaw = Math.atan2(eye[0] - px, eye[2] - pz);
      billboard(vp, px, 1.5, pz, 0.7, 3.0, yaw, flat, [0.95, 0.85, 0.35, 1], gateIndex, 0.15);
    }
    const mx = Math.sin(h) * RING;
    const mz = Math.cos(h) * RING;
    const yaw = Math.atan2(eye[0] - mx, eye[2] - mz);
    billboard(vp, mx, 2.9, mz, gate.width_m, 0.45, yaw, flat, [0.95, 0.85, 0.35, 1], gateIndex, 0.15);
  }

  function billboard(vp, x, y, z, w, h, yaw, texture, tint, idValue, cut, keep) {
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    quad(
      vp,
      [
        [x - rx * w / 2, y - h / 2, z - rz * w / 2],
        [x + rx * w / 2, y - h / 2, z + rz * w / 2],
        [x + rx * w / 2, y + h / 2, z + rz * w / 2],
        [x - rx * w / 2, y + h / 2, z - rz * w / 2],
      ],
      texture,
      tint,
      idValue,
      cut,
      keep,
    );
  }

  function quad(vp, corners, texture, tint, idValue, cut, keep) {
    const [a, b, c, d] = corners;
    const data = new Float32Array([
      a[0], a[1], a[2], 0, 1,
      b[0], b[1], b[2], 1, 1,
      c[0], c[1], c[2], 1, 0,
      a[0], a[1], a[2], 0, 1,
      c[0], c[1], c[2], 1, 0,
      d[0], d[1], d[2], 0, 0,
    ]);
    draw(vp, texture, tint, idValue, cut, !!keep, data);
  }

  function screenQuad(y0, y1, x0, x1, texture, tint, idValue, cut, uv) {
    const u = uv || [0, 0, 1, 1];
    const data = new Float32Array([
      x0, y0, 0, u[0], u[3],
      x1, y0, 0, u[2], u[3],
      x1, y1, 0, u[2], u[1],
      x0, y0, 0, u[0], u[3],
      x1, y1, 0, u[2], u[1],
      x0, y1, 0, u[0], u[1],
    ]);
    const ident = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    draw(ident, texture, tint, idValue, cut, false, data);
  }

  function skyUv(hfov) {
    const u0 = sim.hdg / 360 - hfov / 360 / 2;
    const u1 = u0 + hfov / 360;
    return [u0, 0, u1, 1];
  }

  function draw(mvp, texture, tint, idValue, cut, keep, data) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 20, 0);
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 20, 12);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniformMatrix4fv(loc.mvp, false, mvp);
    gl.uniform4fv(loc.tint, tint);
    gl.uniform1f(loc.idMode, drawMode === "id" ? 1 : 0);
    gl.uniform1f(loc.id, idValue);
    gl.uniform1f(loc.cut, cut);
    gl.uniform1f(loc.keep, keep ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function readIds() {
    render("id");
    const pixels = new Uint8Array(ID_W * ID_H * 4);
    gl.readPixels(0, 0, ID_W, ID_H, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const ids = new Uint16Array(ID_W * ID_H);
    for (let y = 0; y < ID_H; y++) {
      const srcRow = (ID_H - 1 - y) * ID_W;
      for (let x = 0; x < ID_W; x++) ids[y * ID_W + x] = pixels[(srcRow + x) * 4];
    }
    const bytes = new Uint8Array(ids.buffer);
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return { width: ID_W, height: ID_H, labels, b64: btoa(bin) };
  }

  function snapshot() {
    const p = pose();
    const m = metrics();
    updateHud();
    render("color");
    return {
      ...p,
      harness: true,
      fixture: take8 ? "take8" : "clean",
      heroCount: 1,
      canvas: { width: canvas.width, height: canvas.height },
      gate: m.gate,
      nearestVisibleM: m.nearestVisibleM,
      backdrop: {
        sourceW: backdropW,
        sourceH: backdropH,
        screenW: canvas.width,
        screenH: m.skyH,
        fovDeg: round3(m.hfov),
      },
      objectIds: readIds(),
      glRenderer: gl.getParameter(gl.RENDERER),
    };
  }

  let external = 0;
  if (debug) {
    window.__play = {
      version: 1,
      ready: true,
      harness: true,
      reset() {
        sim.x = 0;
        sim.z = 0;
        sim.hdg = gate.heading_deg;
        sim.spd = 0;
        sim.state = "IDLE";
        sim.idleTimer = 1;
        sim.blocked = false;
        sim.pathTrigger = false;
        sim.input = { forward: 0, turn: 0, gallop: false };
        sim.automated = true;
        external = performance.now();
        render("color");
        updateHud();
      },
      look(heading) {
        sim.hdg = wrap(heading);
        sim.automated = true;
        external = performance.now();
        render("color");
      },
      setInput(input) {
        sim.input.forward = Number(input.forward) || 0;
        sim.input.turn = Number(input.turn) || 0;
        sim.input.gallop = !!input.gallop;
        sim.automated = true;
        external = performance.now();
      },
      tick(dt) {
        sim.automated = true;
        external = performance.now();
        step(dt);
        render("color");
        updateHud();
        return pose();
      },
      snapshot,
    };
  }

  render("color");
  updateHud();
  (function loop() {
    requestAnimationFrame(loop);
    if (!debug || sim.automated) return;
    if (performance.now() - external < 250) return;
    applyKeys();
    step(1 / 30);
    render("color");
    updateHud();
  })();

  function wrap(a) {
    a %= 360;
    if (a < 0) a += 360;
    return a;
  }
  function wrap180(a) {
    const x = wrap(a);
    return x > 180 ? x - 360 : x;
  }
  function angDist(a, b) {
    return Math.abs(wrap180(a - b));
  }
})();

function provokeTexError(gl) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, tex);
  gl.texStorage3D(gl.TEXTURE_3D, 1, gl.RGBA8, 4, 4, 2);
  gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, 0, 8, 8, 2, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(8 * 8 * 2 * 4));
  gl.bindTexture(gl.TEXTURE_3D, null);
  gl.deleteTexture(tex);
}

function estimateGroundDistance(canvasH) {
  const vfov = 68 * Math.PI / 180;
  const eyeY = 1.5;
  const pitch = Math.atan2(1.5 - 0.35, 8);
  const bottom = pitch + vfov / 2;
  const horiz = eyeY / Math.tan(bottom);
  return Math.hypot(horiz, eyeY);
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

function hullColor(index) {
  const palette = [
    [0.75, 0.28, 0.22, 1],
    [0.25, 0.55, 0.32, 1],
    [0.25, 0.38, 0.72, 1],
    [0.62, 0.42, 0.18, 1],
    [0.45, 0.28, 0.58, 1],
    [0.2, 0.55, 0.58, 1],
    [0.7, 0.55, 0.2, 1],
    [0.55, 0.25, 0.35, 1],
  ];
  return palette[(index - 1) % palette.length];
}

function solid(w, h, r, g, b, a) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
  ctx.fillRect(0, 0, w, h);
  return c;
}

function makeTile(size, variant, checker) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (checker) {
    const cell = Math.max(8, Math.floor(size / 6));
    for (let y = 0; y < size; y += cell) {
      for (let x = 0; x < size; x += cell) {
        const on = ((x / cell) ^ (y / cell)) & 1;
        ctx.fillStyle = on ? "#e8e8e8" : "#1a1a1a";
        ctx.fillRect(x, y, cell, cell);
      }
    }
    return c;
  }
  const bases = [
    [92, 108, 74],
    [70, 96, 112],
    [120, 104, 72],
    [78, 90, 78],
  ];
  const base = bases[variant % 4];
  const img = ctx.createImageData(size, size);
  let n = variant * 997 + 13;
  const rnd = () => {
    n = (n * 1103515245 + 12345) & 0x7fffffff;
    return n / 0x7fffffff;
  };
  const block = 4;
  for (let y = 0; y < size; y += block) {
    for (let x = 0; x < size; x += block) {
      const j = (rnd() - 0.5) * 50;
      const r = clamp(base[0] + j);
      const g = clamp(base[1] + j * 0.8);
      const b = clamp(base[2] + j * 0.5);
      for (let oy = 0; oy < block; oy++) {
        for (let ox = 0; ox < block; ox++) {
          const i = ((y + oy) * size + (x + ox)) * 4;
          img.data[i] = r;
          img.data[i + 1] = g;
          img.data[i + 2] = b;
          img.data[i + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function makeBackdrop(w, h, chunky) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(w, h);
  const block = chunky ? Math.max(8, Math.floor(w / 32)) : 4;
  for (let y = 0; y < h; y += block) {
    for (let x = 0; x < w; x += block) {
      const u = x / w;
      const v = y / h;
      const ridge = Math.abs(((u * 6) % 1) - 0.5);
      const r = clamp(70 + v * 40 + ridge * 80);
      const g = clamp(88 + v * 30 + (1 - ridge) * 40);
      const b = clamp(110 + (1 - v) * 50);
      for (let oy = 0; oy < block && y + oy < h; oy++) {
        for (let ox = 0; ox < block && x + ox < w; ox++) {
          const i = ((y + oy) * w + (x + ox)) * 4;
          img.data[i] = r;
          img.data[i + 1] = g;
          img.data[i + 2] = b;
          img.data[i + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function makeFog() {
  const s = 128;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(s, s);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = (x + 0.5) / s - 0.5;
      const dy = (y + 0.5) / s - 0.5;
      const d = Math.sqrt(dx * dx + dy * dy) * 2;
      const a = Math.max(0, 1 - d);
      const i = (y * s + x) * 4;
      img.data[i] = 210;
      img.data[i + 1] = 220;
      img.data[i + 2] = 226;
      img.data[i + 3] = Math.round(a * a * 180);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function makeHero() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 96;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, 64, 96);
  ctx.fillStyle = "#f4f1ea";
  ctx.beginPath();
  ctx.ellipse(32, 58, 16, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(32, 24, 12, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

function clamp(v) {
  return Math.max(0, Math.min(255, v | 0));
}

function texFromCanvas(gl, canvas, filter) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  return tex;
}

function makeTarget(gl, w, h) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  const depth = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, tex };
}

const VS = `#version 300 es
in vec3 aPos;
in vec2 aUv;
uniform mat4 uMvp;
out vec2 vUv;
void main() {
  gl_Position = uMvp * vec4(aPos, 1.0);
  vUv = aUv;
}`;

const FS = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec4 uTint;
uniform float uIdMode;
uniform float uId;
uniform float uCut;
uniform float uKeepAlpha;
out vec4 outColor;
void main() {
  vec4 c = texture(uTex, vUv) * uTint;
  if (c.a < uCut) discard;
  if (uIdMode > 0.5) {
    if (uId < 0.5) discard;
    outColor = vec4(uId / 255.0, 0.0, 0.0, 1.0);
  }
  else if (uKeepAlpha > 0.5) outColor = c;
  else outColor = vec4(c.rgb, 1.0);
}`;

function program(gl, vs, fs) {
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, shader(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  return prog;
}

function shader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
  return sh;
}

function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

function lookAt(eye, target, up) {
  const z = norm([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]);
  const x = norm(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
  ]);
}

function mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return o;
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function norm(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

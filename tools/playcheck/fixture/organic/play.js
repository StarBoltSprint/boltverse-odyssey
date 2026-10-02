/**
 * TEST FIXTURE - not Imagine.
 * Synthetic organic zone for tools/playcheck. Flat ID colours. Shape only.
 * Nothing here is a play-view pixel. Query ?fixture=discover|boundary|pop
 * (default pass). ?debug=1 installs window.__play.
 * Speed is 6 m/s so a 1/30 s step stays inside the 0.5 m boundary gap.
 */
(async () => {
  const params = new URLSearchParams(location.search);
  const debug = params.has("debug");
  const fixture = params.get("fixture") || "pass";
  const layout = await (await fetch("clearing.json")).json();
  const canvas = document.getElementById("view");
  const hud = document.getElementById("hud");
  const ctx = canvas.getContext("2d", { alpha: false });

  const ID_W = 180;
  const ID_H = 400;
  const SPEED = 6;
  const HERO_R = 0.2;
  const TURN = 240;
  const footprint = layout.zone.footprint.map((p) => [p[0], p[1]]);
  const pieces = layout.boundary.pieces.map((p) => ({
    id: p.id,
    x: p.position[0],
    z: p.position[1],
    radius: p.radius_m,
  }));
  const gateSrc = layout.gates[0];
  const gate = {
    id: gateSrc.id,
    label: `gate:${gateSrc.id}`,
    x: gateSrc.position[0],
    z: gateSrc.position[1],
  };
  const pois = layout.pois.map((p) => ({
    id: p.id,
    intent: p.intent,
    x: p.position[0],
    z: p.position[1],
  }));
  const spawn = layout.spawn.position;

  const labels = ["", "hero", "fog", gate.label, "poi-mark", "poi-hide-a", "poi-hide-b", "pop-target"];
  const idOf = new Map(labels.map((label, i) => [label, i]));
  for (const piece of pieces) {
    labels.push(piece.id);
    idOf.set(piece.id, labels.length - 1);
  }
  const ids = new Uint16Array(ID_W * ID_H);

  const CELLS = {
    resident: 2,
    total: 4,
    triVisible: 12000,
    lod: { lod0: 3, lod1: 1, lod2: 2 },
    cellLoad_ms_max: 4,
    texMB_peak: 11,
  };

  const sim = {
    x: spawn[0],
    z: spawn[1],
    hdg: 0,
    spd: 0,
    state: "IDLE",
    blocked: false,
    pathTrigger: false,
    input: { forward: 0, turn: 0, gallop: false },
  };
  let snapN = 0;

  if (window.__perf) {
    window.__perf.noteTexture("fixture-plate", 1024 * 1024 * 4);
    window.__perf.noteDraw(4);
  }

  function resize() {
    const dpr = window.devicePixelRatio || 2;
    const w = Math.round((canvas.clientWidth || 360) * dpr);
    const h = Math.round((canvas.clientHeight || 800) * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function wrap(a) {
    a %= 360;
    if (a < 0) a += 360;
    return a;
  }

  function wrap180(a) {
    const x = wrap(a);
    return x > 180 ? x - 360 : x;
  }

  function inside(x, z) {
    let inn = false;
    for (let i = 0, j = footprint.length - 1; i < footprint.length; j = i++) {
      const xi = footprint[i][0];
      const zi = footprint[i][1];
      const xj = footprint[j][0];
      const zj = footprint[j][1];
      const cross = zi > z !== zj > z;
      if (cross && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inn = !inn;
    }
    return inn;
  }

  function trapHit(x, z) {
    if (fixture !== "boundary") return false;
    return z < 1.35 && z > 0.4 && x > 5 && x < 15;
  }

  function pieceHit(x, z) {
    for (const piece of pieces) {
      if (Math.hypot(x - piece.x, z - piece.z) < piece.radius + HERO_R) return true;
    }
    return false;
  }

  function canOccupy(x, z) {
    if (trapHit(x, z) || pieceHit(x, z)) return false;
    if (inside(x, z)) return true;
    return x >= 16 && x <= 24 && z >= -6 && z <= 1;
  }

  function viewVec(ox, oz) {
    const rad = (sim.hdg * Math.PI) / 180;
    const dx = ox - sim.x;
    const dz = oz - sim.z;
    return {
      forward: Math.sin(rad) * dx + Math.cos(rad) * dz,
      right: Math.cos(rad) * dx - Math.sin(rad) * dz,
      dist: Math.hypot(dx, dz),
    };
  }

  function nearestAhead() {
    let best = null;
    for (const piece of pieces) {
      const v = viewVec(piece.x, piece.z);
      if (v.forward < 0.15 || Math.abs(v.right) > 3) continue;
      if (!best || v.forward < best.forward) best = { piece, forward: v.forward };
    }
    return best;
  }

  function stamp(ix, iy, iw, ih, label, color) {
    const idx = idOf.get(label);
    if (idx == null) return;
    const x0 = Math.max(0, ix);
    const y0 = Math.max(0, iy);
    const x1 = Math.min(ID_W, ix + iw);
    const y1 = Math.min(ID_H, iy + ih);
    for (let y = y0; y < y1; y++) ids.fill(idx, y * ID_W + x0, y * ID_W + x1);
    const sx = (x0 * canvas.width) / ID_W;
    const sy = (y0 * canvas.height) / ID_H;
    const sw = ((x1 - x0) * canvas.width) / ID_W;
    const sh = ((y1 - y0) * canvas.height) / ID_H;
    ctx.fillStyle = color;
    ctx.fillRect(sx, sy, sw, sh);
  }

  function paint(popping) {
    resize();
    ids.fill(0);
    ctx.fillStyle = "#aca080";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#beccd6";
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.34);
    stamp(0, 148, ID_W, 6, "fog", "#60768a");
    if (inside(sim.x, sim.z) || fixture === "discover") stamp(70, 8, 40, 30, "poi-mark", "#d24830");
    for (const poi of pois) {
      if (poi.intent !== "hidden_from_spawn") continue;
      const near = Math.hypot(poi.x - sim.x, poi.z - sim.z) < 8;
      if (fixture !== "discover" && !near) continue;
      const y = poi.id === "poi-hide-b" ? 42 : 8;
      stamp(6, y, 36, 28, poi.id, poi.id === "poi-hide-b" ? "#30a860" : "#ba30a8");
    }
    const popSmall = !!popping;
    stamp(140, 8, popSmall ? 4 : 32, popSmall ? 4 : 36, "pop-target", "#5060b0");
    const ahead = nearestAhead();
    if (ahead) stamp(64, 144, 52, 80, ahead.piece.id, "#785840");
    const aim = (Math.atan2(gate.x - sim.x, gate.z - sim.z) * 180) / Math.PI;
    const faceGate = Math.abs(wrap180(aim - sim.hdg)) < 18;
    const gateDist = Math.hypot(gate.x - sim.x, gate.z - sim.z);
    if (faceGate && gateDist < 30 && (!ahead || ahead.forward > 1.5)) {
      stamp(58, 96, 64, 90, gate.label, "#309cb0");
    }
    stamp(84, 350, 12, 14, "hero", "#e65046");
  }

  function encodeIds() {
    const bytes = new Uint8Array(ids.buffer, ids.byteOffset, ids.byteLength);
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return { width: ID_W, height: ID_H, labels, b64: btoa(bin) };
  }

  function gateHud() {
    const dx = gate.x - sim.x;
    const dz = gate.z - sim.z;
    const aim = (Math.atan2(dx, dz) * 180) / Math.PI;
    return {
      id: gate.id,
      bearing_deg: wrap180(aim - sim.hdg),
      dist_m: Math.hypot(dx, dz),
    };
  }

  function pose() {
    return {
      x: sim.x,
      z: sim.z,
      hdg: sim.hdg,
      spd: sim.spd,
      state: sim.state,
      blocked: sim.blocked,
      pathTrigger: sim.pathTrigger,
    };
  }

  function snapshot() {
    snapN += 1;
    const popping = fixture === "pop" && snapN === 48;
    paint(popping);
    const popArea = popping ? 100 : 8000;
    hud.textContent = `TEST FIXTURE - not Imagine\n${fixture}  ${sim.state}  ${sim.spd.toFixed(2)} m/s`;
    return {
      ...pose(),
      harness: true,
      fixture,
      heroCount: 1,
      mag: 0.8,
      magSources: { ground: 0.8, backdrop: 0.4 },
      canvas: { width: canvas.width, height: canvas.height },
      gate: gateHud(),
      nearestVisibleM: 4,
      backdrop: { sourceW: 8192, sourceH: 1024, screenW: canvas.width, screenH: 400, fovDeg: 50 },
      cells: CELLS,
      areas: { "pop-target": popArea, hero: 400 },
      frustum: ["pop-target", "hero"],
      objectIds: encodeIds(),
      perf: window.__perf ? window.__perf.snapshot() : undefined,
    };
  }

  function step(dt) {
    const turn = Number(sim.input.turn) || 0;
    if (turn) sim.hdg = wrap(sim.hdg + turn * TURN * dt);
    const forward = Number(sim.input.forward) || 0;
    if (forward > 0) {
      const rad = (sim.hdg * Math.PI) / 180;
      const nx = sim.x + Math.sin(rad) * SPEED * dt * forward;
      const nz = sim.z + Math.cos(rad) * SPEED * dt * forward;
      if (canOccupy(nx, nz)) {
        sim.x = nx;
        sim.z = nz;
        sim.spd = SPEED * forward;
        sim.blocked = false;
      } else {
        sim.spd = 0;
        sim.blocked = true;
      }
    } else {
      sim.spd = 0;
    }
    if (sim.spd >= 0.5) sim.state = "GALLOP";
    else if (sim.spd <= 0.05) sim.state = "IDLE";
    if (sim.x >= 16 && sim.x <= 24 && sim.z <= 0.6 && sim.z >= -6) sim.pathTrigger = true;
  }

  paint();
  if (debug) {
    window.__play = {
      version: 1,
      ready: true,
      harness: true,
      reset() {
        sim.x = spawn[0];
        sim.z = spawn[1];
        sim.hdg = 0;
        sim.spd = 0;
        sim.state = "IDLE";
        sim.blocked = false;
        sim.pathTrigger = false;
        sim.input = { forward: 0, turn: 0, gallop: false };
        snapN = 0;
        paint();
      },
      look(heading) {
        sim.hdg = wrap(heading);
      },
      setInput(input) {
        sim.input.forward = Number(input.forward) || 0;
        sim.input.turn = Number(input.turn) || 0;
        sim.input.gallop = !!input.gallop;
      },
      tick(dt) {
        const t0 = performance.now();
        step(dt);
        paint();
        if (window.__perf) window.__perf.noteFrame({ dtMs: dt * 1000, workMs: performance.now() - t0 });
        return pose();
      },
      snapshot,
    };
  }
})();

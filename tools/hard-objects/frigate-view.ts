import * as THREE from "three";
import { mountFrigate } from "./frigate";

export type FaceId = "port" | "stbd" | "bow" | "stern" | "top" | "belly";

export type FrigateView = {
  go: (face: FaceId) => void;
  tour: () => void;
  pose: (theta: number, phi: number, dist: number) => void;
  look: (theta: number, phi: number, dist: number, focus: { x: number; y: number; z: number }) => void;
  step: (dt: number) => void;
  freeze: () => void;
  destroy: () => void;
};

const LOOK = new THREE.Vector3(0, 3, 0);

const FACES: Record<FaceId, { theta: number; phi: number }> = {
  port: { theta: Math.PI / 2, phi: 0.16 },
  stbd: { theta: -Math.PI / 2, phi: 0.16 },
  bow: { theta: 0, phi: 0.12 },
  stern: { theta: Math.PI, phi: 0.1 },
  top: { theta: Math.PI / 2, phi: 1.15 },
  belly: { theta: Math.PI / 2, phi: -1.05 },
};

const TPU = 10.1;

const viewDir = (th: number, ph: number) => {
  const cp = Math.cos(ph);
  return new THREE.Vector3(-cp * Math.cos(th), -Math.sin(ph), -cp * Math.sin(th));
};

const wantedUp = (th: number, ph: number) => {
  const vd = viewDir(th, ph);
  const xPerp = new THREE.Vector3(1, 0, 0).addScaledVector(vd, -vd.x);
  const plen = Math.min(1, xPerp.length());
  if (plen > 1e-6) xPerp.multiplyScalar(1 / Math.max(1e-6, xPerp.length()));
  else xPerp.set(0, 1, 0);
  const s = plen * plen * (3 - 2 * plen);
  const up = new THREE.Vector3(0, 1, 0).lerp(xPerp, s);
  if (up.lengthSq() < 1e-8) up.set(0, 1, 0);
  return up.normalize();
};

const framed = (camera: THREE.PerspectiveCamera, th: number, ph: number, up: THREE.Vector3) => {
  const hx = 120;
  const hy = 34;
  const hz = 28;
  const cp = Math.cos(ph);
  const sp = Math.sin(ph);
  const ct = Math.cos(th);
  const st = Math.sin(th);
  const fx = -cp * ct;
  const fy = -sp;
  const fz = -cp * st;
  let rx = fy * up.z - fz * up.y;
  let ry = fz * up.x - fx * up.z;
  let rz = fx * up.y - fy * up.x;
  const rl = Math.hypot(rx, ry, rz) || 1;
  rx /= rl;
  ry /= rl;
  rz /= rl;
  let maxR = 1;
  let maxU = 1;
  for (const x of [-hx, hx]) {
    for (const y of [-hy, hy]) {
      for (const z of [-hz, hz]) {
        maxR = Math.max(maxR, Math.abs(x * rx + y * ry + z * rz));
        maxU = Math.max(maxU, Math.abs(x * up.x + y * up.y + z * up.z));
      }
    }
  }
  const v = (camera.fov * Math.PI) / 180;
  const h = 2 * Math.atan(Math.tan(v / 2) * Math.max(0.2, camera.aspect));
  return Math.max(maxU / Math.tan(v / 2), maxR / Math.tan(h / 2)) * 1.16;
};

export function mountFrigateView(canvas: HTMLCanvasElement): FrigateView {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const mobile = window.matchMedia("(max-width: 800px)").matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, 0.4, 5000);
  const backdropTex = new THREE.TextureLoader().load("/biome/frigate/backdrop.jpg", () => fitBackdrop());
  backdropTex.colorSpace = THREE.SRGBColorSpace;
  backdropTex.magFilter = THREE.LinearFilter;
  backdropTex.minFilter = THREE.LinearMipmapLinearFilter;
  backdropTex.generateMipmaps = true;
  backdropTex.wrapS = THREE.ClampToEdgeWrapping;
  backdropTex.wrapT = THREE.ClampToEdgeWrapping;
  const backdropMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({ map: backdropTex, toneMapped: false, depthTest: false, depthWrite: false }),
  );
  backdropMesh.frustumCulled = false;
  backdropMesh.renderOrder = -1;
  backdropMesh.position.set(0, 0, -1);
  camera.add(backdropMesh);
  scene.add(camera);
  const bars: THREE.Mesh[] = [];
  const clearBars = () => {
    for (const bar of bars) {
      camera.remove(bar);
      bar.geometry.dispose();
    }
    bars.length = 0;
  };
  const addBar = (x: number, y: number, w: number, h: number, u0: number, v0: number, u1: number, v1: number) => {
    const geo = new THREE.PlaneGeometry(2, 2);
    const uv = geo.attributes.uv;
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, pos.getX(i) < 0 ? u0 : u1, pos.getY(i) < 0 ? v0 : v1);
    }
    const bar = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ map: backdropTex, toneMapped: false, depthTest: false, depthWrite: false }),
    );
    bar.frustumCulled = false;
    bar.renderOrder = -1;
    bar.position.set(x, y, -1);
    bar.scale.set(w / 2, h / 2, 1);
    camera.add(bar);
    bars.push(bar);
  };
  const upNow = new THREE.Vector3(0, 1, 0);
  const upWant = new THREE.Vector3(0, 1, 0);
  const minDist = () => {
    const v = (camera.fov * Math.PI) / 180;
    const viewH = Math.max(1, renderer.domElement.height || 1);
    const viewW = Math.max(1, renderer.domElement.width || 1);
    const tanV = Math.tan(v / 2);
    const tanH = tanV * Math.max(0.2, camera.aspect);
    return Math.max(viewH / (2 * tanV * TPU), viewW / (2 * tanH * TPU));
  };
  const frameAt = (th: number, ph: number, up: THREE.Vector3) => Math.max(minDist(), framed(camera, th, ph, up));
  const fitBackdrop = () => {
    const img = backdropTex.image as { width?: number; height?: number } | undefined;
    const imgW = img?.width || 1280;
    const imgH = img?.height || 1728;
    const viewW = Math.max(1, renderer.domElement.width || 1);
    const viewH = Math.max(1, renderer.domElement.height || 1);
    const cover = Math.max(viewW / imgW, viewH / imgH);
    const visH = 2 * Math.tan((camera.fov * Math.PI) / 180 / 2);
    const visW = visH * camera.aspect;
    clearBars();
    if (cover <= 1) {
      const rx = viewW / cover / imgW;
      const ry = viewH / cover / imgH;
      backdropTex.repeat.set(rx, ry);
      backdropTex.offset.set(0.5 - rx * 0.5, 0.5 - ry * 0.5);
      backdropMesh.scale.set(visW / 2, visH / 2, 1);
      return;
    }
    backdropTex.repeat.set(1, 1);
    backdropTex.offset.set(0, 0);
    const sx = (imgW / viewW) * (visW / 2);
    const sy = (imgH / viewH) * (visH / 2);
    backdropMesh.scale.set(sx, sy, 1);
    const marginX = Math.max(0, (visW - sx * 2) / 2);
    const marginY = Math.max(0, (visH - sy * 2) / 2);
    const fillRect = (x0: number, y0: number, x1: number, y1: number) => {
      const w = x1 - x0;
      const h = y1 - y0;
      if (w < 1e-4 || h < 1e-4) return;
      const pxW = (w / visW) * viewW;
      const pxH = (h / visH) * viewH;
      const band = 64;
      const nx = Math.max(1, Math.ceil(pxW / band));
      const ny = Math.max(1, Math.ceil(pxH / band));
      const pw = w / nx;
      const ph = h / ny;
      const du = band / imgW;
      const dv = band / imgH;
      for (let iy = 0; iy < ny; iy++) {
        for (let ix = 0; ix < nx; ix++) {
          const u0 = 0.28 + (ix % 5) * 0.08;
          const v0 = 0.28 + (iy % 5) * 0.08;
          addBar(x0 + pw * (ix + 0.5), y0 + ph * (iy + 0.5), pw, ph, u0, v0, Math.min(0.94, u0 + du), Math.min(0.94, v0 + dv));
        }
      }
    };
    if (marginX > 1e-4) {
      fillRect(-sx - marginX, -visH / 2, -sx, visH / 2);
      fillRect(sx, -visH / 2, sx + marginX, visH / 2);
    }
    if (marginY > 1e-4) {
      fillRect(-sx, sy, sx, sy + marginY);
      fillRect(-sx, -sy - marginY, sx, -sy);
    }
  };
  void mountFrigate(scene, { x: 0, y: 0, z: 0, yaw: 0 });

  let theta = FACES.port.theta;
  let phi = FACES.port.phi;
  let dist = 400;
  let targetTheta = theta;
  let targetPhi = phi;
  let targetDist = dist;
  let touring = false;
  let tourLeft = 0;
  let alive = true;
  let zoomed = false;

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    fitBackdrop();
  };
  resize();
  upNow.copy(wantedUp(theta, phi));
  dist = targetDist = frameAt(theta, phi, upNow);

  const apply = () => {
    const cp = Math.cos(phi);
    camera.up.copy(upNow);
    camera.position.set(
      LOOK.x + dist * cp * Math.cos(theta),
      LOOK.y + dist * Math.sin(phi),
      LOOK.z + dist * cp * Math.sin(theta),
    );
    camera.lookAt(LOOK);
  };
  apply();

  const pointers = new Map<number, { x: number; y: number }>();
  let pinch = 0;

  const onDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement | null)?.closest("[data-ui]")) return;
    touring = false;
    canvas.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const onMove = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    prev.x = e.clientX;
    prev.y = e.clientY;
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch > 8) {
        zoomed = true;
        const cap = frameAt(theta, phi, upNow);
        targetDist = Math.min(cap * 2.4, Math.max(minDist(), targetDist * (pinch / d)));
        dist = targetDist;
      }
      pinch = d;
      return;
    }
    theta -= dx * 0.0075;
    phi = Math.max(-1.15, Math.min(1.25, phi - dy * 0.006));
    targetTheta = theta;
    targetPhi = phi;
  };
  const onUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    pinch = 0;
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    touring = false;
    zoomed = true;
    targetDist = Math.min(frameAt(theta, phi, upNow) * 2.4, Math.max(minDist(), targetDist * (e.deltaY > 0 ? 1.08 : 0.92)));
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("resize", resize);

  let frozen = false;
  let raf = 0;
  let last = performance.now();
  const advance = (dt: number) => {
    if (touring) {
      const step = dt * 0.45;
      theta += step;
      tourLeft -= step;
      targetTheta = theta;
      phi += (0.32 - phi) * Math.min(1, dt * 3);
      targetPhi = phi;
      if (tourLeft <= 0) touring = false;
    } else {
      let d = targetTheta - theta;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      theta += d * Math.min(1, dt * 7);
      phi += (targetPhi - phi) * Math.min(1, dt * 7);
    }
    upWant.copy(wantedUp(theta, phi));
    upNow.lerp(upWant, 1 - Math.exp(-dt * 2.2));
    if (upNow.lengthSq() > 1e-8) upNow.normalize();
    if (!zoomed) targetDist = frameAt(theta, phi, upNow);
    else targetDist = Math.max(minDist(), targetDist);
    dist += (targetDist - dist) * Math.min(1, dt * 6);
    dist = Math.max(minDist(), dist);
    apply();
    renderer.render(scene, camera);
  };
  const tick = (now: number) => {
    if (!alive || frozen) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    advance(dt);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  const api: FrigateView = {
    go(face) {
      touring = false;
      zoomed = false;
      const pose = FACES[face];
      targetTheta = pose.theta;
      targetPhi = pose.phi;
    },
    tour() {
      touring = true;
      zoomed = false;
      tourLeft = Math.PI * 2;
    },
    pose(nextTheta, nextPhi, nextDist) {
      touring = false;
      zoomed = true;
      targetTheta = nextTheta;
      targetPhi = Math.max(-1.15, Math.min(1.25, nextPhi));
      targetDist = Math.max(minDist(), nextDist);
      LOOK.set(0, 3, 0);
    },
    look(nextTheta: number, nextPhi: number, nextDist: number, focus: { x: number; y: number; z: number }) {
      touring = false;
      zoomed = true;
      targetTheta = nextTheta;
      targetPhi = Math.max(-1.15, Math.min(1.25, nextPhi));
      targetDist = Math.max(minDist(), nextDist);
      LOOK.set(focus.x, focus.y, focus.z);
    },
    step(dt: number) {
      frozen = true;
      cancelAnimationFrame(raf);
      advance(dt);
    },
    freeze() {
      frozen = true;
      cancelAnimationFrame(raf);
    },
    destroy() {
      alive = false;
      const holder = window as unknown as { __howl?: FrigateView };
      if (holder.__howl === api) delete holder.__howl;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", resize);
      clearBars();
      renderer.dispose();
    },
  };
  (window as unknown as { __howl?: FrigateView }).__howl = api;
  return api;
}

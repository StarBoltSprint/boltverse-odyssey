import * as THREE from "three";
import { mountFrigate } from "./frigate";

export type FaceId = "port" | "stbd" | "bow" | "stern" | "top" | "belly";

export type FrigateView = {
  go: (face: FaceId) => void;
  tour: () => void;
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

const lengthUp = (aspect: number, th: number, ph: number) =>
  aspect < 0.92 && Math.abs(Math.cos(th) * Math.cos(ph)) < 0.62;

const framed = (camera: THREE.PerspectiveCamera, th: number, ph: number) => {
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
  const upX = lengthUp(camera.aspect, th, ph);
  const ux = upX ? 1 : 0;
  const uy = upX ? 0 : 1;
  let rx = fy * 0 - fz * uy;
  let ry = fz * ux - fx * 0;
  let rz = fx * uy - fy * ux;
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
        maxU = Math.max(maxU, Math.abs(x * ux + y * uy));
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
  });
  renderer.setClearColor(0x000000, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const mobile = window.matchMedia("(max-width: 800px)").matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, 0.4, 5000);
  scene.add(camera);
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
  };
  resize();
  dist = targetDist = framed(camera, theta, phi);

  const apply = () => {
    const cp = Math.cos(phi);
    camera.up.set(lengthUp(camera.aspect, theta, phi) ? 1 : 0, lengthUp(camera.aspect, theta, phi) ? 0 : 1, 0);
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
        const cap = framed(camera, theta, phi);
        targetDist = Math.min(cap * 2.4, Math.max(14, targetDist * (pinch / d)));
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
    targetDist = Math.min(framed(camera, theta, phi) * 2.4, Math.max(14, targetDist * (e.deltaY > 0 ? 1.08 : 0.92)));
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("resize", resize);

  let last = performance.now();
  let raf = 0;
  const tick = (now: number) => {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
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
    if (!zoomed) targetDist = framed(camera, theta, phi);
    dist += (targetDist - dist) * Math.min(1, dt * 6);
    apply();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    go(face) {
      touring = false;
      zoomed = false;
      const pose = FACES[face];
      targetTheta = pose.theta;
      targetPhi = pose.phi;
      targetDist = framed(camera, pose.theta, pose.phi);
    },
    tour() {
      touring = true;
      zoomed = false;
      tourLeft = Math.PI * 2;
      targetDist = framed(camera, theta, phi);
    },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", resize);
      renderer.dispose();
    },
  };
}

import { useEffect, useRef, type PointerEvent, type RefObject, type WheelEvent } from "react";
import * as THREE from "three";
import { chaseDesired, stepFlight, type Flight } from "@/ship/flight";
import {
  HULL,
  WING,
  loftHull,
  nozzleGeometry,
  plumeGeometry,
  wingGeometry,
} from "@/ship/geo";

type ViewCmd = {
  id: number;
  pos: [number, number, number];
  target: [number, number, number];
};

type SoftProps = {
  flight: Flight;
  cut: number;
  explode: number;
  wire: boolean;
  voidSpace: boolean;
  view: ViewCmd | null;
  speedRef: RefObject<HTMLSpanElement | null>;
  yawRef: RefObject<HTMLSpanElement | null>;
};

type Part = {
  pos: Float32Array;
  nrm: Float32Array;
  idx: ArrayLike<number>;
  color: [number, number, number];
  alpha: number;
  base: THREE.Matrix4;
  explode: THREE.Vector3;
  needsCut: boolean;
  cull: boolean;
};

const LIGHT = new THREE.Vector3(12, 16, 8).normalize();
const HALF = new THREE.Vector3().addVectors(LIGHT, new THREE.Vector3(0, 0.2, 1)).normalize();
const CAM_HOME = new THREE.Vector3(14, 5.2, 20);
const TARGET_HOME = new THREE.Vector3(0, 0.15, 0.4);

function partFrom(
  geo: THREE.BufferGeometry,
  color: [number, number, number],
  alpha: number,
  place: (m: THREE.Matrix4) => void,
  explode: [number, number, number],
  needsCut = false,
  cull = true,
): Part {
  const posAttr = geo.getAttribute("position");
  const nrmAttr = geo.getAttribute("normal");
  if (!nrmAttr) geo.computeVertexNormals();
  const nrm = (geo.getAttribute("normal").array as Float32Array).slice();
  const pos = (posAttr.array as Float32Array).slice();
  const index = geo.getIndex();
  const idx = index ? index.array : seq(pos.length / 3);
  const base = new THREE.Matrix4();
  place(base);
  return { pos, nrm, idx, color, alpha, base, explode: new THREE.Vector3(...explode), needsCut, cull };
}

function seq(n: number) {
  const out = new Uint32Array(n);
  for (let i = 0; i < n; i += 1) out[i] = i;
  return out;
}

function cylinder(r0: number, r1: number, len: number) {
  const g = new THREE.CylinderGeometry(r0, r1, len, 18);
  g.rotateX(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

function buildParts(): Part[] {
  const hull = loftHull(HULL, 48, 0.22);
  const innerStations = HULL.slice(1, -1).map((s) => ({ z: s.z, rx: s.rx * 0.72, ry: s.ry * 0.7 }));
  const inner = loftHull(innerStations, 32, 0.16);
  const wing = wingGeometry(WING, 10);
  const wingMirror = wing.clone();
  wingMirror.scale(-1, 1, 1);
  wingMirror.computeVertexNormals();
  const nozzle = nozzleGeometry();
  const plume = plumeGeometry();
  const bridge = new THREE.SphereGeometry(1, 24, 16);
  bridge.scale(0.5, 0.18, 1.5);
  const glass = new THREE.SphereGeometry(1, 20, 14);
  glass.scale(0.4, 0.15, 1.28);
  const id = (m: THREE.Matrix4) => m.identity();
  const at =
    (x: number, y: number, z: number, s = 1) =>
    (m: THREE.Matrix4) => {
      m.makeScale(s, s, s);
      m.setPosition(x, y, z);
    };

  const nacelle = (x: number, y: number, z: number, s: number, ex: [number, number, number]): Part[] => {
    const body = cylinder(0.34, 0.3, 2.1);
    const bell = nozzle.clone();
    const flame = plume.clone();
    return [
      partFrom(body, [62, 69, 77], 1, at(x, y, z - 0.55 * s, s), ex),
      partFrom(bell, [106, 114, 123], 1, at(x, y, z + 0.55 * s, s), ex),
      partFrom(flame, [247, 249, 252], 0.55, at(x, y, z + 1.15 * s, s), ex, false, false),
    ];
  };

  return [
    partFrom(hull, [214, 220, 226], 1, id, [0, 0, 0]),
    partFrom(inner, [36, 38, 42], 1, id, [0, 0, 0], true),
    partFrom(wing, [196, 204, 212], 1, id, [2.4, -0.2, 0.3]),
    partFrom(wingMirror, [196, 204, 212], 1, id, [-2.4, -0.2, 0.3]),
    ...nacelle(1.45, -0.12, 6.15, 1, [2.4, -0.2, 0.3]),
    ...nacelle(-1.45, -0.12, 6.15, 1, [-2.4, -0.2, 0.3]),
    ...nacelle(0, 0.08, 7.55, 0.72, [0, 0.15, 1.5]),
    partFrom(bridge, [141, 149, 158], 1, at(0, 0.62, -3.2), [0, 0, 0]),
    partFrom(glass, [168, 186, 204], 0.55, at(0, 0.7, -3.2), [0, 0.85, 0]),
  ];
}

const PARTS = buildParts();

type Tri = {
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
  cx: number;
  cy: number;
  cz: number;
  r: number;
  g: number;
  b: number;
  alpha: number;
};

export default function SoftHull({
  flight,
  cut,
  explode,
  wire,
  voidSpace,
  view,
  speedRef,
  yawRef,
}: SoftProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cutRef = useRef(cut);
  const explodeRef = useRef(explode);
  const wireRef = useRef(wire);
  const voidRef = useRef(voidSpace);
  const viewRef = useRef(view);
  const cam = useRef(CAM_HOME.clone());
  const look = useRef(TARGET_HOME.clone());
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const seen = useRef(0);
  cutRef.current = cut;
  explodeRef.current = explode;
  wireRef.current = wire;
  voidRef.current = voidSpace;
  viewRef.current = view;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!flight.piloting) return;
      flight.keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => flight.keys.delete(e.code);
    const blur = () => {
      if (flight.steerOverride === null) flight.keys.clear();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [flight]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    const normalMatrix = new THREE.Matrix3();
    const worldM = new THREE.Matrix4();
    const partM = new THREE.Matrix4();
    const euler = new THREE.Euler(0, 0, 0, "YXZ");
    const quat = new THREE.Quaternion();
    const bankEuler = new THREE.Euler(0, 0, 0, "XYZ");
    const bankQuat = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    const zero = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    const fwd = new THREE.Vector3();
    const desired = new THREE.Vector3();
    const chaseLook = new THREE.Vector3();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const stars = Array.from({ length: 180 }, () => ({
      x: Math.random(),
      y: Math.random(),
      s: Math.random() * 1.4 + 0.3,
    }));
    let frame = 0;
    let lastT = performance.now();

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const dt = Math.min((now - lastT) / 1000, 0.1);
      lastT = now;
      stepFlight(flight, dt);

      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const hangar = !voidRef.current && !flight.piloting;
      ctx.fillStyle = hangar ? "#101114" : "#07080b";
      ctx.fillRect(0, 0, w, h);
      if (!hangar) {
        ctx.fillStyle = "#d5dae2";
        for (const s of stars) {
          ctx.fillRect(s.x * w, s.y * h, s.s, s.s);
        }
      }

      if (flight.piloting) {
        chaseDesired(flight, desired, chaseLook);
        if (flight.snapCam) {
          cam.current.copy(desired);
          flight.snapCam = false;
        } else {
          cam.current.lerp(desired, 1 - Math.exp(-4.5 * dt));
        }
        look.current.copy(chaseLook);
      } else if (flight.recenter) {
        cam.current.copy(CAM_HOME);
        look.current.copy(TARGET_HOME);
        flight.recenter = false;
      }
      const nextView = viewRef.current;
      if (!flight.piloting && nextView && nextView.id !== seen.current) {
        cam.current.set(nextView.pos[0], nextView.pos[1], nextView.pos[2]);
        look.current.set(nextView.target[0], nextView.target[1], nextView.target[2]);
        seen.current = nextView.id;
      }

      fwd.copy(look.current).sub(cam.current);
      if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
      fwd.normalize();
      right.crossVectors(fwd, worldUp);
      if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
      right.normalize();
      up.crossVectors(right, fwd).normalize();
      const focal = h / 2 / Math.tan((32 * Math.PI) / 360);

      if (flight.piloting) {
        euler.set(flight.pitch, flight.yaw, 0, "YXZ");
        quat.setFromEuler(euler);
        worldM.compose(flight.pos, quat, one);
        bankEuler.set(0, 0, flight.bank, "XYZ");
        bankQuat.setFromEuler(bankEuler);
        partM.compose(zero, bankQuat, one);
        worldM.multiply(partM);
      } else {
        worldM.identity();
      }

      const clipX = -(22 - cutRef.current * 22.2);
      const spread = explodeRef.current;
      const tris: Tri[] = [];
      const showWire = wireRef.current;

      for (const part of PARTS) {
        if (part.needsCut && cutRef.current < 0.04) continue;
        partM.copy(part.base);
        partM.elements[12] += part.explode.x * spread;
        partM.elements[13] += part.explode.y * spread;
        partM.elements[14] += part.explode.z * spread;
        partM.premultiply(worldM);
        normalMatrix.getNormalMatrix(partM);
        const projected = new Float32Array((part.pos.length / 3) * 4);
        for (let i = 0; i < part.pos.length; i += 3) {
          v.fromArray(part.pos, i).applyMatrix4(partM);
          const dx = v.x - cam.current.x;
          const dy = v.y - cam.current.y;
          const dz = v.z - cam.current.z;
          const cx = dx * right.x + dy * right.y + dz * right.z;
          const cy = dx * up.x + dy * up.y + dz * up.z;
          const cz = dx * fwd.x + dy * fwd.y + dz * fwd.z;
          const o = (i / 3) * 4;
          projected[o] = cx;
          projected[o + 1] = cy;
          projected[o + 2] = cz;
          projected[o + 3] = v.x;
        }
        for (let t = 0; t < part.idx.length; t += 3) {
          const ia = part.idx[t] * 4;
          const ib = part.idx[t + 1] * 4;
          const ic = part.idx[t + 2] * 4;
          const za = projected[ia + 2];
          const zb = projected[ib + 2];
          const zc = projected[ic + 2];
          if (za < 0.2 || zb < 0.2 || zc < 0.2) continue;
          const wx = (projected[ia + 3] + projected[ib + 3] + projected[ic + 3]) / 3;
          if (wx < clipX) continue;
          const ax = w / 2 + (projected[ia] / za) * focal;
          const ay = h / 2 - (projected[ia + 1] / za) * focal;
          const bx = w / 2 + (projected[ib] / zb) * focal;
          const by = h / 2 - (projected[ib + 1] / zb) * focal;
          const cx = w / 2 + (projected[ic] / zc) * focal;
          const cy = h / 2 - (projected[ic + 1] / zc) * focal;
          if (part.cull && (bx - ax) * (cy - ay) - (by - ay) * (cx - ax) >= 0) continue;
          n.fromArray(part.nrm, part.idx[t] * 3).applyMatrix3(normalMatrix).normalize();
          const lambert = Math.max(0, n.dot(LIGHT));
          const wrap = n.y * 0.5 + 0.5;
          const spec = Math.pow(Math.max(0, n.dot(HALF)), 20);
          const k = showWire ? 0.9 : Math.min(1.05, 0.24 + wrap * 0.22 + lambert * 0.7 + spec * 0.16);
          const r = Math.min(255, (part.color[0] * k) | 0);
          const g = Math.min(255, (part.color[1] * k) | 0);
          const b = Math.min(255, (part.color[2] * k) | 0);
          tris.push({
            ax,
            ay,
            az: za,
            bx,
            by,
            bz: zb,
            cx,
            cy,
            cz: zc,
            r,
            g,
            b,
            alpha: part.alpha,
          });
        }
      }

      if (hangar) {
        ctx.strokeStyle = "#3a3e46";
        ctx.beginPath();
        ctx.ellipse(w / 2, h * 0.72, Math.min(w, h) * 0.28, Math.min(w, h) * 0.08, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      tris.sort((a, b) => b.az + b.bz + b.cz - (a.az + a.bz + a.cz));
      for (const tri of tris) {
        ctx.beginPath();
        ctx.moveTo(tri.ax, tri.ay);
        ctx.lineTo(tri.bx, tri.by);
        ctx.lineTo(tri.cx, tri.cy);
        ctx.closePath();
        ctx.globalAlpha = showWire ? 1 : tri.alpha;
        ctx.strokeStyle = `rgb(${tri.r},${tri.g},${tri.b})`;
        ctx.fillStyle = `rgb(${tri.r},${tri.g},${tri.b})`;
        if (showWire) {
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      if (speedRef.current) speedRef.current.textContent = flight.speed.toFixed(1);
      if (yawRef.current) yawRef.current.textContent = `${Math.round((flight.yaw * 180) / Math.PI)}°`;
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [flight, speedRef, yawRef]);

  const orbitDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (flight.piloting) return;
    dragging.current = true;
    last.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const orbitMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!dragging.current || flight.piloting) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    const offset = cam.current.clone().sub(look.current);
    const sph = new THREE.Spherical().setFromVector3(offset);
    sph.theta -= dx * 0.005;
    sph.phi = Math.min(Math.PI / 2.02, Math.max(0.12, sph.phi + dy * 0.005));
    offset.setFromSpherical(sph);
    cam.current.copy(look.current).add(offset);
  };
  const orbitUp = () => {
    dragging.current = false;
  };
  const zoom = (e: WheelEvent<HTMLCanvasElement>) => {
    if (flight.piloting) return;
    const offset = cam.current.clone().sub(look.current);
    const next = Math.min(42, Math.max(3.2, offset.length() * (1 + e.deltaY * 0.001)));
    offset.setLength(next);
    cam.current.copy(look.current).add(offset);
  };

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full touch-none"
      aria-label="Vaelis survey cruiser"
      onPointerDown={orbitDown}
      onPointerMove={orbitMove}
      onPointerUp={orbitUp}
      onPointerCancel={orbitUp}
      onWheel={zoom}
    />
  );
}

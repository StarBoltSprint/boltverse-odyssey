import * as THREE from "three";

export type Flight = {
  piloting: boolean;
  yaw: number;
  pitch: number;
  bank: number;
  speed: number;
  pos: THREE.Vector3;
  forward: THREE.Vector3;
  keys: Set<string>;
  steerOverride: number | null;
  recenter: boolean;
  snapCam: boolean;
};

export type ControlsProbe = {
  getYaw: () => number;
  getSpeed: () => number;
  setSteer?: (v: number) => void;
  setKeys?: (codes: string[]) => void;
};

declare global {
  interface Window {
    __controlsTest?: ControlsProbe;
  }
}

export function createFlight(): Flight {
  return {
    piloting: false,
    yaw: 0,
    pitch: 0,
    bank: 0,
    speed: 0,
    pos: new THREE.Vector3(),
    forward: new THREE.Vector3(0, 0, -1),
    keys: new Set(),
    steerOverride: null,
    recenter: false,
    snapCam: false,
  };
}

export function resetFlight(f: Flight) {
  f.yaw = 0;
  f.pitch = 0;
  f.bank = 0;
  f.speed = 0;
  f.pos.set(0, 0, 0);
  f.forward.set(0, 0, -1);
  f.keys = new Set();
  f.steerOverride = null;
}

export function attachProbe(f: Flight) {
  window.__controlsTest = {
    getYaw: () => f.yaw,
    getSpeed: () => f.speed,
    setSteer: (v) => {
      f.steerOverride = v;
    },
    setKeys: (codes) => {
      f.keys = new Set(codes);
    },
  };
}

/**
 * Yaw-0 faces world −Z.
 * forward = (−sin yaw, sin pitch, −cos yaw).
 * A / ← adds +yaw so the nose goes left under a chase camera.
 */
export function stepFlight(f: Flight, dtIn: number) {
  if (!f.piloting) return;
  const dt = Math.min(dtIn, 0.1);

  let steer = 0;
  if (f.keys.has("KeyA") || f.keys.has("ArrowLeft")) steer += 1;
  if (f.keys.has("KeyD") || f.keys.has("ArrowRight")) steer -= 1;
  if (f.steerOverride !== null) steer = f.steerOverride;
  steer = Math.max(-1, Math.min(1, steer));

  let thrust = 0;
  if (f.keys.has("KeyW") || f.keys.has("ArrowUp")) thrust += 1;
  if (f.keys.has("KeyS") || f.keys.has("ArrowDown")) thrust -= 1;

  let pitchIn = 0;
  if (f.keys.has("KeyQ")) pitchIn += 1;
  if (f.keys.has("KeyE")) pitchIn -= 1;

  f.speed += thrust * 14 * dt;
  f.speed -= f.speed * 0.35 * dt;
  f.speed = Math.max(-6, Math.min(32, f.speed));

  const speedFactor = Math.min(1, Math.abs(f.speed) / 10);
  const reverse = f.speed >= 0 ? 1 : -1;
  f.yaw += steer * 1.35 * (0.4 + 0.6 * speedFactor) * reverse * dt;

  f.pitch += pitchIn * 0.65 * dt;
  f.pitch = Math.max(-0.65, Math.min(0.65, f.pitch));

  const cp = Math.cos(f.pitch);
  const fx = -Math.sin(f.yaw) * cp;
  const fy = Math.sin(f.pitch);
  const fz = -Math.cos(f.yaw) * cp;
  f.forward.set(fx, fy, fz);
  f.pos.x += fx * f.speed * dt;
  f.pos.y += fy * f.speed * dt;
  f.pos.z += fz * f.speed * dt;
  if (f.pos.y < 0) f.pos.y = 0;

  const targetBank = steer * 0.42;
  f.bank += (targetBank - f.bank) * Math.min(1, dt * 5);
}

export function chaseDesired(f: Flight, cam: THREE.Vector3, look: THREE.Vector3) {
  const dist = 22;
  const height = 4.2;
  cam.copy(f.pos).addScaledVector(f.forward, -dist);
  cam.y += height;
  look.copy(f.pos).addScaledVector(f.forward, 6);
  look.y += 0.35;
}

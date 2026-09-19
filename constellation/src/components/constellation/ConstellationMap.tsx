import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clamp,
  clampCam,
  easeInOutCubic,
  lerp,
  PITCH_MAX,
  projectPersp,
  rotateYawPitch,
  screenToWorld,
  worldTransform,
  zoomAt,
  type Cam,
} from "@/lib/constellation/camera";
import {
  LINKS,
  NODES,
  NODE_BY_ID,
  ORB_HIT_RADIUS,
  panLimit,
  VIDEO_SIZE,
  zoomLimits,
  type NodeId,
  type WorldNode,
} from "@/lib/constellation/world";
import { createImpostorLayer, IMPOSTOR } from "@/lib/constellation/impostor";
import { Starfield, type SkyMotion } from "./Starfield";
import { Button } from "@/components/ui/button";

interface Fly {
  t: number;
  dur: number;
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
}

function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

function fingerAngle(ax: number, ay: number, bx: number, by: number) {
  return Math.atan2(by - ay, bx - ax);
}

type Proj = { x: number; y: number; z: number; s: number };

function projectNodes(yaw: number, pitch: number) {
  const out: Record<string, Proj> = {};
  for (const n of NODES) {
    const r = rotateYawPitch(n.x, n.y, n.z, yaw, pitch);
    out[n.id] = projectPersp(r.x, r.y, r.z);
  }
  return out;
}

function nearestNode(
  cam: Cam,
  proj: Record<string, Proj>,
  current: NodeId,
  vw: number,
  vh: number,
): WorldNode {
  const halfW = (vw * 0.58) / Math.max(cam.zoom, 0.05);
  const halfH = (vh * 0.58) / Math.max(cam.zoom, 0.05);
  let best = NODE_BY_ID[current] ?? NODES[0]!;
  let bestScore = Infinity;
  let any = false;
  for (const n of NODES) {
    const p = proj[n.id] ?? n;
    const vis = IMPOSTOR[n.id].source * VIDEO_SIZE * (p.s ?? 1);
    const dx = Math.abs(p.x - cam.x);
    const dy = Math.abs(p.y - cam.y);
    if (dx > halfW + vis || dy > halfH + vis) continue;
    any = true;
    const d = dist(p.x, p.y, cam.x, cam.y);
    let score = Math.max(d, vis * 0.25) / Math.max(vis, 80);
    if (n.ring === "outer") score *= 1.6;
    if (n.id === current) score *= 0.78;
    if (score < bestScore) {
      bestScore = score;
      best = n;
    }
  }
  if (!any) return NODE_BY_ID[current] ?? NODES[0]!;
  return best;
}

function hitNode(
  wx: number,
  wy: number,
  zoom: number,
  minZ: number,
  maxZ: number,
  proj: Record<string, Proj>,
) {
  let best: WorldNode | null = null;
  let bestD = Infinity;
  for (const n of NODES) {
    if (nodeOpacity(n, zoom, minZ, maxZ) < 0.35) continue;
    const p = proj[n.id] ?? n;
    const d = dist(p.x, p.y, wx, wy);
    const radius = ORB_HIT_RADIUS * (p.s ?? 1);
    if (d < radius && d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

function bootLimits() {
  if (typeof window === "undefined") {
    return { minZ: 0.12, maxZ: 1, vw: 390, vh: 844 };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const { minZ, maxZ } = zoomLimits(vw, vh);
  return { minZ, maxZ, vw, vh };
}

function nodeOpacity(node: WorldNode, zoom: number, minZ: number, maxZ: number) {
  if (node.ring !== "outer") return 1;
  const appear = lerp(minZ, maxZ, 0.38);
  const full = lerp(minZ, maxZ, 0.12);
  return clamp((appear - zoom) / Math.max(appear - full, 0.001), 0, 1);
}

function wrapDelta(d: number) {
  if (d > Math.PI) return d - Math.PI * 2;
  if (d < -Math.PI) return d + Math.PI * 2;
  return d;
}

export function ConstellationMap() {
  const rootRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const threadRefs = useRef<SVGGElement | null>(null);
  const boot = bootLimits();
  const camRef = useRef<Cam>({ x: 0, y: 0, zoom: boot.maxZ });
  const limitsRef = useRef(boot);
  const velRef = useRef({ x: 0, y: 0 });
  const flyRef = useRef<Fly | null>(null);
  const dragRef = useRef<{
    id: number;
    x: number;
    y: number;
    moved: boolean;
    t: number;
  } | null>(null);
  const pinchRef = useRef<{
    d: number;
    cx: number;
    cy: number;
    angle: number;
  } | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const playingRef = useRef(false);
  const immersedIdRef = useRef<string | null>("core");
  const nameRef = useRef<HTMLParagraphElement>(null);
  const epithetRef = useRef<HTMLParagraphElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const lastFocusRef = useRef<NodeId>("core");
  const liveIdRef = useRef<string | null>(null);
  const touchModeRef = useRef(false);
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const yawVelRef = useRef(0);
  const pitchVelRef = useRef(0);
  const projRef = useRef<Record<string, Proj>>({});
  const lineRefs = useRef<Record<string, SVGLineElement | null>>({});
  const spinRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const spanRef = useRef({ minX: -2200, minY: -2200 });
  const nebulaFarRef = useRef<HTMLDivElement>(null);
  const nebulaNearRef = useRef<HTMLDivElement>(null);
  const impostorCanvasRef = useRef<HTMLCanvasElement>(null);
  const impostorRef = useRef<ReturnType<typeof createImpostorLayer>>(null);
  const [hasImpostor, setHasImpostor] = useState(false);
  const motionRef = useRef<SkyMotion>({
    x: 0,
    y: 0,
    yaw: 0,
    pitch: 0,
    flatten: 1,
  });

  const [playing, setPlaying] = useState(false);

  const hideHint = useCallback(() => {
    if (hintRef.current) hintRef.current.style.opacity = "0";
  }, []);

  const setLive = useCallback((id: string | null) => {
    if (liveIdRef.current === id) return;
    const prev = liveIdRef.current;
    liveIdRef.current = id;
    if (prev) {
      const old = videoRefs.current[prev];
      if (old) {
        old.classList.remove("is-live");
        old.pause();
      }
    }
    if (!id || !playingRef.current) return;
    const v = videoRefs.current[id];
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.classList.add("is-live");
    const play = v.play();
    if (play) void play.catch(() => {});
  }, []);

  const apply = useCallback(() => {
    const world = worldRef.current;
    const { vw, vh, minZ, maxZ } = limitsRef.current;
    const cam = camRef.current;
    if (world) {
      world.style.transform = worldTransform(cam, vw, vh);
    }

    const range = Math.max(maxZ - minZ, 0.001);
    const t = clamp((cam.zoom - minZ) / range, 0, 1);
    const flatten = clamp((t - 0.48) / 0.4, 0, 1);
    const yaw = yawRef.current * (1 - flatten);
    const pitch = pitchRef.current * (1 - flatten);
    const proj = projectNodes(yaw, pitch);
    projRef.current = proj;

    const focus = nearestNode(cam, proj, lastFocusRef.current, vw, vh);
    if (lastFocusRef.current !== focus.id) {
      lastFocusRef.current = focus.id;
      if (nameRef.current) nameRef.current.textContent = focus.name;
      if (epithetRef.current) epithetRef.current.textContent = focus.epithet;
    }

    const fp = proj[focus.id] ?? focus;
    const dFocus = dist(fp.x, fp.y, cam.x, cam.y);
    let immersed = immersedIdRef.current;
    if (immersed === focus.id) {
      if (t < 0.78 || dFocus > VIDEO_SIZE * 0.2) immersed = null;
    } else if (t > 0.88 && dFocus < VIDEO_SIZE * 0.12) {
      immersed = focus.id;
    } else {
      immersed = null;
    }
    immersedIdRef.current = immersed;

    const originX = spanRef.current.minX;
    const originY = spanRef.current.minY;

    for (const n of NODES) {
      const el = nodeRefs.current[n.id];
      if (!el) continue;
      const p = proj[n.id]!;
      const o = nodeOpacity(n, cam.zoom, minZ, maxZ);
      el.style.opacity = o < 0.03 ? "0" : String(o);
      el.style.left = `${p.x - VIDEO_SIZE / 2}px`;
      el.style.top = `${p.y - VIDEO_SIZE / 2}px`;
      el.style.transform = `scale(${p.s})`;
      el.style.zIndex = String(Math.round(1800 - p.z));
      el.classList.toggle("is-immersed", n.id === immersed);
      const spin = spinRefs.current[n.id];
      if (spin) {
        const local = flatten > 0.7 ? 0 : Math.sin(yaw) * 8;
        spin.style.transform = `rotateY(${local.toFixed(2)}deg)`;
      }
      const glow = el.querySelector(".node-glow") as HTMLElement | null;
      if (glow) {
        if (flatten > 0.85) {
          glow.style.transform = "translate(0px, 0px)";
        } else {
          const gx = Math.sin(yaw) * 8 + (p.x - cam.x) * 0.003;
          const gy = -Math.sin(pitch) * 6 + (p.y - cam.y) * 0.002;
          glow.style.transform = `translate(${gx.toFixed(1)}px, ${gy.toFixed(1)}px)`;
        }
      }
    }

    for (const [a, b] of LINKS) {
      const line = lineRefs.current[`${a}-${b}`];
      if (!line) continue;
      const pa = proj[a]!;
      const pb = proj[b]!;
      line.setAttribute("x1", String(pa.x - originX));
      line.setAttribute("y1", String(pa.y - originY));
      line.setAttribute("x2", String(pb.x - originX));
      line.setAttribute("y2", String(pb.y - originY));
    }

    if (threadRefs.current) {
      threadRefs.current.style.opacity = String(0.15 + (1 - t) * 0.7);
    }

    motionRef.current.x = cam.x;
    motionRef.current.y = cam.y;
    motionRef.current.yaw = yaw;
    motionRef.current.pitch = pitch;
    motionRef.current.flatten = flatten;

    const skyX = (-cam.x * 0.02 + Math.sin(yaw) * 64) * (1 - flatten * 0.7);
    const skyY = (-cam.y * 0.02 + Math.sin(pitch) * 48) * (1 - flatten * 0.7);
    if (nebulaFarRef.current) {
      nebulaFarRef.current.style.transform = `translate(${skyX * 0.35}px, ${skyY * 0.35}px) scale(1.2)`;
    }
    if (nebulaNearRef.current) {
      nebulaNearRef.current.style.transform = `translate(${skyX * 0.72}px, ${skyY * 0.72}px) scale(1.28)`;
    }

    if (playingRef.current) setLive(focus.id);

    const api = impostorRef.current;
    if (api) {
      api.draw(
        {
          vw,
          vh,
          liveId: liveIdRef.current,
          sprites: NODES.map((n) => {
            const p = proj[n.id]!;
            const d = dist(p.x, p.y, cam.x, cam.y);
            const close = clamp(1 - d / (VIDEO_SIZE * 0.48), 0, 1);
            return {
              id: n.id,
              x: vw / 2 + (p.x - cam.x) * cam.zoom,
              y: vh / 2 + (p.y - cam.y) * cam.zoom,
              z: p.z,
              size: VIDEO_SIZE * cam.zoom * p.s,
              opacity: nodeOpacity(n, cam.zoom, minZ, maxZ),
              yaw,
              pitch,
              lod: close * t,
            };
          }),
        },
        videoRefs.current,
      );
    }
  }, [setLive]);

  const resize = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const { minZ, maxZ } = zoomLimits(vw, vh);
    limitsRef.current = { minZ, maxZ, vw, vh };
    camRef.current.zoom = clamp(camRef.current.zoom, minZ, maxZ);
    apply();
  }, [apply]);

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);

    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const cam = camRef.current;
      const { minZ, maxZ } = limitsRef.current;
      const fly = flyRef.current;
      if (fly) {
        fly.t += dt;
        const u = easeInOutCubic(clamp(fly.t / fly.dur, 0, 1));
        cam.x = lerp(fly.x0, fly.x1, u);
        cam.y = lerp(fly.y0, fly.y1, u);
        cam.zoom = lerp(fly.z0, fly.z1, u);
        if (u >= 1) flyRef.current = null;
      } else if (!dragRef.current && !pinchRef.current) {
        const v = velRef.current;
        cam.x += v.x * dt;
        cam.y += v.y * dt;
        const damp = Math.exp(-4.2 * dt);
        v.x *= damp;
        v.y *= damp;
        if (Math.abs(v.x) + Math.abs(v.y) < 6) {
          v.x = 0;
          v.y = 0;
        }
        yawRef.current += yawVelRef.current * dt;
        pitchRef.current = clamp(
          pitchRef.current + pitchVelRef.current * dt,
          -PITCH_MAX,
          PITCH_MAX,
        );
        const dampR = Math.exp(-3.2 * dt);
        yawVelRef.current *= dampR;
        pitchVelRef.current *= dampR;
        if (Math.abs(yawVelRef.current) < 0.012) yawVelRef.current = 0;
        if (Math.abs(pitchVelRef.current) < 0.012) pitchVelRef.current = 0;
      }
      camRef.current = clampCam(cam, panLimit());
      camRef.current.zoom = clamp(camRef.current.zoom, minZ, maxZ);
      apply();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [apply, resize]);

  const startVideos = useCallback(() => {
    const { vw, vh } = limitsRef.current;
    playingRef.current = true;
    setLive(nearestNode(camRef.current, projRef.current, lastFocusRef.current, vw, vh).id);
  }, [setLive]);

  useEffect(() => {
    const onVis = () => {
      if (!playingRef.current) return;
      if (document.hidden) {
        const live = liveIdRef.current;
        if (live) videoRefs.current[live]?.pause();
      } else {
        const id = liveIdRef.current;
        liveIdRef.current = null;
        if (id) setLive(id);
        else startVideos();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [setLive, startVideos]);

  const flyTo = useCallback((x: number, y: number, zoom: number) => {
    const cam = camRef.current;
    flyRef.current = {
      t: 0,
      dur: 0.85,
      x0: cam.x,
      y0: cam.y,
      z0: cam.zoom,
      x1: x,
      y1: y,
      z1: zoom,
    };
    velRef.current.x = 0;
    velRef.current.y = 0;
    yawVelRef.current = 0;
    pitchVelRef.current = 0;
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "touch" || touchModeRef.current) return;
    if (!playingRef.current) return;
    if ((e.target as HTMLElement).closest("button, a")) return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* some browsers refuse capture */
    }
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    flyRef.current = null;
    if (pointersRef.current.size === 1) {
      dragRef.current = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        moved: false,
        t: performance.now(),
      };
      velRef.current.x = 0;
      velRef.current.y = 0;
    } else if (pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()];
      const a = pts[0]!;
      const b = pts[1]!;
      pinchRef.current = {
        d: dist(a.x, a.y, b.x, b.y),
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
        angle: fingerAngle(a.x, a.y, b.x, b.y),
      };
      dragRef.current = null;
    }
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "touch" || touchModeRef.current) return;
    if (!playingRef.current) return;
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const { vw, vh, minZ, maxZ } = limitsRef.current;

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const pts = [...pointersRef.current.values()];
      const a = pts[0]!;
      const b = pts[1]!;
      const d = dist(a.x, a.y, b.x, b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const angle = fingerAngle(a.x, a.y, b.x, b.y);
      const factor = d / Math.max(pinchRef.current.d, 1);
      camRef.current = clampCam(
        zoomAt(camRef.current, cx, cy, factor, vw, vh, minZ, maxZ),
        panLimit(),
      );
      const dYaw = wrapDelta(angle - pinchRef.current.angle);
      yawRef.current += dYaw;
      yawVelRef.current = dYaw / 0.016;
      const dPitch = (cy - pinchRef.current.cy) * 0.0034;
      pitchRef.current = clamp(pitchRef.current + dPitch, -PITCH_MAX, PITCH_MAX);
      pitchVelRef.current = dPitch / 0.016;
      pinchRef.current = { d, cx, cy, angle };
      hideHint();
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.hypot(dx, dy) > 6) drag.moved = true;
    if (e.shiftKey || e.buttons === 2) {
      yawRef.current += dx * 0.007;
      yawVelRef.current = (dx * 0.007) / 0.016;
      const dPitch = -dy * 0.005;
      pitchRef.current = clamp(pitchRef.current + dPitch, -PITCH_MAX, PITCH_MAX);
      pitchVelRef.current = dPitch / 0.016;
      drag.x = e.clientX;
      drag.y = e.clientY;
      hideHint();
      return;
    }
    const z = camRef.current.zoom;
    camRef.current.x -= dx / z;
    camRef.current.y -= dy / z;
    velRef.current.x = -dx / z / 0.016;
    velRef.current.y = -dy / z / 0.016;
    drag.x = e.clientX;
    drag.y = e.clientY;
  }, [hideHint]);

  const endPointer = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "touch" || touchModeRef.current) return;
      if (!playingRef.current) return;
      if ((e.target as HTMLElement).closest("button, a")) return;
      const drag = dragRef.current;
      const wasTap =
        drag &&
        drag.id === e.pointerId &&
        !drag.moved &&
        performance.now() - drag.t < 380;
      pointersRef.current.delete(e.pointerId);
      if (pointersRef.current.size < 2) pinchRef.current = null;
      if (pointersRef.current.size === 0) dragRef.current = null;

      if (wasTap) {
        const { vw, vh, minZ, maxZ } = limitsRef.current;
        const world = screenToWorld(camRef.current, e.clientX, e.clientY, vw, vh);
        const node = hitNode(world.x, world.y, camRef.current.zoom, minZ, maxZ, projRef.current);
        if (node) {
          flyTo(node.x, node.y, maxZ);
          hideHint();
        }
      }
    },
    [flyTo, hideHint],
  );

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!playingRef.current) return;
      e.preventDefault();
      const { vw, vh, minZ, maxZ } = limitsRef.current;
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      if (e.altKey) {
        yawRef.current += delta * 0.0032;
        yawVelRef.current = delta * 0.0032 * 40;
        flyRef.current = null;
        hideHint();
        return;
      }
      const factor = Math.exp(-delta * 0.0016);
      camRef.current = clampCam(
        zoomAt(camRef.current, e.clientX, e.clientY, factor, vw, vh, minZ, maxZ),
        panLimit(),
      );
      flyRef.current = null;
      hideHint();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [hideHint]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      touchModeRef.current = true;
      if (!playingRef.current) return;
      if ((e.target as HTMLElement).closest("button, a")) return;
      e.preventDefault();
      flyRef.current = null;
      hideHint();
      if (e.touches.length === 1) {
        const t = e.touches[0]!;
        dragRef.current = {
          id: t.identifier,
          x: t.clientX,
          y: t.clientY,
          moved: false,
          t: performance.now(),
        };
        velRef.current.x = 0;
        velRef.current.y = 0;
        pinchRef.current = null;
      } else if (e.touches.length >= 2) {
        const a = e.touches[0]!;
        const b = e.touches[1]!;
        pinchRef.current = {
          d: dist(a.clientX, a.clientY, b.clientX, b.clientY),
          cx: (a.clientX + b.clientX) / 2,
          cy: (a.clientY + b.clientY) / 2,
          angle: fingerAngle(a.clientX, a.clientY, b.clientX, b.clientY),
        };
        dragRef.current = null;
      }
    };

    const onMove = (e: TouchEvent) => {
      if (!playingRef.current) return;
      if ((e.target as HTMLElement).closest("button, a")) return;
      if (e.touches.length >= 2) {
        e.preventDefault();
        const a = e.touches[0]!;
        const b = e.touches[1]!;
        const d = dist(a.clientX, a.clientY, b.clientX, b.clientY);
        const cx = (a.clientX + b.clientX) / 2;
        const cy = (a.clientY + b.clientY) / 2;
        const angle = fingerAngle(a.clientX, a.clientY, b.clientX, b.clientY);
        const prev = pinchRef.current;
        const base = prev ?? { d, cx, cy, angle };
        const factor = d / Math.max(base.d, 1);
        const { vw, vh, minZ, maxZ } = limitsRef.current;
        camRef.current = clampCam(
          zoomAt(camRef.current, cx, cy, factor, vw, vh, minZ, maxZ),
          panLimit(),
        );
        const dYaw = wrapDelta(angle - base.angle);
        yawRef.current += dYaw;
        yawVelRef.current = dYaw / 0.016;
        const dPitch = (cy - base.cy) * 0.0034;
        pitchRef.current = clamp(pitchRef.current + dPitch, -PITCH_MAX, PITCH_MAX);
        pitchVelRef.current = dPitch / 0.016;
        pinchRef.current = { d, cx, cy, angle };
        hideHint();
        return;
      }
      const drag = dragRef.current;
      if (!drag || pinchRef.current || e.touches.length !== 1) return;
      e.preventDefault();
      const t = e.touches[0]!;
      const dx = t.clientX - drag.x;
      const dy = t.clientY - drag.y;
      if (Math.hypot(dx, dy) > 6) drag.moved = true;
      const z = camRef.current.zoom;
      camRef.current.x -= dx / z;
      camRef.current.y -= dy / z;
      velRef.current.x = -dx / z / 0.016;
      velRef.current.y = -dy / z / 0.016;
      drag.x = t.clientX;
      drag.y = t.clientY;
    };

    const onEnd = (e: TouchEvent) => {
      if (!playingRef.current) return;
      if ((e.target as HTMLElement).closest("button, a")) return;
      const drag = dragRef.current;
      const ended = e.changedTouches[0];
      const wasTap =
        drag &&
        !drag.moved &&
        !pinchRef.current &&
        e.touches.length === 0 &&
        ended &&
        performance.now() - drag.t < 420;

      if (e.touches.length >= 2) {
        const a = e.touches[0]!;
        const b = e.touches[1]!;
        pinchRef.current = {
          d: dist(a.clientX, a.clientY, b.clientX, b.clientY),
          cx: (a.clientX + b.clientX) / 2,
          cy: (a.clientY + b.clientY) / 2,
          angle: fingerAngle(a.clientX, a.clientY, b.clientX, b.clientY),
        };
        dragRef.current = null;
      } else if (e.touches.length === 1) {
        pinchRef.current = null;
        const t = e.touches[0]!;
        dragRef.current = {
          id: t.identifier,
          x: t.clientX,
          y: t.clientY,
          moved: true,
          t: 0,
        };
      } else {
        pinchRef.current = null;
        dragRef.current = null;
        window.setTimeout(() => {
          if (!dragRef.current && !pinchRef.current) touchModeRef.current = false;
        }, 80);
      }

      if (wasTap && ended) {
        const { vw, vh, minZ, maxZ } = limitsRef.current;
        const world = screenToWorld(camRef.current, ended.clientX, ended.clientY, vw, vh);
        const node = hitNode(world.x, world.y, camRef.current.zoom, minZ, maxZ, projRef.current);
        if (node) {
          flyTo(node.x, node.y, maxZ);
          hideHint();
        }
      }
    };

    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: false });
    el.addEventListener("touchcancel", onEnd, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [flyTo, hideHint]);

  useEffect(() => {
    const canvas = impostorCanvasRef.current;
    if (!canvas) return;
    const api = createImpostorLayer(canvas, () => setHasImpostor(true));
    impostorRef.current = api;
    return () => {
      api?.destroy();
      impostorRef.current = null;
    };
  }, []);

  const onPlay = () => {
    setPlaying(true);
    startVideos();
    window.setTimeout(hideHint, 5200);
  };

  const span = useMemo(() => {
    const reach = 2200;
    spanRef.current = { minX: -reach, minY: -reach };
    return { minX: -reach, minY: -reach, w: reach * 2, h: reach * 2 };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`relative h-dvh w-full overflow-hidden bg-bg text-fg touch-none select-none${hasImpostor ? " has-impostor" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      <div
        ref={nebulaFarRef}
        className="nebula-wash nebula-far pointer-events-none absolute inset-0"
      />
      <div
        ref={nebulaNearRef}
        className="nebula-wash nebula-near pointer-events-none absolute inset-0"
      />
      <Starfield motion={motionRef} />
      <canvas
        ref={impostorCanvasRef}
        className="impostor-layer pointer-events-none absolute inset-0"
        aria-hidden="true"
      />

      <div
        ref={worldRef}
        className="world-layer absolute left-0 top-0"
        style={{ transformOrigin: "0 0" }}
      >
        <svg
          className="pointer-events-none absolute overflow-visible"
          width={span.w}
          height={span.h}
          style={{ left: span.minX, top: span.minY }}
        >
          <g ref={threadRefs} className="threads">
            {LINKS.map(([a, b]) => {
              const na = NODE_BY_ID[a];
              const nb = NODE_BY_ID[b];
              const outer = na.ring === "outer" || nb.ring === "outer";
              return (
                <line
                  key={`${a}-${b}`}
                  ref={(el) => {
                    lineRefs.current[`${a}-${b}`] = el;
                  }}
                  x1={na.x - span.minX}
                  y1={na.y - span.minY}
                  x2={nb.x - span.minX}
                  y2={nb.y - span.minY}
                  className={outer ? "thread thread-outer" : "thread"}
                />
              );
            })}
          </g>
        </svg>

        {NODES.map((n) => (
          <div
            key={n.id}
            ref={(el) => {
              nodeRefs.current[n.id] = el;
            }}
            data-node={n.id}
            className={n.id === "core" ? "node-orb is-immersed" : "node-orb"}
            style={{
              width: VIDEO_SIZE,
              height: VIDEO_SIZE,
              left: n.x - VIDEO_SIZE / 2,
              top: n.y - VIDEO_SIZE / 2,
            }}
          >
            <div
              className="node-spin"
              ref={(el) => {
                spinRefs.current[n.id] = el;
              }}
            >
            <div className="node-glow" />
            <img src={n.poster} alt="" draggable={false} className="node-media" />
            <video
              ref={(el) => {
                videoRefs.current[n.id] = el;
              }}
              src={n.video}
              poster={n.poster}
              muted
              loop
              playsInline
              preload={n.id === "core" ? "auto" : "metadata"}
              disablePictureInPicture
              controls={false}
              className="node-media node-video"
            />
            </div>
          </div>
        ))}
      </div>

      {playing ? (
        <div className="hud-layer pointer-events-none absolute inset-0 flex flex-col justify-between p-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <header className="flex flex-col items-center gap-1 text-center">
            <p
              ref={nameRef}
              className="font-display text-xl font-medium tracking-[0.28em] text-fg uppercase text-balance sm:text-2xl"
            >
              Star Core
            </p>
            <p
              ref={epithetRef}
              className="text-xs tracking-[0.22em] text-muted uppercase"
            >
              heart of the universe
            </p>
          </header>

          <div className="flex items-end justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              size="default"
              className="pointer-events-auto h-11 px-4 tracking-[0.16em] text-muted hover:text-fg"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                const { maxZ } = limitsRef.current;
                flyTo(0, 0, maxZ);
              }}
            >
              Core
            </Button>
            <p
              ref={hintRef}
              className="text-[11px] tracking-[0.18em] text-subtle uppercase motion-safe:transition-opacity motion-safe:duration-[var(--motion-slow)]"
            >
              Pinch · twist · drag
            </p>
            <Button
              type="button"
              variant="ghost"
              size="default"
              className="pointer-events-auto h-11 px-4 tracking-[0.16em] text-muted hover:text-fg"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                const { minZ } = limitsRef.current;
                flyTo(0, 0, minZ);
              }}
            >
              Map
            </Button>
          </div>
        </div>
      ) : (
        <div className="gate-layer absolute inset-0 flex flex-col items-center justify-end bg-bg/40 px-6 pb-[max(4.5rem,calc(env(safe-area-inset-bottom)+3.5rem))]">
          <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
            <p className="text-[11px] tracking-[0.38em] text-muted uppercase">
              Living map
            </p>
            <h1 className="font-display text-5xl font-medium leading-tight tracking-[0.18em] text-fg uppercase text-balance sm:text-6xl">
              Constellation
            </h1>
            <p className="max-w-[16rem] text-sm leading-relaxed text-muted text-pretty">
              Star Core at the center. Worlds hung in the void. Pinch out, twist
              to orbit.
            </p>
            <Button type="button" size="lg" className="mt-2 min-w-40" onClick={onPlay}>
              Play
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

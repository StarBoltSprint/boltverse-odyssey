/**
 * LanePlayer — B-stack reference compositor.
 * Recipe only. Do not publish a new grok.me from this file.
 *
 * Locks (biome/PLAY.md):
 *  - road empty-plate + bolt cutout
 *  - seek-sync (road is master clock)
 *  - loop forever + watchdog
 *  - no wallet / keys
 *  - swipe = découpe plant, not 3-take L/M/R
 */
import { useEffect, useRef, useState } from "react";

export type LanePlant = "L" | "M" | "R";

export type LanePlayerProps = {
  roadSrc: string;
  boltSrc: string;
  roadPoster?: string;
  className?: string;
};

const FRAME = 1 / 30;
const SEEK_CAP_MS = 180;
const SWIPE_PX = 40;

function plantX(plant: LanePlant) {
  if (plant === "L") return "28%";
  if (plant === "R") return "72%";
  return "50%";
}

async function seekReady(el: HTMLVideoElement, t: number) {
  if (Math.abs(el.currentTime - t) <= FRAME) return;
  await new Promise<void>((resolve) => {
    const done = () => {
      el.removeEventListener("seeked", done);
      resolve();
    };
    el.addEventListener("seeked", done, { once: true });
    el.currentTime = t;
    window.setTimeout(done, SEEK_CAP_MS);
  });
}

export function LanePlayer({ roadSrc, boltSrc, roadPoster, className }: LanePlayerProps) {
  const roadRef = useRef<HTMLVideoElement>(null);
  const boltRef = useRef<HTMLVideoElement>(null);
  const pointerX = useRef<number | null>(null);
  const [plant, setPlant] = useState<LanePlant>("M");

  useEffect(() => {
    const road = roadRef.current;
    const bolt = boltRef.current;
    if (!road || !bolt) return;

    const kickPlay = (el: HTMLVideoElement) => {
      el.muted = true;
      el.playsInline = true;
      el.loop = true;
      void el.play().catch(() => {});
    };

    kickPlay(road);
    kickPlay(bolt);

    let raf = 0;
    const tick = () => {
      const clock = road.currentTime;
      bolt.playbackRate = road.playbackRate || 1;
      if (Math.abs(bolt.currentTime - clock) > FRAME) {
        void seekReady(bolt, clock);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const watchdog = () => {
      if (road.paused && !road.ended) kickPlay(road);
      if (bolt.paused && !bolt.ended) kickPlay(bolt);
      if (road.ended) {
        road.currentTime = 0;
        bolt.currentTime = 0;
        kickPlay(road);
        kickPlay(bolt);
      }
    };
    road.addEventListener("pause", watchdog);
    road.addEventListener("ended", watchdog);
    bolt.addEventListener("pause", watchdog);
    bolt.addEventListener("ended", watchdog);

    return () => {
      cancelAnimationFrame(raf);
      road.removeEventListener("pause", watchdog);
      road.removeEventListener("ended", watchdog);
      bolt.removeEventListener("pause", watchdog);
      bolt.removeEventListener("ended", watchdog);
    };
  }, [roadSrc, boltSrc]);

  function onPointerDown(e: React.PointerEvent) {
    pointerX.current = e.clientX;
  }

  function onPointerUp(e: React.PointerEvent) {
    const start = pointerX.current;
    pointerX.current = null;
    if (start == null) return;
    const dx = e.clientX - start;
    if (Math.abs(dx) < SWIPE_PX) return;
    setPlant((cur) => {
      if (dx < 0) return cur === "L" ? "M" : cur === "M" ? "R" : "R";
      return cur === "R" ? "M" : cur === "M" ? "L" : "L";
    });
  }

  return (
    <div
      className={className ? `lane-stage ${className}` : "lane-stage"}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <video
        ref={roadRef}
        className="lane-road"
        src={roadSrc}
        poster={roadPoster}
        muted
        playsInline
        autoPlay
        loop
      />
      <video
        ref={boltRef}
        className="lane-bolt"
        src={boltSrc}
        muted
        playsInline
        autoPlay
        loop
        style={{ left: plantX(plant) }}
      />
    </div>
  );
}

export default LanePlayer;

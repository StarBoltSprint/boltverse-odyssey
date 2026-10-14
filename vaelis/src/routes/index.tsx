import { Component, lazy, Suspense, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { attachProbe, createFlight, resetFlight, type Flight } from "@/ship/flight";
import type { ViewCmd } from "@/ship/scene";

const Scene = lazy(() => import("@/ship/scene"));
const SoftHull = lazy(() => import("@/ship/soft"));

function gpuAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

class HullBoundary extends Component<{ onFail: () => void; children: ReactNode }, { down: boolean }> {
  state = { down: false };
  static getDerivedStateFromError() {
    return { down: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.down ? null : this.props.children;
  }
}

export const Route = createFileRoute("/")({ component: Home });

const VIEWS: Array<{ id: string; label: string; pos: [number, number, number]; target: [number, number, number] }> = [
  { id: "all", label: "Whole ship", pos: [14, 5.2, 20], target: [0, 0.15, 0.4] },
  { id: "nose", label: "Nose", pos: [3.2, 1.1, -13.4], target: [0, 0.1, -9.4] },
  { id: "bridge", label: "Bridge", pos: [3.4, 1.8, -1.1], target: [0, 0.7, -3.2] },
  { id: "drives", label: "Drives", pos: [4.2, 1.6, 14.8], target: [0, 0.1, 7.2] },
];

function Hold({
  label,
  code,
  flight,
}: {
  label: string;
  code: string;
  flight: Flight;
}) {
  const down = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    flight.keys.add(code);
  };
  const up = () => {
    flight.keys.delete(code);
  };
  return (
    <button
      type="button"
      className="min-h-11 min-w-11 rounded-sm border border-line bg-subtle px-3 text-sm font-medium text-fg"
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={up}
    >
      {label}
    </button>
  );
}

function Home() {
  const flight = useRef<Flight>(createFlight());
  const [engine, setEngine] = useState<"boot" | "webgl" | "soft">("boot");
  const [mode, setMode] = useState<"inspect" | "pilot">("inspect");
  const [cut, setCut] = useState(0);
  const [explode, setExplode] = useState(0);
  const [wire, setWire] = useState(false);
  const [voidSpace, setVoidSpace] = useState(false);
  const [plates, setPlates] = useState(false);
  const [view, setView] = useState<ViewCmd | null>(null);
  const viewId = useRef(0);
  const speedRef = useRef<HTMLSpanElement>(null);
  const yawRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setEngine(gpuAvailable() ? "webgl" : "soft");
  }, []);

  const start = () => {
    const f = flight.current;
    resetFlight(f);
    f.piloting = true;
    f.snapCam = true;
    attachProbe(f);
    setMode("pilot");
  };

  const hangar = () => {
    const f = flight.current;
    f.piloting = false;
    f.recenter = true;
    resetFlight(f);
    setMode("inspect");
  };

  const focus = (pos: [number, number, number], target: [number, number, number]) => {
    viewId.current += 1;
    setView({ id: viewId.current, pos, target });
  };

  return (
    <main className="relative h-dvh overflow-hidden bg-bg text-fg touch-none">
      <div className="absolute inset-0">
        {engine === "webgl" ? (
          <HullBoundary onFail={() => setEngine("soft")}>
            <Suspense fallback={null}>
              <Scene
                flight={flight.current}
                cut={cut}
                explode={explode}
                wire={wire}
                voidSpace={voidSpace}
                view={view}
                speedRef={speedRef}
                yawRef={yawRef}
                onGpuFail={() => setEngine("soft")}
              />
            </Suspense>
          </HullBoundary>
        ) : engine === "soft" ? (
          <Suspense fallback={null}>
            <SoftHull
              flight={flight.current}
              cut={cut}
              explode={explode}
              wire={wire}
              voidSpace={voidSpace}
              view={view}
              speedRef={speedRef}
              yawRef={yawRef}
            />
          </Suspense>
        ) : null}
      </div>

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 sm:p-6">
        <header className="flex items-start justify-between gap-4">
          <div className="pointer-events-auto max-w-sm">
            <p className="text-xs font-medium tracking-wide text-muted">Survey cruiser · 92 m</p>
            <h1 className="font-display text-4xl leading-none font-medium tracking-tight text-fg sm:text-5xl">
              Vaelis
            </h1>
            <p className="mt-2 max-w-xs text-sm text-muted">
              Solid hull, decks, and drives. Orbit the volume, open a cut, or fly it.
            </p>
          </div>
          {mode === "pilot" ? (
            <div className="pointer-events-none rounded-lg border border-line bg-elevated/90 px-4 py-3 text-right">
              <p className="text-xs text-muted">Speed</p>
              <p className="font-display text-2xl leading-none tabular-nums">
                <span ref={speedRef}>0.0</span>
              </p>
              <p className="mt-2 text-xs text-muted">
                Heading <span ref={yawRef} className="tabular-nums text-fg">0°</span>
              </p>
            </div>
          ) : (
            <p className="hidden text-xs text-faint sm:block">Drag to orbit · scroll to close in</p>
          )}
        </header>

        <div className="flex flex-col gap-3">
          {mode === "inspect" ? (
            <div className="pointer-events-auto flex flex-wrap gap-2">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className="min-h-11 rounded-sm border border-line bg-elevated/90 px-3 text-sm text-fg"
                  onClick={() => focus(v.pos, v.target)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="pointer-events-auto flex flex-wrap gap-2">
              <Hold label="Left" code="KeyA" flight={flight.current} />
              <Hold label="Right" code="KeyD" flight={flight.current} />
              <Hold label="Thrust" code="KeyW" flight={flight.current} />
              <Hold label="Brake" code="KeyS" flight={flight.current} />
              <Hold label="Nose up" code="KeyQ" flight={flight.current} />
              <Hold label="Nose down" code="KeyE" flight={flight.current} />
            </div>
          )}

          <div className="pointer-events-auto flex flex-col gap-4 rounded-xl border border-line bg-elevated/90 p-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {mode === "inspect" ? (
                <button
                  type="button"
                  className="min-h-11 rounded-sm bg-accent px-4 text-sm font-medium text-accent-fg"
                  onClick={start}
                >
                  Start
                </button>
              ) : (
                <button
                  type="button"
                  className="min-h-11 rounded-sm bg-accent px-4 text-sm font-medium text-accent-fg"
                  onClick={hangar}
                >
                  Hangar
                </button>
              )}
              <button
                type="button"
                className="min-h-11 rounded-sm border border-line px-3 text-sm text-fg"
                onClick={() => setPlates(true)}
              >
                Plates
              </button>
              <button
                type="button"
                className={`min-h-11 rounded-sm border border-line px-3 text-sm ${wire ? "bg-subtle text-fg" : "text-muted"}`}
                onClick={() => setWire((v) => !v)}
              >
                Wire
              </button>
              <button
                type="button"
                className={`min-h-11 rounded-sm border border-line px-3 text-sm ${voidSpace ? "bg-subtle text-fg" : "text-muted"}`}
                onClick={() => setVoidSpace((v) => !v)}
              >
                Void
              </button>
            </div>

            {mode === "inspect" ? (
              <div className="grid flex-1 gap-3 sm:max-w-md sm:grid-cols-2">
                <label className="grid gap-2 text-xs text-muted">
                  Cutaway
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={cut}
                    onChange={(e) => setCut(Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-2 text-xs text-muted">
                  Spread
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={explode}
                    onChange={(e) => setExplode(Number(e.target.value))}
                  />
                </label>
              </div>
            ) : (
              <p className="text-sm text-muted">W thrust · S brake · A left · D right · Q / E pitch</p>
            )}
          </div>
        </div>
      </div>

      {plates ? (
        <div className="absolute inset-0 z-10 flex items-end justify-center bg-bg/70 p-4 sm:items-center" role="dialog" aria-label="Reference plates">
          <div className="max-h-[88dvh] w-full max-w-3xl overflow-auto rounded-xl border border-line bg-elevated p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl leading-tight">Reference plates</h2>
                <p className="text-sm text-muted">The hull was modeled to these studies. The film is a camera drift, not the mesh.</p>
              </div>
              <button
                type="button"
                className="min-h-11 rounded-sm bg-accent px-4 text-sm font-medium text-accent-fg"
                onClick={() => setPlates(false)}
              >
                Close
              </button>
            </div>
            <div className="grid gap-3">
              <img src="/ref/concept.jpg" alt="Hangar study the cruiser was matched to" className="w-full rounded-md" />
              <img src="/ref/elevation.jpg" alt="Side elevation used for the hull profile" className="w-full rounded-md" />
              <video
                src="/ref/drift.mp4"
                poster="/ref/concept.jpg"
                controls
                playsInline
                className="w-full rounded-md"
              />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

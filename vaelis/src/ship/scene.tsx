import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { chaseDesired, stepFlight, type Flight } from "@/ship/flight";
import {
  HULL,
  WING,
  hullRadiusAt,
  loftHull,
  nozzleGeometry,
  plumeGeometry,
  wingGeometry,
} from "@/ship/geo";

export type ViewCmd = {
  id: number;
  pos: [number, number, number];
  target: [number, number, number];
};

type SceneProps = {
  flight: Flight;
  cut: number;
  explode: number;
  wire: boolean;
  voidSpace: boolean;
  view: ViewCmd | null;
  speedRef: RefObject<HTMLSpanElement | null>;
  yawRef: RefObject<HTMLSpanElement | null>;
  onGpuFail?: () => void;
};

const CAM_HOME: [number, number, number] = [14, 5.2, 20];
const TARGET_HOME = new THREE.Vector3(0, 0.15, 0.4);

function prepMap(base: THREE.Texture, rx: number, ry: number) {
  const t = base.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function makeMats(hullMap: THREE.Texture | null, wingMap: THREE.Texture | null) {
  const clip = new THREE.Plane(new THREE.Vector3(1, 0, 0), 24);
  const planes = [clip];
  const hull = new THREE.MeshStandardMaterial({
    color: "#f2f4f6",
    metalness: 0.82,
    roughness: 0.42,
    clippingPlanes: planes,
  });
  const wing = new THREE.MeshStandardMaterial({
    color: "#e4e8ed",
    metalness: 0.74,
    roughness: 0.38,
    clippingPlanes: planes,
    side: THREE.DoubleSide,
  });
  if (hullMap) hull.map = hullMap;
  if (wingMap) wing.map = wingMap;
  const dark = new THREE.MeshStandardMaterial({
    color: "#3e454d",
    metalness: 0.7,
    roughness: 0.46,
    clippingPlanes: planes,
  });
  const nozzle = new THREE.MeshStandardMaterial({
    color: "#6a727b",
    metalness: 0.88,
    roughness: 0.32,
    clippingPlanes: planes,
    side: THREE.DoubleSide,
  });
  const inner = new THREE.MeshStandardMaterial({
    color: "#1a1c20",
    metalness: 0.25,
    roughness: 0.72,
    clippingPlanes: planes,
    side: THREE.BackSide,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: "#8b98a6",
    metalness: 0.12,
    roughness: 0.06,
    transparent: true,
    opacity: 0.42,
    clippingPlanes: planes,
  });
  const hot = new THREE.MeshStandardMaterial({
    color: "#f7f8fa",
    emissive: "#f4f7fb",
    emissiveIntensity: 2.4,
    roughness: 0.2,
    metalness: 0.1,
    clippingPlanes: planes,
  });
  const plume = new THREE.MeshBasicMaterial({
    color: "#f7f9fc",
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    clippingPlanes: planes,
  });
  const trim = new THREE.MeshStandardMaterial({
    color: "#8d959e",
    metalness: 0.8,
    roughness: 0.35,
    clippingPlanes: planes,
  });
  return { clip, hull, wing, dark, nozzle, inner, glass, hot, plume, trim };
}

type Mats = ReturnType<typeof makeMats>;

function Stars() {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array(1600 * 3);
    for (let i = 0; i < 1600; i += 1) {
      const r = 50 + Math.random() * 70;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);
  return (
    <points geometry={geo}>
      <pointsMaterial color="#d5dae2" size={0.11} sizeAttenuation />
    </points>
  );
}

function Hangar() {
  return (
    <group>
      <mesh position={[0, 5.5, 0]}>
        <cylinderGeometry args={[32, 32, 16, 64, 1, true]} />
        <meshStandardMaterial color="#121316" side={THREE.BackSide} roughness={0.96} metalness={0.04} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.02, 0]} receiveShadow>
        <circleGeometry args={[22, 72]} />
        <meshStandardMaterial color="#16181c" metalness={0.35} roughness={0.78} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.0, 0.6]}>
        <ringGeometry args={[7.2, 7.28, 80]} />
        <meshBasicMaterial color="#3a3e46" />
      </mesh>
      {[-6, 0, 6].map((z) => (
        <mesh key={z} position={[0, 8.6, z]}>
          <boxGeometry args={[10, 0.06, 0.18]} />
          <meshStandardMaterial color="#f4f4f5" emissive="#f3f4f6" emissiveIntensity={1.6} />
        </mesh>
      ))}
      <spotLight
        position={[0, 9, 1]}
        angle={0.72}
        penumbra={0.65}
        intensity={80}
        color="#f4f5f7"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
    </group>
  );
}

function Crew() {
  return (
    <group position={[4.1, -1.02, 2.4]} scale={0.58}>
      <mesh position={[0, 0.16, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.08, 0.32, 10]} />
        <meshStandardMaterial color="#c8ccd4" roughness={0.6} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.4, 0]} castShadow>
        <capsuleGeometry args={[0.09, 0.16, 4, 8]} />
        <meshStandardMaterial color="#d5d8de" roughness={0.55} metalness={0.12} />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <sphereGeometry args={[0.07, 16, 12]} />
        <meshStandardMaterial color="#e4e6ea" roughness={0.45} />
      </mesh>
    </group>
  );
}

function Nacelle({
  mats,
  position,
  scale = 1,
  plumeRef,
}: {
  mats: Mats;
  position: [number, number, number];
  scale?: number;
  plumeRef?: (m: THREE.Mesh) => void;
}) {
  const nozzle = useMemo(() => nozzleGeometry(), []);
  const plume = useMemo(() => plumeGeometry(), []);
  return (
    <group position={position} scale={scale}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.55]} material={mats.dark} castShadow>
        <cylinderGeometry args={[0.34, 0.3, 2.1, 20]} />
      </mesh>
      <mesh geometry={nozzle} material={mats.nozzle} position={[0, 0, 0.55]} castShadow />
      <mesh position={[0, 0, 0.42]}>
        <circleGeometry args={[0.16, 20]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={3}
          side={THREE.DoubleSide}
          clippingPlanes={mats.hot.clippingPlanes}
        />
      </mesh>
      <mesh
        ref={plumeRef}
        geometry={plume}
        material={mats.plume}
        position={[0, 0, 1.15]}
      />
      <pointLight position={[0, 0, 1.3]} color="#f4f7fb" intensity={6} distance={7} decay={2} />
    </group>
  );
}

function Cruiser({
  mats,
  flight,
  explode,
}: {
  mats: Mats;
  flight: Flight;
  explode: number;
}) {
  const hull = useMemo(() => loftHull(HULL, 56, 0.22), []);
  const innerStations = useMemo(
    () =>
      HULL.slice(1, -1).map((s) => ({
        z: s.z,
        rx: s.rx * 0.72,
        ry: s.ry * 0.7,
      })),
    [],
  );
  const inner = useMemo(() => loftHull(innerStations, 40, 0.16), [innerStations]);
  const wing = useMemo(() => wingGeometry(WING, 12), []);
  const root = useRef<THREE.Group>(null);
  const bank = useRef<THREE.Group>(null);
  const plumes = useRef<THREE.Mesh[]>([]);

  const hatches = useMemo(() => {
    const zs = [-6.5, -5.0, -2.0, -0.2, 1.7, 3.4, 5.1, 6.5];
    return zs.map((z) => {
      const { ry, rx } = hullRadiusAt(z);
      return { z, y: ry * 1.26, x: 0, w: Math.max(0.16, rx * 0.32), len: 0.46 };
    });
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    stepFlight(flight, dt);
    const group = root.current;
    const bankGroup = bank.current;
    if (!group || !bankGroup) return;
    if (flight.piloting) {
      group.position.copy(flight.pos);
      group.rotation.order = "YXZ";
      group.rotation.y = flight.yaw;
      group.rotation.x = flight.pitch;
      bankGroup.rotation.z = flight.bank;
    } else {
      group.position.set(0, 0, 0);
      group.rotation.set(0, 0, 0);
      bankGroup.rotation.z = 0;
    }
    const throttle = flight.piloting ? Math.max(0.2, Math.min(1, Math.abs(flight.speed) / 16)) : 0.38;
    plumes.current.forEach((m, i) => {
      const flicker = 1 + Math.sin(performance.now() * 0.02 + i) * 0.04;
      m.scale.set(0.85 + throttle * 0.3, 0.85 + throttle * 0.3, (0.7 + throttle * 1.5) * flicker);
    });
    mats.plume.opacity = 0.22 + throttle * 0.45;
  });

  const setPlume = (index: number) => (m: THREE.Mesh | null) => {
    if (m) plumes.current[index] = m;
  };

  return (
    <group ref={root}>
      <group ref={bank}>
        <mesh geometry={hull} material={mats.hull} castShadow />
        <mesh geometry={inner} material={mats.inner} />

        {[-2.2, 1.1, 4.4].map((z) => (
          <mesh key={z} position={[0, 0.05, z]} rotation={[Math.PI / 2, 0, 0]} material={mats.trim}>
            <torusGeometry args={[0.42, 0.03, 8, 28]} />
          </mesh>
        ))}
        {[-0.22, 0.02, 0.24].map((y) => (
          <mesh key={y} position={[0, y, 1.4]} material={mats.dark}>
            <boxGeometry args={[0.95, 0.035, 7.2]} />
          </mesh>
        ))}
        <mesh position={[0, 0.32, 1.1]} rotation={[Math.PI / 2, 0, 0]} material={mats.trim}>
          <cylinderGeometry args={[0.035, 0.035, 8.4, 8]} />
        </mesh>
        <mesh position={[0, 0.08, 1.5]} material={mats.hot}>
          <boxGeometry args={[0.04, 0.02, 6.2]} />
        </mesh>
        <mesh position={[-0.16, 0.22, -3.35]} material={mats.dark}>
          <boxGeometry args={[0.14, 0.2, 0.16]} />
        </mesh>
        <mesh position={[0.16, 0.22, -3.35]} material={mats.dark}>
          <boxGeometry args={[0.14, 0.2, 0.16]} />
        </mesh>
        <mesh position={[0, -0.32, 1.3]} material={mats.trim}>
          <boxGeometry args={[0.07, 0.22, 8]} />
        </mesh>

        {hatches.map((h) => (
          <mesh key={h.z} position={[h.x, h.y, h.z]} material={mats.dark}>
            <boxGeometry args={[h.w, 0.025, h.len]} />
          </mesh>
        ))}

        <mesh position={[0, 0.62, -3.2]} scale={[0.5, 0.18, 1.5]} material={mats.dark}>
          <sphereGeometry args={[1, 32, 20]} />
        </mesh>
        <group position={[0, explode * 0.85, 0]}>
          <mesh position={[0, 0.7, -3.2]} scale={[0.4, 0.15, 1.28]} material={mats.glass}>
            <sphereGeometry args={[1, 32, 20]} />
          </mesh>
        </group>

        <mesh position={[0, 1.25, -1.35]} material={mats.trim} castShadow>
          <cylinderGeometry args={[0.02, 0.025, 0.95, 8]} />
        </mesh>
        <mesh position={[0, 1.72, -1.35]} material={mats.dark}>
          <sphereGeometry args={[0.06, 12, 10]} />
        </mesh>
        <mesh position={[0, 0.02, -11.7]} rotation={[Math.PI / 2, 0, 0]} material={mats.trim}>
          <cylinderGeometry args={[0.012, 0.03, 1.05, 8]} />
        </mesh>
        <mesh position={[0, -0.5, -8.1]} scale={[0.22, 0.14, 0.32]} material={mats.dark}>
          <sphereGeometry args={[1, 16, 12]} />
        </mesh>

        {[0.42, -0.42].map((x) => (
          <group key={x}>
            <mesh position={[x, -0.86, 1.2]} material={mats.trim} castShadow>
              <boxGeometry args={[0.05, 0.08, 5.4]} />
            </mesh>
            <mesh position={[x, -0.62, -0.4]} material={mats.trim}>
              <boxGeometry args={[0.04, 0.42, 0.04]} />
            </mesh>
            <mesh position={[x, -0.62, 3.1]} material={mats.trim}>
              <boxGeometry args={[0.04, 0.42, 0.04]} />
            </mesh>
          </group>
        ))}

        <mesh position={[-0.95, 0.08, -0.2]}>
          <sphereGeometry args={[0.045, 10, 8]} />
          <meshStandardMaterial color="#e7b2ae" emissive="#d36b64" emissiveIntensity={1.6} clippingPlanes={mats.hull.clippingPlanes} />
        </mesh>
        <mesh position={[0.95, 0.05, -0.2]}>
          <sphereGeometry args={[0.045, 10, 8]} />
          <meshStandardMaterial color="#9ecfad" emissive="#7dbe90" emissiveIntensity={1.5} clippingPlanes={mats.hull.clippingPlanes} />
        </mesh>
        <pointLight position={[-0.95, 0.05, -0.2]} color="#e07a72" intensity={0.6} distance={2} />

        <group position={[explode * 2.4, explode * -0.2, explode * 0.3]}>
          <mesh geometry={wing} material={mats.wing} castShadow />
          <Nacelle mats={mats} position={[1.45, -0.12, 6.15]} plumeRef={setPlume(0)} />
        </group>
        <group position={[explode * -2.4, explode * -0.2, explode * 0.3]}>
          <mesh geometry={wing} material={mats.wing} scale={[-1, 1, 1]} castShadow />
          <Nacelle mats={mats} position={[-1.45, -0.12, 6.15]} plumeRef={setPlume(1)} />
        </group>
        <group position={[0, explode * 0.15, explode * 1.5]}>
          <Nacelle mats={mats} position={[0, 0.08, 7.55]} scale={0.72} plumeRef={setPlume(2)} />
        </group>
      </group>
    </group>
  );
}

function Rig({
  flight,
  view,
  speedRef,
  yawRef,
  piloting,
}: {
  flight: Flight;
  view: ViewCmd | null;
  speedRef: RefObject<HTMLSpanElement | null>;
  yawRef: RefObject<HTMLSpanElement | null>;
  piloting: boolean;
}) {
  const { camera } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const seen = useRef(0);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!flight.piloting) return;
      flight.keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => {
      flight.keys.delete(e.code);
    };
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

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const ctl = controls.current;
    if (flight.piloting) {
      chaseDesired(flight, desired, look);
      if (flight.snapCam) {
        camera.position.copy(desired);
        flight.snapCam = false;
      } else {
        camera.position.lerp(desired, 1 - Math.exp(-4.5 * dt));
      }
      camera.lookAt(look);
    } else if (ctl) {
      if (flight.recenter) {
        camera.position.set(CAM_HOME[0], CAM_HOME[1], CAM_HOME[2]);
        ctl.target.copy(TARGET_HOME);
        ctl.update();
        flight.recenter = false;
      }
      if (view && view.id !== seen.current) {
        camera.position.set(view.pos[0], view.pos[1], view.pos[2]);
        ctl.target.set(view.target[0], view.target[1], view.target[2]);
        ctl.update();
        seen.current = view.id;
      }
    }
    if (speedRef.current) speedRef.current.textContent = flight.speed.toFixed(1);
    if (yawRef.current) {
      const deg = Math.round((flight.yaw * 180) / Math.PI);
      yawRef.current.textContent = `${deg}°`;
    }
  });

  return (
    <OrbitControls
      ref={controls}
      enabled={!piloting}
      enableDamping
      dampingFactor={0.08}
      minDistance={3.2}
      maxDistance={42}
      maxPolarAngle={Math.PI / 2.02}
      target={[TARGET_HOME.x, TARGET_HOME.y, TARGET_HOME.z]}
      autoRotate={!piloting && !window.matchMedia("(prefers-reduced-motion: reduce)").matches}
      autoRotateSpeed={0.45}
    />
  );
}

function World(props: SceneProps) {
  const mats = useMemo(() => makeMats(null, null), []);
  const { gl, scene } = useThree();

  useEffect(() => {
    let alive = true;
    const loader = new THREE.TextureLoader();
    loader.load(
      "/textures/hull.jpg",
      (base) => {
        if (!alive) {
          base.dispose();
          return;
        }
        const hullMap = prepMap(base, 5, 3);
        const wingMap = prepMap(base, 2.2, 1.4);
        mats.hull.map = hullMap;
        mats.hull.needsUpdate = true;
        mats.wing.map = wingMap;
        mats.wing.needsUpdate = true;
      },
      undefined,
      () => {
        /* plating is optional; the solid hull is already on screen */
      },
    );
    return () => {
      alive = false;
    };
  }, [mats]);

  useLayoutEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.08;
    scene.background = new THREE.Color("#07080b");
  }, [gl, scene]);

  useEffect(() => {
    const wire = props.wire;
    mats.hull.wireframe = wire;
    mats.wing.wireframe = wire;
    mats.nozzle.wireframe = wire;
    mats.dark.wireframe = wire;
    mats.inner.wireframe = wire;
  }, [props.wire, mats]);

  useFrame(() => {
    mats.clip.constant = 22 - props.cut * 22.2;
  });

  const hangar = !props.voidSpace && !props.flight.piloting;

  return (
    <>
      <fog attach="fog" args={[hangar ? "#101114" : "#07080b", hangar ? 22 : 28, hangar ? 58 : 120]} />
      <hemisphereLight args={["#c5ccd6", "#1a1c22", 0.55]} />
      <ambientLight intensity={0.18} />
      <directionalLight
        position={[12, 16, 8]}
        intensity={2.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={2}
        shadow-camera-far={50}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-bias={-0.00025}
      />
      <directionalLight position={[-10, 4, -6]} intensity={0.7} color="#b7c0cc" />
      {hangar ? <Hangar /> : <Stars />}
      <Cruiser mats={mats} flight={props.flight} explode={props.explode} />
      {hangar ? <Crew /> : null}
      <Rig
        flight={props.flight}
        view={props.view}
        speedRef={props.speedRef}
        yawRef={props.yawRef}
        piloting={props.flight.piloting}
      />
    </>
  );
}

export default function Scene(props: SceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.25]}
      camera={{ position: CAM_HOME, fov: 32, near: 0.08, far: 220 }}
      gl={{
        antialias: true,
        alpha: false,
        localClippingEnabled: true,
        powerPreference: "default",
        failIfMajorPerformanceCaveat: false,
      }}
      onCreated={({ gl }) => {
        gl.setClearColor("#07080b");
        if (!gl.getContext()) props.onGpuFail?.();
        gl.domElement.addEventListener("webglcontextlost", (event) => {
          event.preventDefault();
          props.onGpuFail?.();
        });
      }}
    >
      <World {...props} />
    </Canvas>
  );
}

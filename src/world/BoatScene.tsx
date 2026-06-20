import { useMemo, useRef, useState, type CSSProperties } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { palette } from "../scene/palette";
import { Fish } from "./MapDecor";
import { Stick } from "../ui/Stick";
import { fishFee } from "../game/gear";
import type { Region, Spot } from "./regions";
import type { Water } from "../fishing/fishCatalog";

const ARENA = 22; // half-extent of the drivable water
const NEAR = 3.6; // distance at which a spot becomes fishable

/**
 * Top-down boat navigation. Drive with the virtual stick across the water to
 * the fishing-hole buoys; when you're close, "Fish here" enters the fishing
 * view at that (boat-access) spot.
 */
export function BoatScene({
  region,
  water,
  boatSpeed,
  currency,
  onFish,
  onDock,
}: {
  region: Region;
  water: Water;
  boatSpeed: number;
  currency: number;
  onFish: (spot: Spot) => void;
  onDock: () => void;
}) {
  // Stick input shared with the render loop (no per-frame React churn).
  const input = useRef({ x: 0, y: 0 });
  const [near, setNear] = useState<Spot | null>(null);

  // Scatter a few buoys drawn from the water's boat-access spots.
  const buoys = useMemo<{ spot: Spot; pos: [number, number] }[]>(() => {
    const pool = region.spots.filter((s) => s.access === "boat" && s.water === water);
    if (pool.length === 0) return [];
    const layout: [number, number][] = [
      [-10, -8],
      [9, -6],
      [-7, 9],
      [11, 8],
    ];
    return layout.map((pos, i) => ({ spot: pool[i % pool.length], pos }));
  }, [region, water]);

  const fee = near ? fishFee(near.quality, true) : 0;
  const affordable = currency >= fee;

  return (
    <>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 17, 10], fov: 40, near: 0.1, far: 200 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={[palette.sky]} />
        <fog attach="fog" args={[palette.fog, 35, 80]} />
        <ambientLight intensity={0.9} />
        <hemisphereLight args={[palette.sky, palette.waterDeep, 0.5]} />
        <directionalLight position={[10, 20, 6]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} />
        <BoatWater input={input} boatSpeed={boatSpeed} water={water} buoys={buoys} onNear={setNear} />
      </Canvas>

      {/* HUD */}
      <div style={ui.header}>
        <button style={ui.dockBtn} onClick={onDock}>
          ⚓ Dock
        </button>
        <div style={ui.regionName}>{region.name} · {water === "fresh" ? "Lake" : "Ocean"}</div>
      </div>

      <div style={ui.stickWrap}>
        <Stick hint="drive" onMove={(x, y) => (input.current = { x, y })} onRelease={() => (input.current = { x: 0, y: 0 })} />
      </div>

      {near && (
        <div style={ui.fishWrap}>
          <button
            style={{ ...ui.fishBtn, ...(affordable ? null : ui.fishDisabled) }}
            disabled={!affordable}
            onClick={() => onFish(near)}
          >
            🎣 Fish here · {near.name} · ${fee}{affordable ? "" : " (need more $)"}
          </button>
        </div>
      )}
    </>
  );
}

function BoatWater({
  input,
  boatSpeed,
  water,
  buoys,
  onNear,
}: {
  input: React.RefObject<{ x: number; y: number }>;
  boatSpeed: number;
  water: Water;
  buoys: { spot: Spot; pos: [number, number] }[];
  onNear: (s: Spot | null) => void;
}) {
  const boatRef = useRef<THREE.Group>(null);
  const pos = useRef(new THREE.Vector3(0, 0, ARENA - 4)); // start near the "shore"
  const nearId = useRef<string | null>(null);
  const waterColor = water === "fresh" ? palette.water : "#5f86a0";

  useFrame(({ camera }, dt) => {
    const inp = input.current ?? { x: 0, y: 0 };
    const speed = boatSpeed * 9; // world units/sec at full stick
    const step = Math.min(dt, 1 / 20);
    // Twin-stick style: stick direction = travel direction (y is down→south).
    pos.current.x = THREE.MathUtils.clamp(pos.current.x + inp.x * speed * step, -ARENA, ARENA);
    pos.current.z = THREE.MathUtils.clamp(pos.current.z + inp.y * speed * step, -ARENA, ARENA);

    if (boatRef.current) {
      boatRef.current.position.copy(pos.current);
      const mag = Math.hypot(inp.x, inp.y);
      if (mag > 0.05) boatRef.current.rotation.y = Math.atan2(inp.x, inp.y);
      boatRef.current.position.y = Math.sin(performance.now() / 500) * 0.08; // gentle bob
    }

    // Follow camera (top-down, slightly behind).
    camera.position.set(pos.current.x, 17, pos.current.z + 10);
    camera.lookAt(pos.current.x, 0, pos.current.z);

    // Nearest buoy in range → notify React (only on change).
    let found: { spot: Spot; pos: [number, number] } | null = null;
    let best = NEAR;
    for (const b of buoys) {
      const d = Math.hypot(pos.current.x - b.pos[0], pos.current.z - b.pos[1]);
      if (d < best) {
        best = d;
        found = b;
      }
    }
    const id = found ? found.spot.id : null;
    if (id !== nearId.current) {
      nearId.current = id;
      onNear(found ? found.spot : null);
    }
  });

  return (
    <group>
      {/* Water */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[ARENA * 2 + 20, ARENA * 2 + 20, 24, 24]} />
        <meshStandardMaterial color={waterColor} flatShading roughness={0.5} />
      </mesh>

      {/* Boat */}
      <group ref={boatRef}>
        <mesh position={[0, 0.18, 0]} castShadow>
          <boxGeometry args={[0.9, 0.4, 2]} />
          <meshStandardMaterial color={palette.boatHull} flatShading roughness={1} />
        </mesh>
        <mesh position={[0, 0.2, 1.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <coneGeometry args={[0.45, 0.9, 4]} />
          <meshStandardMaterial color={palette.boatHull} flatShading roughness={1} />
        </mesh>
        <mesh position={[0, 0.42, -0.2]} castShadow>
          <boxGeometry args={[0.6, 0.3, 0.7]} />
          <meshStandardMaterial color={palette.sail} flatShading roughness={1} />
        </mesh>
      </group>

      {/* Buoys (fishing holes) */}
      {buoys.map((b, i) => (
        <Buoy key={i} pos={b.pos} />
      ))}

      {/* Ambient fish */}
      <Fish position={[-14, -0.02, 4]} color="#aacbe0" />
      <Fish position={[13, -0.02, -10]} color="#e7b6bc" dir={-1} />
      <Fish position={[4, -0.02, 14]} color="#e8c468" />
    </group>
  );
}

function Buoy({ pos }: { pos: [number, number] }) {
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (ringRef.current) {
      const s = 1 + (Math.sin(performance.now() / 350) * 0.5 + 0.5) * 0.5;
      ringRef.current.scale.set(s, s, s);
    }
  });
  return (
    <group position={[pos[0], 0, pos[1]]}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.22, 0.8, 8]} />
        <meshStandardMaterial color="#d4564f" flatShading roughness={1} />
      </mesh>
      <mesh position={[0, 0.8, 0]} castShadow>
        <sphereGeometry args={[0.16, 10, 8]} />
        <meshStandardMaterial color={palette.sail} flatShading roughness={1} />
      </mesh>
      <mesh ref={ringRef} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.7, 20]} />
        <meshBasicMaterial color={palette.sail} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

const ui: Record<string, CSSProperties> = {
  header: {
    position: "fixed",
    top: "max(14px, env(safe-area-inset-top))",
    left: 0,
    right: 0,
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "0 16px",
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    color: "#3c5a57",
  },
  dockBtn: { pointerEvents: "auto", border: "none", borderRadius: 18, padding: "8px 16px", fontSize: 14, fontWeight: 700, color: "#3c5a57", background: "rgba(255,255,255,0.85)", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", cursor: "pointer" },
  regionName: { fontSize: 16, fontWeight: 800, textShadow: "0 1px 3px rgba(255,255,255,0.6)" },
  stickWrap: { position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: "max(22px, env(safe-area-inset-bottom))" },
  fishWrap: { position: "fixed", left: 0, right: 0, top: "20%", display: "flex", justifyContent: "center", pointerEvents: "none" },
  fishBtn: { pointerEvents: "auto", border: "none", borderRadius: 24, padding: "13px 24px", fontSize: 15, fontWeight: 700, color: "#fff", background: "#3f9e6a", boxShadow: "0 4px 14px rgba(0,0,0,0.25)", cursor: "pointer" },
  fishDisabled: { background: "#aab7b8", cursor: "not-allowed" },
};

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { palette } from "../scene/palette";
import { Cloud, Fish, Gull, Islet, RippleRing } from "./MapDecor";
import { sfx } from "../audio/sfx";
import { Stick } from "../ui/Stick";
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
  onFish,
  onDock,
}: {
  region: Region;
  water: Water;
  boatSpeed: number;
  onFish: (spot: Spot) => void;
  onDock: () => void;
}) {
  // Stick input shared with the render loop (no per-frame React churn).
  const input = useRef({ x: 0, y: 0 });
  const [near, setNear] = useState<Spot | null>(null);

  // Kill the engine hum when leaving the boat view.
  useEffect(() => () => sfx.engineStop(), []);

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
        <button style={ui.dockBtn} onClick={() => { sfx.uiTap(); onDock(); }}>
          ⚓ Dock
        </button>
        <div style={ui.regionName}>{region.name} · {water === "fresh" ? "Lake" : "Ocean"}</div>
      </div>

      <div style={ui.stickWrap}>
        <Stick hint="drive" onMove={(x, y) => (input.current = { x, y })} onRelease={() => (input.current = { x: 0, y: 0 })} />
      </div>

      {near && (
        <div style={ui.fishWrap}>
          <button style={ui.fishBtn} onClick={() => { sfx.uiTap(); onFish(near); }}>
            🎣 Fish here · {near.name}
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
  const wakeRef = useRef<THREE.Mesh>(null);
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

    const mag = Math.hypot(inp.x, inp.y);
    sfx.engineSet(mag);
    if (boatRef.current) {
      boatRef.current.position.copy(pos.current);
      if (mag > 0.05) boatRef.current.rotation.y = Math.atan2(inp.x, inp.y);
      boatRef.current.position.y = Math.sin(performance.now() / 500) * 0.08; // gentle bob
      // lean into the throttle
      boatRef.current.rotation.x = -mag * 0.07;
    }
    // Foam wake trails the stern, stretching and fading with speed.
    if (wakeRef.current) {
      wakeRef.current.visible = mag > 0.08;
      const stretch = 1 + mag * 2.2;
      wakeRef.current.scale.set(1 + mag * 0.4, stretch, 1);
      (wakeRef.current.material as THREE.MeshBasicMaterial).opacity = 0.35 * mag;
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

      {/* Boat: white skiff with hull trim, bow deck, windshield, seat, outboard */}
      <group ref={boatRef}>
        {/* hull */}
        <mesh position={[0, 0.18, 0]} castShadow>
          <boxGeometry args={[0.9, 0.38, 2]} />
          <meshStandardMaterial color={palette.hullWhite} flatShading roughness={1} />
        </mesh>
        <mesh position={[0, 0.06, 0]} castShadow>
          <boxGeometry args={[0.94, 0.1, 2.04]} />
          <meshStandardMaterial color={palette.hullTrim} flatShading roughness={1} />
        </mesh>
        {/* pointed bow */}
        <mesh position={[0, 0.18, 1.2]} rotation={[Math.PI / 2, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[0.46, 0.9, 4]} />
          <meshStandardMaterial color={palette.hullWhite} flatShading roughness={1} />
        </mesh>
        {/* bow deck + windshield */}
        <mesh position={[0, 0.39, 0.75]} castShadow>
          <boxGeometry args={[0.8, 0.06, 0.7]} />
          <meshStandardMaterial color={palette.boatWood} flatShading roughness={1} />
        </mesh>
        <mesh position={[0, 0.55, 0.42]} rotation={[-0.35, 0, 0]} castShadow>
          <boxGeometry args={[0.7, 0.3, 0.04]} />
          <meshStandardMaterial color="#cfe6ec" flatShading roughness={0.3} transparent opacity={0.7} />
        </mesh>
        {/* console + captain's seat */}
        <mesh position={[0, 0.46, -0.15]} castShadow>
          <boxGeometry args={[0.5, 0.26, 0.4]} />
          <meshStandardMaterial color={palette.sail} flatShading roughness={1} />
        </mesh>
        <mesh position={[0, 0.44, -0.6]} castShadow>
          <boxGeometry args={[0.4, 0.3, 0.3]} />
          <meshStandardMaterial color={palette.hullTrim} flatShading roughness={1} />
        </mesh>
        {/* outboard motor */}
        <mesh position={[0, 0.32, -1.06]} castShadow>
          <boxGeometry args={[0.22, 0.28, 0.18]} />
          <meshStandardMaterial color="#5b5f63" flatShading roughness={1} />
        </mesh>
        <mesh position={[0, 0.08, -1.1]}>
          <boxGeometry args={[0.06, 0.3, 0.1]} />
          <meshStandardMaterial color="#4a4e52" flatShading roughness={1} />
        </mesh>
        {/* foam wake (visible when moving; scaled/faded in useFrame) */}
        <mesh ref={wakeRef} position={[0, 0.02, -2.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.9, 2.2]} />
          <meshBasicMaterial color={palette.foam} transparent opacity={0.3} depthWrite={false} />
        </mesh>
      </group>

      {/* Buoys (fishing holes) */}
      {buoys.map((b, i) => (
        <Buoy key={i} pos={b.pos} />
      ))}

      {/* Scenery: islets at the arena edges + ambient life */}
      <Islet position={[-17, -0.1, -14]} kind={water === "fresh" ? "pine" : "rock"} scale={1.2} />
      <Islet position={[16, -0.1, 15]} kind={water === "fresh" ? "pine" : "palm"} />
      <Islet position={[18, -0.1, -6]} kind="rock" scale={0.8} />
      <Fish position={[-14, -0.02, 4]} color="#aacbe0" />
      <Fish position={[13, -0.02, -10]} color="#e7b6bc" dir={-1} />
      <Fish position={[4, -0.02, 14]} color="#e8c468" />
      <Fish position={[-6, -0.02, -16]} color="#aacbe0" dir={-1} />
      <RippleRing position={[-14, -0.04, 4]} period={3} />
      <RippleRing position={[13, -0.04, -10]} period={2.6} />
      <RippleRing position={[8, -0.04, 6]} period={3.4} />
      <RippleRing position={[-9, -0.04, -7]} period={2.9} />
      <Cloud position={[-8, 7, -12]} scale={1.6} range={26} />
      <Cloud position={[10, 8, 6]} scale={1.2} speed={0.18} range={26} />
      <Gull position={[0, 4, 0]} radius={6} speed={0.3} />
      <Gull position={[-10, 4.5, 10]} radius={3} speed={0.45} />
    </group>
  );
}

function Buoy({ pos }: { pos: [number, number] }) {
  const ringRef = useRef<THREE.Mesh>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const seed = pos[0] * 1.3 + pos[1];
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed;
    if (ringRef.current) {
      const s = 1 + (Math.sin(t * 2.8) * 0.5 + 0.5) * 0.5;
      ringRef.current.scale.set(s, s, s);
    }
    // buoy bobs and tilts on the swell
    if (bodyRef.current) {
      bodyRef.current.position.y = Math.sin(t * 1.4) * 0.06;
      bodyRef.current.rotation.z = Math.sin(t * 1.1) * 0.08;
      bodyRef.current.rotation.x = Math.cos(t * 0.9) * 0.06;
    }
  });
  return (
    <group position={[pos[0], 0, pos[1]]}>
      <group ref={bodyRef}>
        {/* striped can buoy: red base, white band, red top */}
        <mesh position={[0, 0.22, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.26, 0.44, 8]} />
          <meshStandardMaterial color={palette.buoyRed} flatShading roughness={1} />
        </mesh>
        <mesh position={[0, 0.52, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.2, 0.22, 8]} />
          <meshStandardMaterial color={palette.sail} flatShading roughness={1} />
        </mesh>
        <mesh position={[0, 0.72, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.16, 0.2, 8]} />
          <meshStandardMaterial color={palette.buoyRed} flatShading roughness={1} />
        </mesh>
        {/* lamp + flag pole */}
        <mesh position={[0, 0.9, 0]}>
          <sphereGeometry args={[0.09, 8, 6]} />
          <meshStandardMaterial color="#ffe9a8" emissive="#ffdf80" emissiveIntensity={0.6} flatShading roughness={0.6} />
        </mesh>
        <mesh position={[0, 1.12, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.36, 4]} />
          <meshStandardMaterial color={palette.dockPost} flatShading roughness={1} />
        </mesh>
        <mesh position={[0.09, 1.22, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.06, 0.18, 3]} />
          <meshStandardMaterial color="#e8c468" flatShading roughness={1} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <mesh ref={ringRef} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.7, 20]} />
        <meshBasicMaterial color={palette.foam} transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} />
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
};

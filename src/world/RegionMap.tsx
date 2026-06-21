import { useState, type CSSProperties } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { palette } from "../scene/palette";
import { SpotCard } from "./SpotCard";
import { BOAT_BODIES, type Region, type Spot } from "./regions";

/**
 * Level 2 of the overworld: a low-poly diorama of one region. Land on the west,
 * ocean on the east; each fishing spot is a tappable POI pin. Tapping opens a
 * SpotCard → "Fish here" enters the fishing scene.
 */
export function RegionMap({
  region,
  currency,
  onTravel,
  onFishFoot,
  onBoat,
  canBoat,
  footFeeFor,
}: {
  region: Region;
  currency: number;
  onTravel: () => void;
  onFishFoot: (spot: Spot) => void;
  onBoat: (spot: Spot) => void;
  canBoat: (water: "fresh" | "salt") => boolean;
  footFeeFor: (spot: Spot) => number;
}) {
  const [selected, setSelected] = useState<Spot | null>(null);
  // Only land spots are pins; deep/offshore spots live in the boat view.
  const landSpots = region.spots.filter((s) => s.access === "land");

  return (
    <>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 14, 16], fov: 38, near: 0.1, far: 200 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={[palette.sky]} />
        <fog attach="fog" args={[palette.fog, 35, 80]} />
        <ambientLight intensity={0.9} />
        <hemisphereLight args={[palette.sky, palette.grassDark, 0.5]} />
        <directionalLight position={[8, 18, 6]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />

        {/* Ocean (covers everything; land sits on top to the west) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
          <planeGeometry args={[60, 40]} />
          <meshStandardMaterial color={palette.water} flatShading roughness={0.5} />
        </mesh>
        {/* Landmass (west side) */}
        <mesh position={[-3.5, 0.05, 0]} receiveShadow castShadow>
          <boxGeometry args={[13, 0.5, 20]} />
          <meshStandardMaterial color={palette.grass} flatShading roughness={1} />
        </mesh>
        {/* sandy shoreline strip */}
        <mesh position={[2.6, 0.02, 0]} receiveShadow>
          <boxGeometry args={[2.2, 0.46, 20]} />
          <meshStandardMaterial color={palette.sand} flatShading roughness={1} />
        </mesh>

        {/* Small water-body cues under fresh land spots */}
        {landSpots
          .filter((s) => s.water === "fresh")
          .map((s) => (
            <mesh key={`wb-${s.id}`} position={[s.pos[0], 0.32, s.pos[1]]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <circleGeometry args={[s.body === "stream" ? 0.7 : s.body === "river" ? 1.0 : 1.6, 20]} />
              <meshStandardMaterial color={palette.waterDeep} flatShading roughness={0.6} />
            </mesh>
          ))}

        {landSpots.map((s) => (
          <SpotPin key={s.id} spot={s} onSelect={setSelected} />
        ))}

        <OrbitControls
          target={[0, 0, 1]}
          maxPolarAngle={Math.PI / 2.3}
          minDistance={10}
          maxDistance={34}
          enablePan={false}
        />
      </Canvas>

      <div style={ui.header}>
        <button style={ui.backBtn} onClick={onTravel}>
          🗺 Travel
        </button>
        <div style={ui.regionName}>{region.name}</div>
      </div>

      {selected && (
        <SpotCard
          spot={selected}
          footFee={footFeeFor(selected)}
          currency={currency}
          offersBoat={BOAT_BODIES.includes(selected.body)}
          canBoat={canBoat(selected.water)}
          onFishFoot={onFishFoot}
          onBoat={onBoat}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function SpotPin({ spot, onSelect }: { spot: Spot; onSelect: (s: Spot) => void }) {
  const [hover, setHover] = useState(false);
  const [x, z] = spot.pos;
  const locked = spot.access === "boat";
  const base = spot.water === "fresh" ? "#4f8f74" : "#3f8fa0";
  const color = locked ? "#8a8f96" : base;

  return (
    <group position={[x, 0.45, z]} scale={hover ? 1.18 : 1}>
      <mesh
        position={[0, 0.5, 0]}
        castShadow
        onClick={(e) => {
          e.stopPropagation();
          onSelect(spot);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "auto";
        }}
      >
        <cylinderGeometry args={[0.14, 0.14, 1, 8]} />
        <meshStandardMaterial color={color} flatShading roughness={1} />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow>
        <sphereGeometry args={[0.34, 14, 12]} />
        <meshStandardMaterial color={color} flatShading roughness={1} />
      </mesh>
      <Html position={[0, 1.7, 0]} center distanceFactor={20} style={{ pointerEvents: "none" }}>
        <div style={ui.pinLabel}>
          {locked ? "🔒 " : ""}
          {spot.name}
        </div>
      </Html>
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
  backBtn: {
    pointerEvents: "auto",
    border: "none",
    borderRadius: 18,
    padding: "8px 16px",
    fontSize: 14,
    fontWeight: 700,
    color: "#3c5a57",
    background: "rgba(255,255,255,0.85)",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    cursor: "pointer",
  },
  regionName: { fontSize: 18, fontWeight: 800, textShadow: "0 1px 3px rgba(255,255,255,0.6)" },
  pinLabel: {
    background: "rgba(255,255,255,0.85)",
    borderRadius: 7,
    padding: "2px 7px",
    fontSize: 12,
    fontWeight: 700,
    color: "#3c5a57",
    whiteSpace: "nowrap",
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
  },
};

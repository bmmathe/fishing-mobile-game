import { useMemo, useState, type CSSProperties } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { palette } from "../scene/palette";
import { REGIONS, type Region } from "./regions";
import { Fish, Lake, Mountain, OilDerrick, PalmTree, PineTree } from "./MapDecor";

const DEPTH = 0.5; // region slab thickness (low-poly)

/**
 * Level 1 of the overworld: a stylized low-poly US silhouette partitioned into
 * the 4 regions, each a pastel area with boundary lines. Tap a region to zoom
 * into its spot map. (Geographic accuracy is cosmetic.)
 */
export function RegionSelect({ onPick }: { onPick: (regionId: string) => void }) {
  return (
    <>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 31, 23], fov: 36, near: 0.1, far: 200 }}
        onCreated={({ camera }) => camera.lookAt(0, 0, 1)}
        gl={{ antialias: true }}
      >
        <color attach="background" args={[palette.sky]} />
        <fog attach="fog" args={[palette.fog, 45, 100]} />
        <ambientLight intensity={0.95} />
        <hemisphereLight args={[palette.sky, palette.grassDark, 0.5]} />
        <directionalLight
          position={[8, 22, 6]}
          intensity={1.4}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />

        {/* Ocean */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
          <planeGeometry args={[90, 64]} />
          <meshStandardMaterial color={palette.water} flatShading roughness={0.5} />
        </mesh>

        {REGIONS.map((r) => (
          <RegionArea key={r.id} region={r} onPick={onPick} />
        ))}

        <MapDecorations />

        <OrbitControls target={[0, 0, 1]} maxPolarAngle={Math.PI / 2.4} minDistance={16} maxDistance={42} enablePan={false} />
      </Canvas>

      <div style={overlay.title}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>United States</h1>
        <p style={{ fontSize: 13, opacity: 0.8, margin: "2px 0 0" }}>Choose a region to fish</p>
      </div>
    </>
  );
}

function RegionArea({ region, onPick }: { region: Region; onPick: (id: string) => void }) {
  const [hover, setHover] = useState(false);
  const locked = !!region.locked;

  // Extrude the region polygon into a flat low-poly slab lying on the XZ plane.
  const geo = useMemo(() => {
    const shape = new THREE.Shape();
    region.shape.forEach(([x, z], i) => {
      const y = -z; // see derivation: rotateX(-90°) maps shape-y → world -z
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }, [region.shape]);

  // Boundary outline, slightly above the top face.
  const outline = useMemo<[number, number, number][]>(() => {
    const pts = region.shape.map(([x, z]) => [x, DEPTH + 0.04, z] as [number, number, number]);
    pts.push(pts[0]);
    return pts;
  }, [region.shape]);

  const [cx, cz] = region.pos;
  const active = hover && !locked;

  // Locked regions: no interaction, no hover lift, muted label.
  const handlers = locked
    ? {}
    : {
        onClick: (e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          onPick(region.id);
        },
        onPointerOver: (e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = "pointer";
        },
        onPointerOut: () => {
          setHover(false);
          document.body.style.cursor = "auto";
        },
      };

  return (
    <group position={[0, active ? 0.22 : 0, 0]}>
      <mesh geometry={geo} castShadow receiveShadow {...handlers}>
        <meshStandardMaterial
          color={region.color}
          flatShading
          roughness={1}
          emissive="#ffffff"
          emissiveIntensity={active ? 0.12 : 0}
        />
      </mesh>

      <Line points={outline} color="#f6f1e6" lineWidth={locked ? 1.5 : 2.5} />

      <Html position={[cx, DEPTH + 0.7, cz]} center distanceFactor={26} style={{ pointerEvents: "none" }}>
        <div style={{ ...overlay.pinLabel, ...(locked ? overlay.lockedLabel : null) }}>
          {locked ? `🔒 ${region.name}` : region.name}
        </div>
      </Html>
    </group>
  );
}

/** Cosmetic props placed around the map (raycast-ignored so clicks reach regions). */
function MapDecorations() {
  return (
    <group>
      {/* Pacific Northwest: mountains + pines */}
      <Mountain position={[-10.8, 0.5, -4.5]} scale={1.1} color="#8f9aa0" />
      <PineTree position={[-9.6, 0.5, -3.3]} />
      <PineTree position={[-10.2, 0.5, -2.5]} scale={0.85} />
      <PineTree position={[-9, 0.5, -4.7]} scale={0.9} />

      {/* California: a peak + a palm */}
      <Mountain position={[-10.1, 0.5, 0.3]} scale={0.95} color="#b0a48f" />
      <PalmTree position={[-8.7, 0.5, 3.2]} />

      {/* Mountain West (Rockies, gray locked) */}
      <Mountain position={[-6, 0.5, -2]} scale={0.95} color="#a6abb0" />
      <Mountain position={[-4.6, 0.5, 0.6]} scale={0.8} color="#aab0b4" />
      <Mountain position={[-5.4, 0.5, -0.5]} scale={0.7} color="#a0a6ab" />

      {/* Gulf / Texas: oil derrick + bayou cypress */}
      <OilDerrick position={[-1, 0.5, 5.6]} />
      <PineTree position={[1.4, 0.5, 5.2]} scale={0.9} />

      {/* Florida: palms */}
      <PalmTree position={[7.7, 0.5, 6]} />
      <PalmTree position={[8, 0.5, 4.7]} scale={0.85} />

      {/* Great Lakes (on the Midwest region) */}
      <Lake position={[3.3, 0.56, -4.1]} radius={0.8} color={palette.waterDeep} />
      <Lake position={[4.3, 0.56, -3.5]} radius={0.6} color={palette.waterDeep} />
      <Lake position={[2.7, 0.56, -3.4]} radius={0.55} color={palette.waterDeep} />
      <Lake position={[4.9, 0.56, -4.3]} radius={0.5} color={palette.waterDeep} />
      <Lake position={[3.9, 0.56, -2.8]} radius={0.5} color={palette.waterDeep} />

      {/* Ocean life (out in the water) */}
      <Fish position={[-13, -0.05, 2]} color="#e7b6bc" />
      <Fish position={[13, -0.05, 1]} color="#aacbe0" dir={-1} />
      <Fish position={[0.5, -0.05, 9.3]} color="#e8c468" />
      <Fish position={[10.5, -0.05, 5.6]} color="#e7b6bc" dir={-1} />
      <Fish position={[-12, -0.05, -3.5]} color="#aacbe0" />
    </group>
  );
}

const overlay: Record<string, CSSProperties> = {
  title: {
    position: "fixed",
    top: "max(16px, env(safe-area-inset-top))",
    left: 0,
    right: 0,
    textAlign: "center",
    color: "#3c5a57",
    textShadow: "0 1px 3px rgba(255,255,255,0.6)",
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    pointerEvents: "none",
  },
  pinLabel: {
    background: "rgba(255,255,255,0.9)",
    borderRadius: 8,
    padding: "3px 9px",
    fontSize: 13,
    fontWeight: 700,
    color: "#3c5a57",
    whiteSpace: "nowrap",
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
  },
  lockedLabel: {
    background: "rgba(238,238,238,0.8)",
    color: "#8a9095",
    fontWeight: 600,
  },
};

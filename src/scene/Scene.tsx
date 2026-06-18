import { Canvas } from "@react-three/fiber";
import { OrbitControls, SoftShadows } from "@react-three/drei";
import { palette } from "./palette";
import { Island } from "./Island";
import { Water } from "./Water";
import { Trees } from "./Trees";
import { Village } from "./Village";
import { Boat } from "./Boat";

/**
 * Placeholder low-poly scene. This is a "validate the look on device" scene,
 * not gameplay — it stands in for a real fishing location while we lock the
 * art direction. Everything is flat-shaded with a pastel palette to match the
 * concept art.
 */
export function Scene() {
  return (
    <Canvas
      shadows
      // Cap DPR so high-density phone screens don't tank the framerate.
      dpr={[1, 2]}
      camera={{ position: [14, 13, 14], fov: 35, near: 0.1, far: 200 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={[palette.sky]} />
      <fog attach="fog" args={[palette.fog, 30, 70]} />

      <SoftShadows size={28} samples={12} focus={0.8} />

      {/* Gentle ambient fill + a warm key light for soft faceted shadows */}
      <ambientLight intensity={0.85} />
      <hemisphereLight args={[palette.sky, palette.grassDark, 0.5]} />
      <directionalLight
        position={[12, 18, 8]}
        intensity={1.7}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
        shadow-bias={-0.0004}
      />

      <Water />
      <Island />
      <Trees />
      <Village />
      <Boat />

      {/* Dev-only camera control; gameplay will use a fixed/iso rig later. */}
      <OrbitControls
        target={[0, 0, 0]}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={8}
        maxDistance={40}
        enablePan={false}
      />
    </Canvas>
  );
}

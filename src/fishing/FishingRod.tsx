import type { Ref } from "react";
import type { Group, Object3D } from "three";

/** Graphite spinning-rod colors — not wood, so it doesn't read as a stick. */
const CORK = "#d2b48a";
const CORK_RING = "#a67c52";
const GRAPHITE = "#4a5850";
const GRAPHITE_TIP = "#6d7f74";
const REEL = "#5c6570";
const REEL_DARK = "#3a4148";
const SPOOL = "#c5cdd4";
const GUIDE = "#d8c49a";

/**
 * Low-poly spinning rod: cork grip, hanging reel, tapered graphite blank, and
 * line guides. Pivots as one group under load (same contract as the old single
 * cylinder) so the fight animation stays attached at `tipRef`.
 */
export function FishingRod({
  groupRef,
  tipRef,
}: {
  groupRef: Ref<Group>;
  tipRef: Ref<Object3D>;
}) {
  return (
    <group ref={groupRef} position={[0.32, 0.9, 0.25]}>
      <group position={[0, 0.1, 0.1]} rotation={[-0.7, 0, -0.12]}>
        {/* Butt cap */}
        <mesh position={[0, 0.03, 0]} castShadow>
          <cylinderGeometry args={[0.028, 0.032, 0.06, 8]} />
          <meshStandardMaterial color={REEL_DARK} flatShading roughness={0.55} metalness={0.25} />
        </mesh>

        {/* Cork grip + wrapping rings */}
        <mesh position={[0, 0.22, 0]} castShadow>
          <cylinderGeometry args={[0.038, 0.042, 0.32, 8]} />
          <meshStandardMaterial color={CORK} flatShading roughness={1} />
        </mesh>
        {[0.12, 0.22, 0.32].map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.016, 8]} />
            <meshStandardMaterial color={CORK_RING} flatShading roughness={1} />
          </mesh>
        ))}

        {/* Reel seat */}
        <mesh position={[0, 0.42, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.032, 0.1, 8]} />
          <meshStandardMaterial color={REEL_DARK} flatShading roughness={0.45} metalness={0.35} />
        </mesh>

        {/* Spinning reel — slightly oversized so the spool reads from the camera */}
        <group position={[0.1, 0.42, 0.02]} rotation={[0.1, 0.2, -0.25]} scale={1.35}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.072, 0.072, 0.055, 10]} />
            <meshStandardMaterial color={REEL} flatShading roughness={0.4} metalness={0.45} />
          </mesh>
          <mesh position={[0.038, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.05, 0.05, 0.038, 10]} />
            <meshStandardMaterial color={SPOOL} flatShading roughness={0.35} metalness={0.5} />
          </mesh>
          {/* Foot clamped onto the seat */}
          <mesh position={[-0.055, 0.015, 0]}>
            <boxGeometry args={[0.045, 0.032, 0.022]} />
            <meshStandardMaterial color={REEL_DARK} flatShading roughness={0.5} metalness={0.3} />
          </mesh>
          {/* Handle arm + knob */}
          <mesh position={[0.01, -0.095, 0.02]} rotation={[0.35, 0, 0.1]} castShadow>
            <cylinderGeometry args={[0.01, 0.01, 0.13, 5]} />
            <meshStandardMaterial color={REEL_DARK} flatShading roughness={0.5} metalness={0.3} />
          </mesh>
          <mesh position={[0.02, -0.155, 0.055]} castShadow>
            <sphereGeometry args={[0.024, 8, 6]} />
            <meshStandardMaterial color={CORK} flatShading roughness={1} />
          </mesh>
          {/* Bail wire */}
          <mesh rotation={[Math.PI / 2, 0, Math.PI / 2]}>
            <torusGeometry args={[0.078, 0.007, 5, 10, Math.PI]} />
            <meshStandardMaterial color={SPOOL} flatShading roughness={0.4} metalness={0.5} />
          </mesh>
        </group>

        {/* Foregrip */}
        <mesh position={[0, 0.54, 0]} castShadow>
          <cylinderGeometry args={[0.026, 0.03, 0.12, 7]} />
          <meshStandardMaterial color={CORK} flatShading roughness={1} />
        </mesh>

        {/* Tapered graphite blank (two segments so the tip reads thin) */}
        <mesh position={[0, 1.05, 0]} castShadow>
          <cylinderGeometry args={[0.014, 0.026, 0.9, 7]} />
          <meshStandardMaterial color={GRAPHITE} flatShading roughness={0.45} metalness={0.2} />
        </mesh>
        <mesh position={[0, 1.62, 0]} castShadow>
          <cylinderGeometry args={[0.006, 0.014, 0.55, 6]} />
          <meshStandardMaterial color={GRAPHITE_TIP} flatShading roughness={0.4} metalness={0.25} />
        </mesh>

        {/* Line guides, shrinking toward the tip */}
        {[
          { y: 0.72, r: 0.036 },
          { y: 1.0, r: 0.028 },
          { y: 1.28, r: 0.022 },
          { y: 1.52, r: 0.016 },
          { y: 1.78, r: 0.012 },
        ].map((g) => (
          <mesh key={g.y} position={[0, g.y, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[g.r, 0.0045, 5, 8]} />
            <meshStandardMaterial color={GUIDE} flatShading roughness={0.35} metalness={0.55} />
          </mesh>
        ))}

        <object3D ref={tipRef} position={[0, 1.9, 0]} />
      </group>
    </group>
  );
}

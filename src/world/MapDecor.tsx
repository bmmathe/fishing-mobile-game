import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

/**
 * Low-poly decorative props for the US map (mountains, trees, palms, an oil
 * derrick, ocean fish, Great Lakes). Purely cosmetic — they give each region a
 * sense of place. Positions are set by the caller; props sit on top of the
 * region slabs (region top is at y≈0.5).
 */

type V3 = [number, number, number];

export function Mountain({ position, scale = 1, color = "#9aa0a6" }: { position: V3; scale?: number; color?: string }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <coneGeometry args={[0.7, 1.2, 5]} />
        <meshStandardMaterial color={color} flatShading roughness={1} />
      </mesh>
      <mesh position={[0, 1.02, 0]}>
        <coneGeometry args={[0.26, 0.36, 5]} />
        <meshStandardMaterial color="#f4f1ea" flatShading roughness={1} />
      </mesh>
    </group>
  );
}

export function PineTree({ position, scale = 1 }: { position: V3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 0.45, 5]} />
        <meshStandardMaterial color="#9c7b54" flatShading roughness={1} />
      </mesh>
      <mesh position={[0, 0.62, 0]} castShadow>
        <coneGeometry args={[0.36, 0.7, 6]} />
        <meshStandardMaterial color="#6fae74" flatShading roughness={1} />
      </mesh>
      <mesh position={[0, 0.98, 0]} castShadow>
        <coneGeometry args={[0.27, 0.55, 6]} />
        <meshStandardMaterial color="#7bb56a" flatShading roughness={1} />
      </mesh>
    </group>
  );
}

export function PalmTree({ position, scale = 1 }: { position: V3; scale?: number }) {
  const fronds = [0, 1, 2, 3, 4];
  return (
    <group position={position} scale={scale}>
      <mesh position={[0.05, 0.5, 0]} rotation={[0, 0, 0.18]} castShadow>
        <cylinderGeometry args={[0.05, 0.08, 1.0, 5]} />
        <meshStandardMaterial color="#b08b54" flatShading roughness={1} />
      </mesh>
      {fronds.map((i) => (
        <mesh
          key={i}
          position={[0.12, 1.0, 0]}
          rotation={[0.5, (i / fronds.length) * Math.PI * 2, 0]}
          castShadow
        >
          <coneGeometry args={[0.13, 0.6, 4]} />
          <meshStandardMaterial color="#7cb86a" flatShading roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

export function OilDerrick({ position, scale = 1 }: { position: V3; scale?: number }) {
  const legs: V3[] = [
    [0.22, 0, 0.22],
    [-0.22, 0, 0.22],
    [0.22, 0, -0.22],
    [-0.22, 0, -0.22],
  ];
  const dark = "#5b5f63";
  return (
    <group position={position} scale={scale}>
      {legs.map((l, i) => (
        <mesh key={i} position={[l[0] / 2, 0.55, l[2] / 2]} rotation={[l[2] * 0.6, 0, -l[0] * 0.6]} castShadow>
          <cylinderGeometry args={[0.035, 0.05, 1.2, 4]} />
          <meshStandardMaterial color={dark} flatShading roughness={1} />
        </mesh>
      ))}
      {/* cross brace + top */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[0.34, 0.05, 0.34]} />
        <meshStandardMaterial color={dark} flatShading roughness={1} />
      </mesh>
      <mesh position={[0, 1.12, 0]}>
        <boxGeometry args={[0.16, 0.18, 0.16]} />
        <meshStandardMaterial color="#6f7479" flatShading roughness={1} />
      </mesh>
    </group>
  );
}

/** A flat low-poly fish that drifts/bobs gently on the ocean surface. */
export function Fish({ position, scale = 1, color = "#e7b6bc", dir = 1 }: { position: V3; scale?: number; color?: string; dir?: number }) {
  const ref = useRef<Group>(null);
  const seed = position[0] + position[2];
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime + seed;
    ref.current.position.y = position[1] + Math.sin(t * 1.2) * 0.04;
    ref.current.rotation.y = Math.PI / 2 + Math.sin(t * 0.5) * 0.3 * dir;
  });
  return (
    <group ref={ref} position={position} scale={scale}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.16, 0.5, 6]} />
        <meshStandardMaterial color={color} flatShading roughness={1} />
      </mesh>
      <mesh position={[0, 0, -0.3]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.12, 0.22, 4]} />
        <meshStandardMaterial color={color} flatShading roughness={1} />
      </mesh>
    </group>
  );
}

/** A flat blue water blob, e.g. for the Great Lakes. */
export function Lake({ position, radius = 1, color = "#5aa9bd" }: { position: V3; radius?: number; color?: string }) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[radius, 16]} />
      <meshStandardMaterial color={color} flatShading roughness={0.5} />
    </mesh>
  );
}

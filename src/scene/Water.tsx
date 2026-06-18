import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import { palette } from "./palette";

/**
 * A large faceted water plane with a slow vertical bob so the surface reads as
 * "alive" without per-vertex wave shaders (cheap on mobile).
 */
export function Water() {
  const ref = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = -0.15 + Math.sin(clock.elapsedTime * 0.6) * 0.05;
    }
  });

  return (
    <mesh
      ref={ref}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.15, 0]}
      receiveShadow
    >
      <planeGeometry args={[120, 120, 24, 24]} />
      <meshStandardMaterial
        color={palette.water}
        flatShading
        roughness={0.45}
        metalness={0.0}
        transparent
        opacity={0.92}
      />
    </mesh>
  );
}

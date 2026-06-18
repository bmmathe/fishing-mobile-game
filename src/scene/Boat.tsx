import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { palette } from "./palette";

/**
 * A little fishing boat moored beside the dock, bobbing and rocking gently on
 * the water — a nod to the boat ownership progression in the PRD.
 */
export function Boat() {
  const ref = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.position.y = -0.05 + Math.sin(t * 0.8) * 0.06;
    ref.current.rotation.z = Math.sin(t * 0.7) * 0.04;
    ref.current.rotation.x = Math.cos(t * 0.5) * 0.03;
  });

  return (
    <group ref={ref} position={[3.4, 0, 12.5]} rotation={[0, -0.4, 0]}>
      {/* Hull */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[1.4, 0.6, 3]} />
        <meshStandardMaterial color={palette.boatHull} flatShading roughness={1} />
      </mesh>
      {/* Tapered bow */}
      <mesh position={[0, 0.2, 1.8]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.7, 1.2, 4]} />
        <meshStandardMaterial color={palette.boatHull} flatShading roughness={1} />
      </mesh>
      {/* Deck */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[1.2, 0.1, 2.6]} />
        <meshStandardMaterial color={palette.boatWood} flatShading roughness={1} />
      </mesh>
      {/* Mast */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 2, 6]} />
        <meshStandardMaterial color={palette.trunk} flatShading roughness={1} />
      </mesh>
      {/* Sail */}
      <mesh position={[0, 1.5, 0.02]} rotation={[0, 0, 0]} castShadow>
        <planeGeometry args={[1.1, 1.4]} />
        <meshStandardMaterial
          color={palette.sail}
          flatShading
          roughness={1}
          side={2 /* THREE.DoubleSide */}
        />
      </mesh>
    </group>
  );
}

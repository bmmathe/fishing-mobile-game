import { palette } from "./palette";

type HouseSpec = {
  pos: [number, number, number];
  rotation?: number;
  wall: string;
  roof: string;
};

/**
 * A handful of cozy low-poly houses: a box body with a pyramid/prism roof and
 * a little chimney. Stand-ins for the town that surrounds a fishing location.
 */
export function Village() {
  const houses: HouseSpec[] = [
    { pos: [-5, 0.6, -4], rotation: 0.2, wall: palette.wall, roof: palette.roofPink },
    { pos: [5.5, 0.6, -4.5], rotation: -0.3, wall: palette.wallAlt, roof: palette.roofBlue },
    { pos: [4.5, 0.6, 2.5], rotation: 0.1, wall: palette.wall, roof: palette.roofSage },
    { pos: [-5, 0.6, 4], rotation: -0.15, wall: palette.wallAlt, roof: palette.roofPink },
  ];

  return (
    <group>
      {houses.map((h, i) => (
        <House key={i} {...h} />
      ))}
    </group>
  );
}

function House({ pos, rotation = 0, wall, roof }: HouseSpec) {
  return (
    <group position={pos} rotation={[0, rotation, 0]}>
      {/* Body */}
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <boxGeometry args={[2, 1.5, 1.7]} />
        <meshStandardMaterial color={wall} flatShading roughness={1} />
      </mesh>

      {/* Pyramid roof (4-sided cone) */}
      <mesh position={[0, 1.95, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[1.65, 1, 4]} />
        <meshStandardMaterial color={roof} flatShading roughness={1} />
      </mesh>

      {/* Chimney */}
      <mesh position={[0.6, 2.1, 0.3]} castShadow>
        <boxGeometry args={[0.28, 0.6, 0.28]} />
        <meshStandardMaterial color={palette.trunk} flatShading roughness={1} />
      </mesh>

      {/* Door */}
      <mesh position={[0, 0.45, 0.86]}>
        <boxGeometry args={[0.45, 0.8, 0.05]} />
        <meshStandardMaterial color={palette.boatHull} flatShading roughness={1} />
      </mesh>
    </group>
  );
}

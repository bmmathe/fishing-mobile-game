import { palette } from "./palette";

/**
 * The landmass: a low grassy block with a sandy shoreline rim and a simple
 * footpath. Kept blocky and flat-shaded to match the concept art.
 */
export function Island() {
  return (
    <group>
      {/* Sand shoreline (slightly larger, sits just below the grass) */}
      <mesh position={[0, -0.1, 0]} receiveShadow castShadow>
        <boxGeometry args={[22, 0.6, 22]} />
        <meshStandardMaterial color={palette.sand} flatShading roughness={1} />
      </mesh>

      {/* Grass top */}
      <mesh position={[0, 0.25, 0]} receiveShadow castShadow>
        <boxGeometry args={[20, 0.7, 20]} />
        <meshStandardMaterial color={palette.grass} flatShading roughness={1} />
      </mesh>

      {/* Footpath strip */}
      <mesh position={[0, 0.61, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.4, 18]} />
        <meshStandardMaterial color={palette.path} flatShading roughness={1} />
      </mesh>

      {/* Wooden dock reaching into the water */}
      <group position={[0, 0.4, 11.5]}>
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.2, 0.25, 6]} />
          <meshStandardMaterial color={palette.boatWood} flatShading roughness={1} />
        </mesh>
        {[-0.8, 0.8].map((x) =>
          [1.5, -1.5].map((z) => (
            <mesh key={`${x}-${z}`} position={[x, -0.5, z]} castShadow>
              <cylinderGeometry args={[0.12, 0.12, 1.2, 6]} />
              <meshStandardMaterial color={palette.trunk} flatShading roughness={1} />
            </mesh>
          )),
        )}
      </group>
    </group>
  );
}

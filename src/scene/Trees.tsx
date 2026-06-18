import { useMemo } from "react";
import { palette } from "./palette";

type TreeSpec = {
  pos: [number, number, number];
  scale: number;
  kind: "round" | "pine";
};

/**
 * Scattered low-poly trees. Two silhouettes — a rounded broadleaf
 * (icosahedron canopy) and a pine (stacked cones) — for visual variety.
 *
 * NOTE: this placeholder maps plain meshes since there are only a dozen trees.
 * For dense foliage in real locations, switch to instanced meshes (drei
 * <Instances>) to keep draw calls low on mobile.
 */
export function Trees() {
  const trees = useMemo<TreeSpec[]>(
    () => [
      { pos: [-7, 0.6, -6], scale: 1.1, kind: "round" },
      { pos: [-8, 0.6, 2], scale: 0.9, kind: "pine" },
      { pos: [-5.5, 0.6, 6], scale: 1.0, kind: "round" },
      { pos: [6.5, 0.6, -7], scale: 1.2, kind: "pine" },
      { pos: [8, 0.6, -2], scale: 0.95, kind: "round" },
      { pos: [7, 0.6, 5], scale: 1.05, kind: "pine" },
      { pos: [-6.5, 0.6, -1], scale: 0.8, kind: "round" },
      { pos: [3.5, 0.6, 7.5], scale: 0.9, kind: "round" },
      { pos: [-3.5, 0.6, -8], scale: 1.0, kind: "pine" },
      { pos: [5, 0.6, 8], scale: 0.85, kind: "pine" },
    ],
    [],
  );

  return (
    <group>
      {trees.map((t, i) => (
        <Tree key={i} {...t} />
      ))}
    </group>
  );
}

function Tree({ pos, scale, kind }: TreeSpec) {
  return (
    <group position={pos} scale={scale}>
      {/* Trunk */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.18, 1, 6]} />
        <meshStandardMaterial color={palette.trunk} flatShading roughness={1} />
      </mesh>

      {kind === "round" ? (
        <mesh position={[0, 1.5, 0]} castShadow>
          <icosahedronGeometry args={[0.85, 0]} />
          <meshStandardMaterial color={palette.treeLeaf} flatShading roughness={1} />
        </mesh>
      ) : (
        <>
          <mesh position={[0, 1.3, 0]} castShadow>
            <coneGeometry args={[0.8, 1.1, 7]} />
            <meshStandardMaterial color={palette.treePine} flatShading roughness={1} />
          </mesh>
          <mesh position={[0, 1.9, 0]} castShadow>
            <coneGeometry args={[0.6, 0.9, 7]} />
            <meshStandardMaterial color={palette.treePine} flatShading roughness={1} />
          </mesh>
        </>
      )}
    </group>
  );
}

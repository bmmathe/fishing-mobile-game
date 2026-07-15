import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Group } from "three";
import { palette } from "../scene/palette";

/**
 * Low-poly decorative props shared by the overworld scenes (US map, region
 * diorama, boat view, fishing view). Purely cosmetic — they give each place a
 * sense of, well, place. Positions are set by the caller; props sit on top of
 * whatever surface the caller puts them on.
 *
 * Perf notes: everything is flat-shaded standard material, tiny vertex counts,
 * and any animation mutates refs inside useFrame (no React churn, no per-frame
 * allocation).
 */

type V3 = [number, number, number];

/** Shared radial-gradient texture for cheap contact shadows (one texture for all blobs). */
let blobShadowTexture: THREE.CanvasTexture | null = null;
function getBlobShadowTexture() {
  if (blobShadowTexture) return blobShadowTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  // Cool green-grey, kept faint — the art style wants pale shade, not dark blobs.
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  g.addColorStop(0, "rgba(46, 66, 58, 0.26)");
  g.addColorStop(0.6, "rgba(46, 66, 58, 0.12)");
  g.addColorStop(1, "rgba(46, 66, 58, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  blobShadowTexture = new THREE.CanvasTexture(c);
  return blobShadowTexture;
}

/** Soft contact shadow blob that grounds a prop. Place at the prop's base. */
export function BlobShadow({ position, radius = 0.4 }: { position: V3; radius?: number }) {
  const map = useMemo(getBlobShadowTexture, []);
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <circleGeometry args={[radius, 16]} />
      <meshBasicMaterial map={map} transparent depthWrite={false} />
    </mesh>
  );
}

/** A small cluster of 2–3 faceted peaks with snow caps (reads better than one cone). */
export function Mountain({ position, scale = 1, color = "#9aa0a6" }: { position: V3; scale?: number; color?: string }) {
  return (
    <group position={position} scale={scale}>
      <BlobShadow position={[0, 0.01, 0]} radius={1.1} />
      {/* main peak */}
      <mesh position={[0, 0.55, 0]} rotation={[0, 0.4, 0]} castShadow>
        <coneGeometry args={[0.7, 1.2, 5]} />
        <meshStandardMaterial color={color} flatShading roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.02, 0]} rotation={[0, 0.4, 0]}>
        <coneGeometry args={[0.26, 0.36, 5]} />
        <meshStandardMaterial color="#f4f1ea" flatShading roughness={1} />
      </mesh>
      {/* shoulder peaks */}
      <mesh position={[0.55, 0.32, 0.25]} rotation={[0, 1.1, 0]} castShadow>
        <coneGeometry args={[0.42, 0.72, 5]} />
        <meshStandardMaterial color={color} flatShading roughness={0.9} />
      </mesh>
      <mesh position={[0.55, 0.6, 0.25]} rotation={[0, 1.1, 0]}>
        <coneGeometry args={[0.15, 0.2, 5]} />
        <meshStandardMaterial color="#f4f1ea" flatShading roughness={1} />
      </mesh>
      <mesh position={[-0.5, 0.26, -0.2]} rotation={[0, 2.2, 0]} castShadow>
        <coneGeometry args={[0.36, 0.6, 5]} />
        <meshStandardMaterial color={color} flatShading roughness={0.9} />
      </mesh>
    </group>
  );
}

/** Three-tier pine with a slight lean so a row of them doesn't look stamped. */
/** Gentle wind sway for tree canopies (trunks stay planted). amp is radians; keep <= 0.04.
 *  The per-tree seed MUST differ or synchronized sway looks mechanical. */
function Sway({ children, seed = 0, amp = 0.025 }: { children: ReactNode; seed?: number; amp?: number }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime + seed;
    ref.current.rotation.z = Math.sin(t * 1.3) * amp;
    ref.current.rotation.x = Math.sin(t * 0.9 + 1.7) * amp * 0.6;
  });
  return <group ref={ref}>{children}</group>;
}

export function PineTree({ position, scale = 1, lean = 0 }: { position: V3; scale?: number; lean?: number }) {
  return (
    <group position={position} scale={scale} rotation={[0, 0, lean]}>
      <BlobShadow position={[0, 0.01, 0]} radius={0.45} />
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 0.45, 5]} />
        <meshStandardMaterial color={palette.trunk} flatShading roughness={1} />
      </mesh>
      <Sway seed={position[0] * 3 + position[2]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <coneGeometry args={[0.4, 0.6, 6]} />
          <meshStandardMaterial color={palette.treePine} flatShading roughness={1} />
        </mesh>
        <mesh position={[0, 0.88, 0]} castShadow>
          <coneGeometry args={[0.31, 0.52, 6]} />
          <meshStandardMaterial color={palette.treeLeafAlt} flatShading roughness={1} />
        </mesh>
        <mesh position={[0, 1.18, 0]} castShadow>
          <coneGeometry args={[0.2, 0.4, 6]} />
          <meshStandardMaterial color={palette.treeLeaf} flatShading roughness={1} />
        </mesh>
      </Sway>
    </group>
  );
}

/** Round-canopy deciduous tree (two offset blobs so the crown reads faceted). */
export function LeafTree({ position, scale = 1 }: { position: V3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <BlobShadow position={[0.05, 0.01, 0.03]} radius={0.42} />
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.1, 0.5, 5]} />
        <meshStandardMaterial color={palette.trunk} flatShading roughness={1} />
      </mesh>
      <Sway seed={position[0] * 3 + position[2]}>
        <mesh position={[0, 0.68, 0]} castShadow>
          <icosahedronGeometry args={[0.36, 0]} />
          <meshStandardMaterial color={palette.treeLeaf} flatShading roughness={1} />
        </mesh>
        <mesh position={[0.18, 0.52, 0.1]} castShadow>
          <icosahedronGeometry args={[0.24, 0]} />
          <meshStandardMaterial color={palette.treeLeafAlt} flatShading roughness={1} />
        </mesh>
      </Sway>
    </group>
  );
}

/** Palm with a curved trunk (stacked leaning segments) and drooping fronds. */
export function PalmTree({ position, scale = 1 }: { position: V3; scale?: number }) {
  const fronds = [0, 1, 2, 3, 4, 5];
  return (
    <group position={position} scale={scale}>
      <BlobShadow position={[0.15, 0.01, 0]} radius={0.5} />
      {/* curved trunk from three leaning segments */}
      <mesh position={[0, 0.2, 0]} rotation={[0, 0, 0.1]} castShadow>
        <cylinderGeometry args={[0.06, 0.09, 0.42, 5]} />
        <meshStandardMaterial color="#b08b54" flatShading roughness={1} />
      </mesh>
      <mesh position={[0.07, 0.56, 0]} rotation={[0, 0, 0.22]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 0.4, 5]} />
        <meshStandardMaterial color="#a5824e" flatShading roughness={1} />
      </mesh>
      <mesh position={[0.18, 0.9, 0]} rotation={[0, 0, 0.32]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 0.36, 5]} />
        <meshStandardMaterial color="#b08b54" flatShading roughness={1} />
      </mesh>
      {/* coconuts */}
      <mesh position={[0.24, 1.04, 0.04]}>
        <icosahedronGeometry args={[0.06, 0]} />
        <meshStandardMaterial color="#8a6a45" flatShading roughness={1} />
      </mesh>
      <Sway seed={position[0] * 3 + position[2]} amp={0.04}>
        {fronds.map((i) => (
          <mesh
            key={i}
            position={[0.26, 1.12, 0]}
            rotation={[0.62, (i / fronds.length) * Math.PI * 2, 0]}
            castShadow
          >
            <coneGeometry args={[0.11, 0.68, 4]} />
            <meshStandardMaterial color={i % 2 ? "#7cb86a" : "#6fae5e"} flatShading roughness={1} />
          </mesh>
        ))}
      </Sway>
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
      {/* cross braces + crown block */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[0.4, 0.04, 0.4]} />
        <meshStandardMaterial color={dark} flatShading roughness={1} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[0.28, 0.04, 0.28]} />
        <meshStandardMaterial color={dark} flatShading roughness={1} />
      </mesh>
      <mesh position={[0, 1.12, 0]}>
        <boxGeometry args={[0.16, 0.18, 0.16]} />
        <meshStandardMaterial color="#6f7479" flatShading roughness={1} />
      </mesh>
    </group>
  );
}

/** A low-poly fish that drifts/bobs on the surface with a waggling tail. */
export function Fish({ position, scale = 1, color = "#e7b6bc", dir = 1 }: { position: V3; scale?: number; color?: string; dir?: number }) {
  const ref = useRef<Group>(null);
  const tailRef = useRef<Group>(null);
  const seed = position[0] + position[2];
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed;
    if (ref.current) {
      ref.current.position.y = position[1] + Math.sin(t * 1.2) * 0.04;
      ref.current.rotation.y = Math.PI / 2 + Math.sin(t * 0.5) * 0.3 * dir;
      ref.current.rotation.z = Math.sin(t * 1.6) * 0.08;
    }
    if (tailRef.current) tailRef.current.rotation.y = Math.sin(t * 6) * 0.45;
  });
  return (
    <group ref={ref} position={position} scale={scale}>
      {/* body */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.16, 0.5, 6]} />
        <meshStandardMaterial color={color} flatShading roughness={1} />
      </mesh>
      {/* dorsal fin */}
      <mesh position={[0, 0.14, -0.02]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.05, 0.14, 4]} />
        <meshStandardMaterial color={color} flatShading roughness={1} />
      </mesh>
      {/* tail (waggles) */}
      <group ref={tailRef} position={[0, 0, -0.25]}>
        <mesh position={[0, 0, -0.08]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.12, 0.22, 4]} />
          <meshStandardMaterial color={color} flatShading roughness={1} />
        </mesh>
      </group>
    </group>
  );
}

/** A flat blue water blob with a lighter shallow rim, e.g. for the Great Lakes. */
export function Lake({ position, radius = 1, color = "#5aa9bd" }: { position: V3; radius?: number; color?: string }) {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius, 16]} />
        <meshStandardMaterial color={color} flatShading roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius * 1.14, 16]} />
        <meshStandardMaterial color={palette.waterShallow} flatShading roughness={0.6} />
      </mesh>
    </group>
  );
}

/** Puffy low-poly cloud that drifts slowly and loops around. */
export function Cloud({ position, scale = 1, speed = 0.25, range = 14 }: { position: V3; scale?: number; speed?: number; range?: number }) {
  const ref = useRef<Group>(null);
  const seed = position[2] * 3.7;
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime * speed + seed;
    // drift west→east, wrap around
    const x = ((position[0] + t) % (range * 2)) - range;
    ref.current.position.x = x;
  });
  return (
    <group ref={ref} position={position} scale={scale}>
      {/* faked ground shadow drifting with the cloud — a real castShadow reads
          too hard/dark for the airy style. Local y puts it just above the land top. */}
      <group scale={[1.5, 1, 1.1]} position={[0, (0.34 - position[1]) / scale, 0]}>
        <BlobShadow position={[0, 0, 0]} radius={0.9} />
      </group>
      <mesh>
        <icosahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial color={palette.cloud} flatShading roughness={1} />
      </mesh>
      <mesh position={[0.55, -0.08, 0.1]}>
        <icosahedronGeometry args={[0.38, 0]} />
        <meshStandardMaterial color={palette.cloud} flatShading roughness={1} />
      </mesh>
      <mesh position={[-0.5, -0.1, -0.05]}>
        <icosahedronGeometry args={[0.34, 0]} />
        <meshStandardMaterial color={palette.cloud} flatShading roughness={1} />
      </mesh>
    </group>
  );
}

/** A gliding seagull: two flapping wing planes on a tiny body, circling its anchor. */
export function Gull({ position, scale = 1, radius = 2.2, speed = 0.5 }: { position: V3; scale?: number; radius?: number; speed?: number }) {
  const ref = useRef<Group>(null);
  const lRef = useRef<THREE.Mesh>(null);
  const rRef = useRef<THREE.Mesh>(null);
  const seed = position[0] * 1.3 + position[2];
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ref.current) {
      const a = t * speed + seed;
      ref.current.position.set(position[0] + Math.cos(a) * radius, position[1] + Math.sin(t * 1.1 + seed) * 0.25, position[2] + Math.sin(a) * radius);
      ref.current.rotation.y = -a - Math.PI / 2;
    }
    const flap = Math.sin(t * 7 + seed) * 0.55;
    if (lRef.current) lRef.current.rotation.z = flap;
    if (rRef.current) rRef.current.rotation.z = -flap;
  });
  return (
    <group ref={ref} position={position} scale={scale}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.05, 0.22, 5]} />
        <meshStandardMaterial color={palette.gull} flatShading roughness={1} />
      </mesh>
      <mesh ref={lRef} position={[-0.02, 0.02, 0]}>
        <boxGeometry args={[0.34, 0.015, 0.09]} />
        <meshStandardMaterial color={palette.gullWing} flatShading roughness={1} />
      </mesh>
      <mesh ref={rRef} position={[0.02, 0.02, 0]}>
        <boxGeometry args={[0.34, 0.015, 0.09]} />
        <meshStandardMaterial color={palette.gullWing} flatShading roughness={1} />
      </mesh>
    </group>
  );
}

/** A faceted boulder (or a small cluster when cluster=true). */
export function Rock({ position, scale = 1, cluster = false, color = palette.rock }: { position: V3; scale?: number; cluster?: boolean; color?: string }) {
  return (
    <group position={position} scale={scale}>
      <BlobShadow position={[0, 0.01, 0]} radius={0.3} />
      <mesh position={[0, 0.12, 0]} rotation={[0.3, 0.8, 0.1]} castShadow>
        <icosahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial color={color} flatShading roughness={0.85} />
      </mesh>
      {cluster && (
        <>
          <BlobShadow position={[0.24, 0.01, 0.08]} radius={0.18} />
          <mesh position={[0.26, 0.07, 0.1]} rotation={[0.8, 0.2, 0.5]} castShadow>
            <icosahedronGeometry args={[0.13, 0]} />
            <meshStandardMaterial color={palette.rockDark} flatShading roughness={0.85} />
          </mesh>
          <mesh position={[-0.2, 0.05, -0.14]} rotation={[0.2, 1.4, 0.9]} castShadow>
            <icosahedronGeometry args={[0.1, 0]} />
            <meshStandardMaterial color={palette.rockDark} flatShading roughness={0.85} />
          </mesh>
        </>
      )}
    </group>
  );
}

/** A saguaro cactus for the desert southwest. */
export function Cactus({ position, scale = 1 }: { position: V3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.11, 0.9, 7]} />
        <meshStandardMaterial color={palette.cactus} flatShading roughness={1} />
      </mesh>
      <mesh position={[0.2, 0.5, 0]} rotation={[0, 0, -0.9]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 0.26, 6]} />
        <meshStandardMaterial color={palette.cactus} flatShading roughness={1} />
      </mesh>
      <mesh position={[0.29, 0.66, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.3, 6]} />
        <meshStandardMaterial color={palette.cactus} flatShading roughness={1} />
      </mesh>
      <mesh position={[-0.17, 0.36, 0]} rotation={[0, 0, 0.9]} castShadow>
        <cylinderGeometry args={[0.045, 0.055, 0.22, 6]} />
        <meshStandardMaterial color={palette.cactus} flatShading roughness={1} />
      </mesh>
      <mesh position={[-0.24, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.045, 0.24, 6]} />
        <meshStandardMaterial color={palette.cactus} flatShading roughness={1} />
      </mesh>
    </group>
  );
}

/** A striped lighthouse with a light room, for rocky coasts. */
export function Lighthouse({ position, scale = 1 }: { position: V3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.24, 1.0, 8]} />
        <meshStandardMaterial color={palette.lighthouse} flatShading roughness={1} />
      </mesh>
      <mesh position={[0, 0.62, 0]} castShadow>
        <cylinderGeometry args={[0.185, 0.2, 0.2, 8]} />
        <meshStandardMaterial color={palette.lighthouseRed} flatShading roughness={1} />
      </mesh>
      <mesh position={[0, 0.24, 0]} castShadow>
        <cylinderGeometry args={[0.225, 0.24, 0.2, 8]} />
        <meshStandardMaterial color={palette.lighthouseRed} flatShading roughness={1} />
      </mesh>
      {/* light room + roof */}
      <mesh position={[0, 1.08, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.16, 8]} />
        <meshStandardMaterial color="#ffe9a8" emissive="#ffdf80" emissiveIntensity={0.7} flatShading roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.24, 0]} castShadow>
        <coneGeometry args={[0.16, 0.18, 8]} />
        <meshStandardMaterial color={palette.lighthouseRed} flatShading roughness={1} />
      </mesh>
    </group>
  );
}

/** A patch of prairie wheat: a few golden tufts. */
export function WheatPatch({ position, scale = 1 }: { position: V3; scale?: number }) {
  const tufts: V3[] = [
    [0, 0, 0],
    [0.28, 0, 0.12],
    [-0.24, 0, 0.2],
    [0.1, 0, -0.25],
    [-0.12, 0, -0.1],
  ];
  return (
    <group position={position} scale={scale}>
      {tufts.map((t, i) => (
        <mesh key={i} position={[t[0], 0.16, t[2]]} rotation={[0, i, (i % 3 - 1) * 0.12]} castShadow>
          <coneGeometry args={[0.05, 0.36, 4]} />
          <meshStandardMaterial color={palette.wheat} flatShading roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/** Shoreline reeds/cattails poking out of shallow water. */
export function Reeds({ position, scale = 1 }: { position: V3; scale?: number }) {
  const blades: { p: V3; h: number; lean: number }[] = [
    { p: [0, 0, 0], h: 0.6, lean: 0.05 },
    { p: [0.1, 0, 0.06], h: 0.5, lean: -0.12 },
    { p: [-0.09, 0, 0.04], h: 0.68, lean: 0.14 },
    { p: [0.04, 0, -0.09], h: 0.44, lean: -0.06 },
  ];
  return (
    <group position={position} scale={scale}>
      <BlobShadow position={[0, 0.01, 0]} radius={0.16} />
      {blades.map((b, i) => (
        <group key={i} position={b.p} rotation={[0, i * 1.3, b.lean]}>
          <mesh position={[0, b.h / 2, 0]} castShadow>
            <cylinderGeometry args={[0.012, 0.02, b.h, 4]} />
            <meshStandardMaterial color={palette.reed} flatShading roughness={1} />
          </mesh>
          {i % 2 === 0 && (
            <mesh position={[0, b.h + 0.05, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.12, 5]} />
              <meshStandardMaterial color={palette.reedTip} flatShading roughness={1} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

/** Lily pad with an optional blossom, floats flat on the water. */
export function LilyPad({ position, scale = 1, flower = false }: { position: V3; scale?: number; flower?: boolean }) {
  return (
    <group position={position} scale={scale}>
      <mesh rotation={[-Math.PI / 2, 0.6, 0]}>
        <circleGeometry args={[0.16, 7, 0.5, Math.PI * 1.8]} />
        <meshStandardMaterial color={palette.treeLeaf} flatShading roughness={1} side={THREE.DoubleSide} />
      </mesh>
      {flower && (
        <mesh position={[0.04, 0.04, 0.02]}>
          <coneGeometry args={[0.05, 0.09, 5]} />
          <meshStandardMaterial color={palette.roofPink} flatShading roughness={1} />
        </mesh>
      )}
    </group>
  );
}

/**
 * A plank dock on posts, extending toward +Z. Used by the region diorama for
 * dock/pier spots and by the fishing scene as the angler's platform.
 */
export function Dock({ position, scale = 1, planks = 5, width = 1.4, rotation = 0 }: { position: V3; scale?: number; planks?: number; width?: number; rotation?: number }) {
  const plankDepth = 0.42;
  const rows = useMemo(() => Array.from({ length: planks }, (_, i) => i), [planks]);
  return (
    <group position={position} scale={scale} rotation={[0, rotation, 0]}>
      {rows.map((i) => (
        <mesh key={i} position={[0, 0.3, i * (plankDepth + 0.04)]} castShadow receiveShadow>
          <boxGeometry args={[width, 0.07, plankDepth]} />
          <meshStandardMaterial color={i % 2 ? palette.boatWood : "#c09a64"} flatShading roughness={1} />
        </mesh>
      ))}
      {/* posts at both ends and midway */}
      {[0.5, planks - 0.5].map((row) =>
        [-1, 1].map((side) => (
          <mesh key={`${row}-${side}`} position={[side * (width / 2 - 0.06), 0.05, row * (plankDepth + 0.04)]} castShadow>
            <cylinderGeometry args={[0.05, 0.06, 0.62, 6]} />
            <meshStandardMaterial color={palette.dockPost} flatShading roughness={1} />
          </mesh>
        )),
      )}
    </group>
  );
}

/** A tiny anchored sailboat that bobs and sways on its mooring. */
export function Sailboat({ position, scale = 1 }: { position: V3; scale?: number }) {
  const ref = useRef<Group>(null);
  const seed = position[0] * 2.1 + position[2];
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime + seed;
    ref.current.position.y = position[1] + Math.sin(t * 1.1) * 0.05;
    ref.current.rotation.z = Math.sin(t * 0.8) * 0.06;
    ref.current.rotation.y = seed + Math.sin(t * 0.3) * 0.2;
  });
  return (
    <group ref={ref} position={position} scale={scale}>
      <mesh position={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[0.34, 0.16, 0.9]} />
        <meshStandardMaterial color={palette.boatHull} flatShading roughness={1} />
      </mesh>
      <mesh position={[0, 0.5, 0.05]}>
        <cylinderGeometry args={[0.015, 0.02, 0.7, 4]} />
        <meshStandardMaterial color={palette.trunk} flatShading roughness={1} />
      </mesh>
      {/* triangular sail from a squashed cone */}
      <mesh position={[0, 0.52, -0.12]} rotation={[0, Math.PI / 2, 0]} scale={[0.05, 1, 1]} castShadow>
        <coneGeometry args={[0.3, 0.55, 3]} />
        <meshStandardMaterial color={palette.sail} flatShading roughness={1} />
      </mesh>
    </group>
  );
}

/** An expanding, fading foam ring on the water (continuous ripple loop). */
export function RippleRing({ position, period = 2.4, size = 1, maxOpacity = 0.45 }: { position: V3; period?: number; size?: number; maxOpacity?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const seed = position[0] + position[2] * 0.7;
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = ((clock.elapsedTime + seed) % period) / period;
    const s = (0.4 + t * 1.6) * size;
    ref.current.scale.set(s, s, s);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = maxOpacity * (1 - t);
  });
  return (
    <mesh ref={ref} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.42, 0.5, 20]} />
      <meshBasicMaterial color={palette.foam} transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

/** A ring of tiny grass-tuft cones around a POI (single InstancedMesh, one draw call). */
export function GrassTufts({ center, innerRadius, outerRadius, count = 40, seed = 1 }:
  { center: [number, number, number]; innerRadius: number; outerRadius: number; count?: number; seed?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  // Deterministic placement so the map looks identical every visit (no Math.random).
  useEffect(() => {
    const m = ref.current; if (!m) return;
    const dummy = new THREE.Object3D();
    let s = seed;
    const rand = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = innerRadius + rand() * (outerRadius - innerRadius);
      dummy.position.set(center[0] + Math.cos(a) * r, center[1], center[2] + Math.sin(a) * r);
      const sc = 0.5 + rand() * 0.8;
      dummy.scale.set(sc, sc * (0.7 + rand() * 0.6), sc);
      dummy.rotation.y = rand() * Math.PI;
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [center, innerRadius, outerRadius, count, seed]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} raycast={() => null} receiveShadow>
      <coneGeometry args={[0.05, 0.22, 4]} />
      <meshStandardMaterial color={palette.reed} flatShading roughness={1} />
    </instancedMesh>
  );
}

/** A ring of tiny squashed pebbles around a POI (single InstancedMesh, one draw call). */
export function Pebbles({ center, innerRadius, outerRadius, count = 25, seed = 1 }:
  { center: [number, number, number]; innerRadius: number; outerRadius: number; count?: number; seed?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = ref.current; if (!m) return;
    const dummy = new THREE.Object3D();
    let s = seed;
    const rand = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = innerRadius + rand() * (outerRadius - innerRadius);
      dummy.position.set(center[0] + Math.cos(a) * r, center[1], center[2] + Math.sin(a) * r);
      const sc = 0.5 + rand() * 0.8;
      dummy.scale.set(sc, sc * 0.6, sc);
      dummy.rotation.y = rand() * Math.PI;
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [center, innerRadius, outerRadius, count, seed]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} raycast={() => null} receiveShadow>
      <icosahedronGeometry args={[0.05, 0]} />
      <meshStandardMaterial color={palette.pebble} flatShading roughness={1} />
    </instancedMesh>
  );
}

/** A small rocky island with a couple of props on it. */
export function Islet({ position, scale = 1, kind = "pine" }: { position: V3; scale?: number; kind?: "pine" | "palm" | "rock" }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, -0.1, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.0, 1.35, 0.5, 8]} />
        <meshStandardMaterial color={palette.sand} flatShading roughness={1} />
      </mesh>
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.72, 0.95, 0.24, 8]} />
        <meshStandardMaterial color={palette.grass} flatShading roughness={1} />
      </mesh>
      {kind === "pine" && <PineTree position={[0.1, 0.22, 0]} scale={0.9} />}
      {kind === "palm" && <PalmTree position={[0, 0.22, 0.1]} scale={0.85} />}
      {kind === "rock" && <Rock position={[0, 0.22, 0]} cluster scale={1.4} />}
      <Rock position={[-0.55, 0.2, 0.3]} scale={0.7} />
    </group>
  );
}

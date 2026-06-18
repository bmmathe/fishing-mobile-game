import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { palette } from "../scene/palette";
import type { FishingStore } from "./fishingStore";

/** How far out (in world Z) the fish sits at full starting distance. */
const MAX_Z = 13;
const MIN_Z = 2.2;
const LATERAL = 4.2;

const UP = new THREE.Vector3(0, 1, 0);
const GREEN = new THREE.Color(palette.treePine);
const YELLOW = new THREE.Color("#e8c468");
const RED = new THREE.Color("#d4564f");

/** Position/orient a unit-Y cylinder so it spans points a→b. */
function spanSegment(obj: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  const len = a.distanceTo(b);
  obj.position.copy(a).add(b).multiplyScalar(0.5);
  const dir = b.clone().sub(a).normalize();
  obj.quaternion.setFromUnitVectors(UP, dir);
  obj.scale.set(1, Math.max(len, 0.0001), 1);
}

export function FishingScene({ store }: { store: FishingStore }) {
  const rodRef = useRef<THREE.Group>(null);
  const rodTipRef = useRef<THREE.Object3D>(null);
  const lineRef = useRef<THREE.Mesh>(null);
  const fishRef = useRef<THREE.Group>(null);
  const fishBodyRef = useRef<THREE.Mesh>(null);
  const rippleRef = useRef<THREE.Mesh>(null);
  const waterRef = useRef<THREE.Mesh>(null);
  const lastColor = useRef("");

  // Scratch vectors reused each frame (no per-frame allocation).
  const v = useMemo(() => ({ tip: new THREE.Vector3(), fish: new THREE.Vector3(), col: new THREE.Color() }), []);

  useFrame((_, dt) => {
    store.advance(dt);
    const s = store.state;
    const t = performance.now() / 1000;

    // Gentle water bob.
    if (waterRef.current) waterRef.current.position.y = -0.05 + Math.sin(t * 0.6) * 0.04;

    const active = s.phase === "waiting" || s.phase === "bite" || s.phase === "fighting";
    if (fishRef.current) fishRef.current.visible = active;
    if (lineRef.current) lineRef.current.visible = active;

    // Recolor the marker to the species only once hooked; keep a neutral red
    // bobber while waiting so the color doesn't spoil what's biting.
    const reveal = s.phase === "fighting" || s.phase === "bite";
    const markerColor = reveal ? store.fish.color : "#d4564f";
    if (fishBodyRef.current && markerColor !== lastColor.current) {
      lastColor.current = markerColor;
      (fishBodyRef.current.material as THREE.MeshStandardMaterial).color.set(markerColor);
    }

    // Rod load: bends toward the water as tension rises, tilts with steer.
    if (rodRef.current) {
      const bend = Math.min(s.tension / store.line.maxTension, 1.2) * 0.45;
      rodRef.current.rotation.x = -bend - (s.phase === "bite" ? 0.15 : 0);
      rodRef.current.rotation.z = -store.input.steer * 0.18;
    }

    if (!active || !rodTipRef.current || !fishRef.current || !lineRef.current) return;

    // Fish world position from distance (depth) + lateral pull direction.
    const dz = s.distance / s.startDistance;
    const fx = s.fishDirCurrent * LATERAL;
    const fz = MIN_Z + dz * (MAX_Z - MIN_Z);
    const splash = s.running ? Math.sin(t * 22) * 0.06 : 0;
    // Nibble tell: the bobber twitches and dips just before the bite.
    const nibbling = store.nibbling;
    const dip = nibbling ? Math.max(0, Math.sin(t * 13)) * 0.1 : 0;
    const jitter = nibbling ? Math.sin(t * 31) * 0.05 : 0;
    v.fish.set(fx + jitter, 0.06 + splash - dip, fz);
    fishRef.current.position.copy(v.fish);

    // Ripple pulse (faster/stronger on a run or a nibble).
    if (rippleRef.current) {
      const rate = s.running ? 8 : nibbling ? 10 : 3;
      const amp = s.running ? 0.9 : nibbling ? 0.7 : 0.4;
      const pulse = 1 + (Math.sin(t * rate) * 0.5 + 0.5) * amp;
      rippleRef.current.scale.set(pulse, pulse, pulse);
    }

    // Stretch the line from the rod tip to the fish, colored by tension.
    rodTipRef.current.getWorldPosition(v.tip);
    spanSegment(lineRef.current, v.tip, v.fish);
    const ratio = Math.min(s.tension / store.line.maxTension, 1);
    if (ratio < 0.5) v.col.copy(GREEN).lerp(YELLOW, ratio / 0.5);
    else v.col.copy(YELLOW).lerp(RED, (ratio - 0.5) / 0.5);
    (lineRef.current.material as THREE.MeshBasicMaterial).color.copy(v.col);
  });

  return (
    <group>
      {/* Lighting */}
      <color attach="background" args={[palette.sky]} />
      <fog attach="fog" args={[palette.fog, 22, 55]} />
      <ambientLight intensity={0.85} />
      <hemisphereLight args={[palette.sky, palette.grassDark, 0.5]} />
      <directionalLight
        position={[8, 14, -4]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />

      {/* Water */}
      <mesh ref={waterRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80, 20, 20]} />
        <meshStandardMaterial color={palette.water} flatShading roughness={0.5} transparent opacity={0.95} />
      </mesh>

      {/* Dock the angler stands on (behind, at the near edge) */}
      <mesh position={[0, 0.25, -1.2]} castShadow receiveShadow>
        <boxGeometry args={[6, 0.5, 4]} />
        <meshStandardMaterial color={palette.boatWood} flatShading roughness={1} />
      </mesh>
      <mesh position={[0, -0.05, -1.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[6, 4]} />
        <meshStandardMaterial color={palette.sand} flatShading roughness={1} />
      </mesh>

      {/* Angler (stationary) */}
      <group position={[0, 0.5, -0.8]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <cylinderGeometry args={[0.32, 0.4, 1.0, 8]} />
          <meshStandardMaterial color={palette.roofBlue} flatShading roughness={1} />
        </mesh>
        <mesh position={[0, 1.25, 0]} castShadow>
          <sphereGeometry args={[0.27, 12, 10]} />
          <meshStandardMaterial color={palette.sand} flatShading roughness={1} />
        </mesh>
        {/* simple hat */}
        <mesh position={[0, 1.45, 0]} castShadow>
          <coneGeometry args={[0.34, 0.3, 10]} />
          <meshStandardMaterial color={palette.roofSage} flatShading roughness={1} />
        </mesh>

        {/* Rod: pivots at the grip, bends under load. The cylinder and the
            tip marker share one transform so the line stays attached. */}
        <group ref={rodRef} position={[0.32, 0.9, 0.25]}>
          <group position={[0, 0.1, 0.1]} rotation={[-0.7, 0, -0.12]}>
            <mesh position={[0, 0.95, 0]} castShadow>
              <cylinderGeometry args={[0.025, 0.05, 1.9, 6]} />
              <meshStandardMaterial color={palette.trunk} flatShading roughness={1} />
            </mesh>
            {/* invisible marker at the rod tip; line is anchored to its world pos */}
            <object3D ref={rodTipRef} position={[0, 1.9, 0]} />
          </group>
        </group>
      </group>

      {/* Fishing line (cylinder spanning rod tip → fish, recolored by tension) */}
      <mesh ref={lineRef}>
        <cylinderGeometry args={[0.018, 0.018, 1, 5]} />
        <meshBasicMaterial color={GREEN} />
      </mesh>

      {/* Fish marker / bobber + ripple */}
      <group ref={fishRef}>
        <mesh ref={fishBodyRef} position={[0, 0.08, 0]} castShadow>
          <sphereGeometry args={[0.16, 10, 8]} />
          <meshStandardMaterial color={RED} flatShading roughness={1} />
        </mesh>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <sphereGeometry args={[0.1, 8, 6]} />
          <meshStandardMaterial color={palette.sail} flatShading roughness={1} />
        </mesh>
        <mesh ref={rippleRef} position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.22, 0.32, 18]} />
          <meshBasicMaterial color={palette.sail} transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

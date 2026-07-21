import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import * as THREE from "three";
import { palette } from "../scene/palette";
import { Cloud, Gull, Islet, Reeds, Rock } from "../world/MapDecor";
import { TUNING } from "./fishingModel";
import type { FishingStore } from "./fishingStore";

/** How far out (in world Z) the fish sits at full starting distance. */
const MAX_Z = 13;
const MIN_Z = 2.2;
const LATERAL = 4.2;

const UP = new THREE.Vector3(0, 1, 0);

/** Water plane dimensions — shared by the geometry and the height sampler
 *  (so the float can ride the exact same surface the mesh renders). */
const WATER_SIZE = 80;
const WATER_SEG = 60;
/** World Y the water mesh is parked at (its rippling vertices bob around this). */
const WATER_BASE_Y = -0.05;

/** Sun placement ranges for the Preetham sky, in the three.js example's own
 *  terms. A low elevation (degrees above the horizon) gives the golden-hour
 *  glow + visible sun disc; azimuth 0 is straight out across the water in
 *  front of the fixed camera (which looks toward +Z), so we swing it a little
 *  left/right of that. Randomized per fishing session so each trip feels like
 *  a slightly different time of day. */
const SUN_ELEVATION_RANGE: [number, number] = [0.5, 6]; // low, golden-hour (stays warm)
const SUN_AZIMUTH_SPREAD = 20; // ±10° off-center, sun stays comfortably in view

/** Roll a fresh sun direction for one fishing session. */
function randomSunPosition(): THREE.Vector3 {
  const elevation = THREE.MathUtils.randFloat(SUN_ELEVATION_RANGE[0], SUN_ELEVATION_RANGE[1]);
  const azimuth = THREE.MathUtils.randFloatSpread(SUN_AZIMUTH_SPREAD);
  const phi = THREE.MathUtils.degToRad(90 - elevation);
  const theta = THREE.MathUtils.degToRad(azimuth);
  return new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
}

const GREEN = new THREE.Color(palette.treePine);
const YELLOW = new THREE.Color("#e8c468");
const RED = new THREE.Color("#d4564f");

/** Local wave height of the rippling water plane at world (x, z), bilinearly
 *  interpolated from the four surrounding grid vertices. Call after the plane's
 *  vertices have been updated for the frame; add WATER_BASE_Y for world height. */
function sampleWaterHeight(pos: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, x: number, z: number): number {
  const step = WATER_SIZE / WATER_SEG;
  const gx = THREE.MathUtils.clamp((x + WATER_SIZE / 2) / step, 0, WATER_SEG);
  const gz = THREE.MathUtils.clamp((z + WATER_SIZE / 2) / step, 0, WATER_SEG);
  const ix = Math.floor(Math.min(gx, WATER_SEG - 1));
  const iz = Math.floor(Math.min(gz, WATER_SEG - 1));
  const tx = gx - ix;
  const tz = gz - iz;
  const row = WATER_SEG + 1;
  const y00 = pos.getY(iz * row + ix);
  const y10 = pos.getY(iz * row + ix + 1);
  const y01 = pos.getY((iz + 1) * row + ix);
  const y11 = pos.getY((iz + 1) * row + ix + 1);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(y00, y10, tx), THREE.MathUtils.lerp(y01, y11, tx), tz);
}

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
  const bobberVisualRef = useRef<THREE.Group>(null);
  const rippleRef = useRef<THREE.Mesh>(null);
  const waterRef = useRef<THREE.Mesh>(null);

  // Scratch vectors reused each frame (no per-frame allocation).
  const v = useMemo(() => ({ tip: new THREE.Vector3(), fish: new THREE.Vector3(), col: new THREE.Color() }), []);

  // Roll the sun once per session (the scene remounts each time you cast off),
  // so the sky's position/height varies trip to trip.
  const sunPosition = useMemo(() => randomSunPosition(), []);

  // Rippling water surface: a horizontal plane whose vertices bob on sine
  // waves (per-vertex amplitude + phase, à la the classic three.js example).
  // The rotateX is baked into the geometry so setY moves each vertex straight
  // up; the mesh itself is left unrotated. Amplitudes are kept small so the
  // surface reads as calm pastel water, not chop.
  const water = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE, WATER_SEG, WATER_SEG);
    geometry.rotateX(-Math.PI / 2);
    const pos = geometry.attributes.position;
    const tmp = new THREE.Vector3();
    const waves: { initY: number; amp: number; phaseA: number; phaseB: number }[] = [];
    for (let i = 0; i < pos.count; i++) {
      tmp.fromBufferAttribute(pos, i);
      // Two crossing swells (diagonal + anti-diagonal) interfere for an
      // organic, faceted surface. The spatial terms keep neighbouring
      // vertices moving together; a little jitter breaks up the regularity.
      const jitter = THREE.MathUtils.randFloatSpread(0.6);
      waves.push({
        initY: tmp.y,
        amp: THREE.MathUtils.randFloat(0.1, 0.17),
        phaseA: (tmp.x + tmp.z) * 0.95 + jitter,
        phaseB: (tmp.x - tmp.z) * 0.7 + jitter,
      });
    }
    return { geometry, waves };
  }, []);

  useFrame((_, dt) => {
    store.advance(dt);
    const s = store.state;
    const t = performance.now() / 1000;

    // Ripple the water surface: bob each vertex on its own sine wave. With
    // flatShading the material re-derives face normals from the moving
    // positions, so the low-poly facets shimmer as the swells pass.
    const wpos = water.geometry.attributes.position;
    for (let i = 0; i < water.waves.length; i++) {
      const w = water.waves[i];
      const y = w.initY + Math.sin(t * 1.3 + w.phaseA) * w.amp + Math.cos(t * 0.9 + w.phaseB) * w.amp * 0.85;
      wpos.setY(i, y);
    }
    wpos.needsUpdate = true;

    const active = s.phase === "waiting" || s.phase === "bite" || s.phase === "fighting";
    const biting = s.phase === "bite";
    if (fishRef.current) fishRef.current.visible = active;
    if (lineRef.current) lineRef.current.visible = active;

    // Rod load: bends toward the water as tension rises, tilts with steer.
    if (rodRef.current) {
      const bend = Math.min(s.tension / store.line.maxTension, 1.2) * 0.45;
      rodRef.current.rotation.x = -bend - (biting ? 0.22 : 0);
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
    let dip = nibbling ? Math.max(0, Math.sin(t * 13)) * 0.1 : 0;
    let bobberVisible = true;
    if (biting) {
      const elapsed = TUNING.biteWindow - s.biteTimer;
      const sinkT = Math.min(1, elapsed / 0.38);
      const eased = 1 - (1 - sinkT) ** 3;
      dip = eased * 0.44;
      bobberVisible = eased < 0.55;
    }
    const jitter = nibbling ? Math.sin(t * 31) * 0.05 : 0;
    // Let the float ride the swells: lift it by the water height sampled at its
    // own position (the plane's vertices were updated above this frame).
    const wave = sampleWaterHeight(wpos, fx + jitter, fz);
    v.fish.set(fx + jitter, 0.06 + wave + splash - dip, fz);
    fishRef.current.position.copy(v.fish);
    if (bobberVisualRef.current) bobberVisualRef.current.visible = bobberVisible;

    // Ripple pulse (faster/stronger on a run, nibble, or hard bite).
    if (rippleRef.current) {
      const rate = s.running ? 8 : biting ? 14 : nibbling ? 10 : 3;
      const amp = s.running ? 0.9 : biting ? 1.25 : nibbling ? 0.7 : 0.4;
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
      {/* Lighting — golden hour. */}
      <color attach="background" args={["#f3d9b8"]} />
      {/* Warm, glowing fog so distant islets melt into the sunset horizon
          instead of fading to mint. */}
      <fog attach="fog" args={["#f3d9b8", 22, 55]} />

      {/* Atmospheric sky dome — three.js Preetham "sky + sun" shader via drei.
          The sun sits low on the water (SUN_ELEVATION_DEG) so we get the
          reference's dynamic look: a warm gold horizon with a real sun disc,
          fading up into teal-blue. These are the example's own default
          scattering values (turbidity 10, rayleigh 2). */}
      <Sky
        distance={4000}
        sunPosition={sunPosition}
        turbidity={10}
        rayleigh={3}
        mieCoefficient={0.005}
        mieDirectionalG={0.7}
      />
      {/* Fill stays bright and warm so the scene reads as golden glow, never a
          dark silhouette. Intensities are pushed up to counter the low tone-
          mapping exposure (set on the Canvas) that enriches the sky — so the
          diorama surfaces keep their light, airy feel. */}
      <ambientLight intensity={1.5} color="#ffe9cf" />
      <hemisphereLight args={["#ffe1b8", "#d8b98a", 1.1]} />
      {/* Warm key light. Kept high/to the side (not at the low sun) so the
          angler and dock stay lit toward the camera rather than backlit. */}
      <directionalLight
        position={[6, 11, 2]}
        intensity={2.8}
        color="#ffdba6"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />

      {/* Water */}
      <mesh ref={waterRef} geometry={water.geometry} position={[0, WATER_BASE_Y, 0]} receiveShadow>
        <meshStandardMaterial color={palette.water} flatShading roughness={0.5} transparent opacity={0.95} />
      </mesh>

      {/* Plank dock the angler stands on (behind, at the near edge) */}
      <group position={[0, 0, -1.2]}>
        {/* planks (alternating tones), running across the dock */}
        {[-1.7, -1.1, -0.5, 0.1, 0.7, 1.3].map((z, i) => (
          <mesh key={i} position={[0, 0.46, z]} castShadow receiveShadow>
            <boxGeometry args={[6, 0.09, 0.54]} />
            <meshStandardMaterial color={i % 2 ? palette.boatWood : "#c09a64"} flatShading roughness={1} />
          </mesh>
        ))}
        {/* skirt + support posts into the water */}
        <mesh position={[0, 0.18, 0]} receiveShadow>
          <boxGeometry args={[5.9, 0.5, 3.9]} />
          <meshStandardMaterial color={palette.dockPost} flatShading roughness={1} />
        </mesh>
        {[
          [-2.8, 1.55],
          [2.8, 1.55],
          [-2.8, -1.7],
          [2.8, -1.7],
          [0, 1.55],
        ].map(([px, pz], i) => (
          <mesh key={i} position={[px, -0.1, pz]} castShadow>
            <cylinderGeometry args={[0.09, 0.11, 1.1, 6]} />
            <meshStandardMaterial color={palette.dockPost} flatShading roughness={1} />
          </mesh>
        ))}
        {/* bait bucket + tackle box props */}
        <mesh position={[-1.1, 0.66, 0.3]} castShadow>
          <cylinderGeometry args={[0.18, 0.15, 0.3, 9]} />
          <meshStandardMaterial color={palette.hullTrim} flatShading roughness={1} />
        </mesh>
        <mesh position={[1.2, 0.62, 0.5]} castShadow>
          <boxGeometry args={[0.42, 0.22, 0.26]} />
          <meshStandardMaterial color={palette.buoyRed} flatShading roughness={1} />
        </mesh>
        <mesh position={[1.2, 0.75, 0.5]}>
          <boxGeometry args={[0.44, 0.05, 0.28]} />
          <meshStandardMaterial color="#b23f39" flatShading roughness={1} />
        </mesh>
      </group>

      {/* Angler (stationary) */}
      <group position={[0, 0.5, -0.8]}>
        {/* legs + boots */}
        <mesh position={[-0.13, 0.12, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.1, 0.42, 6]} />
          <meshStandardMaterial color="#7a6a52" flatShading roughness={1} />
        </mesh>
        <mesh position={[0.13, 0.12, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.1, 0.42, 6]} />
          <meshStandardMaterial color="#7a6a52" flatShading roughness={1} />
        </mesh>
        <mesh position={[-0.13, -0.05, 0.05]} castShadow>
          <boxGeometry args={[0.14, 0.1, 0.26]} />
          <meshStandardMaterial color="#5b5346" flatShading roughness={1} />
        </mesh>
        <mesh position={[0.13, -0.05, 0.05]} castShadow>
          <boxGeometry args={[0.14, 0.1, 0.26]} />
          <meshStandardMaterial color="#5b5346" flatShading roughness={1} />
        </mesh>
        {/* torso: fishing vest over a shirt */}
        <mesh position={[0, 0.62, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.36, 0.75, 8]} />
          <meshStandardMaterial color={palette.roofBlue} flatShading roughness={1} />
        </mesh>
        <mesh position={[0, 0.72, 0]} castShadow>
          <cylinderGeometry args={[0.32, 0.35, 0.45, 8]} />
          <meshStandardMaterial color={palette.roofSage} flatShading roughness={1} />
        </mesh>
        {/* arms reaching toward the rod grip */}
        <mesh position={[0.26, 0.82, 0.14]} rotation={[-0.7, 0, -0.5]} castShadow>
          <cylinderGeometry args={[0.07, 0.08, 0.5, 6]} />
          <meshStandardMaterial color={palette.roofBlue} flatShading roughness={1} />
        </mesh>
        <mesh position={[-0.2, 0.85, 0.18]} rotation={[-0.9, 0, 0.55]} castShadow>
          <cylinderGeometry args={[0.07, 0.08, 0.52, 6]} />
          <meshStandardMaterial color={palette.roofBlue} flatShading roughness={1} />
        </mesh>
        {/* hands on the grip */}
        <mesh position={[0.32, 0.98, 0.28]} castShadow>
          <sphereGeometry args={[0.08, 8, 6]} />
          <meshStandardMaterial color="#e8c9a4" flatShading roughness={1} />
        </mesh>
        <mesh position={[0.06, 1.02, 0.33]} castShadow>
          <sphereGeometry args={[0.08, 8, 6]} />
          <meshStandardMaterial color="#e8c9a4" flatShading roughness={1} />
        </mesh>
        {/* head */}
        <mesh position={[0, 1.25, 0]} castShadow>
          <sphereGeometry args={[0.27, 12, 10]} />
          <meshStandardMaterial color="#e8c9a4" flatShading roughness={1} />
        </mesh>
        {/* bucket hat: brim + crown */}
        <mesh position={[0, 1.42, 0]} castShadow>
          <cylinderGeometry args={[0.42, 0.46, 0.06, 10]} />
          <meshStandardMaterial color={palette.roofSage} flatShading roughness={1} />
        </mesh>
        <mesh position={[0, 1.52, 0]} castShadow>
          <cylinderGeometry args={[0.24, 0.3, 0.22, 10]} />
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
        <group ref={bobberVisualRef}>
          {/* top half: neutral red bobber — species is revealed only after landing */}
          <mesh ref={fishBodyRef} position={[0, 0.08, 0]} castShadow>
            <sphereGeometry args={[0.16, 10, 8]} />
            <meshStandardMaterial color={RED} flatShading roughness={1} />
          </mesh>
          {/* white lower half + antenna: classic two-tone float */}
          <mesh position={[0, 0.04, 0]}>
            <sphereGeometry args={[0.14, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
            <meshStandardMaterial color={palette.sail} flatShading roughness={1} />
          </mesh>
          <mesh position={[0, 0.26, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.1, 5]} />
            <meshStandardMaterial color={palette.sail} flatShading roughness={1} />
          </mesh>
        </group>
        {/* dark shape under the surface — "something's down there" */}
        <mesh position={[0, -0.06, 0.15]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.6, 1, 1]}>
          <circleGeometry args={[0.42, 12]} />
          <meshBasicMaterial color="#33606e" transparent opacity={0.45} depthWrite={false} />
        </mesh>
        <mesh ref={rippleRef} position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.22, 0.32, 18]} />
          <meshBasicMaterial color={palette.sail} transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Shore dressing at the dock edges */}
      <Reeds position={[-3.4, 0.1, 0.9]} scale={1.2} />
      <Reeds position={[3.5, 0.1, 0.6]} scale={1.0} />
      <Reeds position={[-4.2, 0.05, -0.4]} scale={0.9} />
      <Rock position={[4.3, 0.02, -0.2]} cluster />
      <Rock position={[-4.8, 0.02, 0.4]} scale={0.8} />

      {/* Distant scenery across the water (softened by fog) */}
      <Islet position={[-12, -0.15, 24]} kind="pine" scale={2.2} />
      <Islet position={[14, -0.15, 30]} kind="rock" scale={1.8} />
      <Islet position={[2, -0.15, 38]} kind="pine" scale={2.6} />
      <Cloud position={[-8, 8, 26]} scale={2.2} range={20} speed={0.15} />
      <Cloud position={[9, 9.5, 34]} scale={1.8} range={20} speed={0.1} />
      <Gull position={[-5, 4.5, 14]} radius={3} speed={0.35} />
      <Gull position={[6, 5.5, 20]} radius={4} speed={0.25} />
    </group>
  );
}

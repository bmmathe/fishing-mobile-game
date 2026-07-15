import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { palette } from "../scene/palette";
import { MapOrbitControls } from "./MapControls";
import { SpotCard } from "./SpotCard";
import { BOAT_BODIES, type Region, type Spot } from "./regions";
import { sfx } from "../audio/sfx";
import {
  Cloud,
  Dock,
  Fish,
  GrassTufts,
  Gull,
  LeafTree,
  LilyPad,
  Mountain,
  Pebbles,
  PineTree,
  Reeds,
  RippleRing,
  Rock,
  Sailboat,
} from "./MapDecor";
import { MAP_PLAYER_CONTROLS_OFFSET } from "./mapLayout";
import { WaterMaterial } from "./WaterMaterial";

/**
 * Level 2 of the overworld: a low-poly diorama of one region. Land on the west,
 * ocean on the east; each fishing spot is a tappable POI pin. Tapping opens a
 * SpotCard → "Fish here" enters the fishing scene.
 */
export function RegionMap({
  region,
  currency,
  onTravel,
  onFishFoot,
  onBoat,
  canBoat,
  footFeeFor,
  boatFeeFor,
  restUntilFor,
  tutorialSpotId,
}: {
  region: Region;
  currency: number;
  onTravel: () => void;
  onFishFoot: (spot: Spot) => void;
  onBoat: (spot: Spot) => void;
  canBoat: (water: "fresh" | "salt") => boolean;
  footFeeFor: (spot: Spot) => number;
  boatFeeFor: (spot: Spot) => number;
  /** Spot lock: epoch ms when the spot reopens (0 = fishable now). */
  restUntilFor: (spot: Spot) => number;
  /** First-time tutorial: only this spot is tappable (others dim out). */
  tutorialSpotId?: string | null;
}) {
  const [selected, setSelected] = useState<Spot | null>(null);
  // Only land spots are pins; deep/offshore spots live in the boat view.
  const landSpots = region.spots.filter((s) => s.access === "land");
  // During the tutorial, open the map centered on the highlighted spot so the
  // "tap here" target is guaranteed to be on screen (portrait crops the map).
  const focus = (tutorialSpotId && landSpots.find((s) => s.id === tutorialSpotId)?.pos) || [0, 0];

  return (
    <>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [focus[0], 14, focus[1] + 15], fov: 38, near: 0.1, far: 200 }}
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <color attach="background" args={[palette.sky]} />
        <fog attach="fog" args={[palette.fog, 35, 80]} />
        <ambientLight intensity={0.68} />
        <hemisphereLight args={[palette.skyFill, palette.groundFill, 0.7]} />
        <directionalLight
          color={palette.sunlight}
          position={[9, 17, 7]}
          intensity={1.1}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-16}
          shadow-camera-right={16}
          shadow-camera-top={16}
          shadow-camera-bottom={-16}
          shadow-camera-near={1}
          shadow-camera-far={45}
          shadow-normalBias={0.02}
        />

        <Terrain />
        <ShoreDecor />

        {/* Water-body dioramas under fresh land spots (pond + banks + plants) */}
        {landSpots
          .filter((s) => s.water === "fresh")
          .map((s) => (
            <FreshWaterBody key={`wb-${s.id}`} spot={s} />
          ))}
        {/* Salt-spot dressing: sandbar under beaches, plank pier for piers */}
        {landSpots
          .filter((s) => s.water === "salt")
          .map((s) => (
            <SaltShoreDressing key={`ss-${s.id}`} spot={s} />
          ))}

        {landSpots.map((s) => (
          <SpotPin
            key={s.id}
            spot={s}
            selected={selected?.id === s.id}
            resting={restUntilFor(s) > 0}
            // First-timers are confined to gentle T1-2 water — anything that
            // can hook a T3+ fish is locked until the tutorial is done.
            tutorialDim={!!tutorialSpotId && Math.max(...s.tiers.map((t) => t.tier)) > 2}
            tutorialTarget={s.id === tutorialSpotId}
            onSelect={(sp) => {
              sfx.uiTap();
              setSelected(sp);
            }}
          />
        ))}

        <SplashSpawner
          points={landSpots
            .filter((s) => s.water === "fresh")
            .map((s) => [s.pos[0], 0.36, s.pos[1]] as [number, number, number])}
        />

        <MapOrbitControls
          target={[focus[0], 0, focus[1] + 1]}
          maxPolarAngle={Math.PI / 2.3}
          minDistance={10}
          maxDistance={34}
        />
      </Canvas>

      <div style={ui.header}>
        {/* No wandering off mid-tutorial */}
        {!tutorialSpotId && (
          <button style={ui.backBtn} onClick={() => { sfx.uiTap(); onTravel(); }}>
            🗺 Travel
          </button>
        )}
        <div style={ui.regionTitle}>{region.name}</div>
      </div>

      {tutorialSpotId && !selected && (
        <div style={ui.tutorialBanner}>
          🎓 Welcome to {region.name}! Tap the <b>glowing spot</b> to learn how to fish.
        </div>
      )}

      {selected && (
        <SpotCard
          spot={selected}
          footFee={footFeeFor(selected)}
          boatFee={boatFeeFor(selected)}
          currency={currency}
          offersBoat={BOAT_BODIES.includes(selected.body)}
          canBoat={canBoat(selected.water)}
          restUntil={restUntilFor(selected)}
          onFishFoot={onFishFoot}
          onBoat={onBoat}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

/** Wavy east coastline: x = COAST_X + sin(z * FREQ) * AMP. */
const COAST_X = 3.0;
const coastAt = (z: number) => COAST_X + Math.sin(z * 0.55) * 0.9;

/** Extrude a "west landmass" polygon whose east edge follows the coast curve, offset outward. */
function useCoastSlab(offset: number, depth: number) {
  return useMemo(() => {
    const shape = new THREE.Shape();
    // shape-space y = -world z (rotateX(-90°) mapping, same as RegionSelect)
    shape.moveTo(-13, 11); // NW corner (z = -11)
    shape.lineTo(coastAt(-11) + offset, 11);
    for (let z = -10; z <= 11; z += 1) {
      shape.lineTo(coastAt(z) + offset, -z);
    }
    shape.lineTo(-13, -11); // SW corner
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }, [offset, depth]);
}

/** Plan B grass-tone patches (§4.2): flat tinted discs scatter dry/dark mottling
 *  across the field. Vertex-color noise on the extruded slab was tried first but
 *  the cap has no interior vertices to tint, so the effect was invisible. Positions
 *  are hand-picked to sit in open grass between POIs and clear of pond banks. */
const GRASS_PATCHES: { pos: [number, number, number]; r: number; color: string }[] = [
  { pos: [-8.5, 0.301, -6.5], r: 2.4, color: palette.grassDark },
  { pos: [-10.5, 0.301, 3], r: 2.6, color: palette.grassDry },
  { pos: [-3.5, 0.301, 6.5], r: 2.5, color: palette.grassDark },
  { pos: [1.4, 0.301, 5.4], r: 1.7, color: palette.grassDry },
  { pos: [-6, 0.301, 7.5], r: 2.3, color: palette.grassDark },
  { pos: [-2, 0.301, 7.8], r: 1.8, color: palette.grassDry },
  { pos: [-10, 0.301, -4], r: 1.9, color: palette.grassDark },
  { pos: [1, 0.301, 0], r: 1.6, color: palette.grassDry },
];

/** Ocean, grass landmass with a wavy coast, sand fringe, and a foam line. */
function Terrain() {
  const land = useCoastSlab(0, 0.5);
  const sand = useCoastSlab(1.15, 0.44);
  const foam = useCoastSlab(1.55, 0.1);
  return (
    <group>
      {/* Ocean (covers everything; land layers stack on top to the west) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
        <planeGeometry args={[60, 44]} />
        <WaterMaterial deep={palette.water} gradient={false} />
      </mesh>
      {/* shallow-water tint just off the coast */}
      <mesh geometry={foam} position={[0, -0.19, 0]} receiveShadow>
        <meshStandardMaterial color={palette.waterShallow} flatShading roughness={0.45} />
      </mesh>
      {/* sand fringe */}
      <mesh geometry={sand} position={[0, -0.2, 0]} receiveShadow>
        <meshStandardMaterial color={palette.sand} flatShading roughness={1} />
      </mesh>
      {/* grass top */}
      <mesh geometry={land} position={[0, -0.2, 0]} receiveShadow castShadow>
        <meshStandardMaterial color={palette.grass} flatShading roughness={1} />
      </mesh>
      {/* flat grass-tone patches mottle the otherwise uniform field (§4.2 Plan B) */}
      {GRASS_PATCHES.map((p, i) => (
        <mesh key={`gp-${i}`} position={p.pos} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
          <circleGeometry args={[p.r, 20]} />
          <meshStandardMaterial color={p.color} flatShading roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/** Fixed cosmetic dressing: western hills, trees, rocks, sky and sea life. */
function ShoreDecor() {
  return (
    <group raycast={() => null}>
      {/* Western backdrop: hills + forest edge */}
      <Mountain position={[-10.5, 0.3, -6]} scale={1.3} color="#98a08f" />
      <Mountain position={[-11, 0.3, 0]} scale={1.0} color="#a2a894" />
      <Mountain position={[-10.2, 0.3, 6.5]} scale={1.1} color="#9aa38e" />
      <PineTree position={[-8.8, 0.3, -4.6]} scale={1.1} />
      <PineTree position={[-9.4, 0.3, -2.8]} scale={0.9} lean={0.05} />
      <PineTree position={[-8.4, 0.3, 4.4]} scale={1.0} lean={-0.06} />
      <PineTree position={[-9.2, 0.3, 7.6]} scale={0.85} />
      <LeafTree position={[-7.6, 0.3, -7.2]} scale={1.0} />
      <LeafTree position={[-8.2, 0.3, 0.8]} scale={0.9} />
      <LeafTree position={[-4.2, 0.3, 7.4]} scale={0.95} />
      <LeafTree position={[0.6, 0.3, -6.6]} scale={0.9} />
      <PineTree position={[1.8, 0.3, -8]} scale={0.9} />
      <Rock position={[-3.2, 0.3, 6.4]} cluster />
      <Rock position={[0.2, 0.3, 4.2]} scale={0.8} />
      <Rock position={[-7, 0.3, -1.4]} scale={0.9} cluster />

      {/* Gentle grass hummocks so the field isn't one flat plane. Positions are
          hand-checked to clear every California pond/pin footprint (see plan §4.3);
          heights stay ≤0.6 so they read as meadow swells, not hills. */}
      <mesh position={[-8, 0.18, 7]} scale={[2.2, 0.55, 1.8]} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={palette.grassDark} flatShading roughness={1} />
      </mesh>
      <mesh position={[-3.5, 0.15, 8]} scale={[2.3, 0.5, 1.8]} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={palette.grass} flatShading roughness={1} />
      </mesh>
      <mesh position={[0, 0.18, 8.2]} scale={[1.9, 0.6, 1.6]} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={palette.grassDry} flatShading roughness={1} />
      </mesh>
      <mesh position={[-9.3, 0.12, 1.5]} scale={[2.0, 0.4, 1.6]} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={palette.grass} flatShading roughness={1} />
      </mesh>

      {/* Coastline foam ripples + ocean life */}
      <RippleRing position={[4.6, -0.13, -6]} period={3.2} />
      <RippleRing position={[5.2, -0.13, 3]} period={2.6} />
      <RippleRing position={[4.4, -0.13, 8]} period={3.6} />
      <Fish position={[9, -0.06, -4]} color="#aacbe0" />
      <Fish position={[11, -0.06, 5]} color="#e7b6bc" dir={-1} />
      <Sailboat position={[12, -0.1, -1]} scale={1.3} />
      <Sailboat position={[9.5, -0.1, 8.5]} scale={1.0} />

      {/* Sky */}
      <Cloud position={[-4, 6.5, -8]} scale={1.5} range={15} />
      <Cloud position={[6, 7, 2]} scale={1.1} speed={0.18} range={15} />
      <Cloud position={[-1, 6, 8.5]} scale={1.2} speed={0.3} range={15} />
      <Gull position={[6, 3, -2]} radius={2.6} />
      <Gull position={[3, 3.4, 6]} radius={2} speed={0.42} />
    </group>
  );
}

/** Pond/stream diorama under a fresh spot: sandy bank, water, plants, dock planks. */
function FreshWaterBody({ spot }: { spot: Spot }) {
  const radius = spot.body === "stream" ? 0.7 : spot.body === "river" ? 1.0 : 1.6;
  const [x, z] = spot.pos;
  return (
    <group position={[x, 0, z]} raycast={() => null}>
      {/* sandy bank ring, then the water */}
      <mesh position={[0, 0.315, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[radius * 1.22, 20]} />
        <meshStandardMaterial color={palette.sand} flatShading roughness={1} />
      </mesh>
      {/* damp-sand rim seats the water into the bank instead of on top of it */}
      <mesh position={[0, 0.32, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[radius * 0.96, radius * 1.08, 24]} />
        <meshStandardMaterial color={palette.sandWet} flatShading roughness={1} />
      </mesh>
      <mesh position={[0, 0.325, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[radius, 20]} />
        <WaterMaterial radius={radius} />
      </mesh>
      {/* moving surface ripples (lakes & rivers only — streams are too small) */}
      {spot.body !== "stream" && (
        <>
          <RippleRing position={[radius * 0.3, 0.34, -radius * 0.2]} period={3.1} size={0.7} maxOpacity={0.3} />
          <RippleRing position={[-radius * 0.4, 0.34, radius * 0.3]} period={4.3} size={0.5} maxOpacity={0.25} />
        </>
      )}
      {/* bank dressing */}
      <Reeds position={[radius * 0.82, 0.32, radius * 0.35]} scale={0.9} />
      <Reeds position={[-radius * 0.7, 0.32, -radius * 0.55]} scale={0.75} />
      {spot.body !== "stream" && <LilyPad position={[-radius * 0.35, 0.34, radius * 0.4]} flower />}
      {spot.body === "lake" && <LilyPad position={[radius * 0.3, 0.34, -radius * 0.45]} />}
      <Rock position={[radius * 1.05, 0.3, -radius * 0.6]} scale={0.6} />
      {/* docks get plank walkways over the water */}
      {spot.body === "dock" && (
        <Dock position={[-radius * 0.2, 0.18, -radius * 1.1]} scale={0.8} planks={4} width={1.1} />
      )}
      {/* scruffy dressed band of tufts + pebbles rings the pond; two hand-placed
          props add asymmetry. Seeds are deterministic (from world pos) so the
          scatter is identical every visit. */}
      <GrassTufts center={[0, 0.3, 0]} innerRadius={radius * 1.25} outerRadius={radius * 1.9} count={36} seed={Math.round(x * 13 + z * 7)} />
      <Pebbles center={[0, 0.3, 0]} innerRadius={radius * 1.2} outerRadius={radius * 1.8} count={20} seed={Math.round(x * 5 + z * 11)} />
      <Reeds position={[radius * 0.1, 0.32, -radius * 0.9]} scale={0.85} />
      <Rock position={[-radius * 1.15, 0.3, radius * 0.5]} scale={0.5} />
    </group>
  );
}

/** Beach spots get a sandbar; pier spots get plank walkways out over the sea. */
function SaltShoreDressing({ spot }: { spot: Spot }) {
  const [x, z] = spot.pos;
  if (spot.body === "pier") {
    // Planks run west→east from the sand fringe out to the pin.
    const startX = coastAt(z) + 0.7;
    return (
      <group raycast={() => null}>
        <Dock position={[startX, -0.12, z]} planks={6} width={1.2} rotation={Math.PI / 2} />
        <RippleRing position={[x + 0.8, -0.13, z + 0.6]} period={2.8} />
      </group>
    );
  }
  // beach: a sandbar island under the pin with a little dressing
  return (
    <group position={[x, 0, z]} raycast={() => null}>
      <mesh position={[0, -0.12, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.7, 20]} />
        <meshStandardMaterial color={palette.sand} flatShading roughness={1} />
      </mesh>
      <mesh position={[0, -0.14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.0, 20]} />
        <WaterMaterial deep={palette.waterShallow} shallow={palette.foam} radius={2.0} />
      </mesh>
      <Rock position={[1.1, -0.1, 0.6]} scale={0.7} cluster />
      <RippleRing position={[-1.4, -0.11, -0.8]} period={3.4} />
    </group>
  );
}

function SpotPin({
  spot,
  onSelect,
  selected = false,
  resting = false,
  tutorialDim = false,
  tutorialTarget = false,
}: {
  spot: Spot;
  onSelect: (s: Spot) => void;
  /** This spot's SpotCard is currently open — pop the pin, gold ring, ripple burst. */
  selected?: boolean;
  /** Spot rest: fished out — grayed but still tappable (card shows countdown). */
  resting?: boolean;
  /** Tutorial: this pin is inactive & grayed out. */
  tutorialDim?: boolean;
  /** Tutorial: this pin is the highlighted "start here" spot. */
  tutorialTarget?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const bobberRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const arrowRef = useRef<THREE.Mesh>(null);
  const burstRef = useRef<THREE.Mesh>(null);
  // One-shot selection ripple: start < 0 means idle; a useEffect arms it on select.
  const burst = useRef({ armed: false, start: -1 });
  const [x, z] = spot.pos;
  const locked = spot.access === "boat" || tutorialDim;
  const base = spot.water === "fresh" ? "#4f8f74" : "#3f8fa0";
  const color = locked || resting ? "#8a8f96" : base;
  const gold = tutorialTarget || selected;
  const seed = x * 1.7 + z;

  // Fire one ripple burst on the frame `selected` flips to true.
  useEffect(() => {
    if (selected) { burst.current.armed = true; burst.current.start = -1; }
  }, [selected]);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime + seed;
    // Smooth spring-pop toward the target scale (no spring lib): exponential ease.
    if (groupRef.current) {
      const target = selected ? 1.28 : hover ? 1.18 : 1;
      const cur = groupRef.current.scale.x;
      const next = cur + (target - cur) * (1 - Math.exp(-12 * delta));
      groupRef.current.scale.setScalar(next);
    }
    // The bobber head floats gently; the ground ring pulses.
    if (bobberRef.current) bobberRef.current.position.y = 1.05 + Math.sin(t * 1.8) * 0.06;
    if (ringRef.current) {
      const s = 1 + (Math.sin(t * (tutorialTarget ? 3.4 : 2.4)) * 0.5 + 0.5) * (tutorialTarget ? 0.6 : 0.35);
      ringRef.current.scale.set(s, s, s);
    }
    // Tutorial arrow bounces above the target pin.
    if (arrowRef.current) arrowRef.current.position.y = 2.5 + Math.abs(Math.sin(t * 3)) * 0.35;
    // One-shot selection ripple: scale 0.5 -> 2.2, fade 0.5 -> 0 over 0.6s, then hide.
    if (burstRef.current) {
      const b = burst.current;
      if (b.armed && b.start < 0) b.start = clock.elapsedTime;
      if (b.armed) {
        const p = (clock.elapsedTime - b.start) / 0.6;
        if (p >= 1) {
          b.armed = false;
          burstRef.current.visible = false;
        } else {
          burstRef.current.visible = true;
          const s = 0.5 + p * 1.7;
          burstRef.current.scale.set(s, s, s);
          (burstRef.current.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - p);
        }
      }
    }
  });

  // Shared hit handlers for the pin. Empty when locked so tutorial-dimmed /
  // boat-only spots stay untappable. onPointerDown stops the map pan from
  // starting when you press a pin (needed for the invisible tap sphere below).
  const pick = locked
    ? {}
    : {
        onClick: (e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          onSelect(spot);
        },
        onPointerDown: (e: ThreeEvent<PointerEvent>) => e.stopPropagation(),
        onPointerOver: (e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = "pointer";
        },
        onPointerOut: () => {
          setHover(false);
          document.body.style.cursor = "auto";
        },
      };
  // Clickable Html label handlers (no ThreeEvent — these are DOM events).
  const select = () => {
    if (!locked) onSelect(spot);
  };
  const enter = () => {
    if (locked) return;
    setHover(true);
    document.body.style.cursor = "pointer";
  };
  const leave = () => {
    setHover(false);
    document.body.style.cursor = "auto";
  };

  return (
    <group ref={groupRef} position={[x, 0.45, z]}>
      {/* Invisible sphere — the thin bobber pole is a tiny hit target; this is the mobile tap target. */}
      <mesh position={[0, 0.75, 0]} {...pick}>
        <sphereGeometry args={[1.05, 12, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.5, 0]} castShadow {...pick}>
        <cylinderGeometry args={[0.045, 0.06, 1, 6]} />
        <meshStandardMaterial color={palette.dockPost} flatShading roughness={1} />
      </mesh>
      {/* two-tone bobber head (classic red-and-white float) */}
      <group ref={bobberRef} position={[0, 1.05, 0]}>
        <mesh castShadow {...pick}>
          <sphereGeometry args={[0.34, 14, 12]} />
          <meshStandardMaterial color={color} flatShading roughness={1} />
        </mesh>
        <mesh position={[0, -0.14, 0]}>
          <sphereGeometry args={[0.29, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshStandardMaterial color={palette.sail} flatShading roughness={1} opacity={tutorialDim ? 0.6 : 1} transparent={tutorialDim} />
        </mesh>
        <mesh position={[0, 0.36, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.14, 6]} />
          <meshStandardMaterial color={palette.sail} flatShading roughness={1} />
        </mesh>
      </group>
      {/* pulsing locator ring on the ground (gold for the tutorial target or when selected) */}
      <mesh ref={ringRef} position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <ringGeometry args={tutorialTarget ? [0.55, 0.72, 24] : [0.45, 0.55, 22]} />
        <meshBasicMaterial
          color={gold ? "#f4c453" : locked || resting ? "#9aa0a5" : color}
          transparent
          opacity={tutorialTarget ? 0.75 : selected ? 0.7 : resting ? 0.25 : 0.45}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* one-shot ripple burst emitted when the spot is selected (hidden until armed) */}
      <mesh ref={burstRef} position={[0, -0.09, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false} raycast={() => null}>
        <ringGeometry args={[0.5, 0.62, 24]} />
        <meshBasicMaterial color="#f4c453" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* bouncing "here!" arrow for the tutorial */}
      {tutorialTarget && (
        <mesh ref={arrowRef} position={[0, 2.5, 0]} rotation={[Math.PI, 0, 0]} raycast={() => null}>
          <coneGeometry args={[0.28, 0.6, 8]} />
          <meshStandardMaterial color="#f4c453" emissive="#f4c453" emissiveIntensity={0.35} flatShading roughness={0.8} />
        </mesh>
      )}
      <Html position={[0, tutorialTarget ? 2.4 : 1.7, 0]} center distanceFactor={20} style={{ pointerEvents: "none" }}>
        {/* Label is a tap target too (unless locked), so tapping the name opens the spot. */}
        <div
          style={{
            ...ui.pinLabel,
            ...(tutorialDim || resting ? ui.pinLabelDim : null),
            ...(tutorialTarget ? ui.pinLabelStar : null),
            ...(locked ? null : { pointerEvents: "auto", cursor: "pointer" }),
          }}
          onClick={select}
          onPointerEnter={enter}
          onPointerLeave={leave}
        >
          {spot.access === "boat" ? "🔒 " : tutorialTarget ? "⭐ " : resting ? "🌙 " : ""}
          {spot.name}
        </div>
      </Html>
    </group>
  );
}

/**
 * Occasional foam splash on the fresh ponds. One hidden group is repositioned
 * and shown for each splash (no mount/unmount, no per-frame allocation): three
 * foam cones that rise + tilt outward and fade, plus one expanding fading ring.
 * Placement is random; timing is random (8–15s between splashes) — only the
 * pond centers are fixed. There is no splash sound in sfx, so audio is skipped.
 */
function SplashSpawner({ points }: { points: [number, number, number][] }) {
  const groupRef = useRef<THREE.Group>(null);
  const cone0 = useRef<THREE.Mesh>(null);
  const cone1 = useRef<THREE.Mesh>(null);
  const cone2 = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  // scheduling + active-splash state, all in refs (never setState per frame)
  const state = useRef({ next: 4, start: -1, active: false });

  // Stagger the first splash a few seconds in.
  useEffect(() => { state.current.next = 4 + Math.random() * 6; }, []);

  useFrame(({ clock }) => {
    if (points.length === 0) return;
    const cones = [cone0.current, cone1.current, cone2.current];
    const g = groupRef.current;
    const now = clock.elapsedTime;
    const st = state.current;

    if (!st.active && now >= st.next) {
      const p = points[Math.floor(Math.random() * points.length)];
      if (g) {
        g.position.set(p[0] + (Math.random() - 0.5) * 0.8, p[1], p[2] + (Math.random() - 0.5) * 0.8);
        g.visible = true;
      }
      st.active = true;
      st.start = now;
    }

    if (st.active) {
      const prog = (now - st.start) / 0.6;
      if (prog >= 1) {
        st.active = false;
        if (g) g.visible = false;
        st.next = now + 8 + Math.random() * 7; // next splash in 8–15s
      } else {
        for (let i = 0; i < 3; i++) {
          const m = cones[i];
          if (!m) continue;
          const a = (i / 3) * Math.PI * 2;
          const spread = 0.05 + prog * 0.18;
          m.position.set(Math.cos(a) * spread, 0.02 + prog * 0.25, Math.sin(a) * spread);
          m.rotation.z = -Math.cos(a) * prog * 0.9;
          m.rotation.x = Math.sin(a) * prog * 0.9;
          (m.material as THREE.MeshStandardMaterial).opacity = 1 - prog;
        }
        if (ringRef.current) {
          const s = 0.4 + prog * 1.4;
          ringRef.current.scale.set(s, s, s);
          (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - prog);
        }
      }
    }
  });

  return (
    <group ref={groupRef} visible={false} raycast={() => null}>
      <mesh ref={cone0}>
        <coneGeometry args={[0.03, 0.14, 4]} />
        <meshStandardMaterial color={palette.foam} flatShading roughness={1} transparent opacity={1} />
      </mesh>
      <mesh ref={cone1}>
        <coneGeometry args={[0.03, 0.14, 4]} />
        <meshStandardMaterial color={palette.foam} flatShading roughness={1} transparent opacity={1} />
      </mesh>
      <mesh ref={cone2}>
        <coneGeometry args={[0.03, 0.14, 4]} />
        <meshStandardMaterial color={palette.foam} flatShading roughness={1} transparent opacity={1} />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.14, 0.2, 20]} />
        <meshBasicMaterial color={palette.foam} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

const ui: Record<string, CSSProperties> = {
  header: {
    position: "fixed",
    top: "max(14px, env(safe-area-inset-top))",
    left: 0,
    right: 0,
    padding: "0 16px",
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    color: "#3c5a57",
    pointerEvents: "none",
  },
  backBtn: {
    pointerEvents: "auto",
    display: "block",
    border: "none",
    borderRadius: 18,
    padding: "8px 16px",
    fontSize: 14,
    fontWeight: 700,
    color: "#3c5a57",
    background: "rgba(255,255,255,0.85)",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    cursor: "pointer",
  },
  regionTitle: {
    marginTop: MAP_PLAYER_CONTROLS_OFFSET,
    fontSize: 18,
    fontWeight: 800,
    textShadow: "0 1px 3px rgba(255,255,255,0.6)",
    pointerEvents: "none",
  },
  pinLabel: {
    background: "rgba(255,255,255,0.85)",
    borderRadius: 7,
    padding: "2px 7px",
    fontSize: 12,
    fontWeight: 700,
    color: "#3c5a57",
    whiteSpace: "nowrap",
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
  },
  pinLabelDim: { background: "rgba(238,238,238,0.7)", color: "#9aa0a5" },
  pinLabelStar: { background: "#fff6dc", border: "1.5px solid #f4c453", fontSize: 13 },
  tutorialBanner: {
    position: "fixed",
    top: "max(60px, calc(env(safe-area-inset-top) + 46px))",
    left: "50%",
    transform: "translateX(-50%)",
    maxWidth: "min(340px, 86vw)",
    background: "#fff6dc",
    border: "1.5px solid #f4c453",
    borderRadius: 14,
    padding: "10px 16px",
    fontSize: 14,
    fontWeight: 600,
    color: "#5a4a1e",
    textAlign: "center",
    boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    pointerEvents: "none",
  },
};

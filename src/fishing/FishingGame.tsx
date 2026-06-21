import { Canvas } from "@react-three/fiber";
import { FishingScene } from "./FishingScene";
import { FishingHud, type BaitBarProps } from "./FishingHud";
import type { FishingStore } from "./fishingStore";

/**
 * The fishing-scene: a fixed-camera, full-3D location where the (stationary)
 * angler fights a fish via the drag-to-reel + steer mechanic. The store is
 * owned by App (configured by the map spot) and shared with the HUD.
 */
export function FishingGame({
  store,
  onExit,
  bait,
  cooler,
}: {
  store: FishingStore;
  onExit: () => void;
  bait?: BaitBarProps;
  cooler?: { count: number; cap: number; full: boolean };
}) {
  return (
    <>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 4.4, -6], fov: 42, near: 0.1, far: 120 }}
        onCreated={({ camera }) => camera.lookAt(0, 1, 7)}
        gl={{ antialias: true }}
      >
        <FishingScene store={store} />
      </Canvas>
      <FishingHud store={store} onExit={onExit} bait={bait} cooler={cooler} />
    </>
  );
}

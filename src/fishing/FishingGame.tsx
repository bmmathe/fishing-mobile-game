import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { FishingScene } from "./FishingScene";
import { FishingHud } from "./FishingHud";
import { createDefaultStore } from "./fishingStore";

/**
 * The fishing-scene prototype: a fixed-camera, full-3D location where the
 * (stationary) angler fights a fish via the drag-to-reel + steer mechanic.
 * One store drives both the 3D scene and the DOM HUD.
 */
export function FishingGame() {
  const [store] = useState(createDefaultStore);

  // Dev-only: expose the store for debugging / automated testing in preview.
  if (import.meta.env.DEV) (window as unknown as { fishStore: typeof store }).fishStore = store;

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
      <FishingHud store={store} />
    </>
  );
}

import { Suspense, useState } from "react";
import { createDefaultStore } from "./fishing/fishingStore";
import { FishingGame } from "./fishing/FishingGame";
import { RegionSelect } from "./world/RegionSelect";
import { RegionMap } from "./world/RegionMap";
import { getRegion, type Spot } from "./world/regions";

type View = "region-select" | "region-map" | "fishing";

export default function App() {
  const [store] = useState(createDefaultStore);
  const [view, setView] = useState<View>("region-select");
  const [regionId, setRegionId] = useState<string | null>(null);

  // Dev-only: expose store + navigation for debugging / automated testing.
  if (import.meta.env.DEV) {
    const w = window as unknown as { fishStore: typeof store; nav: object };
    w.fishStore = store;
    w.nav = { setView, setRegionId };
  }

  return (
    <Suspense fallback={null}>
      {view === "region-select" && (
        <RegionSelect
          onPick={(id) => {
            setRegionId(id);
            setView("region-map");
          }}
        />
      )}

      {view === "region-map" && regionId && (
        <RegionMap
          region={getRegion(regionId)}
          onBack={() => setView("region-select")}
          onFish={(spot: Spot) => {
            store.setSpot(spot);
            setView("fishing");
          }}
        />
      )}

      {view === "fishing" && <FishingGame store={store} onExit={() => setView("region-map")} />}
    </Suspense>
  );
}

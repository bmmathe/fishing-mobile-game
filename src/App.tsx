import { Suspense, useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { createDefaultStore } from "./fishing/fishingStore";
import { FishingGame } from "./fishing/FishingGame";
import { RegionSelect } from "./world/RegionSelect";
import { RegionMap } from "./world/RegionMap";
import { getRegion, type Spot } from "./world/regions";
import { createPlayerStore } from "./game/playerStore";
import { TackleShop } from "./game/TackleShop";

type View = "region-select" | "region-map" | "fishing" | "shop";

export default function App() {
  const [store] = useState(createDefaultStore);
  const [player] = useState(createPlayerStore);
  const [view, setView] = useState<View>("region-select");
  const [regionId, setRegionId] = useState<string | null>(null);
  const [shopReturn, setShopReturn] = useState<View>("region-select");

  // Re-render when player gear/currency changes.
  useSyncExternalStore(player.subscribe, player.getVersion);

  // Bank every landed (non-junk) fish into the player inventory.
  useEffect(() => {
    store.onCatch = (c) => player.addCatch(c);
    return () => {
      store.onCatch = undefined;
    };
  }, [store, player]);

  // Keep the fight's gear in sync with owned line/pole.
  useEffect(() => {
    store.applyGear(player.lineMaxTension, player.reelMult);
  }, [store, player, player.lineTier, player.poleTier]);

  // Dev-only: expose stores + navigation for debugging / automated testing.
  if (import.meta.env.DEV) {
    const w = window as unknown as { fishStore: typeof store; player: typeof player; nav: object };
    w.fishStore = store;
    w.player = player;
    w.nav = { setView, setRegionId };
  }

  const openShop = () => {
    setShopReturn(view === "region-map" ? "region-map" : "region-select");
    setView("shop");
  };

  const onMap = view === "region-select" || view === "region-map";

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

      {view === "shop" && <TackleShop store={player} onBack={() => setView(shopReturn)} />}

      {/* Map overlay: wallet + Shop entry */}
      {onMap && (
        <div style={ui.mapOverlay}>
          <div style={ui.wallet}>${player.currency.toLocaleString()}</div>
          <button style={ui.shopBtn} onClick={openShop}>
            🎣 Shop
          </button>
        </div>
      )}
    </Suspense>
  );
}

const ui: Record<string, CSSProperties> = {
  mapOverlay: {
    position: "fixed",
    top: "max(14px, env(safe-area-inset-top))",
    right: "max(14px, env(safe-area-inset-right))",
    display: "flex",
    gap: 8,
    alignItems: "center",
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  wallet: { fontSize: 15, fontWeight: 800, color: "#3c5a57", background: "rgba(255,255,255,0.9)", borderRadius: 14, padding: "6px 12px", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" },
  shopBtn: { pointerEvents: "auto", border: "none", borderRadius: 14, padding: "8px 14px", fontSize: 14, fontWeight: 700, color: "#fff", background: "#5aa9bd", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", cursor: "pointer" },
};

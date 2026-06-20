import { Suspense, useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { createDefaultStore } from "./fishing/fishingStore";
import { FishingGame } from "./fishing/FishingGame";
import { RegionSelect } from "./world/RegionSelect";
import { RegionMap } from "./world/RegionMap";
import { BoatScene } from "./world/BoatScene";
import { getRegion, type Spot } from "./world/regions";
import { createPlayerStore } from "./game/playerStore";
import { fishFee } from "./game/gear";
import { TackleShop } from "./game/TackleShop";
import type { Water } from "./fishing/fishCatalog";

// Views: region-map (your region) · travel (full US) · boat (drive the water) ·
// fishing (the catch minigame) · shop (sell + gear/boats).
type View = "region-map" | "travel" | "fishing" | "shop" | "boat";

export default function App() {
  const [store] = useState(createDefaultStore);
  const [player] = useState(createPlayerStore);
  const [view, setView] = useState<View>("region-map");
  const [shopReturn, setShopReturn] = useState<View>("region-map");
  const [boatWater, setBoatWater] = useState<Water>("fresh");
  const [fishingReturn, setFishingReturn] = useState<View>("region-map");

  // Re-render when player state (currency, gear, location) changes.
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
    w.nav = { setView };
  }

  // No region chosen yet → starting picker (free coastal spawn).
  if (player.currentRegionId === null) {
    return (
      <Suspense fallback={null}>
        <RegionSelect
          mode="start"
          currentRegionId={null}
          currency={player.currency}
          onSelect={(id) => {
            player.startIn(id);
            setView("region-map");
          }}
        />
      </Suspense>
    );
  }

  const region = getRegion(player.currentRegionId);
  const openShop = () => {
    setShopReturn(view === "travel" ? "travel" : "region-map");
    setView("shop");
  };
  const onMap = view === "region-map" || view === "travel";

  return (
    <Suspense fallback={null}>
      {view === "region-map" && (
        <RegionMap
          region={region}
          onTravel={() => setView("travel")}
          canBoat={(water) => player.canBoat(water)}
          footFeeFor={(spot) => fishFee(spot.quality, false)}
          onFishFoot={(spot: Spot) => {
            if (player.payFishFee(fishFee(spot.quality, false))) {
              store.setSpot(spot);
              setFishingReturn("region-map");
              setView("fishing");
            }
          }}
          onBoat={(spot: Spot) => {
            setBoatWater(spot.water);
            setView("boat");
          }}
        />
      )}

      {view === "boat" && (
        <BoatScene
          region={region}
          water={boatWater}
          boatSpeed={player.boatSpeed}
          currency={player.currency}
          onFish={(spot: Spot) => {
            if (player.payFishFee(fishFee(spot.quality, true))) {
              store.setSpot(spot);
              setFishingReturn("boat");
              setView("fishing");
            }
          }}
          onDock={() => setView("region-map")}
        />
      )}

      {view === "travel" && (
        <RegionSelect
          mode="travel"
          currentRegionId={player.currentRegionId}
          currency={player.currency}
          onSelect={(id) => {
            if (player.travelTo(id, getRegion(id).travelCost)) setView("region-map");
          }}
        />
      )}

      {view === "fishing" && <FishingGame store={store} onExit={() => setView(fishingReturn)} />}

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

import { Suspense, useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { createDefaultStore } from "./fishing/fishingStore";
import { FishingGame } from "./fishing/FishingGame";
import { RegionSelect } from "./world/RegionSelect";
import { RegionMap } from "./world/RegionMap";
import { BoatScene } from "./world/BoatScene";
import { easiestSpot, getRegion, isFreeFoot, type Spot } from "./world/regions";
import { createPlayerStore, COOLER_CAP } from "./game/playerStore";
import { fishFee } from "./game/gear";
import { TackleShop } from "./game/TackleShop";
import { Collection } from "./game/Collection";
import { MuteButton } from "./ui/MuteButton";
import { sfx } from "./audio/sfx";
import type { Water } from "./fishing/fishCatalog";

// Views: region-map (your region) · travel (full US) · boat (drive the water) ·
// fishing (the catch minigame) · shop (sell + gear/boats) · collection (trophies + fishdex).
type View = "region-map" | "travel" | "fishing" | "shop" | "boat" | "collection";

export default function App() {
  const [store] = useState(createDefaultStore);
  const [player] = useState(createPlayerStore);
  const [view, setView] = useState<View>("region-map");
  const [shopReturn, setShopReturn] = useState<View>("region-map");
  const [boatWater, setBoatWater] = useState<Water>("fresh");
  const [fishingReturn, setFishingReturn] = useState<View>("region-map");

  // Re-render when player state (currency, gear, location) changes.
  useSyncExternalStore(player.subscribe, player.getVersion);

  // Bank catches into the cooler + wire bait/hook stock to the player.
  useEffect(() => {
    store.onCatch = (c) => {
      player.addCatch(c);
      // Keeping the first real fish graduates the how-to-fish tutorial.
      player.completeTutorial();
    };
    store.hasBait = () => player.hasBait();
    store.consumeBait = () => {
      player.consumeBait();
    };
    store.hasHook = () => player.hasHook();
    store.onLineSnap = () => {
      player.consumeHookOnSnap();
    };
    // Spot lock: the first landed fish of a session locks the spot's re-entry.
    store.onLanded = (spot) => player.lockSpot(spot);
    return () => {
      store.onCatch = undefined;
      store.hasBait = undefined;
      store.consumeBait = undefined;
      store.hasHook = undefined;
      store.onLineSnap = undefined;
      store.onLanded = undefined;
    };
  }, [store, player]);

  // Keep the fight's gear in sync with owned line/pole.
  useEffect(() => {
    store.applyGear(player.lineMaxTension, player.reelMult);
  }, [store, player, player.lineTier, player.poleTier]);

  // Keep the fight's bait effect in sync with the equipped bait.
  useEffect(() => {
    store.setBait(player.baitEffect);
  }, [store, player, player.equippedBaitId]);

  // Keep the fight's hook in sync with equipped tackle.
  useEffect(() => {
    store.setHook(player.hookEffect);
  }, [store, player, player.equippedHookId, player.hookEffect]);

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
            sfx.uiTap();
            player.startIn(id);
            setView("region-map");
          }}
        />
      </Suspense>
    );
  }

  const region = getRegion(player.currentRegionId);
  // First-timer tutorial: gate the map to the gentlest spot in the region.
  const tutorialSpot = player.tutorialDone ? null : easiestSpot(region);
  const openShop = () => {
    setShopReturn(view === "travel" ? "travel" : "region-map");
    setView("shop");
  };
  const onMap = view === "region-map" || view === "travel";

  // Bait selector for the fishing HUD, built from the bait box.
  const baitBar = {
    options: Object.values(player.baitBox).map((s) => ({
      id: s.def.id,
      name: s.def.name,
      count: s.count,
      hint: `T${s.def.tier} bait — hooks mostly T${s.def.tier}` + (s.def.waitFactor < 1 ? ` · ↓wait` : ""),
    })),
    equippedId: player.equippedBaitId,
    onEquip: (id: string | null) => player.equipBait(id),
  };

  const hookBar = {
    options: Object.values(player.hookBox).map((s) => ({
      id: s.def.id,
      name: s.def.name,
      count: s.count,
      hint: `T${Math.min(...s.def.forTiers)}–T${Math.max(...s.def.forTiers)}` +
        (s.def.holdBonus > 0 ? ` · +${(s.def.holdBonus * 100).toFixed(0)}% hold` : ""),
    })),
    equippedId: player.equippedHookId,
    onEquip: (id: string | null) => player.equipHook(id),
  };

  return (
    <Suspense fallback={null}>
      {view === "region-map" && (
        <RegionMap
          region={region}
          currency={player.currency}
          tutorialSpotId={tutorialSpot?.id ?? null}
          onTravel={() => setView("travel")}
          canBoat={(water) => player.canBoat(water)}
          footFeeFor={(spot) => (isFreeFoot(spot.body) ? 0 : fishFee(spot.quality, false))}
          restUntilFor={(spot) => player.restUntil(spot)}
          onFishFoot={(spot: Spot) => {
            if (player.isResting(spot)) {
              sfx.denied();
              return;
            }
            const fee = isFreeFoot(spot.body) ? 0 : fishFee(spot.quality, false);
            if (player.payFishFee(fee)) {
              if (fee > 0) sfx.buy();
              else sfx.uiTap();
              store.setSpot(spot);
              setFishingReturn("region-map");
              setView("fishing");
            } else {
              sfx.denied();
            }
          }}
          boatFeeFor={(spot) => fishFee(spot.quality, true)}
          onBoat={(spot: Spot) => {
            // One boat fee, paid when you launch — buoy fishing is then free
            // for the whole trip.
            if (player.isResting(spot)) {
              sfx.denied();
              return;
            }
            if (player.payFishFee(fishFee(spot.quality, true))) {
              sfx.buy();
              setBoatWater(spot.water);
              setView("boat");
            } else {
              sfx.denied();
            }
          }}
        />
      )}

      {view === "boat" && (
        <BoatScene
          region={region}
          water={boatWater}
          boatSpeed={player.boatSpeed}
          restUntilFor={(spot: Spot) => player.restUntil(spot)}
          onFish={(spot: Spot) => {
            if (player.isResting(spot)) {
              sfx.denied();
              return;
            }
            // Trip fee was already paid at launch — fishing here is free.
            store.setSpot(spot);
            setFishingReturn("boat");
            setView("fishing");
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
            if (player.travelTo(id, getRegion(id).travelCost)) {
              sfx.buy();
              setView("region-map");
            } else {
              sfx.denied();
            }
          }}
        />
      )}

      {view === "fishing" && (
        <FishingGame
          store={store}
          onExit={() => setView(fishingReturn)}
          bait={baitBar}
          hooks={hookBar}
          cooler={{
            count: player.inventory.length,
            cap: COOLER_CAP,
            full: player.coolerFull,
            items: player.inventory,
            keepLockedMs: player.coolerLockMs(),
          }}
          tutorial={!player.tutorialDone}
        />
      )}

      {view === "shop" && <TackleShop store={player} onBack={() => setView(shopReturn)} />}

      {view === "collection" && <Collection store={player} onBack={() => setView(shopReturn)} />}

      {/* Map overlay: wallet + Shop / Collection entries */}
      {onMap && (
        <div style={ui.mapOverlay}>
          <div style={ui.wallet}>${player.currency.toLocaleString()}</div>
          <MuteButton />
          <button
            style={ui.shopBtn}
            onClick={() => {
              sfx.uiTap();
              setShopReturn(view === "travel" ? "travel" : "region-map");
              setView("collection");
            }}
          >
            🏆
          </button>
          <button
            style={ui.shopBtn}
            onClick={() => {
              sfx.uiTap();
              openShop();
            }}
          >
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

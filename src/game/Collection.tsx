import { useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import { ALL_FISH } from "../fishing/fishCatalog";
import { TROPHY_CAP, type PlayerStore } from "./playerStore";

const QUALITY = "#c9a24f";

/** Trophy Wall (mounted catches) + Fishdex (species collection log). */
export function Collection({ store, onBack }: { store: PlayerStore; onBack: () => void }) {
  useSyncExternalStore(store.subscribe, store.getVersion);
  const [tab, setTab] = useState<"trophies" | "fishdex">("trophies");

  return (
    <div style={ui.root}>
      <div style={ui.header}>
        <button style={ui.backBtn} onClick={onBack}>
          ← Map
        </button>
        <div style={ui.title}>Collection</div>
        <div style={{ width: 60 }} />
      </div>

      <div style={ui.tabs}>
        <button style={{ ...ui.tab, ...(tab === "trophies" ? ui.tabActive : null) }} onClick={() => setTab("trophies")}>
          🏆 Trophy Wall ({store.trophies.length}/{TROPHY_CAP})
        </button>
        <button style={{ ...ui.tab, ...(tab === "fishdex" ? ui.tabActive : null) }} onClick={() => setTab("fishdex")}>
          📖 Fishdex
        </button>
      </div>

      <div style={ui.body}>{tab === "trophies" ? <TrophyTab store={store} /> : <FishdexTab store={store} />}</div>
    </div>
  );
}

function TrophyTab({ store }: { store: PlayerStore }) {
  if (store.trophies.length === 0) {
    return <div style={ui.empty}>No trophies yet. Mount a prized catch from your cooler in the shop.</div>;
  }
  return (
    <div style={ui.grid}>
      {store.trophies.map((t, i) => (
        <div key={i} style={ui.trophyCard}>
          <div style={{ fontSize: 26 }}>🏆</div>
          <div style={{ fontWeight: 800 }}>{t.name}</div>
          <div style={ui.sub}>
            {t.weightKg} kg · T{t.tier} · {t.water === "fresh" ? "🟦" : "🌊"}
          </div>
          <button style={ui.takeDown} onClick={() => store.removeTrophy(i)}>
            Take down (+${t.value})
          </button>
        </div>
      ))}
    </div>
  );
}

function FishdexTab({ store }: { store: PlayerStore }) {
  // All catalog species (no junk), sorted by tier then water then name.
  const species = useMemo(
    () =>
      ALL_FISH.filter((f) => f.kind === "fish").sort(
        (a, b) => a.tier - b.tier || a.water.localeCompare(b.water) || a.name.localeCompare(b.name),
      ),
    [],
  );
  const discovered = species.filter((f) => store.fishdex[f.name]).length;

  return (
    <>
      <div style={ui.dexCount}>
        Discovered {discovered} / {species.length}
      </div>
      <div style={ui.grid}>
        {species.map((f) => {
          const e = store.fishdex[f.name];
          return (
            <div key={f.name} style={{ ...ui.dexCard, opacity: e ? 1 : 0.5 }}>
              <div style={{ fontWeight: 700 }}>{e ? f.name : "???"}</div>
              <div style={ui.sub}>
                T{f.tier} · {f.water === "fresh" ? "🟦" : "🌊"}
              </div>
              {e ? (
                <div style={ui.dexStats}>
                  ×{e.count} · best {e.maxWeightKg} kg
                </div>
              ) : (
                <div style={ui.dexStats}>— undiscovered —</div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

const ui: Record<string, CSSProperties> = {
  root: {
    position: "fixed",
    inset: 0,
    background: "linear-gradient(180deg, #cfeae6 0%, #bfe0dc 100%)",
    color: "#3c5a57",
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    display: "flex",
    flexDirection: "column",
    padding:
      "max(14px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) max(14px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left))",
  },
  header: { display: "flex", alignItems: "center", gap: 12 },
  backBtn: { border: "none", borderRadius: 18, padding: "8px 14px", fontSize: 14, fontWeight: 700, color: "#3c5a57", background: "rgba(255,255,255,0.85)", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", cursor: "pointer" },
  title: { fontSize: 20, fontWeight: 800, flex: 1, textAlign: "center" },
  tabs: { display: "flex", gap: 8, margin: "14px 0" },
  tab: { flex: 1, border: "none", borderRadius: 14, padding: "10px", fontSize: 14, fontWeight: 700, color: "#3c5a57", background: "rgba(255,255,255,0.55)", cursor: "pointer" },
  tabActive: { background: "#5aa9bd", color: "#fff" },
  body: { flex: 1, overflowY: "auto", minHeight: 0 },
  empty: { textAlign: "center", opacity: 0.7, marginTop: 40, fontSize: 15 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 },
  trophyCard: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.8)", border: `2px solid ${QUALITY}`, borderRadius: 14, padding: "12px 8px", textAlign: "center" },
  takeDown: { marginTop: 4, border: "none", borderRadius: 10, padding: "6px 10px", fontSize: 12, fontWeight: 700, color: "#3c5a57", background: "rgba(0,0,0,0.06)", cursor: "pointer" },
  dexCount: { fontWeight: 700, marginBottom: 10 },
  dexCard: { background: "rgba(255,255,255,0.7)", borderRadius: 12, padding: "10px 12px" },
  dexStats: { fontSize: 11, opacity: 0.75, marginTop: 3 },
  sub: { fontSize: 12, opacity: 0.7 },
};

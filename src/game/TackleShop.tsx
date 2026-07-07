import { useState, useSyncExternalStore, type CSSProperties } from "react";
import { BOAT_TIERS, LINE_TIERS, POLE_TIERS } from "./gear";
import { BUYABLE_BAIT, SYNTHETIC_LURES } from "./bait";
import { HOOKS } from "./hooks";
import { CatchArt } from "../fishing/CatchArt";
import { sfx } from "../audio/sfx";
import { COOLER_CAP, type PlayerStore } from "./playerStore";

/** The Tackle Shop: sell your catch, manage bait, and buy gear. Reached from the map. */
export function TackleShop({ store, onBack }: { store: PlayerStore; onBack: () => void }) {
  useSyncExternalStore(store.subscribe, store.getVersion);
  const [tab, setTab] = useState<"sell" | "bait" | "gear">("sell");
  const baitCount = Object.values(store.baitBox).reduce((s, b) => s + b.count, 0);

  return (
    <div style={ui.root}>
      <div style={ui.header}>
        <button style={ui.backBtn} onClick={onBack}>
          ← Map
        </button>
        <div style={ui.title}>Tackle Shop</div>
        <div style={ui.wallet}>${store.currency.toLocaleString()}</div>
      </div>

      <div style={ui.tabs}>
        <button style={{ ...ui.tab, ...(tab === "sell" ? ui.tabActive : null) }} onClick={() => { sfx.uiTap(); setTab("sell"); }}>
          Cooler {store.inventory.length}/{COOLER_CAP}
        </button>
        <button style={{ ...ui.tab, ...(tab === "bait" ? ui.tabActive : null) }} onClick={() => { sfx.uiTap(); setTab("bait"); }}>
          Bait ({baitCount})
        </button>
        <button style={{ ...ui.tab, ...(tab === "gear" ? ui.tabActive : null) }} onClick={() => { sfx.uiTap(); setTab("gear"); }}>
          Gear
        </button>
      </div>

      <div style={ui.body}>
        {tab === "sell" ? <SellTab store={store} /> : tab === "bait" ? <BaitTab store={store} /> : <GearTab store={store} />}
      </div>
    </div>
  );
}

function SellTab({ store }: { store: PlayerStore }) {
  if (store.inventory.length === 0) {
    return <div style={ui.empty}>Your cooler is empty. Go fishing!</div>;
  }
  // Most recent first.
  const items = store.inventory.map((f, i) => ({ f, i })).reverse();
  return (
    <>
      <button style={ui.sellAll} onClick={() => { sfx.coin(); store.sellAll(); }}>
        Sell all (+${store.inventoryValue.toLocaleString()})
      </button>
      <div style={ui.list}>
        {items.map(({ f, i }) => (
          <div key={i} style={ui.row}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span style={ui.thumb}>
                <CatchArt name={f.name} size={64} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                <div style={ui.sub}>
                  T{f.tier} · {f.weightKg} kg · {f.water === "fresh" ? "🟦" : "🌊"}
                  {f.bait ? " · 🪱 bait" : ""}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {f.bait && (
                <button style={ui.baitBtn} onClick={() => { sfx.equip(); store.stockBait(i); }}>
                  → Bait
                </button>
              )}
              <button
                style={{ ...ui.baitBtn, ...(store.trophyWallFull ? ui.disabled : null) }}
                disabled={store.trophyWallFull}
                title={store.trophyWallFull ? "Trophy wall full" : "Mount on the Trophy Wall"}
                onClick={() => {
                  if (store.mountTrophy(i)) sfx.trophy();
                }}
              >
                🏆
              </button>
              <button style={ui.sellOne} onClick={() => { sfx.coin(); store.sellOne(i); }}>
                +${f.value}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function BaitTab({ store }: { store: PlayerStore }) {
  const stacks = Object.values(store.baitBox);
  return (
    <>
      {BUYABLE_BAIT.map((def) => {
        const qty = def.synthetic ? 1 : 5;
        return (
          <button
            key={def.id}
            style={{ ...ui.sellAll, background: def.synthetic ? "#c98a5a" : "#5aa9bd" }}
            onClick={() => {
              if (store.buyBait(def.id, qty)) sfx.buy();
              else sfx.denied();
            }}
          >
            Buy {qty > 1 ? `${qty} ` : ""}{def.name} (−${(def.price ?? 0) * qty})
            {def.synthetic ? ` · T${def.tier} · ~${def.uses} uses` : ""}
          </button>
        );
      })}
      {SYNTHETIC_LURES.length > 0 && (
        <div style={ui.lureWarn}>⚠ Lures wear out — and a fish that gets away takes the lure with it.</div>
      )}
      {stacks.length === 0 ? (
        <div style={ui.empty}>No bait yet. Catch forage fish and tap "→ Bait", or buy Worms.</div>
      ) : (
        <div style={ui.list}>
          {stacks.map(({ def, count }) => (
            <div key={def.id} style={ui.row}>
              <div>
                <div style={{ fontWeight: 700 }}>
                  {def.name} ×{count}
                </div>
                <div style={ui.sub}>
                  T{def.tier} bait — hooks mostly T{def.tier}
                  {def.waitFactor < 1 ? ` · ↓wait ×${def.waitFactor}` : ""}
                  {def.synthetic ? ` · ~${def.uses} uses, lost if the fish escapes` : ""}
                </div>
              </div>
              <button style={ui.sellOne} onClick={() => { sfx.coin(); store.sellBait(def.id, 1); }}>
                Sell 1
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function GearTab({ store }: { store: PlayerStore }) {
  return (
    <div style={ui.list}>
      <GearTrack
        label="Line — raises the snap limit (unlocks higher tiers)"
        tiers={LINE_TIERS.map((t) => ({ name: t.name, stat: `max tension ${t.maxTension.toFixed(2)}`, price: t.price }))}
        owned={store.lineTier}
        currency={store.currency}
        onBuy={() => (store.buyLine() ? sfx.buy() : sfx.denied())}
      />
      <GearTrack
        label="Pole — faster reel-in"
        tiers={POLE_TIERS.map((t) => ({ name: t.name, stat: `reel ×${t.reelMult.toFixed(2)}`, price: t.price }))}
        owned={store.poleTier}
        currency={store.currency}
        onBuy={() => (store.buyPole() ? sfx.buy() : sfx.denied())}
      />
      <HooksSection store={store} />
      <GearTrack
        label="Boat — drive the water to deep-water spots"
        tiers={BOAT_TIERS.map((t) => ({ name: t.name, stat: `${t.ocean ? "lake + ocean" : "lake only"} · speed ${t.speed.toFixed(1)}`, price: t.price }))}
        owned={store.boatTier}
        currency={store.currency}
        onBuy={() => (store.buyBoat() ? sfx.buy() : sfx.denied())}
      />
    </div>
  );
}

function HooksSection({ store }: { store: PlayerStore }) {
  return (
    <div style={ui.track}>
      <div style={ui.trackLabel}>Hooks — reduce shake-offs for matching tiers (lost on line snap)</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {HOOKS.map((h) => {
          const stock = store.hookBox[h.id]?.count ?? 0;
          const equipped = store.equippedHookId === h.id;
          const affordable = store.currency >= h.price;
          const tierLabel = `T${Math.min(...h.forTiers)}–T${Math.max(...h.forTiers)}`;
          const stat =
            (h.holdBonus > 0 ? `+${(h.holdBonus * 100).toFixed(0)}% hold` : "baseline") +
            (stock > 0 ? ` · ×${stock} in box` : "");
          return (
            <div key={h.id} style={ui.hookRow}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{h.name}</div>
                <div style={ui.sub}>
                  {tierLabel} · {stat}
                  {h.blurb ? ` · ${h.blurb}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {stock > 0 && (
                  <button
                    style={{ ...ui.baitBtn, ...(equipped ? { background: "#5aa9bd", color: "#fff" } : null) }}
                    onClick={() => { sfx.equip(); store.equipHook(h.id); }}
                  >
                    {equipped ? "Equipped" : "Equip"}
                  </button>
                )}
                <button
                  style={{ ...ui.buyBtn, ...(h.price === 0 || affordable ? null : ui.buyDisabled) }}
                  disabled={h.price > 0 && !affordable}
                  onClick={() => (store.buyHook(h.id) ? sfx.buy() : sfx.denied())}
                >
                  <div style={{ fontWeight: 700 }}>{h.price === 0 ? "Restock" : "Buy 1"}</div>
                  <div style={{ fontSize: 11 }}>
                    {h.price === 0 ? "Free" : `$${h.price}`}
                  </div>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GearTrack({
  label,
  tiers,
  owned,
  currency,
  onBuy,
}: {
  label: string;
  tiers: { name: string; stat: string; price: number }[];
  owned: number; // -1 = nothing owned yet (boats)
  currency: number;
  onBuy: () => void;
}) {
  const cur = owned >= 0 ? tiers[owned] : null;
  const next = tiers[owned + 1];
  const affordable = next && currency >= next.price;
  return (
    <div style={ui.track}>
      <div style={ui.trackLabel}>{label}</div>
      <div style={ui.trackRow}>
        <div>
          <div style={{ fontWeight: 700 }}>{cur ? cur.name : "None owned"}</div>
          <div style={ui.sub}>{cur ? `Equipped · ${cur.stat}` : "Buy one to get on the water"}</div>
        </div>
        {next ? (
          <button
            style={{ ...ui.buyBtn, ...(affordable ? null : ui.buyDisabled) }}
            disabled={!affordable}
            onClick={onBuy}
          >
            <div style={{ fontWeight: 700 }}>{next.name}</div>
            <div style={{ fontSize: 11 }}>
              {next.stat} · ${next.price.toLocaleString()}
            </div>
          </button>
        ) : (
          <div style={ui.maxed}>MAX</div>
        )}
      </div>
    </div>
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
  title: { fontSize: 20, fontWeight: 800, flex: 1 },
  wallet: { fontSize: 17, fontWeight: 800, background: "#fff", borderRadius: 14, padding: "6px 14px", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" },
  tabs: { display: "flex", gap: 8, margin: "14px 0" },
  tab: { flex: 1, border: "none", borderRadius: 14, padding: "10px", fontSize: 14, fontWeight: 700, color: "#3c5a57", background: "rgba(255,255,255,0.55)", cursor: "pointer" },
  tabActive: { background: "#5aa9bd", color: "#fff" },
  body: { flex: 1, overflowY: "auto", minHeight: 0 },
  empty: { textAlign: "center", opacity: 0.7, marginTop: 40, fontSize: 15 },
  sellAll: { width: "100%", border: "none", borderRadius: 16, padding: "13px", fontSize: 16, fontWeight: 700, color: "#fff", background: "#3f9e6a", cursor: "pointer", marginBottom: 12 },
  lureWarn: { fontSize: 12, fontWeight: 600, opacity: 0.8, textAlign: "center", marginBottom: 12 },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "rgba(255,255,255,0.7)", borderRadius: 12, padding: "8px 14px" },
  thumb: { flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", width: 64, height: 38, background: "#dceef0", borderRadius: 10, overflow: "hidden" },
  sub: { fontSize: 12, opacity: 0.7 },
  sellOne: { border: "none", borderRadius: 12, padding: "8px 14px", fontSize: 14, fontWeight: 700, color: "#fff", background: "#3f9e6a", cursor: "pointer" },
  baitBtn: { border: "none", borderRadius: 12, padding: "8px 12px", fontSize: 13, fontWeight: 700, color: "#3c5a57", background: "rgba(255,255,255,0.85)", cursor: "pointer" },
  disabled: { opacity: 0.4, cursor: "not-allowed" },
  track: { background: "rgba(255,255,255,0.55)", borderRadius: 16, padding: 14, marginBottom: 4 },
  trackLabel: { fontSize: 12, fontWeight: 600, opacity: 0.8, marginBottom: 10 },
  trackRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  hookRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "rgba(255,255,255,0.45)", borderRadius: 12, padding: "10px 12px" },
  buyBtn: { border: "none", borderRadius: 14, padding: "10px 16px", color: "#fff", background: "#5aa9bd", cursor: "pointer", textAlign: "right" },
  buyDisabled: { background: "#aab7b8", cursor: "not-allowed" },
  maxed: { fontWeight: 800, color: "#8a9095", padding: "10px 16px" },
};

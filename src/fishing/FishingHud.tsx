import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import type { FishingStore } from "./fishingStore";
import { TIERS, getTier, type Water } from "./fishCatalog";
import type { CaughtFish } from "../game/playerStore";
import { Stick } from "../ui/Stick";

// Difficulty ramp across the 8 tiers (green → red) + a label per tier.
const TIER_COLORS = ["#6fae74", "#8fbf64", "#c9c24f", "#e8b24a", "#e8934a", "#e0743f", "#d4564f", "#a8343c"];
const TIER_WORDS = ["Novice", "Easy", "Moderate", "Hard", "Expert", "Master", "Elite", "Legendary"];
const tierColor = (t: number) => TIER_COLORS[Math.min(Math.max(t, 1), 8) - 1];

export interface BaitBarProps {
  options: { id: string; name: string; count: number; hint: string }[];
  equippedId: string | null;
  onEquip: (id: string | null) => void;
}

export type HookBarProps = BaitBarProps;

export interface CoolerInfo {
  count: number;
  cap: number;
  full: boolean;
  /** The catches currently kept in the cooler (most-recent last). */
  items: CaughtFish[];
}

export function FishingHud({
  store,
  onExit,
  bait,
  hooks,
  cooler,
}: {
  store: FishingStore;
  onExit?: () => void;
  bait?: BaitBarProps;
  hooks?: HookBarProps;
  cooler?: CoolerInfo;
}) {
  // Re-render on every throttled store notify.
  useSyncExternalStore(store.subscribe, store.getVersion);
  const [coolerOpen, setCoolerOpen] = useState(false);
  const s = store.state;
  const tensionPct = Math.min(s.tension / store.line.maxTension, 1.2) * 100;
  const danger = store.danger;
  const distancePct = (1 - s.distance / s.startDistance) * 100;

  // Keyboard controls for desktop testing.
  useEffect(() => {
    const down = new Set<string>();
    const apply = () => {
      store.setReel(down.has("ArrowDown") || down.has(" ") ? 1 : 0);
      store.setSteer((down.has("ArrowRight") ? 1 : 0) - (down.has("ArrowLeft") ? 1 : 0));
    };
    const onDown = (e: KeyboardEvent) => {
      if (["ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
        e.preventDefault();
        down.add(e.key);
        store.tapHook();
        apply();
      } else if (e.key === "Enter") {
        store.cast();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      down.delete(e.key);
      apply();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [store]);

  const fighting = s.phase === "fighting" || s.phase === "bite";
  const waiting = s.phase === "waiting";
  const showCast = s.phase === "idle" || s.phase === "landed" || s.phase === "lost";
  const isJunk = store.fish.kind === "junk";
  const nibbling = store.nibbling;
  // Don't reveal the species while waiting — only once it's hooked.
  const centerMsg = waiting ? (nibbling ? "Something's nibbling…" : "Waiting for a bite…") : s.message;

  return (
    <div style={ui.root}>
      {/* Leave the spot, back to the map */}
      {onExit && (
        <button style={ui.mapBtn} onClick={onExit}>
          ← Map
        </button>
      )}

      {/* Cooler fill — the session limiter; tap to see what you've kept */}
      {cooler && (
        <button
          style={{ ...ui.coolerChip, ...(cooler.full ? ui.coolerFull : null) }}
          onClick={() => setCoolerOpen(true)}
        >
          🧊 Cooler {cooler.count}/{cooler.cap}
        </button>
      )}

      {/* Cooler contents (read-only; selling happens at the shop) */}
      {cooler && coolerOpen && <CoolerView cooler={cooler} onClose={() => setCoolerOpen(false)} />}

      {/* Top: progress + stamina (only once fighting) */}
      {fighting && (
        <div style={ui.topBars}>
          <Meter label="Reeled in" pct={distancePct} color="#5aa9bd" />
          {!isJunk && <Meter label="Fish stamina" pct={s.stamina * 100} color="#d98a4f" />}
        </div>
      )}

      {/* Hooked label */}
      {fighting && (
        <div style={ui.fishLabel}>
          <span style={{ fontWeight: 700 }}>{store.fish.name}</span>
          {!isJunk && (
            <span style={{ ...ui.fishTier, color: tierColor(store.fish.tier) }}>
              T{store.fish.tier} · {TIER_WORDS[store.fish.tier - 1]}
            </span>
          )}
        </div>
      )}

      {/* Right: vertical tension gauge */}
      {fighting && (
        <div style={ui.tensionWrap}>
          <div style={ui.tensionLabel}>TENSION</div>
          <div style={ui.tensionTrack}>
            <div style={ui.dangerZone} />
            <div
              style={{
                ...ui.tensionFill,
                height: `${Math.min(tensionPct, 100)}%`,
                background: danger ? "#d4564f" : tensionPct > 50 ? "#e8c468" : "#6fae74",
              }}
            />
          </div>
          {danger && <div style={ui.snapWarn}>⚠ SNAP!</div>}
        </div>
      )}

      {/* Center message */}
      {centerMsg && (
        <div
          style={{
            ...ui.message,
            color: s.result === "landed"
              ? "#2e7d4f"
              : s.result === "lost"
                ? "#c0392b"
                : nibbling
                  ? "#d98a4f"
                  : "#3c5a57",
            fontSize: s.result || nibbling ? 24 : 18,
          }}
        >
          {centerMsg}
          {/* Why-it-happened feedback (e.g. shake-off: skill vs. luck) */}
          {s.subMessage && (s.phase === "lost" || s.phase === "landed") && (
            <div style={ui.subMessage}>{s.subMessage}</div>
          )}
        </div>
      )}

      {/* Bottom: tier picker + cast · wait panel · or the control stick */}
      <div style={ui.bottom}>
        {showCast ? (
          <CastPanel store={store} bait={bait} hooks={hooks} coolerFull={cooler?.full ?? false} />
        ) : waiting ? (
          <WaitPanel store={store} />
        ) : (
          <ReelStick store={store} />
        )}
      </div>
    </div>
  );
}

const QUALITY_COLORS: Record<string, string> = {
  S: "#a8343c",
  A: "#e0743f",
  B: "#c9a24f",
  C: "#6fae74",
  D: "#7d8a82",
};

/** Waiting screen: which hole you're at + a Recast escape hatch. */
function WaitPanel({ store }: { store: FishingStore }) {
  useSyncExternalStore(store.subscribe, store.getVersion);
  const hole = store.currentHole;
  return (
    <div style={ui.waitPanel}>
      <div style={ui.holeRow}>
        <span style={{ ...ui.qualityBadge, background: QUALITY_COLORS[hole.quality] }}>{hole.quality}</span>
        <span style={{ fontWeight: 700 }}>{hole.name}</span>
      </div>
      <button style={ui.recastBtn} onClick={() => store.recast()}>
        Reel in &amp; recast
      </button>
    </div>
  );
}

/** Tap-the-cooler panel: a read-only list of what you've kept this session. */
function CoolerView({ cooler, onClose }: { cooler: CoolerInfo; onClose: () => void }) {
  const totalValue = cooler.items.reduce((sum, f) => sum + f.value, 0);
  // Most-recent catch first.
  const items = cooler.items.slice().reverse();
  return (
    <div style={ui.coolerBackdrop} onClick={onClose}>
      <div style={ui.coolerPanel} onClick={(e) => e.stopPropagation()}>
        <div style={ui.coolerHeader}>
          <span style={{ fontWeight: 800, fontSize: 17 }}>
            🧊 Cooler {cooler.count}/{cooler.cap}
          </span>
          <button style={ui.coolerClose} onClick={onClose}>
            ✕
          </button>
        </div>

        {items.length === 0 ? (
          <div style={ui.coolerEmpty}>Cooler's empty — land a fish to fill it.</div>
        ) : (
          <>
            <div style={ui.coolerList}>
              {items.map((f, i) => (
                <div key={i} style={ui.coolerRow}>
                  <span style={{ ...ui.tierDot, background: tierColor(f.tier) }}>{f.tier}</span>
                  <span style={ui.coolerName}>{f.name}</span>
                  <span style={ui.coolerMeta}>
                    {f.weightKg} kg · {f.water === "fresh" ? "🟦" : "🌊"}
                  </span>
                  <span style={ui.coolerValue}>${f.value}</span>
                </div>
              ))}
            </div>
            <div style={ui.coolerFooter}>
              <span>Total value</span>
              <span style={{ fontWeight: 800 }}>${totalValue.toLocaleString()}</span>
            </div>
            <div style={ui.coolerHint}>Head to the 🎣 Shop to sell or mount these.</div>
          </>
        )}
      </div>
    </div>
  );
}

function Meter({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={ui.meterLabel}>{label}</div>
      <div style={ui.meterTrack}>
        <div style={{ ...ui.meterFill, width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
      </div>
    </div>
  );
}

/** Idle screen: the spot's name + Cast. Dev tier/water selectors gated behind DEV. */
function CastPanel({
  store,
  bait,
  hooks,
  coolerFull,
}: {
  store: FishingStore;
  bait?: BaitBarProps;
  hooks?: HookBarProps;
  coolerFull: boolean;
}) {
  useSyncExternalStore(store.subscribe, store.getVersion);
  const spot = store.currentSpot;
  const tier = getTier(store.selectedTier);
  const result = store.state.result;

  return (
    <div style={ui.castPanel}>
      {/* Spot identity (set by the map) */}
      {spot && (
        <div style={ui.holeRow}>
          <span style={{ ...ui.qualityBadge, background: QUALITY_COLORS[spot.quality] }}>{spot.quality}</span>
          <span style={{ fontWeight: 700 }}>{spot.name}</span>
        </div>
      )}

      {/* Bait selector */}
      {bait && bait.options.length > 0 && (
        <div style={ui.baitRow}>
          <button
            style={{ ...ui.baitChip, ...(bait.equippedId === null ? ui.baitChipActive : null) }}
            onClick={() => bait.onEquip(null)}
          >
            No bait
          </button>
          {bait.options.map((o) => (
            <button
              key={o.id}
              style={{ ...ui.baitChip, ...(bait.equippedId === o.id ? ui.baitChipActive : null) }}
              onClick={() => bait.onEquip(o.id)}
              title={o.hint}
            >
              {o.name} ×{o.count}
            </button>
          ))}
        </div>
      )}

      {/* Hook selector */}
      {hooks && hooks.options.length > 0 && (
        <div style={ui.baitRow}>
          <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.75, width: "100%", textAlign: "center" }}>🪝 Hook</span>
          {hooks.options.map((o) => (
            <button
              key={o.id}
              style={{ ...ui.baitChip, ...(hooks.equippedId === o.id ? ui.baitChipActive : null) }}
              onClick={() => hooks.onEquip(o.id)}
              title={o.hint}
            >
              {o.name} ×{o.count}
            </button>
          ))}
        </div>
      )}

      {/* DEV-only manual tier/water selectors (testing without the map) */}
      {import.meta.env.DEV && (
        <>
          <div style={ui.waterToggle}>
            {(["fresh", "salt"] as Water[]).map((w) => (
              <button
                key={w}
                style={{ ...ui.waterBtn, ...(store.selectedWater === w ? ui.waterBtnActive : null) }}
                onClick={() => store.setWater(w)}
              >
                {w === "fresh" ? "🟦 Freshwater" : "🌊 Saltwater"}
              </button>
            ))}
          </div>
          <div style={ui.tierGrid}>
            {TIERS.map((t) => {
              const active = t.tier === store.selectedTier;
              const locked = store.tierLocked(t.tier);
              return (
                <button
                  key={t.tier}
                  disabled={locked}
                  title={locked ? "Reachable by boat" : t.label}
                  style={{
                    ...ui.tierBtn,
                    borderColor: active ? tierColor(t.tier) : "transparent",
                    background: active ? "#fff" : "rgba(255,255,255,0.7)",
                    opacity: locked ? 0.5 : 1,
                    cursor: locked ? "not-allowed" : "pointer",
                  }}
                  onClick={() => store.selectTier(t.tier)}
                >
                  <div style={{ fontSize: 17, fontWeight: 800, color: tierColor(t.tier) }}>{t.tier}</div>
                  <div style={{ fontSize: 8 }}>{locked ? "🔒" : TIER_WORDS[t.tier - 1]}</div>
                </button>
              );
            })}
          </div>
          <div style={ui.tierBlurb}>dev: {tier.label}</div>
        </>
      )}

      {coolerFull ? (
        <div style={ui.coolerWarn}>🧊 Cooler full — head back (← Map) to sell</div>
      ) : (
        <button style={ui.castBtn} onClick={() => store.cast()}>
          {result ? "Fish again" : "Cast"}
        </button>
      )}
    </div>
  );
}

/** Drag-to-reel (pull down) + steer (left/right) control. */
function ReelStick({ store }: { store: FishingStore }) {
  // Lift the pad well clear of the screen edge: the full-reel drag (down) ends
  // at the pad's bottom edge, so without this the thumb runs into the phone.
  return (
    <div style={ui.reelStickLift}>
      <Stick
        hint="reel ↓ · steer ←→"
        onStart={() => store.tapHook()} // engaging sets the hook during a bite
        onMove={(x, y) => {
          store.setSteer(x);
          store.setReel(Math.max(0, y)); // pull DOWN to reel in
        }}
        onRelease={() => store.releaseInput()}
      />
    </div>
  );
}

const ui: Record<string, CSSProperties> = {
  root: {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    color: "#3c5a57",
    padding:
      "max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(20px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))",
  },
  mapBtn: { pointerEvents: "auto", position: "absolute", top: "max(14px, env(safe-area-inset-top))", left: "max(14px, env(safe-area-inset-left))", border: "none", borderRadius: 18, padding: "8px 14px", fontSize: 13, fontWeight: 700, color: "#3c5a57", background: "rgba(255,255,255,0.85)", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", cursor: "pointer", zIndex: 2 },
  coolerChip: { pointerEvents: "auto", position: "absolute", top: "max(14px, env(safe-area-inset-top))", right: "max(14px, env(safe-area-inset-right))", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: "#3c5a57", background: "rgba(255,255,255,0.85)", border: "none", borderRadius: 14, padding: "8px 12px", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", cursor: "pointer", zIndex: 2 },
  coolerFull: { background: "#d4564f", color: "#fff" },
  coolerBackdrop: { pointerEvents: "auto", position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 5 },
  coolerPanel: { width: "min(420px, 100%)", maxHeight: "min(70vh, 560px)", display: "flex", flexDirection: "column", background: "#f4f1e8", borderRadius: 20, boxShadow: "0 12px 40px rgba(0,0,0,0.3)", overflow: "hidden", color: "#3c5a57" },
  coolerHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid rgba(60,90,87,0.15)" },
  coolerClose: { border: "none", background: "rgba(60,90,87,0.1)", color: "#3c5a57", borderRadius: 10, width: 30, height: 30, fontSize: 15, fontWeight: 700, cursor: "pointer" },
  coolerEmpty: { padding: "32px 24px", textAlign: "center", opacity: 0.7, fontSize: 15 },
  coolerList: { overflowY: "auto", padding: "6px 0", flex: 1 },
  coolerRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 18px" },
  tierDot: { flex: "0 0 auto", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 6, color: "#fff", fontWeight: 800, fontSize: 12 },
  coolerName: { fontWeight: 700, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  coolerMeta: { fontSize: 12, opacity: 0.75, flex: "0 0 auto" },
  coolerValue: { fontWeight: 800, color: "#2e7d4f", flex: "0 0 auto", minWidth: 48, textAlign: "right" },
  coolerFooter: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderTop: "1px solid rgba(60,90,87,0.15)", fontSize: 15 },
  coolerHint: { padding: "0 18px 14px", fontSize: 12, opacity: 0.65, textAlign: "center" },
  coolerWarn: { fontWeight: 700, color: "#c0392b", textAlign: "center", maxWidth: 260, marginTop: 2 },
  topBars: { position: "absolute", top: 18, left: 96, right: 16, display: "flex", gap: 12 },
  meterLabel: { fontSize: 11, fontWeight: 600, opacity: 0.8, marginBottom: 3, textShadow: "0 1px 2px rgba(255,255,255,0.6)" },
  meterTrack: { height: 12, borderRadius: 6, background: "rgba(255,255,255,0.45)", overflow: "hidden", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.15)" },
  meterFill: { height: "100%", borderRadius: 6, transition: "width 0.08s linear" },
  fishLabel: { position: "absolute", top: 52, left: 0, right: 0, textAlign: "center", fontSize: 15, textShadow: "0 1px 2px rgba(255,255,255,0.6)", display: "flex", gap: 8, justifyContent: "center", alignItems: "baseline" },
  fishTier: { fontSize: 11, fontWeight: 700 },
  tensionWrap: { position: "absolute", right: 18, top: "28%", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },
  tensionLabel: { fontSize: 10, fontWeight: 700, letterSpacing: 1, opacity: 0.8 },
  tensionTrack: { position: "relative", width: 22, height: 180, borderRadius: 11, background: "rgba(255,255,255,0.45)", overflow: "hidden", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column-reverse" },
  dangerZone: { position: "absolute", top: 0, left: 0, right: 0, height: "20%", background: "rgba(212,86,79,0.25)" },
  tensionFill: { width: "100%", transition: "height 0.05s linear" },
  snapWarn: { fontSize: 12, fontWeight: 800, color: "#c0392b" },
  message: { position: "absolute", top: "14%", left: 0, right: 0, textAlign: "center", fontWeight: 700, textShadow: "0 1px 3px rgba(255,255,255,0.7)" },
  subMessage: { margin: "8px auto 0", maxWidth: 280, fontSize: 13, fontWeight: 600, lineHeight: 1.35, color: "#3c5a57", opacity: 0.85, textShadow: "0 1px 2px rgba(255,255,255,0.7)" },
  bottom: { position: "absolute", left: 0, right: 0, bottom: "max(20px, env(safe-area-inset-bottom))", display: "flex", justifyContent: "center" },
  reelStickLift: { marginBottom: 96 },
  waitPanel: { pointerEvents: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.42)", borderRadius: 20, padding: "12px 18px", backdropFilter: "blur(4px)", boxShadow: "0 4px 16px rgba(0,0,0,0.12)" },
  holeRow: { display: "flex", alignItems: "center", gap: 8, fontSize: 15 },
  qualityBadge: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 6, color: "#fff", fontWeight: 800, fontSize: 13 },
  recastBtn: { pointerEvents: "auto", border: "none", borderRadius: 20, padding: "9px 26px", fontSize: 14, fontWeight: 700, color: "#3c5a57", background: "rgba(255,255,255,0.85)", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", cursor: "pointer" },
  castPanel: { pointerEvents: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.42)", borderRadius: 20, padding: "12px 16px", backdropFilter: "blur(4px)", boxShadow: "0 4px 16px rgba(0,0,0,0.12)" },
  baitRow: { display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", maxWidth: 300 },
  baitChip: { border: "none", borderRadius: 12, padding: "6px 10px", fontSize: 12, fontWeight: 600, color: "#3c5a57", background: "rgba(255,255,255,0.7)", cursor: "pointer" },
  baitChipActive: { background: "#5aa9bd", color: "#fff" },
  waterToggle: { display: "flex", gap: 6 },
  waterBtn: { pointerEvents: "auto", border: "none", borderRadius: 14, padding: "6px 14px", fontSize: 12, fontWeight: 600, color: "#3c5a57", background: "rgba(255,255,255,0.6)", cursor: "pointer" },
  waterBtnActive: { background: "#5aa9bd", color: "#fff" },
  tierGrid: { display: "grid", gridTemplateColumns: "repeat(4, 46px)", gap: 6 },
  tierBtn: { pointerEvents: "auto", width: 46, height: 46, borderRadius: 12, border: "2px solid transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1.1, color: "#3c5a57" },
  tierLabel: { fontSize: 14, fontWeight: 700 },
  tierBlurb: { fontSize: 11, opacity: 0.75, maxWidth: 264, textAlign: "center" },
  castBtn: { pointerEvents: "auto", border: "none", borderRadius: 24, padding: "11px 38px", fontSize: 17, fontWeight: 700, color: "#fff", background: "#5aa9bd", boxShadow: "0 4px 12px rgba(0,0,0,0.2)", cursor: "pointer", marginTop: 2 },
};

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import type { FishingStore } from "./fishingStore";
import { TIERS, getTier, type Water } from "./fishCatalog";

const STICK_R = 68; // px radius of the control pad

// Difficulty ramp across the 8 tiers (green → red) + a label per tier.
const TIER_COLORS = ["#6fae74", "#8fbf64", "#c9c24f", "#e8b24a", "#e8934a", "#e0743f", "#d4564f", "#a8343c"];
const TIER_WORDS = ["Novice", "Easy", "Moderate", "Hard", "Expert", "Master", "Elite", "Legendary"];
const tierColor = (t: number) => TIER_COLORS[Math.min(Math.max(t, 1), 8) - 1];

export function FishingHud({ store }: { store: FishingStore }) {
  // Re-render on every throttled store notify.
  useSyncExternalStore(store.subscribe, store.getVersion);
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
  const hooked = fighting || s.phase === "waiting";
  const showCast = s.phase === "idle" || s.phase === "landed" || s.phase === "lost";
  const isJunk = store.fish.kind === "junk";

  return (
    <div style={ui.root}>
      {/* Top: progress + stamina */}
      {hooked && (
        <div style={ui.topBars}>
          <Meter label="Reeled in" pct={distancePct} color="#5aa9bd" />
          {!isJunk && <Meter label="Fish stamina" pct={s.stamina * 100} color="#d98a4f" />}
        </div>
      )}

      {/* Hooked label */}
      {hooked && (
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
      {s.message && (
        <div
          style={{
            ...ui.message,
            color: s.result === "landed" ? "#2e7d4f" : s.result === "lost" ? "#c0392b" : "#3c5a57",
            fontSize: s.result ? 24 : 18,
          }}
        >
          {s.message}
        </div>
      )}

      {/* Bottom: tier picker + cast, or the control stick */}
      <div style={ui.bottom}>{showCast ? <CastPanel store={store} /> : <Stick store={store} />}</div>
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

/** Idle screen: pick water + difficulty tier, then cast. */
function CastPanel({ store }: { store: FishingStore }) {
  useSyncExternalStore(store.subscribe, store.getVersion);
  const tier = getTier(store.selectedTier);
  const result = store.state.result;

  return (
    <div style={ui.castPanel}>
      {/* Fresh / Salt toggle */}
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

      {/* 8-tier grid (4×2); boat tiers locked */}
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

      <div style={ui.tierLabel}>{tier.label}</div>
      <div style={ui.tierBlurb}>{tier.blurb}</div>
      <button style={ui.castBtn} onClick={() => store.cast()}>
        {result ? "Fish again" : "Cast"}
      </button>
    </div>
  );
}

/** Drag-to-reel (pull down) + steer (left/right) virtual stick. */
function Stick({ store }: { store: FishingStore }) {
  const padRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef(false);

  const update = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const r = pad.getBoundingClientRect();
    let dx = clientX - (r.left + r.width / 2);
    let dy = clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > STICK_R) {
      dx = (dx / len) * STICK_R;
      dy = (dy / len) * STICK_R;
    }
    setKnob({ x: dx, y: dy });
    store.setSteer(dx / STICK_R);
    store.setReel(Math.max(0, dy / STICK_R)); // pull DOWN to reel in
  };

  return (
    <div
      ref={padRef}
      style={ui.stickPad}
      onPointerDown={(e) => {
        active.current = true;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        store.tapHook(); // engaging sets the hook during a bite
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => active.current && update(e.clientX, e.clientY)}
      onPointerUp={() => {
        active.current = false;
        setKnob({ x: 0, y: 0 });
        store.releaseInput();
      }}
      onPointerCancel={() => {
        active.current = false;
        setKnob({ x: 0, y: 0 });
        store.releaseInput();
      }}
    >
      <div style={ui.stickHint}>reel ↓ · steer ←→</div>
      <div style={{ ...ui.stickKnob, transform: `translate(${knob.x}px, ${knob.y}px)` }} />
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
  topBars: { position: "absolute", top: 16, left: 16, right: 16, display: "flex", gap: 12 },
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
  bottom: { position: "absolute", left: 0, right: 0, bottom: "max(20px, env(safe-area-inset-bottom))", display: "flex", justifyContent: "center" },
  castPanel: { pointerEvents: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.42)", borderRadius: 20, padding: "12px 16px", backdropFilter: "blur(4px)", boxShadow: "0 4px 16px rgba(0,0,0,0.12)" },
  waterToggle: { display: "flex", gap: 6 },
  waterBtn: { pointerEvents: "auto", border: "none", borderRadius: 14, padding: "6px 14px", fontSize: 12, fontWeight: 600, color: "#3c5a57", background: "rgba(255,255,255,0.6)", cursor: "pointer" },
  waterBtnActive: { background: "#5aa9bd", color: "#fff" },
  tierGrid: { display: "grid", gridTemplateColumns: "repeat(4, 46px)", gap: 6 },
  tierBtn: { pointerEvents: "auto", width: 46, height: 46, borderRadius: 12, border: "2px solid transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1.1, color: "#3c5a57" },
  tierLabel: { fontSize: 14, fontWeight: 700 },
  tierBlurb: { fontSize: 11, opacity: 0.75, maxWidth: 264, textAlign: "center" },
  castBtn: { pointerEvents: "auto", border: "none", borderRadius: 24, padding: "11px 38px", fontSize: 17, fontWeight: 700, color: "#fff", background: "#5aa9bd", boxShadow: "0 4px 12px rgba(0,0,0,0.2)", cursor: "pointer", marginTop: 2 },
  stickPad: { pointerEvents: "auto", position: "relative", width: STICK_R * 2, height: STICK_R * 2, borderRadius: "50%", background: "rgba(255,255,255,0.35)", border: "2px solid rgba(255,255,255,0.6)", touchAction: "none", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(0,0,0,0.12)" },
  stickHint: { position: "absolute", fontSize: 10, opacity: 0.7, fontWeight: 600, pointerEvents: "none" },
  stickKnob: { width: 56, height: 56, borderRadius: "50%", background: "rgba(90,169,189,0.9)", boxShadow: "0 2px 8px rgba(0,0,0,0.25)", pointerEvents: "none" },
};

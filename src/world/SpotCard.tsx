import type { CSSProperties } from "react";
import type { Spot } from "./regions";

const QUALITY_COLORS: Record<string, string> = {
  S: "#a8343c",
  A: "#e0743f",
  B: "#c9a24f",
  C: "#6fae74",
  D: "#7d8a82",
};

const BODY_LABEL: Record<string, string> = {
  stream: "Stream",
  river: "River",
  lake: "Lake",
  dock: "Dock",
  "deep-lake": "Deep Lake",
  beach: "Beach",
  pier: "Pier",
  offshore: "Offshore",
};

/** DOM overlay shown when a land POI is tapped: fish on foot or take the boat out. */
export function SpotCard({
  spot,
  footFee,
  boatFee,
  currency,
  offersBoat,
  canBoat,
  onFishFoot,
  onBoat,
  onClose,
}: {
  spot: Spot;
  footFee: number;
  boatFee: number;
  currency: number;
  offersBoat: boolean;
  canBoat: boolean;
  onFishFoot: (s: Spot) => void;
  onBoat: (s: Spot) => void;
  onClose: () => void;
}) {
  const tiers = spot.tiers.map((t) => t.tier);
  const tierRange = `T${Math.min(...tiers)}–T${Math.max(...tiers)}`;
  const canAffordFoot = footFee === 0 || currency >= footFee;
  const canAffordBoat = currency >= boatFee;

  return (
    <div style={card.backdrop} onClick={onClose}>
      <div style={card.panel} onClick={(e) => e.stopPropagation()}>
        <div style={card.headerRow}>
          <span style={{ ...card.quality, background: QUALITY_COLORS[spot.quality] }}>{spot.quality}</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{spot.name}</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              {spot.water === "fresh" ? "🟦 Freshwater" : "🌊 Saltwater"} · {BODY_LABEL[spot.body]} · {tierRange}
            </div>
          </div>
        </div>
        <p style={card.blurb}>{spot.blurb}</p>

        {canAffordFoot ? (
          <button style={card.fishBtn} onClick={() => onFishFoot(spot)}>
            Fish on foot · {footFee === 0 ? "Free" : `$${footFee}`}
          </button>
        ) : (
          <div style={card.locked}>🔒 Not enough money to fish here (${footFee})</div>
        )}

        {offersBoat &&
          (!canBoat ? (
            <div style={card.locked}>
              🔒 Take the boat out — needs {spot.water === "salt" ? "an ocean-capable" : "a"} boat
            </div>
          ) : canAffordBoat ? (
            <button style={{ ...card.fishBtn, background: "#5aa9bd" }} onClick={() => onBoat(spot)}>
              🚤 Take the boat out · ${boatFee}
            </button>
          ) : (
            <div style={card.locked}>🔒 Not enough money to take the boat out (${boatFee})</div>
          ))}

        <button style={card.closeBtn} onClick={onClose}>
          Back to map
        </button>
      </div>
    </div>
  );
}

const card: Record<string, CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    background: "rgba(0,0,0,0.12)",
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    color: "#3c5a57",
  },
  panel: {
    width: "min(420px, 92vw)",
    background: "rgba(255,255,255,0.96)",
    borderRadius: "20px 20px 0 0",
    padding: "18px 18px max(22px, env(safe-area-inset-bottom))",
    boxShadow: "0 -6px 24px rgba(0,0,0,0.2)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  headerRow: { display: "flex", alignItems: "center", gap: 12 },
  quality: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: 10,
    color: "#fff",
    fontWeight: 800,
    fontSize: 18,
    flexShrink: 0,
  },
  blurb: { fontSize: 13, opacity: 0.85, margin: 0, lineHeight: 1.4 },
  fishBtn: {
    border: "none",
    borderRadius: 24,
    padding: "13px",
    fontSize: 17,
    fontWeight: 700,
    color: "#fff",
    background: "#5aa9bd",
    cursor: "pointer",
  },
  locked: {
    textAlign: "center",
    padding: "12px",
    borderRadius: 14,
    background: "rgba(0,0,0,0.05)",
    fontWeight: 700,
    color: "#8a6d3b",
  },
  closeBtn: {
    border: "none",
    background: "transparent",
    color: "#3c5a57",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    opacity: 0.7,
  },
};

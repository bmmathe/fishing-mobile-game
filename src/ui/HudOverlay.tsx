/**
 * Minimal DOM overlay on top of the 3D canvas. Real HUD (spot occupancy,
 * inventory, cast button) will live here later; for now it just labels the
 * placeholder scene.
 */
export function HudOverlay() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        // Respect notch / home indicator on phones
        padding:
          "max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))",
        color: "#3c5a57",
        textShadow: "0 1px 2px rgba(255,255,255,0.6)",
      }}
    >
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: 0.5 }}>
          Tidal Ties
        </h1>
        <p style={{ fontSize: 13, opacity: 0.8 }}>low-poly aesthetic preview</p>
      </div>
      <p style={{ fontSize: 12, opacity: 0.7 }}>
        drag to orbit · pinch / scroll to zoom
      </p>
    </div>
  );
}

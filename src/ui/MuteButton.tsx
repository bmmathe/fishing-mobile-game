import { useState, type CSSProperties } from "react";
import { sfx } from "../audio/sfx";

/** Small speaker toggle for the global sound mute (persisted). */
export function MuteButton({ style }: { style?: CSSProperties }) {
  const [muted, setMuted] = useState(sfx.muted);
  return (
    <button
      style={{ ...base, ...style }}
      aria-label={muted ? "Unmute sounds" : "Mute sounds"}
      onClick={() => {
        const m = sfx.toggleMuted();
        setMuted(m);
        if (!m) sfx.uiTap(); // audible confirmation on unmute
      }}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}

const base: CSSProperties = {
  pointerEvents: "auto",
  border: "none",
  borderRadius: 14,
  padding: "8px 10px",
  fontSize: 14,
  background: "rgba(255,255,255,0.85)",
  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  cursor: "pointer",
};

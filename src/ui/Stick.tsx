import { useRef, useState, type CSSProperties } from "react";

const R = 68; // px radius of the control pad

/**
 * A reusable virtual thumb-stick. Reports normalized (x, y) in [-1, 1] where
 * +y is downward (drag down). Used for both the fishing reel/steer control and
 * boat steering/throttle.
 */
export function Stick({
  onMove,
  onStart,
  onRelease,
  hint,
}: {
  onMove: (x: number, y: number) => void;
  onStart?: () => void;
  onRelease?: () => void;
  hint?: string;
}) {
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
    if (len > R) {
      dx = (dx / len) * R;
      dy = (dy / len) * R;
    }
    setKnob({ x: dx, y: dy });
    onMove(dx / R, dy / R);
  };

  const release = () => {
    active.current = false;
    setKnob({ x: 0, y: 0 });
    onRelease?.();
  };

  return (
    <div
      ref={padRef}
      style={styles.pad}
      onPointerDown={(e) => {
        active.current = true;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        onStart?.();
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => active.current && update(e.clientX, e.clientY)}
      onPointerUp={release}
      onPointerCancel={release}
    >
      {hint && <div style={styles.hint}>{hint}</div>}
      <div style={{ ...styles.knob, transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  pad: {
    pointerEvents: "auto",
    position: "relative",
    width: R * 2,
    height: R * 2,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.35)",
    border: "2px solid rgba(255,255,255,0.6)",
    touchAction: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
  },
  hint: { position: "absolute", fontSize: 10, opacity: 0.7, fontWeight: 600, pointerEvents: "none", color: "#3c5a57", fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  knob: { width: 56, height: 56, borderRadius: "50%", background: "rgba(90,169,189,0.9)", boxShadow: "0 2px 8px rgba(0,0,0,0.25)", pointerEvents: "none" },
};

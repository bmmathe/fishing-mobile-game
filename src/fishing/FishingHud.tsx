import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import type { Catch, FishingStore } from "./fishingStore";
import { TIERS, getTier, type Water } from "./fishCatalog";
import type { CaughtFish } from "../game/playerStore";
import { fishValue } from "../game/gear";
import { fmtRestLeft } from "../game/spotRest";
import { CatchArt } from "./CatchArt";
import { sfx } from "../audio/sfx";
import { MuteButton } from "../ui/MuteButton";
import { Stick } from "../ui/Stick";

// Difficulty ramp across the tiers (green → red, gold for mythic) + a label per tier.
const TIER_COLORS = ["#6fae74", "#8fbf64", "#c9c24f", "#e8b24a", "#e8934a", "#e0743f", "#d4564f", "#a8343c", "#d4a017"];
const TIER_WORDS = ["Novice", "Easy", "Moderate", "Hard", "Expert", "Master", "Elite", "Legendary", "Mythic"];
const tierColor = (t: number) => TIER_COLORS[Math.min(Math.max(t, 1), TIER_COLORS.length) - 1];

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
  /** Cooler re-icing: ms until keeping fish is allowed again (0 = open). */
  keepLockedMs: number;
}

export function FishingHud({
  store,
  onExit,
  bait,
  hooks,
  cooler,
  tutorial,
}: {
  store: FishingStore;
  onExit?: () => void;
  bait?: BaitBarProps;
  hooks?: HookBarProps;
  cooler?: CoolerInfo;
  tutorial?: boolean;
}) {
  // Re-render on every throttled store notify.
  useSyncExternalStore(store.subscribe, store.getVersion);
  const [coolerOpen, setCoolerOpen] = useState(false);
  // Latch the tutorial for the whole session: banking the first fish flips the
  // prop mid-fight, but the coach should stay up to show its final card.
  const [tutorialSession] = useState(!!tutorial);
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
        // Only the reel keys pull — a stray steer press while the bobber is
        // out shouldn't scare the fish off.
        if (e.key === "ArrowDown" || e.key === " ") store.tapHook();
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

  // The bite keeps the wait panel (and its PULL button) up — the bobber is the
  // tell, not a panel switch. Fight UI appears only once the hook is set.
  const fighting = s.phase === "fighting";
  const waiting = s.phase === "waiting" || s.phase === "bite";
  const showCast = s.phase === "idle" || s.phase === "landed" || s.phase === "lost";
  const isJunk = store.fish.kind === "junk";
  const nibbling = store.nibbling;
  const pending = store.lastCatch;
  // Don't reveal the species while waiting — only once it's hooked. The catch
  // modal replaces the center message while it's open. (During the bite phase
  // s.message carries "Fish on! PULL!".)
  const centerMsg = pending
    ? null
    : s.phase === "waiting"
      ? (nibbling ? "Something's nibbling…" : "Waiting for a bite…")
      : s.message;

  return (
    <div style={ui.root}>
      {/* Leave the spot, back to the map */}
      {onExit && (
        <button style={ui.mapBtn} onClick={() => { sfx.uiTap(); onExit(); }}>
          ← Map
        </button>
      )}
      <MuteButton style={{ position: "absolute", top: "max(14px, env(safe-area-inset-top))", left: 96, zIndex: 2 }} />

      {/* Cooler fill — the session limiter; tap to see what you've kept */}
      {cooler && (
        <button
          style={{ ...ui.coolerChip, ...(cooler.full || cooler.keepLockedMs > 0 ? ui.coolerFull : null) }}
          onClick={() => { sfx.uiTap(); setCoolerOpen(true); }}
        >
          🧊 Cooler {cooler.count}/{cooler.cap}
          {cooler.keepLockedMs > 0 && ` · re-icing ${fmtRestLeft(cooler.keepLockedMs)}`}
        </button>
      )}

      {/* Cooler contents (read-only; selling happens at the shop) */}
      {cooler && coolerOpen && <CoolerView cooler={cooler} onClose={() => setCoolerOpen(false)} />}

      {/* Catch reveal: keep it (cooler) or trash it (junk) before recasting */}
      {pending && (
        <CatchModal
          c={pending}
          fallbackColor={store.fish.color}
          coolerFull={cooler?.full ?? false}
          keepLockedMs={cooler?.keepLockedMs ?? 0}
          onKeep={() => store.keepCatch()}
          onTrash={() => store.dismissCatch()}
        />
      )}

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

      {/* First-timer how-to-fish coach */}
      {tutorialSession && <TutorialCoach store={store} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tutorial coach                                                      */
/* ------------------------------------------------------------------ */

type TutStep = "cast" | "wait" | "hook" | "reel" | "steer" | "tension" | "land" | "keep" | "done" | "hidden";

/** Order for the little progress dots (terminal steps excluded). */
const TUT_ORDER: TutStep[] = ["cast", "wait", "hook", "reel", "steer", "tension", "land", "keep"];

const TUT_TEXT: Record<Exclude<TutStep, "hidden">, string> = {
  cast: "Tap the Cast button to throw your line.",
  wait: "Now we wait. Watch the bobber — a twitch is just a nibble. Only PULL when it dips hard under!",
  hook: "BITE! Quick — tap PULL to set the hook!",
  reel: "You're hooked up! Drag the stick DOWN to reel the fish in.",
  steer: "The fish pulls side to side. Steer the stick LEFT/RIGHT toward the fish to ease the strain.",
  tension: "Watch the TENSION bar on the right. In the red the line can SNAP — stop reeling for a moment and let it drop.",
  land: "You've got the hang of it. Reel it all the way in!",
  keep: "You landed it! Now decide what to do with it.",
  done: "🎉 You're a fisher now! Sell catches at the 🎣 Shop and buy stronger line to hook bigger fish. Good luck out there!",
};

/**
 * Step-by-step how-to-fish coach for first-timers. Watches the live fight and
 * advances on real events (bite, reeling, steering, tension spikes), so each
 * mechanic is taught the moment the player needs it. A lost fish or junk catch
 * loops back to casting; the tutorial completes when a real fish is kept.
 */
function TutorialCoach({ store }: { store: FishingStore }) {
  useSyncExternalStore(store.subscribe, store.getVersion);
  const [step, setStep] = useState<TutStep>("cast");
  const [note, setNote] = useState<string | null>(null); // extra line after a setback
  const wasJunk = useRef(false);
  const reelMs = useRef(0);
  const steerMs = useRef(0);
  const sawHighTension = useRef(false);
  const stepStart = useRef(performance.now());
  const lastT = useRef(performance.now());

  const s = store.state;
  const phase = s.phase;

  useEffect(() => {
    const now = performance.now();
    const dt = Math.min(now - lastT.current, 100);
    lastT.current = now;
    const go = (n: TutStep, msg: string | null = null) => {
      setStep(n);
      setNote(msg);
      stepStart.current = now;
    };
    const landed = () => {
      wasJunk.current = !!store.lastCatch?.isJunk;
      go("keep", wasJunk.current ? "Ha — junk! It happens. Trash it and cast again." : null);
    };

    // A lost fish at any point → back to casting with encouragement.
    if (phase === "lost" && step !== "cast" && step !== "done" && step !== "hidden") {
      go("cast", "It got away — that happens to everyone. Cast again!");
      return;
    }

    switch (step) {
      case "cast":
        if (phase === "waiting") go("wait");
        else if (phase === "bite") go("hook");
        else if (phase === "fighting") go("reel");
        break;
      case "wait":
        if (phase === "bite") go("hook");
        else if (phase === "fighting") go("reel");
        // Only an early PULL ends a waiting cast → coach the timing.
        else if (phase === "idle") go("cast", "Too soon! Wait for the bobber to dip hard, THEN pull.");
        break;
      case "hook":
        if (phase === "fighting") {
          reelMs.current = 0;
          go("reel");
        } else if (phase === "idle") go("cast", "Too slow — it spat the hook. Cast again!");
        else if (phase === "landed") landed();
        break;
      case "reel":
        if (phase === "landed") landed();
        else if (phase === "fighting") {
          if (store.input.reel > 0.25) reelMs.current += dt;
          if (reelMs.current > 900) {
            steerMs.current = 0;
            go("steer");
          }
        }
        break;
      case "steer":
        if (phase === "landed") landed();
        else if (phase === "fighting") {
          if (Math.abs(store.input.steer) > 0.25) steerMs.current += dt;
          if (steerMs.current > 900) {
            sawHighTension.current = false;
            go("tension");
          }
        }
        break;
      case "tension":
        if (phase === "landed") landed();
        else if (phase === "fighting") {
          const ratio = s.tension / store.line.maxTension;
          if (ratio > 0.55) sawHighTension.current = true;
          // learned it (spiked then eased off), or move on after a while
          if ((sawHighTension.current && ratio < 0.45) || now - stepStart.current > 9000) go("land");
        }
        break;
      case "land":
        if (phase === "landed") landed();
        break;
      case "keep":
        if (!store.lastCatch) {
          if (wasJunk.current) go("cast", "Junk goes in the trash. Cast again for a real fish!");
          else go("done");
        }
        break;
    }
    // Runs on every throttled store notify (~25/s), which is our tick.
  });

  if (step === "hidden") return null;
  const idx = TUT_ORDER.indexOf(step);

  return (
    <div style={{ ...ui.tutCard, ...(step === "done" ? ui.tutCardDone : null) }}>
      <div style={ui.tutHeader}>
        <span>🎓 How to fish</span>
        {idx >= 0 && (
          <span style={ui.tutDots}>
            {TUT_ORDER.map((o, i) => (
              <span key={o} style={{ ...ui.tutDot, background: i <= idx ? "#e8a83c" : "rgba(90,74,30,0.25)" }} />
            ))}
          </span>
        )}
      </div>
      {note && <div style={ui.tutNote}>{note}</div>}
      <div style={ui.tutText}>{TUT_TEXT[step as Exclude<TutStep, "hidden">]}</div>
      {step === "done" && (
        <button style={ui.tutDoneBtn} onClick={() => { sfx.uiTap(); setStep("hidden"); }}>
          Start fishing!
        </button>
      )}
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

/**
 * Waiting/bite screen: which hole you're at + the PULL button. Pull during the
 * bite window sets the hook; pull too early (or miss the window) and the cast
 * is over — watch the bobber.
 */
function WaitPanel({ store }: { store: FishingStore }) {
  useSyncExternalStore(store.subscribe, store.getVersion);
  const hole = store.currentHole;
  return (
    <div style={ui.waitPanel}>
      <div style={ui.holeRow}>
        <span style={{ ...ui.qualityBadge, background: QUALITY_COLORS[hole.quality] }}>{hole.quality}</span>
        <span style={{ fontWeight: 700 }}>{hole.name}</span>
      </div>
      <button style={ui.pullBtn} onClick={() => store.tapHook()}>
        PULL!
      </button>
      <div style={ui.pullHint}>Pull when the bobber dips under — too early scares it off</div>
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
                  <span style={ui.coolerThumb}>
                    <CatchArt name={f.name} size={64} />
                  </span>
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

/**
 * The catch reveal: species portrait + stats, resolved by one button —
 * "Add to Cooler" for fish (release if full), "Put in Trash" for junk.
 */
function CatchModal({
  c,
  fallbackColor,
  coolerFull,
  keepLockedMs,
  onKeep,
  onTrash,
}: {
  c: Catch;
  fallbackColor: string;
  coolerFull: boolean;
  /** Cooler re-icing: ms until keeps re-open (0 = keeping allowed). */
  keepLockedMs: number;
  onKeep: () => void;
  onTrash: () => void;
}) {
  const value = c.isJunk ? 0 : fishValue(c.tier, c.weightKg);
  const fullRelease = !c.isJunk && (coolerFull || keepLockedMs > 0);
  const mythic = !c.isJunk && c.tier === 9;
  return (
    <div style={ui.coolerBackdrop}>
      <style>{`
        @keyframes catchPop { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes mythicShimmer { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes mythicGlow { 0%, 100% { box-shadow: 0 0 18px 4px rgba(244,196,83,0.55), 0 14px 44px rgba(0,0,0,0.35); } 50% { box-shadow: 0 0 34px 10px rgba(244,196,83,0.85), 0 14px 44px rgba(0,0,0,0.35); } }
      `}</style>
      <div
        style={{
          ...ui.catchPanel,
          animation: mythic ? "catchPop 0.28s ease-out, mythicGlow 2.4s ease-in-out infinite" : "catchPop 0.28s ease-out",
          ...(mythic ? { border: "2px solid #f4c453" } : null),
        }}
      >
        <div style={mythic ? ui.catchBannerMythic : ui.catchBanner}>
          {c.isJunk ? "You hauled in…" : mythic ? "✨ A MYTHIC takes the hook ✨" : "You caught…"}
        </div>
        <div
          style={{
            ...ui.catchArtWrap,
            ...(mythic
              ? {
                  background: "linear-gradient(120deg, #f0d06a, #ffe89a, #fff4c8, #ffd75e, #f0d06a)",
                  backgroundSize: "300% 300%",
                  animation: "mythicShimmer 4s ease-in-out infinite",
                }
              : { background: c.isJunk ? "#e8e4d6" : "#dceef0" }),
          }}
        >
          <CatchArt name={c.name} color={fallbackColor} size={230} animated={mythic} />
        </div>
        <div style={{ ...ui.catchName, ...(mythic ? { color: "#a8790f" } : null) }}>{c.name}</div>

        {c.isJunk ? (
          <div style={ui.catchMeta}>Not worth a dime. Keep the waters clean!</div>
        ) : (
          <div style={ui.catchStats}>
            <span style={{ ...ui.tierDot, background: tierColor(c.tier) }}>{c.tier}</span>
            <span style={ui.catchStat}>{c.weightKg} kg</span>
            <span style={ui.catchStat}>{c.water === "fresh" ? "🟦 Fresh" : "🌊 Salt"}</span>
            <span style={{ ...ui.catchStat, color: "#2e7d4f", fontWeight: 800 }}>${value}</span>
          </div>
        )}
        {c.bait && !c.isJunk && (
          <div style={ui.catchBaitHint}>
            🪱 Keeps as bait — lures T{Math.min(...c.bait.forTiers)}–T{Math.max(...c.bait.forTiers)}
          </div>
        )}
        {fullRelease && (
          <div style={ui.catchFullWarn}>
            {keepLockedMs > 0 && !coolerFull
              ? `🧊 Cooler re-icing (${fmtRestLeft(keepLockedMs)}) — it'll be released`
              : "🧊 Cooler full — it'll be released"}
          </div>
        )}

        <button
          style={{ ...ui.catchBtn, background: c.isJunk ? "#8a8f96" : fullRelease ? "#c98a5a" : "#3f9e6a" }}
          onClick={c.isJunk ? onTrash : onKeep}
        >
          {c.isJunk ? "🗑 Put in Trash" : fullRelease ? "Release" : "🧊 Add to Cooler"}
        </button>
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
            onClick={() => { sfx.equip(); bait.onEquip(null); }}
          >
            No bait
          </button>
          {bait.options.map((o) => (
            <button
              key={o.id}
              style={{ ...ui.baitChip, ...(bait.equippedId === o.id ? ui.baitChipActive : null) }}
              onClick={() => { sfx.equip(); bait.onEquip(o.id); }}
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
              onClick={() => { sfx.equip(); hooks.onEquip(o.id); }}
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
  coolerRow: { display: "flex", alignItems: "center", gap: 10, padding: "6px 18px" },
  coolerThumb: { flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", width: 64, height: 38, background: "#dceef0", borderRadius: 10, overflow: "hidden" },
  tierDot: { flex: "0 0 auto", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 6, color: "#fff", fontWeight: 800, fontSize: 12 },
  coolerName: { fontWeight: 700, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  coolerMeta: { fontSize: 12, opacity: 0.75, flex: "0 0 auto" },
  coolerValue: { fontWeight: 800, color: "#2e7d4f", flex: "0 0 auto", minWidth: 48, textAlign: "right" },
  coolerFooter: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderTop: "1px solid rgba(60,90,87,0.15)", fontSize: 15 },
  coolerHint: { padding: "0 18px 14px", fontSize: 12, opacity: 0.65, textAlign: "center" },
  coolerWarn: { fontWeight: 700, color: "#c0392b", textAlign: "center", maxWidth: 260, marginTop: 2 },
  catchPanel: { width: "min(340px, 92vw)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, background: "#f4f1e8", borderRadius: 22, boxShadow: "0 14px 44px rgba(0,0,0,0.35)", padding: "16px 18px 18px", color: "#3c5a57" },
  catchBanner: { fontSize: 13, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", opacity: 0.65 },
  catchBannerMythic: { fontSize: 13, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", color: "#a8790f" },
  catchArtWrap: { borderRadius: 16, padding: "4px 0", width: "100%", display: "flex", justifyContent: "center", boxShadow: "inset 0 1px 4px rgba(0,0,0,0.08)" },
  catchName: { fontSize: 21, fontWeight: 800, textAlign: "center", lineHeight: 1.15 },
  catchStats: { display: "flex", alignItems: "center", gap: 12, fontSize: 14 },
  catchStat: { fontWeight: 700 },
  catchMeta: { fontSize: 13, opacity: 0.7, textAlign: "center" },
  catchBaitHint: { fontSize: 12, fontWeight: 600, color: "#8a6a3a", background: "rgba(233,221,196,0.7)", borderRadius: 10, padding: "4px 10px" },
  catchFullWarn: { fontSize: 12, fontWeight: 700, color: "#c0392b" },
  catchBtn: { pointerEvents: "auto", border: "none", borderRadius: 22, padding: "12px 34px", fontSize: 16, fontWeight: 800, color: "#fff", boxShadow: "0 4px 14px rgba(0,0,0,0.22)", cursor: "pointer", marginTop: 4 },
  tutCard: { position: "absolute", top: "max(64px, calc(env(safe-area-inset-top) + 50px))", left: "50%", transform: "translateX(-50%)", width: "min(330px, 86vw)", background: "#fff6dc", border: "1.5px solid #f4c453", borderRadius: 16, padding: "10px 14px 12px", color: "#5a4a1e", boxShadow: "0 6px 20px rgba(0,0,0,0.2)", zIndex: 6, pointerEvents: "none" },
  tutCardDone: { top: "22%", pointerEvents: "auto", textAlign: "center" },
  tutHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", opacity: 0.85, marginBottom: 5 },
  tutDots: { display: "inline-flex", gap: 4 },
  tutDot: { width: 7, height: 7, borderRadius: "50%" },
  tutNote: { fontSize: 12.5, fontWeight: 700, color: "#a8642c", marginBottom: 4 },
  tutText: { fontSize: 14, fontWeight: 600, lineHeight: 1.35 },
  tutDoneBtn: { pointerEvents: "auto", marginTop: 10, border: "none", borderRadius: 18, padding: "10px 26px", fontSize: 15, fontWeight: 800, color: "#fff", background: "#3f9e6a", boxShadow: "0 4px 12px rgba(0,0,0,0.2)", cursor: "pointer" },
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
  pullBtn: { pointerEvents: "auto", border: "none", borderRadius: 26, padding: "16px 54px", fontSize: 20, fontWeight: 800, letterSpacing: 1, color: "#fff", background: "#d98a4f", boxShadow: "0 4px 14px rgba(0,0,0,0.25)", cursor: "pointer" },
  pullHint: { fontSize: 11, fontWeight: 600, opacity: 0.75, maxWidth: 240, textAlign: "center" },
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

/**
 * Pure simulation of the fishing fight — the "drag-to-reel + steer" catch
 * mechanic. No rendering, no React: just state in, state out, so it can be
 * unit/headlessly tested and tuned independently of the UI.
 *
 * Design goals (per product direction):
 *  - Skill matters a lot; high ceiling, "hours to master".
 *  - NOT a QTE, NOT a simple tension bar.
 *
 * The core tension is a risk/reward loop:
 *  - Reeling + countering the fish's runs makes progress but RAISES line
 *    tension. Hold tension too high too long → the line SNAPS (you lose).
 *  - Backing off drops tension but lets the fish take line back and recover
 *    stamina. Too much slack during a run → the fish can THROW the hook.
 *  - A tired fish (low stamina) is easier to gain line on. You tire it by
 *    keeping sustained pressure (high-ish tension) — flirting with the snap
 *    threshold is the fast, risky line.
 */

export type FightPhase =
  | "idle" // nothing hooked; waiting for the player to cast
  | "waiting" // cast out, waiting for a bite
  | "bite" // a fish is biting — set the hook
  | "fighting" // the active fight
  | "landed" // success
  | "lost"; // line snapped or hook thrown

export interface FishSpec {
  name: string;
  /** Baseline pull force (raises tension while fighting). */
  strength: number;
  /** How hard the fish pulls / takes line during a run. */
  runStrength: number;
  /** Per-second probability the fish starts a new run (scaled by stamina). */
  runChance: number;
  /** How quickly the fish changes lateral direction (steer counter window). */
  agility: number;
  /** Starting distance to land, in abstract units. */
  startDistance: number;
  /**
   * How securely the fish is hooked, 0..1 (default 1 = solid). Low values mean
   * a lightly-hooked fish that can shake free during a run — the dominant
   * failure mode for small, jumpy fish (vs. big fish, which snap the line).
   * Good tension control reduces the shake-off chance but can't eliminate it.
   */
  hookHold?: number;
}

export interface LineSpec {
  /** Tension at which the line is at its breaking point (1 = reference line). */
  maxTension: number;
  /** Reel-in speed multiplier from the equipped pole (default 1). */
  reelMult?: number;
}

export interface FightInput {
  /** 0..1 — how hard the player is reeling. */
  reel: number;
  /** -1..1 — rod steer; positive = right, negative = left. */
  steer: number;
  /** Edge-triggered: player tapped to set the hook this step. */
  setHook?: boolean;
}

export interface FightState {
  phase: FightPhase;
  /** Units remaining to land the fish (0 = caught). */
  distance: number;
  startDistance: number;
  /** Normalized vs the line's max; >= maxTension sustained → snap. */
  tension: number;
  /** Seconds tension has been in the danger zone (for the snap grace timer). */
  overTime: number;
  /** Seconds the line has been dangerously slack during a run (throw timer). */
  slackTime: number;
  /** Fish remaining energy, 0..1. */
  stamina: number;
  /** Target lateral pull direction, -1..1. */
  fishDir: number;
  /** Smoothed actual lateral direction the fish is pulling, -1..1. */
  fishDirCurrent: number;
  /** True while the fish is making a run. */
  running: boolean;
  /** Seconds left in the current run. */
  runTimer: number;
  /** Countdown until a bite (waiting phase). */
  waitTimer: number;
  /** Countdown of the bite window (bite phase). */
  biteTimer: number;
  result?: "landed" | "lost";
  message: string;
  /** Optional secondary line giving feedback on *why* an outcome happened. */
  subMessage?: string;
}

export type Rng = () => number;

// ---- Tuning constants (iterate on these to change game feel) ----
export const TUNING = {
  /** Tension added per second at full reel. */
  reelTension: 0.42,
  /** Tension added per second from fighting the fish's pull (scaled). */
  fightTension: 0.7,
  /** Tension bled off per second when not loading the rod. */
  tensionRelax: 0.55,
  /** Units of line gained per second at full reel (before tired bonus). */
  reelSpeed: 2.6,
  /** Units of line the fish takes per second during an uncountered run. */
  runPull: 3.1,
  /** Fish stamina drained per second, scaled by applied pressure. */
  staminaDrain: 0.16,
  /** Fish stamina recovered per second when the player gives slack. */
  staminaRecover: 0.05,
  /** Tension below which the line counts as "slack". */
  slackThreshold: 0.12,
  /** Seconds over max tension before the line snaps. */
  snapGrace: 0.55,
  /** Seconds of slack-during-a-run before the fish throws the hook. */
  throwGrace: 1.6,
  /** Bite window length in seconds. */
  biteWindow: 1.2,
  /** How long before the bite the fish starts "nibbling" (the tell). */
  nibbleLead: 0.7,
  /** Base shake-off hazard per second during a run at hookHold=0. */
  slipHazard: 0.8,
  /** Shake-off multiplier when tension is well-managed (the skill reward). */
  slipControlFloor: 0.4,
  /** Fraction-of-maxTension band considered "well managed" for slip. */
  slipBandLo: 0.25,
  slipBandHi: 0.82,
} as const;

export function makeFight(fish: FishSpec): FightState {
  return {
    phase: "idle",
    distance: fish.startDistance,
    startDistance: fish.startDistance,
    tension: 0,
    overTime: 0,
    slackTime: 0,
    stamina: 1,
    fishDir: 0,
    fishDirCurrent: 0,
    running: false,
    runTimer: 0,
    waitTimer: 0,
    biteTimer: 0,
    message: "Tap to cast",
  };
}

/**
 * Begin a cast → bite sequence. `waitSeconds` (the time until a bite) is rolled
 * by the caller from the current fishing hole, keeping this model hole-agnostic.
 */
export function startCast(fish: FishSpec, waitSeconds: number): FightState {
  const s = makeFight(fish);
  s.phase = "waiting";
  s.waitTimer = Math.max(0, waitSeconds);
  s.message = "Waiting for a bite…";
  return s;
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Advance the fight by `dt` seconds given the player's current input.
 * Mutates and returns the same state object for cheap per-frame stepping.
 */
export function stepFight(
  s: FightState,
  input: FightInput,
  fish: FishSpec,
  line: LineSpec,
  dt: number,
  rng: Rng = Math.random,
): FightState {
  switch (s.phase) {
    case "waiting": {
      s.waitTimer -= dt;
      if (s.waitTimer <= 0) {
        s.phase = "bite";
        s.biteTimer = TUNING.biteWindow;
        s.message = "Fish on! Set the hook!";
      }
      return s;
    }

    case "bite": {
      s.biteTimer -= dt;
      // Forgiving hookset: an explicit tap OR any real reel/steer input sets it.
      const engaged =
        input.setHook || input.reel > 0.15 || Math.abs(input.steer) > 0.3;
      if (engaged) {
        s.phase = "fighting";
        s.running = false;
        s.message = "";
      } else if (s.biteTimer <= 0) {
        s.phase = "idle";
        s.message = "It spat the hook. Tap to cast";
      }
      return s;
    }

    case "fighting":
      break; // handled below

    default:
      return s; // idle / landed / lost are terminal until reset
  }

  // ---- Active fight ----
  const reel = clamp(input.reel, 0, 1);
  const steer = clamp(input.steer, -1, 1);

  // Fish AI: start/continue/end runs.
  if (s.running) {
    s.runTimer -= dt;
    if (s.runTimer <= 0) {
      s.running = false;
      s.fishDir = 0; // settle toward center between runs
    }
  } else {
    // More energetic fish run more often; a tired fish rests more.
    const p = fish.runChance * (0.35 + 0.65 * s.stamina) * dt;
    if (rng() < p) {
      s.running = true;
      s.runTimer = 0.5 + rng() * (1.1 / Math.max(0.5, fish.agility / 3));
      const side = rng() < 0.5 ? -1 : 1;
      s.fishDir = side * (0.55 + rng() * 0.45);
    } else if (rng() < 0.6 * dt) {
      // small idle drift so the target isn't dead-center
      s.fishDir = (rng() * 2 - 1) * 0.25;
    }
  }

  // Smooth actual pull direction toward the target at the fish's agility rate.
  const maxStep = fish.agility * dt;
  s.fishDirCurrent += clamp(s.fishDir - s.fishDirCurrent, -maxStep, maxStep);

  // How well the player is countering the lateral pull.
  // Ideal steer is OPPOSITE the fish's direction, so opposition > 0 when
  // countering correctly, < 0 when steering the same way (giving slack).
  const opposition = clamp(-steer * s.fishDirCurrent, -1, 1);
  const counter = Math.max(0, opposition);

  // Current pull magnitude from the fish.
  const pull = fish.strength * (s.running ? fish.runStrength : 1);

  // --- Tension ---
  const reelLoad = reel * TUNING.reelTension;
  // Countering a strong, running fish loads the rod hard.
  const fightLoad = pull * (0.35 + 0.65 * counter) * TUNING.fightTension;
  s.tension += (reelLoad + fightLoad) * dt;
  // Relaxes when you ease off the reel.
  s.tension -= TUNING.tensionRelax * (1 - 0.6 * reel) * dt;
  s.tension = Math.max(0, s.tension);

  // --- Distance / stamina ---
  // A tired fish yields line faster; a better pole (reelMult) reels faster.
  const tiredBonus = 1 + (1 - s.stamina) * 0.8;
  const gain = reel * TUNING.reelSpeed * tiredBonus * (line.reelMult ?? 1);
  // The fish only takes meaningful line on an uncountered run.
  const lineOut = s.running ? pull * (1 - counter) * TUNING.runPull : 0;
  s.distance = clamp(s.distance + (lineOut - gain) * dt, 0, s.startDistance);

  // Pressure tires the fish; slack lets it recover.
  const pressure = s.tension + counter * 0.25;
  if (s.tension > TUNING.slackThreshold) {
    s.stamina -= pressure * TUNING.staminaDrain * dt;
  } else {
    s.stamina += TUNING.staminaRecover * dt;
  }
  s.stamina = clamp(s.stamina, 0, 1);

  // --- Fail / win checks ---
  // Snap: tension over the line's limit for too long.
  if (s.tension >= line.maxTension) {
    s.overTime += dt;
    if (s.overTime >= TUNING.snapGrace) {
      s.phase = "lost";
      s.result = "lost";
      s.message = "SNAP! The line broke.";
      return s;
    }
  } else {
    s.overTime = Math.max(0, s.overTime - dt * 2);
  }

  // Throw: too slack while the fish is running pulls the hook free.
  if (s.running && s.tension < TUNING.slackThreshold) {
    s.slackTime += dt;
    if (s.slackTime >= TUNING.throwGrace) {
      s.phase = "lost";
      s.result = "lost";
      s.message = "The fish threw the hook.";
      return s;
    }
  } else {
    s.slackTime = Math.max(0, s.slackTime - dt * 2);
  }

  // Shake-off: a lightly-hooked fish (low hookHold) can throw the hook during a
  // run. Good tension control cuts the hazard to slipControlFloor but never to
  // zero, so small fish carry an irreducible chance of getting away — the
  // dominant failure mode at low tiers, where the line rarely snaps.
  const hold = fish.hookHold ?? 1;
  if (s.running && hold < 1) {
    const ratio = s.tension / line.maxTension;
    const wellManaged = ratio >= TUNING.slipBandLo && ratio <= TUNING.slipBandHi;
    const hazard = TUNING.slipHazard * (1 - hold) * (wellManaged ? TUNING.slipControlFloor : 1);
    if (rng() < hazard * dt) {
      s.phase = "lost";
      s.result = "lost";
      s.message = "The hook pulled free!";
      // Tell the player whether they could have done better or just got
      // unlucky — at full hazard (band missed) it was partly avoidable; in the
      // safe band, a lightly-hooked fish can still shake loose by chance.
      s.subMessage = wellManaged
        ? "Tension was well-managed — that one just shook loose. Lightly-hooked fish sometimes do."
        : ratio < TUNING.slipBandLo
          ? "Too much slack during the run — keep tension up to hold the hook in."
          : "Tension was redlined during the run — ease off so it stays out of the snap zone.";
      return s;
    }
  }

  // Win: fish reeled all the way in.
  if (s.distance <= 0) {
    s.phase = "landed";
    s.result = "landed";
    s.message = `Landed the ${fish.name}!`;
  }

  return s;
}

/** Is the fish nibbling — the brief tell just before the bite? */
export function isNibbling(s: FightState): boolean {
  return s.phase === "waiting" && s.waitTimer > 0 && s.waitTimer <= TUNING.nibbleLead;
}

/** Convenience: is the line in the visual danger zone? */
export function isDanger(s: FightState, line: LineSpec): boolean {
  return s.tension >= line.maxTension * 0.8;
}

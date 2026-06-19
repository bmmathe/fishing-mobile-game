/**
 * Gear progression + fish pricing — the economy's tuning knobs.
 *
 * Line tiers raise the fight's snap limit (`maxTension`), which is what unlocks
 * higher fish tiers (a tier-6 fish overwhelms the starter line). The steps are
 * aligned with `TIERS.baseLine` in fishCatalog so each purchase opens the next
 * band. Pole tiers raise reel speed (`reelMult`) so fish come in faster.
 *
 * All numbers are first-pass; `npm run sim:gear` validates the unlock curve and
 * economy pacing.
 */

export interface LineTier {
  name: string;
  /** Snap-limit (LineSpec.maxTension) this line provides. */
  maxTension: number;
  /** Cost to buy this tier (cumulative tiers; L1 is free/starter). */
  price: number;
}

export interface PoleTier {
  name: string;
  /** Reel-in speed multiplier. */
  reelMult: number;
  price: number;
}

// maxTension steps are calibrated against the fight model (see npm run sim:gear):
// each tier opens roughly the next fish-tier band; the top line makes T8 a
// brutal-but-possible catch. (Tension scales steeply for the big fish.)
export const LINE_TIERS: LineTier[] = [
  { name: "Starter Line", maxTension: 0.78, price: 0 }, // T1-2 comfy, T3-4 hard
  { name: "Braided Line", maxTension: 1.8, price: 150 }, // eases T3-4
  { name: "Fluorocarbon", maxTension: 3.4, price: 650 }, // unlocks T5
  { name: "Steel Leader", maxTension: 6, price: 2800 }, // unlocks T6, T7 possible
  { name: "Deep-Sea Cable", maxTension: 10, price: 11000 }, // T7 comfy, T8 possible
];

export const POLE_TIERS: PoleTier[] = [
  { name: "Cane Pole", reelMult: 1.0, price: 0 },
  { name: "Spinning Rod", reelMult: 1.2, price: 250 },
  { name: "Baitcaster", reelMult: 1.45, price: 1000 },
  { name: "Offshore Rod", reelMult: 1.75, price: 4000 },
  { name: "Game Reel", reelMult: 2.1, price: 14000 },
];

/** Base sell value per tier (before the weight bonus). */
const TIER_BASE = [0, 3, 8, 20, 50, 120, 320, 750, 1700];

/**
 * Sell value of a landed fish: scales with tier (steeply) and weight (a fish at
 * the top of its weight range is worth ~40% more than a small one).
 */
export function fishValue(tier: number, weightKg: number): number {
  const base = TIER_BASE[tier] ?? 0;
  // Weight bonus saturates so giant outliers don't explode the economy.
  const wBonus = 0.7 + 0.3 * Math.min(1, Math.log10(1 + weightKg) / 2);
  return Math.max(1, Math.round(base * wBonus));
}

/**
 * Bait definitions + the bait-tier hook tables.
 *
 * Each bait has a TIER — "the fish it catches". Fishing with TN bait replaces
 * the spot's natural tier roll with TN's table below, and slashes the junk
 * share of any T1 roll (fishCatalog.BAITED_JUNK_WEIGHT). Bait can also shorten
 * the wait-to-bite (`waitFactor` < 1). Bait does NOT ease reeling (gear does).
 *
 * Standard "Worms" (T2 bait) are buyable from the merchant; every other bait
 * comes from keeping a caught forage fish (premium/rare bait is catch-only,
 * per the PRD). Numbers are validated via `npm run sim:bait`.
 */

import type { TierWeight } from "../world/regions";

export interface BaitDef {
  id: string;
  name: string;
  grade: number; // 0 = worms, 1-3 = forage grades from the catalog
  /** The bait's tier — drives the hook table below. */
  tier: number;
  /** Tiers this bait is sold as luring (display; tier is derived from these). */
  forTiers: number[];
  /** Wait-to-bite multiplier (1 = no help, <1 shortens). */
  waitFactor: number;
  buyable?: boolean;
  price?: number;
}

/**
 * Hook distribution by bait tier (Brett's scale), as % by tier-offset from the
 * bait's tier. T2 bait can even tempt one tier ABOVE it; from T3 up the
 * same-tier chance drops 10 points per tier (big fish are hard to fool even
 * with the right bait), the tier below holds at 30, and the remainder falls
 * two below. Junk: any T1 roll while baited uses BAITED_JUNK_WEIGHT (~10%
 * junk); tables without T1 mean no junk at all.
 */
const BAIT_TIER_TABLE: Record<number, { offset: number; pct: number }[]> = {
  2: [{ offset: 1, pct: 10 }, { offset: 0, pct: 60 }, { offset: -1, pct: 30 }],
  3: [{ offset: 0, pct: 70 }, { offset: -1, pct: 30 }],
  4: [{ offset: 0, pct: 60 }, { offset: -1, pct: 30 }, { offset: -2, pct: 10 }],
  5: [{ offset: 0, pct: 50 }, { offset: -1, pct: 30 }, { offset: -2, pct: 20 }],
  6: [{ offset: 0, pct: 40 }, { offset: -1, pct: 30 }, { offset: -2, pct: 30 }],
  7: [{ offset: 0, pct: 30 }, { offset: -1, pct: 30 }, { offset: -2, pct: 40 }],
  8: [{ offset: 0, pct: 20 }, { offset: -1, pct: 30 }, { offset: -2, pct: 50 }],
};

/**
 * Resolve a bait's hook table against the tiers a spot actually offers.
 * Weight aimed at tiers the spot doesn't have falls through to the LOWEST tier
 * the table and spot share (the big ones aren't there — you hook the small
 * ones instead; e.g. T2 bait at a T1-2 stream: the 10% above-tier slot falls
 * to T1 → 60/40). Returns null when the table and spot share no tiers — the
 * bait can't target anything here, so the caller uses the spot's natural pool.
 */
export function baitTierWeights(baitTier: number, spotTiers: TierWeight[]): TierWeight[] | null {
  const table = BAIT_TIER_TABLE[Math.max(2, Math.min(8, baitTier))];
  const offered = new Set(spotTiers.map((t) => t.tier));
  const kept = table.filter((e) => offered.has(baitTier + e.offset));
  if (kept.length === 0) return null;
  const lost = table.reduce((sum, e) => sum + e.pct, 0) - kept.reduce((sum, e) => sum + e.pct, 0);
  const lowest = kept.reduce((min, e) => (e.offset < min.offset ? e : min));
  return kept.map((e) => ({
    tier: baitTier + e.offset,
    weight: e.pct + (e === lowest ? lost : 0),
  }));
}

/** A bait's tier: the middle of the range it's sold as luring. */
function tierOf(forTiers: number[]): number {
  return Math.round(forTiers.reduce((a, b) => a + b, 0) / forTiers.length);
}

/** Standard, always-buyable T2 bait. */
export const WORMS: BaitDef = {
  id: "worms",
  name: "Worms",
  grade: 0,
  tier: 2,
  forTiers: [1, 2, 3],
  waitFactor: 0.85,
  buyable: true,
  price: 5,
};

/** Default wait effect by forage grade. */
const BY_GRADE: Record<number, { waitFactor: number }> = {
  1: { waitFactor: 0.7 }, // small forage: fast bites
  2: { waitFactor: 0.9 }, // cut bait
  3: { waitFactor: 0.95 }, // rare live bait
};

/** Per-species wait tweaks so baits feel distinct. */
const SPECIES: Record<string, Partial<Pick<BaitDef, "waitFactor">>> = {
  "Golden Shiner": { waitFactor: 0.55 }, // flashy → fast bites
  "Sand Eel": { waitFactor: 0.55 },
  Cisco: { waitFactor: 0.9 },
  "Goggle-eye": { waitFactor: 0.9 },
};

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/** Build a bait def from a caught forage fish's bait metadata. */
export function baitFromFish(name: string, grade: number, forTiers: number[]): BaitDef {
  const base = BY_GRADE[grade] ?? { waitFactor: 0.9 };
  const over = SPECIES[name] ?? {};
  return {
    id: slug(name),
    name,
    grade,
    tier: tierOf(forTiers),
    forTiers,
    waitFactor: over.waitFactor ?? base.waitFactor,
  };
}

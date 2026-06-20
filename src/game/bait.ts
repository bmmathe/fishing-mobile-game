/**
 * Bait definitions. Bait raises the odds of hooking the higher tiers it lures
 * (`tierBoost` scales those tiers' weight in a spot's roll) and/or shortens the
 * wait-to-bite (`waitFactor` < 1). The two levers are independent per bait, so a
 * bait can help tier odds, wait, or both. Bait does NOT ease reeling (gear does).
 *
 * Standard "Worms" are buyable from the merchant; every other bait comes from
 * keeping a caught forage fish (premium/rare bait is catch-only, per the PRD).
 * Numbers are tuned via `npm run sim:bait`.
 */

export interface BaitDef {
  id: string;
  name: string;
  grade: number; // 0 = worms, 1-3 = forage grades from the catalog
  forTiers: number[];
  /** Weight multiplier applied to forTiers in the tier roll (1 = no help). */
  tierBoost: number;
  /** Wait-to-bite multiplier (1 = no help, <1 shortens). */
  waitFactor: number;
  buyable?: boolean;
  price?: number;
}

/** Standard, always-buyable bait. */
export const WORMS: BaitDef = {
  id: "worms",
  name: "Worms",
  grade: 0,
  forTiers: [1, 2, 3],
  tierBoost: 1.5,
  waitFactor: 0.85,
  buyable: true,
  price: 5,
};

/** Default effect by forage grade. */
const BY_GRADE: Record<number, { tierBoost: number; waitFactor: number }> = {
  1: { tierBoost: 1.6, waitFactor: 0.7 }, // small forage: modest tier help, fast bites
  2: { tierBoost: 2.6, waitFactor: 0.9 }, // cut bait: strong tier help
  3: { tierBoost: 4.0, waitFactor: 0.95 }, // rare live bait: lures the monsters
};

/** Per-species tweaks so baits feel distinct (tier-only / wait-only / mix). */
const SPECIES: Record<string, Partial<Pick<BaitDef, "tierBoost" | "waitFactor">>> = {
  "Golden Shiner": { tierBoost: 1.2, waitFactor: 0.55 }, // flashy → fast bites, little tier help
  "Sand Eel": { tierBoost: 1.2, waitFactor: 0.55 },
  "Gizzard Shad": { tierBoost: 3.0, waitFactor: 1.0 }, // big cut bait → tier only
  Menhaden: { tierBoost: 3.0, waitFactor: 1.0 },
  Cisco: { tierBoost: 4.5, waitFactor: 0.9 },
  "Goggle-eye": { tierBoost: 4.5, waitFactor: 0.9 },
};

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/** Build a bait def from a caught forage fish's bait metadata. */
export function baitFromFish(name: string, grade: number, forTiers: number[]): BaitDef {
  const base = BY_GRADE[grade] ?? { tierBoost: 1.5, waitFactor: 0.9 };
  const over = SPECIES[name] ?? {};
  return {
    id: slug(name),
    name,
    grade,
    forTiers,
    tierBoost: over.tierBoost ?? base.tierBoost,
    waitFactor: over.waitFactor ?? base.waitFactor,
  };
}

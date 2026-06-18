import type { FishSpec } from "./fishingModel";

/**
 * The fish taxonomy. Two orthogonal axes:
 *
 *  - **Tier (1-8)** is a pure *difficulty band*. Each tier targets a skilled
 *    catch-rate on STARTER gear (see TIERS.targetCatchRate). Higher tiers pull
 *    harder, run more, are more agile, and fight longer.
 *  - **Water (fresh | salt)** — every tier exists in both, with *different
 *    species*. A tier-1 baitfish on an ocean beach is a different fish than a
 *    tier-1 minnow in a lake, but the same difficulty.
 *
 * `access` gates the high end: tiers 6-8 are **boat-only** and can't be reached
 * from land (locked in the UI until boats exist). `locations` tags are
 * forward-looking data for the future map/travel system (not all freshwater
 * species live in every lake). `bait` flags forage fish and what they lure —
 * consumed later by the bait system. `kind:"junk"` is a trivial reel-in (boot,
 * trash) that reuses the fight model with near-zero difficulty.
 *
 * Difficulty is tuned against `scripts/sim.ts` (`npm run sim`): a skilled bot's
 * win-rate per tier should track targetCatchRate on the reference starter line.
 * Gear upgrades (future) raise the line's maxTension, which is what turns the
 * ~0% tier 6-8 fish into catchable ones (PRD: high-tier fish snap low-tier
 * lines).
 */

export type Water = "fresh" | "salt";
export type Access = "land" | "boat";
export type ItemKind = "fish" | "junk";

export interface Bait {
  /** Relative bait quality. */
  grade: number;
  /** Tiers this species can be used as bait for (future bait system). */
  forTiers: number[];
}

export interface FishDef extends FishSpec {
  tier: number;
  water: Water;
  access: Access;
  kind: ItemKind;
  /** Body color for the fish marker in the scene. */
  color: string;
  /** Flavor weight range in kg (min, max). */
  weightKg: [number, number];
  /** Present if this species is usable as bait. */
  bait?: Bait;
  /** Forward-looking location/region tags for the travel + map system. */
  locations: string[];
}

export interface TierDef {
  tier: number;
  label: string;
  blurb: string;
  access: Access;
  /** Skilled catch-rate target on starter gear, junk excluded (0..1). */
  targetCatchRate: number;
  /** Line maxTension this tier is balanced around (gear gating). */
  baseLine: number;
}

export const TIERS: TierDef[] = [
  { tier: 1, label: "Tier 1 · Forage & Junk", blurb: "Minnows, baitfish, and the odd boot. Easy pickings.", access: "land", targetCatchRate: 0.8, baseLine: 0.6 },
  { tier: 2, label: "Tier 2 · Panfish & Schoolers", blurb: "Quick darters and prime cut bait.", access: "land", targetCatchRate: 0.6, baseLine: 0.7 },
  { tier: 3, label: "Tier 3 · Gamefish & Rare Bait", blurb: "Strong fighters — and the rare bait that lures monsters.", access: "land", targetCatchRate: 0.33, baseLine: 0.8 },
  { tier: 4, label: "Tier 4 · Predators", blurb: "Powerful and long-winded. Clean tension control only.", access: "land", targetCatchRate: 0.18, baseLine: 0.9 },
  { tier: 5, label: "Tier 5 · Apex", blurb: "The biggest you'll land from shore — barely.", access: "land", targetCatchRate: 0.04, baseLine: 1.0 },
  { tier: 6, label: "Tier 6 · Deepwater", blurb: "Boat only. Upgraded gear required to survive a run.", access: "boat", targetCatchRate: 0, baseLine: 1.2 },
  { tier: 7, label: "Tier 7 · Big Game", blurb: "Boat only. Bluewater brutes.", access: "boat", targetCatchRate: 0, baseLine: 1.4 },
  { tier: 8, label: "Tier 8 · Legendary", blurb: "Boat only. Mythical. The catch of a lifetime.", access: "boat", targetCatchRate: 0, baseLine: 1.6 },
];

/**
 * Per-tier base fight params; individual species tweak via overrides.
 * Low tiers fail mostly by shake-off (low `hookHold`); high tiers by line-snap
 * (high `strength`). The two mechanics together produce a smooth catch-rate
 * curve without making small fish absurdly strong.
 */
const BAND: Record<number, Omit<FishSpec, "name">> = {
  1: { strength: 0.3, runStrength: 1.2, runChance: 0.45, agility: 2.2, startDistance: 11, hookHold: 0.85 },
  2: { strength: 0.42, runStrength: 1.35, runChance: 0.52, agility: 2.7, startDistance: 15, hookHold: 0.81 },
  3: { strength: 0.7, runStrength: 1.55, runChance: 0.62, agility: 3.1, startDistance: 19, hookHold: 0.82 },
  4: { strength: 0.76, runStrength: 1.7, runChance: 0.7, agility: 3.6, startDistance: 23, hookHold: 0.9 },
  5: { strength: 0.9, runStrength: 1.85, runChance: 0.76, agility: 4.1, startDistance: 27, hookHold: 0.95 },
  6: { strength: 1.05, runStrength: 2.0, runChance: 0.8, agility: 4.5, startDistance: 32, hookHold: 0.98 },
  7: { strength: 1.25, runStrength: 2.2, runChance: 0.84, agility: 5.0, startDistance: 38, hookHold: 0.99 },
  8: { strength: 1.5, runStrength: 2.4, runChance: 0.88, agility: 5.5, startDistance: 45, hookHold: 0.99 },
};

/** Build a fish from its tier band + per-species overrides. */
function mk(
  tier: number,
  water: Water,
  name: string,
  color: string,
  weightKg: [number, number],
  extra: Partial<FishDef> = {},
): FishDef {
  return {
    name,
    tier,
    water,
    access: tier <= 5 ? "land" : "boat",
    kind: "fish",
    color,
    weightKg,
    locations: [],
    ...BAND[tier],
    ...extra,
  };
}

/** A trivial junk catch — reels in fast, never snaps. */
function junk(water: Water, name: string, color: string, locations: string[]): FishDef {
  return {
    name,
    tier: 1,
    water,
    access: "land",
    kind: "junk",
    color,
    weightKg: [0, 2],
    locations,
    strength: 0.04,
    runStrength: 1,
    runChance: 0,
    agility: 1,
    startDistance: 6,
  };
}

const LAKE = ["lake-generic"];
const BEACH = ["ocean-beach"];
const PIER = ["ocean-pier"];
const INSHORE = ["ocean-inshore"];
const BLUE = ["ocean-bluewater"];

export const FISH: FishDef[] = [
  // ---------- Tier 1 — Forage & Junk ----------
  mk(1, "fresh", "Fathead Minnow", "#8a8f7a", [0.01, 0.05], { bait: { grade: 1, forTiers: [2, 3] }, locations: LAKE }),
  mk(1, "fresh", "Golden Shiner", "#d9c879", [0.02, 0.1], { bait: { grade: 1, forTiers: [2, 3] }, locations: LAKE }),
  mk(1, "fresh", "Mosquitofish", "#9aa18c", [0.01, 0.03], { locations: LAKE }),
  junk("fresh", "Worn Boot", "#6e5a3f", LAKE),
  junk("fresh", "Rusty Can", "#8a7a5a", LAKE),
  junk("fresh", "Tangled Line", "#b0b0a0", LAKE),
  junk("fresh", "Soggy Log", "#6e5a3f", LAKE),
  mk(1, "salt", "Bay Anchovy", "#c7cdb0", [0.01, 0.04], { bait: { grade: 1, forTiers: [2, 3] }, locations: BEACH }),
  mk(1, "salt", "Sand Eel", "#c2bf8f", [0.02, 0.08], { bait: { grade: 1, forTiers: [2, 3] }, locations: BEACH }),
  mk(1, "salt", "Killifish", "#9aa17e", [0.01, 0.05], { locations: BEACH }),
  junk("salt", "Old Boot", "#6e5a3f", BEACH),
  junk("salt", "Crab-trap Debris", "#7a7a6a", BEACH),
  junk("salt", "Driftwood", "#9a8a6a", BEACH),
  junk("salt", "Seaweed Clump", "#6f8a5e", BEACH),

  // ---------- Tier 2 — Panfish & Schoolers ----------
  mk(2, "fresh", "Bluegill", "#7fae6a", [0.2, 0.6], { locations: LAKE }),
  mk(2, "fresh", "Yellow Perch", "#e0b24f", [0.3, 1.0], { locations: LAKE }),
  mk(2, "fresh", "Pumpkinseed", "#e0a85a", [0.2, 0.5], { locations: LAKE }),
  mk(2, "fresh", "Gizzard Shad", "#b9c2c9", [0.2, 0.8], { bait: { grade: 2, forTiers: [3, 4] }, locations: LAKE }),
  mk(2, "salt", "Pinfish", "#d9c87a", [0.1, 0.4], { locations: PIER }),
  mk(2, "salt", "Atlantic Croaker", "#c9b48a", [0.3, 1.2], { locations: PIER }),
  mk(2, "salt", "Menhaden", "#b9c2c9", [0.2, 0.7], { bait: { grade: 2, forTiers: [3, 4, 5] }, locations: PIER }),
  mk(2, "salt", "Sardine", "#c2ccd2", [0.05, 0.2], { bait: { grade: 2, forTiers: [3, 4, 5] }, locations: PIER }),

  // ---------- Tier 3 — Gamefish & Rare Bait ----------
  mk(3, "fresh", "Largemouth Bass", "#7a9e5e", [1, 4], { locations: LAKE }),
  mk(3, "fresh", "Smallmouth Bass", "#9a8a55", [1, 3.5], { runChance: 0.66, agility: 3.3, locations: LAKE }),
  mk(3, "fresh", "Brown Trout", "#b08a4f", [1, 5], { locations: ["river", "lake-generic"] }),
  mk(3, "fresh", "Cisco", "#b7c4cc", [0.3, 1.2], { bait: { grade: 3, forTiers: [6, 7, 8] }, locations: ["lake-westcoast"] }),
  mk(3, "fresh", "Alewife", "#c2cdd4", [0.1, 0.4], { bait: { grade: 3, forTiers: [6, 7, 8] }, locations: ["lake-eastcoast"] }),
  mk(3, "salt", "Striped Bass", "#8a93a0", [2, 6], { locations: PIER }),
  mk(3, "salt", "Bluefish", "#7d9aa6", [1, 5], { runChance: 0.68, locations: PIER }),
  mk(3, "salt", "Spanish Mackerel", "#6f93a0", [1, 4], { agility: 3.4, locations: INSHORE }),
  mk(3, "salt", "Goggle-eye", "#b6a25a", [0.3, 1], { bait: { grade: 3, forTiers: [7, 8] }, locations: INSHORE }),
  mk(3, "salt", "Threadfin Herring", "#c2ccd2", [0.1, 0.4], { bait: { grade: 3, forTiers: [7, 8] }, locations: INSHORE }),

  // ---------- Tier 4 — Predators ----------
  mk(4, "fresh", "Walleye", "#b6a25a", [2, 8], { locations: LAKE }),
  mk(4, "fresh", "Northern Pike", "#5f8a6b", [3, 12], { runStrength: 1.78, agility: 3.8, locations: LAKE }),
  mk(4, "fresh", "Channel Catfish", "#8f8a7d", [2, 10], { agility: 3.2, locations: ["river"] }),
  mk(4, "fresh", "Rainbow Trout", "#c98a8f", [2, 7], { locations: ["river", "lake-westcoast"] }),
  mk(4, "salt", "Red Drum", "#c98a5a", [4, 14], { locations: INSHORE }),
  mk(4, "salt", "Snook", "#b0a98f", [3, 11], { runChance: 0.73, locations: INSHORE }),
  mk(4, "salt", "Cobia", "#6e6a5c", [5, 18], { locations: INSHORE }),
  mk(4, "salt", "False Albacore", "#5a7a8a", [3, 9], { runStrength: 1.8, agility: 3.9, locations: INSHORE }),

  // ---------- Tier 5 — Apex (land-reachable max) ----------
  mk(5, "fresh", "Muskellunge", "#6b8290", [8, 25], { locations: LAKE }),
  mk(5, "fresh", "Lake Trout", "#7d8a82", [6, 20], { locations: ["lake-generic", "lake-westcoast"] }),
  mk(5, "fresh", "Flathead Catfish", "#9c8a63", [8, 30], { agility: 3.6, startDistance: 28, locations: ["river"] }),
  mk(5, "salt", "Juvenile Tarpon", "#b9c4cc", [10, 30], { agility: 4.3, locations: INSHORE }),
  mk(5, "salt", "Big Striped Bass", "#8a93a0", [12, 25], { locations: PIER }),
  mk(5, "salt", "King Mackerel", "#6f8a93", [8, 22], { runStrength: 1.9, locations: INSHORE }),

  // ---------- Tier 6 — Deepwater (boat only) ----------
  mk(6, "fresh", "Lake Sturgeon", "#7d93a6", [15, 50], { agility: 3.4, startDistance: 34, locations: ["lake-generic"] }),
  mk(6, "fresh", "Alligator Gar", "#6f7a5e", [20, 60], { locations: ["river", "south-us"] }),
  mk(6, "fresh", "Bull Catfish", "#8a7f70", [18, 45], { locations: ["river"] }),
  mk(6, "salt", "Mahi-Mahi", "#d9c84f", [8, 25], { agility: 4.8, locations: BLUE }),
  mk(6, "salt", "Wahoo", "#5a7a8a", [12, 35], { runStrength: 2.1, locations: BLUE }),
  mk(6, "salt", "Yellowfin Tuna", "#6f93a0", [20, 50], { locations: BLUE }),
  mk(6, "salt", "Amberjack", "#c9b48a", [15, 40], { locations: BLUE }),

  // ---------- Tier 7 — Big Game (boat only) ----------
  mk(7, "fresh", "Giant Sturgeon", "#8a97a6", [50, 150], { agility: 3.8, startDistance: 42, locations: ["river", "lake-westcoast"] }),
  mk(7, "fresh", "Wels Catfish", "#6e6a5c", [40, 120], { locations: ["river"] }),
  mk(7, "fresh", "Arapaima", "#7a5a5a", [40, 100], { locations: ["south-us"] }),
  mk(7, "salt", "Bluefin Tuna", "#5a6e8a", [80, 200], { locations: BLUE }),
  mk(7, "salt", "Sailfish", "#5a7aa0", [25, 60], { agility: 5.4, locations: BLUE }),
  mk(7, "salt", "Goliath Grouper", "#7a7a5e", [60, 180], { agility: 4.2, locations: BLUE }),

  // ---------- Tier 8 — Legendary / Mythical (boat only) ----------
  mk(8, "fresh", "White Sturgeon", "#b9c4cc", [120, 360], { startDistance: 50, locations: ["lake-westcoast"] }),
  mk(8, "fresh", "The Lake Warden", "#5a6e72", [40, 90], { locations: ["lake-generic"] }),
  mk(8, "salt", "Blue Marlin", "#4a6e9a", [120, 450], { locations: BLUE }),
  mk(8, "salt", "Swordfish", "#6a7a8a", [80, 300], { locations: BLUE }),
  mk(8, "salt", "Giant Bluefin", "#5a6e8a", [150, 400], { locations: BLUE }),
  mk(8, "salt", "Old Hooktooth", "#4a5a5e", [200, 500], { locations: BLUE }),
];

export const ALL_FISH = FISH;

export function getTier(tier: number): TierDef {
  return TIERS.find((t) => t.tier === tier) ?? TIERS[0];
}

/** Fish available for a given difficulty band + water (optionally gated by access). */
export function poolFor(tier: number, water: Water, access?: Access): FishDef[] {
  return FISH.filter(
    (f) => f.tier === tier && f.water === water && (access ? f.access === access : true),
  );
}

/** Pick a random entry from a tier/water pool — mimics a location's pool. */
export function randomFishFromPool(
  tier: number,
  water: Water,
  rng: () => number = Math.random,
  access?: Access,
): FishDef {
  const pool = poolFor(tier, water, access);
  return pool[Math.floor(rng() * pool.length)] ?? FISH[0];
}

/** A rolled flavor weight for a landed catch. */
export function rollWeight(fish: FishDef, rng: () => number = Math.random): number {
  const [lo, hi] = fish.weightKg;
  return +(lo + rng() * (hi - lo)).toFixed(1);
}

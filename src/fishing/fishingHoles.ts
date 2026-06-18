import type { Water } from "./fishCatalog";

/**
 * A fishing hole's *quality* is a separate axis from fish difficulty tiers. It
 * governs the wait-to-bite: a `maxWait` ceiling plus a distribution "curve".
 *
 * Higher quality (S) → lower ceiling + MORE variance: bites are usually
 * near-instant but occasionally stretch to the (short) ceiling — exciting and
 * unpredictable. Lower quality (D) → long but predictable waits.
 *
 * For now holes carry only wait params; the future map/travel system will give
 * them fish pools, water, access, and occupancy.
 */

export type HoleQuality = "S" | "A" | "B" | "C" | "D";

export interface FishingHole {
  id: string;
  name: string;
  quality: HoleQuality;
  water: Water;
  /** Floor seconds — a bite is never truly instant. */
  minWait: number;
  /** Ceiling seconds — the longest possible wait at this hole. */
  maxWait: number;
  /** ≥1 integer. Higher = tighter cluster around the mean (LESS variance). */
  smoothing: number;
  /** ≥1. Higher = more front-loaded toward short waits. */
  skew: number;
}

/** Wait-shaping params per quality grade. */
interface QualityCurve {
  minWait: number;
  maxWait: number;
  smoothing: number;
  skew: number;
}

export const QUALITY_CURVES: Record<HoleQuality, QualityCurve> = {
  S: { minWait: 0.4, maxWait: 5, smoothing: 1, skew: 2.2 },
  A: { minWait: 0.4, maxWait: 7, smoothing: 1, skew: 1.8 },
  B: { minWait: 0.4, maxWait: 10, smoothing: 2, skew: 1.4 },
  C: { minWait: 0.4, maxWait: 14, smoothing: 3, skew: 1.15 },
  D: { minWait: 0.4, maxWait: 20, smoothing: 4, skew: 1.0 },
};

function makeHole(id: string, name: string, quality: HoleQuality, water: Water): FishingHole {
  return { id, name, quality, water, ...QUALITY_CURVES[quality] };
}

/** Hardcoded sample holes for now (the map/travel system will own these later). */
export const HOLES: FishingHole[] = [
  makeHole("hidden-cove", "Hidden Cove", "S", "salt"),
  makeHole("old-pier", "Old Pier", "A", "salt"),
  makeHole("town-lake", "Town Lake", "B", "fresh"),
  makeHole("roadside-pond", "Roadside Pond", "C", "fresh"),
  makeHole("drainage-canal", "Drainage Canal", "D", "fresh"),
];

export const DEFAULT_HOLE: FishingHole =
  HOLES.find((h) => h.id === "town-lake") ?? HOLES[0];

export function getHole(id: string): FishingHole {
  return HOLES.find((h) => h.id === id) ?? DEFAULT_HOLE;
}

/**
 * Roll a wait-to-bite (seconds) for a hole.
 *
 * Averaging `smoothing` uniforms pulls the result toward the middle (central
 * limit → less variance as smoothing rises); the `skew` exponent then bends it
 * toward short waits. So S (smoothing 1, high skew) is fast and erratic, while
 * D (smoothing 4, skew 1) clusters predictably near its long mean.
 */
export function rollWaitTime(hole: FishingHole, rng: () => number = Math.random): number {
  let u = 0;
  for (let i = 0; i < hole.smoothing; i++) u += rng();
  u = Math.pow(u / hole.smoothing, hole.skew);
  return hole.minWait + (hole.maxWait - hole.minWait) * u;
}

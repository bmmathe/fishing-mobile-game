/**
 * Bait economy harness.
 * Run: `node scripts/baitsim.ts`  (Node 24 strips the TS types automatically)
 *
 * Prints each bait's effect, then for a representative spot compares the
 * tier-hit distribution and mean wait with no bait vs each bait — confirming
 * bait raises higher-tier odds and/or shortens wait per its own factors.
 */
import { WORMS, baitFromFish, type BaitDef } from "../src/game/bait.ts";
import { pickTier, getRegion } from "../src/world/regions.ts";
import { QUALITY_CURVES, rollWaitTime } from "../src/fishing/fishingHoles.ts";

// Representative baits spanning the levers (tier-only, wait-only, mix).
const BAITS: BaitDef[] = [
  WORMS, // [1-3] mild tier + wait
  baitFromFish("Golden Shiner", 1, [2, 3]), // wait-focused
  baitFromFish("Menhaden", 2, [3, 4, 5]), // tier-focused, lures the pier's upper tiers
  baitFromFish("Cisco", 3, [6, 7, 8]), // for deep water — no effect at a shallow spot
];

console.log("=== Bait effects ===");
console.log("name            grade  lures        tierBoost  waitFactor");
for (const b of BAITS) {
  console.log(
    `${b.name.padEnd(15)} ${b.grade}      T${Math.min(...b.forTiers)}-T${Math.max(...b.forTiers)}`.padEnd(34) +
      `${b.tierBoost.toFixed(2)}       ${b.waitFactor.toFixed(2)}`,
  );
}

function makeRng(seed: number) {
  let x = seed;
  return () => ((x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

// Use a pier (T2-5) — a wide pool so tier-targeting bait visibly shifts the mix.
// (At an all-high deep-lake pool, lure-everything bait can't shift proportions;
// there its value is the wait reduction + being the right bait for that water.)
const region = getRegion("pnw");
const spot = region.spots.find((s) => s.body === "pier")!;
const hole = { ...QUALITY_CURVES[spot.quality] };
const N = 20000;

function boost(tiers: { tier: number; weight: number }[], b: BaitDef | null) {
  if (!b) return tiers;
  const set = new Set(b.forTiers);
  return tiers.map((t) => (set.has(t.tier) ? { tier: t.tier, weight: t.weight * b.tierBoost } : t));
}

function trial(b: BaitDef | null) {
  const rng = makeRng(99);
  const counts: Record<number, number> = {};
  let waitSum = 0;
  for (let i = 0; i < N; i++) {
    const t = pickTier(boost(spot.tiers, b), rng);
    counts[t] = (counts[t] ?? 0) + 1;
    waitSum += rollWaitTime(hole as never, rng) * (b ? b.waitFactor : 1);
  }
  const dist = spot.tiers
    .map((tw) => `T${tw.tier}:${((100 * (counts[tw.tier] ?? 0)) / N).toFixed(0)}%`)
    .join(" ");
  return { dist, meanWait: (waitSum / N).toFixed(2) };
}

console.log(`\n=== ${spot.name} (${spot.quality}) tier distribution + mean wait ===`);
const base = trial(null);
console.log(`no bait        ${base.dist}   wait ${base.meanWait}s`);
for (const b of BAITS) {
  const r = trial(b);
  console.log(`${b.name.padEnd(14)} ${r.dist}   wait ${r.meanWait}s`);
}

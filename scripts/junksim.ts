/**
 * Junk-vs-fish odds at the starter (T1-2) waters, unbaited.
 * Run: `npm run sim:junk`
 *
 * Brett's rule: a new player at T1-2 water should have comfortably better than
 * a 50/50 shot at a FISH over garbage — both per bite (what takes the hook)
 * and per landing (what they actually haul in; junk always lands while small
 * fish shake off, so the landed mix is the one that "feels" right or wrong).
 * The knob is JUNK_WEIGHT in fishCatalog.ts.
 */
import {
  startCast,
  stepFight,
  type FightInput,
  type FightState,
  type FishSpec,
  type LineSpec,
} from "../src/fishing/fishingModel.ts";
import { JUNK_WEIGHT, randomFishFromPool } from "../src/fishing/fishCatalog.ts";
import { pickTier, REGIONS, type Spot } from "../src/world/regions.ts";

// mulberry32 — the LCG the other sims use has strong serial correlation, which
// visibly skews back-to-back draws (tier roll → species roll) in this sim.
function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Skilled bot on bare starter gear (same policy as the other sims). Casual
// players land FEWER fish (junk always lands), so real landed shares sit a bit
// below these — keep some margin above the 50% floor.
const LINE: LineSpec = { maxTension: 0.78, reelMult: 1.0 };
const skilled =
  (line: LineSpec) =>
  (s: FightState): FightInput => ({
    reel: Math.max(0, Math.min(1, (line.maxTension * 0.95 - s.tension) / 0.4)),
    steer: s.running ? Math.max(-1, Math.min(1, -Math.sign(s.fishDirCurrent) * 1.2)) : 0,
  });

function playFight(fish: FishSpec, rng: () => number): boolean {
  const policy = skilled(LINE);
  let s = startCast(fish, 0);
  while (s.phase === "waiting") s = stepFight(s, {}, fish, LINE, 1 / 60, rng);
  s = stepFight(s, { setHook: true }, fish, LINE, 1 / 60, rng);
  let t = 0;
  while (s.phase === "fighting" && t < 240) {
    s = stepFight(s, policy(s), fish, LINE, 1 / 60, rng);
    t += 1 / 60;
  }
  return s.result === "landed";
}

const CASTS = 4000;

function measure(spot: Spot) {
  const rng = makeRng(7);
  let fishBites = 0;
  let junkBites = 0;
  let fishLanded = 0;
  let junkLanded = 0;
  for (let c = 0; c < CASTS; c++) {
    const tier = pickTier(spot.tiers, rng);
    const f = randomFishFromPool(tier, spot.water, rng, spot.access);
    const landed = playFight(f, rng);
    if (f.kind === "junk") {
      junkBites++;
      if (landed) junkLanded++;
    } else {
      fishBites++;
      if (landed) fishLanded++;
    }
  }
  return {
    biteFishShare: fishBites / (fishBites + junkBites),
    landedFishShare: fishLanded / (fishLanded + junkLanded),
    landRateFish: fishLanded / fishBites,
  };
}

// The free starter waters: stream (T1-2, the tutorial spot) + beach (T1-3).
const pnw = REGIONS[0];
const starters = pnw.spots.filter((s) => s.body === "stream" || s.body === "beach");
console.log(`=== Starter-water junk odds (unbaited, starter gear, JUNK_WEIGHT=${JUNK_WEIGHT}) ===`);
console.log(["spot".padEnd(10), "fish/bite".padStart(11), "fish/landed".padStart(13), "fish land%".padStart(12)].join(""));
const results: { spot: Spot; biteFishShare: number; landedFishShare: number }[] = [];
for (const spot of starters) {
  const m = measure(spot);
  results.push({ spot, ...m });
  console.log(
    [
      spot.body.padEnd(10),
      `${(m.biteFishShare * 100).toFixed(0)}%`.padStart(11),
      `${(m.landedFishShare * 100).toFixed(0)}%`.padStart(13),
      `${(m.landRateFish * 100).toFixed(0)}%`.padStart(12),
    ].join(""),
  );
}

console.log("\n=== Verdicts ===");
if (starters.length === 0) console.log("TUNE  no T1-2-max spots found?!");
for (const r of results) {
  const b = r.biteFishShare >= 0.6;
  const l = r.landedFishShare >= 0.55;
  console.log(`${b ? "PASS" : "TUNE"}  ${r.spot.body}: fish share of bites ≥ 60% — got ${(r.biteFishShare * 100).toFixed(0)}%`);
  console.log(`${l ? "PASS" : "TUNE"}  ${r.spot.body}: fish share of landings ≥ 55% — got ${(r.landedFishShare * 100).toFixed(0)}%`);
}

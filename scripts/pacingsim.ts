/**
 * Progression pacing harness (v2: cooler cooldown + flat spot locks).
 * Run: `npm run sim:pacing`
 *
 * The 24-slot cooler is the account-level catch budget: filling it starts a 6h
 * re-icing cooldown on keeps, so income per day = (cooler fills per day) × 24 ×
 * (value of the best fishable water). How often a player logs in around the
 * cooldown is the play-pattern knob:
 *  - casual: 1 fill/day (one 1.5h sitting)
 *  - greedy: 2 fills/day (morning + evening) — the tuning target
 *  - binge:  3 fills/day (the 6h cooldown caps even a no-lifer at ~3-4)
 * Spot locks (flat 6h, set at the first landed fish) rarely bind income — the
 * cooler cooldown outlasts them — but they stop spot-hopping between fills.
 *
 * Verdicts (tuning targets): first boat day 3-4, endgame day 10-14 (greedy).
 * The binge floor is informational — the cooler keeps it near greedy's pace.
 */
import {
  startCast,
  stepFight,
  type FightInput,
  type FightState,
  type FishSpec,
  type LineSpec,
} from "../src/fishing/fishingModel.ts";
import { randomFishFromPool, rollWeight } from "../src/fishing/fishCatalog.ts";
import { QUALITY_CURVES, rollWaitTime, type FishingHole } from "../src/fishing/fishingHoles.ts";
import { BOAT_TIERS, fishFee, fishValue, LINE_TIERS, POLE_TIERS } from "../src/game/gear.ts";
import { COOLER_COOLDOWN_HOURS, SPOT_LOCK_HOURS } from "../src/game/spotRest.ts";
import { isFreeFoot, pickTier, REGIONS, type Region, type Spot } from "../src/world/regions.ts";

// playerStore can't be imported here (extensionless imports don't run under
// Node type-stripping), so mirror its COOLER_CAP.
const COOLER_CAP = 24;

function makeRng(seed: number) {
  let x = seed;
  return () => ((x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

// Skilled-bot policy (same as mythicsim): reel to just under the snap limit,
// steer against runs. Estimates are for an efficient player — the pacing
// targets are calibrated against this bot.
const skilled =
  (line: LineSpec) =>
  (s: FightState): FightInput => ({
    reel: Math.max(0, Math.min(1, (line.maxTension * 0.95 - s.tension) / 0.4)),
    steer: s.running ? Math.max(-1, Math.min(1, -Math.sign(s.fishDirCurrent) * 1.2)) : 0,
  });

/** One hooked fight; returns whether it landed and the seconds it took. */
function playFight(fish: FishSpec, line: LineSpec, rng: () => number) {
  const policy = skilled(line);
  let s = startCast(fish, 0);
  while (s.phase === "waiting") s = stepFight(s, {}, fish, line, 1 / 60, rng);
  s = stepFight(s, { setHook: true }, fish, line, 1 / 60, rng);
  let sec = 0;
  while (s.phase === "fighting" && sec < 240) {
    s = stepFight(s, policy(s), fish, line, 1 / 60, rng);
    sec += 1 / 60;
  }
  return { landed: s.result === "landed", sec };
}

/** Fixed non-fishing overhead per cast (cast/hook-set/catch-card/selling). */
const CAST_OVERHEAD_SEC = 6;
const SAMPLE_CASTS = 40;
/**
 * The bot reels optimally and never hesitates; a human is a couple of times
 * slower per landed catch (imperfect tension play, retries, menus, breaks).
 * Applied to time only — humans land the same fish, they just take longer.
 */
const HUMAN_PACE = 2.2;

interface SpotYield {
  /** Real minutes per landed non-junk catch (incl. waits, failures, junk). */
  minPerCatch: number;
  /** Sell value per landed non-junk catch (amortizing everything else). */
  valuePerCatch: number;
}

// Yield estimates cache: many spots share the same (quality, water, access,
// tier-pool) signature across regions, and gear only matters via line/pole.
const yieldCache = new Map<string, SpotYield | null>();

function spotYield(lineTier: number, poleTier: number, spot: Spot): SpotYield | null {
  const sig = `${lineTier}/${poleTier}|${spot.quality}|${spot.water}|${spot.access}|${spot.tiers
    .map((t) => `${t.tier}:${t.weight}`)
    .join(",")}`;
  const hit = yieldCache.get(sig);
  if (hit !== undefined) return hit;

  const line: LineSpec = {
    maxTension: LINE_TIERS[lineTier].maxTension,
    reelMult: POLE_TIERS[poleTier].reelMult,
  };
  const hole = { minWait: 0, maxWait: 0, ...QUALITY_CURVES[spot.quality] } as FishingHole;
  const rng = makeRng(1000 + lineTier * 31 + poleTier * 7);
  let totalSec = 0;
  let totalValue = 0;
  let landedFish = 0;
  for (let c = 0; c < SAMPLE_CASTS; c++) {
    totalSec += rollWaitTime(hole, rng) + CAST_OVERHEAD_SEC;
    const tier = pickTier(spot.tiers, rng);
    const fish = randomFishFromPool(tier, spot.water, rng, spot.access);
    const { landed, sec } = playFight(fish, line, rng);
    totalSec += sec;
    if (landed && fish.kind === "fish") {
      landedFish++;
      totalValue += fishValue(fish.tier, rollWeight(fish, rng));
    }
  }
  const result: SpotYield | null =
    landedFish === 0
      ? null
      : { minPerCatch: (totalSec / 60 / landedFish) * HUMAN_PACE, valuePerCatch: totalValue / landedFish };
  yieldCache.set(sig, result);
  return result;
}

// Fixed purchase priority (the natural unlock order).
type Purchase = { label: string; price: () => number; done: (p: SimPlayer) => boolean; buy: (p: SimPlayer) => void };
const PURCHASES: Purchase[] = [
  { label: "Braided Line", price: () => LINE_TIERS[1].price, done: (p) => p.lineTier >= 1, buy: (p) => (p.lineTier = 1) },
  { label: "Spinning Rod", price: () => POLE_TIERS[1].price, done: (p) => p.poleTier >= 1, buy: (p) => (p.poleTier = 1) },
  { label: "Fluorocarbon", price: () => LINE_TIERS[2].price, done: (p) => p.lineTier >= 2, buy: (p) => (p.lineTier = 2) },
  { label: "Baitcaster", price: () => POLE_TIERS[2].price, done: (p) => p.poleTier >= 2, buy: (p) => (p.poleTier = 2) },
  { label: "Jon Boat", price: () => BOAT_TIERS[0].price, done: (p) => p.boatTier >= 0, buy: (p) => (p.boatTier = 0) },
  { label: "Steel Leader", price: () => LINE_TIERS[3].price, done: (p) => p.lineTier >= 3, buy: (p) => (p.lineTier = 3) },
  { label: "Bass Boat", price: () => BOAT_TIERS[1].price, done: (p) => p.boatTier >= 1, buy: (p) => (p.boatTier = 1) },
  { label: "Offshore Rod", price: () => POLE_TIERS[3].price, done: (p) => p.poleTier >= 3, buy: (p) => (p.poleTier = 3) },
  { label: "Deep-Sea Cable", price: () => LINE_TIERS[4].price, done: (p) => p.lineTier >= 4, buy: (p) => (p.lineTier = 4) },
  { label: "Game Reel", price: () => POLE_TIERS[4].price, done: (p) => p.poleTier >= 4, buy: (p) => (p.poleTier = 4) },
];

interface SimPlayer {
  currency: number;
  lineTier: number;
  poleTier: number;
  boatTier: number;
  regionId: string;
}

function canFishSpot(p: SimPlayer, spot: Spot): boolean {
  if (spot.access === "land") return true;
  if (p.boatTier < 0) return false;
  return spot.water === "fresh" ? true : BOAT_TIERS[p.boatTier].ocean;
}

function spotFee(spot: Spot): number {
  if (spot.access === "boat") return fishFee(spot.quality, true);
  return isFreeFoot(spot.body) ? 0 : fishFee(spot.quality, false);
}

interface Archetype {
  name: string;
  /** Cooler fills attempted per day (log-ins spaced around the 6h cooldown). */
  fillsPerDay: number;
  /** Minutes of play per sitting — caps how much of a cooler one fill banks. */
  minutesPerSitting: number;
  region: Region;
}

interface DayLog {
  day: number;
  activeMin: number;
  gross: number;
  bought: string[];
}

interface SimResult {
  firstBoatDay: number | null;
  endgameDay: number | null;
  activeHoursAtBoat: number;
  activeHoursAtEndgame: number;
  days: DayLog[];
}

const MAX_DAYS = 45;

function simulate(arch: Archetype): SimResult {
  const p: SimPlayer = { currency: 0, lineTier: 0, poleTier: 0, boatTier: -1, regionId: arch.region.id };
  const spotLockUntil = new Map<string, number>(); // spot id -> reopen clock (min)
  const days: DayLog[] = [];
  let firstBoatDay: number | null = null;
  let endgameDay: number | null = null;
  let activeTotal = 0;
  let activeHoursAtBoat = 0;
  let activeHoursAtEndgame = 0;

  const tryBuy = (log: DayLog, day: number) => {
    for (const item of PURCHASES) {
      if (item.done(p)) continue;
      if (p.currency < item.price()) break; // strict order: save for the next item
      p.currency -= item.price();
      item.buy(p);
      log.bought.push(item.label);
      if (item.label === "Jon Boat" && firstBoatDay === null) {
        firstBoatDay = day;
        activeHoursAtBoat = activeTotal / 60;
      }
      if (PURCHASES.every((x) => x.done(p)) && endgameDay === null) {
        endgameDay = day;
        activeHoursAtEndgame = activeTotal / 60;
      }
    }
  };

  for (let day = 1; day <= MAX_DAYS && endgameDay === null; day++) {
    const log: DayLog = { day, activeMin: 0, gross: 0, bought: [] };

    // Sittings spaced one cooldown apart: the earliest each fill can start.
    for (let fill = 0; fill < arch.fillsPerDay; fill++) {
      const clock = (day - 1) * 1440 + fill * COOLER_COOLDOWN_HOURS * 60;

      // Best unlocked, affordable spot by value-per-keep. One spot serves the
      // whole fill — there's no reason to move once you're on the best water.
      let best: { spot: Spot; y: SpotYield } | null = null;
      for (const spot of arch.region.spots) {
        if (!canFishSpot(p, spot)) continue;
        if ((spotLockUntil.get(spot.id) ?? 0) > clock) continue;
        if (spotFee(spot) > p.currency) continue;
        const y = spotYield(p.lineTier, p.poleTier, spot);
        if (!y) continue;
        if (!best || y.valuePerCatch > best.y.valuePerCatch) best = { spot, y };
      }
      if (!best) continue; // nothing fishable this sitting

      const { spot, y } = best;
      p.currency -= spotFee(spot);
      // Keeps this sitting: a full cooler, unless the sitting runs out first.
      const keeps = Math.min(COOLER_CAP, Math.floor(arch.minutesPerSitting / y.minPerCatch));
      if (keeps <= 0) continue;
      const gross = keeps * y.valuePerCatch;
      p.currency += gross; // sold immediately (selling is never gated)
      log.gross += gross;
      const spent = keeps * y.minPerCatch;
      log.activeMin += spent;
      activeTotal += spent;
      // First landed fish locks the spot for the flat rest period.
      spotLockUntil.set(spot.id, clock + SPOT_LOCK_HOURS * 60);
      tryBuy(log, day);
    }
    days.push(log);
  }
  return { firstBoatDay, endgameDay, activeHoursAtBoat, activeHoursAtEndgame, days };
}

// --- run the three archetypes ---
const home = REGIONS[0]; // PNW as the home region
const ARCHETYPES: Archetype[] = [
  { name: "casual (1 fill/day)", fillsPerDay: 1, minutesPerSitting: 90, region: home },
  { name: "greedy (2 fills/day)", fillsPerDay: 2, minutesPerSitting: 90, region: home },
  { name: "binge (3 fills/day)", fillsPerDay: 3, minutesPerSitting: 180, region: home },
];

const results = new Map<string, SimResult>();
for (const arch of ARCHETYPES) {
  const r = simulate(arch);
  results.set(arch.name, r);
  console.log(`\n=== ${arch.name} ===`);
  for (const d of r.days) {
    if (d.bought.length === 0 && d.day > 16) continue; // keep the tail quiet
    console.log(
      `day ${String(d.day).padStart(2)}  active ${(d.activeMin / 60).toFixed(1)}h  gross $${Math.round(d.gross).toLocaleString()}` +
        (d.bought.length ? `  → bought ${d.bought.join(", ")}` : ""),
    );
  }
  console.log(
    `first boat: ${r.firstBoatDay ? `day ${r.firstBoatDay} (${r.activeHoursAtBoat.toFixed(1)}h active)` : "never"}` +
      ` · endgame: ${r.endgameDay ? `day ${r.endgameDay} (${r.activeHoursAtEndgame.toFixed(1)}h active)` : `not within ${MAX_DAYS} days`}`,
  );
}

console.log("\n=== Verdicts (greedy archetype) ===");
const g = results.get("greedy (2 fills/day)")!;
const b = results.get("binge (3 fills/day)")!;
const checks: [string, boolean, string][] = [
  ["first boat lands day 3-4", g.firstBoatDay !== null && g.firstBoatDay >= 3 && g.firstBoatDay <= 4, `day ${g.firstBoatDay ?? "—"}`],
  ["full endgame lands day 10-14", g.endgameDay !== null && g.endgameDay >= 10 && g.endgameDay <= 14, `day ${g.endgameDay ?? "—"}`],
];
for (const [label, ok, got] of checks) console.log(`${ok ? "PASS" : "TUNE"}  ${label} — got ${got}`);
// Fights resolve in seconds, so the rest gates — not playtime — bound progress.
// Raising hours-of-content-to-endgame would mean slower fights (game feel), not
// economy tuning; report it rather than gate on it.
console.log(`INFO  active hours to endgame — ${g.activeHoursAtEndgame.toFixed(1)}h (human-paced estimate)`);
console.log(
  `INFO  binge floor — endgame day ${b.endgameDay ?? `>${MAX_DAYS}`}${b.endgameDay !== null && b.endgameDay < 8 ? "  (⚠ under 8 days — consider coastal travel/fee levers)" : ""}`,
);

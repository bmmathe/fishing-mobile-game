/**
 * Headless tuning harness for the fishing fight model.
 * Run: `node scripts/sim.ts`  (Node 24 strips the TS types automatically)
 *
 * Plays each catalog fish with scripted "policies" and reports the skilled
 * catch-rate per tier against TIERS.targetCatchRate, on the STARTER line. This
 * is the loop for tuning the 8-tier difficulty curve. Junk is excluded (it's a
 * trivial ~100% reel-in).
 */
import {
  startCast,
  stepFight,
  type FightInput,
  type FightState,
  type FishSpec,
  type LineSpec,
} from "../src/fishing/fishingModel.ts";
import { FISH, TIERS } from "../src/fishing/fishCatalog.ts";
import { effectiveHookHold, getHook } from "../src/game/hooks.ts";

const hookArg = process.argv.indexOf("--hook");
const HOOK = hookArg >= 0 ? getHook(process.argv[hookArg + 1] ?? "") ?? null : null;

// The starter line everything is balanced against (see createDefaultStore).
const STARTER_LINE: LineSpec = { maxTension: 0.78 };
const TOLERANCE = 0.08; // ±8 percentage points counts as on-target

type Policy = (s: FightState) => FightInput;

// Skilled: reel hard when there's tension headroom, ease near the limit,
// and counter-steer against the fish's current run. Scaled to the line.
const skilled =
  (line: LineSpec): Policy =>
  (s) => {
    const reel = Math.max(0, Math.min(1, (line.maxTension * 0.95 - s.tension) / 0.4));
    const steer = s.running ? Math.max(-1, Math.min(1, -Math.sign(s.fishDirCurrent) * 1.2)) : 0;
    return { reel, steer };
  };

const reckless: Policy = () => ({ reel: 1, steer: 0 });

function makeRng(seed: number) {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return x / 0x7fffffff;
  };
}

function play(fish: FishSpec, line: LineSpec, policy: Policy, seed: number) {
  const rng = makeRng(seed);
  let s = startCast(fish, 0); // wait time is irrelevant to fight tuning
  while (s.phase === "waiting") s = stepFight(s, {}, fish, line, 1 / 60, rng);
  s = stepFight(s, { setHook: true }, fish, line, 1 / 60, rng);

  const dt = 1 / 60;
  let t = 0;
  while (s.phase === "fighting" && t < 240) {
    s = stepFight(s, policy(s), fish, line, dt, rng);
    t += dt;
  }
  return s.result === "landed";
}

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 17 + 1);

function winRate(fish: FishSpec, line: LineSpec, policy: Policy) {
  let wins = 0;
  for (const seed of SEEDS) if (play(fish, line, policy, seed)) wins++;
  return wins / SEEDS.length;
}

console.log(
  `=== 8-tier catch-rate validation (starter line maxTension=${STARTER_LINE.maxTension}` +
    `${HOOK ? `, hook=${HOOK.name}` : ", no hook"}) ===`,
);
console.log("tier  target   skilled   reckless   status   species");
for (const t of TIERS) {
  const species = FISH.filter((f) => f.tier === t.tier && f.kind === "fish");
  if (species.length === 0) continue;
  const withHook = (f: FishSpec) => ({
    ...f,
    hookHold: effectiveHookHold(f.hookHold ?? 1, f.tier, HOOK),
  });
  const sk = species.map((f) => winRate(withHook(f), STARTER_LINE, skilled(STARTER_LINE)));
  const rk = species.map((f) => winRate(withHook(f), STARTER_LINE, reckless));
  const avgSk = sk.reduce((a, b) => a + b, 0) / sk.length;
  const avgRk = rk.reduce((a, b) => a + b, 0) / rk.length;

  // T6-8 target 0 → just needs to be ~0; lower tiers within tolerance.
  const ok = t.targetCatchRate === 0 ? avgSk <= 0.05 : Math.abs(avgSk - t.targetCatchRate) <= TOLERANCE;
  console.log(
    `T${t.tier}    ${(t.targetCatchRate * 100).toFixed(0).padStart(3)}%     ` +
      `${(avgSk * 100).toFixed(0).padStart(3)}%      ` +
      `${(avgRk * 100).toFixed(0).padStart(3)}%       ` +
      `${ok ? "PASS  " : "FAIL  "}   ${species.map((f) => f.name).join(", ")}`,
  );
}

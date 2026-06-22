/**
 * Hook tackle harness.
 * Run: `node scripts/hooksim.ts`
 *
 * Validates per-tier catch rates with each hook vs TIERS.targetCatchRate on the
 * starter line, plus wrong-hook penalties and upgrade affordability.
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
import { effectiveHookHold, HOOKS, type HookDef } from "../src/game/hooks.ts";
import { fishValue } from "../src/game/gear.ts";

const STARTER_LINE: LineSpec = { maxTension: 0.78 };
const TOLERANCE = 0.08;

type Policy = (s: FightState) => FightInput;
const skilled =
  (line: LineSpec): Policy =>
  (s) => ({
    reel: Math.max(0, Math.min(1, (line.maxTension * 0.95 - s.tension) / 0.4)),
    steer: s.running ? Math.max(-1, Math.min(1, -Math.sign(s.fishDirCurrent) * 1.2)) : 0,
  });

function makeRng(seed: number) {
  let x = seed;
  return () => ((x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

function fishWithHook(fish: FishSpec, tier: number, hook: HookDef | null): FishSpec {
  return {
    ...fish,
    hookHold: effectiveHookHold(fish.hookHold ?? 1, tier, hook),
  };
}

function play(fish: FishSpec, line: LineSpec, policy: Policy, seed: number) {
  const rng = makeRng(seed);
  let s = startCast(fish, 0);
  while (s.phase === "waiting") s = stepFight(s, {}, fish, line, 1 / 60, rng);
  s = stepFight(s, { setHook: true }, fish, line, 1 / 60, rng);
  let t = 0;
  while (s.phase === "fighting" && t < 240) {
    s = stepFight(s, policy(s), fish, line, 1 / 60, rng);
    t += 1 / 60;
  }
  return s.result === "landed";
}

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 17 + 1);

function tierWin(tier: number, hook: HookDef | null, line = STARTER_LINE) {
  const species = FISH.filter((f) => f.tier === tier && f.kind === "fish");
  let wins = 0;
  let n = 0;
  const policy = skilled(line);
  for (const f of species) {
    const spec = fishWithHook(f, tier, hook);
    for (const seed of SEEDS) {
      n++;
      if (play(spec, line, policy, seed)) wins++;
    }
  }
  return wins / n;
}

console.log("=== Hook catalog ===");
console.log("name            forTiers   holdBonus  price");
for (const h of HOOKS) {
  console.log(
    `${h.name.padEnd(15)} T${Math.min(...h.forTiers)}-T${Math.max(...h.forTiers)}`.padEnd(22) +
      ` +${h.holdBonus.toFixed(2)}`.padEnd(11) +
      ` $${h.price}`,
  );
}

console.log("\n=== Win-rate matrix (skilled, starter line) ===");
const hookCols = [null, ...HOOKS.filter((h) => h.holdBonus > 0)];
console.log(["tier\\hook".padEnd(10), ...hookCols.map((h) => (h ? h.id.slice(0, 10) : "none"))].join("  "));
for (const t of TIERS) {
  if (t.tier > 5) continue; // snap-dominated above T5 on starter line
  const row = hookCols.map((h) => `${(tierWin(t.tier, h) * 100).toFixed(0).padStart(3)}%`);
  const target = `${(t.targetCatchRate * 100).toFixed(0)}%`;
  console.log([`T${t.tier} (${target})`.padEnd(10), ...row].join("  "));
}

console.log("\n=== Recommended hook per tier (best match to target) ===");
const rec: Record<number, HookDef | null> = {
  1: HOOKS.find((h) => h.id === "panfish") ?? null,
  2: HOOKS.find((h) => h.id === "panfish") ?? null,
  3: HOOKS.find((h) => h.id === "wide-gap") ?? null,
  4: HOOKS.find((h) => h.id === "wide-gap") ?? null,
};
for (const t of [1, 2, 3, 4]) {
  const target = TIERS.find((x) => x.tier === t)!.targetCatchRate;
  const none = tierWin(t, null);
  const right = tierWin(t, rec[t]);
  const wrong = tierWin(t, HOOKS.find((h) => h.id === "panfish")!);
  const ok = Math.abs(right - target) <= TOLERANCE;
  console.log(
    `T${t}: no hook ${(none * 100).toFixed(0)}% | ` +
      `wrong ${t === 4 ? (wrong * 100).toFixed(0) : "—"}% | ` +
      `correct ${(right * 100).toFixed(0)}% (target ${(target * 100).toFixed(0)}%) ${ok ? "PASS" : "TUNE"}`,
  );
}

console.log("\n=== Economy: catches to afford each hook (avg T2 sell value) ===");
const t2 = FISH.filter((f) => f.tier === 2 && f.kind === "fish");
const avgW = t2.reduce((s, f) => s + (f.weightKg[0] + f.weightKg[1]) / 2, 0) / t2.length;
const refVal = fishValue(2, avgW);
for (const h of HOOKS) {
  if (h.price <= 0) continue;
  console.log(`${h.name.padEnd(16)} $${h.price.toString().padStart(5)}  ≈ ${Math.ceil(h.price / refVal)} T2 catches`);
}

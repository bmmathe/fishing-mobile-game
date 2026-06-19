/**
 * Gear progression harness.
 * Run: `node scripts/gearsim.ts`  (Node 24 strips the TS types automatically)
 *
 * (a) Unlock curve: skilled-bot per-tier win-rate at each LINE tier's maxTension,
 *     proving better line unlocks higher fish tiers (T6-8 ~0% on starter → winnable up top).
 * (b) Economy pacing: average sell value per tier, and how many average catches
 *     fund each line/pole upgrade (should read as steady progress, not a grind).
 */
import {
  startCast,
  stepFight,
  type FightInput,
  type FightState,
  type LineSpec,
  type FishSpec,
} from "../src/fishing/fishingModel.ts";
import { FISH, TIERS } from "../src/fishing/fishCatalog.ts";
import { LINE_TIERS, POLE_TIERS, fishValue } from "../src/game/gear.ts";

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

function lands(fish: FishSpec, line: LineSpec, seed: number) {
  const rng = makeRng(seed);
  let s = startCast(fish, 0);
  while (s.phase === "waiting") s = stepFight(s, {}, fish, line, 1 / 60, rng);
  s = stepFight(s, { setHook: true }, fish, line, 1 / 60, rng);
  const policy = skilled(line);
  let t = 0;
  while (s.phase === "fighting" && t < 240) {
    s = stepFight(s, policy(s), fish, line, 1 / 60, rng);
    t += 1 / 60;
  }
  return s.result === "landed";
}

const SEEDS = Array.from({ length: 30 }, (_, i) => i * 17 + 1);
function tierWin(tier: number, line: LineSpec) {
  const species = FISH.filter((f) => f.tier === tier && f.kind === "fish");
  let wins = 0;
  let n = 0;
  for (const f of species) for (const seed of SEEDS) (n++, lands(f, { ...line, reelMult: 1 }, seed) && wins++);
  return wins / n;
}

console.log("=== (a) Gear unlock curve: skilled win-rate per tier at each LINE tier ===");
console.log(["line\\tier".padEnd(16), ...TIERS.map((t) => `T${t.tier}`)].join("  "));
for (const lt of LINE_TIERS) {
  const row = TIERS.map((t) => `${(tierWin(t.tier, { maxTension: lt.maxTension }) * 100).toFixed(0).padStart(2)}%`);
  console.log([`${lt.name}`.padEnd(16), ...row].join("  "));
}

console.log("\n=== probe: win-rate vs maxTension for high tiers ===");
const sweep = [0.78, 1.2, 1.8, 2.5, 3.4, 4.5, 6, 8];
console.log(["tier".padEnd(6), ...sweep.map((m) => m.toFixed(1).padStart(4))].join("  "));
for (const t of [5, 6, 7, 8]) {
  console.log([`T${t}`.padEnd(6), ...sweep.map((m) => `${(tierWin(t, { maxTension: m }) * 100).toFixed(0).padStart(3)}%`)].join("  "));
}

console.log("\n=== (b) Economy: average sell value per tier ===");
for (const t of TIERS) {
  const species = FISH.filter((f) => f.tier === t.tier && f.kind === "fish");
  const avgW = species.reduce((s, f) => s + (f.weightKg[0] + f.weightKg[1]) / 2, 0) / species.length;
  console.log(`T${t.tier}  avg ${avgW.toFixed(1)} kg  →  $${fishValue(t.tier, avgW)}`);
}

console.log("\n=== (b) Upgrade affordability (catches of the listed tier to afford) ===");
const refTierForLine = [2, 3, 4, 5, 6]; // the tier you'd grind to buy each line upgrade
LINE_TIERS.forEach((lt, i) => {
  if (i === 0) return;
  const t = refTierForLine[i] ?? 5;
  const species = FISH.filter((f) => f.tier === t && f.kind === "fish");
  const avgW = species.reduce((s, f) => s + (f.weightKg[0] + f.weightKg[1]) / 2, 0) / species.length;
  const v = fishValue(t, avgW);
  console.log(`${lt.name.padEnd(16)} $${lt.price.toString().padStart(6)}  ≈ ${Math.ceil(lt.price / v)} T${t} catches`);
});
POLE_TIERS.forEach((pt, i) => {
  if (i === 0) return;
  const t = refTierForLine[i] ?? 5;
  const species = FISH.filter((f) => f.tier === t && f.kind === "fish");
  const avgW = species.reduce((s, f) => s + (f.weightKg[0] + f.weightKg[1]) / 2, 0) / species.length;
  const v = fishValue(t, avgW);
  console.log(`${pt.name.padEnd(16)} $${pt.price.toString().padStart(6)}  ≈ ${Math.ceil(pt.price / v)} T${t} catches`);
});

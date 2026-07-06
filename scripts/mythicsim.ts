/**
 * Mythic (T9) tuning harness.
 * Run: `node scripts/mythicsim.ts`
 *
 * Validates the two mythic difficulty bands:
 *  - ENDGAME mythics (deep-lake/offshore uniques) should be brutal-but-possible
 *    on the BEST gear (Deep-Sea Cable + Game Reel) and ~0% on anything less.
 *  - The STARTER mythic (Glimmerwish) should be landable on minor upgrades
 *    (Braided Line + Spinning Rod) and ~0% on the bare starter line.
 *
 * Also sanity-checks the expected casts-to-hook at each spot's mythic chance.
 */
import {
  startCast,
  stepFight,
  type FightInput,
  type FightState,
  type FishSpec,
  type LineSpec,
} from "../src/fishing/fishingModel.ts";
import { FISH, MYTHIC_TIER } from "../src/fishing/fishCatalog.ts";
import { LINE_TIERS, POLE_TIERS } from "../src/game/gear.ts";
import { MYTHIC_CHANCE_ENDGAME, MYTHIC_CHANCE_STARTER, REGIONS } from "../src/world/regions.ts";

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

function play(fish: FishSpec, line: LineSpec, seed: number) {
  const rng = makeRng(seed);
  const policy = skilled(line);
  let s = startCast(fish, 0);
  while (s.phase === "waiting") s = stepFight(s, {}, fish, line, 1 / 60, rng);
  s = stepFight(s, { setHook: true }, fish, line, 1 / 60, rng);
  let t = 0;
  while (s.phase === "fighting" && t < 300) {
    s = stepFight(s, policy(s), fish, line, 1 / 60, rng);
    t += 1 / 60;
  }
  return s.result === "landed";
}

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 17 + 1);

function winRate(fish: FishSpec, line: LineSpec) {
  let wins = 0;
  for (const seed of SEEDS) if (play(fish, line, seed)) wins++;
  return wins / SEEDS.length;
}

// Gear loadouts to probe (line maxTension × pole reelMult).
const bestLine = LINE_TIERS[LINE_TIERS.length - 1];
const bestPole = POLE_TIERS[POLE_TIERS.length - 1];
const LOADOUTS: { name: string; line: LineSpec }[] = [
  { name: "starter", line: { maxTension: LINE_TIERS[0].maxTension, reelMult: POLE_TIERS[0].reelMult } },
  { name: "braided+spin", line: { maxTension: LINE_TIERS[1].maxTension, reelMult: POLE_TIERS[1].reelMult } },
  { name: "steel+offsh", line: { maxTension: LINE_TIERS[3].maxTension, reelMult: POLE_TIERS[3].reelMult } },
  { name: "BEST", line: { maxTension: bestLine.maxTension, reelMult: bestPole.reelMult } },
];

const mythics = FISH.filter((f) => f.tier === MYTHIC_TIER);
console.log(`=== Mythic (T9) win-rate matrix (skilled bot) ===`);
console.log(["fish".padEnd(22), ...LOADOUTS.map((l) => l.name.padStart(12))].join(""));
for (const f of mythics) {
  const row = LOADOUTS.map((l) => `${(winRate(f, l.line) * 100).toFixed(0)}%`.padStart(12));
  console.log([f.name.padEnd(22), ...row].join(""));
}

console.log("\n=== Verdicts ===");
const starter = mythics.find((f) => f.name === "Glimmerwish")!;
const endgame = mythics.filter((f) => f.name !== "Glimmerwish");
const eg = endgame.map((f) => winRate(f, LOADOUTS[3].line));
const egAvg = eg.reduce((a, b) => a + b, 0) / eg.length;
const egSteel = endgame.map((f) => winRate(f, LOADOUTS[2].line));
const egSteelAvg = egSteel.reduce((a, b) => a + b, 0) / egSteel.length;
const stBraided = winRate(starter, LOADOUTS[1].line);
const stStarter = winRate(starter, LOADOUTS[0].line);

const checks: [string, boolean, string][] = [
  ["endgame on BEST gear is brutal-but-possible (5–40%)", egAvg >= 0.05 && egAvg <= 0.4, `${(egAvg * 100).toFixed(0)}%`],
  ["endgame on steel leader is a heartbreak (<10%)", egSteelAvg < 0.1, `${(egSteelAvg * 100).toFixed(0)}%`],
  ["starter mythic on braided+spin is landable (15–60%)", stBraided >= 0.15 && stBraided <= 0.6, `${(stBraided * 100).toFixed(0)}%`],
  ["starter mythic on bare starter is ~0 (<8%)", stStarter < 0.08, `${(stStarter * 100).toFixed(0)}%`],
];
for (const [label, ok, got] of checks) console.log(`${ok ? "PASS" : "TUNE"}  ${label} — got ${got}`);

console.log("\n=== Hook-rate wiring (expected casts per mythic bite) ===");
let endgameSpots = 0;
let starterSpots = 0;
const seen = new Set<string>();
for (const r of REGIONS) {
  for (const s of r.spots) {
    if (!s.mythic) continue;
    if (s.mythic.chance === MYTHIC_CHANCE_ENDGAME) {
      endgameSpots++;
      if (seen.has(s.mythic.fish)) console.log(`DUPE  ${s.mythic.fish} appears at more than one endgame spot!`);
      seen.add(s.mythic.fish);
    } else if (s.mythic.chance === MYTHIC_CHANCE_STARTER) {
      starterSpots++;
    }
  }
}
console.log(
  `endgame spots: ${endgameSpots} (unique mythics: ${seen.size}) @ ${(MYTHIC_CHANCE_ENDGAME * 100).toFixed(1)}% → ~1 bite / ${Math.round(1 / MYTHIC_CHANCE_ENDGAME)} casts`,
);
console.log(
  `starter spots: ${starterSpots} (shared Glimmerwish) @ ${(MYTHIC_CHANCE_STARTER * 100).toFixed(3)}% → ~1 bite / ${Math.round(1 / MYTHIC_CHANCE_STARTER).toLocaleString()} casts`,
);

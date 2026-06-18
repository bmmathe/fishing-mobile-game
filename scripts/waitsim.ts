/**
 * Wait-time distribution harness.
 * Run: `node scripts/waitsim.ts`  (Node 24 strips the TS types automatically)
 *
 * Samples rollWaitTime() per hole-quality and prints summary stats so we can
 * confirm the "curve": S = lowest mean but HIGHEST variability (coefficient of
 * variation), D = high mean but LOW variability (predictable); means rise
 * monotonically S → D.
 */
import { QUALITY_CURVES, rollWaitTime, type FishingHole, type HoleQuality } from "../src/fishing/fishingHoles.ts";

const N = 20000;
const QUALITIES: HoleQuality[] = ["S", "A", "B", "C", "D"];

function makeRng(seed: number) {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return x / 0x7fffffff;
  };
}

function pct(sorted: number[], p: number) {
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

console.log(`=== Wait-time distribution (${N} samples per quality) ===`);
console.log("Q   maxWait  mean    stdev   CoV    p10    p50    p90    max");
const rng = makeRng(12345);
for (const q of QUALITIES) {
  const hole: FishingHole = { id: q, name: q, quality: q, water: "fresh", ...QUALITY_CURVES[q] };
  const xs: number[] = [];
  for (let i = 0; i < N; i++) xs.push(rollWaitTime(hole, rng));
  const mean = xs.reduce((a, b) => a + b, 0) / N;
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / N;
  const stdev = Math.sqrt(variance);
  const cov = stdev / mean; // coefficient of variation = relative spread
  xs.sort((a, b) => a - b);
  console.log(
    `${q}   ${hole.maxWait.toFixed(0).padStart(4)}s   ` +
      `${mean.toFixed(2).padStart(5)}s  ${stdev.toFixed(2).padStart(5)}s  ` +
      `${cov.toFixed(2)}   ${pct(xs, 10).toFixed(2)}   ${pct(xs, 50).toFixed(2)}   ` +
      `${pct(xs, 90).toFixed(2)}   ${xs[xs.length - 1].toFixed(2)}`,
  );
}

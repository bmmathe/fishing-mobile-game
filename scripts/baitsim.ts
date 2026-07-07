/**
 * Bait-tier hook-table harness.
 * Run: `npm run sim:bait`
 *
 * Validates Brett's bait design:
 *  - no bait at a T1-2 spot   → ~90% T1 / 10% T2 (junk ≈ 32% of T1 rolls)
 *  - T2 bait at a T1-2 spot   → ~60/40 T2/T1 ("about 50/50"), junk 10% of T1
 *  - T2 bait at a T1-2-3 spot → 30% T1 / 60% T2 / 10% T3
 *  - T3 bait at a T1-2-3 spot → 0% T1 / 30% T2 / 70% T3 (no junk at all)
 *  - higher baits: same-tier −10 pts per tier, −1 holds at 30, remainder −2
 *  - weight for tiers a spot lacks falls to the lowest shared tier; a bait
 *    with no shared tiers does nothing (natural pool)
 */
import { baitTierWeights, baitFromFish, WORMS } from "../src/game/bait.ts";
import { BAITED_JUNK_WEIGHT, JUNK_WEIGHT, randomFishFromPool } from "../src/fishing/fishCatalog.ts";
import { pickTier, REGIONS, type Spot } from "../src/world/regions.ts";

// mulberry32 — clean serial behavior for back-to-back rolls (tier → species).
function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const N = 40000;
const pnw = REGIONS[0];
const spotOf = (body: string) => pnw.spots.find((s) => s.body === body)!;

interface Mix {
  tierPct: Record<number, number>;
  /** Junk as % of T1 bites (junk only exists in the T1 pools). */
  junkOfT1: number;
}

function measure(spot: Spot, baitTier: number | null): Mix {
  const rng = makeRng(11);
  const tiers = (baitTier !== null ? baitTierWeights(baitTier, spot.tiers) : null) ?? spot.tiers;
  const junkW = baitTier !== null ? BAITED_JUNK_WEIGHT : JUNK_WEIGHT;
  const count: Record<number, number> = {};
  let t1 = 0;
  let junk = 0;
  for (let i = 0; i < N; i++) {
    const tier = pickTier(tiers, rng);
    count[tier] = (count[tier] ?? 0) + 1;
    if (tier === 1) {
      t1++;
      if (randomFishFromPool(1, spot.water, rng, spot.access, junkW).kind === "junk") junk++;
    }
  }
  const tierPct: Record<number, number> = {};
  for (const [t, c] of Object.entries(count)) tierPct[+t] = (100 * c) / N;
  return { tierPct, junkOfT1: t1 ? (100 * junk) / t1 : 0 };
}

function fmt(m: Mix): string {
  const tiers = Object.keys(m.tierPct).map(Number).sort();
  return tiers.map((t) => `T${t}:${m.tierPct[t].toFixed(0)}%`).join(" ").padEnd(30) + ` junk|T1: ${m.junkOfT1.toFixed(0)}%`;
}

// Representative baits (tier derived from the catalog's forTiers ranges).
const worms = WORMS; // T2
const minnow = baitFromFish("Fathead Minnow", 1, [2, 3]); // T3
const shad = baitFromFish("Gizzard Shad", 2, [3, 4]); // T4
const menhaden = baitFromFish("Menhaden", 2, [3, 4, 5]); // T4
const cisco = baitFromFish("Cisco", 3, [6, 7, 8]); // T7
const goggle = baitFromFish("Goggle-eye", 3, [7, 8]); // T8

console.log("=== Derived bait tiers ===");
for (const b of [worms, minnow, shad, menhaden, cisco, goggle]) console.log(`${b.name.padEnd(16)} T${b.tier}`);

const stream = spotOf("stream"); // T1-2
const beach = spotOf("beach"); // T1-2-3
const dock = spotOf("dock"); // T3-5
const offshore = spotOf("offshore"); // T6-8

console.log("\n=== Hook mix (spot × bait) ===");
const rows: [string, Spot, number | null][] = [
  ["stream, no bait", stream, null],
  ["stream + worms (T2)", stream, worms.tier],
  ["beach, no bait", beach, null],
  ["beach + worms (T2)", beach, worms.tier],
  ["beach + minnow (T3)", beach, minnow.tier],
  ["dock + shad (T4)", dock, shad.tier],
  ["dock + menhaden (T4)", dock, menhaden.tier],
  ["offshore + cisco (T7)", offshore, cisco.tier],
  ["offshore + goggle-eye (T8)", offshore, goggle.tier],
  ["offshore + worms (inert)", offshore, worms.tier],
];
const mixes = new Map<string, Mix>();
for (const [label, spot, tier] of rows) {
  const m = measure(spot, tier);
  mixes.set(label, m);
  console.log(`${label.padEnd(28)} ${fmt(m)}`);
}

console.log("\n=== Verdicts ===");
const near = (got: number, want: number, tol = 2) => Math.abs(got - want) <= tol;
const g = (label: string) => mixes.get(label)!;
const checks: [string, boolean, string][] = [
  ["stream no bait ≈ 90/10 T1/T2", near(g("stream, no bait").tierPct[1] ?? 0, 90), `T1 ${(g("stream, no bait").tierPct[1] ?? 0).toFixed(0)}%`],
  ["stream+T2 bait ≈ 60/40 T2/T1 (about 50/50)", near(g("stream + worms (T2)").tierPct[2] ?? 0, 60), `T2 ${(g("stream + worms (T2)").tierPct[2] ?? 0).toFixed(0)}%`],
  ["baited junk ≈ 10% of T1 bites", near(g("stream + worms (T2)").junkOfT1, 10), `${g("stream + worms (T2)").junkOfT1.toFixed(0)}%`],
  ["unbaited junk ≈ 32% of T1 bites", near(g("stream, no bait").junkOfT1, 32, 3), `${g("stream, no bait").junkOfT1.toFixed(0)}%`],
  [
    "T2 bait @T1-2-3 = 30/60/10",
    near(g("beach + worms (T2)").tierPct[1] ?? 0, 30) && near(g("beach + worms (T2)").tierPct[2] ?? 0, 60) && near(g("beach + worms (T2)").tierPct[3] ?? 0, 10),
    fmt(g("beach + worms (T2)")),
  ],
  [
    "T3 bait @T1-2-3 = 0/30/70 + no junk",
    (g("beach + minnow (T3)").tierPct[1] ?? 0) === 0 && near(g("beach + minnow (T3)").tierPct[2] ?? 0, 30) && near(g("beach + minnow (T3)").tierPct[3] ?? 0, 70),
    fmt(g("beach + minnow (T3)")),
  ],
  [
    "T4 bait @T3-5 = 40/60 T3/T4 (missing T2 falls low)",
    near(g("dock + shad (T4)").tierPct[4] ?? 0, 60) && near(g("dock + shad (T4)").tierPct[3] ?? 0, 40),
    fmt(g("dock + shad (T4)")),
  ],
  [
    "T8 bait @offshore = 50/30/20 T6/T7/T8",
    near(g("offshore + goggle-eye (T8)").tierPct[6] ?? 0, 50) && near(g("offshore + goggle-eye (T8)").tierPct[8] ?? 0, 20),
    fmt(g("offshore + goggle-eye (T8)")),
  ],
  [
    "inert bait (no shared tiers) = natural pool (T6 ≈ 55%)",
    near(g("offshore + worms (inert)").tierPct[6] ?? 0, 55, 3),
    fmt(g("offshore + worms (inert)")),
  ],
];
for (const [label, ok, got] of checks) console.log(`${ok ? "PASS" : "TUNE"}  ${label} — got ${got}`);

/**
 * Region parity check.
 * Run: `node scripts/regionsim.ts`  (Node 24 strips the TS types automatically)
 *
 * Coastal (startable) regions must cover fish tiers 1–8 in BOTH fresh and salt
 * water (the "even starts" rule). Central regions are higher-tier and often
 * landlocked, so their coverage is just printed for review — no strict assert.
 * Exits non-zero only if a coastal region has a gap.
 */
import { REGIONS, type Region } from "../src/world/regions.ts";
import type { Water } from "../src/fishing/fishCatalog.ts";

const ALL_TIERS = [1, 2, 3, 4, 5, 6, 7, 8];

function coverage(region: Region, water: Water): Set<number> {
  const tiers = new Set<number>();
  for (const spot of region.spots) {
    if (spot.water !== water) continue;
    for (const t of spot.tiers) tiers.add(t.tier);
  }
  return tiers;
}

function missing(covered: Set<number>): number[] {
  return ALL_TIERS.filter((t) => !covered.has(t));
}

console.log("=== Region coverage (coastal must hit 1–8 fresh & salt; central = higher-tier) ===");
console.log("region                  kind     fresh tiers   salt tiers    status");
let ok = true;
for (const r of REGIONS) {
  const fresh = coverage(r, "fresh");
  const salt = coverage(r, "salt");
  const fStr = ALL_TIERS.map((t) => (fresh.has(t) ? t : "·")).join("");
  const sStr = ALL_TIERS.map((t) => (salt.has(t) ? t : "·")).join("");
  let status: string;
  if (r.central) {
    const hasSpots = r.spots.some((s) => s.access === "land");
    if (!hasSpots) ok = false;
    status = hasSpots ? "ok (higher-tier)" : "FAIL (no land spots)";
  } else {
    const gaps = [...missing(fresh).map((t) => `F${t}`), ...missing(salt).map((t) => `S${t}`)];
    if (gaps.length) ok = false;
    status = gaps.length ? "FAIL (" + gaps.join(",") + ")" : "PASS";
  }
  console.log(
    `${r.name.padEnd(22)}  ${(r.central ? "central" : "coastal").padEnd(7)}  ${fStr.padEnd(11)}  ${sStr.padEnd(11)}  ${status}`,
  );
}

console.log(ok ? "\nCoastal parity OK." : "\nFAILURE — see above.");
if (!ok) process.exit(1);

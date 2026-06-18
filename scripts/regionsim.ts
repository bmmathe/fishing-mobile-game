/**
 * Region parity check.
 * Run: `node scripts/regionsim.ts`  (Node 24 strips the TS types automatically)
 *
 * Asserts the "even regions" rule: every region's spots collectively cover
 * fish tiers 1–8 in BOTH fresh and salt water. Prints a coverage table and
 * exits non-zero if any region has a gap.
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

console.log("=== Region tier-parity (need 1–8 in BOTH fresh & salt) ===");
console.log("region              fresh tiers            salt tiers             status");
let ok = true;
for (const r of REGIONS) {
  if (r.locked) continue; // locked regions have no spots yet
  const fresh = coverage(r, "fresh");
  const salt = coverage(r, "salt");
  const gaps = [...missing(fresh).map((t) => `F${t}`), ...missing(salt).map((t) => `S${t}`)];
  const pass = gaps.length === 0;
  if (!pass) ok = false;
  const fStr = ALL_TIERS.map((t) => (fresh.has(t) ? t : "·")).join("");
  const sStr = ALL_TIERS.map((t) => (salt.has(t) ? t : "·")).join("");
  console.log(
    `${r.name.padEnd(18)}  ${fStr.padEnd(20)}  ${sStr.padEnd(20)}  ` +
      `${pass ? "PASS" : "FAIL (" + gaps.join(",") + ")"}`,
  );
}

console.log(ok ? "\nAll regions PASS parity." : "\nPARITY FAILURE — see gaps above.");
if (!ok) process.exit(1);

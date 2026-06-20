/**
 * Boat + fishing-fee economy harness.
 * Run: `node scripts/boatsim.ts`  (Node 24 strips the TS types automatically)
 *
 * Prints the boat tiers and the fishing-fee table (foot vs boat), and sanity-
 * checks that a single average catch at a spot exceeds its fishing fee — so a
 * fishing session (many casts) stays comfortably net-positive while the boat
 * fee is a meaningful sink.
 */
import { BOAT_TIERS, fishFee, fishValue } from "../src/game/gear.ts";
import { REGIONS } from "../src/world/regions.ts";
import type { HoleQuality } from "../src/fishing/fishingHoles.ts";

console.log("=== Boat tiers ===");
console.log("tier  name               price    speed  ocean");
BOAT_TIERS.forEach((b, i) => {
  console.log(`T${i + 1}    ${b.name.padEnd(18)} $${b.price.toString().padStart(6)}  ${b.speed.toFixed(1)}    ${b.ocean ? "yes" : "no"}`);
});

console.log("\n=== Fishing fee by quality (foot vs boat) ===");
console.log("quality  foot   boat");
(["D", "C", "B", "A", "S"] as HoleQuality[]).forEach((q) => {
  console.log(`${q}        $${String(fishFee(q, false)).padStart(3)}   $${String(fishFee(q, true)).padStart(3)}`);
});

console.log("\n=== Fee vs avg single-catch value per spot (want value > fee) ===");
let anyBad = false;
for (const r of REGIONS) {
  for (const s of r.spots) {
    const byBoat = s.access === "boat";
    const fee = fishFee(s.quality, byBoat);
    // average value of one fish from the spot's weighted tier pool
    const total = s.tiers.reduce((sum, t) => sum + t.weight, 0);
    const avgTier = s.tiers.reduce((sum, t) => sum + t.tier * t.weight, 0) / total;
    const t = Math.round(avgTier);
    const avgVal = fishValue(t, 5); // nominal weight
    const ok = avgVal >= fee;
    if (!ok) anyBad = true;
    if (!ok) {
      console.log(`  ⚠ ${r.id}/${s.body} (${s.quality}, ${byBoat ? "boat" : "foot"}): fee $${fee} > avg catch $${avgVal} (T~${t})`);
    }
  }
}
console.log(anyBad ? "\nSome spots have fee ≥ single-catch value (sessions still net-positive over many casts)." : "\nAll spots: one average catch covers the fishing fee.");
